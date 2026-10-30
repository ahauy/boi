import { useEffect, useRef, useState, useCallback } from "react";
import { HandOrientation } from "@palmsight/shared";

export type DetectionStatus =
  | "IDLE"
  | "LOADING"
  | "SEARCHING"
  | "WRONG_HAND"
  | "NOT_PALM"
  | "TOO_FAR"
  | "TOO_CLOSE"
  | "ALIGN"
  | "UNSTABLE"
  | "HOLDING"
  | "CAPTURED";

export interface UseHandDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  targetHand: HandOrientation;
  onCapture: () => void;
  holdDurationMs?: number;
  enabled?: boolean;
}

export interface UseHandDetectionResult {
  status: DetectionStatus;
  feedback: string;
  progress: number;
  isAutoCaptureEnabled: boolean;
  setIsAutoCaptureEnabled: (enabled: boolean) => void;
  isModelReady: boolean;
}

interface Point2D {
  x: number;
  y: number;
}

export const useHandDetection = ({
  videoRef,
  isCameraActive,
  targetHand,
  onCapture,
  holdDurationMs = 1000,
  enabled = true,
}: UseHandDetectionOptions): UseHandDetectionResult => {
  const [status, setStatus] = useState<DetectionStatus>("IDLE");
  const [feedback, setFeedback] = useState<string>("Bật camera để nhận diện");
  const [progress, setProgress] = useState<number>(0);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState<boolean>(enabled);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);

  const landmarkerRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const historyPositionsRef = useRef<Point2D[]>([]);
  const stableSinceRef = useRef<number | null>(null);
  const hasCapturedRef = useRef<boolean>(false);
  const onCaptureRef = useRef(onCapture);

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          return;
        }
        landmarkerRef.current = null;
      }
    };
  }, []);

  const initModel = useCallback(async () => {
    if (landmarkerRef.current || isInitializingRef.current) {
      return;
    }
    isInitializingRef.current = true;
    if (isMountedRef.current && typeof window !== "undefined") {
      setStatus("LOADING");
      setFeedback("Đang tải AI nhận diện...");
    }

    try {
      const { FilesetResolver, HandLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      if (!isMountedRef.current || typeof window === "undefined") {
        return;
      }

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      if (!isMountedRef.current || typeof window === "undefined") {
        return;
      }

      let landmarker: any;
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        if (!isMountedRef.current || typeof window === "undefined") {
          return;
        }
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }

      if (!isMountedRef.current || typeof window === "undefined") {
        if (landmarker) {
          try {
            landmarker.close();
          } catch {
            return;
          }
        }
        return;
      }

      landmarkerRef.current = landmarker;
      setIsModelReady(true);
      setStatus("SEARCHING");
      setFeedback("Đưa bàn tay vào khung hình");
    } catch {
      if (isMountedRef.current && typeof window !== "undefined") {
        setIsModelReady(false);
        setStatus("IDLE");
        setFeedback("Không thể khởi động AI tự động, vui lòng chụp thủ công");
      }
      return;
    } finally {
      isInitializingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isCameraActive && isAutoCaptureEnabled && !landmarkerRef.current) {
      initModel();
    }

    if (!isCameraActive) {
      if (isMountedRef.current && typeof window !== "undefined") {
        setStatus("IDLE");
        setProgress(0);
      }
      stableSinceRef.current = null;
      historyPositionsRef.current = [];
      hasCapturedRef.current = false;
    }
  }, [isCameraActive, isAutoCaptureEnabled, initModel]);

  useEffect(() => {
    if (!isCameraActive || !isAutoCaptureEnabled || !isModelReady) {
      return;
    }

    let animationFrameId: number;

    const runDetection = () => {
      if (!isMountedRef.current || typeof window === "undefined") {
        return;
      }

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (
        !video ||
        !landmarker ||
        video.readyState < 2 ||
        hasCapturedRef.current
      ) {
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      let results: any = null;
      try {
        results = landmarker.detectForVideo(video, performance.now());
      } catch {
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      if (!results || !results.landmarks || results.landmarks.length === 0) {
        setStatus("SEARCHING");
        setFeedback("Đưa bàn tay vào khung hình");
        setProgress(0);
        stableSinceRef.current = null;
        historyPositionsRef.current = [];
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      const landmarks = results.landmarks[0];
      const handednessCategories = results.handedness?.[0];
      const detectedHandCategory = handednessCategories?.[0]?.categoryName;

      const expectedCategory =
        targetHand === HandOrientation.LEFT ? "Left" : "Right";
      if (detectedHandCategory && detectedHandCategory !== expectedCategory) {
        setStatus("WRONG_HAND");
        setFeedback(
          targetHand === HandOrientation.LEFT
            ? "Vui lòng dùng bàn tay trái"
            : "Vui lòng dùng bàn tay phải"
        );
        setProgress(0);
        stableSinceRef.current = null;
        historyPositionsRef.current = [];
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      const v1x = landmarks[9].x - landmarks[0].x;
      const v1y = landmarks[9].y - landmarks[0].y;
      const v2x = landmarks[5].x - landmarks[17].x;
      const v2y = landmarks[5].y - landmarks[17].y;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);

      let isPalmFacing = false;
      if (len1 > 0.01 && len2 > 0.01) {
        const cross = (v1x * v2y - v1y * v2x) / (len1 * len2);
        isPalmFacing =
          targetHand === HandOrientation.LEFT ? cross < -0.25 : cross > 0.25;
      }

      if (!isPalmFacing) {
        setStatus("NOT_PALM");
        setFeedback("Lật lòng bàn tay hướng về camera");
        setProgress(0);
        stableSinceRef.current = null;
        historyPositionsRef.current = [];
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;

      for (let i = 0; i < landmarks.length; i++) {
        const point = landmarks[i];
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      }

      const boxWidth = maxX - minX;
      const boxHeight = maxY - minY;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      if (boxWidth < 0.2 || boxHeight < 0.25) {
        setStatus("TOO_FAR");
        setFeedback("Đưa bàn tay lại gần hơn");
        setProgress(0);
        stableSinceRef.current = null;
        historyPositionsRef.current = [];
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      if (boxWidth > 0.85 || boxHeight > 0.9) {
        setStatus("TOO_CLOSE");
        setFeedback("Lùi bàn tay ra xa một chút");
        setProgress(0);
        stableSinceRef.current = null;
        historyPositionsRef.current = [];
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      if (centerX < 0.25 || centerX > 0.75 || centerY < 0.2 || centerY > 0.8) {
        setStatus("ALIGN");
        setFeedback("Căn chỉnh bàn tay vào giữa khung");
        setProgress(0);
        stableSinceRef.current = null;
        historyPositionsRef.current = [];
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      const history = historyPositionsRef.current;
      history.push({ x: centerX, y: centerY });
      if (history.length > 10) {
        history.shift();
      }

      let isMoving = false;
      if (history.length >= 6) {
        for (let i = 0; i < history.length; i++) {
          const dx = Math.abs(history[i].x - centerX);
          const dy = Math.abs(history[i].y - centerY);
          if (dx > 0.035 || dy > 0.035) {
            isMoving = true;
            break;
          }
        }
      }

      if (isMoving) {
        setStatus("UNSTABLE");
        setFeedback("Giữ yên bàn tay");
        setProgress(0);
        stableSinceRef.current = null;
        animationFrameId = requestAnimationFrame(runDetection);
        return;
      }

      const now = performance.now();
      if (stableSinceRef.current === null) {
        stableSinceRef.current = now;
      }

      const elapsed = now - stableSinceRef.current;
      const currentProgress = Math.min(100, Math.round((elapsed / holdDurationMs) * 100));
      setProgress(currentProgress);
      setStatus("HOLDING");
      setFeedback("Đang quét... Giữ yên");

      if (elapsed >= holdDurationMs) {
        hasCapturedRef.current = true;
        setStatus("CAPTURED");
        setProgress(100);
        setFeedback("Chụp thành công!");
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try {
            navigator.vibrate(50);
          } catch {
            return;
          }
        }
        onCaptureRef.current();
        return;
      }

      animationFrameId = requestAnimationFrame(runDetection);
    };

    animationFrameId = requestAnimationFrame(runDetection);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    isCameraActive,
    isAutoCaptureEnabled,
    isModelReady,
    targetHand,
    holdDurationMs,
    videoRef,
  ]);

  return {
    status,
    feedback,
    progress,
    isAutoCaptureEnabled,
    setIsAutoCaptureEnabled,
    isModelReady,
  };
};
