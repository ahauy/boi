---
version: alpha
name: OpenCode-design-analysis
description: |
  PalmSight Terminal Minimalist Design System extracted from Stitch project PalmSight Terminal Landing Page (15464591816682045618).
  A terminal-native system rendered entirely in Berkeley Mono / JetBrains Mono. Warm cream canvas (`#fdfcfc`), nearly-black ink (`#201d1d`), 4px-radius rectangles for interactive elements, hairline borders (`rgba(15,0,0,0.12)`), and bracketed `[+]`/`[-]`/`[x]` ASCII markers.

colors:
  primary: "#201d1d"
  on-primary: "#fdfcfc"
  ink: "#201d1d"
  ink-deep: "#0f0000"
  charcoal: "#302c2c"
  body: "#424245"
  mute: "#646262"
  stone: "#6e6e73"
  ash: "#9a9898"
  canvas: "#fdfcfc"
  surface-soft: "#f8f7f7"
  surface-card: "#f1eeee"
  surface-dark: "#201d1d"
  surface-dark-elevated: "#302c2c"
  hairline: "rgba(15,0,0,0.12)"
  hairline-strong: "#646262"
  on-dark: "#fdfcfc"
  on-dark-mute: "#9a9898"
  accent: "#007aff"
  accent-hover: "#0056b3"
  accent-active: "#004085"
  warning: "#ff9f0a"
  warning-hover: "#cc7f08"
  warning-active: "#995f06"
  danger: "#ff3b30"
  danger-hover: "#d70015"
  danger-active: "#a50011"
  success: "#30d158"

typography:
  display-xl:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 38px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  heading-lg:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  heading-md:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  heading-sm:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  body-md:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-strong:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button-md:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 16px
    fontWeight: 500
    lineHeight: 2
    letterSpacing: 0
  caption-md:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 2
    letterSpacing: 0
  code-sm:
    fontFamily: JetBrains Mono, Berkeley Mono, monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  none: 0px
  sm: 4px
  DEFAULT: 4px
  full: 9999px

spacing:
  xxs: 1px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 4px 20px
    height: 36px
  button-primary-active:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline-strong}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 4px 20px
    height: 36px
  text-input:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 8px 12px
    height: 40px
  install-snippet:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
  hero-tui-mockup:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 64px 32px
---

# 🎨 PalmSight Design System — Terminal Minimalist

> **Source:** Stitch MCP Project `PalmSight Terminal Landing Page` (`15464591816682045618`)  
> **Aesthetic:** Terminal-native, editorial-technical, flat, high-contrast monospace.

## 1. Palette & Surface Hierarchy

| Token | Giá trị | Vai trò |
| :--- | :--- | :--- |
| `canvas` | `#fdfcfc` | Nền kem ấm toàn bộ ứng dụng (body ground) |
| `ink` | `#201d1d` | Màu chữ chính, nút chính (primary CTA), tiêu đề |
| `ink-deep` | `#0f0000` | Trạng thái active/pressed của nút primary |
| `charcoal` | `#302c2c` | Trạng thái hover nút primary, nền prompt TUI |
| `body` | `#424245` | Chữ đoạn văn, mô tả nội dung |
| `mute` | `#646262` | Metadata, nhãn phụ, hairline divider đậm |
| `stone` | `#6e6e73` | Phân cách breadcrumbs, chú thích nhỏ nhất |
| `ash` | `#9a9898` | Placeholder input, chữ disable, ghi chú mờ |
| `surface-soft` | `#f8f7f7` | Nền ô input text mặc định, hàng xen kẽ |
| `surface-card` | `#f1eeee` | Nền thẻ (card), badge, snippet, nút disable |
| `surface-dark` | `#201d1d` | Nền TUI terminal preview (chỉ dùng cho hero/code block) |
| `surface-dark-elevated` | `#302c2c` | Hàng prompt trong TUI |
| `hairline` | `rgba(15, 0, 0, 0.12)` | Đường viền 1px siêu mảnh cho khung và thẻ |
| `hairline-strong` | `#646262` | Đường kẻ tab, viền nút secondary |
| `accent` | `#007aff` | Apple Blue — dùng cho TUI status/command highlight |
| `warning` | `#ff9f0a` | Cảnh báo chiêm đoán |
| `danger` | `#ff3b30` | Lỗi / hành động huỷ |
| `success` | `#30d158` | Thành công |

## 2. Typography

- **Font Family:** `JetBrains Mono, IBM Plex Mono, Berkeley Mono, monospace`.
- Không sử dụng font sans-serif hoặc serif ở bất kỳ vị trí nào. Toàn bộ giao diện là monospace.
- `letter-spacing: 0` trên toàn bộ văn bản.

## 3. Shapes & Spacing

- **Radius:** `4px` (`rounded-sm` / `rounded`) cho mọi phần tử tương tác (Button, Input, Badge). `0px` cho các container/section lớn. `9999px` chỉ cho avatar.
- **Section rhythm:** `96px` khoảng cách giữa các phần lớn trên trang.
- **Shadows:** Hoàn toàn **không dùng drop shadow**. Độ sâu tạo bằng tương phản màu nền và viền hairline.
