# Chính sách bảo mật

Đây là dự án nhỏ, làm cho vui, do 2 người duy trì. Chúng tôi vẫn rất cảm ơn mọi báo cáo bảo mật.

## Báo cáo lỗ hổng

**Không mở issue công khai** cho lỗ hổng bảo mật. Hãy gửi báo cáo riêng qua tính năng [Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) của GitHub (tab **Security → Report a vulnerability** của repo).

Báo cáo nên có:

- Mô tả lỗ hổng và ảnh hưởng (ví dụ: tự cộng GEM, xem ảnh của người khác).
- Các bước tái hiện.
- Commit bị ảnh hưởng.

Chúng tôi sẽ phản hồi sớm nhất có thể; không cam kết thời hạn cụ thể.

## Phạm vi quan tâm

- Cộng GEM trái phép: xem nhiều lần bằng một lần trừ GEM, bỏ qua bước trừ GEM, được hoàn GEM nhiều lần, nhận lại quà thiết bị hoặc quà VIP hằng ngày bằng nhiều tài khoản.
- Truy cập ảnh hoặc kết quả bói của người dùng khác.
- Chiếm hoặc giả mạo phiên của một thiết bị khác (token, `POST /auth/device`, `POST /auth/refresh`).
- Lộ API key, secret hoặc dữ liệu cá nhân.
- Chữ chèn trong ảnh khiến AI trả nội dung độc hại (prompt injection).

## Với người đóng góp

- Repo công khai: không commit `.env`, key, token. Nếu lỡ commit, **thu hồi key ngay**, sau đó mới xoá khỏi lịch sử git.
- Bật Secret scanning, Push protection và Dependabot trong Settings của repo.
- Chi tiết thiết kế bảo mật: [docs/security-privacy.md](docs/security-privacy.md).
