# api-contract — Đặc tả API

## Quy ước chung

- **Base URL**: `https://<domain>/api/v1`. Web và API chạy chung một domain: khi dev qua Vite proxy (`https://<subdomain>.ngrok-free.app/api/v1`), khi deploy qua Vercel rewrite. Xem [deployment.md](deployment.md#định-tuyến).
- **ID**: MongoDB ObjectId dạng chuỗi hex 24 ký tự, ví dụ `6710a1b2c3d4e5f6a7b8c9d0`.
- **Thời gian**: ISO 8601 UTC, ví dụ `2026-10-14T08:30:00Z`.
- **Tên trường**: JSON và multipart đều dùng `camelCase`.

### Giá trị gửi lên nằm ở đâu

| Vị trí | Dùng cho | Quy tắc |
| --- | --- | --- |
| **Path** | ID tài nguyên: `/readings/{id}` | ObjectId sai định dạng được xử lý như không tồn tại → `404 NOT_FOUND` |
| **Query** | Chỉ dùng cho `GET`: phân trang `cursor`, `limit` | Request `POST`/`DELETE` **không** đọc query; tham số trên query bị bỏ qua |
| **Header** | `Authorization` (access token), `Idempotency-Key` (chỉ `POST /readings`) | Xem bảng header bên dưới |
| **Cookie** | Refresh token `rt`, chỉ dùng ở `/auth/*` | Trình duyệt tự gửi; client không đọc được (HttpOnly) |
| **Body JSON** | Mọi `POST /auth/*` trừ refresh/logout; `PUT /me/password`; `POST /me/referral` | `Content-Type: application/json`. Có trường lạ hoặc thiếu trường bắt buộc → `400 VALIDATION_ERROR` |
| **Body multipart** | Chỉ `POST /readings`, `POST /readings/guest` (có file ảnh) | `Content-Type: multipart/form-data`. Mọi giá trị không phải file đều là chuỗi |
| **Không có body** | `POST /auth/refresh`, `POST /auth/logout`, mọi `GET` và `DELETE` | Body gửi kèm (nếu có) bị bỏ qua |

Tóm tắt các request `POST`/`PUT`:

| Endpoint | Path | Query | Header | Cookie | Body |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/register` | — | — | — | — | JSON `{ displayName, username, email, password, referralCode?, claimToken? }` |
| `POST /auth/verify-email` | — | — | — | `rt` (nếu có) | JSON `{ token, claimToken? }` |
| `POST /auth/resend-verification` | — | — | — | — | JSON `{ email }` |
| `POST /auth/login` | — | — | `X-Client: native` (app mobile) | `rt` (nếu có) | JSON `{ login, password }` |
| `POST /auth/device` | — | — | `X-Client: native` (app mobile) | `rt` (nếu có) | JSON `{ deviceId }` |
| `POST /auth/forgot-password` | — | — | — | — | JSON `{ email }` |
| `POST /auth/reset-password` | — | — | — | — | JSON `{ token, newPassword }` |
| `POST /auth/google` | — | — | — | `rt` (nếu có) | JSON `{ code }` hoặc `{ idToken }` |
| `POST /auth/facebook` | — | — | — | `rt` (nếu có) | JSON `{ accessToken }` |
| `POST /auth/refresh` | — | — | `Origin` (web) **hoặc** `X-Refresh-Token` (app mobile) | `rt` (bắt buộc với web) | — |
| `POST /auth/logout` | — | — | `Origin` (web) **hoặc** `X-Refresh-Token` (app mobile) | `rt` (nếu có) | — |
| `PUT /me/password` | — | — | `Authorization` | — | JSON `{ currentPassword, newPassword }` |
| `POST /me/referral` | — | — | `Authorization` | — | JSON `{ code }` |
| `POST /readings` | — | — | `Authorization`, `Idempotency-Key` | — | multipart `school`, `topics`, `hand`, `aiConsent`, `palmLines?`, `image`, `annotatedImage?` |
| `POST /readings/guest` | — | — | `Idempotency-Key` | `ps_guest_trial` (nếu có) | multipart `school`, `topics`, `hand`, `fingerprint`, `aiConsent`, `palmLines?`, `image`, `annotatedImage?` |

### Header

| Header | Chiều | Khi nào | Giá trị |
| --- | --- | --- | --- |
| `Authorization` | request | Mọi endpoint cần đăng nhập | `Bearer <accessToken>` |
| `Content-Type` | request | Request có body | `application/json`, hoặc `multipart/form-data; boundary=...`. Với multipart, để trình duyệt tự đặt, **không** tự ghi tay (sẽ thiếu `boundary`) |
| `Idempotency-Key` | request | `POST /readings`, `POST /readings/guest` | UUID v4 do client sinh (`crypto.randomUUID()`), 36 ký tự |
| `Origin` | request | `/auth/refresh`, `/auth/logout` | Trình duyệt tự gửi; phải khớp `PUBLIC_BASE_URL`. App native **không** gửi header này (xem mục Xác thực) |
| `X-Client` | request | App mobile (Expo) gửi trên **mọi** request | `native`. Đánh dấu client không dùng cookie; `/auth/login` và `/auth/device` trả `refreshToken` trong body cho client này |
| `X-Refresh-Token` | request | `/auth/refresh`, `/auth/logout` khi không dùng cookie | Refresh token thô, do app mobile lưu trong SecureStore |
| `ngrok-skip-browser-warning` | request | Chỉ khi dev qua ngrok | `true` |
| `X-Request-Id` | response | Mọi response | ID để tra log; trùng `details.requestId` của lỗi 500 |
| `Retry-After` | response | `429` | Số giây cần chờ |
| `Idempotent-Replayed` | response | `POST /readings` trả lại kết quả cũ | `true` |
| `Set-Cookie` | response | Đăng nhập, refresh, logout; bói thử khách | Cookie `rt` (auth); cookie `ps_guest_trial` (bói thử, HMAC signed) |

### Xác thực

- **Access token**: JWT HS256, sống 15 phút, chứa `sub` (user ID) và `sid` (session ID). Server trả trong body (`accessToken`, `expiresIn`). Client giữ trong bộ nhớ, không lưu `localStorage`, và gửi qua header `Authorization`.
- **Refresh token**: cookie `rt` với thuộc tính `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000` (30 ngày). Xoay vòng mỗi lần refresh. Vì `Path=/api/v1/auth`, cookie chỉ được gửi tới các endpoint `/auth/*`.
- Khi mở app hoặc tải lại trang: gọi `POST /auth/refresh`. Nếu `200` thì đã đăng nhập; nếu `401` thì web chuyển tới `/login`, còn app mobile tự gọi `POST /auth/device` để mở phiên khách (mobile không có màn đăng nhập).
- Gặp `401 TOKEN_EXPIRED`: gọi `/auth/refresh` rồi gửi lại request ban đầu **một lần**. Gặp `401 UNAUTHENTICATED`: chuyển tới `/login`.
- **Auth guard kiểm tra user ở mỗi request**, không chỉ kiểm tra chữ ký JWT:
  1. Xác minh chữ ký và hạn của access token.
  2. Đọc user theo `sub` (theo `_id`, có index sẵn).
  3. Không tìm thấy, hoặc `deletedAt` khác `null` → `401 UNAUTHENTICATED`.

  Lý do: access token còn sống tới 15 phút sau khi user bị xoá bằng `users:delete` (script chỉ thu hồi được session, không thu hồi được JWT đã cấp). Ngoài ra, MongoDB không có khoá ngoại, nên user mất mà không kiểm tra thì phần lớn truy vấn vẫn chạy và ghi ra dữ liệu mồ côi. Controller nhận user đã kiểm tra từ guard, không tự đọc lại và không giả định user luôn tồn tại.
- **Nhiều tab**: các tab dùng chung cookie `rt`. Nếu hai tab refresh cùng lúc, tab gửi sau sẽ bị coi là dùng lại token cũ, và mọi phiên bị thu hồi. Vì vậy client bọc lời gọi refresh trong `navigator.locks.request("palmsight-refresh", ...)`, để mỗi lúc chỉ một tab refresh.
- **App native (mobile/)** không đọc được cookie HttpOnly, nên dùng cặp header riêng và **không** gửi `Origin`:
  - Gửi `X-Client: native` trên mọi request. `POST /auth/login` khi thấy header này trả thêm `refreshToken` (token thô) trong body `AuthResponseDto` cùng `accessToken`; browser vẫn chỉ nhận cookie, vì token thô trong body sẽ đọc được bằng XSS.
  - `POST /auth/refresh` và `POST /auth/logout` gửi `X-Refresh-Token: <token thô>`. `OriginGuard` cho qua request không có `Origin` khi có header này (browser luôn gửi `Origin` khi POST cross-origin nên CSRF bằng cookie vẫn bị chặn).
  - Refresh vẫn xoay vòng: response `RefreshTokenResponseDto` kèm `refreshToken` mới, app ghi đè bản đã lưu trong SecureStore.
  - App chỉ có **một** client (không nhiều tab) nhưng vẫn gộp các lời gọi refresh chung một promise, vì hai request 401 đồng thời mà refresh hai lần bằng cùng một token sẽ bị coi là dùng lại token và thu hồi mọi phiên.

### Phân trang

Áp dụng cho `GET /me/referrals`, `GET /me/credit-transactions`, `GET /readings`.

| Query | Kiểu | Mặc định | Ràng buộc |
| --- | --- | --- | --- |
| `cursor` | string | — | Chuỗi opaque lấy từ `nextCursor` của trang trước; bỏ trống = trang đầu. Cursor sai → `400 VALIDATION_ERROR` |
| `limit` | int | 20 | 1–50 |

Response có dạng `{ "items": [...], "nextCursor": "..." | null }`. Khi `nextCursor` là `null` thì đã hết dữ liệu. Danh sách luôn sắp mới nhất trước.

### Định dạng lỗi

Mọi lỗi 4xx/5xx có cùng dạng:

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Bạn không đủ credits để xem bói.",
    "details": { "required": 1, "balance": 0 }
  }
}
```

`message` viết bằng tiếng Việt và có thể hiển thị thẳng cho người dùng. Client rẽ nhánh theo `code`, không theo `message`.

Với `VALIDATION_ERROR`, `details.fields` liệt kê từng trường lỗi. `field` là tên trường trong body, tên query, hoặc tên header:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên không hợp lệ.",
    "details": {
      "fields": [
        { "field": "school", "message": "Phải là WESTERN, EASTERN hoặc VEDIC" },
        { "field": "Idempotency-Key", "message": "Phải là UUID" }
      ]
    }
  }
}
```

| `code` | HTTP | Khi nào |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Body, query hoặc header sai định dạng, thiếu trường bắt buộc, hoặc có trường lạ; `details.fields` liệt kê trường lỗi |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Thiếu header `Idempotency-Key` ở `POST /readings`, `POST /readings/guest` |
| `VERIFICATION_TOKEN_INVALID` | 400 | Link xác minh email sai, hết hạn hoặc đã dùng |
| `RESET_TOKEN_INVALID` | 400 | Link đặt lại mật khẩu sai, hết hạn hoặc đã dùng |
| `CURRENT_PASSWORD_INCORRECT` | 400 | `PUT /me/password`: mật khẩu hiện tại sai |
| `UNAUTHENTICATED` | 401 | Thiếu hoặc sai access token; hoặc cookie `rt` thiếu, sai, hết hạn, đã thu hồi |
| `TOKEN_EXPIRED` | 401 | Access token hết hạn → client gọi `/auth/refresh` |
| `INVALID_CREDENTIALS` | 401 | Sai email/username hoặc mật khẩu. Không nói rõ sai phần nào |
| `OAUTH_INVALID_TOKEN` | 401 | Token Google/Facebook không hợp lệ |
| `INSUFFICIENT_CREDITS` | 402 | Số dư < 1 khi xem bói |
| `EMAIL_NOT_VERIFIED` | 403 | Đăng nhập đúng mật khẩu nhưng email chưa được xác minh |
| `REFERRAL_NOT_ALLOWED` | 403 | Tài khoản được tạo lại từ email/Google/Facebook đã bị xoá, nên không được nhập mã giới thiệu |
| `ORIGIN_NOT_ALLOWED` | 403 | Header `Origin` không khớp `PUBLIC_BASE_URL` ở `/auth/refresh`, `/auth/logout` |
| `GUEST_TRIAL_LIMIT_REACHED` | 403 | Đã sử dụng hết 1 lượt bói thử miễn phí (kiểm tra qua cookie `ps_guest_trial` hoặc `fingerprintHash`) |
| `NOT_FOUND` | 404 | Tài nguyên không tồn tại, đã xoá, hoặc không thuộc về user |
| `REFERRAL_CODE_NOT_FOUND` | 404 | Mã giới thiệu không tồn tại hoặc sai định dạng |
| `EMAIL_TAKEN` | 409 | Đăng ký với email đã thuộc một tài khoản có mật khẩu |
| `USERNAME_TAKEN` | 409 | Username đã có người dùng hoặc đang được giữ bởi một đăng ký chưa xác minh |
| `PASSWORD_NOT_SET` | 409 | `PUT /me/password` với tài khoản chưa có mật khẩu (chỉ đăng nhập Google/Facebook) → dùng "Quên mật khẩu" để đặt |
| `REFERRAL_ALREADY_USED` | 409 | Tài khoản đã nhập mã trước đó |
| `READING_IN_PROGRESS` | 409 | Reading đang `PROCESSING`: gửi lại cùng `Idempotency-Key`, hoặc xoá reading đang xử lý |
| `IMAGE_TOO_LARGE` | 413 | Ảnh > 8 MB |
| `UNSUPPORTED_IMAGE_TYPE` | 415 | Nội dung file không phải JPEG/PNG/WebP/HEIC |
| `REFERRAL_SELF` | 422 | Nhập mã của chính mình |
| `REFERRAL_CYCLE` | 422 | Nhập mã của người do mình giới thiệu |
| `RATE_LIMITED` | 429 | Vượt giới hạn; có header `Retry-After` |
| `IP_TRIAL_LIMIT_EXCEEDED` | 429 | Địa chỉ IP đã phát sinh 5 lượt bói thử thành công trong vòng 24 giờ |
| `AI_UNAVAILABLE` | 503 | Nhà cung cấp AI lỗi, hết quota hoặc timeout; credit đã được hoàn |
| `INTERNAL_ERROR` | 500 | Lỗi không xác định; có `details.requestId` |

**Rate limit** đếm trong bộ nhớ của API (riêng IP sliding rate limit của bói thử khách vãng lai được đếm trong MongoDB `guest_trials`). Endpoint cần đăng nhập đếm theo user; endpoint không cần đăng nhập đếm theo IP.

| Endpoint | Giới hạn |
| --- | --- |
| `/auth/*` | 10 request/phút/IP |
| `POST /auth/register`, `/auth/resend-verification`, `/auth/forgot-password` | Thêm giới hạn 3 email/giờ cho mỗi địa chỉ email, chống spam hộp thư người khác. Vượt giới hạn: register trả `429`; hai endpoint còn lại vẫn trả `202` nhưng không gửi |
| `POST /auth/login` | Thêm: 5 lần sai liên tiếp với cùng một `login` trong 15 phút → `429` cho tới hết 15 phút, kể cả khi lần sau đúng mật khẩu |
| `PUT /me/password` | 5 request/giờ/user |
| `POST /me/referral` | 5 request/giờ/user |
| `POST /readings` | 5 request/phút/user, kể cả request trả lại kết quả cũ |
| `POST /readings/guest` | Giới hạn trượt 5 lượt bói thử thành công/IP/24 giờ (`IP_TRIAL_LIMIT_EXCEEDED`); 1 lượt bói thử/thiết bị (`GUEST_TRIAL_LIMIT_REACHED`) |
| Còn lại | 60 request/phút |

## Endpoints

| Method | Path | Auth | Đầu vào | Mô tả |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | — | body JSON | Đăng ký bằng email + mật khẩu, gửi email xác minh (hỗ trợ kèm `claimToken`) |
| POST | `/auth/verify-email` | — | body JSON | Xác minh email: tạo tài khoản, claim bài bói thử (nếu có `claimToken`) và đăng nhập |
| POST | `/auth/resend-verification` | — | body JSON | Gửi lại email xác minh |
| POST | `/auth/login` | — | body JSON | Đăng nhập bằng email hoặc username + mật khẩu |
| POST | `/auth/device` | — | body JSON | App mobile đổi `deviceId` đã lưu trong SecureStore lấy phiên khách ẩn danh (tạo mới kèm 3 credits nếu chưa có) |
| POST | `/auth/forgot-password` | — | body JSON | Gửi email đặt lại mật khẩu |
| POST | `/auth/reset-password` | — | body JSON | Đặt mật khẩu mới bằng token trong email |
| POST | `/auth/google` | — | body JSON | Đăng nhập bằng Google ID token |
| POST | `/auth/facebook` | — | body JSON | Đăng nhập bằng Facebook access token |
| POST | `/auth/refresh` | cookie `rt` | — | Cấp access token mới |
| POST | `/auth/logout` | cookie `rt` | — | Thu hồi phiên |
| GET | `/health` | — | — | Kiểm tra kết nối MongoDB, dùng cho deploy |
| GET | `/me` | Bearer | — | Hồ sơ, số dư, mã giới thiệu |
| PUT | `/me/password` | Bearer | body JSON | Đổi mật khẩu |
| POST | `/me/referral` | Bearer | body JSON | Nhập mã giới thiệu |
| GET | `/me/referrals` | Bearer | query phân trang | Danh sách người mình đã giới thiệu |
| GET | `/me/credit-transactions` | Bearer | query phân trang | Lịch sử biến động credits |
| POST | `/readings` | Bearer | header + body multipart | Gửi ảnh + dữ liệu vẽ chỉ tay ONNX + trường phái + các mục muốn bói, trừ 1 credit, lưu ảnh lên Cloudinary, nhận kết quả |
| GET | `/readings` | Bearer | query phân trang | Lịch sử các lần xem |
| GET | `/readings/{id}` | Bearer | path | Chi tiết một lần xem (kèm URL ảnh Cloudinary và đường chỉ tay) |
| DELETE | `/readings/{id}` | Bearer | path | Xoá ảnh trên Cloudinary, xoá kết quả, ẩn khỏi lịch sử |
| POST | `/readings/guest` | — | header + body multipart | Bói thử 1 lần cho khách vãng lai (không cần đăng nhập), lưu ảnh lên Cloudinary, xem trước 50% kết quả |
| GET | `/readings/guest/{token}` | — | path | Xem lại bản xem trước 50% bằng claimToken trong thời hạn 7 ngày |

Danh sách trường phái và các mục bói không có endpoint riêng: web đọc từ `@palmsight/shared` (`READING_SCHOOLS`, `LIFE_ASPECTS`).

### Response đăng nhập (dùng chung)

`POST /auth/verify-email`, `/auth/login`, `/auth/device`, `/auth/google`, `/auth/facebook` thành công đều trả cùng một dạng:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "isNewUser": true,
  "user": {
    "id": "6710a1b2c3d4e5f6a7b8c9d0",
    "displayName": "Nguyễn Văn A",
    "username": "nguyenvana",
    "avatarUrl": null,
    "creditBalance": 3,
    "referralCode": "K7QX4MZP"
  }
}
```

- `isNewUser = true` chỉ khi request này **tạo** user mới. Khi đó client chuyển tới `/referral/enter`, trừ khi `GET /me` trả `referral.canEnterCode = false`.
- User tạo lại từ email/Google/Facebook đã bị xoá vẫn là user mới (`isNewUser = true`), nhưng có `creditBalance = 0` và không được nhập mã. Xem [ADR-0009](adr/0009-manual-account-deletion.md).
- Gộp vào user có sẵn thì `isNewUser = false`.
- `username` là `null` với user chỉ đăng nhập bằng Google/Facebook.
- Request gửi kèm cookie `rt` của một phiên cũ trên trình duyệt này: server thu hồi phiên cũ trước khi cấp phiên mới.

### Quy tắc dữ liệu tài khoản

Định nghĩa một lần bằng Yup trong `@palmsight/shared`, dùng cho cả form và API. Server chuẩn hoá giá trị trước, rồi mới kiểm tra.

| Trường | Chuẩn hoá | Ràng buộc |
| --- | --- | --- |
| `displayName` | Bỏ khoảng trắng hai đầu | 1–50 ký tự |
| `username` | Bỏ khoảng trắng hai đầu, đổi sang chữ thường | `^[a-z0-9_]{3,20}$`. Không có `@`, nên không bao giờ trùng dạng với email |
| `email` | Bỏ khoảng trắng hai đầu, đổi sang chữ thường | Email hợp lệ, ≤ 254 ký tự |
| `password`, `newPassword` | Không chuẩn hoá | 8–128 ký tự. Không trùng email hoặc username (so không phân biệt hoa/thường) |
| `login` | Bỏ khoảng trắng hai đầu, đổi sang chữ thường | Có `@` → tìm theo email; không có → tìm theo username |
| `token` | — | Chuỗi base64url 43 ký tự, lấy từ link trong email |

**Link trong email** trỏ tới trang của web, không trỏ thẳng tới API:

- `https://<domain>/verify-email?token=<token>`
- `https://<domain>/reset-password?token=<token>`

Trang web đọc `token` từ query, xoá nó khỏi thanh địa chỉ (`history.replaceState`), rồi gửi lên API trong **body** của request `POST`.

### POST /auth/register

Không tạo user ngay. Server lưu đăng ký vào `pending_registrations`, gửi email xác minh, rồi trả `202`. Người dùng phải bấm link trong email trước khi đăng nhập được.

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| body | `displayName` | string | có | Xem [Quy tắc dữ liệu tài khoản](#quy-tắc-dữ-liệu-tài-khoản) |
| body | `username` | string | có | Như trên; unique |
| body | `email` | string | có | Như trên |
| body | `password` | string | có | Như trên |
| body | `referralCode` | string | không | Mã giới thiệu, điền sẵn từ cookie `ref_code`. Chuẩn hoá như ở `POST /me/referral`. Lúc đăng ký chỉ kiểm tra định dạng; mã sai định dạng → `400 VALIDATION_ERROR` |
| body | `claimToken` | string | không | Mã UUID v4 của bài bói thử khách vãng lai. Được lưu vào `pending_registrations` để truyền tiếp sang bước xác minh email |

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "displayName": "Nguyễn Văn A", "username": "nguyenvana", "email": "a@example.com", "password": "mat-khau-du-dai", "claimToken": "e4b8a21f-82df-4db3-9824-7128cf4291f0" }
```

```json
{ "email": "a@example.com", "verificationExpiresAt": "2026-10-15T08:30:00Z" }
```

| Tình huống | Kết quả |
| --- | --- |
| Email mới hoàn toàn | Lưu đăng ký chờ, gửi email xác minh, `202` |
| Email đã có đăng ký chờ xác minh | Thay đăng ký cũ bằng dữ liệu mới, gửi link mới (link cũ hết hiệu lực), `202` |
| Email thuộc user chỉ có Google/Facebook (chưa có mật khẩu) | Như email mới. Khi xác minh, mật khẩu và username được **gắn vào user đó**, không cộng bonus |
| Email thuộc user đã có mật khẩu | `409 EMAIL_TAKEN` |
| Username đã thuộc user khác, hoặc đang được giữ bởi đăng ký chờ của email khác | `409 USERNAME_TAKEN` |

Lỗi: `VALIDATION_ERROR`, `EMAIL_TAKEN`, `USERNAME_TAKEN`, `RATE_LIMITED`.

### POST /auth/verify-email

Trang `/verify-email` gọi endpoint này với `token` lấy từ link và `claimToken` (tùy chọn).

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| body | `token` | string | có | Token xác minh lấy từ email |
| body | `claimToken` | string | không | Mã UUID v4 nhận lại bài bói thử khách vãng lai |

Server tìm đăng ký chờ theo hash của token, rồi trong **một transaction**:

- Email chưa thuộc user nào → tạo user (`displayName`, `username`, `email`, `passwordHash`), sinh `referralCode`, cộng `SIGNUP_BONUS` (+3 credits). Trả `isNewUser = true`. Nếu email nằm trong `deleted_identities`: không cộng `SIGNUP_BONUS`, và đặt `referralBlocked = true`.
- Email thuộc user chỉ có Google/Facebook → gắn `username`, `passwordHash` vào user đó. Trả `isNewUser = false`.
- **Mở khóa bài bói thử (`claimToken`)**: Nếu có `claimToken` (truyền trong body hoặc lấy từ `pending_registrations.claimToken`) hợp lệ và bài bói còn hạn lưu trữ (`previewExpiresAt > now`):
  - Khấu trừ 1 credit (`READING_SPEND`) mở khóa bài bói qua `CreditLedgerService`.
  - Cập nhật bài bói: `userId = user._id`, `claimedByUserId = user._id`, `status = DONE`, `previewExpiresAt = null`.
  - Đánh dấu `guest_trials.isClaimed = true`.
  - Số dư ví sau kích hoạt là 2 credits (hoặc 3 nếu có mã giới thiệu). Response trả về `claimedReadingId: "<reading_id>"`.
  - Nếu `claimToken` không tồn tại, sai định dạng hoặc đã quá hạn 7 ngày: hệ thống bỏ qua việc trừ credit, user nhận đủ 3 credits (`SIGNUP_BONUS`), response trả về `claimedReadingId: null`, `claimFailed: true`.
- Xoá đăng ký chờ (token chỉ dùng được một lần).

Nếu đăng ký có `referralCode` và user vừa được **tạo mới**: sau transaction trên, server chạy đúng logic của `POST /me/referral` với mã đó.

- Mã hợp lệ → người dùng +1, chủ mã +2 (hoặc 0 nếu chủ mã hết lượt trong ngày); `GET /me` trả `referral.canEnterCode = false`.
- Mã lỗi (không tồn tại, của chính mình…) thì bỏ qua, request vẫn thành công; người dùng nhập tay lại được ở `/referral/enter`.
- Response được trả **sau** bước này, nên `user.creditBalance` đã gồm +1 nếu mã hợp lệ (ví dụ 4 thay vì 3, hoặc 3 thay vì 2 khi có claim bài bói).

Lý do: link xác minh thường được mở bằng trình duyệt khác (từ app mail), nên cookie `ref_code` bị mất.

Response: [Response đăng nhập](#response-đăng-nhập-dùng-chung) mở rộng kèm `claimedReadingId` và `claimFailed`.

Lỗi: `VALIDATION_ERROR`, `VERIFICATION_TOKEN_INVALID` (token sai, hết hạn 24 giờ, hoặc đã dùng), `RATE_LIMITED`.

### POST /auth/resend-verification

| Vị trí | Trường | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| body | `email` | string | có |

Luôn trả `202` với body rỗng, dù email có đăng ký chờ hay không, để không lộ email nào đã đăng ký. Nếu có đăng ký chờ: sinh token mới (token cũ hết hiệu lực), gia hạn thêm 24 giờ, gửi lại email.

Lỗi: `VALIDATION_ERROR`, `RATE_LIMITED`.

### POST /auth/login

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| body | `login` | string | có | Email **hoặc** username |
| body | `password` | string | có | 1–128 ký tự (không kiểm tra độ mạnh khi đăng nhập) |
| cookie | `rt` | — | không | Phiên cũ, sẽ bị thu hồi |

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "login": "nguyenvana", "password": "mat-khau-du-dai" }
```

| Tình huống | Kết quả |
| --- | --- |
| Đúng `login` và mật khẩu | `200`, [Response đăng nhập](#response-đăng-nhập-dùng-chung), `isNewUser = false` |
| Không có user, sai mật khẩu, hoặc user chưa đặt mật khẩu (chỉ dùng Google/Facebook) | `401 INVALID_CREDENTIALS`, cùng một thông báo cho mọi trường hợp |
| `login` + mật khẩu khớp một đăng ký **chưa xác minh** | `403 EMAIL_NOT_VERIFIED`, `details: { "email": "a@example.com" }` để client hiện nút gửi lại email |
| 5 lần sai liên tiếp trong 15 phút | `429 RATE_LIMITED` |

Lỗi: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `RATE_LIMITED`.

### POST /auth/device

Mobile không có đăng ký/đăng nhập: mỗi thiết bị tự đổi `deviceId` (UUID lưu trong SecureStore) lấy phiên khách.

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| body | `deviceId` | string | có | 16–128 ký tự `[A-Za-z0-9_-]` |

```http
POST /api/v1/auth/device
Content-Type: application/json
X-Client: native

{ "deviceId": "9f1c4a1e-5f60-4d2b-9c1a-1f2e3d4c5b6a" }
```

| Tình huống | Kết quả |
| --- | --- |
| Thiết bị mới | `200`, [Response đăng nhập](#response-đăng-nhập-dùng-chung), `isNewUser = true`; tạo user `isAnonymous: true`, tặng 3 credits, lưu `deviceIdHash` + `signupIpHash` |
| Thiết bị đã có tài khoản khách | `200`, `isNewUser = false`, mở phiên mới cho đúng user đó |
| Tài khoản của thiết bị đã bị xoá (`deletedAt`) | `403 DEVICE_SESSION_BLOCKED` |
| Vượt `ANONYMOUS_SIGNUP_DAILY_CAP` tài khoản khách/IP/24h | `429 DEVICE_SESSION_LIMIT_REACHED` |
| `deviceId` sai định dạng | `400 VALIDATION_ERROR` |

`deviceId` chỉ lưu dạng HMAC-SHA256 (`deviceIdHash`), không lưu bản rõ. App gọi lại cùng `deviceId` sẽ mở lại đúng tài khoản; cài lại app trên Android tạo `deviceId` mới nên là tài khoản khách mới.

### POST /auth/forgot-password

| Vị trí | Trường | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| body | `email` | string | có |

Luôn trả `202` với body rỗng. Nếu email thuộc một user chưa xoá, server tạo token đặt lại mật khẩu (sống 1 giờ, dùng một lần; token cũ chưa dùng của user đó bị huỷ) và gửi email.

Áp dụng cả với user chỉ có Google/Facebook. Đây là cách để họ **đặt mật khẩu lần đầu**; sau đó họ đăng nhập được bằng email + mật khẩu. User Facebook không có email thì không dùng được cách này.

Lỗi: `VALIDATION_ERROR`, `RATE_LIMITED`.

### POST /auth/reset-password

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| body | `token` | string | có | Lấy từ link trong email |
| body | `newPassword` | string | có | Xem [Quy tắc dữ liệu tài khoản](#quy-tắc-dữ-liệu-tài-khoản) |

Server đặt `passwordHash` mới, đánh dấu token đã dùng, **thu hồi mọi phiên** của user, trả `204`. Client chuyển tới `/login` với thông báo "Đã đặt lại mật khẩu".

Lỗi: `VALIDATION_ERROR`, `RESET_TOKEN_INVALID`, `RATE_LIMITED`.

### POST /auth/google · POST /auth/facebook

Đây là cách đăng nhập **phụ**, bên cạnh email/mật khẩu. Client lấy token từ Google Identity Services hoặc Facebook Login SDK, rồi gửi lên trong **body JSON**. Server tự xác minh token với provider.

- Identity Google/Facebook này đã gắn với user → đăng nhập vào user đó.
- Chưa gắn, nhưng email (đã xác minh bởi provider) trùng một user có sẵn → gắn identity vào user đó. Áp dụng cả với user đăng ký bằng mật khẩu, vì email của họ cũng đã được xác minh.
- Không trùng ai → tạo user mới, không có username và mật khẩu, cộng `SIGNUP_BONUS`. Nếu ID Google/Facebook hoặc email nằm trong `deleted_identities`: không cộng bonus, và đặt `referralBlocked = true`.
- Email trùng một đăng ký **chưa xác minh**: bỏ qua đăng ký đó và xử lý như trên. Nếu sau này đăng ký đó được xác minh, mật khẩu sẽ được gắn vào user này (xem `POST /auth/verify-email`).

Luồng chi tiết ở [workflow.md](workflow.md#14-đăng-nhập-google--facebook).

**Request**

| Endpoint | Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- | --- |
| `/auth/google` | body | `code` | string | có, nếu không gửi `idToken` | Authorization code từ `google.accounts.oauth2.initCodeClient` (popup); tối đa 2048 ký tự. Server đổi code lấy ID token bằng `GOOGLE_CLIENT_SECRET`. Web hiện dùng trường này |
| `/auth/google` | body | `idToken` | string | có, nếu không gửi `code` | Giá trị `credential` mà nút GIS trả về; tối đa 4096 ký tự |
| `/auth/facebook` | body | `accessToken` | string | có | `authResponse.accessToken` mà Facebook SDK trả về; 1–4096 ký tự |
| cả hai | cookie | `rt` | — | không | Nếu đang có phiên cũ trên trình duyệt này, server thu hồi phiên đó trước khi cấp phiên mới |

```http
POST /api/v1/auth/google
Content-Type: application/json

{ "code": "4/0AeanS0..." }
```

```http
POST /api/v1/auth/facebook
Content-Type: application/json

{ "accessToken": "EAAGm0PX4ZCps..." }
```

Response: [Response đăng nhập](#response-đăng-nhập-dùng-chung).

Lỗi: `VALIDATION_ERROR`, `OAUTH_INVALID_TOKEN`, `RATE_LIMITED`.

### POST /auth/refresh

Không có body. Trình duyệt tự gửi cookie `rt` (cùng domain) và header `Origin`.

| Vị trí | Trường | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- |
| cookie | `rt` | có | Refresh token còn hạn, chưa thu hồi |
| header | `Origin` | có | Khớp `PUBLIC_BASE_URL` |

```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs...", "expiresIn": 900 }
```

| Trường hợp | Response |
| --- | --- |
| Thiếu cookie, token sai, hết hạn hoặc đã thu hồi | `401 UNAUTHENTICATED`, xoá cookie `rt` |
| Session hợp lệ nhưng user không còn tồn tại hoặc có `deletedAt` | Thu hồi session đó, `401 UNAUTHENTICATED`, xoá cookie `rt` |
| Token đã bị xoay vòng mà vẫn được dùng lại (dấu hiệu bị lộ) | Thu hồi **mọi** phiên của user, `401 UNAUTHENTICATED`, xoá cookie `rt` |
| `Origin` sai | `403 ORIGIN_NOT_ALLOWED` |

Lỗi: `UNAUTHENTICATED`, `ORIGIN_NOT_ALLOWED`, `RATE_LIMITED`.

### POST /auth/logout

Không có body. Cookie `rt` không bắt buộc. Có cookie thì server thu hồi phiên tương ứng; không có thì không làm gì.

Luôn trả `204` và xoá cookie (`Set-Cookie: rt=; Max-Age=0; Path=/api/v1/auth`). Client xoá access token trong bộ nhớ.

Lỗi: `ORIGIN_NOT_ALLOWED`, `RATE_LIMITED`.

### GET /health

Không cần đăng nhập. Trả `200 { "status": "ok", "db": "ok" }`, hoặc `503` khi không kết nối được MongoDB. Không gọi AI.

### GET /me

```json
{
  "id": "6710a1b2c3d4e5f6a7b8c9d0",
  "displayName": "Nguyễn Văn A",
  "username": "nguyenvana",
  "email": "a@example.com",
  "avatarUrl": "https://...",
  "creditBalance": 4,
  "referralCode": "K7QX4MZP",
  "referralLink": "https://<domain>/r/K7QX4MZP",
  "hasPassword": true,
  "providers": ["GOOGLE"],
  "isAnonymous": false,
  "referral": {
    "canEnterCode": true,
    "enteredCode": null
  }
}
```

| Trường | Ghi chú |
| --- | --- |
| `username` | `null` nếu user chưa từng đăng ký bằng mật khẩu |
| `email` | `null` nếu user chỉ đăng nhập Facebook và Facebook không trả email |
| `hasPassword` | `true` khi đăng nhập được bằng email/username + mật khẩu. `/account` dựa vào trường này để hiện "Đổi mật khẩu" hay "Đặt mật khẩu" |
| `providers` | Google/Facebook đã liên kết: `GOOGLE`, `FACEBOOK`; mảng rỗng nếu chỉ dùng mật khẩu |
| `isAnonymous` | `true` với tài khoản khách do app mobile tạo qua `/auth/device`: không email, không mật khẩu, `providers` rỗng |
| `id` | Hiện ở `/account` (web) và tab Hồ sơ (mobile) dưới tên "Mã/ID tài khoản". Người dùng gửi kèm ID này khi yêu cầu xoá tài khoản |
| `referral.canEnterCode` | `true` khi user chưa từng nhập mã **và** không bị `referralBlocked` |
| `referral.enteredCode` | Mã đã nhập, hoặc `null` |

### PUT /me/password

Đổi mật khẩu khi đang đăng nhập.

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| header | `Authorization` | — | có | |
| body | `currentPassword` | string | có | Mật khẩu hiện tại |
| body | `newPassword` | string | có | Xem [Quy tắc dữ liệu tài khoản](#quy-tắc-dữ-liệu-tài-khoản); khác `currentPassword` |

```http
PUT /api/v1/me/password
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{ "currentPassword": "mat-khau-cu", "newPassword": "mat-khau-moi-du-dai" }
```

Server trả `204` và thu hồi **mọi phiên khác**. Phiên hiện tại được giữ: server nhận ra nó qua claim `sid` (session ID) trong access token, vì cookie `rt` không được gửi tới `/me/*`.

User chưa có mật khẩu (`hasPassword = false`) nhận `409 PASSWORD_NOT_SET`. Họ đặt mật khẩu bằng `POST /auth/forgot-password`.

Lỗi: `VALIDATION_ERROR`, `CURRENT_PASSWORD_INCORRECT`, `PASSWORD_NOT_SET`, `RATE_LIMITED`.

### Xoá tài khoản: không có endpoint

API không cho người dùng tự xoá tài khoản. Người dùng gửi yêu cầu qua email theo hướng dẫn ở `/data-deletion`; dev xoá bằng script `users:delete`. Xem [ADR-0009](adr/0009-manual-account-deletion.md) và [security-privacy.md](security-privacy.md#xoá-tài-khoản).

### POST /me/referral

Nhập được bất cứ lúc nào, mỗi tài khoản một lần. Mã nằm trong **body JSON**.

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- | --- |
| header | `Authorization` | — | có | |
| body | `code` | string | có | Server bỏ khoảng trắng hai đầu và đổi sang chữ in hoa trước khi kiểm tra. Mã sau chuẩn hoá phải khớp `^[A-HJKMNP-Z2-9]{8}$`; không khớp → `404 REFERRAL_CODE_NOT_FOUND` |

```http
POST /api/v1/me/referral
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{ "code": "k7qx4mzp" }
```

```json
{
  "accepted": true,
  "referrer": { "displayName": "Trần B" },
  "creditsEarned": 1,
  "creditBalance": 4
}
```

| Trường | Ghi chú |
| --- | --- |
| `creditsEarned` | Credits **người nhập** vừa nhận (`REFEREE_REWARD_CREDITS`, mặc định 1). Luôn có, kể cả khi chủ mã đã hết lượt thưởng trong ngày |
| `creditBalance` | Số dư của người nhập sau khi cộng; client dùng để cập nhật số credits trên màn hình |

Server trả `201` khi mã được ghi nhận, kể cả khi chủ mã đã hết lượt thưởng trong ngày (`CAPPED`). Response không cho người nhập biết chủ mã có được cộng hay không. Thứ tự kiểm tra theo [business-rules.md](business-rules.md#kiểm-tra-khi-nhập-mã-giới-thiệu). Mã của tài khoản đã xoá được coi là không tồn tại.

Lỗi: `VALIDATION_ERROR` (thiếu `code` hoặc `code` không phải chuỗi), `REFERRAL_NOT_ALLOWED`, `REFERRAL_CODE_NOT_FOUND`, `REFERRAL_SELF`, `REFERRAL_ALREADY_USED`, `REFERRAL_CYCLE`, `RATE_LIMITED`.

### GET /me/referrals

Query: `cursor`, `limit` (xem [Phân trang](#phân-trang)).

```json
{
  "totalRewarded": 3,
  "totalCreditsEarned": 6,
  "items": [
    { "displayName": "Lê C***", "status": "REWARDED", "creditsEarned": 2, "createdAt": "2026-10-12T02:10:00Z" },
    { "displayName": "Phạm D***", "status": "CAPPED", "creditsEarned": 0, "createdAt": "2026-10-13T09:00:00Z" }
  ],
  "nextCursor": null
}
```

- Tên người được giới thiệu bị che một phần.
- Người được giới thiệu đã xoá tài khoản (có `deletedAt`), hoặc không còn document user, hiện là `"Người dùng đã xoá"`. Không bao giờ trả `500` vì thiếu user.
- `totalRewarded` và `totalCreditsEarned` tính trên toàn bộ danh sách, không chỉ trang hiện tại.

### GET /me/credit-transactions

Query: `cursor`, `limit`.

```json
{
  "items": [
    { "id": "6710c3d4e5f6a7b8c9d0e1f2", "type": "READING_SPEND", "amount": -1, "balanceAfter": 4, "readingId": "6710c3d4e5f6a7b8c9d0e1aa", "createdAt": "2026-10-14T08:31:02Z" },
    { "id": "6710b2c3d4e5f6a7b8c9d0e1", "type": "REFERRAL_BONUS", "amount": 2, "balanceAfter": 5, "createdAt": "2026-10-12T02:10:00Z" },
    { "id": "6710a1b2c3d4e5f6a7b8c9d1", "type": "SIGNUP_BONUS", "amount": 3, "balanceAfter": 3, "createdAt": "2026-10-10T07:00:00Z" }
  ],
  "nextCursor": null
}
```

`readingId` chỉ có với `READING_SPEND`/`READING_REFUND`. `type` có thể là `REFERRAL_BONUS` (người khác nhập mã của mình, +2) hoặc `REFEREE_BONUS` (mình nhập mã của người khác, +1). `note` chỉ có với `ADMIN_ADJUST`. Giao dịch của reading đã xoá vẫn hiện, nhưng `readingId` của nó mở ra `404`.

### POST /readings

Xử lý đồng bộ, timeout phía server 45 giây. Client đặt timeout **60 giây**, dài hơn server, để không tự huỷ request trước khi server trả lời.

**Header**

| Header | Bắt buộc | Ràng buộc |
| --- | --- | --- |
| `Authorization` | có | `Bearer <accessToken>` |
| `Idempotency-Key` | có | UUID v4, 36 ký tự. Thiếu → `400 IDEMPOTENCY_KEY_REQUIRED`; sai định dạng → `400 VALIDATION_ERROR` |
| `Content-Type` | có | `multipart/form-data; boundary=...`, do trình duyệt tự đặt khi gửi `FormData` |

**Body (multipart/form-data)**: mỗi trường là một part. Không dùng query, không dùng JSON.

| Part | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- |
| `school` | text | có | `WESTERN` \| `EASTERN` \| `VEDIC`. Xem [ai-integration.md](ai-integration.md#trường-phái-bói) |
| `topics` | text | không | Các key cách nhau bởi dấu phẩy, không có khoảng trắng, ví dụ `nguHanh,thienVan,love`. Thiếu part này hoặc chuỗi rỗng = **bói toàn bộ**. Mỗi key phải là mục riêng của `school` đã chọn hoặc một khía cạnh trong `LIFE_ASPECTS`. Server bỏ trùng và sắp lại theo thứ tự chuẩn. Xem [ai-integration.md](ai-integration.md#chọn-mục-bói) |
| `hand` | text | có | `LEFT` \| `RIGHT`, do người dùng chọn ở bước 3. Đây là giá trị cuối cùng: server ghi đè `result.hand` bằng giá trị này |
| `aiConsent` | text | có | Phải là `true`: người dùng đã tích đồng ý gửi ảnh cho nhà cung cấp AI. Giá trị khác → `400 VALIDATION_ERROR` |
| `palmLines` | text (JSON) | không | Chuỗi JSON mảng `PalmLine[]` (tọa độ `points`, `name`: `life`/`head`/`heart`/`other`, `lengthRel`, `curvature`, `branches`) trích xuất bởi model `palm_lines.onnx` |
| `image` | file | có | Đúng 1 file, ≤ 8 MB, nội dung JPEG/PNG/WebP/HEIC (kiểm tra bằng magic bytes, không tin `Content-Type` của part). Tên file bị bỏ qua |
| `annotatedImage` | file | không | Ảnh vùng lòng bàn tay `512×512` đã vẽ đè các đường chỉ tay từ model ONNX (JPEG/PNG, ≤ 2 MB) để lưu lên Cloudinary |

**Thứ tự xử lý phía server**

| # | Bước | Thất bại thì | Trừ credit? |
| --- | --- | --- | --- |
| 1 | Xác thực access token | `401` | Không |
| 2 | Rate limit | `429 RATE_LIMITED` | Không |
| 3 | Kiểm tra header `Idempotency-Key` | `400 IDEMPOTENCY_KEY_REQUIRED` / `VALIDATION_ERROR` | Không |
| 4 | Tìm reading cùng `(userId, Idempotency-Key)` | Có rồi → trả theo bảng **Gửi lại cùng key** bên dưới, bỏ qua các bước sau | Không |
| 5 | Đọc multipart: kích thước ảnh | `413 IMAGE_TOO_LARGE` | Không |
| 6 | Validate `school`, `topics`, `hand`, `aiConsent`, `palmLines` | `400 VALIDATION_ERROR` | Không |
| 7 | Kiểm tra loại ảnh bằng magic bytes | `415 UNSUPPORTED_IMAGE_TYPE` | Không |
| 8 | Trừ 1 credit + tạo reading `PROCESSING` trong 1 transaction | `402 INSUFFICIENT_CREDITS` | — |
| 9 | Xử lý ảnh trong bộ nhớ (xoá EXIF), gọi AI luận giải | `REJECTED` → `200`; `FAILED` → `503`; cả hai đều hoàn credit và **không** lưu ảnh lên Cloudinary | Có, rồi hoàn |
| 10 | Upload ảnh lòng bàn tay (đã xoá EXIF) và ảnh vẽ chỉ tay lên **Cloudinary** ([ADR-0011](adr/0011-cloudinary-image-storage-and-onnx-palm-lines.md)), lưu `result`, `imageUrl`, `annotatedImageUrl`, `palmLines` | `DONE` → `200` | Có |

**Response**

```json
{
  "reading": {
    "id": "6710c3d4e5f6a7b8c9d0e1aa",
    "status": "DONE",
    "school": "EASTERN",
    "topics": ["nguHanh", "thienVan", "love"],
    "hand": "LEFT",
    "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/palmsight/readings/6710c3d4e5f6a7b8c9d0e1aa_palm.jpg",
    "annotatedImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/palmsight/readings/6710c3d4e5f6a7b8c9d0e1aa_lines.jpg",
    "palmLines": [
      { "name": "life", "lengthRel": 0.82, "curvature": 1.18, "branches": 1, "points": [[310, 120], [295, 220], [260, 390]] },
      { "name": "head", "lengthRel": 0.68, "curvature": 1.06, "branches": 1, "points": [[305, 135], [210, 180], [115, 215]] },
      { "name": "heart", "lengthRel": 0.71, "curvature": 1.09, "branches": 1, "points": [[95, 110], [190, 105], [285, 85]] }
    ],
    "result": { "...": "PalmResult, xem ai-integration.md" },
    "createdAt": "2026-10-14T08:31:00Z",
    "completedAt": "2026-10-14T08:31:07Z"
  },
  "creditBalance": 3
}
```

**Idempotency-Key — quy tắc cho client**

| Tình huống | Key dùng cho lần gửi tiếp theo |
| --- | --- |
| Không nhận được response: mất mạng, client timeout, tab bị treo | **Cùng** key: gửi lại an toàn, không bị trừ thêm |
| Đã nhận response bất kỳ (`200`, `4xx`, `503`) | Key **mới** cho lần bấm "Xem bói" tiếp theo |
| Người dùng đổi ảnh, trường phái, mục bói hoặc tay | Key **mới** |

Client sinh key khi người dùng bấm **Xem bói**, giữ key trong bộ nhớ cho tới khi nhận được response, rồi bỏ key đó.

**Gửi lại cùng key**: server chỉ so khớp key, **không** so sánh nội dung body. Body của lần gửi lại bị bỏ qua.

| Trạng thái reading đã có | Response | Header |
| --- | --- | --- |
| `PROCESSING` | `409 READING_IN_PROGRESS` với `details.readingId`. Client đợi vài giây rồi gọi `GET /readings/{readingId}` cho tới khi trạng thái khác `PROCESSING` | |
| `DONE`, `REJECTED` | `200`, cùng dạng với lần đầu; `creditBalance` là số dư hiện tại | `Idempotent-Replayed: true` |
| `FAILED` | `503 AI_UNAVAILABLE`, cùng `details` với lần đầu; `creditBalance` là số dư hiện tại | `Idempotent-Replayed: true` |
| Reading đã bị xoá | `404 NOT_FOUND` | |

Lỗi: `VALIDATION_ERROR`, `IDEMPOTENCY_KEY_REQUIRED`, `INSUFFICIENT_CREDITS`, `READING_IN_PROGRESS`, `IMAGE_TOO_LARGE`, `UNSUPPORTED_IMAGE_TYPE`, `RATE_LIMITED`, `AI_UNAVAILABLE` (credit đã hoàn).

### GET /readings

Query: `cursor`, `limit`. Trả mọi reading **chưa bị xoá** của user, ở mọi trạng thái, mới nhất trước.

```json
{
  "items": [
    {
      "id": "6710c3d4e5f6a7b8c9d0e1aa",
      "status": "DONE",
      "school": "EASTERN",
      "topics": ["nguHanh", "thienVan", "love"],
      "hand": "LEFT",
      "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/palmsight/readings/6710c3d4e5f6a7b8c9d0e1aa_palm.jpg",
      "annotatedImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/palmsight/readings/6710c3d4e5f6a7b8c9d0e1aa_lines.jpg",
      "summary": "Tay Thổ, thực tế và đáng tin cậy...",
      "createdAt": "2026-10-14T08:31:00Z"
    }
  ],
  "nextCursor": null
}
```

Khi đọc danh sách, reading kẹt `PROCESSING` quá 2 phút được chuyển sang `FAILED` và hoàn credit trước khi trả về. Xem [workflow.md](workflow.md#3-xem-bói--vẽ-đường-chỉ-tay-bằng-onnx).

### GET /readings/{id}

Path: `id` là ObjectId của reading. ID sai định dạng, không tồn tại, đã xoá, hoặc thuộc user khác → `404 NOT_FOUND`.

```json
{
  "id": "6710c3d4e5f6a7b8c9d0e1aa",
  "status": "DONE",
  "school": "EASTERN",
  "topics": ["nguHanh", "thienVan", "love"],
  "hand": "LEFT",
  "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/palmsight/readings/6710c3d4e5f6a7b8c9d0e1aa_palm.jpg",
  "annotatedImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v1/palmsight/readings/6710c3d4e5f6a7b8c9d0e1aa_lines.jpg",
  "palmLines": [
    { "name": "life", "lengthRel": 0.82, "curvature": 1.18, "branches": 1, "points": [[310, 120], [295, 220], [260, 390]] }
  ],
  "result": { "...": "PalmResult" },
  "rejectReason": null,
  "createdAt": "2026-10-14T08:31:00Z",
  "completedAt": "2026-10-14T08:31:07Z"
}
```

| Trạng thái | `result` | `imageUrl` / `annotatedImageUrl` | `rejectReason` | `completedAt` |
| --- | --- | --- | --- | --- |
| `PROCESSING` | `null` | `null` | `null` | `null` |
| `DONE` | `PalmResult` | có | `null` | có |
| `REJECTED` | `null` | `null` | có | có |
| `FAILED` | `null` | `null` | `null` | có |

Reading kẹt `PROCESSING` quá 2 phút được dọn như ở `GET /readings`.

### DELETE /readings/{id}

Path: `id`. Không có body.

- Server gọi Cloudinary API xoá ảnh theo `imagePublicId` và `annotatedImagePublicId` (nếu có).
- Server đặt `result = null`, `imageUrl = null`, `annotatedImageUrl = null`, `imagePublicId = null`, `annotatedImagePublicId = null`, `palmLines = null`, `deletedAt = now`, rồi trả `204`.
- Reading bị **ẩn hẳn**: không còn trong `GET /readings`; `GET`/`DELETE /readings/{id}` trả `404`.
- Document vẫn được giữ, vì sổ cái credits tham chiếu tới nó.
- Không hoàn credit.

| Trường hợp | Response |
| --- | --- |
| Reading `DONE`, `REJECTED`, `FAILED` | `204` |
| Reading `PROCESSING` | `409 READING_IN_PROGRESS`; xoá lại sau khi xử lý xong |
| Không tồn tại, đã xoá, hoặc thuộc user khác | `404 NOT_FOUND` |

### POST /readings/guest

Endpoint công khai cho khách vãng lai bói thử 1 lần không cần đăng nhập. Xử lý đồng bộ, lưu ảnh lòng bàn tay & ảnh vẽ chỉ tay lên Cloudinary, và trả về bản xem trước 50% kết quả (`summary` và 2 sections đầu tiên mở; các phần còn lại bị khóa và gán `null` ở cấp server DTO để ngăn ngừa lộ dữ liệu qua DevTools).

**Header**

| Header | Bắt buộc | Ràng buộc |
| --- | --- | --- |
| `Idempotency-Key` | có | UUID v4, 36 ký tự |
| `Content-Type` | có | `multipart/form-data; boundary=...`, do trình duyệt tự đặt |
| `Cookie` | không | `ps_guest_trial=<signed_cookie>` nếu đã từng bói thử |

**Body (multipart/form-data)**

| Part | Kiểu | Bắt buộc | Ràng buộc |
| --- | --- | --- | --- |
| `school` | text | có | `WESTERN` \| `EASTERN` \| `VEDIC` |
| `hand` | text | có | `LEFT` \| `RIGHT` |
| `topics` | text | không | Các key cách nhau bởi dấu phẩy, ví dụ `lifeLine,headLine,career`. Mặc định bói toàn bộ |
| `fingerprint` | text | có | Chuỗi nhận diện thiết bị FingerprintJS (tối thiểu 16 ký tự) |
| `aiConsent` | text | có | Phải là `true` |
| `palmLines` | text (JSON) | không | Chuỗi JSON mảng `PalmLine[]` từ model ONNX |
| `image` | file | có | Đúng 1 file ảnh, ≤ 8 MB (JPEG/PNG/WebP/HEIC) |
| `annotatedImage` | file | không | Ảnh vùng lòng bàn tay đã vẽ đường chỉ tay từ model ONNX |

**Bảo vệ chống lạm dụng (`GuestTrialGuard` & `GuestTrialRateLimitGuard`)**
1. Kiểm tra cookie ký HMAC `ps_guest_trial` và hash SHA-256 của `fingerprint`: nếu đã từng có lượt thử thành công → chặn ngay với `403 GUEST_TRIAL_LIMIT_REACHED`.
2. Kiểm tra IP sliding rate limit: tối đa 5 lượt bói thử thành công/IP trong vòng 24 giờ → vượt quá trả `429 IP_TRIAL_LIMIT_EXCEEDED`.

### GET /readings/guest/{token}

Cho phép khách vãng lai xem lại bản xem trước 50% (bao gồm cả ảnh vẽ chỉ tay từ Cloudinary) trong thời hạn lưu trữ 7 ngày (`previewExpiresAt`).

- **Path**: `token` là UUID v4 `claimToken`.
- **Response**: `200 OK` trả về `GuestReadingPreviewDto`.
- **Lỗi**:
  - `404 NOT_FOUND`: Token không tồn tại, sai định dạng UUID v4, đã bị TTL index dọn dẹp sau 7 ngày, hoặc đã được tài khoản khác claim.
