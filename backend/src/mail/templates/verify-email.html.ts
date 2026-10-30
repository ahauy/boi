import { CREDIT_AMOUNTS } from '@palmsight/shared';
import { renderTransactionalEmailHtml } from './layout.html';

export { escapeHtml } from './layout.html';

export interface VerifyEmailTemplateParams {
  recipient: string;
  displayName: string;
  verificationUrl: string;
}

export function renderVerifyEmailHtml(params: VerifyEmailTemplateParams): string {
  return renderTransactionalEmailHtml({
    displayName: params.displayName,
    actionUrl: params.verificationUrl,
    title: 'Xác thực email PalmSight',
    heading: 'Xác thực email của bạn',
    body: `Bấm nút bên dưới để xác thực email và hoàn tất đăng ký PalmSight. Bạn sẽ nhận ${CREDIT_AMOUNTS.SIGNUP_BONUS} credits sau khi xác thực.`,
    buttonLabel: 'Xác thực email',
    expiryNotice: 'Link có hiệu lực trong 24 giờ.',
    disclaimer: 'Nếu bạn không đăng ký PalmSight, hãy bỏ qua email này.',
  });
}
