# PalmSight — mobile-2 (Cosmic Glass)

Bản thiết kế lại giao diện mobile của PalmSight, chạy song song với app `mobile` cũ để so sánh và chuyển dần.

- **Phong cách:** dark-only cosmic glass — nền đêm xanh, aurora tím, vàng champagne, serif Cormorant + Be Vietnam Pro.
- **Điều hướng:** 4 tab `Trang chủ · Quét · Lịch sử · Hồ sơ`; nút Quét nổi ở giữa thanh tab.
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

- Web/iOS simulator dùng `localhost`.
- Android emulator tự đổi `localhost` → `10.0.2.2` trong `src/lib/api.ts`.
- Máy thật dùng IP LAN của máy dev hoặc URL Render/ngrok trong `.env`.
- Muốn trỏ Render: đổi `EXPO_PUBLIC_API_URL` thành `https://<service>.onrender.com/api/v1`.

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
