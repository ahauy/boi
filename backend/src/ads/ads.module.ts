import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import {
  RewardedAdClaim,
  RewardedAdClaimSchema,
} from '../schemas/rewarded-ad-claim.schema';
import { AuthModule } from '../auth/auth.module';
import { UserRateLimitGuard } from '../auth/guards/user-rate-limit.guard';
import { CreditsModule } from '../credits/credits.module';
import {
  RewardedAdsController,
  RewardedAdSsvController,
} from './rewarded-ads.controller';
import { RewardedAdsService } from './rewarded-ads.service';
import { RewardedAdSsvVerifier } from './rewarded-ad-ssv.verifier';

@Module({
  imports: [
    AuthModule,
    CreditsModule,
    MongooseModule.forFeature([
      { name: RewardedAdClaim.name, schema: RewardedAdClaimSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RewardedAdsController, RewardedAdSsvController],
  providers: [RewardedAdsService, RewardedAdSsvVerifier, UserRateLimitGuard],
  exports: [RewardedAdsService],
})
export class AdsModule {}
