import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { MeResponseDto } from '@palmsight/shared';
import { UserDocument } from '../schemas/user.schema';
import { Referral, ReferralDocument } from '../schemas/referral.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(Referral.name) private readonly referralModel: Model<ReferralDocument>,
    private readonly configService: ConfigService,
  ) {}

  async getMe(user: UserDocument): Promise<MeResponseDto> {
    const enteredReferral = await this.referralModel.findOne({ refereeId: user._id }).lean();
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:5173').replace(/\/+$/, '');

    return {
      id: user._id.toString(),
      displayName: user.displayName,
      username: user.username ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
      creditBalance: user.creditBalance,
      referralCode: user.referralCode,
      referralLink: `${baseUrl}/r/${user.referralCode}`,
      hasPassword: Boolean(user.passwordHash),
      providers: (user.identities ?? []).map((identity) => identity.provider),
      referral: {
        canEnterCode: !enteredReferral && !user.referralBlocked,
        enteredCode: enteredReferral?.codeUsed ?? null,
      },
    };
  }
}
