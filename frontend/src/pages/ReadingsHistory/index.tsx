import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Sparkles } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import useReadingsQuery from "./hooks/useReadingsQuery";
import ReadingHistoryItem from "./components/ReadingHistoryItem";
import Loading from "@/components/ui/loading";

export const ReadingsHistory: React.FC = () => {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, isLoading, isError } = useReadingsQuery(cursor);

  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor;

  return (
    <main className="w-full min-h-[calc(100vh-72px)] py-8 sm:py-12 text-ink">
      <div className="max-w-[1100px] mx-auto px-4">
        <div className="w-full pb-4 mb-6 border-b border-hairline flex flex-wrap items-end justify-between gap-4">
          <div>
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-1"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Sổ Thiên Mệnh · Lưu Trữ Quẻ Bói
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-[#f7e7b4] font-bold tracking-tight text-left m-0">
              Lịch sử xem bói
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to={BaseUrl.Scan}
              className="btn-primary !min-h-[38px] !px-5 text-xs sm:text-sm"
              data-testid="new-reading-btn"
            >
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              <span>+ Xem bói mới</span>
            </Link>
            <span className="text-xs text-[#d4af37]/75 uppercase tracking-widest font-rune hidden sm:inline">
              ✦ {items.length} quẻ đã lưu
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <Loading className="h-8 w-8 text-[#d4af37]" />
          </div>
        ) : isError ? (
          <div className="py-12 text-center font-rune text-danger mystic-card rounded-2xl">
            [!] Không thể tải lịch sử xem bói. Vui lòng thử lại sau.
          </div>
        ) : items.length === 0 ? (
          <div
            className="relative w-full py-16 px-6 text-center mystic-card rounded-2xl my-6"
            data-testid="empty-readings"
          >
            <TarotCorners />
            <p className="text-body text-base mb-5">
              Chưa có lần xem bói nào trong lịch sử.
            </p>
            <Link to={BaseUrl.Scan} className="btn-primary text-sm">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              <span>Bắt đầu xem bói</span>
            </Link>
          </div>
        ) : (
          <div className="relative mystic-card rounded-2xl p-4 sm:p-6 overflow-hidden">
            <TarotCorners />
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse table-fixed">
                <thead>
                  <tr className="h-11">
                    <th className="w-[80px] text-xs uppercase tracking-wider text-[#d4af37] font-semibold p-0 align-middle text-left font-rune">
                      Trường phái
                    </th>
                    <th className="w-[220px] text-xs uppercase tracking-wider text-[#d4af37] font-semibold p-0 align-middle text-left font-rune">
                      Lần xem
                    </th>
                    <th className="w-[340px] text-xs uppercase tracking-wider text-[#d4af37] font-semibold p-0 align-middle text-left font-rune">
                      Tóm tắt
                    </th>
                    <th className="w-[150px] text-xs uppercase tracking-wider text-[#d4af37] font-semibold p-0 align-middle text-left font-rune">
                      Ngày
                    </th>
                    <th className="w-[178px] text-xs uppercase tracking-wider text-[#d4af37] font-semibold p-0 align-middle text-left font-rune">
                      Trạng thái
                    </th>
                  </tr>
                  <tr>
                    <td className="p-0" colSpan={5}>
                      <div className="w-full h-px bg-hairline" />
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <ReadingHistoryItem key={item.id} item={item} />
                  ))}
                </tbody>
              </table>

              {nextCursor && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setCursor(nextCursor)}
                    className="btn-secondary !min-h-[36px] !px-6 text-sm"
                    data-testid="load-more-btn"
                  >
                    Tải thêm
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default ReadingsHistory;
