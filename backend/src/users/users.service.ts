import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import type { MeResponseDto } from '@palmsight/shared';
import { User, UserDocument } from '../schemas/user.schema';
import { Referral, ReferralDocument } from '../schemas/referral.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(Referral.name)
    private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async getMe(user: UserDocument): Promise<MeResponseDto> {
    const enteredReferral = await this.referralModel
      .findOne({ refereeId: user._id })
      .lean();
    const baseUrl = this.configService
      .get<string>('PUBLIC_BASE_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    const identitySecret = this.configService.get<string>(
      'IDENTITY_HASH_SECRET',
      'test-identity-secret-at-least-32-chars-long',
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
      user.vipExpiresAt && user.vipExpiresAt.getTime() > Date.now(),
    );

    return {
      id: user._id.toString(),
      displayName: user.displayName,
      username: user.username ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
      creditBalance: user.creditBalance,
      balance: user.creditBalance,
      vip: {
        active: vipActive,
        productId: vipActive ? (user.vipProductId ?? null) : null,
        expiresAt: user.vipExpiresAt ? user.vipExpiresAt.toISOString() : null,
        willRenew: vipActive ? Boolean(user.vipWillRenew) : false,
      },
      billingRef: computedBillingRef,
      grantedNow: false,
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
