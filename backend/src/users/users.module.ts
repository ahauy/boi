import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { CreditsModule } from "../credits/credits.module";
import { Referral, ReferralSchema } from "../schemas/referral.schema";
import { ReferralsModule } from "../referrals/referrals.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UserRateLimitGuard } from "../auth/guards/user-rate-limit.guard";

@Module({
  imports: [
    AuthModule,
    CreditsModule,
    ReferralsModule,
    MongooseModule.forFeature([
      { name: Referral.name, schema: ReferralSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRateLimitGuard],
})
export class UsersModule {}
