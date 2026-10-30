import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { renderVerifyEmailHtml, VerifyEmailTemplateParams } from './templates/verify-email.html';
import { renderResetPasswordHtml } from './templates/reset-password.html';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.configService.get<number>('SMTP_PORT', 1025));
    const secure = String(this.configService.get('SMTP_SECURE', 'false')) === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  renderVerificationEmailTemplate(params: VerifyEmailTemplateParams): string {
    return renderVerifyEmailHtml(params);
  }

  async sendVerificationEmail(to: string, displayName: string, rawToken: string): Promise<void> {
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:5173');
    const from = this.configService.get<string>('MAIL_FROM', 'PalmSight <no-reply@palmsight.local>');
    const verificationUrl = `${baseUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(rawToken)}`;

    const html = this.renderVerificationEmailTemplate({
      recipient: to,
      displayName,
      verificationUrl,
    });

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: '[PalmSight] Xác minh địa chỉ email của bạn',
        html,
      });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}: ${(error as Error).message}`);
      throw new BadGatewayException({
        code: 'EMAIL_SEND_FAILED',
        message: 'Không thể gửi email xác thực. Vui lòng kiểm tra lại dịch vụ gửi thư hoặc thử lại sau.',
      });
    }
  }

  async sendPasswordResetEmail(to: string, displayName: string, rawToken: string): Promise<void> {
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:5173');
    const from = this.configService.get<string>('MAIL_FROM', 'PalmSight <no-reply@palmsight.local>');
    const ttlMinutes = Number(this.configService.get('PASSWORD_RESET_TTL_MINUTES', 60));
    const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: '[PalmSight] Đặt lại mật khẩu',
        html: renderResetPasswordHtml({ displayName, resetUrl, ttlMinutes }),
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${(error as Error).message}`);
      throw error;
    }
  }
}
