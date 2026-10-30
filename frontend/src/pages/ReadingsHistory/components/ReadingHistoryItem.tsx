import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ReadingListItemDto,
  ReadingStatus,
  ReadingSchool,
  HandOrientation,
  READING_SCHOOLS,
  getTopicLabel,
} from "@palmsight/shared";
import { format } from "date-fns";

interface ReadingHistoryItemProps {
  item: ReadingListItemDto;
}

export const ReadingHistoryItem: React.FC<ReadingHistoryItemProps> = ({
  item,
}) => {
  const navigate = useNavigate();

  const isDone = item.status === ReadingStatus.DONE;
  const schoolConfig = READING_SCHOOLS[item.school];
  const rawName = schoolConfig?.name.replace("Chỉ tay ", "") ?? item.school;
  const schoolName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const handLabel =
    item.hand === HandOrientation.LEFT ? "Tay trái" : "Tay phải";

  const totalSections = schoolConfig?.sections?.length ?? 0;
  const isAll =
    !item.topics ||
    item.topics.length === 0 ||
    item.topics.length >= totalSections + 6;

  const topicsBadge = isAll ? "Toàn bộ" : `${item.topics.length} mục`;

  let formattedDate = "";
  try {
    formattedDate = format(new Date(item.createdAt), "dd/MM/yyyy HH:mm");
  } catch {
    formattedDate = item.createdAt;
  }

  const handleClick = () => {
    if (isDone) {
      navigate(`/readings/${item.id}`);
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case ReadingStatus.DONE:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#0b0716]/70 border border-success/40 text-xs text-success font-rune">
            [+] Xong
          </span>
        );
      case ReadingStatus.REJECTED:
        return (
          <span className="text-xs text-danger block leading-normal font-rune">
            [!] Ảnh không rõ · đã hoàn 1 credit
          </span>
        );
      case ReadingStatus.FAILED:
        return (
          <span className="text-xs text-danger block leading-normal font-rune">
            [!] Hệ thống bận · đã hoàn 1 credit
          </span>
        );
      case ReadingStatus.PROCESSING:
        return (
          <span className="text-xs text-[#d4af37] block leading-normal font-rune animate-pulse">
            [...] Đang xử lý
          </span>
        );
      default:
        return null;
    }
  };

  const getSchoolShortTag = () => {
    switch (item.school) {
      case ReadingSchool.WESTERN:
        return "TÂY";
      case ReadingSchool.EASTERN:
        return "ĐÔNG";
      case ReadingSchool.VEDIC:
        return "ẤN";
      default:
        return "PALM";
    }
  };

  return (
    <tr
      onClick={handleClick}
      className={`border-b border-hairline/60 transition-colors ${
        isDone ? "hover:bg-[#241842]/50 cursor-pointer" : ""
      }`}
      data-testid={`reading-item-${item.id}`}
    >
      <td className="w-[80px] py-4 pr-4 align-top">
        <div
          className="w-[56px] h-[56px] rounded-xl bg-gradient-to-br from-[#2c1d4f] to-[#0b0716] border border-[#d4af37]/45 flex flex-col items-center justify-center font-rune select-none text-center shadow-[0_0_12px_rgba(212,175,55,0.15)]"
          title={schoolConfig?.name}
        >
          <span className="text-[11px] font-bold text-[#f7e7b4] tracking-wider">
            [{getSchoolShortTag()}]
          </span>
          <span className="text-[9px] text-[#d4af37]/75 uppercase tracking-tighter">
            SYS::LOG
          </span>
        </div>
      </td>

      <td className="w-[220px] py-4 pr-4 align-top">
        <span className="text-base text-[#f7e7b4] font-semibold block">
          {schoolName} · {handLabel} · {topicsBadge}
        </span>
        {!isAll && item.topics && item.topics.length > 0 && (
          <span className="text-xs text-mute block mt-1 font-sans line-clamp-1">
            {item.topics.map((t) => getTopicLabel(t, item.school)).join(", ")}
          </span>
        )}
      </td>

      <td className="w-[340px] py-4 pr-6 align-top">
        {item.summary ? (
          <p className="text-sm sm:text-base text-body leading-relaxed m-0 text-left line-clamp-2">
            {item.summary}
          </p>
        ) : (
          <span className="text-base text-mute block">—</span>
        )}
      </td>

      <td className="w-[150px] py-4 pr-4 align-top">
        <span className="text-mute block font-rune text-xs">
          {formattedDate}
        </span>
      </td>

      <td className="w-[178px] py-4 align-top">{getStatusBadge()}</td>
    </tr>
  );
};

export default ReadingHistoryItem;
