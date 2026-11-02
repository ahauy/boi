# business-rules — Credits & mã giới thiệu

## Quy tắc credits

Mọi thay đổi credits đều ghi một document vào sổ cái `credit_transactions`; `users.creditBalance` chỉ là số dư cache, luôn cập nhật trong cùng MongoDB transaction với document sổ cái.

| `type` | Khi nào phát sinh | Credits | Người nhận | Điều kiện |
| --- | --- | --- | --- | --- |
| `SIGNUP_BONUS` | User được tạo: khi bấm link xác minh email đăng ký, hoặc lần đầu đăng nhập Google/Facebook. Đăng ký chưa xác minh không có credits | +3 | Người dùng mới | 1 lần/tài khoản (unique index). **Không** cộng nếu tài khoản được tạo lại từ email/Google/Facebook đã bị xoá |
| `REFERRAL_BONUS` | Người khác nhập mã giới thiệu hợp lệ | +2 | Chủ mã (referrer) | Cộng ngay khi nhập mã; qua đủ kiểm tra ở mục dưới; tối đa `REFERRAL_DAILY_CAP` lượt/ngày |
| `REFEREE_BONUS` | Mình nhập mã giới thiệu hợp lệ của người khác | +1 | Người nhập mã (referee) | Cộng ngay khi nhập mã; một lần/tài khoản. **Không** bị ảnh hưởng bởi trần của chủ mã |
| `READING_SPEND` | Bắt đầu một lần xem bói | −1 | Người xem | `creditBalance >= 1` |
| `READING_REFUND` | AI lỗi, timeout hoặc trả sai định dạng; ảnh không phải lòng bàn tay (người dùng không mất credit) | +1 | Người xem | Tối đa 1 lần cho mỗi reading |
| `REWARDED_AD` | Người dùng xem trọn một rewarded ad và Google xác minh bằng callback có chữ ký | +1 | Người xem | Tối đa `REWARDED_AD_DAILY_CAP` lượt/24 giờ/tài khoản |
| `ADMIN_ADJUST` | Dev cộng/trừ tay bằng script (không có trang admin) | ±n | Bất kỳ | Bắt buộc có `note` |

**Hằng số cấu hình** (đọc từ env, không hard-code):

| Biến | Giá trị mặc định |
| --- | --- |
| `SIGNUP_BONUS_CREDITS` | 3 |
| `REFERRAL_REWARD_CREDITS` | 2 |
| `REFEREE_REWARD_CREDITS` | 1 |
| `READING_COST_CREDITS` | 1 |
| `REFERRAL_DAILY_CAP` | 10 |
| `REWARDED_ADS_ENABLED` | `false` |
| `REWARDED_AD_REWARD_CREDITS` | 1 |
| `REWARDED_AD_DAILY_CAP` | 3 |
| `REWARDED_AD_INTENT_TTL_MS` | 600000 |

## Quảng cáo thưởng (rewarded ads)

Credit chỉ là phần thưởng khi người dùng **chủ động** xem quảng cáo, nên luồng phải chịu được hai
điều: client nói dối "đã xem xong", và Google gửi callback trùng lặp. Thiết kế theo đó.

| # | Bước | Nội dung |
| --- | --- | --- |
| 1 | `POST /ads/rewarded/intent` (cần đăng nhập) | Server cấp `nonce` một lần, snapshot mức thưởng, kiểm tra trần 24 giờ **ngay tại đây**. App đưa nonce vào `serverSideVerificationOptions.userId` của AdMob |
| 2 | User xem quảng cáo | App không cộng credit ở bước này, dù SDK báo `onUserEarnedReward` |
| 3 | Google gọi `GET /ads/rewarded/verify` | Server xác minh chữ ký ECDSA P-256/SHA-256 trên chính query string (bỏ `signature` và `key_id`, sắp xếp theo tên tham số, giá trị đã giải mã), khoá public tải từ `gstatic.com/admob/reward/verifier-keys.json` theo `key_id` |
| 4 | Cộng credit | `findOneAndUpdate` với điều kiện `status = ISSUED` và `expiresAt > now`, rồi ghi `CreditTransaction` — tất cả trong một MongoDB transaction |
| 5 | `GET /ads/rewarded/status` | App polling kết quả này tới 20 giây để báo cho user; hết thời gian thì hẹn "đang chờ xác nhận" |

**Vì sao bắt buộc xác minh phía server**: nếu app tự báo hoàn thành thì chỉ cần một request giả là
nhận credit miễn phí, mà mỗi credit lại là một lần gọi AI tốn tiền thật. Vì chữ ký do Google tạo,
client không thể tự ký lại.

**Chống phát lại**: `nonce` unique, `transaction_id` unique, và index unique
`{ adClaimId: 1, type: 1 }` trên `credit_transactions`. Callback lặp lại của Google trả `200` nhưng
không cộng thêm.

**Quy tắc trần 24 giờ**: đếm theo `createdAt` của claim trong 24 giờ trượt (không phải ngày lịch),
tính cả claim đã dùng lẫn claim đã hết hạn. Claim hết hạn vẫn chiếm suất vì người dùng đã được phát
cho một lượt xem.

**Fail closed**: thiếu chữ ký, sai chữ ký, `key_id` lạ không tải được khoá, `reward_item` không phải
`palmsight-credit` — mọi trường hợp đều **không** cộng credit.

`REWARDED_ADS_ENABLED=false` (mặc định) làm `/ads/rewarded/availability` trả `enabled: false`, app
ẩn toàn bộ lời đề nghị, và `POST /ads/rewarded/intent` trả 404. Bật/tắt không cần bản build mới.

**Quy tắc khác**

- Credits **không hết hạn**.
- MVP **không bán** credits.
- Mỗi lần xem tốn đúng 1 credit, dù chọn trường phái nào và dù bói 1 mục hay toàn bộ.
- Email/mật khẩu, Google và Facebook có cùng email đã xác minh → **gộp thành một tài khoản**, chỉ nhận `SIGNUP_BONUS` một lần. Thứ tự đăng ký trước sau không quan trọng. Chi tiết ở [ADR-0008](adr/0008-email-password-auth.md).
- **Không có tính năng tự xoá tài khoản.** Người dùng gửi yêu cầu xoá qua email; dev xoá bằng script `users:delete`. Xem [ADR-0009](adr/0009-manual-account-deletion.md).
  - Khi xoá, email và ID Google/Facebook được ghi vào `deleted_identities` dạng HMAC.
  - Đăng ký lại hoặc đăng nhập lại bằng một định danh đã bị xoá vẫn tạo được tài khoản mới, nhưng bắt đầu với **0 credits** (không `SIGNUP_BONUS`) và **không được nhập mã giới thiệu**.
  - Mục đích: chặn vòng xoá–đăng ký lại để farm +3 và +1/+2.
- Chỉnh credits tay: `pnpm --filter backend credits:adjust --user <id> --amount <n> --note "<lý do>"`, script này cũng đi qua `CreditLedgerService`.

**Mã giới thiệu**: 8 ký tự in hoa, bảng chữ bỏ ký tự dễ nhầm (`0 O 1 I L`), sinh ngẫu nhiên khi tạo user, unique. Link chia sẻ `https://<domain>/r/<CODE>` lưu mã vào cookie `ref_code` (7 ngày), rồi chuyển tới trang đăng ký. Mã được nhập theo một trong hai cách:

- **Đăng ký bằng email:** ô "Mã giới thiệu" trên form được điền sẵn. Gửi form coi như đã xác nhận; mã được áp dụng ngay khi xác minh email.
- **Google/Facebook:** sau khi đăng nhập lần đầu, ô nhập mã ở `/referral/enter` được điền sẵn và người dùng bấm xác nhận.

Người dùng có thể nhập mã **bất cứ lúc nào**, nhưng chỉ **một lần**.

## Kiểm tra khi nhập mã giới thiệu

Các kiểm tra chạy theo thứ tự; kiểm tra đầu tiên thất bại quyết định mã lỗi trả về.

| # | Kiểm tra | Thất bại thì | Mã lỗi / trạng thái |
| --- | --- | --- | --- |
| 1 | Tài khoản được phép nhập mã (không phải tài khoản tạo lại từ định danh đã xoá) | Từ chối | `REFERRAL_NOT_ALLOWED` (403) |
| 2 | Mã tồn tại | Từ chối | `REFERRAL_CODE_NOT_FOUND` (404) |
| 3 | Không phải mã của chính mình | Từ chối | `REFERRAL_SELF` (422) |
| 4 | Tài khoản chưa từng nhập mã (unique `referrals.refereeId`) | Từ chối | `REFERRAL_ALREADY_USED` (409) |
| 5 | Chủ mã không phải người do mình giới thiệu (chặn hai người nhập mã của nhau) | Từ chối | `REFERRAL_CYCLE` (422) |
| 6 | Chủ mã chưa nhận đủ `REFERRAL_DAILY_CAP` lượt thưởng trong ngày (theo giờ Việt Nam) | Vẫn ghi nhận; người nhập **+1**, chủ mã không được cộng | `status = CAPPED` |
| — | Qua tất cả | Người nhập **+1**, chủ mã **+2**, cộng ngay | `status = REWARDED` |

Ghi `referrals` và cộng credits cho cả hai người chạy trong **một** MongoDB transaction: hoặc cả hai cùng được cộng, hoặc không ai được.

| Trạng thái | Người nhập mã | Chủ mã |
| --- | --- | --- |
| `REWARDED` | +1 (`REFEREE_BONUS`) | +2 (`REFERRAL_BONUS`) |
| `CAPPED` | +1 (`REFEREE_BONUS`) | 0 |

Thưởng +1 để người nhập có lý do nhập mã của bạn bè. Không tạo thêm cách farm mới: tài khoản ảo tự nhập mã của chính mình thì +1 rơi vào tài khoản ảo, còn chủ mã vẫn bị giới hạn bởi trần 10 lượt/ngày.

Trần 10 lượt/ngày là trần mềm: hai lượt nhập đúng cùng lúc có thể cùng được tính là lượt thứ 10. Với dự án nhỏ, chấp nhận sai lệch này thay vì thêm cơ chế khoá.

## Quy tắc toàn vẹn (MongoDB)

- Mọi thao tác credits chạy trong **MongoDB transaction** (cần replica set; MongoDB Atlas và cấu hình docker local đều đáp ứng).
- Số dư không bao giờ âm:
  - Trừ bằng một lệnh có điều kiện: `updateOne({ _id, deletedAt: null, creditBalance: { $gte: 1 } }, { $inc: { creditBalance: -1 } })`.
  - Nếu `modifiedCount = 0` → trả `INSUFFICIENT_CREDITS` (402). Auth guard đã chặn user không tồn tại hoặc đã xoá từ trước, nên ở bước này `modifiedCount = 0` chỉ còn nghĩa là hết credits.
  - Collection `users` có thêm validator `creditBalance: { minimum: 0 }`.
- **Cộng credits phải trúng đúng một user:** lệnh cộng dùng `updateOne({ _id, deletedAt: null }, { $inc: ... })`, sau đó kiểm tra `matchedCount === 1`.
  - Nếu là 0: ném lỗi → transaction rollback → không ghi giao dịch vào sổ cái.
  - Lý do: MongoDB không có khoá ngoại, lệnh `updateOne` trúng 0 document không báo lỗi. Thiếu kiểm tra này thì sổ cái sẽ có giao dịch cho user không tồn tại, trong khi không số dư nào thay đổi.
  - Áp dụng cho mọi loại cộng: `SIGNUP_BONUS`, `REFERRAL_BONUS`, `REFEREE_BONUS`, `READING_REFUND`, `ADMIN_ADJUST`.
  - Riêng `READING_REFUND` cho user đã bị xoá thì bỏ qua, chỉ đánh dấu reading là `FAILED`.
- Unique index chặn cộng/hoàn trùng: `SIGNUP_BONUS` theo user, `(readingId, type)`, `(referralId, type)`. Chi tiết ở [database-erd.md](database-erd.md).
- `POST /readings` bắt buộc header `Idempotency-Key`. Gửi lại cùng key không bao giờ trừ thêm credit:
  - reading cũ đang `PROCESSING` → `409 READING_IN_PROGRESS`;
  - reading cũ đã xong → trả lại kết quả cũ.

  Chi tiết ở [api-contract.md](api-contract.md#post-readings).
- Tổng `amount` trong `credit_transactions` của một user phải luôn bằng `users.creditBalance`; script `credits:reconcile` kiểm tra điều này.
- **Không sửa hay xoá trực tiếp trên database** các collection `users`, `credit_transactions`, `referrals`, `readings`. Mọi thay đổi đi qua API hoặc script (`credits:adjust`, `users:delete`). Script `db:check` phát hiện dữ liệu mồ côi nếu quy tắc này từng bị vi phạm. Xem [deployment.md](deployment.md#vận-hành).
