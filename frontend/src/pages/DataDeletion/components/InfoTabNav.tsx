import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import type { InfoTab } from "../types";

interface InfoTabNavProps {
  activeTab: InfoTab;
  onTabChange?: (tab: InfoTab) => void;
}

export const InfoTabNav = ({ activeTab, onTabChange }: InfoTabNavProps) => {
  return (
    <nav
      aria-label="Điều hướng chính sách"
      className="flex flex-wrap border-b border-[#d4af37]/30 mb-8 gap-2 sm:gap-6 text-sm font-sans"
    >
      <Link
        to={BaseUrl.DataDeletion}
        onClick={() => onTabChange?.("deletion")}
        className={`px-4 py-3 -mb-px rounded-t-xl transition-all select-none ${
          activeTab === "deletion"
            ? "border-b-2 border-[#d4af37] bg-[#241842]/70 text-[#f7e7b4] font-semibold shadow-[0_0_15px_rgba(212,175,55,0.15)]"
            : "text-mute hover:text-[#f7e7b4] hover:bg-[#170f2c]/50"
        }`}
      >
        Xoá dữ liệu
      </Link>
      <Link
        to={BaseUrl.Terms}
        onClick={() => onTabChange?.("terms")}
        className={`px-4 py-3 -mb-px rounded-t-xl transition-all select-none ${
          activeTab === "terms"
            ? "border-b-2 border-[#d4af37] bg-[#241842]/70 text-[#f7e7b4] font-semibold shadow-[0_0_15px_rgba(212,175,55,0.15)]"
            : "text-mute hover:text-[#f7e7b4] hover:bg-[#170f2c]/50"
        }`}
      >
        Điều khoản
      </Link>
      <Link
        to={BaseUrl.Privacy}
        onClick={() => onTabChange?.("privacy")}
        className={`px-4 py-3 -mb-px rounded-t-xl transition-all select-none ${
          activeTab === "privacy"
            ? "border-b-2 border-[#d4af37] bg-[#241842]/70 text-[#f7e7b4] font-semibold shadow-[0_0_15px_rgba(212,175,55,0.15)]"
            : "text-mute hover:text-[#f7e7b4] hover:bg-[#170f2c]/50"
        }`}
      >
        Chính sách riêng tư
      </Link>
    </nav>
  );
};

export default InfoTabNav;
