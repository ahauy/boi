import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import {
  PlaySubscription,
  PlaySubscriptionSchema,
} from '../schemas/play-subscription.schema';
import {
  BillingEvent,
  BillingEventSchema,
} from '../schemas/billing-event.schema';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { PlayPurchaseVerifier } from './play-purchase.verifier';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PlaySubscription.name, schema: PlaySubscriptionSchema },
      { name: BillingEvent.name, schema: BillingEventSchema },
    ]),
    AuthModule,
    CreditsModule,
  ],
  controllers: [BillingController],
  providers: [PlayPurchaseVerifier, BillingService],
  exports: [PlayPurchaseVerifier, BillingService],
})
export class BillingModule {}
