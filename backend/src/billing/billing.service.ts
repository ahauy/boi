import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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
import {
  PlayPurchaseVerifier,
  VerifiedPlayPurchase,
} from './play-purchase.verifier';

export interface RtdnWebhookPayload {
  eventId?: string;
  purchaseToken?: string;
  notificationType?: number;
  productId?: string;
  subscriptionId?: string;
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

interface UserVipState {
  active: boolean;
  productId: string | null;
  expiresAt: Date | null;
  willRenew: boolean;
}

export interface RtdnWebhookResult {
  received: boolean;
  duplicate: boolean;
  eventId: string;
  updatedSubscription: boolean;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
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
        !verified.isTrial &&
        verified.priceAmountMicros > 0 &&
        verified.expiresAt.getTime() > now.getTime();
      const firstPurchase = Boolean(isPaidPurchase && !priorPaidExists);
      const firstPurchaseCounted = Boolean(
        existingSub?.firstPurchaseCounted || firstPurchase,
      );

      // A superseded token stays superseded while its replacement lasts at least as long.
      const replacement = existingSub?.supersededBy
        ? await this.playSubscriptionModel
            .findOne({ purchaseToken: existingSub.supersededBy })
            .session(session)
        : null;
      const staysSuperseded = Boolean(
        replacement && replacement.expiresAt >= verified.expiresAt,
      );

      // Upgrade handling (Playbook §6.2): the verified token replaces active tokens it outlasts.
      // Tokens that outlast it stay, or re-verifying an old plan would displace the newer one.
      let supersededPurchaseToken: string | null = null;
      if (verified.expiresAt.getTime() > now.getTime() && !staysSuperseded) {
        const activeOtherSubs = await this.playSubscriptionModel
          .find({
            userId: lockedUser._id,
            purchaseToken: { $ne: verified.purchaseToken },
            supersededBy: null,
            expiresAt: { $gt: now, $lte: verified.expiresAt },
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
            supersededBy: staysSuperseded ? existingSub?.supersededBy : null,
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

      // VIP comes from every token the user holds: this one may be expired or the shorter plan.
      const vip = await this.recomputeUserVipFields(
        lockedUser._id,
        now,
        session,
      );

      let currentBalance = lockedUser.creditBalance;
      let grantedNow = false;
      let vipDailyGranted: number | undefined;

      if (
        vip.active &&
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
              updatedAt: now,
            },
          },
          { session },
        );
      }

      await session.commitTransaction();

      return {
        vip: {
          active: vip.active,
          productId: vip.active ? vip.productId : null,
          expiresAt: vip.expiresAt?.toISOString() ?? null,
          willRenew: vip.willRenew,
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
  ): Promise<UserVipState> {
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
      return { active: false, productId: null, expiresAt: null, willRenew: false };
    }

    const active = latestSub.expiresAt.getTime() > now.getTime();
    const willRenew = active ? latestSub.willRenew : false;
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          vipExpiresAt: latestSub.expiresAt,
          vipProductId: latestSub.productId,
          vipWillRenew: willRenew,
          updatedAt: now,
        },
      },
      { session },
    );
    return {
      active,
      productId: latestSub.productId,
      expiresAt: latestSub.expiresAt,
      willRenew,
    };
  }

  /**
   * The Pub/Sub push subscription calls `/billing/rtdn?token=<RTDN_PUSH_TOKEN>`.
   * Without a configured token the endpoint stays closed, so Pub/Sub keeps
   * retrying instead of an open webhook accepting anyone.
   */
  assertRtdnToken(token: string | undefined): void {
    const expected = this.configService.get<string>('RTDN_PUSH_TOKEN', '');
    if (!expected) {
      throw new ServiceUnavailableException({
        code: 'rtdn_not_configured',
        message: 'RTDN chưa được cấu hình.',
      });
    }

    const expectedHash = crypto.createHash('sha256').update(expected).digest();
    const actualHash = crypto
      .createHash('sha256')
      .update(token ?? '')
      .digest();
    if (!crypto.timingSafeEqual(expectedHash, actualHash)) {
      throw new UnauthorizedException({
        code: 'invalid_rtdn_token',
        message: 'RTDN token không hợp lệ.',
      });
    }
  }

  /**
   * Returns Google's current state for a subscription we know about. A token
   * Google no longer recognises returns null so the event is still recorded;
   * unavailability propagates so Pub/Sub redelivers.
   */
  private async fetchSubscriptionTruth(
    purchaseToken: string,
    productId: string,
    now: Date,
  ): Promise<VerifiedPlayPurchase | null> {
    try {
      return await this.playPurchaseVerifier.verify({
        productId,
        purchaseToken,
        now,
      });
    } catch (err) {
      if (err instanceof BadRequestException) {
        this.logger.warn(
          `RTDN could not re-verify a subscription: ${err.message}`,
        );
        return null;
      }
      throw err;
    }
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

    // Look up outside the transaction: a Google outage must leave no event behind
    // so the redelivered message is processed instead of treated as a duplicate.
    const knownSub = purchaseToken
      ? await this.playSubscriptionModel.findOne({ purchaseToken }).lean()
      : null;
    const truth = knownSub
      ? await this.fetchSubscriptionTruth(
          purchaseToken,
          productId ?? knownSub.productId,
          now,
        )
      : null;

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
          let newExpiresAt = truth?.expiresAt ?? sub.expiresAt;
          let newWillRenew = truth?.willRenew ?? sub.willRenew;

          // 12: REVOKED, 13: EXPIRED end access now, whatever expiry Google still reports.
          if (notificationType === 12 || notificationType === 13) {
            newWillRenew = false;
            if (newExpiresAt.getTime() > now.getTime()) {
              newExpiresAt = new Date(now.getTime() - 1000);
            }
          }

          sub.expiresAt = newExpiresAt;
          sub.willRenew = newWillRenew;
          if (truth) {
            sub.productId = truth.productId;
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
