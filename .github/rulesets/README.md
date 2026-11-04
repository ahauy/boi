# Rulesets

Ba file trong thư mục này áp vào GitHub bằng REST API. GitHub không đọc chúng từ repo —
chúng là nguồn để bạn version-control cấu hình bảo vệ nhánh.

## Áp dụng

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/ahauy/boi/rulesets \
  --data @.github/rulesets/01-default-branch.json
```

Token cần scope `administration:write`. Xem ruleset đã áp: `GET /repos/ahauy/boi/rulesets`.

## Từng file

| File | Enforcement | Nội dung |
| --- | --- | --- |
| `01-default-branch.json` | `active` | Chặn xoá và force-push nhánh mặc định; PR phải có 4 check xanh: `Lint`, `Typecheck`, `Test`, `Build` |
| `02-default-branch-pr-only.json` | `active` | Bản nghiêm ngặt: lịch sử tuyến tính, chỉ squash, thêm check `Dependency review` |
| `03-release-tags.json` | `active` | Tag `v*` không xoá được, không ghi đè được |

`02` bao gồm luôn những gì `01` làm, nên khi `02` active thì **xoá `01`** để hai ruleset cùng
nhắm một ref khỏi giao nhau.

## Ai chặn cái gì — phân biệt cho khỏi nhầm

| Rule | Chặn |
| --- | --- |
| `pull_request` | Push thẳng vào nhánh: bắt buộc mọi thay đổi đi qua PR. **PR vẫn merge được.** |
| `update` ("Restrict updates") | **Mọi** thay đổi trên ref, kể cả merge PR. Ai không có trong bypass list thì không merge được — kể cả chủ repo |
| `required_status_checks` | Merge khi check chưa xanh; không tự nó đổi được quyền push |
| `non_fast_forward` | Force push |
| `creation` / `deletion` | Tạo / xoá ref |

Vì vậy `02` **không** chứa rule `update`: thứ cần là "phải đi qua PR", và `pull_request` đã làm
việc đó. Khi `update` bật mà bypass list rỗng, UI báo `Merging is blocked — Cannot update this
protected ref` và không ai merge được kể cả owner. Push thẳng vào `main` bị từ chối với
`push declined due to repository rule violations` là do `pull_request`, không phải do `update`.

## Hai liên kết dễ gãy

1. **Tên job CI ↔ `required_status_checks[].context`.** Đổi tên job trong `.github/workflows/ci.yml`
   mà không đổi context ở đây thì PR kẹt vĩnh viễn chờ một check không tồn tại.
2. **`01` và `02` trùng điều kiện** (cùng nhắm nhánh mặc định). GitHub cho phép, nhưng hai ruleset
   cùng hoạt động trên một ref sẽ giao nhau theo hướng nghiêm ngặt nhất. Khi bật `02`, xoá `01`
   bằng `DELETE /repos/ahauy/boi/rulesets/{id}` để khỏi rối.

## Một gate phụ thuộc vào cấu hình repo

`02` đòi check `Dependency review`. Check đó chạy bằng `actions/dependency-review-action`, thứ
đọc **Dependency graph** chứ không đọc lockfile. Graph chưa bật ở
`Settings → Code security and analysis` thì nó fail với
`Dependency review is not supported on this repository`.

Hiện workflow đang chạy với `continue-on-error: true`, nên nó **báo cáo nhưng không chặn merge** —
đây là trạng thái tạm thời để PR không bị kẹt vĩnh viễn trong lúc graph chưa bật. Cách về đích
đúng, theo thứ tự:

1. Bật Dependency graph, chờ nó quét nhánh nền lần đầu (vài phút).
2. Xoá dòng `continue-on-error` trong `.github/workflows/dependency-review.yml`.
3. Từ đó check mới thật sự chặn PR đưa lỗ hổng high trở lên.

Đừng làm nửa vời: xoá workflow mà vẫn giữ context trong ruleset thì mọi PR chờ một check không bao
giờ báo cáo, và đó là lỗi khó chẩn đoán hơn nhiều so với một check đỏ.

## Những thứ chuẩn công ty nhưng cố ý không có

`require_code_owner_review` — repo không có `CODEOWNERS`, bật vào là chặn mọi PR.
`required_approving_review_count: 1+` — maintainer duy nhất không thể tự duyệt PR của mình.
`merge_queue`, `required_deployments` — cần GitHub Advanced Security và environment đã cấu hình.
Gate `pnpm audit` trong CI — repo đang có 19 lỗ hổng tồn đọng, gate sẽ đỏ từ commit đầu;
`dependency-review.yml` chặn theo cách khác: chỉ lỗ hổng **mới** do PR đưa vào.
