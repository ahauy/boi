import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import * as crypto from 'crypto';
import type {
  ChangePasswordRequestDto,
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
} from '@palmsight/shared';

import { User, UserDocument } from '../schemas/user.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import { PasswordReset, PasswordResetDocument } from '../schemas/password-reset.schema';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';

const resetTokenInvalid = () =>
  new BadRequestException({
    code: 'RESET_TOKEN_INVALID',
    message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
  });

@Injectable()
export class PasswordService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(PasswordReset.name) private readonly passwordResetModel: Model<PasswordResetDocument>,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Also how Google/Facebook-only users set their first password (api-contract.md)
  async forgotPassword(dto: ForgotPasswordRequestDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email, deletedAt: null });
    if (!user) return; // Anti-enumeration: same 202 as an existing email

    const { rawToken, tokenHash } = this.authService.generateVerificationToken();
    const ttlMinutes = Number(this.configService.get('PASSWORD_RESET_TTL_MINUTES', 60));

    await this.passwordResetModel.deleteMany({ userId: user._id, usedAt: null });
    await this.passwordResetModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    });

    // Not awaited: an SMTP round trip (or failure) only for existing emails would reveal which emails have accounts.
    // MailService already logs a failed delivery.
    this.mailService.sendPasswordResetEmail(email, user.displayName, rawToken).catch(() => undefined);
  }

  async resetPassword(dto: ResetPasswordRequestDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const validToken = { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } };

    const reset = await this.passwordResetModel.findOne(validToken);
    if (!reset) throw resetTokenInvalid();

    const user = await this.userModel.findOne({ _id: reset.userId, deletedAt: null });
    if (!user) throw resetTokenInvalid();

    // Checked before the token is consumed, so the user can fix the password and retry with the same link
    this.assertNotEmailOrUsername(dto.newPassword, user);

    const passwordHash = await this.authService.hashPassword(dto.newPassword);

    // Claim atomically: two concurrent submissions of the same link cannot both set a password
    const claimed = await this.passwordResetModel.findOneAndUpdate(
      { _id: reset._id, ...validToken },
      { $set: { usedAt: new Date() } },
    );
    if (!claimed) throw resetTokenInvalid();

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash, passwordUpdatedAt: new Date() } },
    );
    await this.sessionModel.deleteMany({ userId: user._id });
  }

  // Keeps the session the request came from (sid in the access token) and ends every other one
  async changePassword(user: UserDocument, sessionId: string, dto: ChangePasswordRequestDto): Promise<void> {
    if (!user.passwordHash) {
      throw new ConflictException({
        code: 'PASSWORD_NOT_SET',
        message: 'Tài khoản chưa có mật khẩu. Hãy dùng "Quên mật khẩu" để đặt mật khẩu.',
      });
    }

    if (!(await this.authService.verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        code: 'CURRENT_PASSWORD_INCORRECT',
        message: 'Mật khẩu hiện tại không đúng.',
      });
    }

    this.assertNotEmailOrUsername(dto.newPassword, user);

    const passwordHash = await this.authService.hashPassword(dto.newPassword);
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash, passwordUpdatedAt: new Date() } },
    );
    await this.sessionModel.deleteMany({
      userId: user._id,
      ...(isValidObjectId(sessionId) ? { _id: { $ne: sessionId } } : {}),
    });
  }

  private assertNotEmailOrUsername(password: string, user: UserDocument): void {
    const lowerPassword = password.toLowerCase();
    if (lowerPassword === user.email?.toLowerCase() || lowerPassword === user.username?.toLowerCase()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu gửi lên không hợp lệ.',
        details: {
          fields: [{ field: 'newPassword', message: 'Mật khẩu không được trùng với username hoặc email' }],
        },
      });
    }
  }
}
