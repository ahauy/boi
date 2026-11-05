# security-privacy — Bảo mật và quyền riêng tư

Tài liệu kỹ thuật cho nhóm làm việc. Văn bản công khai nằm ở `legal/` và đang là **bản nháp** chờ chủ app và tư vấn pháp lý duyệt (còn `[ĐIỀN]`, `[XÁC NHẬN]`).

## Xác thực và phiên

- Chỉ có phiên khách theo thiết bị: `POST /auth/device` và `POST /auth/refresh`. Không mật khẩu, không OAuth, không cookie, không CORS (app native không cần).
- Access token JWT (`JWT_ACCESS_SECRET`, sống 900 giây mặc định). Refresh token ngẫu nhiên, chỉ lưu mã băm trong `sessions`, sống 30 ngày, xoay vòng mỗi lần dùng; dùng lại token đã xoay bị từ chối. Phiên có TTL tự xoá.
- Phía app, token nằm trong SecureStore; định danh thiết bị là Android ID (hoặc UUID) cũng trong SecureStore.
- `JwtAuthGuard` kiểm tài khoản chưa bị xoá (`deletedAt: null`), nên token còn hạn của tài khoản đã xoá bị từ chối.
- Giới hạn tần suất: `/auth/refresh` 10 lần mỗi phút mỗi IP (bộ nhớ tiến trình); theo tài khoản cho `POST /readings` (5/phút), sửa hồ sơ (10/phút), ảnh đại diện (5/phút), nhập mã giới thiệu và xoá tài khoản (5/giờ). Tạo tài khoản mới giới hạn theo IP băm (`ANONYMOUS_SIGNUP_DAILY_CAP`).
- `helmet` bật; `IDENTITY_HASH_SECRET` bắt buộc khi `NODE_ENV=production` (thiếu thì backend không khởi động).

## Dữ liệu định danh được băm

- Định danh thiết bị và IP chỉ lưu dạng HMAC-SHA256 với `IDENTITY_HASH_SECRET` (tiền tố `device:` và `ip:`). Mã băm không đảo ngược được nếu không có secret, nhưng cùng một thiết bị luôn ra cùng một mã, nên đây là dữ liệu giả danh chứ không phải ẩn danh.
- Server không lưu GAID/ADID. SDK quảng cáo và Adjust trên máy vẫn có thể đọc và gửi chúng khi được phép.
- Mã tài khoản PalmSight không được gửi cho SDK quảng cáo. Google Play nhận `billingRef` (HMAC làm mờ) làm `obfuscatedAccountId`.

## Ảnh

- Ảnh được xử lý trong bộ nhớ (`multer memoryStorage` + `sharp`): đổi HEIC sang JPEG, xoay theo EXIF, xoá toàn bộ EXIF kể cả GPS, thu nhỏ cạnh dài 1280 px, JPEG chất lượng 85. Không ghi ra đĩa máy chủ.
- Ảnh gửi cho Gemini hoặc Groq ở dạng base64. [XÁC NHẬN: điều khoản huấn luyện mô hình theo gói API đang dùng.]
- Chỉ ảnh của lần xem thành công (AI xác nhận là lòng bàn tay) được tải lên Cloudinary. Ảnh bị từ chối hoặc lỗi không được lưu. Ảnh trên Cloudinary hiện là URL công khai khó đoán; chưa chuyển sang chế độ truy cập có chữ ký (cần chủ app quyết).
- Ở production, nếu Cloudinary lỗi, lần xem vẫn hoàn tất nhưng không có ảnh. Ở dev, ảnh rơi về base64 trong DB.
- Xoá lần xem hoặc tài khoản: xoá ảnh trên Cloudinary trước, lỗi thì dừng và báo để thử lại. Một lần xem còn đang `PROCESSING` khi tài khoản bị xoá sẽ không ghi kết quả hay ảnh vào bản ghi đã xoá, và ảnh vừa tải lên bị dọn.

## Xoá tài khoản và dữ liệu giữ lại

Người dùng tự xoá bằng nút trong app (`DELETE /me`); script `pnpm --filter backend users:delete` dùng chung hàm cho xử lý thủ công. Bảng chi tiết xoá và giữ từng trường: [database-erd.md](database-erd.md#khi-xoá-tài-khoản-deleteuseraccount). Điểm cần nhớ:

- Giữ để chống farm quà: mã băm thiết bị, dấu thiết bị, lượt giới thiệu, danh sách định danh đã xoá.
- Giữ để đối soát: sổ GEM (đã bỏ ghi chú), giao dịch VIP (đã bỏ GAID/ADID/phản hồi thô), khung metadata lần xem.
- Chưa có cơ chế tự xoá cho các mục giữ. Thời hạn đề xuất: giao dịch VIP 10 năm, mã băm 5 năm; chủ app chưa chốt.
- Xoá tài khoản không huỷ gói Play và không chặn khôi phục VIP lên tài khoản mới.

## Đồng ý, tuổi và đo lường

- Người dùng tích đồng ý gửi ảnh cho AI và lưu trên Cloudinary trước mỗi lần quét (`aiConsent=true` bắt buộc).
- Dịch vụ dành cho người từ 16 tuổi; bước chọn nhóm tuổi là xác nhận, không có màn riêng.
- Adjust, Firebase Analytics và Crashlytics chỉ bật khi vùng đồng ý là `OTHER`; GDPR hoặc chưa rõ thì tắt (`mobile-2/src/ads/revenue.ts`). Ở các vùng đó Adjust không được khởi tạo (không gửi cả dữ liệu cài đặt cơ bản); nếu chờ đồng ý quá 30 giây (vùng UNKNOWN) thì phiên đó không có Adjust. Cờ native mặc định tắt trong `mobile-2/firebase.json`. Hạn chế đã biết: người dùng EEA đã đồng ý trong biểu mẫu vẫn bị tắt đo lường vì app chỉ biết vùng, không đọc kết quả đồng ý.
- Quyền Android: `CAMERA`; chọn ảnh từ thư viện dùng expo-image-picker, trên Android 12 trở xuống có thể xin `READ_EXTERNAL_STORAGE`, Android 13 trở lên dùng bộ chọn ảnh hệ thống. `RECORD_AUDIO`, `USE_BIOMETRIC`, `USE_FINGERPRINT` bị chặn; `SYSTEM_ALERT_WINDOW` bị chặn ở bản preview/production (`mobile-2/plugins/blocked-permissions.js`). Cần kiểm merged manifest của bản build thật.

## Bí mật

- Không commit `backend/.env`; secret của production nằm trong Render. `backend/.env` hiện trỏ vào database thật nên cần tách DB dev trước khi ra mắt.
- Test backend không đọc `.env` (`ignoreEnvFile: true` trong `backend/test/test-helper.ts`).
- Nên đổi mật khẩu MongoDB và Cloudinary secret trước khi ra mắt (xem `CONSISTENCY_PLAN.md`).
