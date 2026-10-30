import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';

describe('MailService (TC-007)', () => {
  let mailService: MailService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          SMTP_SECURE: false,
          SMTP_USER: '',
          SMTP_PASS: '',
          MAIL_FROM: 'PalmSight <no-reply@palmsight.local>',
          PUBLIC_BASE_URL: 'https://palmsight.app',
        };
        return config[key] ?? defaultValue;
      }),
      getOrThrow: vi.fn((key: string) => {
        if (key === 'PUBLIC_BASE_URL') return 'https://palmsight.app';
        return '';
      }),
    } as unknown as ConfigService;

    mailService = new MailService(configService);
  });

  describe('TC-007: renderVerificationEmailTemplate', () => {
    it('should render transactional email HTML template matching Stitch Screen 2e38ad0c7e83457d89a391c8a8466a86', () => {
      const recipient = 'vana@example.com';
      const displayName = 'Nguyễn Văn A';
      const verificationUrl = 'https://palmsight.app/verify-email?token=TEST_TOKEN';

      const html = mailService.renderVerificationEmailTemplate({
        recipient,
        displayName,
        verificationUrl,
      });

      // Greeting
      expect(html).toContain('Chào Nguyễn Văn A,');
      // Direct verification link button
      expect(html).toContain(`href="${verificationUrl}"`);
      // Expiration notice 24h
      expect(html).toContain('24 giờ');
      // Security disclaimer
      expect(html).toContain('Nếu bạn không đăng ký PalmSight, hãy bỏ qua email này.');
      // ASCII PalmSight banner or wordmark
      expect(html).toContain('PalmSight');
      // Plain text fallback URL in code block
      expect(html).toContain(verificationUrl);
    });

    it('should HTML escape displayName to prevent XSS injection in email template', () => {
      const recipient = 'xss@example.com';
      const displayName = '<script>alert("XSS")</script>&"evil"\'';
      const verificationUrl = 'https://palmsight.app/verify-email?token=TEST_TOKEN';

      const html = mailService.renderVerificationEmailTemplate({
        recipient,
        displayName,
        verificationUrl,
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;&quot;evil&quot;&#39;');
    });
  });

  describe('sendVerificationEmail', () => {
    it('should construct correct subject and send mail via transporter', async () => {
      const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-123' });
      // Inject fake transporter
      (mailService as unknown as { transporter: { sendMail: typeof sendMailMock } }).transporter = {
        sendMail: sendMailMock,
      };

      await mailService.sendVerificationEmail('vana@example.com', 'Nguyễn Văn A', 'TEST_RAW_TOKEN');

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('vana@example.com');
      expect(callArgs.subject).toBe('[PalmSight] Xác minh địa chỉ email của bạn');
      expect(callArgs.html).toContain('Chào Nguyễn Văn A,');
      expect(callArgs.html).toContain('https://palmsight.app/verify-email?token=TEST_RAW_TOKEN');
    });

    it('should throw BadGatewayException with code EMAIL_SEND_FAILED when transporter fails', async () => {
      const sendMailMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
      (mailService as unknown as { transporter: { sendMail: typeof sendMailMock } }).transporter = {
        sendMail: sendMailMock,
      };

      await expect(
        mailService.sendVerificationEmail('vana@example.com', 'Nguyễn Văn A', 'TEST_RAW_TOKEN'),
      ).rejects.toMatchObject({
        response: {
          code: 'EMAIL_SEND_FAILED',
        },
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends the reset link with the 1-hour notice and an escaped display name', async () => {
      const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-456' });
      (mailService as unknown as { transporter: { sendMail: typeof sendMailMock } }).transporter = {
        sendMail: sendMailMock,
      };

      await mailService.sendPasswordResetEmail('vana@example.com', '<b>Văn A</b>', 'RESET/TOKEN+1');

      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('vana@example.com');
      expect(callArgs.subject).toBe('[PalmSight] Đặt lại mật khẩu');
      expect(callArgs.html).toContain('href="https://palmsight.app/reset-password?token=RESET%2FTOKEN%2B1"');
      expect(callArgs.html).toContain('Chào &lt;b&gt;Văn A&lt;/b&gt;,');
      expect(callArgs.html).toContain('1 giờ và chỉ dùng được một lần');
      expect(callArgs.html).toContain('Nếu bạn không yêu cầu, hãy bỏ qua email này.');
    });

    it('rethrows when the transporter fails so the caller can log it', async () => {
      const sendMailMock = vi.fn().mockRejectedValue(new Error('Connection refused'));
      (mailService as unknown as { transporter: { sendMail: typeof sendMailMock } }).transporter = {
        sendMail: sendMailMock,
      };

      await expect(
        mailService.sendPasswordResetEmail('vana@example.com', 'Văn A', 'TOKEN'),
      ).rejects.toThrow('Connection refused');
    });
  });
});
