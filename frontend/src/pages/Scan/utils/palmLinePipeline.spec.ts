import { describe, it, expect } from "vitest";
import {
  facingInfo,
  computeConvexHull,
  cropPalmExFromRgba,
  skeletonizeMask,
  analyzePalmMask,
  detectCreaseFallbackMask,
  PalmGeometry,
} from "./palmLinePipeline";

describe("palmLinePipeline utilities", () => {
  it("facingInfo detects palm orientation and thumb side", () => {
    const pts: [number, number][] = new Array(21).fill(0).map(() => [0, 0]);
    pts[0] = [100, 180];
    pts[5] = [65, 70];
    pts[17] = [135, 80];

    const rightHand = facingInfo(pts, "Right");
    expect(rightHand.isPalm).toBe(true);
    expect(rightHand.thumbSide).toBe("right");

    const leftHand = facingInfo(pts, "Left");
    expect(leftHand.isPalm).toBe(false);
  });

  it("computeConvexHull returns convex polygon vertices", () => {
    const hull = computeConvexHull([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
    ]);
    expect(hull.length).toBe(4);
  });

  it("cropPalmExFromRgba warps source RGBA into 512x512 with region mask and geometry", () => {
    const srcW = 128;
    const srcH = 128;
    const srcRgba = new Uint8ClampedArray(srcW * srcH * 4);
    for (let i = 0; i < srcW * srcH; i++) {
      srcRgba[i * 4] = 200;
      srcRgba[i * 4 + 1] = 170;
      srcRgba[i * 4 + 2] = 150;
      srcRgba[i * 4 + 3] = 255;
    }

    const pts: [number, number][] = new Array(21).fill(0).map(() => [64, 64]);
    pts[0] = [64, 105];
    pts[1] = [46, 92];
    pts[2] = [34, 74];
    pts[5] = [46, 46];
    pts[9] = [64, 42];
    pts[13] = [80, 46];
    pts[17] = [92, 55];

    const cropped = cropPalmExFromRgba(srcRgba, srcW, srcH, pts, "Right");
    expect(cropped.width).toBe(512);
    expect(cropped.height).toBe(512);
    expect(cropped.rgba.length).toBe(512 * 512 * 4);
    expect(cropped.region.length).toBe(512 * 512);
    expect(cropped.geom.thumbSide).toBe("right");

    let regionActivePixels = 0;
    for (let i = 0; i < cropped.region.length; i++) {
      if (cropped.region[i] > 0) regionActivePixels++;
    }
    expect(regionActivePixels).toBeGreaterThan(1000);
  });

  it("skeletonizeMask and analyzePalmMask classify heart, head, and life lines", () => {
    const w = 512;
    const h = 512;
    const mask = new Uint8Array(w * h);

    const drawThickSegment = (
      x0: number,
      y0: number,
      x1: number,
      y1: number
    ) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = Math.round(x0 + (x1 - x0) * t);
        const cy = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              mask[ny * w + nx] = 255;
            }
          }
        }
      }
    };

    drawThickSegment(120, 165, 340, 155);
    drawThickSegment(140, 235, 360, 225);
    drawThickSegment(355, 210, 290, 410);

    const skel = skeletonizeMask(mask, w, h);
    let skelCount = 0;
    for (let i = 0; i < skel.length; i++) {
      if (skel[i] > 0) skelCount++;
    }
    expect(skelCount).toBeGreaterThan(100);

    const geom: PalmGeometry = {
      thumbSide: "right",
      wrist: [256, 460],
      thumbCmc: [380, 380],
      thumbMcp: [420, 280],
      indexMcp: [370, 95],
      middleMcp: [265, 75],
      ringMcp: [180, 95],
      pinkyMcp: [95, 130],
    };

    const analyzed = analyzePalmMask(mask, w, h, geom);
    expect(analyzed.length).toBeGreaterThanOrEqual(3);
    const names = analyzed.map((l) => l.name);
    expect(names).toContain("life");
    expect(names).toContain("head");
    expect(names).toContain("heart");
  });

  it("detectCreaseFallbackMask extracts dark palm creases inside region", () => {
    const w = 128;
    const h = 128;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const region = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        rgba[i * 4] = 210;
        rgba[i * 4 + 1] = 180;
        rgba[i * 4 + 2] = 160;
        rgba[i * 4 + 3] = 255;
        if (x >= 16 && x < 112 && y >= 16 && y < 112) {
          region[i] = 255;
        }
      }
    }

    for (let x = 24; x < 104; x++) {
      for (let y = 58; y <= 62; y++) {
        const i = y * w + x;
        rgba[i * 4] = 60;
        rgba[i * 4 + 1] = 45;
        rgba[i * 4 + 2] = 40;
      }
    }

    const mask = detectCreaseFallbackMask(rgba, region, w, h);
    let active = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) active++;
    }
    expect(active).toBeGreaterThan(150);
  });
});
