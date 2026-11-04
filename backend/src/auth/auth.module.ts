import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import {
  PendingRegistration,
  PendingRegistrationSchema,
} from '../schemas/pending-registration.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Session, SessionSchema } from '../schemas/session.schema';
import { Referral, ReferralSchema } from '../schemas/referral.schema';
import {
  DeletedIdentity,
  DeletedIdentitySchema,
} from '../schemas/deleted-identity.schema';
import { PasswordReset, PasswordResetSchema } from '../schemas/password-reset.schema';
import { Reading, ReadingSchema } from '../schemas/reading.schema';
import { GuestTrial, GuestTrialSchema } from '../schemas/guest-trial.schema';
import { Device, DeviceSchema } from '../schemas/device.schema';

import { MailModule } from '../mail/mail.module';
import { CreditsModule } from '../credits/credits.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { GoogleAuthVerifier } from './google-auth.verifier';
import { GoogleBrowserAuthService } from './google-browser-auth.service';
import { FacebookAuthVerifier } from './facebook-auth.verifier';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './password.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PendingRegistration.name, schema: PendingRegistrationSchema },
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: DeletedIdentity.name, schema: DeletedIdentitySchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: Reading.name, schema: ReadingSchema },
      { name: GuestTrial.name, schema: GuestTrialSchema },
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
    MailModule,
    CreditsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AuthRateLimitGuard,
    GoogleAuthVerifier,
    GoogleBrowserAuthService,
    FacebookAuthVerifier,
    JwtAuthGuard,
  ],
  exports: [AuthService, PasswordService, JwtAuthGuard, JwtModule, MongooseModule],
})
export class AuthModule {}
