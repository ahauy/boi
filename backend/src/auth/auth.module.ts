import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User, UserSchema } from '../schemas/user.schema';
import { Session, SessionSchema } from '../schemas/session.schema';
import { Referral, ReferralSchema } from '../schemas/referral.schema';
import {
  DeletedIdentity,
  DeletedIdentitySchema,
} from '../schemas/deleted-identity.schema';
import { Reading, ReadingSchema } from '../schemas/reading.schema';
import { Device, DeviceSchema } from '../schemas/device.schema';

import { CreditsModule } from '../credits/credits.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: DeletedIdentity.name, schema: DeletedIdentitySchema },
      { name: Reading.name, schema: ReadingSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'default-jwt-secret-palm-sight-dev'),
        signOptions: {
          expiresIn: Number(config.get('JWT_ACCESS_TTL_SECONDS', 900)),
        },
      }),
    }),
    CreditsModule,
    ReferralsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitGuard, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule, MongooseModule],
})
export class AuthModule {}
