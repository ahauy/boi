# deployment — Triển khai

Giới hạn của các gói miễn phí thay đổi theo thời gian; kiểm tra trang giá của từng dịch vụ trước khi ra mắt. Nhóm việc chưa làm (Render, Play Console, tách database dev…) nằm trong [CONSISTENCY_PLAN.md](CONSISTENCY_PLAN.md).

## Hạ tầng

| Thành phần | Dịch vụ | Ghi chú |
| --- | --- | --- |
| App Android | Google Play, build bằng EAS (`mobile-2/eas.json`) | `EXPO_PUBLIC_*` được nhúng lúc build: đổi URL API hoặc URL trang chính sách thì phải build lại |
| API (NestJS) | Render Web Service `boi-qvgy` (`render.yaml`, region Singapore) | Gói free tự ngủ sau khoảng 15 phút không có request; lần gọi đầu có thể mất 30 đến 60 giây. App hiển thị trạng thái "đang đánh thức máy chủ" thay vì đăng xuất |
| Database | MongoDB Atlas | Cần replica set (transaction). `backend/.env` đang dùng chung database thật; tách database dev trước khi ra mắt |
| Ảnh | Cloudinary | Chỉ lưu ảnh của lần xem thành công và ảnh đại diện |
| AI | Gemini (chính), Groq (dự phòng) | Giới hạn theo gói API |
| Trang chính sách | Vercel, project mới với Root Directory `legal/`, Framework Preset Other | Hiện chạy ở `https://boi-two-delta.vercel.app`; `legal/vercel.json` bật `cleanUrls` và rewrite `/r/:code` sang `/referral`. Không phục vụ API |
| Xác minh VIP | Google Play Developer API (service account) và Pub/Sub RTDN | Webhook `POST /api/v1/billing/rtdn?token=<RTDN_PUSH_TOKEN>` |

Không còn Vercel cho web app, Gmail SMTP hay Mailpit. Site `palm-sight-theta.vercel.app`, service `palmsight-backend` và `vercel.json`, `frontend/` ở thư mục gốc là di tích của bản web; chủ app tự tắt/xoá. Chạy `vercel.json` gốc sẽ trỏ `/api/v1` về `palmsight-backend`, không còn đúng.

## Biến môi trường backend

Danh sách đầy đủ và chú thích: `backend/.env.example`; khai báo cho Render: `render.yaml` (`sync: false` là secret, đặt trong dashboard). Nhóm chính:

| Nhóm | Biến |
| --- | --- |
| Chung | `NODE_ENV`, `API_PORT`/`PORT`, `PUBLIC_BASE_URL` (URL của `legal/`), `CLIENT_IP_HEADER` |
| Dữ liệu | `MONGODB_URI` |
| Bí mật | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `IDENTITY_HASH_SECRET` (bắt buộc ở production; đổi sẽ làm mất khả năng khớp mã băm cũ) |
| AI | `AI_PROVIDER`, `AI_MODEL`, `GEMINI_API_KEY`, `AI_FALLBACK_PROVIDER`, `AI_FALLBACK_MODEL`, `AI_BASE_URL`, `GROQ_API_KEY`, `AI_TIMEOUT_MS`, `AI_MAX_TOKENS`, `AI_TEMPERATURE` |
| Ảnh | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `CLOUDINARY_AVATAR_FOLDER` |
| Kinh tế | `STARTER_GRANT`, `PRICE_PER_ACTION`, `REFERRAL_DAILY_CAP`, `REFERRAL_NETWORK_DAILY_CAP`, `REWARDED_ADS_ENABLED`, `MIN_AD_WATCH_SECONDS`, … (mặc định nằm trong `shared`) |
| VIP | `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `RTDN_PUSH_TOKEN`, `SUB_WEEKLY_ID`, `SUB_MONTHLY_ID`, `SUB_YEARLY_ID`, `ENFORCE_VIP_SCHOOLS` |

## Quy trình deploy (thứ tự)

1. Đổi mật khẩu MongoDB và Cloudinary secret, cập nhật `.env` và Render.
2. Xác nhận `boi-qvgy` deploy từ repo và nhánh nào; đặt `CLOUDINARY_*`.
3. Deploy backend, quét thử, kiểm ảnh lên Cloudinary.
4. Deploy `legal/`, kiểm các URL `/privacy`, `/terms`, `/data-deletion`. Chỉ đăng sau khi chính sách và điều khoản đã được duyệt và hết `[ĐIỀN]`, `[XÁC NHẬN]`.
5. Dọn dữ liệu cũ của bản web (ảnh base64, `guest_trials`…): đếm lại, chủ app xác nhận rồi mới chạy; không hoàn tác được.
6. Tắt `palmsight-backend` và site Vercel cũ.
7. Build lại app (EAS), kiểm merged manifest (quyền) và Data Safety trên Play Console.

## Vận hành

| Việc | Cách làm |
| --- | --- |
| Backup MongoDB | Atlas M0 không có backup tự động; chạy `mongodump` tay hoặc theo lịch |
| Dọn lần xem kẹt `PROCESSING` | Tự chạy khi người dùng mở lịch sử hoặc lần xem |
| Đối soát GEM | `pnpm --filter backend credits:reconcile` |
| Kiểm tra dữ liệu | `pnpm --filter backend db:check` (chỉ đọc; kiểm kết nối, chỉ mục, sổ GEM, bản ghi mồ côi) |
| Xoá tài khoản thủ công | `pnpm --filter backend users:delete --user <id> --note "<ghi chú>"` |
| Hạn mức AI/Cloudinary | Xem dashboard nhà cung cấp và tỉ lệ `AI_UNAVAILABLE` |

Health check: `GET /api/v1/health` (kiểm tra MongoDB, không gọi AI).

### Không sửa dữ liệu trực tiếp trên database

Không xoá hay sửa tay (Compass, Atlas Data Explorer, mongosh) các collection `users`, `credit_transactions`, `referrals`, `readings`, `deleted_identities`, `devices`. MongoDB không có khoá ngoại, nên sửa tay sẽ để lại bản ghi mồ côi, ảnh mồ côi trên Cloudinary, làm sổ GEM lệch số dư, và bỏ qua bước ghi `deleted_identities` và dấu thiết bị chống farm. Mọi thay đổi đi qua API hoặc script có sẵn; cần thao tác mới thì viết script (đi qua `CreditLedgerService` nếu đụng GEM) và ghi vào PR.

### Phân quyền MongoDB

Dùng hai user: một `readWrite` cho API trên Render, một `read` để xem dữ liệu hằng ngày. Chuỗi kết nối của user ghi chỉ nằm trong env của Render và `backend/.env` của người chạy script. Khi dev local không cần tách quyền.
