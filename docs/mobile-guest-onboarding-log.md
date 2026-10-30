# Log phiên: Sửa mobile — Guest trial + Google/FB login + Onboarding mới

> **CẬP NHẬT MỚI NHẤT (2026-10-30, mục G): mobile đã bỏ hoàn toàn đăng ký/đăng nhập.**
> App dùng phiên khách tự động theo thiết bị; các mục 1–7 bên dưới chỉ còn giá trị lịch sử.
> Đọc mục G trước khi làm tiếp.

> File handoff viết ngày 2026-10-30 do sắp hết quota. Phiên sau đọc file này trước khi làm tiếp.
> Repo: `/Users/vutuanhau/Dev/Palm`, nhánh `main`. Tất cả path dưới đây tương đối với root repo.

## 1. Yêu cầu của user (nguyên văn ý)

User xem app mobile (Expo trong `mobile/`) và thấy 3 vấn đề:

1. **Đăng nhập Google/Facebook không vào được** — thực ra mobile chưa hề có nút này (web có, mobile không).
2. **Mất phần guest** — mobile chưa có luồng bói thử cho khách (web có GuestReadingPreview).
3. **Onboarding slides xấu**.

Yêu cầu cụ thể:

- **Chưa đăng nhập → luôn hiện onboarding slides** (bỏ hành vi "chỉ hiện 1 lần duy nhất" cũ).
- **Slide cuối có nút "Bói thử" cho guest** giống web; nếu không muốn thì có nút **Đăng nhập / Đăng ký**.
- Làm cho Google/Facebook login chạy được trên mobile.

## 2. Khảo sát kỹ thuật (đã xác nhận, đừng khảo sát lại)

### Backend đã sẵn sàng, KHÔNG cần sửa

- `POST /auth/google` — nhận `{ idToken }` hoặc `{ code }`, + `claimToken?` (xem `backend/src/auth/auth.controller.ts` ~dòng 168).
- `POST /auth/facebook` — nhận `{ accessToken }`, + `claimToken?` (~dòng 193).
- Backend trả `refreshToken` trong body cho client gửi header `x-client: native` (mobile `lib/api.ts` đã luôn gửi header này).
- `POST /readings/guest` — multipart: `school`, `hand`, `topics?` (bỏ trống = tất cả), `aiConsent`, `image`, `fingerprint` (string ≥16 ký tự, backend tự SHA-256), header `Idempotency-Key`. Trả **201 `{reading, claimToken}`**, hoặc **200 `{reading}`** nếu REJECTED. Có `GuestTrialGuard` (1 lượt/fingerprint + chặn cookie) và rate-limit 5 lượt/IP/ngày. Xem `backend/src/readings/readings.guest.controller.ts`, `guards/guest-trial.guard.ts`.
- `GET /readings/guest/:token` → `GuestReadingPreviewDto` (xem `shared/src/types/reading.dto.ts` — có `sections`, `aspects`, `advice`, `summary`, `disclaimer`, `previewExpiresAt`, `claimToken?`).
- **Lưu ý claim:** `LoginRequestDto` KHÔNG có `claimToken`; chỉ `RegisterRequestDto`, `GoogleAuthRequestDto`, `FacebookAuthRequestDto` có. → mobile gắn claimToken vào register/google/fb thôi.
- Web reference cho luồng guest: `frontend/src/pages/Scan/hooks/useScanSubmit.ts` (contract form) và `frontend/src/pages/GuestReadingPreview/index.tsx` (layout kết quả).

### Mobile — cấu trúc quan trọng

- Gate điều hướng ở `mobile/src/app/_layout.tsx` dùng `Stack.Protected` theo `status` từ `state/auth.tsx` ('loading' | 'signedOut' | 'signedIn').
- Camera là fullScreenModal `src/app/camera.tsx`, trao ảnh qua context `state/capture.tsx` (không dùng navigation params).
- `lib/api.ts`: `request/get/post/put/del/upload`, luôn gửi `x-client: native`, tự refresh token khi 401 TOKEN_EXPIRED. `upload(path, form, { headers, timeoutMs, auth:false })`.
- `lib/uuid.ts` có `newIdempotencyKey()`; `lib/format.ts` có `handLabel`, `topicsLabel`, `formatDateTime`, `SCHOOL_SHORT_LABEL`, `topicLabels`.
- Theme tokens ở `mobile/src/theme.ts` (colors/radius/spacing/text); UI components ở `mobile/src/components/ui.tsx` (Button, GOLD_GRADIENT, Card, Chip, Checkbox, Banner, LoadingOverlay, Input, Screen/ScreenHeader ở `components/Screen.tsx`).
- Env mobile: `.env` có `EXPO_PUBLIC_API_URL`. **Lưu ý môi trường dev: `npx expo install` bị crash trên máy này** — thêm dep thủ công vào `mobile/package.json` rồi `pnpm install --filter mobile` (đã chạy OK).
- `mobile/package.json` có `experiments.typedRoutes: true` → route phải là path thật (`/login`, `/register`, `/guest`), KHÔNG dùng `/(auth)/login` khi `router.push`.

### expo-auth-session (đã cài ~58.0.16, hoisted ở root `node_modules/expo-auth-session`)

- Google: dùng `useIdTokenAuthRequest({ androidClientId, iosClientId, webClientId })` → id_token nằm ở `response.params.id_token`.
- Facebook: `Facebook.useAuthRequest({ clientId: <fbAppId> })` → response success có `accessToken` (TokenResponse).
- Cần cấu hình bên ngoài (user phải tự tạo): Google Cloud Console (Android/iOS/Web client ID, gói `android.package` phải khớp), Facebook app ID; thêm scheme vào `app.json`: `["palmsight", "com.googleusercontent.apps.<id>", "fb<appId>"]`.

## 3. Đã làm xong (code đã viết, CHƯA typecheck)

| # | File | Thay đổi |
|---|---|---|
| 1 | `mobile/package.json` | Thêm `expo-auth-session ~58.0.16`, đã `pnpm install` OK |
| 2 | `mobile/src/lib/fingerprint.ts` | **MỚI** — UUID ổn định lưu AsyncStorage làm guest fingerprint |
| 3 | `mobile/src/lib/readings.ts` | Thêm `createGuestReading()` (POST `/readings/guest`, auth:false, timeout 75s) + `fetchGuestPreview()`; guest bói tất cả mục (không gửi topics) |
| 4 | `mobile/src/lib/authApi.ts` | Thêm `loginWithGoogle(idToken, claimToken?)`, `loginWithFacebook(accessToken, claimToken?)` |
| 5 | `mobile/src/state/capture.tsx` | Viết lại: thêm `target: 'scan' \| 'guest'`, `submitPhoto(photo, target)` |
| 6 | `mobile/src/app/camera.tsx` | Đọc `target` từ context, submit kèm target |
| 7 | `mobile/src/app/(tabs)/index.tsx` | Dùng `memberPhoto = target==='scan' ? photo : null`; gallery submit kèm `'scan'` |
| 8 | `mobile/src/app/guest.tsx` | **MỚI** — màn bói thử guest: chọn trường phái/tay, camera (push `/camera`)/gallery, consent → POST guest → `router.replace('/guest-reading/[token]')`. Xử lý GUEST_TRIAL_LIMIT_REACHED (CTA đăng ký), IP_TRIAL_LIMIT_EXCEEDED, AI_UNAVAILABLE, REJECTED, mất mạng |
| 9 | `mobile/src/app/guest-reading/[token].tsx` | **MỚI** — kết quả guest: banner hết hạn, ảnh (toggle annotated), topics, summary, sections, aspects, advice, disclaimer; footer CTA **Đăng ký (kèm `claimToken` param)** + Đăng nhập |
| 10 | `mobile/src/app/onboarding.tsx` | **Viết lại** — Emblem glyph trong vòng gradient vàng, DividerRow eyebrow, LinearGradient nền, dots dài hơn; slide cuối: `✦ Bói thử miễn phí (khách)` → `/guest`, `Đăng nhập` outline, `Đăng ký` ghost; các slide khác: `Tiếp theo` + `Bỏ qua — đăng nhập ngay`; đã bỏ `useOnboarding`/AsyncStorage, thêm `useSafeAreaInsets` cho footer |
| 11 | `mobile/src/app/_layout.tsx` | **Viết lại Gate**: `signedOut` → hiện `onboarding`, `(auth)`, `guest`, `guest-reading/[token]`; `signedIn` → tabs + reading/wallet/referral/enter-referral; `camera` luôn hiển thị (khỏi Protected vì đã early-return khi loading); bỏ `OnboardingProvider` |
| 12 | `mobile/src/state/onboarding.tsx` | **ĐÃ XOÁ** |
| 13 | `mobile/src/lib/preferences.ts` | Bỏ `hasSeenOnboarding/markOnboardingSeen` (chỉ còn lastSchool) |
| 14 | onboarding/guest/guest-reading | Đã chuẩn hoá path `/(auth)/login` → `/login`, `/(auth)/register` → `/register` bằng perl |
| 15 | `mobile/src/app/(auth)/login.tsx` | Thêm nút **Đăng nhập bằng Google/Facebook** (`Google.useIdTokenAuthRequest`, `Facebook.useAuthRequest`). Nút chỉ render khi env nền tảng tương ứng có giá trị (hook ném lỗi nếu thiếu client ID). Nhận `claimToken` từ params để social login "nhận" bài bói thử; lỗi/huỷ đều có thông báo |
| 16 | `mobile/src/state/auth.tsx` | `signInWithGoogle/Facebook` đã có từ phiên trước nhưng **thiếu trong context value** — đã thêm vào `useMemo` (nếu không, gọi từ login sẽ undefined) |
| 17 | `mobile/src/app/(auth)/register.tsx` | Đọc `claimToken` từ `useLocalSearchParams`, gửi kèm body `register` (backend lưu vào pending user, claim khi verify email); banner thông báo + giữ claimToken khi chuyển login/register |
| 18 | `onboarding.tsx`, `guest.tsx`, `guest-reading/[token].tsx` | Sửa các CTA từng push `/` (route tabs bị chặn khi signedOut) → `/login`, `/register`; guest-reading truyền `claimToken` sang cả đăng ký lẫn đăng nhập |
| 19 | `backend/src/auth/google-auth.verifier.ts` | `verify()` nhận thêm audience từ `GOOGLE_MOBILE_CLIENT_IDS` (comma-separated) — id_token native có `aud` là client ID Android/iOS, không phải web client ID, nên trước đây mobile sẽ bị 401 |
| 20 | `backend/.env.example`, `mobile/.env.example` | 4 biến Google/FB + `GOOGLE_MOBILE_CLIENT_IDS`, hướng dẫn scheme và dev build |
| 21 | `guest.tsx`, `(tabs)/index.tsx`, `wallet.tsx` + unused imports | Dọn lint: `setElapsed(0)` chuyển khỏi effect (react-hooks/set-state-in-effect), wallet dùng `useFocusEffect`, xoá import chết. `expo lint` + `tsc --noEmit` sạch |
| 22 | `mobile/src/app/_layout.tsx` | `unstable_settings.anchor = 'onboarding'` — mở app ở `/` khi signedOut trước đây fallback vào nhóm `(auth)` (mở thẳng login, không thấy guest); giờ luôn về onboarding |
| 23 | `mobile/src/app/(auth)/login.tsx` | Nút Google/Facebook **luôn hiển thị**; nếu thiếu env thì bấm vào báo rõ thiếu Client ID (trước đó ẩn hoàn toàn nên tưởng không có). Thêm CTA **"Bói thử miễn phí (khách)"** → `/guest` ngay trên màn login |
| 24 | `mobile/src/state/capture.tsx`, `guest.tsx`, `(tabs)/index.tsx` | Thêm `setTarget` vào context; màn guest set `target='guest'` trước khi mở camera. Trước đó camera dùng target mặc định `'scan'` → ảnh chụp từ luồng guest bị gán cho thành viên, guest không có ảnh để submit |

## 4. CÒN LẠI — chỉ là cấu hình bên ngoài (user tự làm)

Đã xong toàn bộ phần code (typecheck + lint sạch). Để OAuth chạy thật trên máy:

1. **Google Cloud Console**: backend **đã có** `GOOGLE_CLIENT_ID/SECRET` của web client (cùng project là được). Cần tạo thêm **Android** và **iOS** OAuth client. `app.json` đã khai báo `android.package` + `ios.bundleIdentifier` = `com.palmsight.app` (đổi trước khi build nếu muốn, nhưng phải khớp client đã tạo). Điền `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` / `..._IOS_CLIENT_ID` (và `..._WEB_CLIENT_ID` nếu chạy web), thêm ID native vào `GOOGLE_MOBILE_CLIENT_IDS` của backend.
2. **Facebook Developer**: app ID vào `EXPO_PUBLIC_FACEBOOK_APP_ID`; backend `FACEBOOK_APP_ID/SECRET` phải cùng một app.
3. **Scheme**: thêm vào `app.json` → `"scheme": ["palmsight", "com.googleusercontent.apps.<GOOGLE-CLIENT-ID>", "fb<FACEBOOK-APP-ID>"]` (khi có ID thật; chưa có thì giữ `"palmsight"`).
4. **Dev build**: OAuth native không chạy trong Expo Go — cần `npx expo run:android` hoặc `eas build --profile development`.
5. **Chưa test máy thật**: guest flow cần backend chạy + `EXPO_PUBLIC_API_URL` đúng; social login cần các bước 1–4.
6. **Docs**: `docs/mobile-conversion-plan.md` và `docs/mobile-conversion-log.md` được nhắc trong log cũ **không tồn tại trong repo** (CONTEXT.md đang trỏ tới file plan bị thiếu). Trạng thái phiên này được ghi ngay trong file này.

## 5. Quy ước ngôn ngữ

- Code comment và UI text: tiếng Việt, giọng "huyền học" của app (ví dụ "✦ Thiên Cơ Luận Giải ✦").
- Comment chỉ viết khi nói constraint mà code không tự hiện ra (pattern của repo).

## 6. Trạng thái todo cuối phiên

- [x] Khảo sát backend OAuth + guest API + mobile flow
- [x] Libs: fingerprint, guest API, OAuth authApi, capture target
- [x] Màn guest scan (`guest.tsx`) + guest reading (`guest-reading/[token].tsx`)
- [x] Onboarding slides mới + CTAs cuối
- [x] Root layout gate mới + anchor onboarding
- [x] Google/FB buttons trong login.tsx + methods trong state/auth.tsx (+ fix context value)
- [x] register.tsx nhận claimToken + CTA paths đúng
- [x] Typecheck + `expo lint` toàn bộ mobile — sạch; backend typecheck sạch
- [x] `.env.example` (mobile + backend) + hướng dẫn scheme/app.json
- [x] Google OAuth cho Expo Go qua backend + ngrok (start/callback/exchange) — chờ thêm redirect URI vào Google Console để test
- [ ] Cấu hình Google/Facebook console + dev build + test máy thật (xem mục 7)

## 7. Hướng dẫn setup Google/Facebook (ghi ngày 2026-10-30)

Đã khai báo `app.json`: `android.package` + `ios.bundleIdentifier` = `com.palmsight.app`.
Máy dev: có Android SDK + emulator `Medium_Phone_API_37.0` + JDK 17; **không có Xcode** → dev build iOS phải dùng EAS (cần Apple Developer).

### A. Google (làm Android trước)

1. Google Cloud Console, cùng project với web client backend đang dùng:
   - Credentials → Create credentials → OAuth client ID → **Android**:
     - Package name: `com.palmsight.app`
     - SHA-1: `01:48:65:4F:5F:A4:04:87:DC:BB:8F:14:44:CA:23:A5:D4:BE:74:FB` (debug keystore hiện tại của máy)
   - (tuỳ chọn) OAuth client **iOS**: bundle ID `com.palmsight.app`.
   - Nếu consent screen ở chế độ Testing: thêm tài khoản Google của bạn vào Test users.
2. `mobile/.env`:
   ```
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<client ID Android>
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<GOOGLE_CLIENT_ID của backend>
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<client ID iOS nếu có>
   ```
3. `backend/.env`: `GOOGLE_MOBILE_CLIENT_IDS=<client ID Android>,<client ID iOS>` → restart backend.
4. `app.json` → đổi `"scheme": "palmsight"` thành mảng (bỏ hậu tố `.apps.googleusercontent.com`):
   ```json
   "scheme": ["palmsight", "com.googleusercontent.apps.<ANDROID_ID>", "com.googleusercontent.apps.<IOS_ID>", "fb<FACEBOOK_APP_ID>"]
   ```
   `login.tsx` tự dựng redirect `com.googleusercontent.apps.<id>:/oauthredirect` từ client ID nền tảng.

### B. Facebook

1. developers.facebook.com → Create app → thêm sản phẩm **Facebook Login**.
2. Settings → Basic: lấy **App ID** + **App Secret**.
3. Thêm nền tảng **Android**: package `com.palmsight.app`, class `com.palmsight.app.MainActivity`,
   key hash `AUhlT1+kBIfcu48URMojpdS+dPs=` (debug keystore hiện tại).
4. Facebook Login → Settings: bật Client OAuth Login + Embedded Browser OAuth Login; thêm Valid OAuth Redirect URI `fb<APP_ID>://authorize` (nếu ô nhập cho phép custom scheme).
5. App roles: thêm tài khoản Facebook của bạn làm Admin/Tester — app ở Development mode chỉ tester đăng nhập được.
6. `mobile/.env`: `EXPO_PUBLIC_FACEBOOK_APP_ID=<App ID>`.
7. `backend/.env`: `FACEBOOK_APP_ID=<App ID>`, `FACEBOOK_APP_SECRET=<App Secret>` → restart backend.

### C. Development build Android (Expo Go không chạy OAuth native)

1. Khởi động emulator: `~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_37.0`
   (hoặc cắm máy thật bật USB debugging).
2. `cd mobile && npx expo start -c` (nạp lại env), rồi `npx expo run:android` ở terminal khác
   — lần đầu prebuild + Gradle build khá lâu.
3. Mở app PalmSight (bản dev) → Đăng nhập → Google/Facebook.

### D. Google OAuth cho Expo Go qua backend + ngrok (đã code xong 2026-10-30)

Expo Go không nhận redirect scheme native (Google chặn `exp://`), và user đã **từ chối device flow**
(nhập mã) — nên app tự phát hiện Expo Go (`Constants.executionEnvironment === StoreClient`) và đi qua backend:

1. `POST /auth/google/browser/start` → backend trả URL Google (state lưu ở server).
2. App mở URL bằng `WebBrowser.openAuthSessionAsync(authorizeUrl, Linking.createURL('google-auth'))`.
3. Google → `GOOGLE_OAUTH_REDIRECT_URI` (HTTPS công khai) → backend đổi code, verify id_token, tạo phiên
   → redirect về `exp://.../--/google-auth?code=<mã dùng một lần>`.
4. App gọi `POST /auth/google/browser/exchange` để đổi mã lấy `AuthResponseDto` (kèm refreshToken native).

Setup:
1. `ngrok http 4000` → lấy URL, ví dụ `https://raven-urchin-apply.ngrok-free.dev`.
2. `backend/.env`: `GOOGLE_OAUTH_REDIRECT_URI=https://<ngrok>/api/v1/auth/google/browser/callback` → restart backend.
3. Google Console → Credentials → OAuth client **Web** (client backend đang dùng) → Authorized redirect URIs
   → thêm đúng URL callback ở trên → Save (đợi vài phút).
4. Reload Expo Go → Đăng nhập → Google → trang chọn tài khoản → tự quay về app.

Lưu ý:
- URL ngrok free đổi mỗi lần chạy lại → phải cập nhật cả Google Console và backend env. Nên đặt static
  domain trong ngrok dashboard rồi chạy với domain cố định.
- Dev build vẫn dùng OAuth native (mục A/B). Device flow cũ đã bỏ; `GOOGLE_DEVICE_CLIENT_ID/SECRET`
  trong `.env` không còn dùng.
- State + mã dùng một lần lưu trong bộ nhớ backend: `backend/src/auth/google-browser-auth.service.ts`
  (TTL state 10 phút, mã exchange 2 phút) — chạy một instance backend.
- Đã sửa bug: `POST /auth/google` và `/auth/facebook` giờ trả `refreshToken` trong body cho mobile
  (`x-client: native`), giống `/auth/login`.

Lưu ý:
- Đổi JS thường: chỉ cần reload Metro. Đổi `scheme`/app.json hoặc env native: phải build lại.
- `EXPO_PUBLIC_*` được inline lúc bundle; với EAS build phải khai báo env trong `eas.json`/EAS secrets.
- Khi build bằng EAS/release, keystore khác → phải thêm SHA-1 (Google) và key hash (Facebook) của keystore đó.
- Guest flow không cần các bước trên — chạy được ngay trong Expo Go khi backend bật.

## E. UI polish pass (2026-10-30)

Đã sửa theo báo cáo UI review, không đổi contract backend:

- **Onboarding**: nút Tiếp theo/Quay lại dùng `scrollToIndex`, slide scroll dọc được, footer cao ổn định, ẩn slide ngoài màn hình khỏi screen reader, dots có accessibilityActions, bỏ em-dash, đổi thứ tự CTA cuối (Đăng ký outline, Đăng nhập ghost).
- **Scan/Guest**: scan thành wizard 4 bước có progress, chỉ render bước hiện tại; consent AI mặc định tắt; CTA khoá có lý do hiển thị; credit refresh sau lỗi; đổi trường phái giữ khía cạnh cuộc sống; radio/chip dùng `checked` + `aria-checked`; loading 45s và thông báo khi quá mốc; guest dùng cùng RadioCard/Chip semantics.
- **Login/Register**: password có accessible label; resend email chỉ hiện khi `EMAIL_NOT_VERIFIED` và dùng `details.email`; nút Facebook chỉ render khi có env; thêm back link; Terms/Privacy mở `/terms` `/privacy` qua `EXPO_PUBLIC_WEB_URL`; lỗi form cuộn về đúng chỗ; helper không bị ẩn khi có lỗi; form register chia nhóm; bỏ claim xoá dữ liệu tức thì.
- **Camera**: HUD tiếng Việt + trạng thái đúng, scrim cho HUD/instruction/error, guide theo chiều cao màn hình, safe area cho màn quyền, spinner khi đang kiểm tra quyền, lỗi có live region.
- **Design tokens**: nâng contrast `stone`/`ash`, thêm `inputBorder`; input có focus border, nút/chip có pressed state, touch target chip/checkbox/eye/forgot link >=44.
- **Đã kiểm tra**: `pnpm --filter mobile typecheck` và `lint` sạch; DOM web đi đủ scan bước 1→4, step 4 hiện lý do khoá CTA và consent tắt.
- **Chưa kiểm tra trên máy thật**: nested scroll của slide, Google browser flow trong Expo Go, camera permission/preview. Sau khi reload Expo Go cần thử các luồng này.

## F. Celestial Editorial redesign (2026-10-30)

Đã nâng cấp toàn bộ UI mobile theo hướng **Celestial Editorial**, giữ đúng palette/font của web để đồng bộ thương hiệu. Không đổi API, không đổi business rule.

### Design foundation
- `mobile/src/theme.ts`: token lấy nguyên từ `frontend/tailwind.config.cjs` + `globals.css` — canvas `#0b0716`, ink `#f5e6c8`, gold `#d4af37`, card `#1b1233`, container `#241842`, elevated `#2c1d4f`, stone `#7e6d99`, ash `#6a5885`; thêm gradient gold/card đúng web.
- Font: `@expo-google-fonts/cormorant-garamond`, `be-vietnam-pro`, `jetbrains-mono`, nạp trong `mobile/src/app/_layout.tsx` bằng `expo-font` trước khi hide splash. Đã kiểm tra đủ glyph tiếng Việt (ế, ộ, ữ, đ, ằ, ẫ, ợ, ụ, ỹ, ạ, ấ...).
- Type scale mới: Cormorant Garamond cho display/quote, Be Vietnam Pro cho body/label, JetBrains Mono cho eyebrow/code.
- `Button` giờ nhận `style` ở Pressable ngoài (fix lỗi nút `flex:1` bị co), `Card` là mystic gradient + hairline + inner highlight + `ornate` tarot corners, `Input/Chip/RadioCard/Banner/StatusPill` theo ngôn ngữ web.
- Motif mới: `components/mystic/PalmOracle.tsx` (bàn tay SVG + vòng chiêm tinh quay + float), `MysticBackground.tsx` (radial glow + 2 vòng + 14 sao), `HandGuide.tsx` (silhouette + tarot corners + scan beam), `TarotCorners`, `MysticDivider`, `HandChoice`.
- `useAnimatedValue` (`lib/useAnimatedValue.ts`) thay pattern `useRef(new Animated.Value()).current` để qua React Compiler lint.
- Dependencies thêm: `@expo-google-fonts/cormorant-garamond`, `@expo-google-fonts/be-vietnam-pro`, `@expo-google-fonts/jetbrains-mono`, `react-native-svg@15.16.0`, `expo-haptics` (đều chạy trong Expo Go).
- Icon/splash: thay icon Expo mặc định bằng bộ icon PalmSight (hand + ring, palette web) trong `mobile/assets/images/` — `icon.png`, `splash-icon.png`, `android-icon-foreground/background/monochrome.png`, `favicon.png`; `app.json` dùng icon PNG cho iOS và splash `imageWidth: 120`.

### Màn hình đã redesign
- **Onboarding**: 4 slide editorial — hero PalmOracle, nghi thức 3 bước có HandGuide, 3 trường phái có glyph, credit sigil 3 credits; progress dạng thanh gold; bỏ link đăng nhập thừa ở footer (đã có "Bỏ qua").
- **Scan (tab Xem bói)**: stepper 4 bước dạng chòm sao; card bước có số lớn + quote; school cards có glyph; HandChoice SVG; HandGuide ở bước chụp; loading overlay hiển thị ảnh thật + scan beam + 4 giai đoạn thật (tải ảnh → MediaPipe → ONNX → AI).
- **Camera**: full-bleed, HUD "Ấn tượng thấu thị", hand silhouette + corner + scan beam, hint pills, shutter gold, gallery, flash animation, haptics (capture/switch/gallery).
- **Result**: hero ảnh full-bleed + tarot corners + toggle ảnh gốc/sơ đồ AI; legend Tâm/Trí/Sinh đạo; mục đã chọn; summary pull-quote; section cards có số thứ tự + Quan sát/Ý nghĩa; aspects; advice; disclaimer; footer gọn 2 nút (Bói thêm + Chia sẻ), xoá đưa xuống cuối bài.
- **History/Wallet/Account/Referral**: card gradient, balance hero number, ledger row có dấu +/−, profile avatar gold, mã giới thiệu ornate; **Login/Guest/Camera permission** dùng cùng nền sao + typography mới.

### Đã kiểm tra
- `npx tsc --noEmit`, `npx expo lint` sạch (0 error/warning); `npx expo export --platform web` bundle production thành công.
- Expo web: đi đủ onboarding 1→4, guest, camera permission, login, loading overlay, result preview với mock data. Ảnh preview route đã **xoá** khỏi repo sau khi kiểm tra.
- Font tiếng Việt hiển thị đúng trên web (Cormorant + Be Vietnam Pro).
- `npx expo-doctor` báo duplicate `react`/`react-dom` (frontend 18.3.1 vs mobile 19.3.0) do pnpm workspace — **không ảnh hưởng bundle mobile**; không dedupe vì sẽ đụng frontend. Icon iOS đã flatten bỏ alpha; Android background opaque.

### Chưa kiểm tra / việc tiếp theo
- Chưa chạy lại trên **Expo Go máy thật** sau redesign: cần thử camera preview, scan thật, result thật, NativeTabs, haptics.
- Chưa có share card dạng ảnh (hiện dùng `Share.share` text); nếu muốn WOW hơn có thể thêm `react-native-view-shot` + layout share card.
- Có thể nối legend 3 đường với scroll tới section tương ứng (hiện chỉ hiển thị thông tin).
- Các màn guest-reading vẫn dùng layout card cũ (đã nhận theme mới) — có thể nâng cấp theo pattern result nếu cần.

## G. Bỏ đăng ký/đăng nhập — phiên khách tự động (2026-10-30)

### Mô hình mới

- Mobile **không còn màn đăng ký/đăng nhập**, không còn `(auth)`, `guest.tsx`, `guest-reading/[token].tsx`.
- Mỗi thiết bị là một **tài khoản khách ẩn danh**:
  - `mobile/src/lib/deviceId.ts` (native: SecureStore; web: `deviceId.web.ts` + localStorage) sinh UUID và giữ cố định.
  - App gọi `POST /auth/device` với `deviceId`; backend tạo user `isAnonymous: true`, `email: null`, tặng **3 credits** (SIGNUP_BONUS), trả JWT + refreshToken như login thường.
  - Gọi lại cùng `deviceId` mở lại đúng tài khoản, không tạo mới.
- Toàn bộ luồng bói thành viên cũ dùng nguyên: tab Xem bói, credits, Lịch sử, Ví, referral. Không còn kết quả bị cắt như guest cũ.
- Tab thứ 3 đổi tên **Hồ sơ**: hiển thị Khách, credits, ví/giới thiệu, cảnh báo dữ liệu gắn với thiết bị, link xoá dữ liệu.
- Onboarding:
  - Chỉ hiện khi **chưa hoàn thành onboarding và chưa có bài bói nào** (`state/onboarding.tsx` kiểm tra `palmsight.onboardingCompleted` + gọi `fetchReadings` một lần).
  - **Không còn nút Bỏ qua**; CTA cuối slide 4 là **Bắt đầu xem bói**, sau đó gate tự điều hướng vào tabs.
  - Copy mới: 3 lượt miễn phí, không cần tài khoản.

### Backend

- `POST /auth/device` — `DeviceSessionRequestDto { deviceId }`, validate bằng `deviceSessionSchema` (16–128 ký tự `[A-Za-z0-9_-]`).
- `User` thêm `isAnonymous`, `deviceIdHash`, `signupIpHash`; index unique partial trên `deviceIdHash`.
- `GET /me` trả thêm `isAnonymous`.
- Chống farm credit: tối đa `ANONYMOUS_SIGNUP_DAILY_CAP` (mặc định 20) tài khoản khách/IP/24h → lỗi `DEVICE_SESSION_LIMIT_REACHED` (429). Cùng `deviceId` không bị tính thêm. Đừng hạ quá thấp vì CGNAT mạng di động dùng chung IP; test dùng mốc 3.
- Test mới: `backend/test/auth-device.spec.ts` (5 test, gồm chặn thiết bị có tài khoản đã xoá) — tổng bộ test backend 247 test pass.
- **Cần chạy `pnpm --filter backend db:sync-indexes`** trên môi trường thật để tạo index `deviceIdHash` (dev thường autoIndex).

### Mobile files

- Mới: `lib/deviceId.ts`, `lib/deviceId.web.ts`, `state/onboarding.tsx`, `components/SessionGate.tsx`.
- Sửa: `state/auth.tsx` (tự tạo phiên khách, retry khi mất mạng), `app/_layout.tsx` (gate onboarding), `app/onboarding.tsx` (bỏ Bỏ qua, CTA mới), `(tabs)/account.tsx` (Hồ sơ), `(tabs)/index.tsx` + `camera.tsx` + `state/capture.tsx` (bỏ target guest), `lib/readings.ts` (bỏ API guest), `lib/preferences.ts` (cờ onboarding).
- Đã xoá: `app/(auth)/*`, `app/guest.tsx`, `app/guest-reading/*`, `lib/fingerprint.ts`; `lib/authApi.ts` chỉ còn `createDeviceSession`.
- `app.json`: đặt `plugins: [["expo-router", { "asyncRoutes": false }]]` — sau khi xoá nhiều route, async-route lazy chunk cũ có thể gây lỗi `fetchThenEvalJs`/`eval(body)` ở client đang mở; tắt asyncRoutes nạp tất cả route vào entry bundle (app nhỏ, 11 route) và tránh hẳn lỗi chunk chết. Đổi config này phải restart Metro.
- `mobile/.env.example` chỉ còn API URL + WEB URL (OAuth mobile không còn dùng).

### Đã kiểm tra

- `pnpm --filter backend typecheck`, `pnpm --filter backend test` (40 file / 247 test), `pnpm --filter frontend typecheck`.
- `mobile: tsc --noEmit` + `expo lint` sạch; `expo export --platform web` bundle thành công.
- Chạy thật Expo web + backend + Mongo replica set: onboarding 4 slide không có Bỏ qua → Bắt đầu xem bói → tabs; Hồ sơ hiện Khách/3 credits; reload giữ phiên không hiện lại onboarding; tắt backend hiện màn "Chưa kết nối được" và Thử lại khôi phục đúng phiên.

### Chưa làm / việc tiếp theo

- **Chưa test trên Expo Go máy thật** (camera, submit bài bói thật cần AI key + backend Atlas).
- Chưa có **liên kết tài khoản** để giữ dữ liệu khi đổi máy; hiện dữ liệu gắn với thiết bị. Nếu làm: thêm endpoint link Google/Apple + merge readings/credits từ user ẩn danh sang tài khoản thật.
- Chưa có thanh toán/IAP; credit hiện đến từ 3 lượt tặng + referral.
- Guest API cũ (`/readings/guest`) vẫn giữ cho web, mobile không dùng.
- Tài khoản thật cũ vẫn mở được nếu refresh token còn hạn; hết hạn thì app tự tạo tài khoản khách mới (không còn đường đăng nhập lại).

