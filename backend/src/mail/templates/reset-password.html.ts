import { renderTransactionalEmailHtml } from './layout.html';

export interface ResetPasswordTemplateParams {
  displayName: string;
  resetUrl: string;
  ttlMinutes: number;
}

const formatDuration = (minutes: number) =>
  minutes % 60 === 0 ? `${minutes / 60} giờ` : `${minutes} phút`;

export function renderResetPasswordHtml(params: ResetPasswordTemplateParams): string {
  return renderTransactionalEmailHtml({
    displayName: params.displayName,
    actionUrl: params.resetUrl,
    title: 'Đặt lại mật khẩu PalmSight',
    heading: 'Đặt lại mật khẩu',
    body: 'Chúng tôi vừa nhận được yêu cầu đặt mật khẩu mới cho tài khoản PalmSight gắn với email này. Bấm nút bên dưới để chọn mật khẩu mới.',
    buttonLabel: 'Đặt mật khẩu mới',
    expiryNotice: `Link có hiệu lực trong ${formatDuration(params.ttlMinutes)} và chỉ dùng được một lần.`,
    disclaimer: 'Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu hiện tại của bạn không thay đổi.',
  });
}
