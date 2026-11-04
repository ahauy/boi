import { Platform, TextStyle } from 'react-native';

// PalmSight · mobile-2 — "cosmic glass": đêm xanh vũ trụ, thuỷ tinh mờ, vàng champagne.
// Bảng màu tách khỏi bản mobile cũ để hai app có nhận diện riêng khi chạy song song.
export const colors = {
  canvas: '#040611',
  obsidian: '#02030a',
  surfaceSoft: '#0a1024',
  card: '#0d1530',
  container: '#131d3d',
  elevated: '#1a264b',
  surfaceDark: '#0b1228',

  ink: '#f4efe4',
  goldLight: '#f7e7b4',
  goldMid: '#ecd28e',
  body: '#cdd3e8',
  mute: '#9aa5c4',
  stone: '#8792b2',
  ash: '#7b87a8',

  gold: '#e7c777',
  goldStrong: '#d9b968',
  goldDim: '#9f8440',
  goldDeep: '#7c6429',
  onGold: '#060813',

  violet: '#7c6cf6',
  violetSoft: '#b8adff',
  auroraViolet: 'rgba(124,108,246,0.34)',
  auroraTeal: 'rgba(56,189,178,0.18)',
  auroraRose: 'rgba(244,114,182,0.14)',
  success: '#6ee7b7',
  warning: '#fbbf24',
  danger: '#fb7185',
  dangerDeep: '#e11d48',
  dangerBg: '#3b0a1a',

  hairline: 'rgba(231,199,119,0.22)',
  hairlineSoft: 'rgba(255,255,255,0.08)',
  hairlineStrong: 'rgba(231,199,119,0.42)',
  inputBorder: 'rgba(255,255,255,0.14)',
  scrim: 'rgba(4,6,17,0.86)',
  overlay: 'rgba(4,6,17,0.64)',
  cardGlass: 'rgba(15,23,48,0.72)',
  cardGlassDeep: 'rgba(8,13,30,0.9)',
  glassFill: 'rgba(255,255,255,0.055)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassHighlight: 'rgba(255,255,255,0.22)',
  goldWash: 'rgba(231,199,119,0.09)',
  goldWashStrong: 'rgba(231,199,119,0.17)',
  ivoryWash: 'rgba(244,239,228,0.06)',
  tabBar: 'rgba(6,10,24,0.92)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
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
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

// Trần co giãn chữ theo Dynamic Type: đủ rõ cho người tăng cỡ chữ nhưng không phá các hàng/cụm UI.
export const MAX_FONT_SCALE = 1.3;

export const text: Record<string, TextStyle> = {
  displayXl: { fontFamily: font.displayStrong, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  displayLg: { fontFamily: font.displayStrong, fontSize: 33, lineHeight: 38, letterSpacing: -0.3 },
  headingLg: { fontFamily: font.display, fontSize: 28, lineHeight: 34 },
  headingMd: { fontFamily: font.display, fontSize: 23, lineHeight: 29 },
  displaySm: { fontFamily: font.display, fontSize: 24, lineHeight: 29 },
  quote: { fontFamily: font.displayItalic, fontSize: 23, lineHeight: 32 },
  headingSm: { fontFamily: font.bodyStrong, fontSize: 15, lineHeight: 21, letterSpacing: 0.1 },
  bodyMd: { fontFamily: font.body, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: font.bodyStrong, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: font.bodyStrong, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 19 },
  captionStrong: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 17 },
  eyebrow: { fontFamily: font.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 2.4 },
  code: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  monoStrong: { fontFamily: font.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
};

export const shadow = {
  card: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#01020a',
          shadowOpacity: 0.6,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 14 },
        }
      : { elevation: 6 }),
  },
  glow: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.gold,
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 4 }),
  },
  gold: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.gold,
          shadowOpacity: 0.34,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        }
      : { elevation: 5 }),
  },
  violet: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.violet,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        }
      : { elevation: 6 }),
  },
} as const;

export const gradients = {
  gold: ['#f9edc4', '#e7c777', '#b88f3f'] as const,
  goldText: ['#fff7dd', '#ecd28e', '#e7c777', '#9f8440'] as const,
  card: ['rgba(20,30,62,0.82)', 'rgba(8,13,30,0.92)'] as const,
  cardSoft: ['rgba(30,42,82,0.8)', 'rgba(10,16,36,0.94)'] as const,
  glass: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.02)'] as const,
  hero: ['rgba(124,108,246,0.32)', 'rgba(17,24,54,0.88)', 'rgba(5,8,20,0.98)'] as const,
  violet: ['rgba(124,108,246,0.28)', 'rgba(4,6,17,0)'] as const,
  haze: ['rgba(231,199,119,0.14)', 'rgba(4,6,17,0)'] as const,
  aurora: ['rgba(124,108,246,0.22)', 'rgba(56,189,178,0.1)', 'rgba(4,6,17,0)'] as const,
} as const;
