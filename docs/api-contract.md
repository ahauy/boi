# api-contract — REST API

Đối chiếu với các controller trong `backend/src/**/*.controller.ts`. DTO dùng chung nằm trong `shared/src/types/`.

## Quy ước

- Base URL: `<host>/api/v1`. JSON, trừ upload ảnh (multipart).
- Xác thực: `Authorization: Bearer <accessToken>` cho mọi route trừ `/auth/*`, `/config`, `/health`, `/billing/rtdn`. Access token sống `JWT_ACCESS_TTL_SECONDS` (mặc định 900 giây); refresh token sống `REFRESH_TOKEN_TTL_DAYS` (30 ngày) và xoay vòng mỗi lần refresh.
- Lỗi: `{ "error": { "code": "...", "message": "...", "details": { ... } } }`.
- Phân trang theo con trỏ: `?cursor=<id>&limit=<n>` → `{ items, nextCursor }`.
- Header tuỳ chọn `x-device-id` trên các route `/currency/*`.

## Auth (không cần token)

| Route | Mô tả |
| --- | --- |
| `POST /auth/device` | Body `{ deviceId }` (16 đến 128 ký tự `A-Za-z0-9_-`). Tạo hoặc tìm tài khoản của thiết bị, trả `{ user, accessToken, refreshToken }`. Tài khoản mới nhận quà khởi đầu nếu đủ điều kiện. Lỗi `DEVICE_SESSION_LIMIT_REACHED` khi vượt giới hạn tạo tài khoản theo IP |
| `POST /auth/refresh` | Header `x-refresh-token`. Trả access token và refresh token mới. Giới hạn 10 lần mỗi phút mỗi IP (`RATE_LIMITED`). Token sai hoặc hết hạn trả `UNAUTHENTICATED` |

## Hồ sơ `/me`

| Route | Mô tả |
| --- | --- |
| `GET /me` | Hồ sơ, số dư, VIP, mã giới thiệu. Nếu đang VIP và chưa nhận hôm nay (và thiết bị chưa nhận cho tài khoản khác) thì cộng quà VIP hằng ngày và trả `vipDailyGranted` |
| `PATCH /me` | Sửa `displayName` (10 lần mỗi phút) |
| `POST /me/avatar` · `DELETE /me/avatar` | Tải hoặc gỡ ảnh đại diện (multipart, 5 lần mỗi phút; `AVATAR_TOO_LARGE`) |
| `DELETE /me` | Xoá tài khoản, trả 204 (5 lần mỗi giờ). Trả lỗi và giữ nguyên DB nếu không xoá được ảnh trên Cloudinary. Sau khi xoá, token cũ không còn dùng được |
| `GET /me/credit-transactions` | Lịch sử GEM, phân trang |
| `GET /me/referrals` | Danh sách lượt giới thiệu, phân trang |
| `POST /me/referral` | Body `{ code }`, nhập mã giới thiệu (5 lần mỗi giờ). Lỗi `REFERRAL_*` (xem business-rules) |

## Xem bói `/readings`

| Route | Mô tả |
| --- | --- |
| `POST /readings` | Multipart: `image` (bắt buộc, tối đa 8 MB), `annotatedImage` (tuỳ chọn, app hiện tại không gửi), `school`, `hand`, `topics` (danh sách khoá cách nhau bằng dấu phẩy, bỏ trống = tất cả), `aiConsent=true`. Header `Idempotency-Key` UUID v4 bắt buộc. Giới hạn 5 yêu cầu mỗi phút. Trả `{ reading, creditBalance }`, header `Idempotent-Replayed: true` khi phát lại |
| `GET /readings` | Lịch sử, phân trang |
| `GET /readings/:id` | Chi tiết một lần xem (404 nếu đã xoá) |
| `DELETE /readings/:id` | Xoá một lần xem, 204. `IMAGE_DELETE_FAILED` (502) nếu không xoá được ảnh; `READING_IN_PROGRESS` nếu đang xử lý |

Mã lỗi thường gặp: `IDEMPOTENCY_KEY_REQUIRED`, `VALIDATION_ERROR`, `INSUFFICIENT_CREDITS` (402), `vip_required` (trường phái dành cho VIP), `UNSUPPORTED_IMAGE_TYPE`, `IMAGE_TOO_LARGE`, `READING_IN_PROGRESS`, `AI_UNAVAILABLE` (503, đã hoàn GEM), `NOT_FOUND`.

## Kinh tế `/currency`

| Route | Mô tả |
| --- | --- |
| `GET /currency/earn` | Trạng thái điểm danh, vòng quay, quảng cáo có thưởng của hôm nay |
| `POST /currency/checkin` · `POST /currency/checkin/restore` | Điểm danh; khôi phục chuỗi (`streak_not_restorable`) |
| `POST /currency/spin` · `POST /currency/paid-spin` | Quay miễn phí hoặc bằng quảng cáo; quay trả phí (`free_spin_used`, `gems_insufficient`) |
| `POST /currency/ad-rewards` | Mở vé thưởng quảng cáo (`kind`: checkin, spin, bonus). Lỗi `ad_limit_reached`, `ads_unavailable` |
| `POST /currency/ad-rewards/:id/claim` | Nhận thưởng sau khi xem đủ thời gian (`ad_not_finished`, `ticket_not_found`, `ticket_released`) |
| `DELETE /currency/ad-rewards/:id` | Nhả vé khi quảng cáo không chạy được |

Quy tắc một-thiết-bị-một-lần cho điểm danh, vòng quay miễn phí trả `device_used`.

## Thanh toán `/billing`

| Route | Mô tả |
| --- | --- |
| `POST /billing/verify` | Bearer. Body `{ productId, purchaseToken, packageName?, orderId?, priceAmountMicros?, priceCurrencyCode?, isTrial?, obfuscatedAccountId? }`. Xác minh với Google Play, cập nhật VIP, trả `{ vip, firstPurchase, restored, balance, grantedNow, vipDailyGranted?, billingRef }`. Lỗi `invalid_product`, `invalid_purchase`, `billing_unavailable` (503) |
| `POST /billing/rtdn?token=<RTDN_PUSH_TOKEN>` | Webhook Pub/Sub của Google Play, không dùng Bearer. Sai token trả `invalid_rtdn_token`; thiếu cấu hình trả `rtdn_not_configured` |

## Khác

| Route | Mô tả |
| --- | --- |
| `GET /config` | Công khai. Giá, quà, thang điểm danh, giải vòng quay, mã gói VIP, `legalUrls` (`privacyUrl`, `termsUrl`) |
| `GET /health` | Kiểm tra sống cho Render |

## Đã bỏ cùng bản web

Không còn các route `register`, `login`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `logout`, `google`, `facebook`, `/readings/guest`, `/me/password`, `/ads/rewarded/*`. Vé thưởng quảng cáo nay nằm ở `/currency/ad-rewards`.
