# PalmSight — mobile-2 (Cosmic Glass)

Bản thiết kế lại giao diện mobile của PalmSight, chạy song song với app `mobile` cũ để so sánh và chuyển dần.

- **Phong cách:** dark-only cosmic glass — nền đêm xanh, aurora tím, vàng champagne, serif Cormorant + Be Vietnam Pro.
- **Điều hướng:** 4 tab `Trang chủ · Quét · Lịch sử · Hồ sơ`, bốn ô đều nhau trong cùng một thanh pill.
- **Trang chủ:** dashboard với hero bàn tay, credits, quẻ gần đây; bottom sheet chọn trường phái → mục bói → tay.
- **Phòng quét:** camera (đèn pin, đổi camera, thư viện ảnh), xem trước, consent AI, loading/polling và xử lý hoàn credit.
- **Kết quả:** ảnh hero có bật/tắt lớp vẽ AI, 4 tab nội dung, action bar dính đáy (chia sẻ, bói thêm, xoá).
- **Hồ sơ:** hub credits, mã giới thiệu, nhập mã, hướng dẫn xoá dữ liệu. Ví và referral là màn con.
- **Không có:** đăng ký, đăng nhập, quên mật khẩu/OAuth và luồng guest. App dùng phiên ẩn danh theo thiết bị như bản mobile hiện tại.

## Chạy local

Yêu cầu: Node 22+, pnpm 9+, Docker, backend PalmSight.

```bash
# ở thư mục gốc repo
pnpm install
docker compose up -d mongodb mailpit
pnpm --filter backend dev

# mobile-2 (Expo, port 8082)
pnpm start:mobile2

# hoặc bản web
pnpm start:mobile2:web
```

Nếu chạy web, backend đã cho phép CORS ở `localhost:8082` (và `5173`). Nếu frontend web cũ đang chiếm `5173`, dùng `8082` cho mobile-2.

### API URL

`mobile-2/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_WEB_URL=http://localhost:5173
```

- Web và iOS simulator dùng thẳng `localhost`.
- **Android emulator: phải mở hầm `adb reverse`, không dùng `10.0.2.2`.**

  ```bash
  ~/Android/Sdk/platform-tools/adb reverse tcp:4000 tcp:4000
  ~/Android/Sdk/platform-tools/adb reverse tcp:8082 tcp:8082
  ```

  `src/lib/api.ts` giữ nguyên `localhost`, không còn tự đổi sang `10.0.2.2` như trước. Lý do: trên
  máy ảo đang dùng, OkHttp của app không nối được `10.0.2.2` dù TCP thô tới được — mọi request chết
  ngay với `NETWORK_ERROR`, và Expo Go cũng tải bundle thất bại qua ngả đó. `adb reverse` đưa
  `localhost` của thiết bị về đúng máy dev, miễn nhiễm với việc đổi IP LAN.
  Hầm mất khi khởi động lại emulator hoặc `adb kill-server` — chạy lại hai lệnh trên.
- Máy thật: đổi `EXPO_PUBLIC_API_URL` sang IP LAN của máy dev (xem `hostname -I`) hoặc URL ngrok.
- Muốn trỏ Render: đổi `EXPO_PUBLIC_API_URL` thành `https://<service>.onrender.com/api/v1`.

### Mở app trong Expo Go

Sau khi Metro chạy ở 8082, nạp project bằng chính `localhost` (nhờ hầm ở trên):

```bash
~/Android/Sdk/platform-tools/adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8082'
```

Nếu app hiện "Chưa kết nối được", phân biệt hai nguyên nhân khác nhau: message đó giờ chỉ hiện khi
**thật sự** không gọi được máy chủ; lỗi native module hay lỗi code app sẽ báo "Không mở được phiên
trên thiết bị này" kèm `console.warn` chi tiết trong Metro/logcat.

### Dùng như người dùng thật trên máy ảo

Là cách kiểm tra trọn vòng *bói + xem quảng cáo* mà chưa cần dev build.

```bash
~/Android/Sdk/emulator/emulator -avd Medium_Phone_API_37.0 -no-snapshot-save &   # ~1 phút
adb wait-for-device && adb shell input keyevent 82                                # bỏ màn khoá
adb reverse tcp:4000 tcp:4000 && adb reverse tcp:8084 tcp:8084
# Metro PHẢI gọi trực tiếp, không qua `pnpm exec`:
node ../node_modules/.bin/expo start --port 8084 -c
adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8084' host.exp.exponent
```

Hai thứ đã đốt nhiều thời gian khi debug ở đây, ghi lại để khỏi lặp:

- `pnpm exec expo start` làm lệch cách phân giải module, Expo Go nhận bundle với registry hỏng và
  báo `Cannot find native module 'ExpoCrypto'` dù Expo Go 58 có sẵn module đó. Cùng project, cùng
  thư mục, chỉ khác cách gọi. Gọi thẳng binary như trên thì chạy đúng.
- Cờ `EXPO_PUBLIC_*` được inline lúc Metro start, **không** đọc lại lúc app reload. Sửa `.env` xong
  phải khởi động lại Metro.

**Bói**: camera ảo của AVD trả khung hình đen nên quẻ chụp từ camera ảo luôn bị AI từ chối. Đường
đúng là nạp ảnh bàn tay thật vào thư viện máy ảo rồi chọn *Chọn ảnh khác / Tải ảnh*:

```bash
adb push /tmp/palm-real.jpg /sdcard/DCIM/palm-real.jpg
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/DCIM/palm-real.jpg
```

Android Photo Picker chỉ hiện ảnh sau khi MediaStore index xong (bấm *Chọn ảnh khác* hai lần nếu lần
đầu báo "No photos yet"). Chọn đúng tay: ảnh tay phải mà đặt *Tay trái* thì AI trả `REJECTED` với
lý do rõ ràng — đó là nội dung, không phải lỗi kết nối.

Mọi chỗ upload file đều phải append một **Blob thật** (`new File(uri)` của `expo-file-system`), không
phải object `{uri, name, type}`: RN 0.88 từ chối object với `Unsupported FormDataPart implementation`
ngay trước khi gửi, và app dịch mọi lỗi fetch thành "Không thể kết nối đến máy chủ" nên bug mã hoá
request trông hệt như mất mạng. `ApiError` giờ giữ lỗi gốc ở `cause` — đọc nó trước khi đổ cho đường truyền.

## Cấu trúc chính

```text
mobile-2/
├─ src/app/                 # expo-router
│  ├─ (tabs)/               # Trang chủ, Quét, Lịch sử, Hồ sơ
│  ├─ reading/[id].tsx      # kết quả + 4 tab
│  ├─ camera.tsx            # camera full-screen
│  ├─ wallet.tsx
│  ├─ referral.tsx
│  ├─ enter-referral.tsx
│  └─ onboarding.tsx        # 2 slide
├─ src/components/          # CosmicBackground, CosmicHand, tab bar, sheet, UI kit
├─ src/state/               # anonymous session, capture, reading draft, onboarding
├─ src/lib/                 # API client + tiện ích dùng lại từ mobile
└─ assets/brand/            # SVG nguồn cho icon/splash mới
```

## Quảng cáo thưởng (rewarded ads)

Mặc định **tắt**. Khi tắt, lời đề nghị "xem quảng cáo nhận credit" ẩn khỏi `wallet.tsx` và màn quét,
và app không import thử native module ads nào — nên Expo Go và bản web giữ nguyên hành vi.

Luồng và quy tắc chống gian lận ở [docs/business-rules.md](../docs/business-rules.md#quảng-cáo-thưởng-rewarded-ads);
API ở [docs/api-contract.md](../docs/api-contract.md#get-adsrewardedverify).

### Bật quảng cáo

1. **AdMob**: tạo app + một *Rewarded* unit. Bật Server-side verification cho unit đó và đặt callback:

   ```text
   https://<api-host>/api/v1/ads/rewarded/verify?user_id={user_id}&reward_amount={reward_amount}&reward_item={reward_item}&custom_data={custom_data}&transaction_id={transaction_id}&ad_network={ad_network}&signature={signature}&key_id={key_id}
   ```

   `reward_item` phải là `palmsight-credit` và `reward_amount` ≥ 1 — backend từ chối mọi giá trị khác.
2. **Cài SDK** (không chạy trong Expo Go, cần dev build / `expo prebuild`):

   ```bash
   pnpm --filter mobile-2 add react-native-google-mobile-ads
   npx expo prebuild -p android -p ios
   ```

   Thêm plugin `react-native-google-mobile-ads` với `ads_ios_app_id` vào `app.json`, và tạo
   `mobile-2/google-mobile-ads.gradle` theo tài liệu SDK.
3. **Đăng ký player** ở `src/app/_layout.tsx` (app đã có chỗ chờ: `setRewardedAdPlayer`). Mẫu:

   ```tsx
   import { RewardedAd } from 'react-native-google-mobile-ads';
   import { setRewardedAdPlayer } from '../lib/ads';

   setRewardedAdPlayer(async ({ nonce, rewardItem, amount }) => {
     const ad = await RewardedAd.createForId(process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID!, undefined, {
       userId: nonce,
       customData: rewardItem,
     });
     await ad.load();
     const outcome = new Promise<'earned' | 'skipped'>((resolve) => {
       ad.onUserEarnedReward(() => resolve('earned'));
       ad.onClosed(() => resolve('skipped'));
     });
     await ad.show();
     return outcome;
   });
   ```

   `createForId` nhận `serverSideVerificationOptions` ở vị trí tham số nào **thay đổi theo phiên bản
   SDK** — kiểm lại trang tài liệu của bản bạn cài trước khi chạy. Code này chưa được chạy với SDK
   thật, vì nó cần App ID của tài khoản AdMob.
4. **Env**: `EXPO_PUBLIC_ADS_ENABLED=true`, `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID=<unit id>`, và
   `REWARDED_ADS_ENABLED=true` ở backend.

### Xem quảng cáo mà chưa có dev build

SDK ads là native module nên Expo Go không phát được video. Phần còn lại của luồng — xin nonce, trần
24 giờ, cộng credit, ledger, số dư — thì chạy được, và đó mới là phần dễ hỏng. Bật hai cờ là đi trọn
vòng *xem → +1 credit* ngay trên máy ảo:

```text
mobile-2/.env    EXPO_PUBLIC_ADS_ENABLED=true
                 EXPO_PUBLIC_ADS_MOCK=true
backend/.env     REWARDED_ADS_ENABLED=true
                 REWARDED_ADS_DEV_GRANT=true
```

`SimulatedAdHost` thay video bằng một màn đếm 12 giây rồi gọi `POST /ads/rewarded/dev-grant` — endpoint
mô phỏng callback của Google, bỏ qua đúng bước xác minh chữ ký và đi qua cùng `settle()` mà SSV dùng.
Nó chỉ đăng ký khi `__DEV__`, còn backend tự tắt hẳn khi `NODE_ENV=production`, nên không có đường nào
ship quảng cáo giả tới user thật.

Cờ dev-grant tồn tại vì hai giới hạn thật, đừng quên:

- **ad unit thử của Google không phát SSV**, nên kể cả khi có dev build thì callback vẫn không về.
- **Google không gọi được `localhost`**; muốn thử chữ ký thật phải có backend HTTPS công khai (hoặc
  hầm) và unit đã được duyệt.

Tức là màn mô phỏng chứng minh *kinh tế credit* chạy đúng, không chứng minh *chữ ký* của Google khớp.

### Việc bắt buộc trước khi phát hành

Thiếu một trong các bước này là rủi ro bị từ chối app hoặc khoá tài khoản AdMob, không chỉ mất doanh thu:

- [ ] Google Play Console: khai báo **Ads disclosure**, cập nhật **Data Safety** (nhà cung cấp quảng
  cáo, định danh thiết bị, cá nhân hoá quảng cáo), và khai **không hướng tới trẻ em** ở Target audience.
- [ ] Apple: xin quyền **App Tracking Transparency** (`NSUserTrackingUsageDescription` qua plugin) nếu
  muốn ads cá nhân hoá; không xin thì chỉ nhận ads không cá nhân hoá, eCPM thấp hơn hẳn.
- [ ] Trang **Privacy Policy** công khai, nói rõ dữ liệu nào gửi cho AdMob/Google.
- [ ] `app-ads.txt` trên domain web của backend — không có là AdMob trả "no ads".
- [ ] Traffic EU/UK: bật **UMP/CMP** để có đồng ý theo TCF 2.0.
- [ ] Đối chiếu callback SSV **đầu tiên từ traffic thật** ở staging: bộ test hiện tại ký và tự kiểm
  bằng khoá giả, nên nó chứng minh verifier nhất quán và không âm thầm từ chối, chứ chưa chứng minh
  khớp tuyệt đối với cách Google dựng chuỗi ký.

### Kinh tế, để đừng lầm đây là máy in tiền

eCPM rewarded ở traffic Việt Nam thường chỉ cỡ $2–8/1000 lượt (≈ 0,2–0,8 cent mỗi lượt xem), trong
khi một lần bói bằng Gemini/Groq tốn cỡ $0,005–0,01. Một lượt xem vì thế **xấp xỉ hoà vốn** với một
credit — đây là công cụ giữ chân và tăng số lần bói, không phải nguồn lợi nhuận. Con số thật phải đo
trên traffic của chính app trước khi tăng `REWARDED_AD_DAILY_CAP`.

## Kiểm tra

```bash
pnpm --filter mobile-2 typecheck
pnpm --filter mobile-2 lint
```

Ghi chú:

- Camera capture thật cần chạy trên thiết bị/emulator; bản web chỉ kiểm tra được màn cấp quyền và chọn ảnh.
- Chia sẻ trên web fallback sang clipboard nếu trình duyệt không hỗ trợ Web Share.
- Luồng gọi AI thật phụ thuộc `GEMINI_API_KEY` / `GROQ_API_KEY` của backend.
- App icon và splash mới nằm ở `assets/images/`, nguồn SVG ở `assets/brand/`.
