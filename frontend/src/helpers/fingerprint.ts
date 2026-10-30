/**
 * Client Device Fingerprint Generator
 * Generates a consistent 64-character SHA-256 hex string based on
 * canvas rendering, navigator metadata, screen metrics, and timezone.
 */

// Pure TypeScript SHA-256 fallback in case crypto.subtle is unavailable
function sha256Fallback(ascii: string): string {
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = [...hash];

    for (j = 0; j < 64; j++) {
      const w15 = w[j - 15];
      const w2 = w[j - 2];
      const s0 =
        j < 16
          ? w[j]
          : (w[j] =
              ((((w15 >>> 7) | (w15 << 25)) ^
                ((w15 >>> 18) | (w15 << 14)) ^
                (w15 >>> 3)) +
                (w[j - 7] | 0) +
                (((w2 >>> 17) | (w2 << 15)) ^
                  ((w2 >>> 19) | (w2 << 13)) ^
                  (w2 >>> 10)) +
                (w[j - 16] | 0)) |
              0);

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s1 =
        ((hash[4] >>> 6) | (hash[4] << 26)) ^
        ((hash[4] >>> 11) | (hash[4] << 21)) ^
        ((hash[4] >>> 25) | (hash[4] << 7));
      const s0Maj =
        ((hash[0] >>> 2) | (hash[0] << 30)) ^
        ((hash[0] >>> 13) | (hash[0] << 19)) ^
        ((hash[0] >>> 22) | (hash[0] << 10));

      const temp1 =
        (hash[7] + s1 + ch + k[j] + s0) | 0;
      const temp2 = (s0Maj + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Generates an in-memory canvas 2D hash
 */
function getCanvasFingerprint(): string {
  try {
    if (typeof document === 'undefined') return 'no-document';
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas-2d';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', 'Cormorant Garamond', sans-serif";
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(0, 0, 240, 60);

    ctx.fillStyle = '#d4af37';
    ctx.fillText('PalmSight:Mystic✦Oracle', 4, 10);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
    ctx.fillText('✨🔮🌙 Palm Reading AI', 6, 30);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

/**
 * Collects hardware, display, and browser metadata
 */
function getSystemSignals(): string {
  if (typeof window === 'undefined') {
    return 'server-environment';
  }

  const nav = window.navigator;
  const scr = window.screen;

  const signals = {
    ua: nav?.userAgent || '',
    lang: nav?.language || '',
    langs: nav?.languages ? nav.languages.join(',') : '',
    hwConcurrency: nav?.hardwareConcurrency || 0,
    deviceMemory: (nav as any)?.deviceMemory || 0,
    platform: nav?.platform || '',
    screenWidth: scr?.width || 0,
    screenHeight: scr?.height || 0,
    colorDepth: scr?.colorDepth || 0,
    pixelDepth: scr?.pixelDepth || 0,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.()?.timeZone || '',
    timezoneOffset: new Date().getTimezoneOffset(),
    canvas: getCanvasFingerprint(),
  };

  return JSON.stringify(signals);
}

/**
 * Returns a consistent 64-character SHA-256 hex string identifying this browser.
 */
export async function getFingerprint(): Promise<string> {
  const signalString = getSystemSignals();

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const buffer = new TextEncoder().encode(signalString);
      const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digestBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback if subtle digest throws
      return sha256Fallback(signalString);
    }
  }

  return sha256Fallback(signalString);
}

export default getFingerprint;
