import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  CreditTransactionType,
  ECONOMY_DEFAULTS,
  type MeResponseDto,
} from '@palmsight/shared';
import { User, UserDocument } from '../schemas/user.schema';
import { Referral, ReferralDocument } from '../schemas/referral.schema';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { getRewardDay } from '../currency/reward-day.util';

@Injectable()
export class UsersService {
  private clockFn: () => Date = () => new Date();

  constructor(
    @InjectModel(Referral.name)
    private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService,
    private readonly creditLedgerService: CreditLedgerService,
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

  async getMe(user: UserDocument): Promise<MeResponseDto> {
    const now = this.now();
    const enteredReferral = await this.referralModel
      .findOne({ refereeId: user._id })
      .lean();
    const baseUrl = this.configService
      .get<string>('PUBLIC_BASE_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    const identitySecret = this.configService.get<string>(
      'IDENTITY_HASH_SECRET',
      'palmsight-identity-secret',
    );
    const computedBillingRef =
      user.billingRef ||
      crypto
        .createHmac('sha256', identitySecret)
        .update(`billing:${user._id.toString()}`)
        .digest('hex');

    if (!user.billingRef) {
      await this.userModel.updateOne(
        { _id: user._id, billingRef: null },
        { $set: { billingRef: computedBillingRef } },
      );
    }

    const vipActive = Boolean(
      user.vipExpiresAt && user.vipExpiresAt.getTime() > now.getTime(),
    );

    const rewardTz = this.configService.get<string>(
      'REWARD_TZ',
      ECONOMY_DEFAULTS.REWARD_TZ,
    );
    const vipDaily = Number(
      this.configService.get('VIP_DAILY', ECONOMY_DEFAULTS.VIP_DAILY),
    );
    const currentRewardDay = getRewardDay(now, rewardTz);

    let currentBalance = user.creditBalance;
    let grantedNow = false;
    let vipDailyGranted: number | undefined;

    if (vipActive && user.vipDailyDay !== currentRewardDay && vipDaily > 0) {
      const session = await this.connection.startSession();
      try {
        session.startTransaction();
        const claimed = await this.userModel
          .findOneAndUpdate(
            {
              _id: user._id,
              deletedAt: null,
              vipDailyDay: { $ne: currentRewardDay },
            },
            { $set: { vipDailyDay: currentRewardDay } },
            { session, new: true },
          )
          .lean();

        if (claimed) {
          const tx = await this.creditLedgerService.credit(
            {
              userId: user._id,
              amount: vipDaily,
              type: CreditTransactionType.VIP_DAILY,
              reason: 'vip_daily',
            },
            session,
          );
          await session.commitTransaction();
          currentBalance = tx.balanceAfter;
          grantedNow = true;
          vipDailyGranted = vipDaily;
        } else {
          await session.abortTransaction();
          const freshUser = await this.userModel.findById(user._id).lean();
          if (freshUser) {
            currentBalance = freshUser.creditBalance;
          }
        }
      } catch {
        await session.abortTransaction();
      } finally {
        await session.endSession();
      }
    }

    return {
      id: user._id.toString(),
      displayName: user.displayName,
      username: user.username ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
      creditBalance: currentBalance,
      balance: currentBalance,
      vip: {
        active: vipActive,
        productId: vipActive ? (user.vipProductId ?? null) : null,
        expiresAt: user.vipExpiresAt ? user.vipExpiresAt.toISOString() : null,
        willRenew: vipActive ? Boolean(user.vipWillRenew) : false,
      },
      billingRef: computedBillingRef,
      grantedNow,
      ...(vipDailyGranted !== undefined ? { vipDailyGranted } : {}),
      referralCode: user.referralCode,
      referralLink: `${baseUrl}/r/${user.referralCode}`,
      hasPassword: Boolean(user.passwordHash),
      providers: (user.identities ?? []).map((identity) => identity.provider),
      isAnonymous: Boolean(user.isAnonymous),
      referral: {
        canEnterCode: !enteredReferral && !user.referralBlocked,
        enteredCode: enteredReferral?.codeUsed ?? null,
      },
    };
  }
}
