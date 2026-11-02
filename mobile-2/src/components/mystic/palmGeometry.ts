// Hình bàn tay + 4 đường chỉ tay lấy nguyên từ frontend/src/components/mystic/MysticPalmOracle.tsx
// để mobile và web cùng một "ấn chứng" thị giác.
export const PALM_VIEWBOX = { width: 200, height: 260 } as const;

export const PALM_OUTLINE_PATH = `M 52 188
  C 42 172 24 145 16 128
  C 11 117 16 106 27 110
  C 39 115 55 136 64 145
  C 63 122 59 66 61 48
  C 62 38 74 38 75 48
  C 77 65 79 108 81 116
  C 82 96 83 34 86 19
  C 88 8 100 8 102 19
  C 104 38 104 98 105 116
  C 108 96 113 47 117 34
  C 120 25 132 26 133 36
  C 135 59 133 110 133 127
  C 137 114 145 81 151 73
  C 157 66 168 71 165 82
  C 160 105 152 150 151 178
  C 149 210 139 242 130 250
  L 66 250
  C 57 242 54 214 52 188 Z`;

export interface PalmLineGeometry {
  name: 'heart' | 'head' | 'life' | 'fate';
  d: string;
  color: string;
  width: number;
  dashed?: boolean;
}

export const PALM_LINES: PalmLineGeometry[] = [
  { name: 'heart', d: 'M 148 148 C 126 146 98 136 74 124', color: '#fb7185', width: 2.2 },
  { name: 'head', d: 'M 66 146 C 92 148 118 160 138 176', color: '#c084fc', width: 2.2 },
  { name: 'life', d: 'M 65 140 C 86 158 92 192 84 232', color: '#f5d77f', width: 2.4 },
  { name: 'fate', d: 'M 103 236 C 102 198 101 164 100 128', color: '#34d399', width: 1.8, dashed: true },
];

export const PALM_DOTS: [number, number][] = [
  [71, 122],
  [96, 119],
  [121, 123],
  [143, 134],
];

export const PALM_EYE_PATH = 'M 84 166 Q 104 152 124 166 Q 104 180 84 166 Z';
export const PALM_CRESCENT_PATH = 'M 134 202 A 7 7 0 1 1 127 212 A 5.5 5.5 0 1 0 134 202 Z';
