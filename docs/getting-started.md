# Getting started — Chạy dự án ở máy local

## 1. Công cụ

| Công cụ | Phiên bản | Ghi chú |
| --- | --- | --- |
| Node.js | 22 LTS | |
| pnpm | 9 | `corepack enable && corepack prepare pnpm@9 --activate` |
| Docker Desktop | mới nhất | Chạy MongoDB |
| Android Studio / emulator hoặc máy Android | tuỳ chọn | Chạy app |
| MongoDB Compass | tuỳ chọn | Xem dữ liệu |

## 2. Cài dependency và cấu hình

```bash
git clone <repo-url> palmsight && cd palmsight
pnpm install
cp backend/.env.example backend/.env
```

`backend/.env` đọc bởi NestJS, chứa MongoDB, JWT, AI, Cloudinary, Google Play. Production đặt cùng các biến trong Render (xem [deployment.md](deployment.md)); `backend/.env.example` là danh sách đầy đủ. Tạo secret bằng `pnpm --filter backend generate:secrets`. App đọc `mobile-2/.env` (`EXPO_PUBLIC_*`, được nhúng vào bản build nên không đặt secret). **Không commit file `.env`.**

> `backend/.env` có thể đang trỏ vào database thật. Dùng một database dev riêng (đổi tên database trong `MONGODB_URI`) trước khi chạy thử các thao tác ghi.

## 3. MongoDB

```bash
docker compose up -d
```

MongoDB 7 chạy dạng replica set một node (`rs0`) ở `localhost:27019`; transaction cần replica set. Chuỗi kết nối:

```bash
MONGODB_URI=mongodb://localhost:27019/palmsight?directConnection=true
```

Chỉ dùng `directConnection=true`, không thêm `replicaSet=rs0`. Tạo chỉ mục:

```bash
pnpm --filter backend db:sync-indexes
```

## 4. Dịch vụ ngoài (cho phần cần chạy thật)

- **Gemini và Groq**: đặt `GEMINI_API_KEY`, `GROQ_API_KEY` (gói miễn phí đủ để thử). Thiếu thì xem bói trả `AI_UNAVAILABLE`.
- **Cloudinary** (tuỳ chọn khi dev): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Thiếu hoặc lỗi thì ở dev ảnh rơi về base64 trong DB; ở production lần xem hoàn tất nhưng không có ảnh.
- **Google Play** (chỉ khi thử VIP thật): `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `RTDN_PUSH_TOKEN`. Thiếu thì `/billing/verify` trả `billing_unavailable`.

## 5. Chạy

```bash
pnpm --filter backend dev      # API ở http://localhost:4000/api/v1
pnpm start:mobile2             # Metro ở :8081, tự mở adb reverse cho cổng 4000 và 8081
```

Android emulator phải dùng `adb reverse` (không dùng `10.0.2.2`). Chi tiết app, quảng cáo thưởng và dev build: [../mobile-2/README.md](../mobile-2/README.md).

## 6. Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` | Kiểm tra toàn workspace (test backend dùng MongoDB trong bộ nhớ) |
| `pnpm --filter backend credits:reconcile` | Kiểm tra sổ GEM khớp số dư |
| `pnpm --filter backend db:check` | Kiểm tra dữ liệu mồ côi và tài khoản xoá chưa sạch (chỉ đọc) |
| `pnpm --filter backend users:delete --user <id> --note "<ghi chú>"` | Xoá tài khoản thủ công (cùng hàm với `DELETE /me`) |
| `docker compose down -v` | Xoá sạch dữ liệu MongoDB local |

Đừng sửa tay `users` hay `credit_transactions` trong Compass để "test nhanh": sửa tay làm lệch sổ GEM và `credits:reconcile` sẽ báo lỗi.

## Lỗi hay gặp

| Triệu chứng | Cách xử lý |
| --- | --- |
| `Transaction numbers are only allowed on a replica set member or mongos` | MongoDB chạy standalone: dùng `docker compose up -d` hoặc khởi động với `--replSet rs0` rồi `rs.initiate()` |
| `directConnection is not supported with replicaSet` | Bỏ `replicaSet=rs0` khỏi `MONGODB_URI` |
| Backend treo sau `ConfigModule dependencies initialized` | Không kết nối được MongoDB: kiểm tra container và cổng 27019 |
| `Cannot find module '@palmsight/shared'` | Chưa build `shared`: `pnpm --filter @palmsight/shared build` |
| App báo `NETWORK_ERROR` trên emulator | Chạy `node mobile-2/scripts/adb-reverse.js` sau khi emulator khởi động lại |
| `AI_UNAVAILABLE` liên tục | Kiểm tra `GEMINI_API_KEY`, `GROQ_API_KEY`, tên model, hạn mức |
