# Kế hoạch thống nhất PalmSight

Cập nhật: 2026-11-05. Nhánh: `feat/advertise`. Trạng thái: **chưa bắt đầu theo hướng chỉ có app**. Working tree có 26 file sửa chưa commit, làm lúc 12:05 đến 12:35 ngày 2026-11-05 theo bản kế hoạch cũ, chưa rõ tác giả và chưa review. Phải đối chiếu các thay đổi này với kế hoạch dưới đây trước khi làm tiếp.

**Hướng sản phẩm đã chốt: chỉ phát hành app Android, không còn bản web.** Repo này là nguồn duy nhất cho app, backend và các trang chính sách.

Tài liệu này đủ để một phiên mới làm tiếp mà không cần đọc lại hội thoại. Bằng chứng `file:dòng` nằm ở phụ lục cuối file. Số dòng có thể đã lệch, nên đọc lại code trước khi sửa.

## Quy tắc làm việc

- Chỉ chủ app commit. Không agent nào được commit, stage hay push.
- Không deploy. Không xoá dữ liệu hoặc ghi DB nếu chưa báo và chưa được xác nhận.
- Không in giá trị secret. `backend/.env` trỏ vào MongoDB Atlas thật.
- Test backend không đọc `.env` (`ignoreEnvFile: true` trong `backend/test/test-helper.ts`), giữ nguyên để tránh gọi Cloudinary thật.
- Sau mỗi nhóm việc: chạy full test shared, backend, mobile; review; chủ app commit.

## Bối cảnh đã chốt

| Chủ đề | Thực tế |
|---|---|
| Người dùng | Chưa có người dùng cuối. Render và Vercel hiện chỉ là bản thử |
| Tài khoản | Mỗi thiết bị là một tài khoản khách, tạo tự động khi mở app. Không đăng nhập |
| Route auth app dùng | Chỉ `/auth/device` và `/auth/refresh` |
| Backend giữ lại | `boi-qvgy.onrender.com`. Cần xác nhận service này có deploy từ repo này không, vì hiện trả 404 cho `/currency/earn` |
| Backend bỏ | `palmsight-backend` và site `palm-sight-theta.vercel.app`, có thể tắt vì trang chính sách mới đã chạy |
| `palmsight.app` | Không phân giải được, không được dùng làm mặc định |
| Database | Atlas DB `boi`. `backend/.env` đang dùng chung, cần tách DB dev trước khi ra mắt |
| Lưu ảnh trong code | Cloudinary. Production lỗi thì không lưu ảnh; dev lưu base64 |
| Ảnh cũ trong DB | 90 ảnh gốc và 70 ảnh đã vẽ dạng base64, khoảng 14 MB ảnh gốc (đo ngày 2026-11-05) |
| Cloudinary thật | Chỉ 1 ảnh lưu đúng, nên Render nhiều khả năng chưa cấu hình `CLOUDINARY_*` |

## Quyết định đã chốt

- Tên guest: "Nhà chiêm tinh" / "Stargazer" theo ngôn ngữ. Avatar bỏ bóng vàng.
- Bản chính sách đã được duyệt: https://claude.ai/artifact/8uePn95qz1wAn6RMV81nSx. Phải sửa lại cho phù hợp với hướng chỉ có app (nhóm B2).
- Giữ quy tắc thiết bị từng xoá tài khoản. Giữ quảng cáo khi back từ sửa hồ sơ. Giữ gap 60 giây cho ads user.
- Email hỗ trợ: `palmsight.app@gmail.com`.
- Trong app chỉ có nút "Xoá tài khoản", không thêm nút "Xoá dữ liệu" riêng.
- Xoá ảnh base64 cũ, không chuyển lên Cloudinary.
- Chính sách hiện trong app bằng trình duyệt nội bộ, mở từ trang tĩnh công khai. Không viết màn hình riêng, để chỉ có một bản nội dung.

## Khuyến nghị mặc định

Chủ app đồng ý làm theo khuyến nghị. Hai mục dưới cần xác nhận lại trước khi đăng chính sách, vì còn phụ thuộc pháp lý.

| Dữ liệu | Thời hạn đề xuất |
|---|---|
| Giao dịch VIP: chỉ mã đơn, gói, số tiền, ngày | 10 năm rồi xoá. Không giữ `gaid`, `adjustAdid`, `rawResponse` |
| Mã băm thiết bị và định danh | 5 năm rồi xoá |

## Nhóm A: bỏ web và làm gọn

Làm theo thứ tự. Mỗi bước để lại repo chạy được.

### A1. Tách trang chính sách ra `legal/`
- Chuyển `privacy.html`, `terms.html`, `data-deletion.html` từ `frontend/public/` sang `legal/`, kèm CSS cần thiết. Không còn phụ thuộc app web.
- Dùng `cleanUrls` để có `/privacy`, `/terms`, `/data-deletion`. Chủ app đã chọn tạo project Vercel **mới** với Root Directory là `legal/`, Framework Preset Other, rồi gửi URL. Không nối vào project `palm-sight-theta`.
- Đã deploy `legal/` tại `https://boi-two-delta.vercel.app`. Chỉ `EXPO_PUBLIC_WEB_URL` trong `eas.json` và fallback trong `ads-config.ts` giữ URL; backend dùng `PUBLIC_BASE_URL`.
- Nội dung vòng 3 trong `PrivacyContent.tsx` và `DataDeletionContent.tsx` là bản mới nhất, đối chiếu trước khi xoá `frontend/`.
- Xem có cần `app-ads.txt` ở domain này không.

### A2. Trỏ app sang trang mới
- Đặt `EXPO_PUBLIC_WEB_URL` là URL của `legal/` trong `mobile-2/eas.json` cho preview và production.
- Đổi fallback `palmsight.app` trong `ads-config.ts`.
- `openDataDeletion()` trong `profile.tsx`: làm giống hàng Chính sách riêng tư, không im lặng khi lỗi, đi qua `runExternalActivity`.
- Thêm link Điều khoản vào Profile nếu chưa có.

### A3. Xoá tài khoản ngay trong app (việc mới)
- Tài khoản khách không có email nên quy trình gửi email không dùng được.
- Thêm nút xoá tài khoản ở Profile, có bước xác nhận, đủ 9 ngôn ngữ.
- Thêm endpoint backend dùng lại logic của `scripts/users-delete.ts`.
- `data-deletion.html` hướng dẫn theo nút này, kèm đường liên hệ cho người đã gỡ app.
- Nhắc người dùng huỷ VIP trong Google Play.

### A4. Link giới thiệu
- Link hiện trỏ route `ReferralRedirect` trên web. Đổi sang Play Store hoặc trang tĩnh. Giữ nhập mã tay.
- Kiểm `ReferralSection` và `ReferralShareCard` phía app nếu dùng domain cũ.

### A5. Xoá route web trong backend
- Bỏ `register`, `resend-verification`, `verify-email`, `login`, `forgot-password`, `reset-password`, `logout`, `google`, `google/browser/*`, `facebook`.
- Bỏ `/readings/guest`, claim token, guest trial và TTL liên quan.
- Bỏ mail service, `password_resets`, `pending_registrations` và biến môi trường đi kèm, sau khi `git grep` xác nhận không còn nơi dùng.
- Kiểm `/me/password`: mobile có gọi nhưng tài khoản khách không có mật khẩu. Nếu là code thừa thì bỏ cả hai phía.
- `users-delete.ts` vẫn phải xử lý được tài khoản cũ có email, Google hoặc Facebook trong DB.
- Giữ `/auth/device`, `/auth/refresh`, `/me*`, `/readings`, `/currency/*`, `/billing/*`, `/config`.

### A6. Xoá `frontend/`
- Làm sau A1 đến A5.
- Bỏ khỏi `pnpm-workspace.yaml`, script ở `package.json`, CI, `vercel.json`, Dockerfile nếu có. Giữ `shared`.

## Nhóm B: sửa hành vi code của app

### B1. Xoá ảnh không được báo thành công giả (mục 2)
- `readings.service.ts`: chỉ null `publicId` khi Cloudinary xoá thành công, lỗi thì báo lỗi và giữ để retry.
- Logic xoá tài khoản: báo rõ ảnh chưa xoá được, không in SUCCESS giả.
- Thay avatar: không bỏ mồ côi ảnh cũ.

### B2. Xoá dữ liệu đầy đủ khi xoá tài khoản (mục 3)
- Xoá hoặc ẩn `gaid`, `adjustAdid`, `rawResponse`, `billing_events.payload`, `signupIpHash`.
- Giữ phần đối soát. Kiểm `ad_rewards`, `referrals`, `devices`.
- Giữ cơ chế chống farm: `deviceIdHash` và `deleted_identities`.

### B3. Quyền Android (mục 5, 12)
- Bỏ `RECORD_AUDIO` khỏi `mobile-2/app.json`, đặt `recordAudioAndroid: false` cho plugin expo-camera.
- Bỏ bước xin quyền Thông báo cho tới khi có tính năng thông báo.
- Xác minh bằng merged manifest của bản build, gồm `AD_ID`, ảnh, `SYSTEM_ALERT_WINDOW`.

### B4. Xác nhận từ 16 tuổi (mục 13)
- Thêm vào onboarding, đủ 9 ngôn ngữ.

### B5. Consent và đo lường (mục 4)
- Trước mắt sửa câu chính sách cho khớp code. Chỉ Adjust bị chặn khi khởi tạo; doanh thu và Firebase vẫn gửi.
- Sau đó quyết định có chặn thật theo khu vực không.
- Kiểm URL chính sách truyền cho luồng đồng ý của MAX.

### B6. Hash IP và dữ liệu thô (mục 14)
- Chuyển `hashIp` sang HMAC. Nêu đúng việc lưu GAID và ADID trong chính sách, hoặc thôi lưu.

## Nhóm C: nội dung chính sách và tài liệu

Làm sát ngày ra mắt, sau nhóm A và B.

### C1. Chính sách riêng tư (`legal/privacy.html` và Claude Doc)
- Sửa theo hướng chỉ có app: bỏ "Android và web", đăng ký email, Google, Facebook, "Đăng ký chưa xác minh", "Lượt dùng thử không đăng nhập". Bỏ Google và Facebook khỏi bảng bên thứ ba.
- Mục 7: xoá tài khoản bằng nút trong app.
- Mục 4: nêu đúng phạm vi consent.
- Mục 14: nêu GAID và ADID nếu vẫn giữ.
- Mục 15: thêm "ảnh có thể không lưu được".
- Mục 16: GEM không phải "ẩn danh" thật; vé thưởng giữ 48 giờ; thêm chọn ảnh từ thư viện.
- Mục 4 của bảng lưu trữ: thêm thời hạn VIP và mã băm.
- Rà lại cam kết "không bán dữ liệu" với chia sẻ GAID cho mạng quảng cáo.
- Điền đủ các chỗ `[ĐIỀN]` và `[XÁC NHẬN]`.

### C2. Điều khoản (`legal/terms.html`) (mục 7)
- Bổ sung VIP, tự gia hạn, Google Play, hoàn tiền, quảng cáo, 16+, GEM. **Chủ app duyệt nội dung trước khi đăng.**

### C3. Chữ trong app (mục 11)
- Thay "ảnh được bảo vệ" bằng "ảnh được truyền qua kết nối mã hoá", đủ 9 ngôn ngữ.
- Rà checkbox đồng ý khi quét: phải nói ảnh được lưu trên Cloudinary.
- Đổi nhãn "Quyền riêng tư quảng cáo" hoặc câu chính sách cho khớp nhau.
- Kiểm chuỗi còn nhắc đăng nhập.

### C4. Tài liệu (mục 18, 19, 22)
- Playbook và tên test ghi 60 giây.
- README, `business-rules`, `api-contract`, `database-erd`, `security-privacy`, `mobile-2/README`: giá 5 GEM, quà 5, giới thiệu +5/+3, thay rewarded `/ads/rewarded/*` bằng `/currency/ad-rewards`, thêm endpoint còn thiếu, bỏ phần web.
- Bỏ câu "không lưu ảnh" trong `PRODUCT_BACKLOG_ROADMAP.md`, sửa comment `image-processor.service.ts:75`.
- Đánh dấu backlog cũ là lịch sử. Ghi rõ `docs/adr/` không có trong repo.

### C5. Cấu hình (mục 9, 17)
- `render.yaml` mô tả đúng `boi-qvgy`.
- Khai đủ biến (`GUEST_TRIAL_SECRET` nếu còn dùng, `ENFORCE_VIP_SCHOOLS`, `SUB_*_ID`, `CLOUDINARY_AVATAR_FOLDER`), xoá biến chết (`SUPPORT_EMAIL`, `IMAGE_MAX_*`, `MAX_REWARD_EVENT_KEY`).
- Tách database dev khỏi database chính thức.

## Thứ tự deploy

1. Đổi mật khẩu MongoDB và Cloudinary secret, cập nhật `.env` và Render.
2. Trỏ `boi-qvgy` về repo này, đặt `CLOUDINARY_*`.
3. Deploy backend, quét thử, xác nhận ảnh lên Cloudinary.
4. Deploy `legal/`, kiểm 3 URL công khai.
5. Xoá ảnh base64 cũ (mục 21): đếm lại, chủ app xác nhận rồi mới chạy. Không hoàn tác được.
6. Tắt `palmsight-backend` và site Vercel cũ.
7. Build lại app, vì `EXPO_PUBLIC_*` được gắn lúc build.

## Chủ app cần cung cấp

| Thông tin | Khi nào cần |
|---|---|
| `boi-qvgy` đang deploy từ repo và branch nào | Trước khi deploy |
| Tên và địa chỉ người vận hành | Trước khi ra mắt |
| Xác nhận nhà cung cấp: Gmail, Render, Vercel, MongoDB Atlas, Cloudinary | Trước C1 |
| Gói Gemini và Groq, kiểm điều khoản huấn luyện | Trước khi ghi "không huấn luyện" |
| Thời hạn lưu VIP và mã băm, ý kiến pháp lý | Trước khi đăng chính sách |
| Ngày đăng | Lúc deploy |

## Kiểm tra ngoài repo

- Render: biến môi trường, `ENFORCE_VIP_SCHOOLS`.
- Play Console: URL chính sách, URL xoá dữ liệu, Data Safety, Advertising ID, Content rating, độ tuổi, id và giá gói.
- AdMob: UMP và callback SSV cũ. MAX, Adjust: cấu hình consent.
- Meta: app có khai trong Audience Network không, URL chính sách nào.
- Cloudinary: chế độ truy cập, vì ảnh đang là URL công khai.
- Pháp lý: ảnh bàn tay, Nghị định 13/2023, GDPR, CCPA.

## Cách tiếp tục

Nói với phiên mới: "đọc `docs/CONSISTENCY_PLAN.md` và bắt đầu nhóm A". Phiên mới có thể chưa có phiên `boi-39`: khi đó giao bằng subagent hoặc tự làm, vẫn tuân thủ quy tắc ở đầu file.

---

# Phụ lục: báo cáo rà soát mâu thuẫn

Mã trong phụ lục (A1, D1, F1...) là mã của báo cáo gốc, khác với mã nhóm việc ở trên. Các mục chỉ liên quan đến web đã được lược bỏ: A1, D3, D6, F1, H4, I1, I2, I4, J2, J3, K2, K3.

## Cách làm và độ tin cậy

5 subagent quét song song theo khu vực (A+D, B+C+E, F+G, H+I+K, J). Mình KHÔNG chép nguyên kết quả: các mục dưới đây đã được gộp theo gốc rễ, và những khẳng định nặng ký đã được mình tự đọc lại code.

Mỗi mục có nhãn xác minh:
- **[đã xác minh]**: mình tự đọc lại file:dòng và thấy đúng.
- **[subagent]**: dựa trên báo cáo subagent có dẫn file:dòng, mình chưa tự đọc lại.
- **[ngoài repo]**: phụ thuộc Render/Vercel/Play/Meta/Cloudinary/luật, repo không trả lời được.

Hai điều chỉnh so với báo cáo thô:
1. Subagent B+C+E nghi `EXPO_PUBLIC_ADJUST_APP_TOKEN=Aj_Purchase` là token sai. Mình bỏ mục này: `docs/MONETIZATION_PLAYBOOK.md:104` ghi chủ app đã xác nhận giá trị đó đúng (2026-11-03) và dặn đừng sửa. Chỉ còn một chi tiết mơ hồ: playbook dòng 340 dùng chuỗi `Aj_Purchase` như tên sự kiện mua.
2. Phiên đánh giá cũ nói vòng quay "client 8 ô, server 6 giải". Đọc code hiện tại thì ĐÃ KHỚP (xem F5). Nhận định cũ đã lỗi thời.

Lưu ý nền: `docs/adr/` KHÔNG tồn tại trong repo (và chưa từng có commit), `CONTEXT.md` cũng không. Mọi link `adr/...` đều gãy, nên ADR-0007…0011 không đọc được. Mình không thể xác nhận nội dung ADR-0010 vs ADR-0011 mâu thuẫn nhau, chỉ suy ra trạng thái từ docs và code.

---

## TÓM TẮT: các mục CAO (nên xem trước)

| Mã | Nội dung một dòng |
|---|---|
| A2 | Xoá ảnh lỗi thì im lặng nhưng DB vẫn xoá `publicId`: ảnh mồ côi, policy hứa "xoá ngay" |
| D1 | Xoá tài khoản không đụng `play_subscriptions` (GAID, Adjust ADID, purchaseToken thô), `billing_events`, `ad_rewards`…; policy hứa xoá "thông tin nhận dạng" |
| E2 | Lời hứa "chưa đồng ý thì tắt chia sẻ đo lường, không đọc GAID" chỉ đúng cho Adjust init; Firebase và sự kiện doanh thu vẫn gửi |
| B1 | `RECORD_AUDIO` được khai (app.json + plugin expo-camera mặc định) nhưng app không ghi âm, policy không nhắc |
| F2/J3 | README/docs/api-contract ghi giá 1 credit, quà 3, giới thiệu +1/+2; code 5/5/+5/+3 |
| F3/J1 | Docs mô tả hệ thống rewarded ads SSV `/ads/rewarded/*` đã bị xoá khỏi backend |
| H1 | Điều khoản (web + HTML) không nói gì về VIP, tự gia hạn, quảng cáo, độ tuổi, hoàn tiền |
| H2 | Hai email hỗ trợ khác nhau (HTML tĩnh vs React); `SUPPORT_EMAIL` là biến chết |
| H3 | Trang pháp lý công khai còn placeholder, Terms/Data-deletion ghi "15/10/2026" |
| C1 | "100% Ẩn Danh" / "ảnh được bảo vệ" (ba câu hỏi vòng 3 đang chờ người dùng, KHÔNG làm) |

---

## A. LƯU ẢNH

### A2. CAO/TRUNG BÌNH. Xoá ảnh thất bại thì im lặng, nhưng policy hứa "xoá ngay"
- **Lời hứa:** policy mục 7 "Xoá một lần xem... Ảnh và kết quả bị xoá ngay"; ảnh đại diện/ảnh lòng bàn tay bị xoá khi xoá tài khoản.
- **Thực tế code:** [đã xác minh]
  - Xoá một lần xem: `readings.service.ts:542-558`: `Promise.all([deleteImage(...), deleteImage(...)])` không kiểm kết quả, sau đó luôn `updateOne` đặt `imageUrl`, `imagePublicId`... thành `null` và `deletedAt`. Cloudinary lỗi thì ảnh còn đó nhưng DB mất `publicId`, API vẫn thành công.
  - Xoá tài khoản: `backend/scripts/users-delete.ts` ghi DB, commit, rồi mới xoá Cloudinary bằng `Promise.allSettled` (`:180-185`) không kiểm giá trị trả về; thiếu cấu hình Cloudinary thì bỏ qua cả bước nhưng vẫn in SUCCESS. Thứ tự xoá giữa hai luồng khác nhau (Cloudinary rồi DB so với DB rồi Cloudinary).
  - Gỡ avatar xử lý đúng (502 và giữ nguyên) nhưng thay avatar chỉ log cảnh báo, để ảnh cũ mồ côi. [subagent: `avatar.service.ts:76-98,108-116`]
- **Câu hỏi:** (a) chỉ null `publicId` khi xoá Cloudinary thành công, lỗi thì 502/giữ để retry; (b) giữ nguyên và log `publicId` để dọn tay; (c) đổi lời hứa thành "xoá trong thời gian hợp lý". **Đề xuất (a)**: sửa ít nhất để khớp lời hứa.

### A3. TRUNG BÌNH. Upload Cloudinary lỗi (production): lần xem vẫn "thành công", trừ GEM, không có ảnh [subagent]
- **Lời hứa:** policy/FAQ/data-deletion "Ảnh của lần xem thành công được lưu trên Cloudinary"; mobile `scan.savedNote` "Ảnh được lưu cùng quẻ trong Lịch sử".
- **Thực tế:** [subagent] `cloudinary.service.ts:79-96` trả `null` ở production khi lỗi; `readings.service.ts:99-124, 335-356` vẫn đánh dấu DONE và trừ credit với `imageUrl = null`. Web đã có trạng thái "Không có ảnh lưu cho lần xem này" (`ReadingHeader.tsx`). Ngoài production thì lưu base64 vào Mongo (`local:` publicId), `render.yaml`/Dockerfile đặt `NODE_ENV=production` nên chỉ ảnh hưởng dev/staging.
- **Câu hỏi:** (a) coi lỗi upload ảnh là lỗi cả lần xem (hoàn GEM, báo lỗi); (b) giữ và thêm chữ "ảnh có thể không lưu được". **Đề xuất (b)** nếu ảnh chỉ là phụ, (a) nếu ảnh là phần của sản phẩm.

### A4. TRUNG BÌNH. Ảnh trên Cloudinary là URL công khai
- **Lời hứa:** mobile `home.costFull` "ảnh được bảo vệ" / "photo protected" (9 ngôn ngữ, `mobile-2/src/i18n/screen-strings.ts:26`); web FAQ.
- **Thực tế:** [subagent] `cloudinary.service.ts` dùng `secure_url` từ upload thường (không `type: authenticated`, không URL ký). `publicId` ảnh tay là `reading_<ObjectId>` (`readings.service.ts:100`), avatar dùng id ngẫu nhiên. Mình đã đọc các dòng `secure_url` trong service và không thấy tham số `type`/`access_mode`. Repo không có kiểm soát truy cập ảnh.
- [ngoài repo] Cài đặt tài khoản Cloudinary (restricted/strict) quyết định thực tế.
- **Câu hỏi:** (a) đổi chữ "ảnh được bảo vệ" thành lời đúng; (b) chuyển ảnh sang `authenticated` + URL ký; (c) giữ. **Đề xuất (a) ngay, (b) sau.** (Liên quan câu hỏi vòng 3 đang chờ.)

### A5. THẤP. ADR-0010 và ADR-0011 mâu thuẫn trong docs; ADR không có trong repo
- **Phía "không lưu ảnh" (ADR-0010) còn sót:** `docs/PRODUCT_BACKLOG_ROADMAP.md:283` "Tuyệt đối không lưu trữ ảnh lòng bàn tay trên server... ADR-0010", `:285`, `:110`, `:331`; `backend/src/readings/image-processor.service.ts:75` comment "ADR-0010: Never store image on server".
- **Phía "lưu Cloudinary" (đang chạy):** `docs/README.md:25,35,74,85`, `docs/ai-integration.md:101`, `docs/security-privacy.md:15`, `docs/api-contract.md:195,685`, README.
- **Thực tế:** [subagent] ADR-0011 là bản chạy. `image-processor.service.ts:75` chỉ đúng nghĩa "không ghi ra ổ đĩa".
- **Câu hỏi:** đánh dấu ADR-0010 Superseded (nếu tạo lại `docs/adr/`), sửa backlog và comment. **Đề xuất làm cả ba**; chỉ là sửa docs.

### A6. THẤP. Văn bản đồng ý khi quét không nhắc lưu Cloudinary [subagent]
- `docs/security-privacy.md:24` nói checkbox gồm "lưu trữ trên Cloudinary"; UI thật: web `CaptureStep.tsx:560` và mobile `scan.aiConsent` chỉ nhắc gửi cho AI.
- **Đề xuất:** sửa docs trước; bổ sung câu vào checkbox tuỳ yêu cầu Play/luật. [ngoài repo]

---

## B. QUYỀN ANDROID/iOS

Lưu ý nền: `mobile-2/android/` bị git-ignore (chỉ là prebuild cục bộ), nên mọi mục dựa vào manifest cần "xác minh bằng merged manifest của AAB production". [ngoài repo]

### B1. CAO (cửa hàng). `RECORD_AUDIO` được khai nhưng app không ghi âm
- **Nguồn:** `mobile-2/app.json:27-28` liệt kê `CAMERA` và `RECORD_AUDIO`. Plugin expo-camera mặc định cũng tự thêm (`node_modules/expo-camera/plugin/build/withCamera.js:22,47`: `recordAudioAndroid = true`), còn `app.json` chỉ truyền `cameraPermission`.
- **Policy:** mục 2 chỉ nêu Camera và Thông báo.
- **Thực tế:** [đã xác minh] `git grep` trong `mobile-2/src` không có `recordAsync`, `useMicrophonePermissions`, chế độ video.
- **Câu hỏi:** (a) bỏ khỏi `app.json` và đặt `recordAudioAndroid:false` cho plugin; (b) giữ và thêm vào policy; (c) chỉ bỏ khỏi `app.json` (vô ích vì plugin vẫn thêm). **Đề xuất (a).**

### B2. TRUNG BÌNH. Xin quyền Thông báo nhưng chưa có tính năng thông báo
- **Nguồn:** policy mục 2 "quyền Thông báo nếu bạn cho phép"; `mobile-2/src/startup/notifications.ts:20` gọi `requestPermissionsAsync()` ở bước 4 của `startup-sequence`, người dùng thật sự thấy hộp thoại.
- **Thực tế:** [đã xác minh] `git grep` `scheduleNotificationAsync|getExpoPushTokenAsync|getDevicePushTokenAsync|setNotificationHandler|addNotificationReceivedListener` trong `mobile-2/src` và `backend/src`: không có. Policy cũng không nêu mục đích.
- **Câu hỏi:** (a) bỏ bước xin quyền tới khi có tính năng; (b) thêm tính năng/ghi mục đích. **Đề xuất (a)**, tránh bị Play review.

### B3. TRUNG BÌNH. Quyền thực tế trong build nhiều hơn policy nêu [subagent]
- `expo-image-picker` thêm `READ/WRITE_EXTERNAL_STORAGE` (`maxSdkVersion=32`); `react-native-adjust` thêm `com.google.android.gms.permission.AD_ID`; `expo-notifications` thêm `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`; manifest cục bộ còn `SYSTEM_ALERT_WINDOW`, `VIBRATE` (chưa chắc có trong bản release). Không file cấu hình nào khai AD_ID tường minh. Policy chưa nêu "chọn ảnh từ thư viện".
- **Đề xuất:** bổ sung câu "chọn ảnh từ thư viện" vào policy, và sau khi xem merged manifest thì thêm `blockedPermissions` nếu cần. [ngoài repo] khai Advertising ID trên Play Console.

### B4. THẤP. Chuỗi giải thích quyền camera và iOS
- `app.json` `cameraPermission` chỉ tiếng Việt, chỉ nhắc ảnh lòng bàn tay, trong khi `edit-profile.tsx` cũng dùng camera chụp avatar. [subagent]
- iOS: `ios` có trong `app.json` nhưng ads/billing chỉ bật trên Android (`ads-config.ts:58-61`); `mobile-2/README.md:212` nhắc ATT (`NSUserTrackingUsageDescription`), code/plugin không có ATT; `initializeAdjust` không chặn theo `Platform.OS`. Chưa quét prebuild iOS, `eas.json` chỉ có cấu hình Android. [subagent]

---

## C. THU THẬP VÀ CHIA SẺ DỮ LIỆU

### C1. CAO (đang chờ người dùng). "100% Ẩn Danh", "ảnh được bảo vệ"
- `frontend/src/pages/Homepage/components/HeroSection.tsx:103` "100% Ẩn Danh" (nay kèm "Xoá ảnh bất cứ lúc nào") [đã xác minh]; mobile `home.costFull` "ảnh được bảo vệ".
- Mâu thuẫn với policy: thu thập email/tên/ảnh, mã băm Android ID/IP, GAID, ADID, chia sẻ với 10 mạng quảng cáo.
- Đây là một trong ba câu hỏi vòng 3 đang chờ người dùng: KHÔNG làm gì.

### C2. CAO nếu bản cũ đang chạy. Policy ở HEAD cũ hơn code [subagent]
- Bản `PrivacyContent.tsx` ở HEAD (trước các sửa gần đây, nếu đã lên web) nói ảnh chỉ ở RAM và "không chia sẻ cho bên thứ ba vì quảng cáo". Bản mới đã sửa đúng. Việc cần làm là đưa bản mới lên và không giữ bản cũ ở web/store. Hiện git status đã sạch (người dùng đã commit `1603a6d`), nên bản trong HEAD nay là bản mới; vẫn cần [ngoài repo] xác nhận nội dung trang đang live.
- "Kết quả luận giải được mã hoá" (policy cũ): `git grep` encrypt/cipher/aes không thấy mã hoá kết quả khi lưu. Policy mới đã bỏ câu này (đúng); chỉ còn "dữ liệu truyền qua kết nối mã hoá" (TLS). [ngoài repo] mã hoá at-rest của MongoDB Atlas.

### C3. TRUNG BÌNH. GAID/ADID lưu thô; hash IP là SHA-256 không muối
- **Policy:** "Mật khẩu, định danh thiết bị và IP chỉ lưu ở dạng băm khi cần lưu".
- **Thực tế:** [đã xác minh một phần] `backend/src/schemas/play-subscription.schema.ts:42-45` lưu `adjustAdid` và `gaid` dạng thô, ghi ở `billing.service.ts:241-242`. [subagent] `hashIp` là SHA-256 không muối (`common/client-ip.util.ts:17-19`, `readings.service.ts:861`): có thể dò ngược (IPv4 chỉ 2^32). Android ID: thô trên máy (SecureStore), backend băm HMAC (`common/device-id-hash.util.ts`); schema chỉ có `deviceIdHash`, `*IpHash`.
- **Câu hỏi:** (a) sửa câu policy ("riêng mã quảng cáo lưu nguyên khi bạn mua VIP"); (b) băm GAID/ADID trước khi lưu; (c) chuyển `hashIp` sang HMAC. **Đề xuất (a) + (c).**

### C4. TRUNG BÌNH. Firebase: policy liệt kê nhưng build có thể không có
- `mobile-2/app.config.js` chỉ thêm plugin Firebase khi tồn tại `mobile-2/google-services.json`. [đã xác minh] File không có trong repo (`git ls-files` rỗng). Nếu có trên EAS thì `revenue.ts` gửi `ad_impression` và Crashlytics không qua kiểm tra consent. [subagent]
- **Đề xuất:** gắn Firebase theo `consentRegion` cho EEA/UK. [ngoài repo] EAS có file này không.

### C5. THẤP. Danh sách SDK/đối tác khớp [subagent]
`plugins/withMonetization.js:36-82` có đúng 9 adapter (AdMob, Meta, Mintegral, Unity, Vungle/Liftoff, DT Exchange, Yandex, Bigo, Pangle) khớp policy cộng AppLovin MAX; Adjust, Firebase, Google Play có. Không có `setUserId`/targeting data gửi MAX/Adjust (`ads-service.ts:118`); `billingRef` chỉ đi tới Google Play và backend. Prompt Gemini chỉ có school/hand/topics + ảnh, EXIF được xoá bằng sharp. Chưa đọc `groq-ai.provider.ts`.

---

## D. XOÁ TÀI KHOẢN VÀ LƯU GIỮ

### D1. CAO. Xoá tài khoản không xoá nhiều dữ liệu định danh; policy hứa xoá "thông tin nhận dạng"
- **Lời hứa:** policy mục 7 "xoá ảnh lòng bàn tay, ảnh đại diện, kết quả luận giải, mật khẩu, phiên đăng nhập và thông tin nhận dạng"; danh sách giữ lại chỉ có lịch sử GEM và mã băm email/ID/thiết bị.
- **Thực tế:** [đã xác minh] `backend/scripts/users-delete.ts` chỉ dùng các model `User`, `DeletedIdentity`, `Session`, `PasswordReset`, `Reading` (`:35-41`, ghi ở `:116-158`). Không đụng:
  - `play_subscriptions`: `userId`, `purchaseToken`, `orderId`, `adjustAdid`, `gaid` (thô), `rawResponse`.
  - `billing_events` (`purchaseToken`, `payload`), `credit_transactions`, `referrals`, `ad_rewards` (`userId`, `deviceIdHash`), `devices` (`starterIpHash`), `guest_trials` (`claimedByUserId`).
  - Trên chính document `users` đã xoá tên: vẫn giữ `deviceIdHash`, `signupIpHash`, `referralCode`, `billingRef`, các trường VIP/check-in. [subagent]
- Bảng lưu giữ của policy chỉ để "[ĐIỀN: thời hạn ...]" cho dữ liệu giao dịch VIP.
- **Câu hỏi:** (a) mở rộng `users-delete.ts` xoá/ẩn danh `gaid`, `adjustAdid`, `rawResponse`, `billing_events.payload`, `signupIpHash`; (b) liệt kê rõ các mục này là dữ liệu giữ lại kèm thời hạn; (c) cả hai. **Đề xuất (c)**: phần cần để đối soát hoá đơn nêu rõ, phần còn lại xoá. [ngoài repo] luật kế toán/Nghị định 13/2023, yêu cầu Play về GAID.

### D2. TRUNG BÌNH. "Lịch sử GEM giữ ở dạng ẩn danh" thực chất mới là giả danh
- `credit_transactions` giữ nguyên `userId`, `reason`, `note`, `readingId`, `referralId`; dòng `users` tương ứng vẫn giữ `deviceIdHash`, `signupIpHash`... (xem D1) nên sổ GEM còn nối được với định danh thiết bị. [subagent]
- **Câu hỏi:** (a) đổi chữ "ẩn danh" thành "gắn với mã tài khoản đã bị xoá thông tin"; (b) cắt liên kết (nhưng `deviceIdHash` đang chống farm). **Đề xuất (a).**

### D4. THẤP. Vé thưởng quảng cáo "tự xoá sau khi hết ngày" nhưng code giữ 48 giờ
- Policy `PrivacyContent.tsx` bảng mục 6; code: `backend/src/currency/currency.service.ts:1102` `purgeAt = now + 48h`, TTL `schemas/ad-reward.schema.ts:72`. [đã xác minh] MONETIZATION_PLAYBOOK §10 cũng ghi "purged after their day".
- **Đề xuất:** sửa chữ thành "sau 48 giờ" (rẻ, đúng dữ liệu đang chạy).

### D5. TRUNG BÌNH. Hướng dẫn xoá cho tài khoản khách (app) và link xoá dữ liệu trong app
- Web (`DataDeletionContent.tsx`) yêu cầu "gửi email từ chính địa chỉ email của tài khoản"; chỉ có ngoại lệ cho Facebook-only. App chỉ có tài khoản khách theo thiết bị, không có email; i18n mobile nói "gửi kèm mã tài khoản". [subagent]
- `mobile-2/src/app/(tabs)/profile.tsx:474-476` `openDataDeletion`: `if (!webRoot) return` (im lặng). `eas.json` (mọi profile) KHÔNG đặt `EXPO_PUBLIC_WEB_URL` [đã xác minh: 0 lần], nên build thật nút này không làm gì, trong khi link Chính sách riêng tư lại fallback `https://palmsight.app` (`ads-config.ts:23`). (Đây là câu hỏi vòng 3 đang chờ: openDataDeletion.)
- **Đề xuất:** đặt `EXPO_PUBLIC_WEB_URL` trong `eas.json` cho preview/production và thêm hướng dẫn cho khách app. [ngoài repo] biến trong EAS dashboard; `palmsight.app` có phân giải không.

---

## E. TUỔI, CONSENT QUẢNG CÁO

### E1. TRUNG BÌNH. "Từ 16 tuổi trở lên" không có cơ chế chặn hay xác nhận
- Policy mục 8; code: nhóm tuổi onboarding `'16-24' | '25-34' | '35-54' | '55+'` (`mobile-2/src/onboarding/onboarding-machine.ts:21`) [đã xác minh]. Không có lựa chọn dưới 16, không chặn, dữ liệu tuổi chỉ lưu thiết bị. Web đăng ký không có ô xác nhận tuổi; Terms không có câu về tuổi. Playbook `:249` nói "nothing is sent to the server except the consent/age confirmation" nhưng code chỉ gửi `deviceId`. [subagent]
- **Câu hỏi:** (a) thêm xác nhận "tôi từ 16 tuổi trở lên" ở onboarding và đăng ký web; (b) thêm lựa chọn "dưới 16" và chặn; (c) giữ. **Đề xuất (a).** [ngoài repo] khai Target audience/Content rating trên Play Console.

### E2. CAO. Khi chưa xác định được đồng ý: code chỉ chặn đúng Adjust init
- **Lời hứa:** policy mục 5 "tắt chia sẻ dữ liệu với bên thứ ba cho mục đo lường, không cá nhân hoá quảng cáo và không đọc GAID".
- **Thực tế:** [đã xác minh] `mobile-2/src/ads/revenue.ts:86-94`: khi `consentRegion !== 'OTHER'` thì `disableGoogleAdIdReading()` và `AdjustThirdPartySharing(false)` + `google_dma`. Nhưng [subagent] sau đó vẫn gửi doanh thu quảng cáo và sự kiện mua cho Adjust (`:134-165`) và `ad_impression` cho Firebase (`:113-121`) không kiểm region. MAX (`ads-service.ts:119-129`) đặt `ready` cho mọi region, không có `setHasUserConsent` hay giới hạn cá nhân hoá phía app; cá nhân hoá hoàn toàn do UMP/MAX quyết định.
- **Câu hỏi:** (a) sửa câu policy cho khớp (chỉ nói Adjust và "tuỳ luồng đồng ý của MAX"); (b) gắn Firebase và sự kiện doanh thu/mua theo region; (c) chặn Adjust init khi ads không bật. **Đề xuất (a) ngay, (b) sau.** [ngoài repo] MAX/UMP xử lý `UNKNOWN`, UK/Thuỵ Sĩ có được MAX coi là GDPR không.

### E3. TRUNG BÌNH. Người dùng EEA đã đồng ý vẫn bị tắt Adjust
- Policy "theo lựa chọn đồng ý ở mục 5"; code `revenue.ts:86` dùng `consentRegion !== 'OTHER'` nên mọi người ở GDPR bị tắt GAID/chia sẻ Adjust bất kể đã đồng ý; `getAttributionIds` cũng vậy. Bảo thủ hơn lời hứa; hậu quả là mất đo lường EEA. [subagent]
- **Đề xuất:** ghi rõ policy ("không dùng ở EEA") hoặc đọc kết quả consent thật.

### E4. TRUNG BÌNH. Tên mục Hồ sơ, phạm vi form, "không bán dữ liệu"
- Policy: "mở lại biểu mẫu từ mục Hồ sơ, chọn Lựa chọn quyền riêng tư quảng cáo"; app nhãn "Quyền riêng tư quảng cáo" / "Ad privacy choices", chỉ hiện khi `consentRegion === 'GDPR'` (`profile.tsx:58,330`). Không có xử lý riêng cho UK/Thuỵ Sĩ (phụ thuộc MAX gán GDPR), không có "Do Not Sell/Share" cho các bang Mỹ. Policy "không bán dữ liệu cá nhân" trong khi chia sẻ GAID/IP/thiết bị cho 10 mạng quảng cáo. [subagent]
- **Đề xuất:** đổi nhãn app hoặc câu policy cho khớp (chỉ là chữ). [ngoài repo] mức "bán/chia sẻ" theo CCPA/CPRA (cần luật sư).

### E5. TRUNG BÌNH. URL chính sách đưa vào luồng đồng ý của MAX có thể sai
- `ads-config.ts:23` `webRoot = EXPO_PUBLIC_WEB_URL ?? 'https://palmsight.app'`; `ads-service.ts:111-112` truyền `/privacy` và `/terms` cho MAX; không profile nào trong `eas.json` đặt `EXPO_PUBLIC_WEB_URL`; `docs/deployment.md:75` nói dùng `*.vercel.app`. [đã xác minh phần eas.json] [ngoài repo] DNS/Vercel.

---

## F. KINH TẾ

### F2. CAO (tài liệu công khai). README/docs ghi sai giá, quà, giới thiệu, hoàn tiền (gộp J3, K1)
- **Code:** `shared/src/constants/index.ts:144-176`: giá 5 GEM (`PRICE_PER_ACTION`), quà khởi đầu 5, người nhập mã +5, chủ mã +3, trần mạng 5; hoàn tiền trả đúng số đã trừ (`credit-ledger.service.ts:343-345`). `.env.example` và `render.yaml` đều 5/5/5.
- **Docs sai (rút gọn):** README.md:3,10-11,14 ("1 credit", "3 credits", "+1/+2"); `docs/README.md:24`; `docs/business-rules.md:13,66` (và tự mâu thuẫn với `:9-12,96,104`); `docs/api-contract.md:95-99,132,182,195,301,307-308,313,375,640,646` (và tự mâu thuẫn với `:601`, `:626`); `docs/screens.md:44,49,88,104-109,126,163,183`; `docs/testing.md`; `docs/workflow.md`; `docs/roadmap.md:34,59`; `docs/security-privacy.md:95,101-103`; `docs/PRODUCT_BACKLOG_ROADMAP.md` (`SIGNUP_BONUS_CREDITS=3`, `READING_COST_CREDITS=1`).
- **Câu hỏi:** (a) cập nhật đồng loạt theo hằng số; (b) trước mắt README + `docs/README.md` + `screens.md` + `api-contract.md`; (c) đánh dấu docs cũ là lịch sử. **Đề xuất (b) rồi (a).**

### F3. CAO. Docs mô tả rewarded ads SSV `/ads/rewarded/*` đã bị xoá (gộp J1, K3)
- **Docs:** `docs/api-contract.md:150-153,169-171,201-205,844-926` (5 endpoint + mã `REWARDED_ADS_DISABLED`...), `docs/database-erd.md:117-128,337-361` (`rewarded_ad_claims`), `docs/business-rules.md:14,26-29,31-60` (mặc định `REWARDED_ADS_ENABLED=false`, 24 giờ trượt), `mobile-2/README.md:129,140,147-226` (AdMob SSV URL, `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID`).
- **Code:** [đã xác minh] commit `172d3f5` đã xoá `backend/src/ads/*` (`ads.module.ts`, `rewarded-ad-ssv.verifier.ts`, `rewarded-ads.controller.ts`). Controller hiện có: auth, billing, config, currency, health, readings (+guest), users. Rewarded ads là `/currency/ad-rewards`, `/:id/claim`, `DELETE /:id` (`currency.controller.ts:78-109`); vé thưởng: checkin (gấp đôi, trần 1), spin (1 lượt, trần 3), bonus (+3 GEM, trần 5), tính theo `rewardDay` (múi giờ Asia/Ho_Chi_Minh), theo tài khoản và thiết bị. Mã lỗi thật chữ thường (`ads_unavailable`, `ad_limit_reached`, `ad_not_finished`...). `REWARDED_ADS_ENABLED` mặc định `'true'` (`currency.service.ts:126-132`, `.env.example`, `render.yaml:101`). Quảng cáo chạy qua AppLovin MAX, không phải AdMob SSV.
- **Biến chết:** `REWARDED_AD_REWARD_CREDITS`, `REWARDED_AD_DAILY_CAP`, `REWARDED_ADS_DEV_GRANT` (chỉ có trong `backend/.env` cục bộ), `MAX_REWARD_EVENT_KEY` (`render.yaml:105`), `REFERRAL_REWARD_CREDITS` (code dùng hằng cứng 3). [subagent]
- **Câu hỏi:** (a) viết lại phần rewarded theo `/currency/ad-rewards` và playbook §2.2, §5.5; (b) xoá phần AdMob SSV; (c) giữ làm lịch sử. **Đề xuất (a)** cho `business-rules.md`, `api-contract.md`, `mobile-2/README.md`. [ngoài repo] AdMob console có còn trỏ SSV callback vào `/ads/rewarded/verify` (đang 404) không.

### F4. TRUNG BÌNH. Giá trị gõ cứng ở nhiều nơi [subagent]
- VIP "+50 GEM/ngày" hiển thị cứng trong `translations.ts:109,128`, `screen-strings.ts:91,92` (hai chỗ khác dùng `ECONOMY_DEFAULTS.VIP_DAILY`); backend đọc env `VIP_DAILY` mặc định 50. Giá bói: `CORE_READING_COST_GEM` và `PRICE_PER_ACTION` là hai hằng riêng cùng giá trị 5. `play-purchase.verifier.ts:201,214-216` gõ cứng `'weeklyid'/'yearlyid'` để tính thời hạn/giá dù id đổi được qua `SUB_*_ID`. Hiện không lệch. **Đề xuất:** giữ hằng cứng, ghi chú "đổi shared thì đổi cả env".
- Gói VIP: weekly 6.99 USD, yearly 99 USD khớp playbook §1.2; monthly để trống ở bản chạy thật nhưng backend vẫn chấp nhận `monthlyid`. [ngoài repo] Play Console còn dùng đúng id/giá không.

### F5. THẤP. Vòng quay ĐÃ KHỚP (rút lại nhận định cũ)
- Client dùng `wheelData?.prizes ?? ECONOMY_DEFAULTS.WHEEL_PRIZES` (`mobile-2/src/earn/lucky-wheel.tsx:41-42`), server `WHEEL_PRIZES = [2,3,5,10,20,50]` (`shared:169`); test `wheel-odds.spec.ts` khớp. Không còn mâu thuẫn "8 ô vs 6 giải". [subagent]

---

## G. QUY TẮC QUẢNG CÁO

### G1. TRUNG BÌNH. Khoảng cách interstitial cho "ads user": playbook 30s, code 60s
- Playbook `docs/MONETIZATION_PLAYBOOK.md:62` (`{ADS_USER_GAP}` 30 s); code `mobile-2/src/ads/interstitial-policy.ts:17` `ADS_USER_GAP_MS = 60_000`, `shared:179` `ADS_USER_GAP_SECONDS: 60`; comment trong code ghi đó là quyết định của chủ app. [đã xác minh] Khoảng thường 90s khớp (`:16`, playbook `:61`). Test `phase5-6.spec.ts:183` tên "30 s for ads users" nhưng dùng hằng nên vẫn qua. `interstitial-policy.ts:16-18` tự khai 90_000/60_000/3 thay vì dùng `ECONOMY_DEFAULTS`.
- **Đề xuất:** giữ 60s và sửa playbook `:62` + tên test.

### G2. THẤP. Danh sách route loại trừ không đồng nhất [subagent]
- Banner loại trừ (`banner-policy.ts:9-15`): `/camera, /paywall, /sign-in, /consent, /login`; interstitial (`interstitial-policy.ts:46-57`): `onboarding, intro, consent, paywall, sign-in, login, register, auth, edit-profile`. Nhiều mẫu không có route thật (`sign-in, login, register, auth, consent, paywall, intro`). `/edit-profile` có ở interstitial nhưng không ở banner. Chưa chắc có phải chủ ý.

### G3. THẤP. `app-ads.txt` [subagent]
- `mobile-2/README.md:215` và `rewarded-ads-roadmap.log:150` nhắc, `frontend/public` không có file. [ngoài repo] AppLovin/AdMob yêu cầu và domain đã khai báo chưa.

---

## H. ĐIỀU KHOẢN VÀ TRANG PHÁP LÝ

### H1. CAO. Điều khoản không nói gì về VIP, tự gia hạn, quảng cáo, độ tuổi, hoàn tiền
- `frontend/src/pages/DataDeletion/components/TermsContent.tsx` (4 mục: giải trí, tài khoản, Credits, sở hữu trí tuệ) và `frontend/public/terms.html:50-75` không có từ nào về VIP, đăng ký tự gia hạn, Google Play, quảng cáo, 16+, hoàn tiền, GEM hết hạn. Trong khi policy nói về tất cả và paywall mobile ghi "tự động gia hạn" (`translations.ts:277`) rồi mở `${webRoot}/terms` (`paywall.tsx:54`, `ads-config.ts:50`) tức trang React không nói gì về gói đăng ký. Terms lẫn "Credits" và "GEM". [subagent]
- **Câu hỏi:** (a) bổ sung điều khoản VIP/gia hạn/hoàn tiền/quảng cáo/16+/GEM; (b) chỉ thêm VIP + 16+ tối thiểu; (c) giữ. **Đề xuất (a)**: Play yêu cầu điều khoản đăng ký nhất quán với paywall. [ngoài repo] yêu cầu Play, luật tiêu dùng.

### H2. CAO. Hai email hỗ trợ khác nhau; `SUPPORT_EMAIL` là biến chết
- `frontend/public/data-deletion.html:56` "support@palmsight.app" so với `DataDeletionContent.tsx:30` "palmsight.app@gmail.com" (viết cứng); `docs/PRODUCT_BACKLOG_ROADMAP.md:432,635` `support@palmsight.app`; `backend/.env.example:32` và `render.yaml:31-32` `palmsight.app@gmail.com`; `docs/screens.md:52`, `docs/security-privacy.md:42` nói trang hiển thị `SUPPORT_EMAIL`.
- **Thực tế:** [đã xác minh] `git grep SUPPORT_EMAIL` trong `backend/src frontend/src mobile-2/src shared` rỗng: không code nào đọc biến này. URL Meta/Play trỏ vào bản HTML sẽ dẫn người dùng tới `support@palmsight.app`. Liên hệ trong policy còn `[ĐIỀN: email hỗ trợ quyền riêng tư]`.
- (Đây là câu hỏi vòng 3 đang chờ: email hỗ trợ.)
- **Đề xuất:** một địa chỉ duy nhất dùng chung cho HTML và React, địa chỉ đang hoạt động thật. [ngoài repo] hộp thư và tên miền `palmsight.app` có tồn tại không; Meta/Play đang trỏ URL nào.

### H3. CAO. Trang pháp lý công khai còn placeholder và ngày cũ
- `privacy.html` và `PrivacyContent.tsx` còn 9 chỗ `[ĐIỀN]/[XÁC NHẬN]` (đã liệt kê ở báo cáo trước); Terms/Data-deletion ghi "Cập nhật: 15/10/2026" (`terms.html:50`, `data-deletion.html:51`, `TermsContent.tsx:14`, `DataDeletionContent.tsx:15`), có thể lỗi thời vì nội dung data-deletion đã đổi. [subagent]
- Đây là URL khai báo cho Meta (`docs/deployment.md:43`) và link policy trong app. [ngoài repo] Meta/Play có chấp nhận trang còn placeholder không (rất có thể không).
- **Đề xuất:** điền đủ trước khi phát hành.

---

## I. HẠ TẦNG VÀ ĐỊNH DANH

### I3. TRUNG BÌNH. Tên biến môi trường giữa code, .env.example và render.yaml không khớp
- Code đọc nhưng không có trong `.env.example`/`render.yaml`: `GUEST_TRIAL_SECRET` (`main.ts:134`, mình đã thấy chỉ xuất hiện ở `main.ts`; subagent báo có giá trị mặc định cứng trong code), `ENFORCE_VIP_SCHOOLS`, `SUB_WEEKLY_ID/SUB_YEARLY_ID/SUB_MONTHLY_ID`, `CLOUDINARY_AVATAR_FOLDER`, `PORT` (ưu tiên hơn `API_PORT`).
- Có trong example/render nhưng không có code đọc: `SUPPORT_EMAIL`, `IMAGE_MAX_BYTES`, `IMAGE_MAX_DIMENSION` (8 MB và 1280 là hằng cứng), `MAX_REWARD_EVENT_KEY`.
- Docs dùng tên cũ: `PRODUCT_BACKLOG_ROADMAP.md:618-622` `JWT_SECRET`, `JWT_REFRESH_SECRET`, `HMAC_SECRET`, `PORT=3000`; `generate-secrets` in cả tên không dùng cạnh tên đúng (`JWT_ACCESS_SECRET`, `IDENTITY_HASH_SECRET`). `AI_MODEL`, `AI_TIMEOUT_MS` khác giữa `.env.example`/mặc định code so với `render.yaml`/`docs/ai-integration.md`. [subagent]
- **Đề xuất:** bổ sung biến code đang đọc (nhất là `GUEST_TRIAL_SECRET`) vào example và render.yaml, xoá biến chết.

### I5. THẤP. Package id, MAIL_FROM, tên tham chiếu cũ
- `app.json:14,17` `com.palmsight.mobile2` khớp `render.yaml:95-96`; `docs/mobile-guest-onboarding-log.md:113,120` dặn tạo OAuth client Android với `com.palmsight.app` (log của app `mobile/` cũ). `render.yaml:51-52` `MAIL_FROM = no-reply@palmsight.app` trong khi SMTP là Gmail và `getting-started.md:107,110` nói Gmail ghi đè người gửi. `mail.service.ts` mặc định `no-reply@palmsight.local`. [subagent]

### I6. THẤP. Docs tham chiếu thứ không tồn tại [một phần đã xác minh]
- [đã xác minh] `docs/adr/` và `CONTEXT.md` không tồn tại, nhưng README gốc:25,78, CONTRIBUTING.md:7, CHANGELOG.md:11, docs/README.md:5 và nhiều docs trỏ tới.
- [subagent] Thư mục `mobile/` cũ không còn (`mobile-2/README.md:3`, `api-contract.md:71` vẫn nhắc); script `db:seed` (`getting-started.md:67`), `pnpm test:e2e` (`:154`), `credits:adjust` (`:155`, `business-rules.md:73`, `docs/README.md:107`) không có trong `backend/package.json`; `docs/README.md:80,96` nói PWA dùng `vite-plugin-pwa` nhưng `frontend/public/sw.js` viết tay; `docs/README.md:84` nói dùng `@nestjs/throttler` (có trong package.json nhưng không dùng; rate limit là guard tự viết); README:102 "Chưa có license" trong khi `frontend/LICENSE` (MIT, `[year] [fullname]`) và `mobile-2/LICENSE` tồn tại.
- Phần hướng dẫn chạy local đúng thực tế (adb reverse thay vì 10.0.2.2, cổng 4000/8081/5173, docker-compose 27019→27017, Node 22/pnpm 9.15.9). [subagent]

---

## J. HỢP ĐỒNG API VÀ DỮ LIỆU

### J1. CAO. Nhiều endpoint thật không có trong api-contract; response `GET /me` thiếu trường và có tác dụng phụ
- Thiếu trong `docs/api-contract.md`: `GET /config`, `GET /currency/earn`, `POST /currency/checkin`, `/checkin/restore`, `/spin`, `/paid-spin`, `POST /billing/verify`, `POST /billing/rtdn?token=` (docs `:15` còn nói "Query chỉ dùng cho GET"), `POST /auth/google/browser/start|exchange`, `GET /auth/google/browser/callback`. [subagent, controller đã xác minh danh sách]
- `GET /me` docs (`:478-499`) thiếu `balance`, `vip{active,productId,expiresAt,willRenew}`, `billingRef`, `grantedNow`, `vipDailyGranted`; code trả đủ (`users.service.ts:71-170`, `shared/src/types/user.dto.ts:17-47`). `GET /me` còn tự cộng VIP daily và ghi sổ cái (`users.service.ts:43-45,115-146`); docs không nhắc. `PATCH /me` và avatar cố ý không cộng.
- `POST /readings` thiếu: EASTERN/VEDIC chỉ cho VIP (`403 vip_required`); `POST /readings/guest` trả `201` kèm `claimToken` và cookie `ps_guest_trial` (docs `:806-833` không mô tả response).
- **Đề xuất:** bổ sung toàn bộ vào api-contract (hoặc tách `docs/api-economy.md`).

### J4. TRUNG BÌNH. Giới hạn ảnh bói và mã lỗi `IMAGE_TOO_LARGE`
- `annotatedImage`: docs `api-contract.md:670` "JPEG/PNG, ≤ 2 MB, 512×512"; code một giới hạn multer 8 MB cho cả hai part (`readings.controller.ts:65-70`, `readings.module.ts:24-27`), cùng `validateAndProcess` (JPEG/PNG/WebP/HEIF, resize cạnh dài 1280). Ảnh vẽ lỗi bị nuốt im lặng, reading vẫn DONE.
- `IMAGE_TOO_LARGE` (docs `:144,680`, `413`): multer cắt ở 8 MB trước khi `validateAndProcess` chạy; lỗi multer là `PayloadTooLargeException` không có `code`, `api-exception.filter.ts` không có mục 413 nên client nhận code `ERROR`. Suy ra từ code Nest, chưa chạy thử.
- `IMAGE_MAX_BYTES`, `IMAGE_MAX_DIMENSION` trong `.env.example` không được đọc. [subagent]
- Phần avatar khớp (5 MB, JPEG/PNG/WebP, 512×512, 5 lần/phút, mã `AVATAR_*`, UI "tối đa 5 MB" đủ 9 ngôn ngữ).

### J5. TRUNG BÌNH. Header và mã lỗi chung không khớp lời hứa
- Docs `api-contract.md:53` "X-Request-Id, mọi response", `:156` `INTERNAL_ERROR` kèm `details.requestId`. Code: [đã xác minh] `X-Request-Id` chỉ xuất hiện trong cấu hình CORS (`main.ts:119,128`), không đâu set trên response; filter trả `INTERNAL_SERVER_ERROR` không có `requestId` (`api-exception.filter.ts:80-86`).
- `Retry-After` (docs `:54,148`): chỉ `AuthRateLimitGuard` và `UserRateLimitGuard` set; khoá đăng nhập, `DEVICE_SESSION_LIMIT_REACHED`, `IP_TRIAL_LIMIT_EXCEEDED` thì không. Mã lỗi code có nhưng bảng docs thiếu: `DEVICE_SESSION_LIMIT_REACHED`, `REFERRAL_DEVICE_USED`, `REFERRAL_NETWORK_LIMIT`, `AVATAR_*`, `vip_required`, `MAX_ACTIONS_EXCEEDED`, `ALREADY_REFUNDED`, `USER_NOT_FOUND`, mã billing. `AI_SERVICE_UNAVAILABLE` (code) khác `AI_UNAVAILABLE` (docs); chưa kiểm hết đường nào bắn mã nào. [subagent]
- **Đề xuất:** thêm middleware `X-Request-Id`; sửa docs phần còn lại.

### J6. TRUNG BÌNH. ERD lỗi thời so với schema Mongoose
- Collection có trong code nhưng không có trong ERD: `ad_rewards`, `devices`, `play_subscriptions`, `billing_events`, `referral_network_counters`; ERD có `rewarded_ad_claims` mà code không còn. `users` thiếu `isAnonymous`, `deviceIdHash`, `signupIpHash`, `vipExpiresAt`, `vipProductId`, `vipWillRenew`, `billingRef`, `starterGrantedAt`, `checkinDay`, `checkinStreak`, `lastCheckinAmount`, `freeSpinDay`, `vipDailyDay` và các index; `credit_transactions` enum `type` 7 giá trị so với nhiều hơn trong `shared/src/enums/index.ts:24-44`, thiếu `reason`; `pending_registrations` thiếu `signupIpHash`; `referrals` thiếu `referrerReward`; ERD có mâu thuẫn nội bộ (`:121` "ISSUED | REDEEMED" vs `:347` `status`). [subagent]
- `docs/security-privacy.md:7-18` (bảng dữ liệu thu thập) không có định danh thiết bị, GAID, Adjust ADID, purchase token, VIP, trong khi policy mới có; `:49,58` nói xoá là ẩn danh hoá, `:38` nói "Không có tính năng tự xoá trong app" trong khi policy nói mở từ mục Hồ sơ.
- **Đề xuất:** cập nhật ERD một lượt theo schema; sau đó cân nhắc tự sinh danh sách field.

### J7. THẤP. Các lệch nhỏ
- Cookie `Secure`: docs `api-contract.md:61`, `security-privacy.md:86` "luôn Secure"; code chỉ khi `NODE_ENV === "production"` (`auth.controller.ts:429-436`). [subagent]
- Timeout server: docs `api-contract.md:650` "45 giây" nhưng code `AI_TIMEOUT_MS` mặc định 25 000 ms mỗi nhà cung cấp (chưa chắc có cộng fallback); timeout client: docs nói 60 s, web 60 s, mobile 75 s (`mobile-2/src/lib/readings.ts:46`, comment còn nói "web đặt 60s").
- `x-device-id` mobile gửi trên mọi request (`mobile-2/src/lib/api.ts:147-151`) nhưng docs chỉ nhắc ở referral; Google/Facebook nhận thêm `claimToken` (`shared/src/types/auth.dto.ts:46-55`) chưa liệt kê.
- Mobile tự cài lại validate tên (`mobile-2/src/lib/profile-edit.ts:6-22`, comment "chưa có updateProfileSchema trong shared") trong khi `shared/src/schemas/index.ts` đã có; `AVATAR_DELETE_FAILED` không có khoá riêng ở `ERROR_KEYS` mobile.
- `docs/security-privacy.md:118` "rate limit 5 lần/phút/user" cho AI đúng; `api-contract.md:172` "Còn lại 60 request/phút" không thấy cơ chế chung (chưa chắc).

---

## K. TÍNH NĂNG ĐƯỢC HỨA VS THỰC TẾ

### K1. TRUNG BÌNH. Phạm vi "ngoài MVP" và trạng thái backlog ngược với code
- `docs/PRODUCT_BACKLOG_ROADMAP.md:39-41` "NO credit sales/billing", "NO mobile native app", "NO multi-language"; `docs/README.md:40` và `business-rules.md:65` "MVP không bán credits". Thực tế: có app Expo Android, bán VIP qua Google Play (VIP cấp +50 GEM/ngày nên "không bán credits" cũng không còn đúng), 9 ngôn ngữ (`shared` `LANGUAGES`). Backlog `:308` "mặc định Groq, fallback Gemini" ngược code (mặc định gemini, `ai.service.ts:33`); nhiều mục `[ ]` (US-AUTH-001..003, US-WALLET-001, Phase 4 ở `roadmap.md:61-68`) đã có code. [subagent]
- **Đề xuất:** ghi phạm vi hiện tại, đánh dấu backlog là lịch sử.

---

## Ba câu hỏi vòng 3 đang chờ người dùng (không làm)
1. Email hỗ trợ: xem H2.
2. "100% Ẩn Danh": xem C1 (và A4).
3. `openDataDeletion` im lặng: xem D5.

## PHẦN ĐÃ QUÉT VÀ CHƯA QUÉT

**Đã quét (qua 5 subagent + mình tự đối chiếu):**
- backend: `scripts/users-delete.ts` (toàn bộ), `main.ts`, `common/*`, `readings/*` (service, controller, guest, cloudinary, image-processor), `users/*` (avatar, controller, service), `auth/*` (controller, guard, service phần liên quan), `billing/*`, `currency/*` (phần liên quan), `config`, `ai/*` (prompts, gemini), toàn bộ `schemas/`.
- shared: `constants`, `enums`, `schemas`, `types`.
- frontend: `pages/DataDeletion/*`, `Homepage`, `Scan`, `Account`, `Register`, `Wallet`, `Referral`, `ReadingDetail`, `public/{privacy,terms,data-deletion}.html`, `index.html`, `vercel.json`.
- mobile-2: `app.json`, `app.config.js`, `eas.json`, `plugins/withMonetization.js`, `package.json`, `src/ads/*`, `src/startup/*`, `src/billing`, `src/earn`, `src/lib/*`, `src/onboarding`, `profile.tsx`, `src/i18n` (các khoá liên quan), `README.md`, manifest trong `node_modules` của expo-camera, expo-image-picker, expo-notifications, react-native-adjust.
- docs: `api-contract.md`, `database-erd.md`, `security-privacy.md`, `business-rules.md`, `deployment.md`, `getting-started.md`, `roadmap.md`, `README.md`, MONETIZATION_PLAYBOOK (phần liên quan), và đọc chọn lọc `screens.md`, `workflow.md`, `testing.md`, `ai-integration.md`, `PRODUCT_BACKLOG_ROADMAP.md`, `mobile-guest-onboarding-log.md`, `rewarded-ads-roadmap.log`; README, CONTRIBUTING, SECURITY, CHANGELOG, `render.yaml`, `docker-compose.yml`, Dockerfile, `.github/workflows/ci.yml`, `.env.example` các nơi.

**Chưa quét hoặc chưa kiểm sâu:**
- `docs/adr/*` (không có trong repo); `docs/DESIGN.md`, `frontend/README.md` (boilerplate).
- Toàn bộ `backend/test` và các `*.spec.*` (chỉ đọc test liên quan khi trích).
- `groq-ai.provider.ts`; nhánh lỗi chi tiết của `readings.service.ts`, `billing.service.ts`, `play-purchase.verifier.ts`, `referrals.service.ts`, `currency.service.ts` ngoài các đoạn trích.
- Prebuild iOS; `mobile-2/android/` chỉ là bản cục bộ git-ignore, không phải merged manifest của AAB production.
- So từng chuỗi i18n của 9 ngôn ngữ ngoài EN/VI (chỉ xác nhận các khoá liên quan và parity qua test).
- Phần lớn UI web ngoài các trang đã nêu.
- Các mục gắn [subagent] chưa được mình đọc lại từng dòng; các mục [đã xác minh] đã được đối chiếu.

**Không kiểm được trong repo [ngoài repo]:** Render (service nào chạy, biến môi trường, `ENFORCE_VIP_SCHOOLS`), Vercel (Root Directory, domain), EAS dashboard (biến, `google-services.json`, `APPLOVIN_SDK_KEY`), Play Console (Data Safety, Content rating, Target audience, Advertising ID, Ads declaration, id/giá gói), Meta App Dashboard (URL privacy/data-deletion đang khai), AdMob/UMP message và SSV callback, AppLovin MAX/Adjust dashboard, cài đặt Cloudinary (access mode, số ảnh mồ côi), hộp thư và DNS `palmsight.app`, mã hoá at-rest MongoDB Atlas, dữ liệu DB cũ (dòng `local:`, index `deviceId_1`), và các vấn đề pháp lý (Nghị định 13/2023, CCPA/CPRA, GDPR).
