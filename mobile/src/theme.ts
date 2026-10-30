import { Platform, TextStyle } from 'react-native';

// Bảng token lấy nguyên từ web (frontend/tailwind.config.cjs + globals.css) để mobile và PWA
// dùng chung một nhận diện: cosmic night #0b0716, sacred parchment #f5e6c8, imperial gold #d4af37.
export const colors = {
  canvas: '#0b0716',
  obsidian: '#07040e',
  surfaceSoft: '#140d26',
  card: '#1b1233',
  container: '#241842',
  elevated: '#2c1d4f',
  surfaceDark: '#1f1438',

  ink: '#f5e6c8',
  goldLight: '#f7e7b4',
  goldMid: '#f5d77f',
  body: '#d8cbe8',
  mute: '#9e8cb8',
  // stone/ash sáng hơn bản web để đạt ~4.8:1 trên canvas mobile (AA cho chữ nhỏ)
  stone: '#8d7aab',
  ash: '#8a78ad',

  gold: '#d4af37',
  goldStrong: '#c5a059',
  goldDim: '#9a7b2c',
  goldDeep: '#aa7c11',
  onGold: '#0b0716',

  violet: '#a855f7',
  violetSoft: '#c084fc',
  success: '#34d399',
  warning: '#f59e0b',
  danger: '#fb7185',
  dangerDeep: '#e11d48',
  dangerBg: '#4c0519',

  hairline: 'rgba(212,175,55,0.25)',
  hairlineSoft: 'rgba(212,175,55,0.14)',
  hairlineStrong: 'rgba(212,175,55,0.45)',
  inputBorder: 'rgba(212,175,55,0.3)',
  scrim: 'rgba(7,4,14,0.84)',
  overlay: 'rgba(11,7,22,0.6)',
  cardGlass: 'rgba(31,20,56,0.85)',
  cardGlassDeep: 'rgba(19,12,36,0.93)',
  goldWash: 'rgba(212,175,55,0.08)',
  goldWashStrong: 'rgba(212,175,55,0.16)',
  ivoryWash: 'rgba(247,231,180,0.08)',
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const spacing = {
  xxs: 1,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 48,
} as const;

// Font family names do @expo-google-fonts nạp trong _layout.tsx. Không đặt fontWeight khi dùng
// font custom: mỗi weight là một family riêng (Be Vietnam Pro 500/600/700...).
export const font = {
  display: 'CormorantGaramond_600SemiBold',
  displayStrong: 'CormorantGaramond_700Bold',
  displayItalic: 'CormorantGaramond_600SemiBold_Italic',
  body: 'BeVietnamPro_400Regular',
  bodyMedium: 'BeVietnamPro_500Medium',
  bodyStrong: 'BeVietnamPro_600SemiBold',
  bodyBold: 'BeVietnamPro_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const text: Record<string, TextStyle> = {
  displayXl: { fontFamily: font.displayStrong, fontSize: 36, lineHeight: 40, letterSpacing: -0.4 },
  displayLg: { fontFamily: font.displayStrong, fontSize: 30, lineHeight: 34, letterSpacing: -0.2 },
  headingLg: { fontFamily: font.display, fontSize: 27, lineHeight: 32 },
  headingMd: { fontFamily: font.display, fontSize: 22, lineHeight: 28 },
  displaySm: { fontFamily: font.display, fontSize: 24, lineHeight: 28 },
  quote: { fontFamily: font.displayItalic, fontSize: 22, lineHeight: 30 },
  headingSm: { fontFamily: font.bodyStrong, fontSize: 15, lineHeight: 21, letterSpacing: 0.2 },
  bodyMd: { fontFamily: font.body, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: font.bodyStrong, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: font.bodyStrong, fontSize: 15, lineHeight: 20, letterSpacing: 0.3 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 19 },
  captionStrong: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 17 },
  eyebrow: { fontFamily: font.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 2.2 },
  code: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0.7 },
  monoStrong: { fontFamily: font.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.7 },
};

export const shadow = {
  card: {
    borderWidth: 1,
    borderColor: colors.hairline,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#04020a',
          shadowOpacity: 0.75,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
        }
      : { elevation: 6 }),
  },
  glow: {
    borderWidth: 1,
    borderColor: colors.goldStrong,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.gold,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 4 }),
  },
  gold: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.gold,
          shadowOpacity: 0.38,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 5 }),
  },
} as const;

// Gradient dùng lại từ web để nút/vòng sáng không lệch tông.
export const gradients = {
  gold: ['#f3dc99', '#d4af37', '#b38728'] as const,
  goldText: ['#fff3d1', '#f5d77f', '#d4af37', '#aa7c11'] as const,
  card: ['rgba(31,20,56,0.94)', 'rgba(19,12,36,0.97)'] as const,
  cardSoft: ['rgba(36,24,66,0.9)', 'rgba(20,13,38,0.95)'] as const,
  violet: ['rgba(168,85,247,0.2)', 'rgba(11,7,22,0)'] as const,
  haze: ['rgba(212,175,55,0.12)', 'rgba(11,7,22,0)'] as const,
} as const;
