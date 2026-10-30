# Đóng góp cho PalmSight

Dự án có 2 thành viên chính. Mọi người đều có thể mở issue hoặc PR.

## Trước khi bắt đầu

1. Đọc [CONTEXT.md](CONTEXT.md), nhất là mục **Quy tắc bất biến**.
2. Cài môi trường theo [docs/getting-started.md](docs/getting-started.md).
3. Thay đổi nghiệp vụ (credits, referral, trường phái bói, API contract, schema MongoDB) phải sửa tài liệu trong `docs/` **cùng PR** với code.

## Nhánh

- `main`: luôn chạy được, chỉ nhận merge qua PR.
- Nhánh làm việc: `<loại>/<mô-tả-ngắn>`, ví dụ `feat/referral-code`, `fix/refund-on-timeout`, `docs/api-contract-errors`.

## Commit

Theo [Conventional Commits](https://www.conventionalcommits.org/), viết bằng tiếng Anh:

```text
<type>(<scope>): <mô tả ngắn, thì hiện tại>

feat(credits): add READING_REFUND on AI timeout
fix(auth): reject Facebook token issued for another app
docs(api): document REFERRAL_CYCLE error
```

| `type` | Dùng khi |
| --- | --- |
| `feat` | Thêm tính năng |
| `fix` | Sửa lỗi |
| `docs` | Chỉ sửa tài liệu |
| `refactor` | Đổi cấu trúc code, không đổi hành vi |
| `test` | Thêm/sửa test |
| `chore` | Build, dependency, cấu hình |

`scope` gợi ý: `frontend`, `backend`, `auth`, `credits`, `referrals`, `readings`, `ai`, `db`, `shared`.

## Pull request

- Một PR một mục đích, càng nhỏ càng dễ review.
- Điền [template PR](.github/pull_request_template.md).
- CI phải xanh: lint, typecheck, test.
- **Người còn lại review** trước khi merge. PR đụng vào `credits/` hoặc `referrals/` cần đọc kỹ phần transaction và index.
- Sửa nhỏ chỉ đụng tài liệu (lỗi chính tả, link) có thể tự merge.

## Code style

- TypeScript strict, ESLint + Prettier (chạy `pnpm lint --fix`).
- Validate mọi input từ ngoài bằng Yup (`.noUnknown()`, `abortEarly: false`); schema dùng chung đặt ở `shared/`.
- Không hard-code hằng số nghiệp vụ; đọc từ config.
- Text hiển thị cho người dùng bằng tiếng Việt; code, log, commit bằng tiếng Anh.

## Thay đổi schema MongoDB

- Khai báo field, index, validator trong schema Mongoose, rồi chạy `pnpm --filter backend db:sync-indexes`.
- Field mới phải có giá trị mặc định hoặc cho phép thiếu, để document cũ vẫn đọc được.
- Đổi tên hoặc đổi kiểu field đã có dữ liệu: viết script chuyển dữ liệu trong `backend/scripts/` và ghi vào PR.
- Không đổi `key` của trường phái hoặc `section` đã dùng: kết quả cũ trong database đang lưu theo `key` đó.

## Test

Xem [docs/testing.md](docs/testing.md). Logic credits và referral bắt buộc có test integration với MongoDB replica set chạy trong bộ nhớ, gồm cả test request song song.

## Ảnh tay trong repo

Repo công khai: chỉ commit ảnh tay của chính bạn (để làm bộ mẫu test), không commit ảnh của người khác.
