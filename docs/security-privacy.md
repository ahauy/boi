# security-privacy — Bảo mật và quyền riêng tư

Dự án nhỏ, repo công khai: mục tiêu là không lộ secret, bảo vệ ảnh của người dùng và không để credits bị cộng sai. Chống gian lận referral ở mức cơ bản là đủ.

## Dữ liệu thu thập

| Dữ liệu | Nguồn | Mục đích | Lưu bao lâu |
| --- | --- | --- | --- |
| Tên hiển thị, username, email | Người dùng nhập khi đăng ký | Hiển thị hồ sơ, đăng nhập, gửi email xác minh và đặt lại mật khẩu | Tới khi xoá tài khoản |
| Hash mật khẩu (argon2id) | Người dùng nhập | Đăng nhập | Tới khi xoá tài khoản |
| Đăng ký chưa xác minh | Người dùng nhập | Chờ xác minh email | Tự xoá sau 24 giờ |
| Tên, ảnh đại diện, email | Google / Facebook | Hiển thị hồ sơ, gộp tài khoản | Tới khi xoá tài khoản |
| ID tài khoản Google/Facebook | Google / Facebook | Đăng nhập | Tới khi xoá tài khoản |
| Ảnh lòng bàn tay & ảnh đã vẽ đường chỉ tay | Người dùng tải lên + Model ONNX vẽ chỉ tay | Hiển thị trực quan đường chỉ tay trên trang kết quả và lịch sử; gửi AI phân tích bói | **Lưu trên Cloudinary** sau khi đã xoá toàn bộ EXIF/GPS ([ADR-0011](adr/0011-cloudinary-image-storage-and-onnx-palm-lines.md)). Xoá ngay khỏi Cloudinary khi người dùng xoá reading, xoá tài khoản, hoặc khi bài bói thử hết hạn 7 ngày |
| Kết quả bói & tọa độ đường chỉ tay (`palmLines`) | AI (Gemini/Groq) + Model ONNX | Hiển thị, lịch sử | Tới khi người dùng xoá reading/tài khoản |
| Lịch sử credits | Hệ thống | Đối soát | Giữ cả sau khi xoá tài khoản (đã ẩn danh) |
| HMAC của email và ID Google/Facebook đã xoá | Hệ thống, lúc xoá tài khoản | Không cho tài khoản tạo lại nhận credits khuyến mãi | Vô thời hạn; không đảo ngược được |

Ảnh lòng bàn tay có thể bị xem là dữ liệu sinh trắc học. Nếu app được dùng rộng rãi, nên tìm hiểu quy định bảo vệ dữ liệu cá nhân của Việt Nam (Nghị định 13/2023/NĐ-CP và luật bảo vệ dữ liệu cá nhân mới).

## Bảo vệ ảnh & Lưu trữ Cloudinary

- Màn chụp ảnh có checkbox đồng ý: ảnh được gửi tới hệ thống AI (Gemini/Groq) để phân tích và lưu trữ trên Cloudinary để hiển thị kết quả vẽ chỉ tay. Server kiểm tra: `POST /readings` thiếu `aiConsent=true` thì bị từ chối.
- **Xoá sạch EXIF trước khi lưu và trước khi gửi AI**:
  - Server nhận ảnh qua `multer` `memoryStorage` và dùng `sharp` trong bộ nhớ để xoay đúng chiều rồi **xoá toàn bộ metadata EXIF (bao gồm tọa độ GPS, thông tin thiết bị)** trước khi gửi AI hoặc upload lên Cloudinary.
  - Không bao giờ ghi file tạm ra ổ đĩa local của server (`/tmp`).
- **Chỉ lưu ảnh của lượt bói thành công**:
  - Nếu ảnh không phải lòng bàn tay (`REJECTED`) hoặc AI lỗi (`FAILED`), server bỏ buffer ảnh ngay lập tức, **không** upload lên Cloudinary.
- **Xoá đồng bộ khỏi Cloudinary**:
  - `DELETE /readings/{id}` gọi Cloudinary API (`cloudinary.uploader.destroy`) xoá ngay `imagePublicId` / `annotatedImagePublicId`, đồng thời đặt `result = null`, `imageUrl = null`, `annotatedImageUrl = null`, `palmLines = null` và ẩn reading khỏi API.
  - Khi xoá tài khoản bằng `users:delete`, script xoá toàn bộ ảnh trên Cloudinary của user đó.
- Không log ảnh, base64 ảnh hay toàn bộ response AI.

## Xoá tài khoản

Không có tính năng tự xoá trong app, để chặn vòng xoá–đăng ký lại nhằm farm credits. Xem [ADR-0009](adr/0009-manual-account-deletion.md).

**Quy trình xoá theo yêu cầu:**

1. Người dùng làm theo hướng dẫn ở `/data-deletion`: gửi email tới `SUPPORT_EMAIL` **từ chính email của tài khoản**. Tài khoản không có email (chỉ Facebook) gửi kèm ID tài khoản copy từ `/account`.
2. Dev xác minh người gửi là chủ tài khoản:
   - email người gửi khớp `users.email`; hoặc
   - với tài khoản không có email: hỏi thêm thông tin chỉ chủ tài khoản biết, ví dụ số credits hiện tại, ngày xem bói gần nhất.
3. Trong vòng 30 ngày, dev chạy `pnpm --filter backend users:delete --user <id> --note "<link yêu cầu>"`. Script:
   - xoá toàn bộ ảnh lòng bàn tay của user trên Cloudinary;
   - xoá kết quả bói, tọa độ đường chỉ tay, mật khẩu, identity, session, token đặt lại mật khẩu;
   - ẩn danh hoá user (xoá tên, username, email, avatar; đặt `deletedAt`);
   - ghi HMAC của email và ID Google/Facebook vào `deleted_identities`.
4. Trả lời email xác nhận đã xoá.

**Giữ lại sau khi xoá:**

- `_id` và sổ cái credits, để đối soát.
- HMAC của các định danh, dùng khoá `IDENTITY_HASH_SECRET`. Nhờ đó tài khoản tạo lại từ cùng email/Google/Facebook bắt đầu với 0 credits và không được nhập mã giới thiệu.
- Không giữ email, ID gốc hay ảnh bàn tay. Trang `/privacy` phải nói rõ việc giữ mã băm này.

Facebook bắt buộc cung cấp **Data Deletion Instructions URL**: dùng trang `/data-deletion`.

## Xác thực

- **Mật khẩu:**
  - Hash bằng argon2id (thư viện `argon2`, tham số mặc định); không bao giờ log hay trả về mật khẩu, kể cả bản hash.
  - Độ dài 8–128 ký tự, không bắt buộc ký tự đặc biệt, không được trùng email hoặc username.
  - Khi so sánh, luôn chạy hàm verify kể cả khi không tìm thấy user (verify với một hash giả), để thời gian phản hồi không lộ là user có tồn tại hay không.
- **Chống dò mật khẩu:** 5 lần sai liên tiếp với cùng `login` trong 15 phút → khoá 15 phút (`429`); thêm 10 request/phút/IP cho `/auth/*`. Đếm trong bộ nhớ, nên mất khi API khởi động lại; chấp nhận được với quy mô dự án.
- **Chống dò email/username:**
  - `login`, `forgot-password`, `resend-verification` không tiết lộ email có tồn tại hay không.
  - `register` vẫn báo `EMAIL_TAKEN`/`USERNAME_TAKEN` để người dùng sửa được. Chấp nhận mức lộ thông tin này, có rate limit đi kèm.
- **Token trong link email** (xác minh, đặt lại mật khẩu):
  - 32 byte ngẫu nhiên (`crypto.randomBytes`), mã hoá base64url; database chỉ lưu hash SHA-256.
  - Dùng một lần; sống 24 giờ (xác minh) hoặc 1 giờ (đặt lại mật khẩu).
  - Trang web xoá token khỏi thanh địa chỉ ngay sau khi đọc. Token chỉ được gửi lên trong body `POST`, không bao giờ nằm trong URL gọi API.
- **Đặt lại mật khẩu** thu hồi mọi phiên. **Đổi mật khẩu** thu hồi mọi phiên trừ phiên hiện tại.
- **Auth guard kiểm tra user ở mỗi request:** user phải tồn tại và có `deletedAt = null`, nếu không thì `401`. Nhờ vậy, user vừa bị xoá bằng `users:delete` không dùng tiếp được access token còn hạn (tối đa 15 phút). `/auth/refresh` cũng kiểm tra như vậy và thu hồi session của user đã xoá.
- **Gộp tài khoản theo email** chỉ dùng email đã xác minh: link xác minh của ta, hoặc `email_verified` của Google, hoặc email Facebook trả về. Không ai gắn được mật khẩu vào tài khoản của người khác, vì phải bấm link trong hộp thư của email đó.
- **`IDENTITY_HASH_SECRET`:** secret ≥ 32 byte chỉ nằm trên server, dùng làm khoá HMAC cho `deleted_identities`. Không bao giờ đổi sau khi đã có dữ liệu.
- **SMTP:** App Password của Gmail là secret, chỉ nằm trong env của server. Dùng tài khoản Gmail riêng cho dự án.
- **Cloudinary:** `CLOUDINARY_API_SECRET` chỉ nằm trong env của server, không bao giờ lộ xuống client.
- **Google:** xác minh ID token phía server bằng thư viện chính thức, kiểm tra `aud` = `GOOGLE_CLIENT_ID`, `iss`, `exp`, `email_verified`.
- **Facebook:** gọi `debug_token` với app access token để chắc token được cấp cho **đúng app này**, rồi gọi `/me?fields=id,name,email,picture`.
- **Access token:** JWT 15 phút, giữ trong bộ nhớ trình duyệt (không lưu localStorage). Khi mở app hoặc tải lại trang, SPA gọi `/auth/refresh` để lấy access token mới từ cookie `rt`.
- **Refresh token:**
  - Lưu trong cookie `HttpOnly; Secure; SameSite=Lax`; database chỉ lưu bản hash.
  - Xoay vòng mỗi lần dùng.
  - Nếu một token cũ bị dùng lại → thu hồi toàn bộ phiên của user đó.
- Endpoint dùng cookie (`/auth/refresh`, `/auth/logout`) kiểm tra header `Origin` khớp `PUBLIC_BASE_URL`.

## Bảo vệ credits

| Rủi ro | Biện pháp |
| --- | --- |
| Gửi nhiều `POST /readings` cùng lúc để xem nhiều lần bằng 1 credit | Trừ bằng `updateOne` có điều kiện `creditBalance >= 1`, trong transaction |
| Gửi lại request, bị trừ 2 lần | `Idempotency-Key` unique theo user |
| Hoàn credit nhiều lần | Unique index `(readingId, type)` trên sổ cái |
| Nhập mã nhiều lần | Unique index `referrals.refereeId` |
| Hai người nhập mã của nhau để cùng được thưởng | Chặn bằng `REFERRAL_CYCLE` |
| Gắn cả mật khẩu + Google + Facebook để nhận bonus nhiều lần | Gộp theo email đã xác minh; bonus unique theo user |
| Xoá tài khoản rồi đăng ký lại để nhận lại +3 và nhập mã lần nữa | Không có tự xoá; xoá thủ công ghi HMAC định danh vào `deleted_identities`; tài khoản tạo lại có 0 credits, `referralBlocked = true` |
| Tạo tài khoản ảo nhập mã của chính mình để nhận +2 và +1 | +1 rơi vào tài khoản ảo, vô ích với tài khoản chính; +2 cho chủ mã bị giới hạn bởi trần 10 lượt/ngày; tài khoản ảo phải xác minh email thật |
| Đăng ký hàng loạt bằng email giả để nhận +3 | Bắt buộc xác minh email trước khi tạo user; giới hạn 3 email/giờ cho mỗi địa chỉ. Email dùng một lần (temp mail) vẫn lọt; chấp nhận |
| Dò mã giới thiệu | Rate limit 5 lần/giờ cho `POST /me/referral` |
| Một người tạo nhiều tài khoản ảo để tự nhận thưởng | Chấp nhận rủi ro; trần 10 lượt/ngày giới hạn thiệt hại |

Script `credits:reconcile` so tổng sổ cái với `creditBalance` của từng user; chạy tay hoặc định kỳ.

**Toàn vẹn dữ liệu:**
- `CreditLedgerService` kiểm tra `matchedCount === 1` sau mỗi lần cộng/trừ. Lệnh trúng 0 user thì rollback, không ghi sổ cái.
- Không sửa hay xoá trực tiếp trên database. Script `db:check` phát hiện dữ liệu mồ côi (giao dịch, reading, session, referral trỏ vào user không tồn tại) và tài khoản xoá chưa sạch. Xem [deployment.md](deployment.md#vận-hành).

## AI

- Prompt yêu cầu bỏ qua mọi chữ trong ảnh, để chữ chèn vào ảnh không điều khiển được AI (prompt injection).
- Output phải qua Yup schema `PalmResult`; chuỗi bị giới hạn độ dài; UI chỉ hiển thị dạng text, không render HTML hay markdown từ AI.
- Cấm nội dung: chẩn đoán bệnh, tuổi thọ, cái chết, tai nạn, lời khuyên tài chính/pháp lý cụ thể.
- API key chỉ ở server; rate limit 5 lần/phút/user để bảo vệ hạn mức miễn phí.
- Model ONNX vẽ chỉ tay (`palm_lines.onnx`) chạy hoàn toàn với dữ liệu pixel ảnh, chỉ xuất ra tọa độ hình học và hình vẽ các đường chỉ tay, không sinh văn bản.

## Repo công khai

- Không bao giờ commit `.env`; `.gitignore` đã chặn. Nếu lỡ commit key: **thu hồi key ngay**, sau đó mới xoá khỏi lịch sử git.
- Bật **Secret scanning** và **Push protection** trong Settings → Code security của repo.
- Bật Dependabot alerts.
- Ảnh mẫu dùng trong test phải là ảnh tay của chính thành viên dự án hoặc ảnh có quyền sử dụng.

## Hạ tầng

- HTTPS bắt buộc. Các header bảo mật cần đặt. Header của web khai báo trong `frontend/vercel.json`; header của API do NestJS đặt (ví dụ `helmet`):
  - `Strict-Transport-Security`
  - `Content-Security-Policy`, cho phép domain SDK của Google/Facebook và ảnh từ `res.cloudinary.com`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- Xác định loại ảnh bằng magic bytes, không tin header `Content-Type`; giải mã qua `sharp` với giới hạn số pixel.
- Không đặt secret trong biến `VITE_*`: Vite nhúng chúng vào bundle trình duyệt lúc build.
- Service worker của PWA không cache response của `/api/v1/*`, nhưng có thể cache file model tĩnh `palm_lines.onnx` và WASM của MediaPipe/ONNX Runtime để tăng tốc các lần quét sau.
- MongoDB Atlas: Network Access chỉ mở cho IP của server nếu nền tảng cho IP cố định. Nếu không (gói free thường không có), dùng mật khẩu mạnh và user database chỉ có quyền trên database của app.
- Tách hai user database:
  - `palmsight-app` (`readWrite`) chỉ cho API và script;
  - `palmsight-readonly` (`read`) để xem dữ liệu hằng ngày.

  Phân quyền là cách duy nhất thật sự chặn được việc lỡ tay sửa hay xoá dữ liệu; quy tắc trên giấy thì không chặn được. Chi tiết ở [deployment.md](deployment.md#phân-quyền-mongodb).
