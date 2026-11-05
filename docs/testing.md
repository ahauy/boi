# testing — Kiểm thử

Ưu tiên test nơi sai sót làm lệch GEM hoặc rò dữ liệu: sổ cái, xem bói, xoá tài khoản, VIP, mã giới thiệu.

## Chạy

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test                       # shared + backend + mobile-2
pnpm install --frozen-lockfile --lockfile-only   # kiểm lockfile
```

## Các tầng

| Tầng | Công cụ | Phạm vi |
| --- | --- | --- |
| shared | Vitest | Schema Yup, enum, hằng số kinh tế |
| backend | Vitest + `mongodb-memory-server` (`MongoMemoryReplSet`) + HTTP thật tới app Nest | Service và endpoint với MongoDB trong bộ nhớ; AI, Cloudinary và Google Play được giả lập. Phải dùng replica set vì transaction |
| mobile-2 | Vitest | Logic thuần: chính sách quảng cáo, đồng ý và đo lường (`revenue-consent.spec.ts`), quyền Android (`blocked-permissions.spec.ts`), chuỗi i18n đủ 9 ngôn ngữ (`screen-strings.spec.ts`), billing, xoá tài khoản |

Test backend không đọc `backend/.env` (`ignoreEnvFile: true` trong `backend/test/test-helper.ts`) nên không gọi Cloudinary hay Atlas thật. Không có E2E trình duyệt; app chưa có test trên thiết bị tự động.

## Nhóm ca quan trọng (đã có test)

- **GEM và xem bói** (`wallet`, `economy-*`, `readings*`, `scan-upload`): trừ và hoàn đúng một lần, idempotency, song song, sổ cái khớp số dư.
- **Phiên thiết bị** (`auth-device`, `auth-refresh`, `device-reinstall`): tạo tài khoản theo thiết bị, giới hạn theo IP, xoay refresh token.
- **Xoá tài khoản** (`account-delete`, `account-erasure`, `users-delete`, `cloudinary`): trường nào bị xoá/giữ theo từng collection; ảnh lỗi thì không đụng DB; chống farm còn nguyên sau xoá; lần xem `PROCESSING`, `REJECTED`, `FAILED` lúc xoá không ghi vào bản ghi đã xoá; `deleteReading` đặt `topics = []`.
- **VIP** (`economy-billing`, `billing-verifier-*`, phần khôi phục trong `account-erasure`): xác minh, RTDN, khôi phục sang tài khoản mới, quà hằng ngày chỉ một lần mỗi thiết bị mỗi ngày.
- **Giới thiệu** (`referrals`): các mã lỗi `REFERRAL_*`, giới hạn mạng và vòng.
- **AI** (`ai-*`, `sanitize-palm-result`): prompt đủ khoá mục theo trường phái, fallback, sanitize kết quả.
- **Dữ liệu** (`db-check`, `test-helper`): kiểm tra mồ côi, helper tạo khách.

## Kiểm tra thủ công cần làm trước khi ra mắt

- Build EAS preview/production, đọc merged manifest (`CAMERA`, `AD_ID`; không `RECORD_AUDIO`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `SYSTEM_ALERT_WINDOW`).
- Kiểm `firebase_analytics_collection_enabled` và Crashlytics tắt trước khi người dùng ở vùng GDPR/chưa rõ chạm app.
- Quét thật với Cloudinary cấu hình đúng; xoá lần xem và xoá tài khoản thật; thử khôi phục VIP bằng tài khoản thử nghiệm Play.
- Đọc lại `legal/` trên điện thoại (trình duyệt trong app).
