import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, RefreshCcw } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import { READING_SCHOOLS, HandOrientation } from "@palmsight/shared";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import readingsService from "@/services/readingsService";
import PalmViewer from "@/components/palm/PalmViewer";
import CountdownBanner from "./components/CountdownBanner";
import PreviewSections from "./components/PreviewSections";
import PreviewAspectsAdvice from "./components/PreviewAspectsAdvice";
import StickyUnlockCard from "./components/StickyUnlockCard";
import PreviewSkeleton from "./components/PreviewSkeleton";

export const GuestReadingPreview: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const {
    data: preview,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["guest-reading-preview", token],
    queryFn: () => readingsService.getGuestReadingPreview(token || ""),
    enabled: Boolean(token),
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 1;
    },
  });

  if (isLoading) {
    return <PreviewSkeleton />;
  }

  if (isError || !preview) {
    const is404 = (error as any)?.response?.status === 404;
    return (
      <main className="w-full min-h-[calc(100vh-72px)] py-16 px-4 text-center text-ink flex items-center justify-center">
        <div className="relative max-w-[500px] w-full mystic-card p-8 rounded text-center">
          <TarotCorners />
          <div className="text-terminal-danger font-rune text-sm font-bold mb-3">
            [!] {is404 ? "KHÔNG TÌM THẤY BẢN XEM TRƯỚC" : "LỖI KẾT NỐI MÁY CHỦ"}
          </div>
          <h1 className="font-display text-2xl font-bold text-[#f7e7b4] mb-3">
            {is404
              ? "Bài bói đã hết hạn hoặc không tồn tại"
              : "Không thể tải kết quả bài bói"}
          </h1>
          <p className="text-body text-sm mb-6 leading-relaxed">
            {is404
              ? "Bản xem trước bài bói thử chỉ lưu trữ trong 7 ngày. Hãy tạo quẻ bói mới để tiếp tục!"
              : "Đã có sự cố gián đoạn khi kết nối đến đài chiêm tinh. Vui lòng bấm thử lại."}
          </p>
          <div className="flex justify-center gap-3">
            {is404 ? (
              <Link to={BaseUrl.Scan} className="btn-primary text-sm px-6 py-2.5">
                Bói quẻ mới
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => refetch()}
                className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCcw className="h-4 w-4" />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const schoolConfig = READING_SCHOOLS[preview.school];
  const schoolName = schoolConfig?.name ?? preview.school;
  const handName =
    preview.hand === HandOrientation.LEFT ? "Tay trái" : "Tay phải";
  const hasVisuals = Boolean(
    preview.imageUrl ||
      preview.annotatedImageUrl ||
      (preview.palmLines && preview.palmLines.length > 0)
  );

  return (
    <main className="w-full min-h-[calc(100vh-72px)] py-8 sm:py-12 text-ink">
      <div className="max-w-[1000px] mx-auto px-4">
        <h1 className="sr-only">Bản xem trước kết quả bói chỉ tay</h1>
        <CountdownBanner expiresAt={preview.previewExpiresAt} />

        <div className="relative mystic-card rounded p-6 sm:p-9 flex flex-col text-left">
          <TarotCorners />

          <div className="text-xs sm:text-sm text-[#d4af37] pb-4 border-b border-hairline flex flex-wrap justify-between items-center gap-2 select-none font-rune">
            <span className="inline-flex items-center gap-2 font-bold tracking-wide">
              <ScrollText aria-hidden="true" className="h-4 w-4" />
              <span>PALMSIGHT // GUEST PREVIEW</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded bg-[#241842] border border-[#d4af37]/40 text-[#f7e7b4]">
                {schoolName}
              </span>
              <span className="px-3 py-0.5 rounded bg-[#140d26] border border-hairline text-mute">
                {handName}
              </span>
            </div>
          </div>

          {hasVisuals && (
            <div
              className="mt-6"
              data-testid="guest-preview-palm-viewer"
            >
              <PalmViewer
                imageUrl={preview.imageUrl}
                annotatedImageUrl={preview.annotatedImageUrl}
                palmLines={preview.palmLines}
                hand={preview.hand}
                school={preview.school}
                sections={preview.sections}
                compact
              />
            </div>
          )}

          {preview.summary && (
            <div
              className="mt-6 p-5 sm:p-6 rounded bg-[#140d26]/85 border border-[#d4af37]/30"
              data-testid="preview-summary-card"
            >
              <div className="flex items-center gap-2 mb-3">
                <ScrollText aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
                <h2 className="font-display text-xl sm:text-2xl text-[#f7e7b4] font-bold m-0">
                  Tổng quan năng lượng lòng bàn tay
                </h2>
              </div>
              <p className="text-body text-base leading-relaxed m-0 whitespace-pre-line">
                {preview.summary}
              </p>
            </div>
          )}

          <PreviewSections sections={preview.sections} />

          <PreviewAspectsAdvice
            aspects={preview.aspects}
            advice={preview.advice}
          />

          {preview.disclaimer && (
            <p
              className="text-xs text-mute/80 italic mt-8 pt-4 border-t border-hairline text-center select-none"
              data-testid="preview-disclaimer"
            >
              {preview.disclaimer}
            </p>
          )}

          <StickyUnlockCard claimToken={token || ""} />
        </div>
      </div>
    </main>
  );
};

export default GuestReadingPreview;
