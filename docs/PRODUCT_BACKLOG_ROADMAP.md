---
project: "PalmSight"
tech-stack:
  language: "TypeScript"
  backend: "NestJS (Node 22) + Mongoose"
  frontend: "React 19 + Vite + Tailwind CSS + PWA"
  database: "MongoDB 7 (Replica Set + Transactions)"
  infra: "Docker Compose (dev) / Vercel + Render (prod)"
  test: "Vitest + Playwright"
mcp-tools:
  - "StitchMCP"
  - "code-review-graph"
stitch-project-id: "15464591816682045618"
stitch-project-name: "PalmSight Terminal Landing Page"
git-mode: "team"
schema-version: "1.2"
---

# 🗺️ Product Backlog & Execution Roadmap — PalmSight

> **Sản phẩm:** PalmSight — Ứng dụng Web/PWA bói chỉ tay thông minh đa trường phái bằng AI Vision (Groq/Gemini), phong cách giao diện Terminal Minimalist, quản lý lượt bói minh bạch qua Sổ cái Credits và đòn bẩy lan tỏa giới thiệu bạn bè.  
> **Cập nhật lần cuối:** 2026-10-15  
> **Trạng thái tài liệu:** Living Document — Quản lý tiến độ và đồng bộ với `/command-continue-project`
>
> **Ký hiệu trạng thái:**
>
> - `[x]` **Hoàn thành (Done)** — Đã hoàn thiện code, test pass và tài liệu kỹ thuật/hướng dẫn đầy đủ.
> - `[/]` **Đang triển khai (In Progress)** — `/continue` sẽ ưu tiên tiếp tục xử lý cho xong.
> - `[ ]` **Chưa triển khai (To Do / Backlog)** — Đã có đặc tả, sẵn sàng bốc theo thứ tự từ trên xuống.
> - `[!]` **Bị chặn / Cần làm rõ (Blocked / Review Needed)** — Cần quyết định kiến trúc hoặc phụ thuộc module khác; `/continue` sẽ dừng lại cảnh báo và đề xuất phiên `grilling` để tháo gỡ điểm nghẽn.
> - `[~]` **Dự kiến dài hạn (Deferred / Future Phase)** — Tính năng đã ghi nhận nhưng chủ động hoãn lại sang phiên bản sau.

---

## 🚫 Explicitly Out of Scope — Won't-Have for MVP

> **CRITICAL:** Khung phạm vi rào chắn bất biến (Scope Fence) của PalmSight cho giai đoạn MVP. Subagents và AI không được tự ý hallucinate hoặc mở rộng phạm vi ra ngoài các mục này.

- **NO credit sales / billing / payment gateways:** Hoàn toàn không tích hợp cổng thanh toán (Stripe, Momo, VNPay, ZaloPay), không bán gói credit bằng tiền thật trong MVP. Toàn bộ credit được vận hành qua cơ chế tặng khi đăng ký và referral lan tỏa.
- **NO mobile native app (iOS / Android):** Không phát triển ứng dụng Swift/Kotlin/React Native đưa lên App Store hay Google Play. Ứng dụng chạy trên trình duyệt di động chuẩn PWA (Progressive Web App), hỗ trợ cài đặt ra màn hình chính (Add to Home Screen).
- **NO multi-language support:** Chỉ hỗ trợ duy nhất Tiếng Việt (`vi-VN`) cho toàn bộ giao diện, câu bói toán AI và email thông báo. Không làm i18n đa ngữ (Anh, Trung, v.v.) trong MVP.
- **NO dedicated admin panel:** Không xây dựng hệ thống CMS / Admin Dashboard riêng biệt với UI quản trị. Mọi thao tác quản trị đặc biệt (điều chỉnh credit tay, đối soát số dư, xóa tài khoản thủ công) được thực thi an toàn qua CLI scripts (`backend/scripts/`).
- **NO self-service in-app account deletion:** Không có nút tự bấm xóa tài khoản trong app nhằm ngăn chặn hành vi xóa tài khoản rồi đăng ký lại để farm credits (+3 credits đăng ký và +1/+2 referral). Quy trình xóa tài khoản thực hiện thủ công qua yêu cầu email theo [ADR-0009](file:///Users/vutuanhau/Documents/PROJECT/PalmSight/docs/adr/0009-manual-account-deletion.md).
- **NO 2-person palm comparison:** Không so sánh độ tương hợp chỉ tay giữa hai người (Couple Reading). Mỗi lần bói chỉ xử lý 1 bàn tay của 1 người dùng.
- **NO enterprise SSO:** Không tích hợp SAML, LDAP, Azure AD. Chỉ hỗ trợ Email/Mật khẩu cùng 2 provider OAuth tiêu dùng phổ biến (Google Identity Services, Facebook Login SDK).
- **NO real-time chat / live astrologer consultation:** Không có kết nối chuyên gia bói toán trực tiếp, không có chatroom WebSocket thời gian thực. Toàn bộ kết quả do mô hình AI Vision phân tích một lần qua HTTP request có tính giải trí.

---

## 📊 Bảng Ma Trận Ưu Tiên MoSCoW & RICE Score

| Mã Epic     | Nghiệp vụ / Tính năng                                                                                                                                                         |  Phân loại MoSCoW   | RICE Score |     Mức ưu tiên     | Sprint khuyến nghị |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------: | :--------: | :-----------------: | :----------------: |
| **EPIC-00** | **Monorepo & Engineering Setup:** Pnpm workspace, Docker Compose, `@palmsight/shared`, Stitch Design Tokens, 8 Mongoose Schemas, Vite Proxy, GitHub Actions CI                |    **Must Have**    |    9.5     | **P0 (Foundation)** |      Sprint 0      |
| **EPIC-01** | **Auth & Identity:** Đăng ký xác minh email, Đăng nhập Email/Username, OAuth Google/Facebook gộp tài khoản, Quên mật khẩu                                                     |    **Must Have**    |    9.2     |  **P0 (Critical)**  |      Sprint 1      |
| **EPIC-02** | **Credit Ledger & Wallet:** Sổ cái biến động Credits (`CreditLedgerService`), trừ/hoàn credit với MongoDB transaction, Lịch sử ví                                             |    **Must Have**    |    9.0     |  **P0 (Core USP)**  |      Sprint 1      |
| **EPIC-03** | **AI Palm Reading Engine:** 3 trường phái (Phương Tây, Phương Đông, Ấn Độ), Chụp/Upload ảnh lòng bàn tay, Phân tích AI Vision Groq/Gemini, Trả kết quả chi tiết & Lịch sử bói |    **Must Have**    |    8.8     |  **P0 (Core USP)**  |      Sprint 2      |
| **EPIC-04** | **Referral & Viral Mechanics:** Liên kết giới thiệu `/r/:code`, Nhập mã nhận thưởng 2 chiều (+1 referee, +2 referrer), Cơ chế chống gian lận & Giới hạn trần ngày             |   **Should Have**   |    7.8     |    **P1 (High)**    |      Sprint 3      |
| **EPIC-05** | **Production Hardening & Deployment:** Audit bảo mật, Replica Set Cloud DB, Deploy API Render, Deploy SPA Vercel, E2E Smoke Test                                              |    **Must Have**    |    8.5     |  **P0 (Go-Live)**   |      Sprint 4      |
| **EPIC-06** | **Monetization & Future Horizons:** Cổng thanh toán mua credit, So sánh chỉ tay 2 người, Xuất ảnh Card chiêm tinh chia sẻ mạng xã hội                                         | **Won't Have (v1)** |    4.0     |   **P3 (Future)**   |   Horizon V2.0+    |

---

## 🗺️ Lộ Trình Phát Hành (Release Roadmap)

```text
[ Sprint 0 - Setup & Architecture ] ──────────────────────────────────────────► [ COMPLETED ✅ ]
  ├── [x] SETUP-001: Khởi tạo monorepo pnpm workspace (frontend, backend, shared)
  ├── [x] SETUP-002: Dọn dẹp boilerplate frontend/ theo ADR-0007 (sửa CommonIcons)
  ├── [x] SETUP-003: Thiết lập docker-compose.yml (MongoDB 7 Replica Set 27019:27017, Mailpit)
  ├── [x] SETUP-004: Khởi tạo package @palmsight/shared (DTOs, Enums, Yup schemas)
  ├── [x] SETUP-005: Tích hợp Stitch MCP & Đồng bộ Design Tokens (Project 15464591816682045618)
  ├── [x] SETUP-006: Khởi tạo 8 Mongoose Schema theo database-erd.md & db:sync-indexes
  ├── [x] SETUP-007: Cấu hình Vite proxy /api/v1/* -> Backend NestJS, kiểm tra health check
  └── [x] SETUP-008: Cấu hình GitHub Actions CI (lint, typecheck, test, build)

[ Sprint 1 - Nền tảng Xác thực & Sổ cái Credits (MVP P0) ] ───────────────────► [ TO DO 📋 ]
  ├── US-AUTH-001: Đăng ký tài khoản và xác minh Email bắt buộc (+3 Credits)
  ├── US-AUTH-002: Đăng nhập đa phương thức (Email/Username, Google, Facebook gộp tài khoản)
  ├── US-AUTH-003: Quên và đặt lại mật khẩu an toàn qua Email
  └── US-WALLET-001: Khởi tạo ví và kiểm soát biến động Credits (CreditLedgerService)

[ Sprint 2 - Trải nghiệm Cốt lõi — Xem bói chỉ tay bằng AI (MVP P0) ] ────────► [ TO DO 📋 ]
  ├── US-SCAN-001: Chọn trường phái chiêm đoán & cấu hình mục muốn bói
  ├── US-SCAN-002: Chụp ảnh lòng bàn tay qua camera & upload ảnh với Sharp
  ├── US-AI-001: Phân tích chỉ tay đa trường phái với AI Vision (Groq / Gemini fallback)
  └── US-READ-001: Hiển thị kết quả bói chi tiết & quản lý lịch sử xem bói

[ Sprint 3 - Đòn bẩy Lan tỏa — Giới thiệu Bạn bè & Tối ưu (P1) ] ─────────────► [ TO DO 📋 ]
  ├── US-REF-001: Chia sẻ mã giới thiệu & điều hướng liên kết /r/:code
  ├── US-REF-002: Nhập mã giới thiệu nhận thưởng Credits & phòng chống gian lận
  └── US-ACCT-001: Quản lý hồ sơ cá nhân & trang điều khoản / hướng dẫn xóa dữ liệu

[ Sprint 4 - Production Hardening & Go-Live (P0) ] ───────────────────────────► [ GO-LIVE 🚀 ]
  ├── US-DEPLOY-01: Security Hardening & Secret Audit (Pre-Deploy SEC-01 → SEC-03)
  ├── US-DEPLOY-02: Cloud Database Setup & MongoDB Replica Set Migration (DB-01)
  ├── US-DEPLOY-03: Backend API Deployment & Health Check Verification (API-01)
  ├── US-DEPLOY-04: Frontend Deployment & SPA Routing Fallback Verification (WEB-01)
  └── US-DEPLOY-05: Production End-to-End Smoke Test trên URL thực tế (TEST-01)
```

---

## ⚙️ Sprint 0: Project Setup & Architecture (Đã hoàn thành — [x])

> **Tiến độ hiện tại:** Đã hoàn thành 100% toàn bộ 8 nhiệm vụ nền tảng (SETUP-001 đến SETUP-008). Monorepo pnpm workspace hoạt động trơn tru với cả 3 package (`frontend`, `backend`, `shared`), hạ tầng Docker Compose (MongoDB RS0 ánh xạ cổng 27019:27017, Mailpit SMTP; không dùng MinIO theo [ADR-0010](file:///Users/vutuanhau/Documents/PROJECT/PalmSight/docs/adr/0010-no-image-storage.md)), 8 Mongoose schemas với index sync, Stitch Design Tokens, Vite proxy /api/v1/\* kết nối NestJS, và GitHub Actions CI tự động hóa toàn diện cho push và pull_request (`.github/workflows/ci.yml`). Toàn bộ test suites, linter, typecheck và production build đều pass 100%.

- [x] **SETUP-001**: Khởi tạo monorepo pnpm workspace (`pnpm-workspace.yaml`, gộp `frontend`, `backend`, `shared`), chuẩn hóa script chạy toàn repo (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`).
- [x] **SETUP-002**: Dọn dẹp boilerplate `frontend/` theo [ADR-0007](file:///Users/vutuanhau/Documents/PROJECT/PalmSight/docs/adr/0007-vite-spa-frontend.md) (bỏ mock login `don/don`, bỏ role-based guards `withCheckRole`, bỏ selector đa ngữ, bỏ trang mẫu Todos/Examples, sửa lỗi import case-sensitive `CommonIcons` -> `commonIcons`).
- [x] **SETUP-003**: Thiết lập `docker-compose.yml` gồm MongoDB 7 cấu hình Replica Set đơn node (`rs0`, ánh xạ cổng `27019:27017`) khởi tạo tự động phục vụ MongoDB Transactions và Mailpit SMTP bắt email giao dịch local (không dùng MinIO theo [ADR-0010](file:///Users/vutuanhau/Documents/PROJECT/PalmSight/docs/adr/0010-no-image-storage.md)).
- [x] **SETUP-004**: Khởi tạo package `@palmsight/shared` (DTOs, Enums, Yup schemas cho auth và PalmResult, danh mục hằng số `READING_SCHOOLS`, `LIFE_ASPECTS`), build ra song song CJS + ESM + `.d.ts`.
- [x] **SETUP-005**: Tích hợp Stitch MCP & Đồng bộ Design Tokens từ Project Stitch `PalmSight Terminal Landing Page` (`15464591816682045618`): Trích xuất bảng màu Terminal Minimalist (canvas `#fdfcfc`, ink `#201d1d`, surface-card `#f1eeee`, hairline `rgba(15,0,0,0.12)`), typography Berkeley Mono/monospaced, bo góc `4px`, hairline dividers vào `tailwind.config.cjs` và CSS base.
- [x] **SETUP-006**: Khởi tạo 8 Mongoose Schema (`users`, `pending_registrations`, `sessions`, `password_resets`, `credit_transactions`, `readings`, `referrals`, `deleted_identities`) theo chuẩn `database-erd.md` và viết script `pnpm --filter backend db:sync-indexes`.
- [x] **SETUP-007**: Cấu hình Vite proxy `/api/v1/*` trỏ tới Backend NestJS (`http://localhost:4000`), cài đặt module sức khỏe và kiểm tra endpoint `GET /api/v1/health` trả về HTTP 200 OK.
- [x] **SETUP-008**: Cấu hình GitHub Actions CI (`.github/workflows/ci.yml`) tự động thực thi linting, typecheck, test suites và build verification trên mọi Pull Request / Push vào nhánh chính.

---

## 🎯 Sprint 1: Nền tảng Xác thực & Sổ cái Credits (MVP P0)

> **Mục tiêu Sprint:** Người dùng có thể đăng ký tài khoản với email thật, xác minh qua link email, đăng nhập bằng Email/Username hoặc gộp tài khoản Google/Facebook; hệ thống cấp đúng 3 credits ban đầu vào ví thông qua `CreditLedgerService` đảm bảo tính toàn vẹn dữ liệu.

- [ ] **US-AUTH-001**: Đăng ký tài khoản và xác minh Email bắt buộc

  - **Slug:** `auth-register-verify-email`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `SETUP-001`, `SETUP-002`, `SETUP-003`, `SETUP-004`, `SETUP-005`, `SETUP-006`, `SETUP-007`
  - **Blocks:** `US-AUTH-002`, `US-WALLET-001`
  - **Mô tả:** Người dùng có thể tạo tài khoản mới bằng tên hiển thị, username, email và mật khẩu. Hệ thống gửi email chứa liên kết xác thực dùng một lần; chỉ khi nhấn xác nhận email thì tài khoản chính thức mới được tạo và người dùng được tự động đăng nhập.
  - **Acceptance Criteria (AC):**
    - [ ] Form đăng ký kiểm tra dữ liệu bằng schema Yup dùng chung từ `@palmsight/shared` (email hợp lệ, username 3–20 ký tự `[a-z0-9_]`, mật khẩu ≥ 8 ký tự).
    - [ ] Khi gửi thông tin hợp lệ, API lưu vào collection `pending_registrations` với `tokenHash` mã hóa SHA-256 và `expiresAt` sau 24 giờ (MongoDB TTL tự động dọn dẹp), trả về HTTP 202 Accepted.
    - [ ] Người dùng nhận được email giao dịch bằng Tiếng Việt (gửi qua Mailpit/Gmail SMTP) với link xác minh `https://<domain>/verify-email?token=...`.
    - [ ] Màn hình `/register/check-email` hiển thị thông báo chờ xác thực, kèm nút "Gửi lại email xác minh" (khóa bấm lại trong 60 giây rate limit).
    - [ ] Khi truy cập `/verify-email?token=...`, API `POST /auth/verify-email` xác thực token: tạo bản ghi `users`, cấp mã `referralCode` độc bản 8 ký tự (bảng chữ cái loại trừ `0, O, 1, I, L`), cấp cookie refresh token `rt` (HttpOnly, SameSite=Lax, Path=/api/v1/auth) và trả về Access Token JWT trong bộ nhớ.
    - [ ] Trả về mã lỗi chuẩn tiếng Việt nếu email/username đã tồn tại (`EMAIL_TAKEN`, `USERNAME_TAKEN`), hoặc token hết hạn (`VERIFICATION_TOKEN_INVALID`).
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Tạo Mongoose schema cho `pending_registrations` (TTL index) và `users`; implement `MailService` sử dụng `nodemailer`; viết endpoint `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`; hash mật khẩu bằng `argon2id`.
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP cho 4 màn hình:
        - Stitch Screen: `PalmSight - Register` (`59bf8c4b91a04c18a0afbf3139812e0d`)
        - Stitch Screen: `PalmSight - Kiểm tra hộp thư của bạn` (`e2ca007ff9be4c8eb496a3933785c6db`)
        - Stitch Screen: `PalmSight - Email verified` (`1d106024adaa426eadcacab751819351`)
        - Stitch Screen: `PalmSight - Transactional Email` (`2e38ad0c7e83457d89a391c8a8466a86`)
      - Thiết kế màn hình `/register`, `/register/check-email`, `/verify-email` theo phong cách Terminal Minimalist (canvas `#fdfcfc`, ink `#201d1d`, bo góc 4px, font monospace Berkeley Mono); kết nối TanStack Query và lưu access token trong memory state của `AuthProvider`.
  - **Deliverables khi [x]:**
    - `.specify/features/auth-register-verify-email/baseline.md` (SIGNED-OFF)
    - `docs/features/auth-register-verify-email/README.md`
    - `docs/user-guides/auth-register-verify-email.md` (kèm ảnh chụp Playwright thật)

- [ ] **US-AUTH-002**: Đăng nhập đa phương thức (Email/Username, Google, Facebook gộp tài khoản)

  - **Slug:** `auth-multi-login-and-account-linking`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-AUTH-001`
  - **Blocks:** `US-AUTH-003`, `US-SCAN-001`
  - **Mô tả:** Người dùng có thể đăng nhập linh hoạt bằng Email hoặc Username kèm mật khẩu, hoặc đăng nhập 1-chạm qua Google / Facebook. Nếu email Google/Facebook trùng với tài khoản đã xác minh trước đó, hệ thống tự động gộp identity vào cùng một tài khoản duy nhất.
  - **Acceptance Criteria (AC):**
    - [ ] `POST /auth/login` cho phép người dùng nhập email hoặc username vào cùng 1 ô input `login`, xác thực bằng argon2id; trả về JWT 15 phút và cookie `rt` 30 ngày.
    - [ ] Nếu tài khoản chưa xác minh email, trả về `403 EMAIL_NOT_VERIFIED` kèm email trong `details` để hiển thị nút gửi lại email xác minh ngay tại form login.
    - [ ] Tích hợp Google Identity Services (`POST /auth/google`) xác minh `idToken` từ Google public keys; nhúng danh tính vào mảng `identities` của `users`.
    - [ ] Tích hợp Facebook Login SDK (`POST /auth/facebook`) gọi Graph API xác minh `accessToken` và lấy email đã xác minh.
    - [ ] Quy tắc gộp tài khoản (Account Linking): Nếu email trả về từ OAuth trùng với `users.email` đã xác thực, tự động gắn `providerUserId` vào `identities` của user đó mà không sinh user mới và không cấp trùng `SIGNUP_BONUS`.
    - [ ] Auth Guard kiểm tra token hợp lệ và truy vấn user trong MongoDB ở mọi request: từ chối ngay (`401 UNAUTHENTICATED`) nếu user không tồn tại hoặc có `deletedAt != null`.
    - [ ] Hỗ trợ cơ chế Web Locks (`navigator.locks.request("palmsight-refresh")`) trên frontend để tránh race condition khi nhiều tab trình duyệt refresh đồng thời làm thu hồi token phiên.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Tạo `GoogleAuthVerifier` (`google-auth-library`) và `FacebookAuthVerifier`; xây dựng logic đăng nhập, tạo session mới trong collection `sessions`, xoay vòng refresh token; implement Auth Guard và Rate Limiting 5 lần sai mật khẩu / 15 phút.
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP:
        - Stitch Screen: `PalmSight - Login` (`cc0b1d9d18a14673b30ce02c73d06d81`)
      - Thiết kế giao diện `/login` chuẩn phong cách Terminal Minimalist với nút ASCII button `[ Đăng nhập ]`, dải phân cách nét đứt và các nút liên kết mạng xã hội `[+ Google]` `[+ Facebook]`; cấu hình auto-refresh token trong `apiClient`.
  - **Deliverables khi [x]:**
    - `.specify/features/auth-multi-login-and-account-linking/baseline.md` (SIGNED-OFF)
    - `docs/features/auth-multi-login-and-account-linking/README.md`
    - `docs/user-guides/auth-multi-login-and-account-linking.md`

- [ ] **US-AUTH-003**: Quên và đặt lại mật khẩu an toàn qua Email

  - **Slug:** `auth-forgot-reset-password`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Should-Have (P1)
  - **Depends-on:** `US-AUTH-002`
  - **Blocks:** _(none)_
  - **Mô tả:** Người dùng quên mật khẩu có thể yêu cầu gửi liên kết đặt lại mật khẩu về email đã đăng ký để thiết lập mật khẩu mới một cách an toàn.
  - **Acceptance Criteria (AC):**
    - [ ] `POST /auth/forgot-password` nhận email, kiểm tra tài khoản tồn tại (nếu không tồn tại vẫn trả về HTTP 200/202 để chống user enumeration).
    - [ ] Tạo bản ghi trong `password_resets` với `tokenHash` mã hóa SHA-256, hạn sử dụng 1 giờ (TTL index); gửi email Tiếng Việt chứa link `/reset-password?token=...`.
    - [ ] `POST /auth/reset-password` kiểm tra token hợp lệ và chưa sử dụng (`usedAt == null`): cập nhật `users.passwordHash` mới bằng argon2id, đánh dấu `usedAt`, đồng thời thu hồi toàn bộ các `sessions` cũ của user đó.
    - [ ] Chuyển hướng người dùng về `/login?reset=1` hiển thị banner ASCII thông báo thành công: `[x] Đã đặt lại mật khẩu, hãy đăng nhập lại`.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Schema `password_resets`, template email reset password, endpoints `POST /auth/forgot-password` và `POST /auth/reset-password`, endpoint `PUT /me/password` (đổi mật khẩu khi đã đăng nhập).
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP cho 3 màn hình:
        - Stitch Screen: `PalmSight - Quên mật khẩu` (`939cd59ab1314dd5a7f4c22b430bb733`)
        - Stitch Screen: `PalmSight - Đặt lại mật khẩu` (`450e73adc13c4138ae553ff9698b6a82`)
        - Stitch Screen: `PalmSight - Transactional Email` (`4c3c5497fe6743839889cb29f044328d`)
      - Xây dựng màn hình `/forgot-password`, `/reset-password` và trang `/account/password` đồng bộ phong cách Terminal Minimalist.
  - **Deliverables khi [x]:**
    - `.specify/features/auth-forgot-reset-password/baseline.md` (SIGNED-OFF)
    - `docs/features/auth-forgot-reset-password/README.md`

- [ ] **US-WALLET-001**: Khởi tạo ví và kiểm soát biến động Credits (CreditLedgerService)
  - **Slug:** `wallet-credit-ledger-management`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-AUTH-001`
  - **Blocks:** `US-SCAN-001`, `US-REF-002`
  - **Mô tả:** Mọi biến động credits của người dùng được kiểm soát qua `CreditLedgerService` chạy trong MongoDB transaction, ghi sổ cái `credit_transactions` bất biến và cập nhật số dư `users.creditBalance` đảm bảo không bao giờ âm.
  - **Acceptance Criteria (AC):**
    - [ ] Tặng ngay +3 credits (`SIGNUP_BONUS`) khi người dùng mới xác minh email thành công hoặc lần đầu đăng nhập bằng Google/Facebook; unique index `(userId, type=SIGNUP_BONUS)` chặn cộng trùng lặp tuyệt đối.
    - [ ] Nếu danh tính tạo tài khoản đã từng nằm trong `deleted_identities` (đối chiếu mã băm HMAC), tài khoản mới được khởi tạo với số dư 0 credits và không nhận `SIGNUP_BONUS`.
    - [ ] Mọi thao tác cộng/trừ credits đều chạy qua `CreditLedgerService` bên trong MongoDB Client Session Transaction; kiểm tra điều kiện `matchedCount === 1` khi cộng để tránh giao dịch mồ côi.
    - [ ] Lệnh trừ credit sử dụng điều kiện nguyên tử `creditBalance: { $gte: 1 }`; nếu `modifiedCount === 0` thì rollback transaction và trả lỗi `402 INSUFFICIENT_CREDITS`.
    - [ ] Collection `users` có JSON schema validator `creditBalance: { minimum: 0 }`.
    - [ ] Cung cấp API `GET /me` (trả về `creditBalance`) và `GET /me/credit-transactions` phân trang cursor-based (`limit`, `cursor`).
    - [ ] Màn hình `/wallet` hiển thị số dư lớn phong cách Terminal Monospace `[ 3 CREDITS ]` và danh sách lịch sử biến động (+3 đăng ký, -1 xem bói, +1 hoàn tiền, v.v.).
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [x] **Backend:** Mongoose schema cho `credit_transactions`; xây dựng `CreditLedgerService` với các phương thức `grantSignupBonus`, `spendForReading`, `refundReading`, `rewardReferral`; viết unit/integration tests mô phỏng concurrency và rollback.
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP:
        - Stitch Screen: `PalmSight - Tài khoản` (`405bac78d239413cab5b68e8c3f9f0b3` - Phần Ví Credits & Lịch sử biến động)
      - Component `CreditBadge` trên thanh header/navbar, trang `/wallet` với danh sách biến động và cursor pagination; tự động cập nhật số dư từ API response không cần tải lại toàn trang.
  - **Deliverables khi [x]:**
    - `.specify/features/wallet-credit-ledger-management/baseline.md` (SIGNED-OFF)
    - `docs/features/wallet-credit-ledger-management/README.md`
    - `docs/user-guides/wallet-credit-ledger-management.md`

---

## 🔮 Sprint 2: Trải nghiệm Cốt lõi — Xem bói chỉ tay bằng AI (MVP P0)

> **Mục tiêu Sprint:** Người dùng có thể chọn trường phái (Phương Tây, Phương Đông, Ấn Độ), chọn mục xem cụ thể hoặc bói toàn bộ, chụp/tải ảnh lòng bàn tay, hệ thống trừ 1 credit an toàn, gọi AI Vision đọc chỉ tay và hiển thị kết quả phân tích chuẩn xác, nếu lỗi AI thì tự động hoàn credit.

- [x] **US-SCAN-001**: Chọn trường phái & cấu hình mục muốn bói

  - **Slug:** `scan-school-and-topic-picker`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-AUTH-002`, `US-WALLET-001`
  - **Blocks:** `US-SCAN-002`
  - **Mô tả:** Người dùng có thể chọn 1 trong 3 trường phái bói (Phương Tây, Phương Đông, Ấn Độ), tích chọn các mục muốn bói riêng lẻ hoặc chọn bói toàn bộ, đồng thời chọn tay xem (trái/phải) với chi phí cố định là 1 credit.
  - **Acceptance Criteria (AC):**
    - [x] Hiển thị 3 thẻ trường phái theo định nghĩa chuẩn từ `READING_SCHOOLS` trong `@palmsight/shared`:
      - `WESTERN` (Chỉ tay phương Tây: Dáng tay 4 nguyên tố, các đường chỉ chính, 7 gò).
      - `EASTERN` (Chỉ tay phương Đông: Dáng tay ngũ hành, Thiên - Nhân - Địa văn, Cung bát quái, ngón tay).
      - `VEDIC` (Chỉ tay Ấn Độ: Gò 9 hành tinh, đường chính, dấu hiệu đặc biệt, ngón cái).
    - [x] Hiển thị danh sách checkbox chọn mục bói gồm 2 nhóm: Các mục riêng của trường phái đã chọn và 6 khía cạnh cuộc sống chung (`personality`, `love`, `career`, `finance`, `health`, `family`).
    - [x] Mặc định tích sẵn `[x] Bói toàn bộ`. Nếu bỏ tích, cho phép chọn từng mục lẻ. Tự động chuyển về "Bói toàn bộ" nếu người dùng tích chọn tất cả các mục bằng tay.
    - [x] Khóa nút tiếp tục và hiện cảnh báo nếu không có mục nào được chọn. Ghi chú giá cố định hiển thị rõ ràng: `Chi phí: 1 credit (dù chọn 1 mục hay toàn bộ)`.
    - [x] Chọn bàn tay (Trái / Phải); hiển thị gợi ý cho trường phái Phương Đông: `"Nam xem tay trái, Nữ xem tay phải"`. Ghi nhớ tùy chọn lần trước của người dùng vào local storage.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [x] **Backend:** Định nghĩa đồng bộ enum `ReadingSchool`, `HandSide`, và schema validation DTO cho request bói chỉ tay trong `@palmsight/shared`.
    - [x] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP:
        - Stitch Screen: `PalmSight - Xem bói` (`03b652be69ad4254876da7e142d2a33a` - Bước 1 & Bước 2: Chọn trường phái và khía cạnh chiêm đoán)
      - Thiết kế component `SchoolPicker`, `TopicSelector`, và `HandSelector` theo phong cách Terminal Card Minimalist với các ký hiệu ASCII `[x]` và `[ ]`; lưu state vào Zustand/React state.
  - **Deliverables khi [x]:**
    - `.specify/features/scan-school-and-topic-picker/baseline.md` (SIGNED-OFF)
    - `docs/features/scan-school-and-topic-picker/README.md`

- [x] **US-SCAN-002**: Chụp ảnh lòng bàn tay qua camera & upload ảnh

  - **Slug:** `scan-camera-capture-and-upload`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-SCAN-001`
  - **Blocks:** `US-AI-001`
  - **Mô tả:** Người dùng có thể mở camera trực tiếp trên trình duyệt điện thoại/máy tính với khung viền căn chỉnh bàn tay để chụp ảnh, hoặc tải ảnh có sẵn từ thư viện ảnh; ảnh được xử lý tiền kỳ chuẩn hóa an toàn trước khi gửi lên máy chủ.
  - **Acceptance Criteria (AC):**
    - [x] Giao diện camera sử dụng `navigator.mediaDevices.getUserMedia` kèm overlay khung viền lòng bàn tay kiểu terminal hairline và lời nhắc: `Đủ sáng, xòe ngón tay, lòng bàn tay hướng thẳng camera`.
    - [x] Cung cấp fallback tự động sang `<input type="file" accept="image/*" capture="environment">` nếu thiết bị không hỗ trợ getUserMedia hoặc người dùng từ chối cấp quyền camera.
    - [x] Cho phép xem trước ảnh chụp, nút `[ Chụp lại ]` và nút hành động `[ Xem bói (-1 credit) ]`.
    - [x] Bắt buộc người dùng tích chọn checkbox đồng ý: `[x] Tôi đồng ý gửi ảnh lòng bàn tay để AI phân tích theo chính sách bảo mật`. Nút gửi bị disable nếu chưa tích.
    - [x] Backend tiếp nhận file qua `multipart/form-data` với Multer `memoryStorage` (giới hạn file tối đa 8MB), sử dụng thư viện `sharp` tiền xử lý hoàn toàn trong bộ nhớ buffer: chuyển đổi định dạng (HEIC/PNG → JPEG), tự động xoay đúng chiều theo EXIF, xóa sạch toàn bộ metadata EXIF nhạy cảm (định vị GPS, thông số thiết bị), resize cạnh dài nhất tối đa 1280px, nén quality 85%.
    - [x] **Tuyệt đối không lưu trữ ảnh lòng bàn tay** trên server dưới bất kỳ hình thức nào (không lưu ổ đĩa, không lưu thư mục tạm `/tmp`, không lưu object storage Cloudflare R2 hay MinIO, không lưu database, không log ảnh) theo đúng [ADR-0010](file:///Users/vutuanhau/Documents/PROJECT/PalmSight/docs/adr/0010-no-image-storage.md); buffer ảnh chỉ được chuyển thành base64 data URL gửi sang AI Vision và tự động giải phóng ngay khi request kết thúc.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [x] **Backend:** Cấu hình Multer `memoryStorage` với file size limit 8MB và mimetype whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/heic`); xây dựng pipeline tiền xử lý ảnh in-memory bằng `sharp`; không triển khai `StorageService` hay Cloudflare R2/MinIO SDK theo ADR-0010.
    - [x] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP:
        - Stitch Screen: `PalmSight - Xem bói` (`03b652be69ad4254876da7e142d2a33a` - Bước 3 & Bước 4: Khung bàn tay Terminal & Chụp ảnh)
      - Xây dựng component `CameraCapture` hỗ trợ stream video, căn chỉnh tỉ lệ, chuyển đổi canvas sang Blob, và fallback upload file.
  - **Deliverables khi [x]:**
    - `.specify/features/scan-camera-capture-and-upload/baseline.md` (SIGNED-OFF)
    - `docs/features/scan-camera-capture-and-upload/README.md`

- [x] **US-AI-001**: Phân tích chỉ tay đa trường phái với AI Vision (Groq / Gemini)

  - **Slug:** `ai-vision-palm-reading-engine`
  - **Effort:** L
  - **Context-budget:** multi-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-SCAN-002`
  - **Blocks:** `US-READ-001`
  - **Mô tả:** Hệ thống trừ 1 credit, gửi ảnh đã tiền xử lý kèm prompt chuyên sâu theo trường phái đã chọn tới Groq Vision (hoặc Gemini fallback) với cơ chế Idempotency chống trừ tiền trùng; nếu AI từ chối ảnh hoặc gặp sự cố, credit được tự động hoàn lại cho người dùng.
  - **Acceptance Criteria (AC):**
    - [x] Endpoint `POST /readings` yêu cầu bắt buộc header `Idempotency-Key` (UUID v4 sinh bởi client). Nếu gửi lại cùng key:
      - Khi reading đang xử lý → trả về `409 READING_IN_PROGRESS`.
      - Khi reading đã hoàn thành → trả về kết quả cũ kèm header `Idempotent-Replayed: true` (không trừ thêm credit).
    - [x] Trừ 1 credit nguyên tử qua `CreditLedgerService` với loại giao dịch `READING_SPEND` trước khi gọi AI.
    - [x] Gọi `AiProvider` (mặc định Groq Vision, tự động fallback sang Google Gemini khi Groq gặp lỗi hoặc quá quota); giới hạn timeout 40 giây.
    - [x] Prompt được quản lý bảo mật tại `backend/src/ai/prompts/` (phần chung, phương Tây, phương Đông, Ấn Độ). AI bắt buộc trả về duy nhất JSON object theo Yup schema `PalmResult` (`isPalm`, `rejectReason`, `imageQuality`, `summary`, `sections`, `aspects`, `advice`, `disclaimer`).
    - [x] Nếu ảnh không phải bàn tay hoặc quá mờ (`isPalm = false`): đánh dấu reading là `REJECTED`, hoàn trả ngay +1 credit (`READING_REFUND`) và trả về lý do từ chối thân thiện.
    - [x] Nếu AI trả về JSON sai schema hoặc lỗi timeout/network sau 1 lần retry: đánh dấu reading là `FAILED`, hoàn trả ngay +1 credit (`READING_REFUND`) trong cùng transaction, đảm bảo người dùng không bị mất credit oan.
    - [x] Bắt buộc bao gồm câu miễn trừ trách nhiệm ở cuối mọi bài đọc: `Kết quả bói chỉ mang tính chất tham khảo, chiêm nghiệm và giải trí`.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [x] **Backend:** Tạo interface `AiProvider`; implement `GroqAiProvider` và `GeminiAiProvider`; xây dựng bộ prompts tiếng Việt chuẩn xác theo văn hóa chỉ tay 3 trường phái; viết logic xử lý transaction trừ/hoàn credit trong `ReadingsService`.
    - [x] **Frontend:** Thiết kế màn hình loading chờ AI phong cách Terminal Monospace với thanh progress ASCII `[====>    ] 45%` và thông điệp động: `Đang quét đường sinh đạo...`, `Đang nhận diện cung bát quái...`; xử lý polling nếu gặp `409 READING_IN_PROGRESS`.
  - **Deliverables khi [x]:**
    - `.specify/features/ai-vision-palm-reading-engine/baseline.md` (SIGNED-OFF)
    - `docs/features/ai-vision-palm-reading-engine/README.md`
    - `docs/user-guides/ai-vision-palm-reading-engine.md`

- [x] **US-READ-001**: Hiển thị kết quả bói chi tiết & quản lý lịch sử xem bói
  - **Slug:** `readings-detail-and-history-view`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-AI-001`
  - **Blocks:** `US-REF-001`
  - **Mô tả:** Người dùng có thể xem kết quả bói chi tiết gồm nhận xét tổng quan, từng đường chỉ tay và các khía cạnh cuộc sống được định dạng rõ ràng; xem lại lịch sử các lần bói trước đó hoặc xóa bài bói khỏi lịch sử cá nhân.
  - **Acceptance Criteria (AC):**
    - [x] Màn hình `/readings/:id` hiển thị cấu trúc bài bói khoa học, thẩm mỹ chuẩn Terminal Minimalist:
      1. Nhãn trường phái + nhãn "Toàn bộ" hoặc "N mục" (không hiển thị ảnh tay từ server theo [ADR-0010](file:///Users/vutuanhau/Documents/PROJECT/PalmSight/docs/adr/0010-no-image-storage.md)).
      2. Banner cảnh báo nếu chất lượng ảnh thấp (`imageQuality == POOR`): `Ảnh hơi mờ, kết quả có thể chưa đạt độ chính xác cao`.
      3. Tổng quan (`summary`).
      4. Các mục riêng (`sections`) gồm phần "Quan sát" (observation) và "Ý nghĩa" (meaning).
      5. Các khía cạnh cuộc sống (`aspects`).
      6. Lời khuyên định hướng (`advice`).
      7. Câu miễn trừ trách nhiệm pháp lý giải trí (`disclaimer`).
    - [x] Nút "Bói thêm mục khác / trường phái khác (-1 credit)": cho phép chuyển nhanh về màn hình cấu hình bói mới, tái sử dụng ảnh chụp vừa rồi nếu còn lưu trên bộ nhớ client.
    - [x] Nút "Sao chép kết quả": chỉ sao chép nội dung văn bản bói toán để người dùng dán chia sẻ, không đính kèm ảnh chụp tay nhằm bảo vệ quyền riêng tư.
    - [x] Nút "Xóa bài bói": gọi `DELETE /readings/:id` (đánh dấu `deletedAt`); bài bói bị ẩn hoàn toàn khỏi danh sách lịch sử và không thể truy cập lại.
    - [x] Màn hình `/readings` (tab Lịch sử): hiển thị danh sách các bài bói đã xem dạng danh sách Terminal Card, hỗ trợ cursor-based pagination (`limit`, `cursor`), hiển thị ngày giờ, trường phái và tóm tắt ngắn.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [x] **Backend:** Endpoints `GET /readings/:id`, `GET /readings` (cursor pagination), `DELETE /readings/:id`; kiểm tra quyền sở hữu bài đọc (chỉ chủ bài đọc mới được xem/xóa).
    - [x] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP cho 2 màn hình:
        - Stitch Screen: `PalmSight - Kết quả xem bói` (`767fe31042964fefb0f0645368f00d94`)
        - Stitch Screen: `PalmSight - Lịch sử` (`211eba0f785841a6bac74bb69a3a0ee9`)
      - Thiết kế component `ReadingDetailLayout`, `SectionAccordion`, `ReadingCardItem` và tích hợp clipboard API để copy văn bản kết quả.
  - **Deliverables khi [x]:**
    - `.specify/features/readings-detail-and-history-view/baseline.md` (SIGNED-OFF)
    - `docs/features/readings-detail-and-history-view/README.md`
    - `docs/user-guides/readings-detail-and-history-view.md`

---

## 🤝 Sprint 3: Đòn bẩy Lan tỏa — Giới thiệu Bạn bè & Tối ưu (P1)

> **Mục tiêu Sprint:** Người dùng có thể chia sẻ liên kết mã giới thiệu độc bản `/r/:code`; người được mời và người mời đều nhận thưởng credits minh bạch với đầy đủ 6 bước kiểm tra chống gian lận, cùng trang quản lý hồ sơ và hướng dẫn xóa dữ liệu chuẩn chỉ.

- [ ] **US-REF-001**: Chia sẻ mã giới thiệu & điều hướng liên kết `/r/:code`

  - **Slug:** `referral-sharing-and-link-redirection`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Should-Have (P1)
  - **Depends-on:** `US-READ-001`
  - **Blocks:** `US-REF-002`
  - **Mô tả:** Mỗi người dùng sở hữu một mã giới thiệu 8 ký tự; có thể sao chép liên kết chia sẻ dạng `https://<domain>/r/:code` để mời bạn bè. Khi bạn bè bấm vào link, hệ thống ghi nhớ mã giới thiệu qua cookie và điều hướng tới trang đăng ký.
  - **Acceptance Criteria (AC):**
    - [ ] Màn hình `/referral` hiển thị mã giới thiệu cá nhân nổi bật dạng ASCII Box `[== PALM8888 ==]`, nút "Sao chép mã" và nút "Sao chép liên kết mời".
    - [ ] Mẫu văn bản chia sẻ gợi ý: `"Nhập mã {CODE} trên PalmSight: bạn được tặng thêm 1 credit xem bói chỉ tay AI miễn phí!"`.
    - [ ] Hiển thị danh sách bạn bè đã mời thành công qua API `GET /me/referrals` kèm trạng thái (`REWARDED` hoặc `CAPPED`) và thời gian ghi nhận.
    - [ ] Route `/r/:code` phía client tự động bắt mã giới thiệu từ URL param, lưu vào cookie `ref_code` (thời hạn 7 ngày, SameSite=Lax) và tự động chuyển hướng người dùng sang trang `/register`.
    - [ ] Form đăng ký `/register` tự động đọc cookie `ref_code` và điền sẵn vào ô nhập mã giới thiệu (nếu có).
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Endpoint `GET /me/referrals` với phân trang cursor; trả về thống kê tổng số người đã giới thiệu và tổng credits kiếm được.
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP cho 2 màn hình:
        - Stitch Screen: `PalmSight - Landing Page` (`7cf746a450694080b4958a283e70d8dc` - Hero TUI mockup & nút Bắt đầu)
        - Stitch Screen: `PalmSight - Tài khoản` (`405bac78d239413cab5b68e8c3f9f0b3` - Mục Mã giới thiệu của tôi)
      - Thiết kế trang `/referral` chuẩn phong cách Terminal Minimalist; xử lý route `/r/:code` với logic cookie và redirect trong React Router.
  - **Deliverables khi [x]:**
    - `.specify/features/referral-sharing-and-link-redirection/baseline.md` (SIGNED-OFF)
    - `docs/features/referral-sharing-and-link-redirection/README.md`

- [ ] **US-REF-002**: Nhập mã giới thiệu nhận thưởng Credits & phòng chống gian lận

  - **Slug:** `referral-redemption-and-anti-abuse`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Should-Have (P1)
  - **Depends-on:** `US-REF-001`, `US-WALLET-001`
  - **Blocks:** `US-ACCT-001`
  - **Mô tả:** Người dùng nhập mã giới thiệu của bạn bè để nhận +1 credit và tặng người mời +2 credits. Hệ thống áp dụng nghiêm ngặt 6 tầng kiểm tra nghiệp vụ và xử lý cộng thưởng nguyên tử trong một MongoDB transaction.
  - **Acceptance Criteria (AC):**
    - [ ] Endpoint `POST /me/referral` thực hiện tuần tự 6 tầng kiểm tra:
      1. Kiểm tra tài khoản được phép nhập mã: không phải tài khoản tạo lại từ email/identities đã xóa (`REFERRAL_NOT_ALLOWED` - 403).
      2. Kiểm tra mã tồn tại trong hệ thống (`REFERRAL_CODE_NOT_FOUND` - 404).
      3. Kiểm tra không được tự nhập mã của chính mình (`REFERRAL_SELF` - 422).
      4. Kiểm tra tài khoản chưa từng nhập mã trước đây (ràng buộc unique `referrals.refereeId` - 409 `REFERRAL_ALREADY_USED`).
      5. Chống chu trình giới thiệu chéo: chủ mã không phải là người do chính mình giới thiệu (`REFERRAL_CYCLE` - 422).
      6. Kiểm tra trần thưởng ngày của chủ mã: nếu chủ mã đã đạt trần `REFERRAL_DAILY_CAP` (10 lượt/ngày theo múi giờ Việt Nam), bản ghi được lưu với `status = CAPPED` (người nhập vẫn nhận +1 credit `REFEREE_BONUS`, chủ mã không được cộng thêm).
    - [ ] Nếu vượt qua cả 6 kiểm tra: lưu bản ghi với `status = REWARDED`; người nhập nhận +1 credit (`REFEREE_BONUS`), chủ mã nhận +2 credits (`REFERRAL_BONUS`) trong cùng một MongoDB transaction.
    - [ ] Hỗ trợ áp dụng mã tự động ngay lúc xác minh email đăng ký (nếu người dùng đã điền mã trong form đăng ký).
    - [ ] Màn hình `/referral/enter` hỗ trợ người dùng nhập mã bổ sung bất kỳ lúc nào sau khi đăng nhập (miễn là trường `canEnterCode == true`).
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Xây dựng `ReferralsService` và controller `POST /me/referral`; tích hợp transaction liên thông với `CreditLedgerService`; viết kịch bản test đầy đủ cho 6 ca từ chối và ca trần ngày CAPPED.
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP:
        - Stitch Screen: `PalmSight - Nhập mã giới thiệu` (`f5d217aa5f13413fafe761311d74aec1`)
      - Thiết kế màn hình `/referral/enter` với các trạng thái thông báo lỗi/thành công bằng tiếng Việt chuẩn xác theo thiết kế Terminal.
  - **Deliverables khi [x]:**
    - `.specify/features/referral-redemption-and-anti-abuse/baseline.md` (SIGNED-OFF)
    - `docs/features/referral-redemption-and-anti-abuse/README.md`

- [ ] **US-ACCT-001**: Quản lý hồ sơ cá nhân & trang điều khoản / hướng dẫn xóa dữ liệu
  - **Slug:** `account-profile-and-compliance-pages`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Should-Have (P1)
  - **Depends-on:** `US-REF-002`
  - **Blocks:** `US-DEPLOY-01`
  - **Mô tả:** Người dùng có thể xem thông tin tài khoản (ID tài khoản, email, username, các tài khoản mạng xã hội đã liên kết), đăng xuất phiên, và xem các trang thông tin pháp lý bắt buộc (Chính sách quyền riêng tư, Điều khoản sử dụng, Hướng dẫn yêu cầu xóa tài khoản qua email).
  - **Acceptance Criteria (AC):**
    - [ ] Màn hình `/account` hiển thị thông tin người dùng: Tên hiển thị, Username, Email, danh sách các tài khoản OAuth đã liên kết (Google, Facebook).
    - [ ] Hiển thị rõ **ID tài khoản** (MongoDB ObjectId) kèm nút bấm "Sao chép ID" để người dùng cung cấp khi gửi email yêu cầu hỗ trợ hoặc xóa dữ liệu.
    - [ ] Hiển thị tùy chọn "Đổi mật khẩu" (dẫn tới `/account/password`) hoặc "Nhập mã giới thiệu" nếu `canEnterCode == true`.
    - [ ] Nút "Đăng xuất" gọi `POST /auth/logout` thu hồi session trên server, xóa cookie `rt`, xóa access token trong memory và chuyển về `/login`.
    - [ ] **Tuyệt đối không có nút tự xóa tài khoản trong app**. Thay vào đó là liên kết nhỏ dẫn tới trang `/data-deletion`.
    - [ ] Xây dựng các trang tĩnh chuẩn SEO/PWA: `/privacy` (Chính sách bảo mật, cam kết xóa EXIF ảnh), `/terms` (Điều khoản sử dụng giải trí), `/data-deletion` (Hướng dẫn gửi email tới `support@palmsight.app` kèm ID tài khoản; giải thích việc lưu trữ hash HMAC để chống gian lận credits theo ADR-0009).
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Script quản trị dòng lệnh `backend/scripts/users:delete` hỗ trợ xóa user theo ID, ghi nhận mã băm vào `deleted_identities`, và thu hồi toàn bộ sessions; script `credits:reconcile` để đối soát số dư.
    - [ ] **Frontend:**
      - Tích hợp và đối soát độ tương đồng (Fidelity Check) qua `get_screen` Stitch MCP cho 2 màn hình:
        - Stitch Screen: `PalmSight - Tài khoản` (`405bac78d239413cab5b68e8c3f9f0b3`)
        - Stitch Screen: `PalmSight - Hướng dẫn xoá dữ liệu` (`7eaf92fbe7444a19b53c3a6c5f227dd2`)
      - Thiết kế trang `/account`, và các trang tĩnh `/privacy`, `/terms`, `/data-deletion` bằng Tailwind CSS theo đúng styleguide Terminal Minimalist.
  - **Deliverables khi [x]:**
    - `.specify/features/account-profile-and-compliance-pages/baseline.md` (SIGNED-OFF)
    - `docs/features/account-profile-and-compliance-pages/README.md`

---

## 🚀 Sprint 4: Production Hardening & Go-Live (P0)

> **Mục tiêu Sprint:** Kiểm tra và chốt toàn bộ các tiêu chí bảo mật Pre-Deploy, khởi tạo database MongoDB Replica Set trên Cloud (Atlas M0), deploy backend NestJS lên Render, deploy frontend React Vite lên Vercel kèm SPA routing fallback, và chạy bộ kiểm thử khói Playwright trên URL production thực tế.

- [ ] **US-DEPLOY-01**: Security Hardening & Secret Audit (Pre-Deploy SEC-01 → SEC-03)

  - **Slug:** `deploy-security-hardening-and-audit`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-ACCT-001`
  - **Blocks:** `US-DEPLOY-02`
  - **Mô tả:** Rà soát mã nguồn toàn dự án để loại bỏ triệt để các secret hardcode, tạo khóa bí mật JWT ngẫu nhiên chuẩn mã hóa quân sự, và cấu hình CORS whitelist bảo vệ backend API.
  - **Acceptance Criteria (AC):**
    - [ ] **SEC-01**: Quét toàn bộ repository, đảm bảo không có API key (Groq, Gemini, Gmail App Password), connection string, hoặc secret nào nằm trong mã nguồn; toàn bộ được nạp từ biến môi trường (`.env`).
    - [ ] **SEC-02**: Sinh bộ khóa bí mật ngẫu nhiên mạnh bằng lệnh `openssl rand -hex 64` cho `JWT_SECRET`, `JWT_REFRESH_SECRET`, và `HMAC_SECRET`.
    - [ ] **SEC-03**: Cấu hình CORS whitelist trên NestJS chỉ cho phép domain Frontend thực tế trên production, tuyệt đối không dùng ký tự đại diện `*`.
    - [ ] Thiết lập HTTP Security Headers (Helmet, Content-Security-Policy) và cấu hình cookie `rt` với cờ `Secure; HttpOnly; SameSite=Lax`.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Cấu hình NestJS `main.ts` với Helmet, strict CORS policy, validation pipe toàn cục; kiểm tra file `.env.example` đầy đủ và không lộ secret thật.
    - [ ] **Frontend:** Cấu hình CSP meta tags và kiểm tra không bundle biến môi trường bí mật vào client build.
  - **Deliverables khi [x]:**
    - Báo cáo kiểm tra bảo mật Pre-Deploy Signed-Off trong `docs/deployment.md`.

- [ ] **US-DEPLOY-02**: Cloud Database Setup & MongoDB Replica Set

  - **Slug:** `deploy-cloud-database-replica-set`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-DEPLOY-01`
  - **Blocks:** `US-DEPLOY-03`
  - **Mô tả:** Khởi tạo cụm cơ sở dữ liệu MongoDB Atlas (Tier M0 miễn phí) có tính năng Replica Set để phục vụ MongoDB Transactions, tạo người dùng phân quyền và đồng bộ chỉ mục (indexes).
  - **Acceptance Criteria (AC):**
    - [ ] **DB-01**: Cụm MongoDB Atlas M0 sẵn sàng, kết nối thành công qua giao thức `mongodb+srv://` với TLS/SSL kích hoạt bắt buộc.
    - [ ] Khởi tạo 2 tài khoản database riêng biệt: `palmsight-app` (quyền `readWrite` cho backend API) và `palmsight-readonly` (quyền `read` phục vụ script audit định kỳ).
    - [ ] Chạy script `pnpm --filter backend db:sync-indexes` tạo đầy đủ 100% các unique index và TTL index theo đặc tả `database-erd.md` (chặn trùng email, username, tokenHash, signup bonus).
    - [ ] Cấu hình Network Access IP Whitelist (cho phép IP của Render service hoặc dải IP cần thiết).
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Chạy và kiểm tra script `db:sync-indexes`, script `db:check` đảm bảo không có dữ liệu sai lệch ban đầu.
  - **Deliverables khi [x]:**
    - Nhật ký khởi tạo Database Cloud và sync index thành công.

- [ ] **US-DEPLOY-03**: Backend API Deployment & Health Check Verification

  - **Slug:** `deploy-backend-render-healthcheck`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-DEPLOY-02`
  - **Blocks:** `US-DEPLOY-04`
  - **Mô tả:** Đóng gói và triển khai Backend NestJS lên Render (Web Service), nạp đầy đủ biến môi trường bí mật và xác minh endpoint kiểm tra sức khỏe hoạt động ổn định.
  - **Acceptance Criteria (AC):**
    - [ ] **API-01**: Triển khai service NestJS lên Render bằng Dockerfile hoặc Node native build.
    - [ ] Cấu hình đầy đủ các biến môi trường production (`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `SMTP_*`).
    - [ ] Endpoint `GET /api/v1/health` trả về HTTP 200 `{ status: "ok", timestamp: "..." }` ngay lập tức.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Backend:** Tạo health module (`@nestjs/terminus` hoặc custom controller), Dockerfile tối ưu kích thước multi-stage build cho Node 22 Alpine.
  - **Deliverables khi [x]:**
    - URL API production sống (`https://api.palmsight.app/api/v1/health` hoặc Render URL) trả về HTTP 200.

- [ ] **US-DEPLOY-04**: Frontend Deployment & SPA Routing Fallback Verification

  - **Slug:** `deploy-frontend-vercel-spa-fallback`
  - **Effort:** S
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-DEPLOY-03`
  - **Blocks:** `US-DEPLOY-05`
  - **Mô tả:** Triển khai Frontend React Vite lên Vercel, cấu hình reverse proxy / rewrite cho `/api/v1` sang backend Render, và cấu hình fallback SPA định tuyến không bị lỗi 404 khi người dùng refresh trang con.
  - **Acceptance Criteria (AC):**
    - [ ] **WEB-01**: Frontend SPA được build và deploy thành công trên Vercel với custom domain hoặc subdomain chính thức.
    - [x] File `vercel.json` định cấu hình rewrite: chuyển hướng toàn bộ `/api/v1/*` sang Render backend service, bảo đảm Frontend và API hoạt động cùng nguồn gốc (Same-Origin) để cookie `rt` lưu trữ trơn tru.
    - [x] Cấu hình SPA routing fallback (`cleanUrls: true`, rewrite `/(.*)` sang `/index.html`): khi refresh trực tiếp ở các route sâu như `/readings/6710a1b2c3d4e5f6a7b8c9d0`, `/scan`, `/referral` không bao giờ bị lỗi 404.
    - [x] PWA manifest hoạt động chuẩn, cài đặt thử nghiệm ra màn hình chính (Add to Home Screen) trên thiết bị di động hiển thị đúng icon và splash screen Terminal.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [x] **Frontend:** Cấu hình file `vercel.json`, `vite.config.ts`, kiểm tra build tĩnh `pnpm --filter frontend build` không sinh lỗi TypeScript hay asset path sai.
  - **Deliverables khi [x]:**
    - URL Web production sống, tải mượt mà dưới 2 giây và refresh không gặp 404.

- [ ] **US-DEPLOY-05**: Production End-to-End Smoke Test
  - **Slug:** `deploy-production-e2e-smoke-test`
  - **Effort:** M
  - **Context-budget:** single-session
  - **Priority:** Must-Have (P0)
  - **Depends-on:** `US-DEPLOY-04`
  - **Blocks:** _(none)_
  - **Mô tả:** Chạy bộ kiểm thử tự động Playwright End-to-End toàn diện trên môi trường production thực tế để xác nhận thông suốt toàn bộ luồng nghiệp vụ cốt lõi từ đăng ký đến bói chỉ tay.
  - **Acceptance Criteria (AC):**
    - [ ] **TEST-01**: Kịch bản E2E Smoke Test trên URL Production thực tế hoàn thành 100% pass:
      1. Đăng ký tài khoản mới và xác minh email thành công → Nhận +3 credits.
      2. Đăng nhập và mở màn hình `/scan` → Số dư hiển thị đúng 3 credits.
      3. Chọn trường phái Phương Tây, chọn bói toàn bộ, tải ảnh bàn tay mẫu hợp lệ.
      4. Bấm "Xem bói (-1 credit)" → AI xử lý thành công, số dư trừ còn 2 credits, màn hình hiển thị bài bói chi tiết.
      5. Mở màn hình `/wallet` → Thấy đủ 2 giao dịch: `SIGNUP_BONUS (+3)` và `READING_SPEND (-1)`.
      6. Mở màn hình `/referral` → Lấy link `/r/:code` và xác nhận cookie `ref_code` hoạt động chính xác.
    - [ ] Không có bất kỳ lỗi JavaScript runtime nào xuất hiện trên browser console.
  - **Tasks (Phân rã kỹ thuật cho Subagents):**
    - [ ] **Testing:** Chạy test suite `pnpm test:e2e` Playwright hướng vào biến môi trường `PROD_URL=https://...`, thu thập ảnh chụp và báo cáo test kết quả.
  - **Deliverables khi [x]:**
    - Playwright HTML Report xanh 100% kèm ảnh chụp màn hình thực tế lưu tại `docs/user-guides/`.

---

## 🔮 Backlog Dự Kiến — Future Horizons (V2.0+)

> Các ý tưởng mở rộng giá trị kinh doanh cho PalmSight sau khi phiên bản MVP v1.0 chứng minh được mức độ tiếp nhận của thị trường. Không đưa vào scope phát triển hiện tại.

- [~] **US-FUTURE-001**: Tích hợp Cổng thanh toán nạp Credits (Stripe / Apple Pay / VNPay) cho phép mua các gói 10, 50, 100 credits khi hết lượt mời bạn bè.
- [~] **US-FUTURE-002**: So sánh độ tương hợp chỉ tay giữa 2 người (Couple Palm Reading) chấm điểm hòa hợp tình duyên và sự nghiệp.
- [~] **US-FUTURE-003**: Tạo ảnh thẻ chiêm tinh (Astrology Card / Tarot-style summary) tự động từ kết quả bói với hiệu ứng Terminal ấn tượng để chia sẻ nhanh lên Instagram Stories / TikTok.
- [~] **US-FUTURE-004**: Hỗ trợ đa ngôn ngữ quốc tế (English, Japanese, Chinese) và trường phái bói chỉ tay La Mã cổ đại.

---

## 🏁 Quy Chuẩn Định Nghĩa Hoàn Thành (Definition of Done - DoD)

Một User Story / Task chỉ được chuyển trạng thái từ `[/]` sang `[x]` khi đáp ứng đầy đủ 6 tiêu chí bắt buộc sau:

1. **Nghiệp vụ (Business Acceptance):** Đạt 100% tất cả các điều kiện trong mục Acceptance Criteria (AC), kiểm thử được pass/fail rõ ràng.
2. **Kiểm thử tự động (Automated Tests):**
   - **Backend:** 100% Controller, Service nghiệp vụ có Unit Test và Integration Test kiểm thử transaction MongoDB; tỷ lệ coverage tối thiểu > 80%.
   - **Frontend:** Các component render chính xác, tương tác state phản hồi tức thì, không có console warning / console error.
3. **Chất lượng mã nguồn (Code Quality Gate):**
   - Tuân thủ quy tắc bất biến: File code < 800 dòng, mỗi function < 50 dòng, dữ liệu bất biến (immutable pattern).
   - Kiểm tra và tuân thủ các checklist kiến trúc trong `.agents/skills/engineering/` (api-design, ui-taste-pro, codebase-design).
   - Sử dụng `code-review-graph` để kiểm tra tác động liên kết và đảm bảo không phá vỡ contracts giữa các modules.
4. **Đối soát độ tương đồng giao diện (Stitch UI Fidelity Check):**
   - Với mọi User Story có cấu phần Frontend, Developer bắt buộc đối soát giao diện với Stitch Screen tương ứng trong Project `PalmSight Terminal Landing Page` (`15464591816682045618`) thông qua công cụ `get_screen` của `StitchMCP`.
   - Giao diện tuân thủ tuyệt đối bảng màu Terminal Minimalist: canvas `#fdfcfc`, ink `#201d1d`, surface `#f8f7f7`/`#f1eeee`, hairline divider `rgba(15,0,0,0.12)` hoặc `#646262`, bo góc chuẩn `4px` (`rounded-sm`), font chữ monospace Berkeley Mono, ký hiệu ASCII `[+]`, `[-]`, `[x]`, `[ ]`, không sử dụng shadow hay gradient trang trí.
5. **Không có lỗi nghiêm trọng (Bug Severity Gate):** Đạt ngưỡng Zero Critical / Blocker bugs trước khi bàn giao.
6. **Tài liệu hóa (Living Documentation):** Cập nhật đầy đủ tài liệu baseline `.specify/features/<slug>/baseline.md` (SIGNED-OFF), tài liệu kỹ thuật `docs/features/<slug>/README.md` và hướng dẫn sử dụng `docs/user-guides/<slug>.md` kèm ảnh chụp thực tế bằng Playwright.

---

## 🚀 Kế Hoạch Phát Hành Production (Go-Live Plan)

### 1. Pre-Deploy Checklist (Bắt buộc trước khi Go-Live)

#### 🔴 Critical — Blockers tuyệt đối

- [ ] **SEC-01**: Loại bỏ toàn bộ credentials, API keys, database connection strings hardcoded; chuyển 100% sang biến môi trường (`.env`).
- [ ] **SEC-02**: Sinh JWT Secret, Refresh Secret và HMAC Secret mạnh bằng lệnh: `openssl rand -hex 64` (tuyệt đối không dùng secret mặc định khi dev).
- [ ] **SEC-03**: Cấu hình CORS whitelist trên NestJS chỉ cho phép duy nhất domain Frontend thực tế trên production (không dùng `*`).

#### 🟡 Important — Hoàn thành trước ngày mở cho người dùng

- [ ] **DB-01**: Khởi tạo MongoDB Atlas Replica Set (Cluster M0) và chạy script đồng bộ index an toàn (`pnpm --filter backend db:sync-indexes`).
- [ ] **API-01**: Triển khai Backend API service lên Render; xác nhận endpoint kiểm tra sức khỏe `GET /api/v1/health` trả về HTTP 200.
- [ ] **WEB-01**: Triển khai Frontend SPA lên Vercel; xác nhận cấu hình rewrite `/api/v1` và SPA routing fallback hoạt động chuẩn (refresh không bị 404).
- [ ] **TEST-01**: Chạy bộ Playwright smoke test toàn bộ happy path trên domain production thực tế.

#### 🟢 Nice-to-have — Sau khi Go-Live

- [ ] **OBS-01**: Tích hợp Sentry / GlitchTip để theo dõi và thu thập runtime exceptions phía backend và client.
- [ ] **OBS-02**: Cấu hình UptimeRobot theo dõi định kỳ endpoint `/api/v1/health` để nhận cảnh báo ngay khi server gặp sự cố.

---

### 2. Biến Môi Trường Production Mẫu (.env Template)

```bash
# ── Môi trường chạy ───────────────────────────────────────────
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://palmsight.app

# ── Cơ sở dữ liệu MongoDB Replica Set ────────────────────────
# Bắt buộc là Replica Set (MongoDB Atlas M0 có sẵn)
MONGODB_URI=mongodb+srv://palmsight-app:<strong_password>@cluster0.mongodb.net/palmsight?retryWrites=true&w=majority

# ── Khóa bảo mật & Xác thực (Sinh bằng openssl rand -hex 64) ──
JWT_SECRET=f9a8b7c6d5e4f3a2b1c0... # openssl rand -hex 64
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=1a2b3c4d5e6f7a8b9c0... # openssl rand -hex 64
JWT_REFRESH_EXPIRES_IN=30d
HMAC_SECRET=9f8e7d6c5b4a3... # Khóa băm danh tính tài khoản đã xóa (ADR-0009)

# ── OAuth Providers (Google & Facebook) ──────────────────────
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx

# ── Dịch vụ Email (Gmail SMTP App Password) ──────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=palmsight.app@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
SUPPORT_EMAIL=support@palmsight.app

# ── Trí tuệ Nhân tạo (Gemini Vision & Groq Fallback) ─────────
AI_PROVIDER=gemini
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxx
AI_FALLBACK_PROVIDER=groq
AI_FALLBACK_MODEL=qwen/qwen3.8-27b
AI_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
AI_TIMEOUT_MS=40000

# ── Quy tắc Credits Hằng số ──────────────────────────────────
SIGNUP_BONUS_CREDITS=3
REFERRAL_REWARD_CREDITS=2
REFEREE_REWARD_CREDITS=1
READING_COST_CREDITS=1
REFERRAL_DAILY_CAP=10
```

---

### 3. Sprint Go-Live Tracking

- [ ] **US-DEPLOY-01**: Security Hardening & Secret Audit (Pre-Deploy SEC-01 → SEC-03)
- [ ] **US-DEPLOY-02**: Cloud Database Setup & MongoDB Replica Set Migration (DB-01)
- [ ] **US-DEPLOY-03**: Backend API Deployment & Health Check Verification (API-01)
- [ ] **US-DEPLOY-04**: Frontend Deployment & SPA Routing Fallback Verification (WEB-01)
- [ ] **US-DEPLOY-05**: Production End-to-End Smoke Test (TEST-01)

---

## 📝 Ghi Chú Quan Trọng Cho AI

> Subagents đọc phần này để nắm vững quy tắc điều phối và phân rã công việc khi thực thi `/command-continue-project`. Tuyệt đối không xóa.

### Quy tắc quét và thực thi của `/command-continue-project`:

1. **Step 1 (Context Injection & Tool Loading)**:
   - Đọc thông số `tech-stack` và `mcp-tools` (`StitchMCP`, `code-review-graph`) từ YAML frontmatter ở đầu tài liệu và đưa vào system prompt của toàn bộ subagent (`backend-developer`, `frontend-developer`, `qa-engineer`).
   - Khi thực hiện nhiệm vụ Frontend, subagent bắt buộc kết nối `StitchMCP` với project ID `15464591816682045618` để đối chiếu layout và style qua `get_screen`.
2. **Step 2 (Story Selection)**: Ưu tiên tìm story mang trạng thái `[/]` (In Progress) để tiếp tục thực hiện cho xong trước. Nếu không có story nào đang dang dở, chọn story `[ ]` (To Do) đầu tiên theo thứ tự từ trên xuống dưới (bắt đầu từ `SETUP-001` thuộc Sprint 0).
3. **Step 3 (Blocked Gate)**:
   - Nếu story tiếp theo mang nhãn `[!]` (Blocked): **DỪNG LẠI NGAY LẬP TỨC**, gửi thông báo cảnh báo rõ ràng tới người dùng về rào cản kỹ thuật hoặc quyết định kiến trúc còn vướng; chủ động đề xuất kích hoạt phiên `grilling` để tháo gỡ điểm nghẽn.
   - Bỏ qua toàn bộ các mục mang nhãn `[~]` (Deferred / Future Horizons).
4. **Step 4 (Dependency Gate)**: Kiểm tra trường `Depends-on` của story được chọn. Nếu story phụ thuộc chưa đạt trạng thái `[x]`, **từ chối triển khai story này**, cảnh báo blocked và chuyển sang thực thi story phụ thuộc trước.
5. **Step 5 (Effort & Budget Routing)**:
   - `Effort: S` + `single-session` → **Fast-Track BA**: Đặc tả 2–3 câu cô đọng, bỏ qua bước gap-analysis rườm rà.
   - `Effort: M` + `single-session` → **Bounded Task BA**: Thực hiện tuần tự các bước 1 → 2 → 4 → 5 → 6 → 7 → 8.
   - `Effort: L | XL` + `multi-session` → **Full Feature BA**: Thực hiện đầy đủ 8 giai đoạn đặc tả và gọi `wayfinder` phân rã kiến trúc trước khi bắt tay vào code.
6. **Step 6 (Task Allocation)**: Trong Phase 5 (Implementation), phân rã nhiệm vụ kỹ thuật trực tiếp từ mục `Tasks: Backend / Frontend` tương ứng cho `backend-developer` và `frontend-developer`.
7. **Step 7 (Go-Live Sprints)**: Đối với các story thuộc nhóm `US-DEPLOY-###`, thực thi theo quy trình Pre-Deploy Verification và Smoke Test thay cho quy trình BA thông thường.
8. **Step 8 (Completion Gate)**: Một User Story chỉ được chuyển sang trạng thái `[x]` sau khi:
   - Toàn bộ bài kiểm thử `e2e-runner` pass (không console errors).
   - Fidelity check đối chiếu với Stitch Screen hoàn tất qua StitchMCP.
   - `tech-doc-architect` cập nhật tài liệu kỹ thuật `docs/features/<slug>/README.md`.
   - `user-guide-creator` đã ghi lại ảnh chụp màn hình Playwright thực tế tại `docs/user-guides/<slug>.md`.
