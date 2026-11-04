import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  BillingVerifyRequestDto,
  BillingVerifyResponseDto,
  CreditTransactionType,
  ECONOMY_DEFAULTS,
} from '@palmsight/shared';
import { User, UserDocument } from '../schemas/user.schema';
import {
  PlaySubscription,
  PlaySubscriptionDocument,
} from '../schemas/play-subscription.schema';
import {
  BillingEvent,
  BillingEventDocument,
} from '../schemas/billing-event.schema';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { getRewardDay } from '../currency/reward-day.util';
import { PlayPurchaseVerifier } from './play-purchase.verifier';

export interface RtdnWebhookPayload {
  eventId?: string;
  purchaseToken?: string;
  notificationType?: number;
  productId?: string;
  subscriptionId?: string;
  expiresAt?: string;
  willRenew?: boolean;
  message?: {
    messageId?: string;
    data?: string;
    publishTime?: string;
  };
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
}

export interface RtdnWebhookResult {
  received: boolean;
  duplicate: boolean;
  eventId: string;
  updatedSubscription: boolean;
}

@Injectable()
export class BillingService {
  private clockFn: () => Date = () => new Date();

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PlaySubscription.name)
    private readonly playSubscriptionModel: Model<PlaySubscriptionDocument>,
    @InjectModel(BillingEvent.name)
    private readonly billingEventModel: Model<BillingEventDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly playPurchaseVerifier: PlayPurchaseVerifier,
  ) {}

  setClock(fn: () => Date): void {
    this.clockFn = fn;
  }

  resetClock(): void {
    this.clockFn = () => new Date();
  }

  private now(): Date {
    return this.clockFn();
  }

  private computeBillingRef(userId: Types.ObjectId): string {
    const identitySecret = this.configService.get<string>(
      'IDENTITY_HASH_SECRET',
      'palmsight-identity-secret',
    );
    return crypto
      .createHmac('sha256', identitySecret)
      .update(`billing:${userId.toString()}`)
      .digest('hex');
  }

  async verifyPurchase(
    user: UserDocument,
    dto: BillingVerifyRequestDto,
  ): Promise<BillingVerifyResponseDto> {
    const now = this.now();

    const verified = await this.playPurchaseVerifier.verify({
      ...dto,
      now,
    });

    const rewardTz = this.configService.get<string>(
      'REWARD_TZ',
      ECONOMY_DEFAULTS.REWARD_TZ,
    );
    const vipDaily = Number(
      this.configService.get('VIP_DAILY', ECONOMY_DEFAULTS.VIP_DAILY),
    );
    const currentRewardDay = getRewardDay(now, rewardTz);

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const lockedUser = await this.userModel.findOneAndUpdate(
        { _id: user._id, deletedAt: null },
        { $set: { updatedAt: now } },
        { session, new: true },
      );

      if (!lockedUser) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Người dùng không tồn tại.',
        });
      }

      const billingRef =
        lockedUser.billingRef || this.computeBillingRef(lockedUser._id);

      const existingSub = await this.playSubscriptionModel
        .findOne({ purchaseToken: verified.purchaseToken })
        .session(session);

      const previousOwnerId =
        existingSub &&
        existingSub.userId.toString() !== lockedUser._id.toString()
          ? existingSub.userId
          : null;

      const restored = Boolean(existingSub);

      // First purchase rule (Playbook §5.6 & §11.10):
      // Only true when NOT a trial, price > 0, and neither this user nor this token has ever been counted before.
      const priorPaidExists = await this.playSubscriptionModel
        .exists({
          $or: [
            { userId: lockedUser._id, firstPurchaseCounted: true },
            {
              purchaseToken: verified.purchaseToken,
              firstPurchaseCounted: true,
            },
          ],
        })
        .session(session);

      const isPaidPurchase =
        !verified.isTrial && verified.priceAmountMicros > 0;
      const firstPurchase = Boolean(isPaidPurchase && !priorPaidExists);
      const firstPurchaseCounted = Boolean(
        existingSub?.firstPurchaseCounted || firstPurchase,
      );

      // Upgrade handling (Playbook §6.2): if the user already has another active subscription token,
      // mark the old subscription as superseded by the new token.
      let supersededPurchaseToken: string | null = null;
      if (verified.expiresAt.getTime() > now.getTime()) {
        const activeOtherSubs = await this.playSubscriptionModel
          .find({
            userId: lockedUser._id,
            purchaseToken: { $ne: verified.purchaseToken },
            supersededBy: null,
            expiresAt: { $gt: now },
          })
          .sort({ expiresAt: -1 })
          .session(session);

        if (activeOtherSubs.length > 0) {
          supersededPurchaseToken = activeOtherSubs[0].purchaseToken;
          await this.playSubscriptionModel.updateMany(
            {
              _id: { $in: activeOtherSubs.map((s) => s._id) },
            },
            {
              $set: {
                supersededBy: verified.purchaseToken,
                willRenew: false,
                updatedAt: now,
              },
            },
            { session },
          );
        }
      }

      await this.playSubscriptionModel.findOneAndUpdate(
        { purchaseToken: verified.purchaseToken },
        {
          $set: {
            productId: verified.productId,
            userId: lockedUser._id,
            orderId: verified.orderId,
            expiresAt: verified.expiresAt,
            willRenew: verified.willRenew,
            isTrial: verified.isTrial,
            priceAmountMicros: verified.priceAmountMicros,
            priceCurrencyCode: verified.priceCurrencyCode,
            acknowledged: verified.acknowledged,
            supersededBy: null,
            adjustAdid: dto.adjustAdid ?? existingSub?.adjustAdid ?? null,
            gaid: dto.gaid ?? existingSub?.gaid ?? null,
            firstPurchaseCounted,
            rawResponse: verified.rawResponse ?? null,
            updatedAt: now,
          },
        },
        { upsert: true, new: true, session },
      );

      // If transferred from a previous user (e.g. guest -> registered or reinstall restore),
      // sync the previous user's VIP fields so the old account no longer holds this token's VIP.
      if (previousOwnerId) {
        await this.recomputeUserVipFields(previousOwnerId, now, session);
      }

      const vipActive = verified.expiresAt.getTime() > now.getTime();
      const effectiveWillRenew = vipActive ? verified.willRenew : false;

      let currentBalance = lockedUser.creditBalance;
      let grantedNow = false;
      let vipDailyGranted: number | undefined;

      if (
        vipActive &&
        lockedUser.vipDailyDay !== currentRewardDay &&
        vipDaily > 0
      ) {
        const tx = await this.creditLedgerService.credit(
          {
            userId: lockedUser._id,
            amount: vipDaily,
            type: CreditTransactionType.VIP_DAILY,
            reason: 'vip_daily',
            extraUserSet: {
              billingRef,
              vipExpiresAt: verified.expiresAt,
              vipProductId: verified.productId,
              vipWillRenew: effectiveWillRenew,
              vipDailyDay: currentRewardDay,
            },
          },
          session,
        );
        currentBalance = tx.balanceAfter;
        grantedNow = true;
        vipDailyGranted = vipDaily;
      } else {
        await this.userModel.updateOne(
          { _id: lockedUser._id },
          {
            $set: {
              billingRef,
              vipExpiresAt: verified.expiresAt,
              vipProductId: verified.productId,
              vipWillRenew: effectiveWillRenew,
              updatedAt: now,
            },
          },
          { session },
        );
      }

      await session.commitTransaction();

      return {
        vip: {
          active: vipActive,
          productId: vipActive ? verified.productId : null,
          expiresAt: verified.expiresAt.toISOString(),
          willRenew: effectiveWillRenew,
        },
        firstPurchase,
        restored,
        supersededPurchaseToken,
        balance: currentBalance,
        grantedNow,
        ...(vipDailyGranted !== undefined ? { vipDailyGranted } : {}),
        billingRef,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  private async recomputeUserVipFields(
    userId: Types.ObjectId,
    now: Date,
    session: ClientSession,
  ): Promise<void> {
    const latestSub = await this.playSubscriptionModel
      .findOne({
        userId,
        supersededBy: null,
      })
      .sort({ expiresAt: -1 })
      .session(session);

    if (!latestSub) {
      await this.userModel.updateOne(
        { _id: userId },
        {
          $set: {
            vipExpiresAt: null,
            vipProductId: null,
            vipWillRenew: false,
            updatedAt: now,
          },
        },
        { session },
      );
      return;
    }

    const active = latestSub.expiresAt.getTime() > now.getTime();
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          vipExpiresAt: latestSub.expiresAt,
          vipProductId: latestSub.productId,
          vipWillRenew: active ? latestSub.willRenew : false,
          updatedAt: now,
        },
      },
      { session },
    );
  }

  async handleRtdnWebhook(
    body: RtdnWebhookPayload,
  ): Promise<RtdnWebhookResult> {
    const now = this.now();

    let decodedData: Record<string, any> = {};
    if (body?.message?.data) {
      try {
        const jsonStr = Buffer.from(body.message.data, 'base64').toString(
          'utf8',
        );
        decodedData = JSON.parse(jsonStr);
      } catch {
        throw new BadRequestException({
          code: 'invalid_rtdn_payload',
          message: 'Dữ liệu base64 trong RTDN message không hợp lệ.',
        });
      }
    }

    const subNotif =
      decodedData.subscriptionNotification ??
      body.subscriptionNotification ??
      null;

    const purchaseToken = (
      subNotif?.purchaseToken ??
      decodedData.purchaseToken ??
      body.purchaseToken ??
      ''
    ).trim();

    const notificationType: number | null =
      typeof subNotif?.notificationType === 'number'
        ? subNotif.notificationType
        : typeof decodedData.notificationType === 'number'
          ? decodedData.notificationType
          : typeof body.notificationType === 'number'
            ? body.notificationType
            : null;

    const productId: string | null =
      subNotif?.subscriptionId ??
      decodedData.subscriptionId ??
      decodedData.productId ??
      body.subscriptionId ??
      body.productId ??
      null;

    const rawEventId =
      body.eventId ??
      body.message?.messageId ??
      decodedData.eventId ??
      null;

    if (!purchaseToken && !rawEventId) {
      throw new BadRequestException({
        code: 'invalid_rtdn_payload',
        message: 'Thiếu thông tin eventId hoặc purchaseToken trong RTDN.',
      });
    }

    const eventId = (
      rawEventId ||
      crypto
        .createHash('sha256')
        .update(JSON.stringify(body))
        .digest('hex')
    ).trim();

    // Idempotency check in billing_events
    const existingEvent = await this.billingEventModel
      .findOne({ eventId })
      .lean();
    if (existingEvent) {
      return {
        received: true,
        duplicate: true,
        eventId,
        updatedSubscription: false,
      };
    }

    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      // Double-check inside transaction
      const dupInTx = await this.billingEventModel
        .findOne({ eventId })
        .session(session);
      if (dupInTx) {
        await session.abortTransaction();
        return {
          received: true,
          duplicate: true,
          eventId,
          updatedSubscription: false,
        };
      }

      await this.billingEventModel.create(
        [
          {
            eventId,
            purchaseToken: purchaseToken || 'unknown',
            notificationType,
            productId,
            processedAt: now,
            payload: (decodedData && Object.keys(decodedData).length > 0
              ? decodedData
              : body) as Record<string, unknown>,
          },
        ],
        { session },
      );

      let updatedSubscription = false;

      if (purchaseToken) {
        const sub = await this.playSubscriptionModel
          .findOne({ purchaseToken })
          .session(session);

        if (sub) {
          let newExpiresAt = sub.expiresAt;
          let newWillRenew = sub.willRenew;

          const explicitExpiresAt =
            decodedData.expiresAt ?? body.expiresAt ?? null;
          if (explicitExpiresAt) {
            const parsed = new Date(explicitExpiresAt);
            if (!Number.isNaN(parsed.getTime())) {
              newExpiresAt = parsed;
            }
          }

          if (typeof body.willRenew === 'boolean') {
            newWillRenew = body.willRenew;
          } else if (typeof decodedData.willRenew === 'boolean') {
            newWillRenew = decodedData.willRenew;
          } else if (notificationType !== null) {
            // Google Play RTDN notificationType codes:
            // 1: RECOVERED, 2: RENEWED, 4: PURCHASED, 7: RESTARTED -> active & willRenew = true
            // 3: CANCELED, 5: ON_HOLD, 6: IN_GRACE_PERIOD, 10: PAUSED -> willRenew = false
            // 12: REVOKED, 13: EXPIRED -> expired immediately & willRenew = false
            if ([1, 2, 4, 7].includes(notificationType)) {
              newWillRenew = true;
              if (!explicitExpiresAt && newExpiresAt.getTime() <= now.getTime()) {
                const days =
                  sub.productId === 'yearlyid'
                    ? 365
                    : sub.productId === 'monthlyid'
                      ? 30
                      : 7;
                newExpiresAt = new Date(
                  now.getTime() + days * 24 * 60 * 60 * 1000,
                );
              }
            } else if ([3, 5, 6, 10].includes(notificationType)) {
              newWillRenew = false;
            } else if ([12, 13].includes(notificationType)) {
              newWillRenew = false;
              if (!explicitExpiresAt || newExpiresAt.getTime() > now.getTime()) {
                newExpiresAt = new Date(now.getTime() - 1000);
              }
            }
          }

          sub.expiresAt = newExpiresAt;
          sub.willRenew = newWillRenew;
          if (productId) {
            sub.productId = productId;
          }
          await sub.save({ session });
          await this.recomputeUserVipFields(sub.userId, now, session);
          updatedSubscription = true;
        }
      }

      await session.commitTransaction();
      return {
        received: true,
        duplicate: false,
        eventId,
        updatedSubscription,
      };
    } catch (err: any) {
      await session.abortTransaction();
      if (err?.code === 11000) {
        return {
          received: true,
          duplicate: true,
          eventId,
          updatedSubscription: false,
        };
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
