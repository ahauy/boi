# Getting started — Chạy dự án ở máy local

## 1. Cài đặt công cụ

| Công cụ | Phiên bản | Ghi chú |
| --- | --- | --- |
| Node.js | 22 LTS | |
| pnpm | 9 | `corepack enable && corepack prepare pnpm@9 --activate` |
| Docker Desktop | mới nhất | Chạy MongoDB và Mailpit |
| ngrok | mới nhất | Tài khoản free + 1 static domain miễn phí |
| MongoDB Compass | tuỳ chọn | Xem dữ liệu bằng giao diện |

## 2. Clone và cài dependency

```bash
git clone <repo-url> palmsight
cd palmsight
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Mỗi phía có file env riêng, khớp với lúc deploy: backend tương ứng Environment của Render, frontend tương ứng Environment của Vercel.

| File | Ai đọc | Chứa |
| --- | --- | --- |
| `backend/.env` | NestJS (`@nestjs/config` đọc `.env` ở thư mục đang chạy) | MongoDB, JWT, OAuth secret, SMTP, AI, Cloudinary, hằng số credits |
| `frontend/.env` | Vite | `VITE_*` (bị nhúng vào bundle, **không** đặt secret), `API_PROXY_TARGET`, `DEV_ALLOWED_HOSTS` |

Google client ID và Facebook app ID có mặt ở cả hai file (`GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`…), với cùng giá trị. Đây là giá trị công khai nên lặp lại không sao.

## 3. Khởi động dịch vụ nền

```bash
docker compose up -d
```

| Dịch vụ | Địa chỉ | Ghi chú |
| --- | --- | --- |
| MongoDB 7 | `localhost:27019` | Chạy dạng replica set 1 node (`rs0`), cần cho transaction; container tự chạy `rs.initiate()`. Cổng 27019 trên máy ánh xạ vào 27017 trong container, tránh đụng MongoDB khác đã cài sẵn ở 27017 |
| Mailpit SMTP | `localhost:1025` | Bắt mọi email backend gửi ra; không gửi tới hộp thư thật |
| Mailpit UI | `http://localhost:8025` | Mở để bấm link xác minh email và link đặt lại mật khẩu khi dev |

Link trong email được tạo từ `PUBLIC_BASE_URL` trong `backend/.env`. Khi test trên điện thoại qua ngrok, đặt biến này là domain ngrok, để link mở được trên điện thoại.

Chuỗi kết nối trong `backend/.env`:

```bash
MONGODB_URI=mongodb://localhost:27019/palmsight?directConnection=true
```

- MongoDB **phải** chạy dạng replica set (`mongod --replSet rs0` rồi `rs.initiate()`). MongoDB đơn lẻ (standalone) kết nối được, nhưng mọi thao tác credits sẽ lỗi vì không có transaction.
- Chỉ dùng `directConnection=true`, **không** thêm `replicaSet=rs0`. Có cả hai thì một số công cụ (MongoDB Compass…) báo "directConnection is not supported with replicaSet".
- Không dùng docker-compose mà tự chạy container thì giữ đúng cổng và cờ replica set:

  ```bash
  docker run -d --name PalmSight -p 27019:27017 mongo:7 --replSet rs0 --bind_ip_all
  docker exec PalmSight mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0, host:'localhost:27017'}]})"
  ```

  `host` trong `rs.initiate()` là `localhost:27017` (cổng bên trong container), không phải 27019. Nhờ `directConnection=true`, driver kết nối thẳng qua cổng 27019 mà không cần phân giải tên host đó.

## 4. Tạo index và dữ liệu mẫu

```bash
pnpm --filter backend db:sync-indexes
pnpm --filter backend db:seed
```

## 5. Lấy API key và cấu hình dịch vụ

### ngrok (làm trước, vì đăng nhập Facebook cần URL HTTPS)

1. Đăng ký tại ngrok.com, rồi chạy `ngrok config add-authtoken <token>`. Token được lưu trong cấu hình của ngrok trên máy, không nằm trong file env của dự án.
2. Dashboard → **Domains** → nhận static domain miễn phí, ví dụ `palmsight-dev.ngrok-free.app`. Mỗi thành viên nên có domain riêng.
3. Trong `backend/.env`: đặt `PUBLIC_BASE_URL=https://palmsight-dev.ngrok-free.app`.
4. Trong `frontend/.env`: đặt `DEV_ALLOWED_HOSTS=palmsight-dev.ngrok-free.app`. `vite.config.ts` đọc biến này để điền `server.allowedHosts`. Nếu thiếu, Vite chặn request với lỗi "Blocked request. This host is not allowed".

### Cloudinary (lưu ảnh lòng bàn tay & ảnh vẽ chỉ tay)

1. Đăng ký tài khoản miễn phí tại cloudinary.com (không yêu cầu thẻ tín dụng).
2. Mở **Dashboard** (hoặc **Settings → API Keys**) để lấy `Cloud Name`, `API Key` và `API Secret`.
3. Điền vào `backend/.env`:

   ```bash
   CLOUDINARY_CLOUD_NAME=<cloud_name>
   CLOUDINARY_API_KEY=<api_key>
   CLOUDINARY_API_SECRET=<api_secret>
   CLOUDINARY_FOLDER=palmsight/readings
   ```

### Gmail SMTP (chỉ cần khi muốn gửi email thật)

Khi dev, Mailpit là đủ. Chỉ làm bước này khi muốn thử gửi tới hộp thư thật, hoặc khi deploy.

1. Tạo một tài khoản Gmail riêng cho dự án. Không dùng Gmail cá nhân, vì mật khẩu ứng dụng cho phép gửi mail thay bạn.
2. Bật **Xác minh 2 bước** cho tài khoản đó (bắt buộc để có App Password).
3. myaccount.google.com → **Security → App passwords** → tạo mật khẩu cho "PalmSight", copy chuỗi 16 ký tự.
4. Điền vào `backend/.env`:

   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=palmsight.app@gmail.com
   SMTP_PASS=<app password 16 ký tự>
   MAIL_FROM="PalmSight <palmsight.app@gmail.com>"
   ```

Gmail ghi đè địa chỉ người gửi bằng `SMTP_USER`, nên `MAIL_FROM` phải dùng đúng địa chỉ đó.

### Gemini & Groq

1. Tạo key tại aistudio.google.com → điền `GEMINI_API_KEY` trong `backend/.env`.
2. Tạo key tại console.groq.com → **API Keys**, điền `GROQ_API_KEY` trong `backend/.env`.

### Google

1. console.cloud.google.com → tạo project → **APIs & Services → OAuth consent screen**, loại External, thêm email của 2 thành viên làm test user.
2. **Credentials → Create credentials → OAuth client ID**, loại *Web application*.
3. **Authorized JavaScript origins**: `http://localhost:5173` và domain ngrok của từng thành viên.
4. Điền client ID vào `GOOGLE_CLIENT_ID` (`backend/.env`) và `VITE_GOOGLE_CLIENT_ID` (`frontend/.env`).
5. Điền client secret của cùng OAuth client vào `GOOGLE_CLIENT_SECRET` (`backend/.env`). Secret **chỉ** nằm ở backend: nút Google gửi authorization code lên API, API dùng secret đổi code lấy ID token. Không cần khai báo redirect URI vì luồng popup dùng `postmessage`.

### Facebook

1. developers.facebook.com → **Create App** → use case *Authenticate and request data from users with Facebook Login*.
2. **App settings → Basic**: điền App Domains (domain ngrok), Privacy Policy URL, Data Deletion Instructions URL.
3. **Facebook Login → Settings**: thêm domain ngrok vào Allowed Domains for the JavaScript SDK.
4. Điền `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` vào `backend/.env`; `VITE_FACEBOOK_APP_ID` (cùng giá trị app ID) vào `frontend/.env`. App secret **chỉ** nằm ở backend.
5. Ở chế độ Development, chỉ tài khoản được thêm vào **App roles** mới đăng nhập được. Hãy thêm thành viên thứ hai vào đó.

Hai thành viên có thể dùng chung một Google project và một Facebook App: mỗi người chỉ cần thêm domain ngrok của mình vào danh sách.

## 6. Chạy app

```bash
pnpm dev
ngrok http 5173 --url=palmsight-dev.ngrok-free.app
```

Vite dev server ở cổng 5173 proxy `/api/v1/*` sang API ở cổng 4000 (`API_PROXY_TARGET`). Vì vậy chỉ cần tunnel cổng 5173, và cookie `rt` dùng chung một domain. Mở `https://palmsight-dev.ngrok-free.app` trên điện thoại để thử camera.

Vite đọc `frontend/.env`; trình duyệt chỉ thấy các biến `VITE_*`. Backend đọc `backend/.env`. Đổi file env của phía nào thì phải khởi động lại phía đó.

## 7. Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `pnpm dev` | Chạy shared + frontend + backend ở chế độ watch |
| `pnpm --filter frontend dev` / `pnpm --filter backend dev` | Chạy riêng một phía |
| `pnpm lint` / `pnpm typecheck` | Kiểm tra code |
| `pnpm test` | Unit + integration test (MongoDB chạy trong bộ nhớ) |
| `pnpm test:e2e` | Playwright end-to-end |
| `pnpm --filter backend credits:adjust --user <id> --amount 5 --note "test"` | Cộng/trừ credits tay |
| `pnpm --filter backend credits:reconcile` | Kiểm tra sổ cái khớp số dư |
| `pnpm --filter backend db:check` | Kiểm tra dữ liệu mồ côi và tài khoản xoá chưa sạch (chỉ đọc) |
| `pnpm --filter backend users:delete --user <id> --note "<link yêu cầu>"` | Xoá tài khoản theo yêu cầu của người dùng ([ADR-0009](adr/0009-manual-account-deletion.md)) |
| `docker compose down -v` | Xoá sạch dữ liệu local |

Kể cả khi dev, đừng sửa tay `users` hay `credit_transactions` trong Compass để "test nhanh": dùng `db:seed`, `credits:adjust` hoặc API. Sửa tay sẽ tạo ra dữ liệu không thể có ngoài thực tế, và test trên dữ liệu đó không có ý nghĩa.

## Lỗi hay gặp

| Triệu chứng | Cách xử lý |
| --- | --- |
| `Transaction numbers are only allowed on a replica set member or mongos` | MongoDB đang chạy standalone: container thiếu `--replSet rs0`, hoặc chưa chạy `rs.initiate()`. Kiểm tra bằng `docker exec <container> mongosh --eval "rs.status()"` |
| `directConnection is not supported with replicaSet` | Bỏ `replicaSet=rs0` khỏi `MONGODB_URI`, chỉ giữ `directConnection=true` |
| Mở qua ngrok báo "Blocked request. This host is not allowed" | Đặt `DEV_ALLOWED_HOSTS=<domain ngrok>` trong `frontend/.env`, rồi khởi động lại Vite |
| Backend treo ở bước khởi động, log dừng sau `ConfigModule dependencies initialized` | Không kết nối được MongoDB: kiểm tra container đang chạy, và `MONGODB_URI` trong `backend/.env` đúng cổng |
| Mở thẳng `/scan` hoặc tải lại trang bị 404 khi chạy `vite preview` hay deploy | Thiếu SPA fallback về `/index.html`; trên Vercel xem `frontend/vercel.json` |
| `Cannot find module '@palmsight/shared'` | Chưa build `shared`; chạy `pnpm --filter @palmsight/shared build` hoặc `pnpm dev` |
| Gọi API qua ngrok nhận về trang HTML cảnh báo | Client gửi header `ngrok-skip-browser-warning: true` |
| Google báo `origin_mismatch` | Thêm đúng origin (kể cả `https://`) vào OAuth client |
| Facebook báo "App not active" | Thêm tài khoản vào App roles |
| Không thấy email xác minh khi dev | Mở Mailpit `http://localhost:8025`; kiểm tra `SMTP_HOST=localhost`, `SMTP_PORT=1025` |
| Gmail báo `535 Username and Password not accepted` | Dùng App Password, không dùng mật khẩu Gmail; tài khoản phải bật xác minh 2 bước |
| Link trong email trỏ về `localhost` khi mở trên điện thoại | Đặt `PUBLIC_BASE_URL` là domain ngrok rồi gửi lại email |
| Camera không mở trên điện thoại | Phải mở qua HTTPS (ngrok), không dùng địa chỉ IP trong mạng LAN |
| `AI_UNAVAILABLE` liên tục | Kiểm tra `GEMINI_API_KEY`, `GROQ_API_KEY`, tên model, hạn mức free tier |
