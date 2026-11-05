import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreditsModule } from '../credits/credits.module';
import { Device, DeviceSchema } from '../schemas/device.schema';
import { Referral, ReferralSchema } from '../schemas/referral.schema';
import {
  ReferralNetworkCounter,
  ReferralNetworkCounterSchema,
} from '../schemas/referral-network-counter.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ReferralNetworkQuotaService } from './referral-network-quota.service';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [
    CreditsModule,
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: Referral.name, schema: ReferralSchema },
      {
        name: ReferralNetworkCounter.name,
        schema: ReferralNetworkCounterSchema,
      },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ReferralsService, ReferralNetworkQuotaService],
  exports: [ReferralsService, ReferralNetworkQuotaService],
})
export class ReferralsModule {}
