import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreditsModule } from '../credits/credits.module';
import { Referral, ReferralSchema } from '../schemas/referral.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [
    CreditsModule,
    MongooseModule.forFeature([
      { name: Referral.name, schema: ReferralSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
