import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { CreditsModule } from "../credits/credits.module";
import { User, UserSchema } from "../schemas/user.schema";
import { Referral, ReferralSchema } from "../schemas/referral.schema";
import { ReferralsModule } from "../referrals/referrals.module";
import { ReadingsModule } from "../readings/readings.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { AvatarService } from "./avatar.service";
import { UserRateLimitGuard } from "../auth/guards/user-rate-limit.guard";

@Module({
  imports: [
    AuthModule,
    CreditsModule,
    ReferralsModule,
    // CloudinaryService dùng chung với ảnh lòng bàn tay
    ReadingsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Referral.name, schema: ReferralSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, AvatarService, UserRateLimitGuard],
})
export class UsersModule {}
