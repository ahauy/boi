# testing — Chiến lược kiểm thử

Ưu tiên test nơi sai sót làm cộng/trừ credits sai: sổ cái, xem bói, mã giới thiệu. UI và nội dung AI được test ở mức vừa đủ.

## Các tầng test

| Tầng | Công cụ | Phạm vi | Chạy khi |
| --- | --- | --- | --- |
| Unit | Vitest | Hàm thuần: sinh mã giới thiệu, kiểm tra quy tắc referral, map lỗi, Yup schema `PalmResult` & `PalmLine` cho từng trường phái, mọi trường phái trong `READING_SCHOOLS` đều có prompt chứa đủ key mục riêng | Mỗi commit |
| Integration | Vitest + `mongodb-memory-server` (`MongoMemoryReplSet`) + Supertest | Service và endpoint NestJS với MongoDB thật chạy trong bộ nhớ; AI, Cloudinary, OAuth và `MailService` được mock. Mock mail giữ email đã gửi trong bộ nhớ, để test lấy token từ link | Mỗi PR |
| E2E | Playwright (viewport điện thoại) | Luồng chính trên trình duyệt: đăng ký → lấy link xác minh từ Mailpit API → đăng nhập bằng mật khẩu → xem bói. Google/Facebook dùng provider giả ở môi trường test | Trước khi merge vào `main` |
| AI eval | Script thủ công + bộ ảnh mẫu | Chất lượng và an toàn nội dung bói + độ chính xác vẽ chỉ tay ONNX | Khi đổi prompt, model hoặc thêm trường phái |

Test integration phải dùng `MongoMemoryReplSet` (replica set), không dùng `MongoMemoryServer` đơn lẻ. Lý do: transaction chỉ chạy trên replica set. Ngoài ra unique index phải được tạo trước khi chạy test (`syncIndexes()`).

## Ca test bắt buộc

### Credits

- [ ] User mới có đúng 3 credits và 1 document `SIGNUP_BONUS`.
- [ ] Đăng nhập lại, hoặc gắn thêm provider thứ hai, không cộng thêm.
- [ ] Xem bói thành công: số dư −1, có `READING_SPEND`, `balanceAfter` đúng.
- [ ] Số dư 0 → `402`, không tạo reading.
- [ ] **20 request `POST /readings` song song khi số dư 1 → đúng 1 thành công.**
- [ ] Gửi lại cùng `Idempotency-Key`:
  - reading cũ `DONE`/`REJECTED` → `200` + `Idempotent-Replayed: true`;
  - reading cũ `FAILED` → `503` với cùng `details`;
  - reading cũ `PROCESSING` → `409 READING_IN_PROGRESS`.

  Không trường hợp nào trừ thêm credit; body khác lần đầu vẫn bị bỏ qua.
- [ ] Sau `503 AI_UNAVAILABLE`, gửi key mới → tạo reading mới, trừ 1 credit mới.
- [ ] AI timeout / 5xx / sai schema 2 lần → `FAILED`, hoàn 1 credit, đúng 1 document `READING_REFUND`.
- [ ] `isPalm = false` → `REJECTED`, hoàn 1 credit, không upload ảnh lên Cloudinary.
- [ ] Dọn reading kẹt `PROCESSING` hoàn credit đúng 1 lần, kể cả khi hai lần dọn chạy chồng nhau.
- [ ] Sau mọi ca trên: tổng `amount` = `creditBalance`.
- [ ] `CreditLedgerService` cộng credits cho `userId` không tồn tại, hoặc user có `deletedAt` → ném lỗi, transaction rollback, **không** có document `credit_transactions` nào được ghi.
- [ ] Hoàn credit cho reading của user đã bị xoá → reading thành `FAILED`, không ghi `READING_REFUND`, không lỗi.

### User không còn tồn tại

- [ ] Access token còn hạn của user vừa bị `users:delete` → mọi endpoint cần đăng nhập trả `401 UNAUTHENTICATED`.
- [ ] Xoá thẳng document user trong database, rồi gọi `GET /me`, `POST /readings`, `POST /me/referral` bằng access token còn hạn → `401`, **không** phải `500`, và không ghi thêm dữ liệu nào.
- [ ] `/auth/refresh` với session của user đã xoá (bằng script hoặc xoá thẳng) → `401`, session bị thu hồi.
- [ ] Chủ mã có người được giới thiệu đã bị xoá thẳng → `GET /me/referrals` hiện "Người dùng đã xoá", trả `200`.
- [ ] `db:check` trên dữ liệu có user bị xoá thẳng → báo đúng các giao dịch, reading, session, referral mồ côi, và trả exit code khác 0. Trên dữ liệu sạch → exit code 0.

### Referral

- [ ] Mã hợp lệ → `REWARDED`; người nhập +1 (`REFEREE_BONUS`), chủ mã +2 (`REFERRAL_BONUS`); cả hai giao dịch có cùng `referralId`; response có `creditsEarned = 1` và `creditBalance` đúng.
- [ ] Chủ mã đã đủ 10 lượt trong ngày → `CAPPED`; người nhập **vẫn +1**, chủ mã không đổi.
- [ ] Lỗi giữa chừng khi cộng cho một bên → transaction rollback: không có referral, không ai được cộng.
- [ ] Tài khoản `referralBlocked = true` nhập mã → `403 REFERRAL_NOT_ALLOWED`; `GET /me` trả `canEnterCode = false`.
- [ ] Mỗi mã lỗi trong [business-rules.md](business-rules.md) trả đúng HTTP status và `code`.
- [ ] Nhập mã sau khi tạo tài khoản lâu (ví dụ 30 ngày) vẫn được chấp nhận.
- [ ] **Một user gửi 10 request nhập mã song song → chỉ 1 referral được tạo.**
- [ ] Lượt thứ 11 trong ngày (giờ Việt Nam) → `CAPPED`, không cộng; sang ngày mới lại được cộng.

### Trường phái bói

- [ ] `school` không hợp lệ → `400 VALIDATION_ERROR`, không trừ credit.
- [ ] `topics` bỏ trống → `readings.topics` chứa đủ mọi mục của trường phái + 6 khía cạnh, theo thứ tự chuẩn.
- [ ] `topics` chọn 1 mục → kết quả chỉ có đúng mục đó; giá vẫn 1 credit.
- [ ] `topics` chọn theo thứ tự lộn xộn hoặc trùng lặp → được chuẩn hoá về thứ tự chuẩn, bỏ trùng.
- [ ] `topics` có mục của trường phái khác (ví dụ `nguHanh` với `WESTERN`) hoặc key lạ → `400 VALIDATION_ERROR`, không trừ credit.
- [ ] Kết quả AI thiếu mục được chọn, hoặc thừa mục không được chọn → coi là sai schema (gọi lại, rồi `FAILED` + hoàn).
- [ ] `result.school` khác `school` trong request → sai schema.
- [ ] Thiếu `hand`, hoặc `hand` không phải `LEFT`/`RIGHT` → `400`. AI trả `hand` khác → `result.hand` vẫn là giá trị người dùng chọn.
- [ ] Thiếu `aiConsent` hoặc khác `true` → `400`, không trừ credit.
- [ ] Multipart có part lạ hoặc vượt số file quy định → `400`, không trừ credit.

### Xoá reading

- [ ] `DELETE /readings/{id}` → `204`; gọi xoá ảnh trên Cloudinary (`imagePublicId`), đặt `result = null`, `imageUrl = null`, `annotatedImageUrl = null`, `palmLines = null`; reading biến mất khỏi `GET /readings`; `GET`/`DELETE` lần sau trả `404`.
- [ ] Xoá reading đang `PROCESSING` → `409 READING_IN_PROGRESS`.
- [ ] Xoá reading không hoàn credit; giao dịch `READING_SPEND` vẫn còn trong lịch sử credits.

### Đăng ký và đăng nhập bằng mật khẩu

- [ ] Đăng ký → `202`, có 1 email trong Mailpit, **chưa** có document `users`, chưa có credits.
- [ ] Đăng nhập trước khi xác minh với đúng mật khẩu → `403 EMAIL_NOT_VERIFIED`; sai mật khẩu → `401 INVALID_CREDENTIALS`.
- [ ] Bấm link → user được tạo, đúng 3 credits, 1 `SIGNUP_BONUS`, `isNewUser = true`; dùng lại link → `400 VERIFICATION_TOKEN_INVALID`.
- [ ] **Bấm link xác minh 2 lần song song → chỉ tạo 1 user, 1 `SIGNUP_BONUS`.**
- [ ] Link quá 24 giờ → `400`; đăng ký chờ bị TTL xoá, username được giải phóng.
- [ ] Đăng ký lại cùng email trước khi xác minh → link cũ hết hiệu lực, link mới dùng được.
- [ ] Username trùng user khác, hoặc trùng đăng ký chờ của email khác → `409 USERNAME_TAKEN`. Email thuộc user đã có mật khẩu → `409 EMAIL_TAKEN`.
- [ ] Đăng nhập được bằng email và bằng username; viết hoa/thường hay thêm khoảng trắng hai đầu đều được.
- [ ] Sai mật khẩu 5 lần → lần thứ 6 (kể cả đúng mật khẩu) → `429`.
- [ ] `login`, `forgot-password`, `resend-verification` trả cùng một response dù email có tồn tại hay không.
- [ ] Mật khẩu < 8 ký tự, hoặc trùng email/username → `400 VALIDATION_ERROR`.
- [ ] Đăng ký có `referralCode` hợp lệ → sau khi xác minh, user có 4 credits (3 + 1), chủ mã +2, `canEnterCode = false`; response xác minh trả `creditBalance = 4`. Mã không tồn tại → user vẫn được tạo với 3 credits, `canEnterCode = true`.
- [ ] Quên mật khẩu → đặt lại → mọi phiên cũ bị thu hồi; link dùng lần 2 → `400 RESET_TOKEN_INVALID`.
- [ ] Đổi mật khẩu sai mật khẩu cũ → `400 CURRENT_PASSWORD_INCORRECT`; đúng → phiên khác bị thu hồi, phiên hiện tại vẫn refresh được.

### Gộp tài khoản

- [ ] User mật khẩu `a@x.com` đăng nhập Google cùng email → gắn Google vào user đó, không cộng credits.
- [ ] User Google `a@x.com` đăng ký mật khẩu cùng email → `202`; xác minh → gắn username + mật khẩu vào user Google, `isNewUser = false`, không cộng credits.
- [ ] User Google dùng "Quên mật khẩu" → đặt được mật khẩu, đăng nhập được bằng email.
- [ ] Đăng ký chờ `a@x.com` (chưa xác minh), rồi đăng nhập Google `a@x.com` → tạo user Google; xác minh sau đó → mật khẩu gắn vào user Google, tổng chỉ 3 credits.
- [ ] Facebook không trả email → luôn tạo user riêng, không gộp.

### Auth

- [ ] Google ID token sai `aud` / hết hạn → `401 OAUTH_INVALID_TOKEN`.
- [ ] Facebook token của app khác → `401`.
- [ ] Refresh token dùng lại sau khi đã xoay → thu hồi mọi phiên.
- [ ] `/auth/refresh` với `Origin` lạ → `403 ORIGIN_NOT_ALLOWED`.
- [ ] Mã giới thiệu viết thường hoặc có khoảng trắng hai đầu vẫn được chấp nhận; mã sai định dạng → `404 REFERRAL_CODE_NOT_FOUND`.
- [ ] Không có route `DELETE /me` (trả `404`).

### Xoá tài khoản theo yêu cầu (`users:delete`)

- [ ] Script xoá ảnh trên Cloudinary, xoá kết quả, mật khẩu, identity, session; ẩn danh hoá user; sổ cái credits còn nguyên; tổng `amount` vẫn bằng `creditBalance`.
- [ ] Script ghi HMAC của email và mọi ID Google/Facebook vào `deleted_identities`; không lưu giá trị gốc.
- [ ] Đăng ký lại cùng email → xác minh → user mới, `isNewUser = true`, **0 credits**, `referralBlocked = true`, không có `SIGNUP_BONUS`.
- [ ] Đăng nhập lại cùng Google/Facebook → như trên.
- [ ] Đăng ký lại với email mới hoàn toàn → 3 credits bình thường.
- [ ] Mã giới thiệu của tài khoản đã xoá → `404 REFERRAL_CODE_NOT_FOUND`.
- [ ] User A không đọc/xoá được reading của user B: trả `404` chứ không phải `403`, để không lộ là reading đó có tồn tại.

### Ảnh & Lưu trữ Cloudinary

- [ ] File > 8 MB → `413`; file `.jpg` nhưng nội dung không phải ảnh → `415`.
- [ ] Ảnh gửi cho AI và upload lên Cloudinary không còn EXIF.
- [ ] Sau `POST /readings` thành công (`DONE`), không có file tạm nào được ghi ra ổ đĩa local của server; ảnh được upload lên Cloudinary và trả về `imageUrl` / `annotatedImageUrl` cùng `palmLines` ([ADR-0011](adr/0011-cloudinary-image-storage-and-onnx-palm-lines.md)).

## Mock AI

`AiProvider` có bản `FakeAiProvider` cho test. Kết quả trả về được chọn bằng cấu hình: `ok` (đúng schema của trường phái được yêu cầu), `not_palm`, `timeout`, `http_429`, `http_500`, `invalid_json`. Không gọi Gemini/Groq hay Cloudinary thật trong CI.

## Đánh giá AI

Bộ ảnh mẫu đặt trong `backend/test/fixtures/palms/`. Chỉ dùng ảnh tay của thành viên dự án hoặc ảnh có quyền sử dụng; repo công khai nên không đưa ảnh người khác vào. Bộ mẫu gồm:

- Tay trái, tay phải.
- Ảnh tối, ảnh mờ.
- Ảnh không phải tay.
- Ảnh có chữ chèn lệnh.

Mỗi lần đổi prompt/model, chạy script đánh giá cho **cả 3 trường phái** và kiểm tra thủ công:

- Tỉ lệ JSON hợp lệ.
- Trả đúng các mục được chọn, không thiếu, không thừa (thử cả bói 1 mục và bói toàn bộ).
- Bói toàn bộ không bị cắt ngang vì vượt `AI_MAX_TOKENS`.
- Nội dung đúng tinh thần trường phái (ví dụ phương Đông phải nói về ngũ hành, không nói về 4 nguyên tố).
- Nhận đúng ảnh không phải tay.
- Không có nội dung bị cấm.
- Không làm theo chữ trong ảnh.
- Độ trễ trung bình.

## CI

GitHub Actions, mỗi PR chạy lần lượt:

1. `pnpm install --frozen-lockfile`
2. `lint`
3. `typecheck`
4. `test` (integration dùng `mongodb-memory-server`, không cần service container)
5. `build`

E2E chạy trên PR vào `main`. Repo công khai nên GitHub Actions miễn phí.
