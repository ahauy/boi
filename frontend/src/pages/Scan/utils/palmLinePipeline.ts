import type { PalmLineDto, PalmLineName } from "@palmsight/shared";

export const OUT_SIZE = 512;
export const THRESH = 0.4;
export const MIN_MASK_SIZE = 150;
export const MIN_LINE_LEN = 35;
export const SPUR_LEN = 16;
export const JOIN_COS = 0.7;
export const GAP_PX = 40;
export const GAP_COS = 0.65;
export const OVERLAP_OFFSET = 20;

const PALM_IDX = [0, 1, 2, 5, 9, 13, 17];
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export const PALM_LINE_COLORS: Record<PalmLineName, string> = {
  life: "#00c853",
  head: "#ff9100",
  heart: "#ff1744",
  other: "#9e9e9e",
};

export const PALM_LINE_LABELS: Record<PalmLineName, string> = {
  life: "Sinh đạo",
  head: "Trí đạo",
  heart: "Tâm đạo",
  other: "Đường phụ",
};

export interface Point2D {
  x: number;
  y: number;
}

export interface PalmGeometry {
  thumbSide: "left" | "right";
  wrist: [number, number];
  thumbCmc: [number, number];
  thumbMcp: [number, number];
  indexMcp: [number, number];
  middleMcp: [number, number];
  ringMcp: [number, number];
  pinkyMcp: [number, number];
}

export interface CroppedPalmData {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  region: Uint8Array;
  geom: PalmGeometry;
  isPalmFacing: boolean;
  handedness: "Left" | "Right";
}

export interface AnalyzedPalmLine {
  name: PalmLineName;
  pixels: [number, number][];
  points: [number, number][];
  lengthPx: number;
  lengthRel: number;
  curvature: number;
  branches: number;
}

export interface PalmPipelineResult {
  palmLines: PalmLineDto[];
  analyzedLines: AnalyzedPalmLine[];
  croppedDataUrl: string;
  annotatedDataUrl: string;
  annotatedFile: File | null;
  usedOnnxModel: boolean;
}

export function facingInfo(
  pts: [number, number][],
  label: "Left" | "Right" = "Right"
): { isPalm: boolean; thumbSide: "left" | "right" } {
  const ax = pts[5][0] - pts[0][0];
  const ay = pts[5][1] - pts[0][1];
  const bx = pts[17][0] - pts[0][0];
  const by = pts[17][1] - pts[0][1];
  const cross = ax * by - ay * bx;
  const isPalm =
    (cross > 0 && label === "Right") || (cross < 0 && label === "Left");
  const thumbSide = cross > 0 ? "right" : "left";
  return { isPalm, thumbSide };
}

function cross2D(
  o: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function computeConvexHull(pts: [number, number][]): [number, number][] {
  if (pts.length <= 3) {
    return pts.slice();
  }
  const sorted = pts
    .slice()
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross2D(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      cross2D(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointInConvexPolygon(
  x: number,
  y: number,
  hull: [number, number][]
): boolean {
  if (hull.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(c) > 1e-6) {
      const s = c > 0 ? 1 : -1;
      if (sign === 0) {
        sign = s;
      } else if (sign !== s) {
        return false;
      }
    }
  }
  return true;
}

function erodeSquare(
  mask: Uint8Array,
  w: number,
  h: number,
  radius: number
): Uint8Array {
  const horiz = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (x < radius || x >= w - radius) continue;
      let ok = 1;
      for (let dx = -radius; dx <= radius; dx++) {
        if (mask[row + x + dx] === 0) {
          ok = 0;
          break;
        }
      }
      horiz[row + x] = ok;
    }
  }

  const out = new Uint8Array(w * h);
  for (let y = radius; y < h - radius; y++) {
    const row = y * w;
    for (let x = radius; x < w - radius; x++) {
      let ok = 1;
      for (let dy = -radius; dy <= radius; dy++) {
        if (horiz[(y + dy) * w + x] === 0) {
          ok = 0;
          break;
        }
      }
      out[row + x] = ok ? 255 : 0;
    }
  }
  return out;
}

export function cropPalmExFromRgba(
  srcRgba: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  pts: [number, number][],
  label: "Left" | "Right" = "Right"
): CroppedPalmData {
  const { isPalm, thumbSide } = facingInfo(pts, label);
  const wrist = pts[0];
  const midMcp = pts[9];

  const vx = midMcp[0] - wrist[0];
  const vy = midMcp[1] - wrist[1];
  const palmLen = Math.hypot(vx, vy);
  const upX = vx / (palmLen + 1e-6);
  const upY = vy / (palmLen + 1e-6);
  const rightX = -upY;
  const rightY = upX;

  const centerX = (wrist[0] + midMcp[0]) * 0.5;
  const centerY = (wrist[1] + midMcp[1]) * 0.5;
  const side = Math.max(palmLen * 1.7, 16);

  const rgba = new Uint8ClampedArray(OUT_SIZE * OUT_SIZE * 4);

  for (let cy = 0; cy < OUT_SIZE; cy++) {
    const ny = 0.5 - cy / OUT_SIZE;
    for (let cx = 0; cx < OUT_SIZE; cx++) {
      const nx = cx / OUT_SIZE - 0.5;
      const sx = centerX + nx * side * rightX + ny * side * upX;
      const sy = centerY + nx * side * rightY + ny * side * upY;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const dstIdx = (cy * OUT_SIZE + cx) * 4;

      if (x0 < 0 || y0 < 0 || x0 >= srcW - 1 || y0 >= srcH - 1) {
        const cxClamp = Math.min(Math.max(Math.round(sx), 0), srcW - 1);
        const cyClamp = Math.min(Math.max(Math.round(sy), 0), srcH - 1);
        const sIdx = (cyClamp * srcW + cxClamp) * 4;
        rgba[dstIdx] = srcRgba[sIdx];
        rgba[dstIdx + 1] = srcRgba[sIdx + 1];
        rgba[dstIdx + 2] = srcRgba[sIdx + 2];
        rgba[dstIdx + 3] = 255;
        continue;
      }

      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + srcW * 4;
      const i11 = i01 + 4;

      for (let c = 0; c < 3; c++) {
        const v0 = srcRgba[i00 + c] * (1 - fx) + srcRgba[i10 + c] * fx;
        const v1 = srcRgba[i01 + c] * (1 - fx) + srcRgba[i11 + c] * fx;
        rgba[dstIdx + c] = Math.round(v0 * (1 - fy) + v1 * fy);
      }
      rgba[dstIdx + 3] = 255;
    }
  }

  const projectPoint = (p: [number, number]): [number, number] => {
    const dx = p[0] - centerX;
    const dy = p[1] - centerY;
    const cx = ((dx * rightX + dy * rightY) / side + 0.5) * OUT_SIZE;
    const cy = (0.5 - (dx * upX + dy * upY) / side) * OUT_SIZE;
    return [cx, cy];
  };

  const cropPts = PALM_IDX.map((idx) => projectPoint(pts[idx]));
  const pinkyC = cropPts[6];
  const indexC = cropPts[3];
  const wristC = cropPts[0];
  const dirX = pinkyC[0] > indexC[0] ? 1.0 : -1.0;

  const hullInput: [number, number][] = [
    ...cropPts,
    [pinkyC[0] + dirX * 0.1 * OUT_SIZE, pinkyC[1]],
    [wristC[0] + dirX * 0.12 * OUT_SIZE, wristC[1]],
  ];
  const hull = computeConvexHull(hullInput);

  const rawMask = new Uint8Array(OUT_SIZE * OUT_SIZE);
  for (let y = 0; y < OUT_SIZE; y++) {
    const row = y * OUT_SIZE;
    for (let x = 0; x < OUT_SIZE; x++) {
      if (pointInConvexPolygon(x, y, hull)) {
        rawMask[row + x] = 255;
      }
    }
  }

  const region = erodeSquare(rawMask, OUT_SIZE, OUT_SIZE, 4);

  const geom: PalmGeometry = {
    thumbSide,
    wrist: cropPts[0],
    thumbCmc: cropPts[1],
    thumbMcp: cropPts[2],
    indexMcp: cropPts[3],
    middleMcp: cropPts[4],
    ringMcp: cropPts[5],
    pinkyMcp: cropPts[6],
  };

  return {
    width: OUT_SIZE,
    height: OUT_SIZE,
    rgba,
    region,
    geom,
    isPalmFacing: isPalm,
    handedness: label,
  };
}

export function cleanSmallComponents(
  mask: Uint8Array,
  w: number,
  h: number,
  minSize: number
): Uint8Array {
  const out = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const component: number[] = [];

  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 0 || visited[i]) continue;
    component.length = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    while (head < tail) {
      const curr = queue[head++];
      component.push(curr);
      const cy = Math.floor(curr / w);
      const cx = curr - cy * w;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= w) continue;
          const nIdx = ny * w + nx;
          if (mask[nIdx] > 0 && !visited[nIdx]) {
            visited[nIdx] = 1;
            queue[tail++] = nIdx;
          }
        }
      }
    }

    if (component.length >= minSize) {
      for (const idx of component) {
        out[idx] = 255;
      }
    }
  }

  return out;
}

export function skeletonizeMask(
  mask: Uint8Array,
  w: number,
  h: number
): Uint8Array {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    bin[i] = mask[i] > 0 ? 1 : 0;
  }

  const toClear: number[] = [];
  let changed = true;
  let iter = 0;

  while (changed && iter < 100) {
    changed = false;
    iter++;

    for (let step = 0; step < 2; step++) {
      toClear.length = 0;

      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
          const idx = row + x;
          if (bin[idx] === 0) continue;

          const p2 = bin[idx - w];
          const p3 = bin[idx - w + 1];
          const p4 = bin[idx + 1];
          const p5 = bin[idx + w + 1];
          const p6 = bin[idx + w];
          const p7 = bin[idx + w - 1];
          const p8 = bin[idx - 1];
          const p9 = bin[idx - w - 1];

          const bp = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (bp < 2 || bp > 6) continue;

          const ap =
            (p2 === 0 && p3 === 1 ? 1 : 0) +
            (p3 === 0 && p4 === 1 ? 1 : 0) +
            (p4 === 0 && p5 === 1 ? 1 : 0) +
            (p5 === 0 && p6 === 1 ? 1 : 0) +
            (p6 === 0 && p7 === 1 ? 1 : 0) +
            (p7 === 0 && p8 === 1 ? 1 : 0) +
            (p8 === 0 && p9 === 1 ? 1 : 0) +
            (p9 === 0 && p2 === 1 ? 1 : 0);

          if (ap !== 1) continue;

          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }

          toClear.push(idx);
        }
      }

      if (toClear.length > 0) {
        changed = true;
        for (const idx of toClear) {
          bin[idx] = 0;
        }
      }
    }
  }

  const ringCoords: [number, number][] = [
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, -1],
  ];

  let cornerCleared = true;
  while (cornerCleared) {
    cornerCleared = false;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = row + x;
        if (bin[idx] === 0) continue;
        const p2 = bin[idx - w];
        const p4 = bin[idx + 1];
        const p6 = bin[idx + w];
        const p8 = bin[idx - 1];
        if (
          !(
            (p2 && p4 && !p6 && !p8) ||
            (p4 && p6 && !p8 && !p2) ||
            (p6 && p8 && !p2 && !p4) ||
            (p8 && p2 && !p4 && !p6)
          )
        ) {
          continue;
        }

        const active: number[] = [];
        for (let k = 0; k < 8; k++) {
          const [dy, dx] = ringCoords[k];
          if (bin[(y + dy) * w + (x + dx)] > 0) {
            active.push(k);
          }
        }
        if (active.length < 2) continue;

        const visited = new Set<number>([active[0]]);
        const q: number[] = [active[0]];
        while (q.length > 0) {
          const cur = q.pop();
          if (cur === undefined) break;
          const [cy, cx] = ringCoords[cur];
          for (const nxt of active) {
            if (visited.has(nxt)) continue;
            const [ny, nx] = ringCoords[nxt];
            if (Math.abs(cy - ny) <= 1 && Math.abs(cx - nx) <= 1) {
              visited.add(nxt);
              q.push(nxt);
            }
          }
        }

        if (visited.size === active.length) {
          bin[idx] = 0;
          cornerCleared = true;
        }
      }
    }
  }

  return bin;
}

function neighborCount(skel: Uint8Array, w: number, h: number): Uint8Array {
  const counts = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = row + x;
      if (skel[idx] === 0) continue;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (skel[(y + dy) * w + (x + dx)] > 0) c++;
        }
      }
      counts[idx] = c;
    }
  }
  return counts;
}

function dilate3x3(
  mask: Uint8Array,
  w: number,
  h: number,
  iterations = 1
): Uint8Array {
  let curr = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    curr[i] = mask[i] > 0 ? 1 : 0;
  }
  for (let it = 0; it < iterations; it++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(w - 1, x + 1);
        let hit = 0;
        for (let ny = y0; ny <= y1 && !hit; ny++) {
          const row = ny * w;
          for (let nx = x0; nx <= x1; nx++) {
            if (curr[row + nx] > 0) {
              hit = 1;
              break;
            }
          }
        }
        next[y * w + x] = hit;
      }
    }
    curr = next;
  }
  return curr;
}

function label8(
  mask: Uint8Array,
  w: number,
  h: number
): { labels: Int32Array; count: number; components: number[][] } {
  const labels = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  const components: number[][] = [[]];
  let count = 0;

  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 0 || labels[i] !== 0) continue;
    count++;
    const comp: number[] = [];
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    labels[i] = count;

    while (head < tail) {
      const curr = queue[head++];
      comp.push(curr);
      const cy = Math.floor(curr / w);
      const cx = curr - cy * w;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        const row = ny * w;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= w) continue;
          const nIdx = row + nx;
          if (mask[nIdx] > 0 && labels[nIdx] === 0) {
            labels[nIdx] = count;
            queue[tail++] = nIdx;
          }
        }
      }
    }
    components.push(comp);
  }

  return { labels, count, components };
}

function computeSkeletonBranches(
  skel: Uint8Array,
  w: number,
  h: number,
  splitSharpCorners = false
): {
  labels: Int32Array;
  count: number;
  components: number[][];
  zone: Uint8Array;
  junctions: [number, number][];
} {
  const nb = neighborCount(skel, w, h);
  const junction = new Uint8Array(w * h);
  const junctions: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (skel[idx] > 0 && nb[idx] >= 3) {
        junction[idx] = 1;
        junctions.push([y, x]);
      }
    }
  }
  let zone = dilate3x3(junction, w, h, 1);
  let cut = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (skel[i] > 0 && zone[i] === 0) {
      cut[i] = 1;
    }
  }
  let { labels, count, components } = label8(cut, w, h);

  if (splitSharpCorners) {
    let addedCorner = false;
    for (let k = 1; k <= count; k++) {
      const comp = components[k];
      if (comp.length < 60) continue;
      const coords: [number, number][] = comp.map((idx) => [
        Math.floor(idx / w),
        idx % w,
      ]);
      const pts = orderPath(coords);
      const step = 15;
      const margin = 25;
      let bestDot = -0.4;
      let bestPt: [number, number] | null = null;
      for (let i = margin; i < pts.length - margin; i++) {
        const [y0, x0] = pts[i];
        const [y1, x1] = pts[i - step];
        const [y2, x2] = pts[i + step];
        const v1y = y1 - y0;
        const v1x = x1 - x0;
        const v2y = y2 - y0;
        const v2x = x2 - x0;
        const n1 = Math.hypot(v1y, v1x);
        const n2 = Math.hypot(v2y, v2x);
        if (n1 < 1e-6 || n2 < 1e-6) continue;
        const dot = (v1y * v2y + v1x * v2x) / (n1 * n2);
        if (dot > bestDot) {
          bestDot = dot;
          bestPt = [y0, x0];
        }
      }
      if (bestPt) {
        const cIdx = bestPt[0] * w + bestPt[1];
        junction[cIdx] = 1;
        junctions.push(bestPt);
        addedCorner = true;
      }
    }
    if (addedCorner) {
      zone = dilate3x3(junction, w, h, 1);
      cut = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        if (skel[i] > 0 && zone[i] === 0) {
          cut[i] = 1;
        }
      }
      const relabeled = label8(cut, w, h);
      labels = relabeled.labels;
      count = relabeled.count;
      components = relabeled.components;
    }
  }

  return { labels, count, components, zone, junctions };
}

export function pruneSkeleton(
  skelInput: Uint8Array,
  w: number,
  h: number
): Uint8Array {
  let skel = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    skel[i] = skelInput[i] > 0 ? 1 : 0;
  }

  for (let pass = 0; pass < 3; pass++) {
    const nb = neighborCount(skel, w, h);
    const { count, components, zone } = computeSkeletonBranches(skel, w, h);
    const zoneD = dilate3x3(zone, w, h, 1);
    let removed = false;

    for (let k = 1; k <= count; k++) {
      const comp = components[k];
      if (comp.length < SPUR_LEN) {
        let hasEndpoint = false;
        let touchesZoneD = false;
        for (const idx of comp) {
          if (nb[idx] === 1) hasEndpoint = true;
          if (zoneD[idx] > 0) touchesZoneD = true;
        }
        if (hasEndpoint && touchesZoneD) {
          for (const idx of comp) {
            skel[idx] = 0;
          }
          removed = true;
        }
      }
    }

    for (let stubPass = 0; stubPass < 2; stubPass++) {
      const nb2 = neighborCount(skel, w, h);
      const junc2 = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        if (skel[i] > 0 && nb2[i] >= 3) junc2[i] = 1;
      }
      const z2 = dilate3x3(junc2, w, h, 1);
      let stubRemoved = false;
      for (let i = 0; i < w * h; i++) {
        if (skel[i] > 0 && nb2[i] === 1 && z2[i] > 0) {
          skel[i] = 0;
          stubRemoved = true;
        }
      }
      if (stubRemoved) removed = true;
    }

    skel = skeletonizeMask(skel, w, h);
    if (!removed) break;
  }

  const { count: compCount, components: finalComps } = label8(skel, w, h);
  for (let k = 1; k <= compCount; k++) {
    if (finalComps[k].length < MIN_LINE_LEN) {
      for (const idx of finalComps[k]) {
        skel[idx] = 0;
      }
    }
  }

  return skel;
}

function orderPath(coords: [number, number][]): [number, number][] {
  if (coords.length <= 1) return coords;
  const ptsSet = new Set<number>(coords.map(([y, x]) => (y << 16) | x));
  const getNbrs = (y: number, x: number): [number, number][] => {
    const res: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        const nx = x + dx;
        if (ptsSet.has((ny << 16) | nx)) {
          res.push([ny, nx]);
        }
      }
    }
    return res;
  };

  let start = coords[0];
  for (const [y, x] of coords) {
    if (getNbrs(y, x).length <= 1) {
      start = [y, x];
      break;
    }
  }

  const ordered: [number, number][] = [start];
  const seen = new Set<number>([(start[0] << 16) | start[1]]);
  let cur = start;

  while (seen.size < coords.length) {
    const nxt = getNbrs(cur[0], cur[1]).filter(
      ([ny, nx]) => !seen.has((ny << 16) | nx)
    );
    if (nxt.length === 0) break;
    nxt.sort(
      (a, b) =>
        Math.abs(a[0] - cur[0]) +
        Math.abs(a[1] - cur[1]) -
        (Math.abs(b[0] - cur[0]) + Math.abs(b[1] - cur[1]))
    );
    cur = nxt[0];
    ordered.push(cur);
    seen.add((cur[0] << 16) | cur[1]);
  }

  return ordered;
}

function branchTangent(
  path: [number, number][],
  atStart: boolean,
  k = 8
): [number, number] | null {
  if (path.length < 3) return null;
  const step = Math.min(k, path.length - 1);
  const a = atStart ? path[step] : path[path.length - 1 - step];
  const b = atStart ? path[0] : path[path.length - 1];
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  const norm = Math.hypot(dx, dy);
  return norm > 0 ? [dx / norm, dy / norm] : null;
}

function computePathLength(path: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(
      path[i][0] - path[i - 1][0],
      path[i][1] - path[i - 1][1]
    );
  }
  return len;
}

function chainGroupSubpaths(
  pathsList: [number, number][][]
): [number, number][][] {
  if (pathsList.length === 0) return [];
  if (pathsList.length === 1) return [pathsList[0]];

  const used = new Set<number>();
  const subpaths: [number, number][][] = [];

  const orderIndices = pathsList
    .map((p, idx) => ({ idx, len: p.length }))
    .sort((a, b) => b.len - a.len)
    .map((x) => x.idx);

  for (const seedIdx of orderIndices) {
    if (used.has(seedIdx)) continue;
    used.add(seedIdx);
    let chain = pathsList[seedIdx].slice();

    let extended = true;
    while (extended && used.size < pathsList.length) {
      extended = false;
      const headPt = chain[0];
      const tailPt = chain[chain.length - 1];

      let bestIdx = -1;
      let attachAtHead = false;
      let reverseCand = false;
      let bestDist = Infinity;

      for (let i = 0; i < pathsList.length; i++) {
        if (used.has(i)) continue;
        const p = pathsList[i];
        const pStart = p[0];
        const pEnd = p[p.length - 1];

        const dTailStart = Math.hypot(
          pStart[0] - tailPt[0],
          pStart[1] - tailPt[1]
        );
        if (dTailStart < bestDist) {
          bestDist = dTailStart;
          bestIdx = i;
          attachAtHead = false;
          reverseCand = false;
        }

        const dTailEnd = Math.hypot(pEnd[0] - tailPt[0], pEnd[1] - tailPt[1]);
        if (dTailEnd < bestDist) {
          bestDist = dTailEnd;
          bestIdx = i;
          attachAtHead = false;
          reverseCand = true;
        }

        const dHeadEnd = Math.hypot(pEnd[0] - headPt[0], pEnd[1] - headPt[1]);
        if (dHeadEnd < bestDist) {
          bestDist = dHeadEnd;
          bestIdx = i;
          attachAtHead = true;
          reverseCand = false;
        }

        const dHeadStart = Math.hypot(
          pStart[0] - headPt[0],
          pStart[1] - headPt[1]
        );
        if (dHeadStart < bestDist) {
          bestDist = dHeadStart;
          bestIdx = i;
          attachAtHead = true;
          reverseCand = true;
        }
      }

      if (bestIdx >= 0 && bestDist <= 8) {
        used.add(bestIdx);
        const cand = reverseCand
          ? pathsList[bestIdx].slice().reverse()
          : pathsList[bestIdx].slice();
        if (attachAtHead) {
          chain = cand.concat(chain);
        } else {
          chain = chain.concat(cand);
        }
        extended = true;
      }
    }

    subpaths.push(chain);
  }

  return subpaths;
}

export interface BuiltSkeletonLine {
  points: [number, number][];
  orderedPixels: [number, number][];
  subpaths: [number, number][][];
  mainPath: [number, number][];
  lengthPx: number;
  nBranches: number;
}

export function buildLinesFromSkeleton(
  skel: Uint8Array,
  w: number,
  h: number
): {
  lines: [number, number][][];
  builtLines: BuiltSkeletonLine[];
  junctions: [number, number][];
} {
  const { count, components, zone, junctions } = computeSkeletonBranches(
    skel,
    w,
    h,
    true
  );
  const paths = new Map<number, [number, number][]>();

  for (let k = 1; k <= count; k++) {
    const comp = components[k];
    if (comp.length < 5) continue;
    const coords: [number, number][] = comp.map((idx) => {
      const y = Math.floor(idx / w);
      return [y, idx - y * w];
    });
    const ordered = orderPath(coords);
    if (ordered.length >= 5) {
      paths.set(k, ordered);
    }
  }

  const { labels: zoneLab, count: nz } = label8(zone, w, h);
  const near = dilate3x3(zone, w, h, 2);

  interface JunctionEnd {
    k: number;
    atStart: boolean;
    z: number;
    t: [number, number];
  }
  const ends: JunctionEnd[] = [];

  for (const [k, p] of paths.entries()) {
    for (const atStart of [true, false]) {
      const [y, x] = atStart ? p[0] : p[p.length - 1];
      if (near[y * w + x] === 0) continue;
      const t = branchTangent(p, atStart);
      if (!t) continue;

      const counts = new Map<number, number>();
      let bestZ = 0;
      let bestZCount = 0;
      for (let ny = Math.max(0, y - 3); ny <= Math.min(h - 1, y + 3); ny++) {
        const row = ny * w;
        for (let nx = Math.max(0, x - 3); nx <= Math.min(w - 1, x + 3); nx++) {
          const zl = zoneLab[row + nx];
          if (zl > 0) {
            const c = (counts.get(zl) ?? 0) + 1;
            counts.set(zl, c);
            if (c > bestZCount || (c === bestZCount && zl < bestZ)) {
              bestZCount = c;
              bestZ = zl;
            }
          }
        }
      }
      if (bestZ > 0) {
        ends.push({ k, atStart, z: bestZ, t });
      }
    }
  }

  const parent = new Map<number, number>();
  for (const k of paths.keys()) {
    parent.set(k, k);
  }
  const find = (a: number): number => {
    let curr = a;
    while ((parent.get(curr) ?? curr) !== curr) {
      const nextCurr = parent.get(curr) ?? curr;
      const p = parent.get(nextCurr) ?? nextCurr;
      parent.set(curr, p);
      curr = p;
    }
    return curr;
  };

  for (let z = 1; z <= nz; z++) {
    const es = ends.filter((e) => e.z === z);
    const cand: Array<{ cos: number; i: number; j: number }> = [];
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        if (es[i].k === es[j].k) continue;
        const cos = -(es[i].t[0] * es[j].t[0] + es[i].t[1] * es[j].t[1]);
        if (cos > JOIN_COS) {
          cand.push({ cos, i, j });
        }
      }
    }
    cand.sort((a, b) => b.cos - a.cos);
    const used = new Set<number>();
    for (const { i, j } of cand) {
      if (used.has(i) || used.has(j)) continue;
      used.add(i);
      used.add(j);
      parent.set(find(es[i].k), find(es[j].k));
    }
  }

  interface FreeEnd {
    k: number;
    pt: [number, number];
    t: [number, number];
  }
  const free: FreeEnd[] = [];
  for (const [k, p] of paths.entries()) {
    for (const atStart of [true, false]) {
      const [y, x] = atStart ? p[0] : p[p.length - 1];
      if (near[y * w + x] > 0) continue;
      const t = branchTangent(p, atStart);
      if (t) {
        free.push({ k, pt: [x, y], t });
      }
    }
  }

  const gaps: Array<{ dist: number; i: number; j: number }> = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const ki = free[i].k;
      const kj = free[j].k;
      if (find(ki) === find(kj)) continue;
      const wx = free[j].pt[0] - free[i].pt[0];
      const wy = free[j].pt[1] - free[i].pt[1];
      const dist = Math.hypot(wx, wy);
      if (dist < 1 || dist > GAP_PX) continue;
      const ux = wx / dist;
      const uy = wy / dist;
      const ti = free[i].t;
      const tj = free[j].t;
      const endToEnd =
        ti[0] * ux + ti[1] * uy > GAP_COS &&
        -(tj[0] * ux + tj[1] * uy) > GAP_COS;
      const lateral = Math.abs(ti[0] * uy - ti[1] * ux) * dist;
      const overlap =
        ti[0] * tj[0] + ti[1] * tj[1] < -GAP_COS && lateral < OVERLAP_OFFSET;
      if (endToEnd || overlap) {
        gaps.push({ dist, i, j });
      }
    }
  }

  gaps.sort((a, b) => a.dist - b.dist);
  const usedEnds = new Set<number>();
  for (const { i, j } of gaps) {
    if (usedEnds.has(i) || usedEnds.has(j)) continue;
    usedEnds.add(i);
    usedEnds.add(j);
    parent.set(find(free[i].k), find(free[j].k));
  }

  const groups = new Map<number, number[]>();
  for (const k of paths.keys()) {
    const root = find(k);
    const arr = groups.get(root) ?? [];
    arr.push(k);
    groups.set(root, arr);
  }

  const builtLines: BuiltSkeletonLine[] = [];
  for (const ks of groups.values()) {
    const groupPaths = ks.map((k) => paths.get(k) ?? []);
    const lengthPx = groupPaths.reduce(
      (sum, p) => sum + computePathLength(p),
      0
    );
    if (lengthPx >= MIN_LINE_LEN) {
      const allPts = groupPaths.flat();
      const mainPath = groupPaths.reduce((a, b) =>
        b.length > a.length ? b : a
      );
      const subpaths = chainGroupSubpaths(groupPaths);
      const orderedPixels = subpaths[0] ?? mainPath;
      builtLines.push({
        points: allPts,
        orderedPixels,
        subpaths,
        mainPath,
        lengthPx,
        nBranches: ks.length,
      });
    }
  }

  return {
    lines: builtLines.map((b) => b.points),
    builtLines,
    junctions,
  };
}

class AnatomicalFrame {
  yTop: number;
  yBot: number;
  xPinky: number;
  xIndex: number;
  width: number;
  height: number;

  constructor(geom: PalmGeometry) {
    const idx = geom.indexMcp;
    const pky = geom.pinkyMcp;
    const mid = geom.middleMcp;
    const rng = geom.ringMcp;
    const wrs = geom.wrist;

    this.yTop = (idx[1] + mid[1] + rng[1] + pky[1]) * 0.25;
    this.yBot = wrs[1];
    this.xPinky = pky[0];
    this.xIndex = idx[0];
    this.height = Math.max(this.yBot - this.yTop, 1.0);
    this.width = Math.max(Math.abs(this.xIndex - this.xPinky), 1.0);
  }

  uv(pixels: [number, number][]): { u: number[]; v: number[] } {
    const u: number[] = [];
    const v: number[] = [];
    const dxSpan = this.xIndex - this.xPinky || 1.0;
    for (const [py, px] of pixels) {
      u.push((px - this.xPinky) / dxSpan);
      v.push((py - this.yTop) / this.height);
    }
    return { u, v };
  }
}

export function nameLines(
  lines: [number, number][][],
  w: number,
  h: number,
  geom?: PalmGeometry,
  lengthsPx?: number[]
): Record<number, PalmLineName> {
  if (lines.length === 0) return {};

  if (!geom) {
    geom = {
      thumbSide: "right",
      wrist: [w * 0.5, h * 0.92],
      thumbCmc: [w * 0.75, h * 0.75],
      thumbMcp: [w * 0.82, h * 0.55],
      indexMcp: [w * 0.72, h * 0.18],
      middleMcp: [w * 0.52, h * 0.14],
      ringMcp: [w * 0.35, h * 0.18],
      pinkyMcp: [w * 0.18, h * 0.25],
    };
  }

  const frame = new AnatomicalFrame(geom);
  const feats = lines.map((pts, i) => {
    const { u, v } = frame.uv(pts);
    const uMin = Math.min(...u);
    const uMax = Math.max(...u);
    const vMin = Math.min(...v);
    const vMax = Math.max(...v);
    const uMean = u.reduce((a, b) => a + b, 0) / u.length;
    const vMean = v.reduce((a, b) => a + b, 0) / v.length;
    return {
      i,
      lengthPx: lengthsPx?.[i] ?? computePathLength(pts),
      uMean,
      vMean,
      uMin,
      uMax,
      vMin,
      vMax,
      du: uMax - uMin,
      dv: vMax - vMin,
    };
  });

  const assigned: Record<number, PalmLineName> = {};
  const used = new Set<number>();

  const lifeCands = feats.filter(
    (f) =>
      f.dv * frame.height > f.du * frame.width &&
      f.uMean > 0.55 &&
      f.uMax > 0.7 &&
      f.dv > 0.25
  );
  if (lifeCands.length > 0) {
    lifeCands.sort(
      (a, b) => b.lengthPx * b.dv * b.vMax - a.lengthPx * a.dv * a.vMax
    );
    const life = lifeCands[0];
    assigned[life.i] = "life";
    used.add(life.i);
  }

  const horiz = feats
    .filter(
      (f) =>
        !used.has(f.i) &&
        f.du * frame.width >= f.dv * frame.height * 0.8 &&
        f.lengthPx >= 0.25 * frame.width
    )
    .sort((a, b) => a.vMean - b.vMean);

  if (horiz.length >= 2) {
    const top = horiz[0];
    const rest = horiz.slice(1).sort((a, b) => b.lengthPx - a.lengthPx);
    const second = rest[0];
    assigned[top.i] = "heart";
    assigned[second.i] = "head";
    used.add(top.i);
    used.add(second.i);
  } else if (horiz.length === 1) {
    const only = horiz[0];
    const onlyName: PalmLineName = only.vMean < 0.3 ? "heart" : "head";
    assigned[only.i] = onlyName;
    used.add(only.i);

    if (onlyName === "heart") {
      const diagHead = feats
        .filter(
          (f) =>
            !used.has(f.i) &&
            f.vMean > only.vMean &&
            f.du * frame.width >= f.dv * frame.height * 0.5 &&
            f.lengthPx >= 0.22 * frame.width
        )
        .sort((a, b) => b.lengthPx - a.lengthPx);
      if (diagHead.length > 0) {
        assigned[diagHead[0].i] = "head";
        used.add(diagHead[0].i);
      }
    }
  }

  for (const f of feats) {
    if (!used.has(f.i)) {
      assigned[f.i] = "other";
    }
  }

  return assigned;
}

function subsampleNormalizedPoints(
  pixels: [number, number][],
  w: number,
  h: number,
  maxPoints = 48
): [number, number][] {
  if (pixels.length <= 2) {
    return pixels.map(([py, px]) => [
      Number(Math.min(Math.max(px / w, 0), 1).toFixed(4)),
      Number(Math.min(Math.max(py / h, 0), 1).toFixed(4)),
    ]);
  }

  const smoothed: [number, number][] = [];
  const win = 7;
  const half = Math.floor(win / 2);
  for (let i = 0; i < pixels.length; i++) {
    let sy = 0;
    let sx = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - half);
      j <= Math.min(pixels.length - 1, i + half);
      j++
    ) {
      sy += pixels[j][0];
      sx += pixels[j][1];
      count++;
    }
    smoothed.push([sy / count, sx / count]);
  }

  const step = Math.max(1, Math.floor((smoothed.length - 1) / (maxPoints - 1)));
  const sampled: [number, number][] = [];
  for (let i = 0; i < smoothed.length; i += step) {
    const [py, px] = smoothed[i];
    sampled.push([
      Number(Math.min(Math.max(px / w, 0), 1).toFixed(4)),
      Number(Math.min(Math.max(py / h, 0), 1).toFixed(4)),
    ]);
  }
  const last = smoothed[smoothed.length - 1];
  const lastNorm: [number, number] = [
    Number(Math.min(Math.max(last[1] / w, 0), 1).toFixed(4)),
    Number(Math.min(Math.max(last[0] / h, 0), 1).toFixed(4)),
  ];
  const prev = sampled[sampled.length - 1];
  if (!prev || prev[0] !== lastNorm[0] || prev[1] !== lastNorm[1]) {
    sampled.push(lastNorm);
  }
  return sampled;
}

export function analyzePalmMask(
  mask: Uint8Array,
  w = OUT_SIZE,
  h = OUT_SIZE,
  geom?: PalmGeometry
): AnalyzedPalmLine[] {
  const cleaned = cleanSmallComponents(mask, w, h, 60);
  const skelRaw = skeletonizeMask(cleaned, w, h);
  const skel = pruneSkeleton(skelRaw, w, h);
  const { lines, builtLines } = buildLinesFromSkeleton(skel, w, h);
  const lengths = builtLines.map((b) => b.lengthPx);
  const names = nameLines(lines, w, h, geom, lengths);

  const frameHeight = geom ? new AnatomicalFrame(geom).height : h;
  const results: AnalyzedPalmLine[] = [];

  for (let i = 0; i < builtLines.length; i++) {
    const b = builtLines[i];
    if (b.orderedPixels.length < 2) continue;
    const main = b.mainPath;
    const mlen = computePathLength(main);
    const chord = Math.hypot(
      main[0][0] - main[main.length - 1][0],
      main[0][1] - main[main.length - 1][1]
    );
    const curvature =
      chord > 1
        ? Number(Math.min(Math.max(mlen / chord, 0), 10).toFixed(3))
        : 1.0;
    const lengthRel = Number(
      Math.min(Math.max(b.lengthPx / frameHeight, 0), 5).toFixed(3)
    );

    for (const sub of b.subpaths) {
      if (sub.length < 2) continue;
      const sampledPoints = subsampleNormalizedPoints(sub, w, h);
      if (sampledPoints.length < 2) continue;

      results.push({
        name: names[i] ?? "other",
        pixels: sub,
        points: sampledPoints,
        lengthPx: Math.round(b.lengthPx),
        lengthRel,
        curvature,
        branches: Math.min(Math.max(b.nBranches, 0), 100),
      });
    }
  }

  const orderPriority: Record<PalmLineName, number> = {
    life: 0,
    head: 1,
    heart: 2,
    other: 3,
  };

  results.sort(
    (a, b) =>
      orderPriority[a.name] - orderPriority[b.name] || b.lengthPx - a.lengthPx
  );

  return results.slice(0, 25);
}

export function detectCreaseFallbackMask(
  rgba: Uint8ClampedArray,
  region: Uint8Array,
  w = OUT_SIZE,
  h = OUT_SIZE
): Uint8Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] =
      0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
  }

  const radius = 6;
  const blurH = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w) {
          sum += gray[row + nx];
          count++;
        }
      }
      blurH[row + x] = sum / count;
    }
  }

  const blur = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h) {
          sum += blurH[ny * w + x];
          count++;
        }
      }
      blur[y * w + x] = sum / count;
    }
  }

  const diff = new Float32Array(w * h);
  const vals: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (region[i] === 0) continue;
    const d = Math.max(0, blur[i] - gray[i]);
    diff[i] = d;
    vals.push(d);
  }

  if (vals.length === 0) {
    return new Uint8Array(w * h);
  }

  vals.sort((a, b) => a - b);
  const p92 = vals[Math.floor(vals.length * 0.92)] || 4.0;
  const thresh = Math.max(p92, 3.5);

  const rawMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (region[i] > 0 && diff[i] >= thresh) {
      rawMask[i] = 255;
    }
  }

  return cleanSmallComponents(rawMask, w, h, MIN_MASK_SIZE);
}

let cachedOrtSessionPromise: Promise<any> | null = null;

const DEFAULT_R2_MODEL_URL =
  "https://pub-d76d41e7b18e4b89949a626c28eb4527.r2.dev/palm_lines.onnx";

const ONNX_MODEL_URL =
  (import.meta.env?.VITE_PALM_MODEL_URL as string | undefined) ||
  DEFAULT_R2_MODEL_URL;

async function fetchOnnxModelBuffer(url: string): Promise<Uint8Array | null> {
  try {
    if (typeof caches !== "undefined") {
      try {
        const cache = await caches.open("palmsight-onnx-v1");
        const cachedResp = await cache.match(url);
        if (cachedResp && cachedResp.ok) {
          const buf = await cachedResp.arrayBuffer();
          if (buf.byteLength > 1_000_000) {
            return new Uint8Array(buf);
          }
        }
        const netResp = await fetch(url, { mode: "cors" });
        if (netResp.ok) {
          const clone = netResp.clone();
          const buf = await netResp.arrayBuffer();
          if (buf.byteLength > 1_000_000) {
            cache.put(url, clone).catch(() => {});
            return new Uint8Array(buf);
          }
        }
      } catch {
        const fallbackResp = await fetch(url);
        if (fallbackResp.ok) {
          const buf = await fallbackResp.arrayBuffer();
          if (buf.byteLength > 1_000_000) {
            return new Uint8Array(buf);
          }
        }
      }
    } else {
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf.byteLength > 1_000_000) {
          return new Uint8Array(buf);
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function getOnnxSession(): Promise<any | null> {
  if (typeof window === "undefined") {
    return null;
  }
  if (!cachedOrtSessionPromise) {
    cachedOrtSessionPromise = (async () => {
      try {
        const ort = await import("onnxruntime-web");
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;

        const modelBuffer =
          (await fetchOnnxModelBuffer(ONNX_MODEL_URL)) ||
          (await fetchOnnxModelBuffer("/models/palm_lines.onnx"));

        const modelSource: any = modelBuffer ?? ONNX_MODEL_URL;

        try {
          ort.env.wasm.wasmPaths =
            "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";
          return await ort.InferenceSession.create(modelSource, {
            executionProviders: ["wasm"],
          });
        } catch {
          ort.env.wasm.wasmPaths = "/onnx/";
          return await ort.InferenceSession.create(modelSource, {
            executionProviders: ["wasm"],
          });
        }
      } catch {
        cachedOrtSessionPromise = null;
        return null;
      }
    })();
  }
  return cachedOrtSessionPromise;
}

export async function predictPalmMaskWithOnnx(
  rgba: Uint8ClampedArray,
  region: Uint8Array,
  w = OUT_SIZE,
  h = OUT_SIZE
): Promise<{ mask: Uint8Array; usedOnnx: boolean }> {
  const session = await getOnnxSession();
  if (!session) {
    return {
      mask: detectCreaseFallbackMask(rgba, region, w, h),
      usedOnnx: false,
    };
  }

  try {
    const ort = await import("onnxruntime-web");
    const planeSize = w * h;
    const floatData = new Float32Array(3 * planeSize);

    for (let i = 0; i < planeSize; i++) {
      const idx = i * 4;
      const r = rgba[idx] / 255.0;
      const g = rgba[idx + 1] / 255.0;
      const b = rgba[idx + 2] / 255.0;
      floatData[i] = (r - MEAN[0]) / STD[0];
      floatData[planeSize + i] = (g - MEAN[1]) / STD[1];
      floatData[2 * planeSize + i] = (b - MEAN[2]) / STD[2];
    }

    const inputTensor = new ort.Tensor("float32", floatData, [1, 3, h, w]);
    const inputName = session.inputNames?.[0] || "image";
    const outputs = await session.run({ [inputName]: inputTensor });
    const outputName = session.outputNames?.[0] || Object.keys(outputs)[0];
    const logits = outputs[outputName].data as Float32Array;

    const rawMask = new Uint8Array(planeSize);
    for (let i = 0; i < planeSize; i++) {
      if (region[i] === 0) continue;
      const prob = 1.0 / (1.0 + Math.exp(-logits[i]));
      if (prob > THRESH) {
        rawMask[i] = 255;
      }
    }

    return {
      mask: cleanSmallComponents(rawMask, w, h, MIN_MASK_SIZE),
      usedOnnx: true,
    };
  } catch {
    return {
      mask: detectCreaseFallbackMask(rgba, region, w, h),
      usedOnnx: false,
    };
  }
}

export function renderAnnotatedPalmCanvas(
  rgba: Uint8ClampedArray,
  mask: Uint8Array,
  _lines: AnalyzedPalmLine[],
  w = OUT_SIZE,
  h = OUT_SIZE
): { croppedDataUrl: string; annotatedDataUrl: string } {
  if (typeof document === "undefined") {
    return { croppedDataUrl: "", annotatedDataUrl: "" };
  }

  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = w;
  baseCanvas.height = h;
  const baseCtx = baseCanvas.getContext("2d");
  if (!baseCtx) {
    return { croppedDataUrl: "", annotatedDataUrl: "" };
  }

  const baseImgData = new ImageData(new Uint8ClampedArray(rgba), w, h);
  baseCtx.putImageData(baseImgData, 0, 0);
  const croppedDataUrl = baseCanvas.toDataURL("image/jpeg", 0.92);

  const annotatedCanvas = document.createElement("canvas");
  annotatedCanvas.width = w;
  annotatedCanvas.height = h;
  const ctx = annotatedCanvas.getContext("2d");
  if (!ctx) {
    return { croppedDataUrl, annotatedDataUrl: croppedDataUrl };
  }

  const annotatedImgData = new ImageData(new Uint8ClampedArray(rgba), w, h);
  const data = annotatedImgData.data;

  for (let i = 0; i < w * h; i++) {
    if (mask[i] > 0) {
      const idx = i * 4;
      data[idx] = 255;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(annotatedImgData, 0, 0);

  const annotatedDataUrl = annotatedCanvas.toDataURL("image/jpeg", 0.92);
  return { croppedDataUrl, annotatedDataUrl };
}

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return null;
  }
  try {
    const parts = dataUrl.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

let cachedImageLandmarkerPromise: Promise<any> | null = null;

async function detectHandLandmarksFromElement(
  imgEl: HTMLImageElement | HTMLCanvasElement
): Promise<{
  pts: [number, number][];
  handedness: "Left" | "Right";
} | null> {
  try {
    if (!cachedImageLandmarkerPromise) {
      cachedImageLandmarkerPromise = (async () => {
        const { FilesetResolver, HandLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        const configs: Array<{
          wasmUrl: string;
          modelUrl: string;
          delegate: "GPU" | "CPU";
        }> = [
          {
            wasmUrl:
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm",
            modelUrl:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          {
            wasmUrl:
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm",
            modelUrl:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          {
            wasmUrl:
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
            modelUrl:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          {
            wasmUrl: "/mediapipe",
            modelUrl: "/models/hand_landmarker.task",
            delegate: "CPU",
          },
        ];

        let lastErr: unknown = null;
        for (const cfg of configs) {
          try {
            const vision = await FilesetResolver.forVisionTasks(cfg.wasmUrl);
            return await HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: cfg.modelUrl,
                delegate: cfg.delegate,
              },
              runningMode: "IMAGE",
              numHands: 1,
              minHandDetectionConfidence: 0.35,
            });
          } catch (err) {
            lastErr = err;
          }
        }
        throw lastErr;
      })();
    }

    const landmarker = await cachedImageLandmarkerPromise;
    const res = landmarker.detect(imgEl);
    if (!res?.landmarks?.length || res.landmarks[0].length < 21) {
      return null;
    }

    const w = imgEl.width || (imgEl as HTMLImageElement).naturalWidth;
    const h = imgEl.height || (imgEl as HTMLImageElement).naturalHeight;
    const pts: [number, number][] = res.landmarks[0].map(
      (lm: { x: number; y: number }) => [lm.x * w, lm.y * h]
    );
    const rawLabel =
      res.handednesses?.[0]?.[0]?.categoryName ||
      res.handedness?.[0]?.[0]?.categoryName ||
      "Right";
    const handedness: "Left" | "Right" =
      rawLabel === "Left" ? "Left" : "Right";
    return { pts, handedness };
  } catch {
    cachedImageLandmarkerPromise = null;
    return null;
  }
}

function buildDefaultLandmarks(w: number, h: number): [number, number][] {
  const pts: [number, number][] = new Array(21).fill(0).map(() => [0, 0]);
  pts[0] = [w * 0.5, h * 0.82];
  pts[1] = [w * 0.65, h * 0.72];
  pts[2] = [w * 0.74, h * 0.58];
  pts[5] = [w * 0.64, h * 0.36];
  pts[9] = [w * 0.5, h * 0.33];
  pts[13] = [w * 0.38, h * 0.36];
  pts[17] = [w * 0.28, h * 0.43];
  return pts;
}

const pipelineCache = new WeakMap<File, Promise<PalmPipelineResult | null>>();

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function runClientPalmPipeline(
  file: File
): Promise<PalmPipelineResult | null> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    (typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent || ""))
  ) {
    return null;
  }

  const cached = pipelineCache.get(file);
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<PalmPipelineResult | null> => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = (err) => reject(err);
        el.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);

      const rawW = img.naturalWidth || img.width;
      const rawH = img.naturalHeight || img.height;
      if (!rawW || !rawH) {
        return null;
      }

      const maxSrcDim = 1024;
      const scale = Math.min(1, maxSrcDim / Math.max(rawW, rawH));
      const srcW = Math.max(1, Math.round(rawW * scale));
      const srcH = Math.max(1, Math.round(rawH * scale));

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = srcW;
      srcCanvas.height = srcH;
      const srcCtx = srcCanvas.getContext("2d");
      if (!srcCtx) {
        return null;
      }
      srcCtx.drawImage(img, 0, 0, srcW, srcH);
      const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH);

      await yieldToMain();

      const detected = await detectHandLandmarksFromElement(srcCanvas);
      const pts = detected?.pts ?? buildDefaultLandmarks(srcW, srcH);
      const handedness = detected?.handedness ?? "Right";

      await yieldToMain();

      const cropped = cropPalmExFromRgba(
        srcImageData.data,
        srcW,
        srcH,
        pts,
        handedness
      );

      await yieldToMain();

      const { mask, usedOnnx } = await predictPalmMaskWithOnnx(
        cropped.rgba,
        cropped.region,
        OUT_SIZE,
        OUT_SIZE
      );

      if (!usedOnnx) {
        pipelineCache.delete(file);
        return null;
      }

      await yieldToMain();

      const analyzedLines = analyzePalmMask(
        mask,
        OUT_SIZE,
        OUT_SIZE,
        cropped.geom
      );

      const { croppedDataUrl, annotatedDataUrl } = renderAnnotatedPalmCanvas(
        cropped.rgba,
        mask,
        analyzedLines,
        OUT_SIZE,
        OUT_SIZE
      );

      const palmLines: PalmLineDto[] = analyzedLines
        .filter((line) => line.name !== "other")
        .map((line) => ({
          name: line.name,
          points: line.points,
          lengthRel: line.lengthRel,
          curvature: line.curvature,
          branches: line.branches,
        }));

      return {
        palmLines,
        analyzedLines,
        croppedDataUrl,
        annotatedDataUrl,
        annotatedFile: dataUrlToFile(annotatedDataUrl, "palm-lines.jpg"),
        usedOnnxModel: usedOnnx,
      };
    } catch {
      pipelineCache.delete(file);
      return null;
    }
  })();

  pipelineCache.set(file, promise);
  return promise;
}
