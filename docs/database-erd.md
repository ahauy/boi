# database-erd — Cơ sở dữ liệu (MongoDB)

MongoDB 7, truy cập qua Mongoose (`@nestjs/mongoose`). Tên collection viết thường kiểu `snake_case`, tên field viết `camelCase`, `_id` là `ObjectId`, thời gian lưu kiểu `Date` (UTC).

Transaction nhiều document cần **replica set**: MongoDB Atlas (kể cả gói free M0) có sẵn; ở local, `docker-compose.yml` chạy MongoDB dạng replica set một node.

## Sơ đồ quan hệ

```mermaid
erDiagram
    users ||--o{ identities : "nhúng trong users"
    users ||--o{ sessions : "1 : N"
    users ||--o{ password_resets : "1 : N"
    users ||--o{ referrals : "referrerId 1 : N"
    users ||--o| referrals : "refereeId 1 : 1"
    users ||--o{ readings : "1 : N (userId null khi bói thử)"
    users ||--o{ guest_trials : "claimedByUserId 1 : 0..N"
    users ||--o{ credit_transactions : "1 : N"
    readings ||--o| guest_trials : "1 : 0..1"
    readings ||--o{ credit_transactions : "1 : 0..2"
    referrals ||--o| credit_transactions : "1 : 0..1"

    users {
        ObjectId _id PK
        string displayName
        string username UK "null"
        string email UK "null"
        string passwordHash "null"
        string referralCode UK
        int creditBalance "min 0"
        array identities
        Date createdAt
        Date deletedAt
    }
    pending_registrations {
        ObjectId _id PK
        string email UK
        string username UK
        string displayName
        string passwordHash
        string tokenHash UK
        string claimToken "null"
        Date expiresAt "TTL"
    }
    password_resets {
        ObjectId _id PK
        ObjectId userId FK
        string tokenHash UK
        Date expiresAt "TTL"
        Date usedAt
    }
    identities {
        string provider "GOOGLE | FACEBOOK"
        string providerUserId UK
        string email
        Date linkedAt
    }
    sessions {
        ObjectId _id PK
        ObjectId userId FK
        string refreshTokenHash UK
        Date expiresAt "TTL"
        Date revokedAt
    }
    referrals {
        ObjectId _id PK
        ObjectId referrerId FK
        ObjectId refereeId FK, UK
        string codeUsed
        string status
    }
    readings {
        ObjectId _id PK
        ObjectId userId FK "null"
        boolean isGuest
        string guestTokenHash "null"
        string idempotencyKey
        string school
        array topics
        string hand
        string status "GUEST_PREVIEW | PROCESSING | DONE | FAILED | REJECTED"
        string imageUrl "null"
        string annotatedImageUrl "null"
        string imagePublicId "null"
        string annotatedImagePublicId "null"
        array palmLines "null"
        object result
        Date previewExpiresAt "TTL"
        Date claimedAt "null"
        ObjectId claimedByUserId FK "null"
        Date deletedAt
    }
    guest_trials {
        ObjectId _id PK
        string fingerprintHash UK
        string ipHash
        string guestTokenHash UK
        ObjectId readingId FK
        boolean isClaimed
        ObjectId claimedByUserId FK "null"
        Date claimedAt "null"
        Date expiresAt "TTL"
        Date createdAt
    }
    credit_transactions {
        ObjectId _id PK
        ObjectId userId FK
        int amount "khác 0"
        string type
        int balanceAfter
        ObjectId readingId FK
        ObjectId referralId FK
    }
    deleted_identities {
        ObjectId _id PK
        string kind "EMAIL | GOOGLE | FACEBOOK"
        string valueHmac UK
        Date deletedAt
    }
```

`deleted_identities` cố ý không có liên kết tới `users`: nó chỉ chứa mã băm, không chỉ ra được tài khoản nào đã bị xoá.

`identities` không phải collection riêng mà là mảng nhúng trong `users`: mỗi user có 0–2 phần tử (Google, Facebook), và luôn được đọc cùng user. Đăng nhập bằng mật khẩu không phải một identity, mà là field `passwordHash` của user.

Mỗi user phải đăng nhập được bằng ít nhất một cách: có `passwordHash`, hoặc có ít nhất 1 identity. Riêng user đã bị xoá (`users:delete`) thì không còn cách nào.

## Đặc tả collection

### users

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `displayName` | string | bắt buộc, 1–50 ký tự | Người dùng nhập khi đăng ký, hoặc lấy từ Google/Facebook (dài quá thì cắt bớt) |
| `username` | string \| null | lowercase, `^[a-z0-9_]{3,20}$`, unique | Có khi user đăng ký bằng mật khẩu; `null` với user chỉ dùng Google/Facebook |
| `email` | string \| null | lowercase, unique | Luôn là email **đã xác minh** (qua link xác minh hoặc qua Google/Facebook). `null` nếu user chỉ có Facebook không trả email |
| `passwordHash` | string \| null | | argon2id. `null` nếu chưa đặt mật khẩu |
| `passwordUpdatedAt` | Date \| null | | |
| `avatarUrl` | string \| null | | Chỉ có khi lấy từ Google/Facebook |
| `referralCode` | string | 8 ký tự, unique | Mã của chính user để chia sẻ |
| `creditBalance` | int | bắt buộc, validator `minimum: 0` | Cache của sổ cái |
| `identities` | array | 0–2 phần tử | Xem bảng dưới |
| `referralBlocked` | boolean | bắt buộc, mặc định `false` | `true` khi user được tạo lại từ một định danh có trong `deleted_identities`: không được nhập mã giới thiệu. User loại này cũng không có `SIGNUP_BONUS` |
| `createdAt`, `updatedAt` | Date | | Mongoose `timestamps` |
| `deletedAt` | Date \| null | | Đánh dấu tài khoản đã bị xoá bằng script `users:delete` |

Phần tử của `identities`:

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `provider` | `GOOGLE` \| `FACEBOOK` | |
| `providerUserId` | string | `sub` của Google / `id` của Facebook |
| `email` | string \| null | Email provider trả về lúc liên kết |
| `linkedAt` | Date | |

Index:
- `{ referralCode: 1 }` unique.
- `{ "identities.provider": 1, "identities.providerUserId": 1 }` unique, để một tài khoản Google/Facebook chỉ thuộc một user.
- `{ email: 1 }` unique, `partialFilterExpression: { email: { $type: "string" } }`: mỗi email đã xác minh thuộc đúng một user; dùng khi gộp tài khoản và khi đăng nhập bằng email.
- `{ username: 1 }` unique, `partialFilterExpression: { username: { $type: "string" } }`.

User đã xoá có `email` và `username` là `null`, nên không chiếm chỗ trong hai index unique trên.

### pending_registrations

Đăng ký bằng email/mật khẩu **chưa xác minh**. User thật chỉ được tạo khi bấm link xác minh. Xem [ADR-0008](adr/0008-email-password-auth.md).

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `email` | string | bắt buộc, lowercase, unique | Mỗi email chỉ có một đăng ký chờ; đăng ký lại thì ghi đè |
| `username` | string | bắt buộc, lowercase, unique | Giữ chỗ username tới khi hết hạn |
| `displayName` | string | bắt buộc, 1–50 ký tự | |
| `passwordHash` | string | bắt buộc | argon2id |
| `referralCode` | string \| null | | Mã giới thiệu nhập lúc đăng ký; áp dụng khi xác minh |
| `tokenHash` | string | bắt buộc, unique | SHA-256 của token trong link; không lưu token thô |
| `claimToken` | string \| null | | UUID v4 của bài bói thử khách vãng lai mang theo khi đăng ký |
| `expiresAt` | Date | bắt buộc | 24 giờ sau lần gửi email gần nhất |
| `lastSentAt` | Date | | Dùng cho giới hạn gửi lại |
| `createdAt` | Date | | |

Index:
- `{ email: 1 }` unique, `{ username: 1 }` unique, `{ tokenHash: 1 }` unique.
- TTL `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`: MongoDB tự xoá đăng ký hết hạn, giải phóng username.

Khi đăng ký mới, username phải không trùng **cả** `users.username` lẫn `pending_registrations.username` của email khác.

### password_resets

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `userId` | ObjectId | bắt buộc, ref `users` | |
| `tokenHash` | string | bắt buộc, unique | SHA-256 của token trong link |
| `expiresAt` | Date | bắt buộc | 1 giờ |
| `usedAt` | Date \| null | | Đánh dấu đã dùng; token chỉ dùng được một lần |
| `createdAt` | Date | | |

Index:
- `{ tokenHash: 1 }` unique.
- `{ userId: 1 }`: huỷ token cũ khi tạo token mới.
- TTL `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`.

### sessions

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `userId` | ObjectId | bắt buộc, ref `users` | |
| `refreshTokenHash` | string | unique | SHA-256, không lưu token thô |
| `userAgent` | string \| null | | |
| `expiresAt` | Date | bắt buộc | 30 ngày |
| `revokedAt` | Date \| null | | Logout hoặc xoay vòng token |
| `createdAt` | Date | | |

Index:
- `{ refreshTokenHash: 1 }` unique.
- `{ userId: 1 }`.
- TTL `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`: MongoDB tự xoá session hết hạn.

### referrals

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `referrerId` | ObjectId | bắt buộc, ref `users` | Chủ mã |
| `refereeId` | ObjectId | bắt buộc, ref `users`, **unique** | Mỗi user chỉ nhập mã 1 lần |
| `codeUsed` | string | bắt buộc | |
| `status` | `REWARDED` \| `CAPPED` | bắt buộc | Xem [business-rules.md](business-rules.md) |
| `createdAt` | Date | | |

Index:
- `{ refereeId: 1 }` unique.
- `{ referrerId: 1, createdAt: -1 }`: liệt kê người đã mời và đếm lượt thưởng trong ngày.

### readings

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `userId` | ObjectId \| null | nullable khi bói thử | Bắt buộc đối với người dùng đăng nhập; `null` đối với khách vãng lai (`isGuest = true`) |
| `isGuest` | boolean | bắt buộc, mặc định `false` | `true` đối với bài bói thử của khách vãng lai |
| `guestTokenHash` | string \| null | | SHA-256 của `claimToken` dùng để khách xem lại hoặc mở khóa bài bói |
| `idempotencyKey` | string | bắt buộc, UUID v4 (36 ký tự) | Header `Idempotency-Key` của `POST /readings` hoặc `POST /readings/guest` |
| `school` | `WESTERN` \| `EASTERN` \| `VEDIC` | bắt buộc | Trường phái người dùng chọn, xem [ai-integration.md](ai-integration.md) |
| `topics` | string[] | bắt buộc, ≥ 1 phần tử | Các mục được bói (đã điền đủ khi chọn "Bói toàn bộ"), theo thứ tự chuẩn của trường phái |
| `hand` | `LEFT` \| `RIGHT` | bắt buộc | Người dùng chọn; AI không được đổi |
| `status` | `GUEST_PREVIEW` \| `PROCESSING` \| `DONE` \| `FAILED` \| `REJECTED` | bắt buộc | `GUEST_PREVIEW` = bài bói thử chờ claim; `REJECTED` = ảnh không phải lòng bàn tay |
| `imageUrl` | string \| null | | URL HTTPS trên Cloudinary của ảnh lòng bàn tay (đã xoá EXIF). Chỉ có khi `status` là `DONE` hoặc `GUEST_PREVIEW` ([ADR-0011](adr/0011-cloudinary-image-storage-and-onnx-palm-lines.md)) |
| `annotatedImageUrl` | string \| null | | URL HTTPS trên Cloudinary của ảnh lòng bàn tay đã vẽ đè các đường chỉ tay bởi model ONNX |
| `imagePublicId` | string \| null | | `public_id` trên Cloudinary của ảnh gốc; dùng để xoá ảnh khỏi Cloudinary khi xoá reading hoặc xoá tài khoản (không trả ra API) |
| `annotatedImagePublicId` | string \| null | | `public_id` trên Cloudinary của ảnh đã vẽ chỉ tay (không trả ra API) |
| `palmLines` | array \| null | | Danh sách các đường chỉ tay (`life`, `head`, `heart`, `other`) kèm tọa độ `points` và đặc trưng hình học do model `palm_lines.onnx` trích xuất |
| `result` | object \| null | | `PalmResult`, theo schema ở [ai-integration.md](ai-integration.md) |
| `rejectReason` | string \| null | | |
| `aiProvider`, `aiModel` | string \| null | | Phục vụ debug, đổi model |
| `errorCode` | string \| null | | |
| `latencyMs` | int \| null | | |
| `previewExpiresAt` | Date \| null | | Hạn 7 ngày cho bài bói thử khách vãng lai. Xóa về `null` sau khi được claim |
| `claimedAt` | Date \| null | | Thời điểm người dùng kích hoạt tài khoản và nhận lại bài bói |
| `claimedByUserId` | ObjectId \| null | ref `users` | Tài khoản đã mở khóa bài bói |
| `createdAt`, `completedAt` | Date | | |
| `deletedAt` | Date \| null | | Người dùng xoá reading: xoá ảnh trên Cloudinary, đặt `result = null`, `imageUrl = null`, `annotatedImageUrl = null`, `palmLines = null`, ẩn khỏi API. Document được giữ vì sổ cái tham chiếu tới nó |

Index:
- `{ userId: 1, idempotencyKey: 1 }` unique, `partialFilterExpression: { userId: { $type: "objectId" } }`.
- `{ guestTokenHash: 1 }`: tra cứu nhanh bài bói thử khách vãng lai.
- TTL `{ previewExpiresAt: 1 }, { expireAfterSeconds: 0 }`: tự động dọn dẹp các bài bói thử không được claim sau 7 ngày.
- `{ userId: 1, createdAt: -1 }`: trang lịch sử; truy vấn luôn lọc `deletedAt: null`.
- `{ status: 1, createdAt: 1 }`: tìm reading kẹt ở `PROCESSING`.

### guest_trials

Bản ghi dấu vết phiên bói thử của khách vãng lai nhằm kiểm soát tần suất, chống lạm dụng gọi AI và hỗ trợ claim khi đăng ký.

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `fingerprintHash` | string | bắt buộc, unique | SHA-256 của FingerprintJS chuỗi nhận diện thiết bị |
| `ipHash` | string | bắt buộc | SHA-256 của địa chỉ IP client |
| `guestTokenHash` | string | bắt buộc, unique | SHA-256 của `claimToken` |
| `readingId` | ObjectId | bắt buộc, ref `readings` | Bài bói thử tương ứng |
| `isClaimed` | boolean | bắt buộc, mặc định `false` | Đánh dấu đã được mở khóa qua đăng ký hay chưa |
| `claimedByUserId` | ObjectId \| null | ref `users` | Tài khoản đã nhận bài bói |
| `claimedAt` | Date \| null | | Thời điểm mở khóa |
| `expiresAt` | Date | bắt buộc | 7 ngày sau khi bói thử |
| `createdAt` | Date | | |

Index:
- `{ fingerprintHash: 1 }` unique: mỗi thiết bị chỉ được 1 lượt bói thử miễn phí.
- `{ guestTokenHash: 1 }` unique.
- `{ ipHash: 1, createdAt: -1 }`: kiểm tra giới hạn trượt (tối đa 5 lượt/IP/24h).
- TTL `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`: MongoDB tự động xóa bản ghi sau 7 ngày.

### credit_transactions

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | ObjectId tăng dần theo thời gian, dùng làm cursor phân trang |
| `userId` | ObjectId | bắt buộc, ref `users` | |
| `amount` | int | bắt buộc, khác 0 | Dương = cộng, âm = trừ |
| `type` | `SIGNUP_BONUS` \| `REFERRAL_BONUS` \| `REFEREE_BONUS` \| `READING_SPEND` \| `READING_REFUND` \| `ADMIN_ADJUST` | bắt buộc | |
| `balanceAfter` | int | bắt buộc | Số dư sau giao dịch |
| `readingId` | ObjectId | ref `readings` | Chỉ có với `READING_*` |
| `referralId` | ObjectId | ref `referrals` | Chỉ có với `REFERRAL_BONUS` (của chủ mã) và `REFEREE_BONUS` (của người nhập) |
| `note` | string | | Bắt buộc với `ADMIN_ADJUST` |
| `createdAt` | Date | | |

Collection này chỉ thêm document mới, không sửa, không xoá.

Index:
- `{ userId: 1, _id: -1 }`: lịch sử credits.
- `{ userId: 1, type: 1 }` unique, `partialFilterExpression: { type: "SIGNUP_BONUS" }`: mỗi user chỉ nhận bonus đăng ký một lần.
- `{ readingId: 1, type: 1 }` unique, `partialFilterExpression: { readingId: { $exists: true } }`: mỗi reading tối đa 1 lần trừ, 1 lần hoàn.
- `{ referralId: 1, type: 1 }` unique, `partialFilterExpression: { referralId: { $exists: true } }`: mỗi referral tối đa 1 lần thưởng chủ mã và 1 lần thưởng người nhập.

### deleted_identities

Định danh của các tài khoản đã bị xoá theo yêu cầu, dùng để tài khoản tạo lại không nhận thưởng lần nữa. Xem [ADR-0009](adr/0009-manual-account-deletion.md).

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | | |
| `kind` | `EMAIL` \| `GOOGLE` \| `FACEBOOK` | bắt buộc | |
| `valueHmac` | string | bắt buộc | HMAC-SHA256 (hex) của `kind + ":" + giá trị`, khoá là `IDENTITY_HASH_SECRET`. Giá trị là email chữ thường, Google `sub` hoặc Facebook `id` |
| `deletedAt` | Date | bắt buộc | |

Index:
- `{ valueHmac: 1 }` unique.

Khi tạo user (xác minh email, hoặc lần đầu Google/Facebook), server tính HMAC cho mọi định danh của user đó. Nếu có cái nào nằm trong bảng này: không cộng `SIGNUP_BONUS`, và đặt `referralBlocked = true`. Gắn thêm định danh vào user có sẵn thì không kiểm tra bảng này.

Collection này giữ vô thời hạn; không bao giờ xoá.

## Quản lý index

MongoDB không có migration schema như SQL. Index và validator được khai báo trong schema Mongoose và tạo bằng script `pnpm --filter backend db:sync-indexes`, chạy mỗi lần deploy. Không bật `autoIndex` ở production.
