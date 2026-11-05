# PalmSight — mobile-2

App Android (Expo / React Native, expo-router) của PalmSight. Dark-only "cosmic glass": nền đêm xanh, aurora tím, vàng champagne, serif Cormorant + Be Vietnam Pro. 9 ngôn ngữ: en, vi, id, hi, zh, ru, ja, pt, es (`src/i18n/`).

- **Không có đăng ký hay đăng nhập.** Mỗi thiết bị là một tài khoản: app đọc Android ID (hoặc UUID) và gọi `POST /auth/device`. Không có bản web phát hành (script `web` chỉ còn để xem thử giao diện).
- **Điều hướng:** 5 tab `Trang chủ · Quét · Lịch sử · GEM · Hồ sơ`; màn con: kết quả, camera, sửa hồ sơ, nhập và chia sẻ mã giới thiệu, onboarding. Danh sách màn hình: [../docs/screens.md](../docs/screens.md).
- **Kinh tế:** GEM, điểm danh, vòng quay, quảng cáo có thưởng, VIP qua Google Play: [../docs/business-rules.md](../docs/business-rules.md).
- **Quyền riêng tư:** xoá tài khoản ngay trong Hồ sơ; chính sách và điều khoản mở từ trang tĩnh `legal/`.

## Chạy local

Yêu cầu: Node 22+, pnpm 9+, Docker, backend PalmSight đang chạy.

```bash
# ở thư mục gốc repo
pnpm install
docker compose up -d
pnpm --filter backend dev

# app (Expo, cổng 8081, tự mở adb reverse nếu emulator đã bật)
pnpm start:mobile2
```

Cổng Metro là `8081` để khớp với cổng ghi sẵn trong APK debug.

### API URL

`mobile-2/.env` (xem `.env.example`; giá trị thật đặt trong `.env.local`, không commit):

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_WEB_URL=https://boi-two-delta.vercel.app   # trang legal/, nơi mở chính sách và điều khoản
```

- **Android emulator: phải dùng `adb reverse`, không dùng `10.0.2.2`.** `pnpm start:mobile2` tự mở hầm cho cổng `4000` và `8081`; chạy tay: `node scripts/adb-reverse.js`. Hầm mất khi khởi động lại emulator hoặc `adb kill-server`; chạy lại lệnh, không cần tắt Metro.
- Máy thật: đổi `EXPO_PUBLIC_API_URL` sang IP LAN của máy dev hoặc URL công khai.
- Trỏ Render: `https://boi-qvgy.onrender.com/api/v1` (đã đặt sẵn trong `eas.json` cho preview và production).
- `EXPO_PUBLIC_*` được nhúng lúc build: đổi giá trị thì phải build lại.

### Dev build

Quảng cáo, Adjust, Firebase và react-native-iap là native module nên không chạy trong Expo Go. Dùng dev build (`eas build --profile development`) hoặc `expo prebuild` rồi chạy trên emulator.

## Cấu trúc chính

```text
mobile-2/
├─ src/app/            # expo-router: (tabs)/ và các màn con
├─ src/ads/            # AppLovin MAX, chính sách banner/interstitial, đồng ý và đo lường (revenue.ts)
├─ src/billing/        # react-native-iap, xác minh VIP với backend
├─ src/earn/ premium/  # điểm danh, vòng quay, paywall
├─ src/i18n/           # translations.ts, screen-strings.ts (đủ 9 ngôn ngữ, có test)
├─ src/lib/            # API client, token, xoá tài khoản, mở chính sách/điều khoản
├─ plugins/            # config plugin Expo (chặn quyền Android, build Windows)
├─ firebase.json       # tắt tự thu thập Analytics/Crashlytics từ native
└─ eas.json            # profile development / preview / production
```

## Quảng cáo, đồng ý và đo lường

- Quảng cáo dùng **AppLovin MAX** (banner, xen kẽ, gốc, MREC, app open, có thưởng). Cần `APPLOVIN_SDK_KEY` và các `EXPO_PUBLIC_MAX_ANDROID_*_ID`; thiếu SDK key thì quảng cáo không được biên dịch vào bản build (`adsInBuild()`).
- Người dùng VIP không thấy banner, quảng cáo xen kẽ và quảng cáo gốc; quảng cáo có thưởng thì ai cũng xem được nếu chọn.
- Quảng cáo có thưởng đi qua vé của backend (`/currency/ad-rewards`): xin vé, xem, nhận thưởng. Không còn xác minh phía server bằng callback AdMob (`/ads/rewarded/*` đã bỏ).
- `EXPO_PUBLIC_ADS_ENABLED=false` tắt quảng cáo; `EXPO_PUBLIC_ADS_MOCK=true` dùng `SimulatedAdHost` (đếm ngược thay cho video) để thử luồng kinh tế khi chưa có dev build.
- **Đo lường** (Adjust, Firebase Analytics, Crashlytics) chỉ bật khi vùng đồng ý là `OTHER` (ngoài GDPR); `GDPR` và `UNKNOWN` tắt (Adjust không được khởi tạo; lần mở mà chờ đồng ý quá 30 giây thì phiên đó không có Adjust) (`src/ads/revenue.ts`, `measurementAllowed`). `firebase.json` đặt mặc định tắt ở native. Hạn chế: người dùng EEA đã đồng ý vẫn bị tắt đo lường vì app chỉ biết vùng.
- Mục "Quyền riêng tư quảng cáo" trong Hồ sơ chỉ hiện ở vùng GDPR.

### Quyền Android

Khai `CAMERA`; chọn ảnh từ thư viện (expo-image-picker) trên Android 12 trở xuống có thể xin `READ_EXTERNAL_STORAGE`, Android 13 trở lên dùng bộ chọn ảnh hệ thống. `RECORD_AUDIO` (và `recordAudioAndroid: false`), `USE_BIOMETRIC`, `USE_FINGERPRINT` bị chặn ở mọi bản build; `SYSTEM_ALERT_WINDOW` bị chặn ở EAS profile preview/production (dev menu cần nó). Logic ở `plugins/blocked-permissions.js`, test ở `src/lib/blocked-permissions.spec.ts`. Cần đọc merged manifest của bản EAS thật để chắc chắn.

### Việc bắt buộc trước khi phát hành

- [ ] Play Console: Ads disclosure, Data Safety (nhà cung cấp quảng cáo, định danh thiết bị, đo lường), URL chính sách và URL xoá dữ liệu, độ tuổi (từ 16), Advertising ID.
- [ ] Chính sách riêng tư, điều khoản đã được duyệt và hết `[ĐIỀN]`, `[XÁC NHẬN]` trước khi đăng.
- [ ] `app-ads.txt` nếu mạng quảng cáo yêu cầu (hiện `legal/` chưa có).
- [ ] Cấu hình consent (UMP/MAX) và Adjust đúng cho vùng GDPR; kiểm URL chính sách truyền cho luồng đồng ý.
- [ ] EAS preview/production: kiểm merged manifest và `firebase_analytics_collection_enabled`.

### Kinh tế quảng cáo

eCPM rewarded ở Việt Nam thường chỉ khoảng 2 đến 8 USD mỗi 1000 lượt (0,2 đến 0,8 cent mỗi lượt xem) trong khi một lần bói bằng Gemini/Groq tốn cỡ 0,005 đến 0,01 USD; quảng cáo có thưởng là công cụ giữ chân, không phải nguồn lợi nhuận. Đo trên traffic thật trước khi nâng trần thưởng (`BONUS_AD_CAP`, `AD_SPINS`).

## Kiểm tra

```bash
pnpm --filter mobile-2 typecheck
pnpm --filter mobile-2 lint
pnpm --filter mobile-2 test
```

Camera thật cần chạy trên thiết bị hoặc emulator. Luồng gọi AI thật phụ thuộc `GEMINI_API_KEY` / `GROQ_API_KEY` của backend. Icon và splash nằm ở `assets/images/`, nguồn SVG ở `assets/brand/`.
