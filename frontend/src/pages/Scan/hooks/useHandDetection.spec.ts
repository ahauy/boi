import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandOrientation } from "@palmsight/shared";
import { useHandDetection } from "./useHandDetection";

describe("useHandDetection hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with IDLE status and default options", () => {
    const videoRef = { current: null };
    const onCapture = vi.fn();

    const { result } = renderHook(() =>
      useHandDetection({
        videoRef,
        isCameraActive: false,
        targetHand: HandOrientation.LEFT,
        onCapture,
      })
    );

    expect(result.current.status).toBe("IDLE");
    expect(result.current.feedback).toBe("Bật camera để nhận diện");
    expect(result.current.progress).toBe(0);
    expect(result.current.isAutoCaptureEnabled).toBe(true);
    expect(result.current.isModelReady).toBe(false);
  });

  it("should allow toggling auto capture state", () => {
    const videoRef = { current: null };
    const onCapture = vi.fn();

    const { result } = renderHook(() =>
      useHandDetection({
        videoRef,
        isCameraActive: false,
        targetHand: HandOrientation.RIGHT,
        onCapture,
        enabled: true,
      })
    );

    expect(result.current.isAutoCaptureEnabled).toBe(true);

    act(() => {
      result.current.setIsAutoCaptureEnabled(false);
    });

    expect(result.current.isAutoCaptureEnabled).toBe(false);
  });

  it("should reset status and progress when camera becomes inactive", () => {
    const videoRef = { current: null };
    const onCapture = vi.fn();

    const { result, rerender } = renderHook(
      ({ isActive }) =>
        useHandDetection({
          videoRef,
          isCameraActive: isActive,
          targetHand: HandOrientation.LEFT,
          onCapture,
        }),
      { initialProps: { isActive: true } }
    );

    rerender({ isActive: false });

    expect(result.current.status).toBe("IDLE");
    expect(result.current.progress).toBe(0);
  });

  it("should initialize model and update status when camera becomes active", async () => {
    const videoRef = { current: null };
    const onCapture = vi.fn();

    const { result } = renderHook(() =>
      useHandDetection({
        videoRef,
        isCameraActive: true,
        targetHand: HandOrientation.LEFT,
        onCapture,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isModelReady).toBe(true);
    expect(result.current.status).toBe("SEARCHING");
    expect(result.current.feedback).toBe("Đưa bàn tay vào khung hình");
  });

  it("should detect back of hand and update status to NOT_PALM", async () => {
    const { HandLandmarker } = await import("@mediapipe/tasks-vision");
    const mockBackLandmarks = Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    mockBackLandmarks[0] = { x: 0.5, y: 0.7, z: 0 };
    mockBackLandmarks[9] = { x: 0.5, y: 0.4, z: 0 };
    mockBackLandmarks[5] = { x: 0.6, y: 0.45, z: 0 };
    mockBackLandmarks[17] = { x: 0.4, y: 0.45, z: 0 };

    const mockDetect = vi.fn().mockReturnValue({
      landmarks: [mockBackLandmarks],
      handedness: [[{ categoryName: "Left" }]],
    });

    vi.spyOn(HandLandmarker, "createFromOptions").mockResolvedValueOnce({
      detectForVideo: mockDetect,
      close: vi.fn(),
    } as any);

    const mockVideo = { readyState: 4 } as HTMLVideoElement;
    const videoRef = { current: mockVideo };
    const onCapture = vi.fn();

    let rafCallback: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });

    const { result } = renderHook(() =>
      useHandDetection({
        videoRef,
        isCameraActive: true,
        targetHand: HandOrientation.LEFT,
        onCapture,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      rafCallback(100);
    });

    expect(result.current.status).toBe("NOT_PALM");
    expect(result.current.feedback).toBe("Lật lòng bàn tay hướng về camera");
  });

  it("should detect front palm facing camera and advance detection", async () => {
    const { HandLandmarker } = await import("@mediapipe/tasks-vision");
    const mockPalmLandmarks = Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    mockPalmLandmarks[0] = { x: 0.5, y: 0.7, z: 0 };
    mockPalmLandmarks[9] = { x: 0.5, y: 0.4, z: 0 };
    mockPalmLandmarks[5] = { x: 0.4, y: 0.45, z: 0 };
    mockPalmLandmarks[17] = { x: 0.6, y: 0.45, z: 0 };

    const mockDetect = vi.fn().mockReturnValue({
      landmarks: [mockPalmLandmarks],
      handedness: [[{ categoryName: "Left" }]],
    });

    vi.spyOn(HandLandmarker, "createFromOptions").mockResolvedValueOnce({
      detectForVideo: mockDetect,
      close: vi.fn(),
    } as any);

    const mockVideo = { readyState: 4 } as HTMLVideoElement;
    const videoRef = { current: mockVideo };
    const onCapture = vi.fn();

    let rafCallback: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });

    const { result } = renderHook(() =>
      useHandDetection({
        videoRef,
        isCameraActive: true,
        targetHand: HandOrientation.LEFT,
        onCapture,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      rafCallback(100);
    });

    expect(result.current.status).not.toBe("NOT_PALM");
    expect(result.current.status).not.toBe("WRONG_HAND");
  });
});
