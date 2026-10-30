# PalmSight Mobile — UI/UX Review & Fix Log

- **Ngày review:** 2026-10-30
- **Cập nhật gần nhất:** 2026-10-30 — hoàn tất toàn bộ P0, P1 và P2-11 → P2-14
- **Phạm vi:** toàn bộ `mobile/src` (20 screen/component: tabs, auth, onboarding, guest, camera, reading, wallet, referral, mystic components, theme, ui)
- **Tiêu chí:** tính phù hợp ứng dụng mobile (touch target, thói quen native, readability) + UI (typography, spacing, màu, hierarchy) + UX (4 trạng thái loading/empty/error/populated, luồng, feedback)
- **Trạng thái:** `⬜ chưa sửa` · `🔄 đang sửa` · `✅ đã sửa xong` · `⏸️ tạm hoãn (lý do ghi rõ)`

## Điểm mạnh đã ghi nhận (không cần sửa)

- Design token đồng bộ web/mobile (`theme.ts`), dark theme nhất quán.
- Safe-area chuẩn (`useSafeAreaInsets` ở mọi màn), keyboard xử lý đúng (iOS padding + Android resize).
- Haptics đầy đủ và có bọc lỗi (`lib/haptics.ts`).
- Accessibility khá nghiêm túc: role/label/state cho đa số control, radiogroup, adjustable dots ở onboarding.
- 4 trạng thái (loading/empty/error) có ở đa số màn: skeleton reading, empty state history đẹp, error banner có retry.
- Touch target 44pt được tuân thủ ở `Button`, `Input`, `Screen` back — nhưng còn sót các link chữ (xem P0-2).

## Bảng theo dõi

| ID | Mức | Vấn đề | File chính | Trạng thái |
|----|-----|--------|-----------|------------|
| P0-1 | P0 | Font quá nhỏ (8–10.5px) + tương phản `stone`/`ash` dưới AA | `theme.ts`, camera, history, wallet, reading, ui | ✅ |
| P0-2 | P0 | Touch target < 44pt ở 5 link chữ (back/skip/copy) | wallet, referral, enter-referral, check-email, account | ✅ |
| P0-3 | P0 | Camera: layout offset cứng, thiếu torch, nút thư viện chữ 9px, không tap-to-focus | `app/camera.tsx` | ✅ (tap-to-focus: API không hỗ trợ) |
| P0-4 | P0 | LoadingOverlay: không thể thoát, progress bar giả (chạm 100% ở giây 45) | `components/ui.tsx`, `app/(tabs)/index.tsx` | ✅ |
| P0-5 | P0 | Nhãn back sai ngữ cảnh ("‹ Lịch sử" / "‹ Quay lại Tài khoản") | `reading/[id].tsx`, `wallet.tsx`, `referral.tsx` | ✅ |
| P1-6 | P1 | Không infinite scroll (nút "Tải thêm" tay); wallet thiếu pull-to-refresh | history, wallet | ✅ |
| P1-7 | P1 | Focus màn reset danh sách về trang 1 → mất vị trí cuộn | history, wallet | ✅ |
| P1-8 | P1 | Header nghi lễ dài trên màn utility, chiếm ~1/5 màn hình | Screen.tsx + account/wallet/referral/enter-referral | ✅ |
| P1-9 | P1 | Không có android_ripple (pressed chỉ đổi opacity) | `components/ui.tsx` | ✅ |
| P1-10 | P1 | Chia sẻ chỉ text thuần, nên share ảnh sơ đồ AI | `reading/[id].tsx` | ✅ |
| P2-11 | P2 | Tiền tố ASCII `[!] [+] [i]` trông như log trên mobile (14 chỗ) | nhiều file | ✅ |
| P2-12 | P2 | Member 4-step wizard vs guest form dài — 2 paradigm cho 1 luồng | index vs guest | ✅ |
| P2-13 | P2 | Animation nền vô hạn: pin/perf + không tôn trọng reduce-motion | MysticBackground, PalmOracle | ✅ |
| P2-14 | P2 | Không hỗ trợ Dynamic Type (fontSize + lineHeight cố định) | `theme.ts` | ✅ |

## Chi tiết & phương án sửa

### P0-1 — Font nhỏ + tương phản
- Vị trí: `camera.tsx:150` (8px status), `camera.tsx:164,179` (9px), `camera.tsx:259` (guide label 9.5), `history.tsx:141` + `wallet.tsx:147` (timestamp 9px), `reading/[id].tsx:257` (legend 9px), `index.tsx:474` (stepper 9.5), `ui.tsx:656` (stage 9); token `eyebrow`/`code`/`monoStrong` = 10.5px (`theme.ts:98-100`).
- Tương phản trên nền `#0b0716`: `stone #7e6d99` ≈ 4.1:1, `ash #6a5885` (placeholder) ≈ 3:1 — dưới AA 4.5:1 cho chữ nhỏ.
- **Phương án:** token `eyebrow`/`code`/`monoStrong` 10.5 → 12 (lineHeight tương ứng); bỏ các override `fontSize: 8/9`; sáng hóa `stone` → `#8d7aab` (~4.9:1), `ash` → `#8a78ad` (~4.8:1).
- **Đã làm:** token đã ở 12px và `stone`/`ash` đã sáng hóa (≈5.1–5.2:1 trên canvas). Bỏ toàn bộ override 8/9/9.5/10/11px còn lại ở camera, stepper 4 bước, stage LoadingOverlay, số thứ tự section reading và onboarding — dùng `type.monoStrong`/`type.code`.

### P0-2 — Touch target link chữ
- `wallet.tsx:160` BackLink, `referral.tsx:116` BackLink, `enter-referral.tsx:77` SkipLink, `check-email.tsx:84` "Dùng email khác", `account.tsx:123` "Sao chép" — đều là `Text onPress` không vùng chạm.
- **Phương án:** nâng cấp `TextLink` trong `ui.tsx` (Pressable + minHeight 44 + hitSlop) rồi dùng lại cho cả 5 chỗ.
- **Đã làm:** `TextLink` đã là Pressable 44pt; thay nốt BackLink (referral), SkipLink (enter-referral), "Dùng email khác" (check-email), "Sao chép" (account) và link ẩn/hiện đường chỉ tay ở guest-reading. Back của wallet/referral chuyển vào `ScreenHeader.onBack`.

### P0-3 — Camera
- Offset cứng: `guideTop = insets.top + 108`, các cụm `bottom: insets.bottom + 158/116/230` → rủi ro chồng lấn máy màn nhỏ.
- Thiếu đèn pin dù hint "ĐỦ SÁNG"; nút thư viện là chữ "ẢNH" 9px; không tap-to-focus; status pill 8px ít giá trị.
- **Phương án:** chuyển foreground về cột flex (topbar / khung ở giữa đo bằng onLayout / hints / controls), thêm toggle torch (`enableTorch`), nút thư viện dùng icon, tap-to-focus qua `CameraView.focus`, bỏ status pill (thông tin trùng với trạng thái shutter).
- **Đã làm:** foreground giờ là cột flex: topbar → vùng khung `flex:1` đo bằng `onLayout` (không còn offset 108/158/116/230) → hints/instruction/controls. Thêm toggle đèn pin (`enableTorch`, tự tắt khi chuyển camera trước), nút thư viện + đổi camera dùng icon 48pt, bỏ status pill 8px, nhãn/hints dùng token 12px.
- **Không làm được tap-to-focus:** `expo-camera@58` không expose API focus theo toạ độ (`CameraView` chỉ có `autofocus` prop, không có `focus(point)`); giữ autofocus mặc định và ghi nhận thay vì thêm hành vi giả.

### P0-4 — LoadingOverlay
- Modal chặn toàn bộ, `onRequestClose={() => undefined}`, không có way out trong lúc chờ tới 90s; progress = elapsed/45 → bar chạm 100% từ giây 45 rồi treo.
- **Phương án:** cap hiển thị thanh ở 90% cho tới khi có kết quả; thêm prop `onCancel` (nút hủy + back Android); luồng member: hủy = ngừng chờ, banner info "quẻ vẫn xử lý phía hệ thống, xem Lịch sử sau".
- **Đã làm:** `LoadingOverlay` cap 90%, nhận `onCancel` (nút hủy + back Android). Luồng member dừng polling, hiện banner "Đã hủy màn chờ kết quả" + lối mở Lịch sử. Luồng guest cố ý không có nút hủy vì bài bói thử chỉ xem được một lần qua claim token — hủy sẽ làm mất kết quả.

### P0-5 — Nhãn back sai ngữ cảnh
- `reading/[id].tsx:143` "‹ Lịch sử" (user thường vào từ tab Xem bói); `wallet.tsx:161` "‹ Quay lại Tài khoản" (có thể vào từ banner); `referral.tsx` tương tự.
- **Phương án:** chuẩn hóa "‹ Quay lại".
- **Đã làm:** `ScreenHeader` dùng chung BackButton "‹ Quay lại"; `reading/[id]` đổi từ "‹ Lịch sử" sang "‹ Quay lại" (a11y label cũng đổi).

### P1-6 — Infinite scroll + pull-to-refresh
- 0 chỗ dùng `onEndReached`; wallet không có RefreshControl.
- **Phương án:** `onEndReachedThreshold` 0.5 + tự tải; spinner cuối list khi đang tải thêm; thêm RefreshControl cho wallet.
- **Đã làm:** cả history và wallet dùng `onEndReached` (threshold 0.5), spinner cuối list, lỗi tải thêm có banner "Thử lại" tại chân list; wallet có `RefreshControl`. Bỏ nút "Tải thêm" tay.

### P1-7 — Focus reset danh sách
- `useFocusEffect` load lại trang 1 → mất vị trí cuộn + pagination sau khi vào chi tiết rồi back.
- **Phương án:** refocus giữ dữ liệu cũ, merge theo id (refresh bản ghi đã có), sort theo createdAt desc.
- **Đã làm:** khi focus chỉ tải lại trang đầu rồi merge theo id vào danh sách hiện có, giữ cursor và sort `createdAt` desc; thêm `maintainVisibleContentPosition` để nội dung mới chèn lên đầu không nhảy vị trí cuộn. Cursor backend dùng `_id < cursor` nên giữ cursor qua nhiều lần refresh vẫn an toàn.

### P1-8 — Header compact cho màn utility
- **Phương án:** thêm `compact` cho `ScreenHeader` (1 hàng, title ~22px, không eyebrow/subtitle); áp dụng cho account, wallet, referral, enter-referral. Giữ header đầy đủ cho onboarding/scan/guest/reading/auth (màn "nghi thức").
- **Đã làm:** thêm prop `compact` (1 hàng, `type.headingMd` 22px). Áp dụng account, wallet, referral, enter-referral; wallet/referral dùng `onBack` chung thay link chữ bên phải.

### P1-9 — android_ripple
- **Phương án:** ripple foreground tinh tế cho `Button`, `Chip`, `RadioCard`, hàng list history.
- **Đã làm:** Button/Chip/RadioCard đã có ripple; thêm ripple foreground + bo góc/overflow cho hàng list history.

### P1-10 — Chia sẻ ảnh sơ đồ AI
- Hiện chỉ `Share.share({ message })`.
- **Phương án:** tải ảnh annotated về cache (`expo-file-system` — cần cài thêm; `expo-sharing` đã có) rồi `Sharing.shareAsync`; nút chia sẻ ảnh trên hero image; giữ nút chia sẻ text; fallback về text nếu lỗi.
- **Đã làm:** thêm `expo-file-system@~58.0.13`; nút share icon 44pt trên hero tải ảnh (AI/annotated hoặc ảnh gốc) vào `Paths.cache` bằng `File.downloadFileAsync` rồi `Sharing.shareAsync`. Nếu sharing không khả dụng hoặc tải lỗi → `Share.share` text, cuối cùng fallback clipboard. Nút "Chia sẻ" text ở footer giữ nguyên.

### P2 — các mục cần quyết định (đã chốt)
- **P2-11** giữ tiền tố ASCII chỉ trong Banner, bỏ ở caption rải rác — ảnh hưởng brand, cần chủ quyết.
  - **Đã làm:** chỉ còn `BANNER_PREFIX` dùng `[!] [+] [i]`. Đã bỏ ở Input/Checkbox error, camera error, account, referral, check-email steps, hint/giá ở màn xem bói, enter-referral, reading (kể cả văn bản chia sẻ) và guest-reading. `StatusPill` thay tiền tố bằng icon màu; action của Banner dùng nhãn gạch chân thay `>`.
- **P2-12** thống nhất stepper member/guest — thay đổi luồng sản phẩm.
  - **Đã làm:** tách `RitualSteps.tsx` (RitualStepper + StepCard) dùng chung. Guest chuyển thành wizard 3 bước: Trường phái → Tay + Ảnh → Xác nhận & đồng ý AI. Vẫn gửi toàn bộ mục của trường phái, không tiêu credit, giữ nguyên fingerprint/claim token và các lỗi giới hạn lượt thử. Bước xác nhận bị chặn nếu chưa có ảnh.
- **P2-13** tắt animation khi user bật reduce-motion (`AccessibilityInfo.isReduceMotionEnabled`) — kỹ thuật rõ ràng, chờ duyệt vì đổi hành vi nền.
  - **Đã làm:** thêm hook `lib/motion.ts` (`useReduceMotion`). Khi bật reduce-motion: MysticBackground đứng yên (sao tĩnh), PalmOracle không xoay/float, beam HandGuide/LoadingOverlay ẩn, skeleton reading tĩnh, transition bước xem bói và slide onboarding hiện tức thì, scroll onboarding không animate.
- **P2-14** Dynamic Type (`maxFontSizeMultiplier`) — rủi ro vỡ layout ở nhiều chỗ, nên làm riêng một đợt.
  - **Đã làm:** thêm `MAX_FONT_SCALE = 1.3` (`theme.ts`) và wrapper `components/AppText.tsx` dùng cho toàn bộ text. Wrapper đặt `maxFontSizeMultiplier`, đồng thời nhân `lineHeight` theo hệ số co giãn thực tế (RN chỉ scale fontSize, không scale lineHeight). `TextInput` trong `Input` cũng được cap và scale lineHeight.
  - Các cụm dễ vỡ đã xử lý riêng: tiêu đề camera cho phép 2 dòng; tiêu đề giữa `ReadingTopBar` truncate 1 dòng; mã giới thiệu và số dư ví dùng `adjustsFontSizeToFit` + trần thấp hơn (1.1/1.15); tên trường phái ở hàng lịch sử `flexShrink`; title header compact và pill credits cap 1.2; số thứ tự StepCard cap 1.15.
  - Trần 1.3 là mức cân bằng giữa khả năng đọc và độ vỡ layout; có thể nâng sau khi test trên thiết bị thật.

## Ghi chú quá trình sửa

### Đợt 2026-10-30 (P0 + P1 + P2-13)

- **Kiểm tra lại trước khi sửa:** một phần P0 đã được áp từ trước (token 12px, `stone`/`ash` sáng hơn, `TextLink` 44pt, LoadingOverlay cap 90% + `onCancel` cho member, back "‹ Quay lại" ở ScreenHeader). Đợt này hoàn thiện phần còn lại thay vì làm lại.
- **Camera:** viết lại foreground thành cột flex; vùng khung đo bằng `onLayout` nên không còn offset cứng. Thêm torch, icon thư viện/đổi camera, bỏ status pill 8px. **Tap-to-focus không thực hiện được** vì `expo-camera@58` không có API focus theo toạ độ — đã kiểm tra typings trong `node_modules`, chỉ có prop `autofocus`.
- **Lịch sử/Ví:** infinite scroll + spinner chân list; focus chỉ refresh trang đầu và merge theo id, giữ cursor nên không mất trang đã tải/vị trí cuộn. Wallet thêm pull-to-refresh. Cursor backend là `_id < cursor` nên chiến lược merge an toàn.
- **Header utility:** thêm `ScreenHeader.compact`; account/wallet/referral/enter-referral dùng header 1 hàng. Các subtitle dài ở 4 màn này được bỏ — thông tin vẫn còn trong nội dung màn.
- **Chia sẻ ảnh:** thêm dependency `expo-file-system` (`~58.0.13`) qua `npx expo install`. Ảnh tải vào cache theo `reading.id` (idempotent) rồi mở share sheet; fallback text/clipboard nếu lỗi.
- **Reduce motion:** hook mới `src/lib/motion.ts`; áp cho nền sao/orbit, PalmOracle, beam HandGuide/LoadingOverlay, skeleton reading, transition bước và slide onboarding.
- **P2-11:** dọn tiền tố ASCII khỏi toàn bộ UI ngoài Banner; `StatusPill` dùng icon.
- **P2-12:** guest dùng wizard 3 bước với `RitualStepper`/`StepCard` dùng chung; member giữ 4 bước.
- **P2-14:** thêm `MAX_FONT_SCALE` + `AppText`; migrate toàn bộ `Text`/`TextInput` sang cơ chế co giãn có trần và scale lineHeight. Xử lý riêng các hàng dễ vỡ.
- **Kiểm chứng:** `npx tsc --noEmit`, `npx expo lint` và `npx expo export --platform ios` đều pass. Chưa thử trực quan trên thiết bị — cần test Expo Go ở cỡ chữ lớn nhất cho camera, top bar reading, mã giới thiệu, số dư ví, lịch sử, guest wizard, share sheet ảnh và Reduce Motion.
- **Giới hạn còn lại:** tap-to-focus camera (API expo-camera 58 không hỗ trợ); guest không có nút hủy màn chờ (cố ý, tránh mất kết quả bói thử).
