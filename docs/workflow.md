# workflow — Luồng chính của app

## Mở app lần đầu

1. App đọc hoặc tạo định danh thiết bị (Android ID, hoặc UUID) và lưu trong SecureStore.
2. Onboarding: chọn ngôn ngữ, giới tính, nhóm tuổi, sở thích. Các câu trả lời chỉ lưu trên máy; bước chọn nhóm tuổi là xác nhận từ 16 tuổi.
3. `POST /auth/device` → phiên khách (access + refresh token), hồ sơ và số dư. Thiết bị mới nhận 5 GEM khởi đầu nếu đủ điều kiện; thiết bị từng xoá tài khoản nhận 0 GEM.
4. Khi access token hết hạn, app gọi `POST /auth/refresh` rồi thử lại đúng một lần; refresh thất bại thì tạo lại phiên bằng `POST /auth/device`.

## Xem bói

```text
Quét → chọn trường phái, tay, mục → chụp hoặc chọn ảnh → tích đồng ý (gửi AI và lưu Cloudinary)
  → POST /readings (Idempotency-Key) → trừ 5 GEM
  → tiền xử lý ảnh (xoá EXIF, thu nhỏ) → Gemini → (lỗi/hết quota) Groq
       ├─ không phải lòng bàn tay → REJECTED, hoàn GEM, không lưu ảnh
       ├─ AI lỗi sau khi thử dự phòng → FAILED, hoàn GEM, 503 AI_UNAVAILABLE
       └─ thành công → tải ảnh lên Cloudinary → DONE → trả kết quả
```

- Lần xem `PROCESSING` quá lâu được dọn và hoàn GEM đúng một lần.
- Nếu tài khoản bị xoá giữa chừng, lần xem không ghi kết quả hay ảnh vào bản ghi đã xoá.
- Lịch sử: `GET /readings`. Xoá một lần xem: `DELETE /readings/:id` (xoá ảnh trước; lỗi ảnh thì giữ lại để thử lại).

## Kiếm GEM

Điểm danh, vòng quay, quảng cáo có thưởng và mã giới thiệu nằm ở tab Tiền tệ. Quảng cáo có thưởng đi qua vé: `POST /currency/ad-rewards` mở vé, app chiếu quảng cáo MAX, `POST /currency/ad-rewards/:id/claim` nhận thưởng; quảng cáo không chạy được thì `DELETE` nhả vé. Số liệu: [business-rules.md](business-rules.md).

## Mua VIP

1. App lấy giá và gói từ Google Play qua react-native-iap.
2. Sau khi mua hoặc khôi phục, app gửi `POST /billing/verify`; backend xác minh với Google Play, cập nhật VIP, cộng quà VIP hằng ngày nếu đủ điều kiện.
3. Google Play gửi thông báo gia hạn, huỷ, hết hạn tới `POST /billing/rtdn`.
4. Huỷ gói: người dùng làm trong Google Play (app có lối tắt tới trang quản lý gói).

## Quảng cáo và đồng ý

- MAX xác định vùng người dùng. `GDPR` hiện biểu mẫu đồng ý trước khi khởi động quảng cáo và mục "Quyền riêng tư quảng cáo" trong Hồ sơ; `OTHER` bật thêm đo lường (Adjust, Firebase Analytics, Crashlytics); `UNKNOWN` tắt đo lường.

## Xoá tài khoản

1. Hồ sơ &gt; Xoá tài khoản, xác nhận hai bước.
2. App gọi `DELETE /me`. Backend xoá ảnh trên Cloudinary; nếu lỗi thì báo và không đổi gì.
3. Thành công: dữ liệu bị xoá hoặc ẩn trong một transaction ([database-erd.md](database-erd.md)), phiên bị thu hồi, app xoá token cục bộ, về màn đầu và mở phiên khách mới cho cùng thiết bị: tài khoản mới có 0 GEM, không quà khởi đầu, không nhập được mã giới thiệu.
4. Người dùng cần tự huỷ gói VIP trong Google Play; trang `legal/data-deletion` nhắc việc này.
