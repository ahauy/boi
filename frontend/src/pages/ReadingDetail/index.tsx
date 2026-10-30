import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Sparkles, ScrollText, Compass } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import {
  READING_SCHOOLS,
  ImageQuality,
  getTopicLabel,
} from "@palmsight/shared";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import ReadingHeader from "./components/ReadingHeader";
import SectionBlock from "./components/SectionBlock";
import AspectsBlock from "./components/AspectsBlock";
import DeleteModal from "./components/DeleteModal";
import useReadingDetailQuery, {
  useDeleteReadingMutation,
} from "./hooks/useReadingDetailQuery";
import Loading from "@/components/ui/loading";

export const ReadingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: reading, isLoading, isError, error } = useReadingDetailQuery(id);
  const { mutateAsync: deleteReading, isPending: isDeleting } =
    useDeleteReadingMutation();

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteReading(id);
      setIsDeleteOpen(false);
      navigate(BaseUrl.Readings);
    } catch {
      return;
    }
  };

  if (isLoading) {
    return (
      <main className="w-full min-h-[calc(100vh-72px)] flex items-center justify-center p-8">
        <Loading className="h-8 w-8 text-[#d4af37]" />
      </main>
    );
  }

  if (isError || !reading) {
    const is404 = (error as any)?.response?.status === 404;
    return (
      <main className="w-full min-h-[calc(100vh-72px)] py-16 px-4 text-center">
        <div className="relative max-w-[480px] mx-auto mystic-card p-8 rounded-2xl">
          <TarotCorners />
          <h2 className="font-display text-2xl text-danger font-bold mb-2">
            [!] {is404 ? "Không tìm thấy lần xem bói" : "Lỗi tải dữ liệu"}
          </h2>
          <p className="text-body mb-6">
            {is404
              ? "Lần xem bói này không tồn tại hoặc đã bị xoá."
              : "Đã có lỗi xảy ra khi tải kết quả xem bói."}
          </p>
          <Link to={BaseUrl.Readings} className="btn-primary text-sm">
            Quay lại Lịch sử
          </Link>
        </div>
      </main>
    );
  }

  const result = reading.result;
  const schoolConfig = READING_SCHOOLS[reading.school];
  const schoolName = schoolConfig?.name ?? reading.school;
  const isPoorQuality = result?.imageQuality === ImageQuality.POOR;
  const totalSections = schoolConfig?.sections?.length ?? 0;
  const isAll =
    !reading.topics ||
    reading.topics.length === 0 ||
    reading.topics.length >= totalSections + 6;

  return (
    <main className="w-full min-h-[calc(100vh-72px)] py-10 sm:py-12 text-ink">
      <div className="max-w-[1100px] mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          <ReadingHeader
            reading={reading}
            onOpenDelete={() => setIsDeleteOpen(true)}
          />

          <div className="relative w-full flex-1 mystic-card rounded-2xl p-6 sm:p-9 flex flex-col text-left">
            <TarotCorners />

            <div className="text-xs sm:text-sm text-[#d4af37] pb-4 border-b border-hairline flex justify-between items-center select-none font-rune">
              <span className="inline-flex items-center gap-2 font-bold">
                <ScrollText aria-hidden="true" className="h-4 w-4" />
                <span>Luận Giải Chi Tiết</span>
              </span>
              <span className="px-3 py-0.5 rounded-full bg-[#241842] border border-[#d4af37]/40 text-[#f7e7b4]">
                {schoolName}
              </span>
            </div>

            {isPoorQuality && (
              <div
                className="mt-5 p-3.5 bg-[#241842]/90 border border-warning/60 text-warning text-xs sm:text-sm font-rune rounded-xl"
                data-testid="poor-quality-warning"
              >
                [!] Ảnh hơi mờ, kết quả có thể chưa chính xác.
              </div>
            )}

            {!isAll && reading.topics && reading.topics.length > 0 && (
              <div
                className="mt-5 py-3 px-4 mb-2 bg-[#0b0716]/60 border border-hairline rounded-xl text-xs flex flex-wrap items-center gap-2"
                data-testid="selected-topics-banner"
              >
                <span className="text-[#d4af37] font-semibold">
                  Mục đã chọn:
                </span>
                {reading.topics.map((key) => (
                  <span
                    key={key}
                    className="px-2.5 py-0.5 bg-[#241842] border border-[#d4af37]/35 rounded-full text-[#f7e7b4] font-sans text-xs font-medium"
                  >
                    {getTopicLabel(key, reading.school)}
                  </span>
                ))}
              </div>
            )}

            {result?.summary && (
              <section
                className="mt-6 p-5 sm:p-6 rounded-xl bg-gradient-to-br from-[#2c1d4f]/70 via-[#1b1233]/80 to-[#0b0716]/80 border border-[#d4af37]/45 text-left shadow-[0_0_25px_rgba(212,175,55,0.12)]"
                data-testid="reading-summary-section"
              >
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[#d4af37]/30">
                  <Sparkles
                    aria-hidden="true"
                    className="h-4 w-4 text-[#d4af37]"
                  />
                  <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] font-bold m-0">
                    Tóm tắt
                  </h3>
                </div>
                <p className="text-base sm:text-lg text-ink leading-relaxed m-0">
                  {result.summary}
                </p>
              </section>
            )}

            <SectionBlock sections={result?.sections} />

            <AspectsBlock aspects={result?.aspects} />

            {result?.advice && (
              <section
                className="mt-6 p-5 sm:p-6 rounded-xl bg-gradient-to-r from-[#241842]/90 to-[#140d26]/90 border border-[#d4af37]/50 text-left"
                data-testid="reading-advice-section"
              >
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-hairline">
                  <Compass
                    aria-hidden="true"
                    className="h-4 w-4 text-[#d4af37]"
                  />
                  <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] font-bold m-0">
                    Lời khuyên
                  </h3>
                </div>
                <p className="text-base text-body leading-relaxed m-0">
                  {result.advice}
                </p>
              </section>
            )}

            <div
              className="mt-8 border border-[#d4af37]/30 bg-[#0b0716]/60 rounded-xl p-4 font-rune text-left"
              data-testid="reading-disclaimer"
            >
              <p className="text-xs sm:text-sm text-mute m-0">
                [i]{" "}
                {result?.disclaimer ||
                  "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </main>
  );
};

export default ReadingDetail;
