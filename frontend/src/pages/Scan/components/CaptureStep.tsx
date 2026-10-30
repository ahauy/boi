import React, { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Camera, Upload, RotateCcw, Sparkles, Eye } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import {
  ReadingSchool,
  HandOrientation,
  READING_SCHOOLS,
} from "@palmsight/shared";
import { ScanStatus } from "../types";
import { cn } from "@/lib/utils";
import { useHandDetection } from "../hooks/useHandDetection";

interface CaptureStepProps {
  school: ReadingSchool;
  hand: HandOrientation;
  isAllTopics: boolean;
  selectedCount: number;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  aiConsent: boolean;
  onConsentChange: (consent: boolean) => void;
  onImageChange: (file: File | null, previewUrl: string | null) => void;
  onSubmit: (file?: File) => void;
  onRetry: () => void;
  status: ScanStatus;
  errorMessage?: string | null;
  rejectReason?: string | null;
}

export const CaptureStep: React.FC<CaptureStepProps> = ({
  school,
  hand,
  isAllTopics,
  selectedCount,
  imageFile,
  imagePreviewUrl,
  aiConsent,
  onConsentChange,
  onImageChange,
  onSubmit,
  onRetry,
  status,
  errorMessage,
  rejectReason,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const schoolConfig = READING_SCHOOLS[school];
  const handLabel = hand === HandOrientation.LEFT ? "Tay trái" : "Tay phải";
  const topicsSummary = isAllTopics ? "Toàn bộ" : `${selectedCount} mục`;

  const creditBalance = user?.creditBalance ?? 0;
  const isOutOfCredits = user ? creditBalance <= 0 : false;
  const canEnterCode = Boolean(user?.referral?.canEnterCode);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.muted = true;
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()?.catch?.(() => {});
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError(
          "Trình duyệt không hỗ trợ camera. Vui lòng chọn ảnh có sẵn."
        );
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.srcObject = stream;
        videoRef.current.play()?.catch?.(() => {});
      }
    } catch {
      setCameraError(
        "Không thể truy cập camera. Vui lòng cấp quyền hoặc chọn ảnh có sẵn."
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "palm.jpg", { type: "image/jpeg" });
        const preview =
          typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(blob)
            : "";
        stopCamera();
        onImageChange(file, preview);
        onConsentChange(true);
        if (
          !isOutOfCredits &&
          status !== "LIMIT_REACHED" &&
          status !== "RATE_LIMITED"
        ) {
          onSubmit(file);
        }
      },
      "image/jpeg",
      0.92
    );
  }, [
    stopCamera,
    onConsentChange,
    onImageChange,
    isOutOfCredits,
    status,
    onSubmit,
  ]);

  const {
    status: handStatus,
    feedback: handFeedback,
    progress: autoCaptureProgress,
    isAutoCaptureEnabled,
    setIsAutoCaptureEnabled,
  } = useHandDetection({
    videoRef,
    isCameraActive,
    targetHand: hand,
    onCapture: capturePhoto,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const preview =
      typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : "";
    onImageChange(file, preview);
  };

  const handleRetake = () => {
    if (imagePreviewUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    onImageChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canSubmit =
    Boolean(imageFile) &&
    aiConsent &&
    !isOutOfCredits &&
    selectedCount > 0 &&
    status !== "ANALYZING" &&
    status !== "LIMIT_REACHED" &&
    status !== "RATE_LIMITED";

  return (
    <section className="w-full flex flex-col justify-start">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-hairline">
        <div className="flex items-center gap-3">
          <Eye aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
          <h2 className="font-display text-xl text-[#f7e7b4] m-0 font-bold">
            4. Chụp ảnh
          </h2>
          <span className="text-xs text-success inline-flex items-center gap-1.5 font-rune bg-[#0b0716]/70 px-2.5 py-0.5 rounded-full border border-success/30">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
            {imageFile
              ? "IMAGE_LOADED"
              : isCameraActive
              ? "CAMERA_ACTIVE"
              : "READY"}
          </span>
        </div>
        <span className="text-xs text-[#d4af37]/70 font-rune">
          ✦ Ấn Tướng
        </span>
      </div>

      <div
        className="text-xs sm:text-sm text-[#f7e7b4] mb-4 select-none bg-[#0b0716]/60 border border-[#d4af37]/30 rounded-lg px-3.5 py-2 inline-flex items-center gap-2 self-start"
        data-testid="selection-summary"
      >
        <span aria-hidden="true" className="text-[#d4af37]">
          ✦
        </span>
        <span>
          {schoolConfig.name.replace("Chỉ tay ", "")} · {handLabel} ·{" "}
          {topicsSummary}
        </span>
      </div>

      <div
        className="relative w-full h-[360px] sm:h-[390px] bg-gradient-to-b from-[#0b0716] via-[#160e2c] to-[#0b0716] border border-[#d4af37]/45 overflow-hidden flex items-center justify-center select-none rounded-2xl shadow-[inset_0_0_50px_rgba(0,0,0,0.85),0_0_25px_rgba(212,175,55,0.12)]"
        id="viewfinder"
        data-testid="viewfinder"
      >
        {!imagePreviewUrl && (
          <svg
            aria-hidden="true"
            className="absolute w-72 h-72 text-[#d4af37]/15 animate-spin-slow pointer-events-none"
            viewBox="0 0 300 300"
            fill="none"
          >
            <circle
              cx="150"
              cy="150"
              r="140"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <circle
              cx="150"
              cy="150"
              r="118"
              stroke="currentColor"
              strokeWidth="1"
            />
            <polygon
              points="150,20 185,115 280,150 185,185 150,280 115,185 20,150 115,115"
              stroke="currentColor"
              strokeWidth="0.75"
            />
          </svg>
        )}

        {!imagePreviewUrl && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37]/70 to-transparent shadow-[0_0_15px_2px_rgba(212,175,55,0.6)] animate-scan-beam z-20"
          />
        )}

        <div className="absolute top-4 left-4 font-rune text-xl text-[#d4af37] leading-none pointer-events-none select-none z-20">
          ┌
        </div>
        <div className="absolute top-4 right-4 font-rune text-xl text-[#d4af37] leading-none pointer-events-none select-none z-20">
          ┐
        </div>
        <div className="absolute bottom-4 left-4 font-rune text-xl text-[#d4af37] leading-none pointer-events-none select-none z-20">
          └
        </div>
        <div className="absolute bottom-4 right-4 font-rune text-xl text-[#d4af37] leading-none pointer-events-none select-none z-20">
          ┘
        </div>

        <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none select-none z-20">
          <span className="text-[#f5d77f]/80 tracking-widest text-[10px] font-rune bg-[#0b0716]/70 px-3 py-0.5 rounded-full border border-[#d4af37]/25">
            SCAN AREA // 1080P
          </span>
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover z-10",
            !isCameraActive && "hidden"
          )}
          data-testid="camera-video"
        />

        {imagePreviewUrl && (
          <img
            src={imagePreviewUrl}
            alt="Palm preview"
            className="absolute inset-0 w-full h-full object-contain bg-[#0b0716] z-10"
            data-testid="image-preview"
          />
        )}

        {isCameraActive && !imagePreviewUrl && (
          <div
            className="absolute top-12 inset-x-4 flex justify-center pointer-events-none select-none z-20"
            data-testid="hand-detection-feedback"
          >
            <div
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-md transition-all duration-300",
                handStatus === "HOLDING" || handStatus === "CAPTURED"
                  ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
                  : handStatus === "WRONG_HAND" ||
                    handStatus === "NOT_PALM" ||
                    handStatus === "ALIGN" ||
                    handStatus === "TOO_FAR" ||
                    handStatus === "TOO_CLOSE"
                  ? "bg-amber-950/90 text-amber-300 border border-amber-500/50"
                  : "bg-[#0b0716]/80 text-[#f7e7b4] border border-[#d4af37]/40"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  handStatus === "HOLDING" || handStatus === "CAPTURED"
                    ? "bg-emerald-400 animate-ping"
                    : handStatus === "SEARCHING"
                    ? "bg-[#d4af37] animate-pulse"
                    : "bg-amber-400"
                )}
              />
              <span>
                {isAutoCaptureEnabled ? handFeedback : "Chế độ chụp thủ công"}
              </span>
            </div>
          </div>
        )}

        {isCameraActive &&
          isAutoCaptureEnabled &&
          !imagePreviewUrl &&
          autoCaptureProgress > 0 && (
            <div className="absolute bottom-12 inset-x-12 z-20 pointer-events-none">
              <div className="w-full bg-[#0b0716]/80 rounded-full h-2 p-0.5 border border-emerald-500/50 overflow-hidden shadow-lg">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-green-300 h-full rounded-full transition-all duration-100"
                  style={{ width: `${autoCaptureProgress}%` }}
                  data-testid="auto-capture-progress"
                />
              </div>
            </div>
          )}

        {!imagePreviewUrl && (
          <svg
            className={cn(
              "w-[180px] h-[240px] pointer-events-none relative z-10 transition-colors duration-300",
              handStatus === "HOLDING" || handStatus === "CAPTURED"
                ? "drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                : "drop-shadow-[0_0_12px_rgba(212,175,55,0.4)]"
            )}
            fill="none"
            viewBox="0 0 180 240"
            xmlns="http://www.w3.org/2000/svg"
            data-testid="palm-wireframe"
          >
            <path
              d="M 46 175
                 C 38 160 22 135 15 120
                 C 10 110 14 100 24 104
                 C 35 109 50 128 58 136
                 C 57 115 54 62 55 45
                 C 56 36 67 36 68 45
                 C 70 60 72 100 73 108
                 C 74 90 75 32 78 18
                 C 80 8 91 8 92 18
                 C 94 36 94 92 95 108
                 C 98 90 102 44 106 32
                 C 108 24 119 25 120 34
                 C 122 55 120 102 120 118
                 C 124 106 131 75 137 68
                 C 142 62 152 66 150 76
                 C 145 98 138 140 137 165
                 C 135 195 126 230 118 238
                 L 60 238
                 C 52 230 48 200 46 175 Z"
              stroke={
                handStatus === "HOLDING" || handStatus === "CAPTURED"
                  ? "#22c55e"
                  : "#f5d77f"
              }
              strokeDasharray="4 4"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M 132 138 C 112 136 86 128 66 118"
              stroke="#fb7185"
              strokeOpacity="0.6"
              strokeDasharray="2 3"
              strokeWidth="1.2"
            />
            <path
              d="M 60 136 C 84 138 106 148 124 162"
              stroke="#c084fc"
              strokeOpacity="0.6"
              strokeDasharray="2 3"
              strokeWidth="1.2"
            />
            <path
              d="M 59 132 C 78 148 84 178 76 212"
              stroke="#f5d77f"
              strokeOpacity="0.6"
              strokeDasharray="2 3"
              strokeWidth="1.2"
            />
            <path
              d="M 85 155 L 95 155 M 90 150 L 90 160"
              stroke="#d4af37"
              strokeWidth="1.2"
            />
          </svg>
        )}

        <div className="absolute bottom-4 inset-x-6 flex justify-between items-center pointer-events-none select-none font-rune z-20">
          <span className="text-[#d4af37]/75 text-[10px]">FPS: 30.0</span>
          <span className="text-[#f7e7b4]/85 text-[10px]">ALIGN_CENTER</span>
          <span className="text-[#d4af37]/75 text-[10px]">ISO_AUTO</span>
        </div>
      </div>

      <p className="text-sm sm:text-base text-body mt-4 mb-4 leading-relaxed">
        Đủ sáng, xòe ngón tay, lòng bàn tay hướng thẳng camera.
      </p>

      {cameraError && (
        <p
          className="text-danger text-sm mb-4 p-3 rounded-xl bg-[#4c0519]/40 border border-danger/40"
          data-testid="camera-error"
        >
          [!] {cameraError}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="file-input"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {imageFile ? (
          <button
            type="button"
            onClick={handleRetake}
            className="btn-secondary !min-h-[38px] !px-5 text-sm"
            data-testid="retake-button"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
            <span>Chụp lại / Chọn lại</span>
          </button>
        ) : isCameraActive ? (
          <>
            <button
              type="button"
              onClick={capturePhoto}
              className="btn-primary !min-h-[38px] !px-5 text-sm"
              data-testid="shutter-button"
            >
              <Camera aria-hidden="true" className="h-4 w-4" />
              <span>Chụp ảnh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAutoCaptureEnabled(!isAutoCaptureEnabled)}
              className={cn(
                "btn-secondary !min-h-[38px] !px-4 text-sm inline-flex items-center gap-1.5",
                isAutoCaptureEnabled &&
                  "border-emerald-500/60 text-emerald-300 bg-emerald-950/30"
              )}
              data-testid="auto-capture-toggle"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4 text-emerald-400" />
              <span>Tự chụp: {isAutoCaptureEnabled ? "Bật" : "Tắt"}</span>
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="btn-secondary !min-h-[38px] !px-5 text-sm"
            >
              Đóng camera
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startCamera}
              className="btn-primary !min-h-[38px] !px-5 text-sm"
              data-testid="open-camera-button"
            >
              <Camera aria-hidden="true" className="h-4 w-4" />
              <span>Bật camera</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary !min-h-[38px] !px-5 text-sm"
              data-testid="upload-button"
            >
              <Upload aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
              <span>Chọn ảnh có sẵn</span>
            </button>
          </>
        )}
      </div>

      <div className="mb-6 p-3.5 rounded-xl bg-[#0b0716]/50 border border-hairline">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-1 accent-[#d4af37] h-4 w-4 rounded"
            data-testid="ai-consent-checkbox"
          />
          <span className="text-sm text-body leading-relaxed">
            Tôi đồng ý gửi ảnh lòng bàn tay cho hệ thống AI phân tích
          </span>
        </label>
      </div>

      {isOutOfCredits && (
        <div
          className="mb-6 p-4 border border-warning/60 bg-[#241842]/80 rounded-xl text-sm text-ink space-y-2"
          data-testid="insufficient-credits-banner"
        >
          <div className="font-bold flex items-center gap-1.5 text-warning">
            <span>[!]</span>
            <span>Hết credits</span>
          </div>
          <p className="m-0 text-body">
            Mời bạn bè nhập mã để nhận 2 credits:{" "}
            <Link
              to={BaseUrl.Referral}
              className="text-[#f7e7b4] underline hover:text-[#d4af37] font-medium"
            >
              Trang giới thiệu
            </Link>
          </p>
          {canEnterCode && (
            <p className="m-0 text-body">
              Có mã của bạn bè?{" "}
              <Link
                to={BaseUrl.ReferralEnter}
                className="text-[#f7e7b4] underline hover:text-[#d4af37] font-medium"
              >
                Nhập để nhận 1 credit
              </Link>
            </p>
          )}
        </div>
      )}

      {status === "REJECTED" && (
        <div
          className="mb-6 p-4 border border-danger/50 bg-[#4c0519]/35 rounded-xl text-sm text-ink space-y-2"
          data-testid="rejected-banner"
        >
          <div className="font-bold text-danger flex items-center gap-1">
            <span>[!] Không nhìn rõ lòng bàn tay</span>
          </div>
          <p className="m-0 text-body">
            {rejectReason || "Hãy chụp lại nơi đủ sáng, xoè thẳng bàn tay."}
          </p>
          <p className="m-0 text-success text-xs font-rune">
            [+] Đã hoàn 1 credit
          </p>
          <button
            type="button"
            onClick={handleRetake}
            className="mt-2 text-xs font-rune underline text-[#f7e7b4] hover:text-[#d4af37] cursor-pointer"
          >
            &gt; Chụp lại ảnh
          </button>
        </div>
      )}

      {status === "AI_UNAVAILABLE" && (
        <div
          className="mb-6 p-4 border border-warning/50 bg-[#241842]/80 rounded-xl text-sm text-ink space-y-2"
          data-testid="ai-unavailable-banner"
        >
          <div className="font-bold text-[#f7e7b4]">
            [!] Hệ thống bận, đã hoàn 1 credit. Thử lại sau ít phút.
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-xs font-rune underline text-[#f7e7b4] hover:text-[#d4af37] cursor-pointer"
            data-testid="retry-ai-button"
          >
            &gt; Thử lại lần xem mới
          </button>
        </div>
      )}

      {status === "NETWORK_ERROR" && (
        <div
          className="mb-6 p-4 border border-danger/50 bg-[#4c0519]/35 rounded-xl text-sm text-ink space-y-2"
          data-testid="network-error-banner"
        >
          <div className="font-bold text-danger">
            [!] Mất kết nối hoặc quá thời gian chờ.
          </div>
          {errorMessage && (
            <p className="m-0 text-body text-xs">{errorMessage}</p>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-xs font-rune underline text-[#f7e7b4] hover:text-[#d4af37] cursor-pointer"
            data-testid="retry-network-button"
          >
            &gt; Thử lại (cùng mã yêu cầu)
          </button>
        </div>
      )}

      {status === "LIMIT_REACHED" && (
        <div
          className="mb-6 p-4 border border-warning/60 bg-[#241842]/80 rounded-xl text-sm text-ink space-y-3"
          data-testid="limit-reached-banner"
        >
          <div className="font-bold flex items-center gap-1.5 text-warning">
            <span>[!]</span>
            <span>Hết lượt bói thử miễn phí</span>
          </div>
          <p className="m-0 text-body">
            {errorMessage ||
              "Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!"}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to={BaseUrl.Register}
              className="btn-primary !min-h-[34px] !px-4 text-xs font-semibold"
            >
              Đăng ký tài khoản
            </Link>
            <Link
              to={BaseUrl.Login}
              className="btn-secondary !min-h-[34px] !px-4 text-xs font-semibold"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      )}

      {status === "RATE_LIMITED" && (
        <div
          className="mb-6 p-4 border border-warning/60 bg-[#241842]/80 rounded-xl text-sm text-ink space-y-3"
          data-testid="rate-limited-banner"
        >
          <div className="font-bold flex items-center gap-1.5 text-warning">
            <span>[!]</span>
            <span>Đạt giới hạn lượt bói thử theo IP</span>
          </div>
          <p className="m-0 text-body">
            {errorMessage ||
              "Địa chỉ IP đã đạt tối đa 5 lượt bói thử hôm nay. Đăng ký tài khoản để tiếp tục bói không giới hạn."}
          </p>
          <div className="pt-1">
            <Link
              to={BaseUrl.Register}
              className="btn-primary !min-h-[34px] !px-4 text-xs font-semibold inline-flex items-center"
            >
              Đăng ký tài khoản
            </Link>
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit()}
          className={`w-full py-3.5 px-6 text-base font-bold rounded-full transition-all text-center flex items-center justify-center gap-2 ${
            canSubmit
              ? "btn-primary cursor-pointer"
              : "bg-[#1b1233] text-mute border border-hairline cursor-not-allowed opacity-55"
          }`}
          data-testid="submit-reading-button"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          <span>{user ? "Xem bói (−1 credit)" : "Bói thử miễn phí"}</span>
        </button>
      </div>
    </section>
  );
};

export default CaptureStep;
