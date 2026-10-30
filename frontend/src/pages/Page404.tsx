import React from "react";
import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";

const Page404 = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center font-sans text-ink">
      <div className="mystic-card rounded-2xl p-10 sm:p-14 max-w-lg w-full relative overflow-hidden flex flex-col items-center">
        <TarotCorners />
        <div className="text-xs font-mono uppercase tracking-[0.25em] text-gold mb-2">
          ✦ Lạc Giữa Tinh Không ✦
        </div>
        <h1 className="text-6xl sm:text-7xl font-display font-bold text-gold-gradient leading-tight mb-2">
          404
        </h1>
        <span className="font-display font-bold text-xl text-gold-light mb-2">
          Oops! Không tìm thấy trang
        </span>
        <p className="text-center text-mute max-w-md text-sm mb-8 leading-relaxed">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển sang chiều không gian khác.
        </p>
        <Link
          to={BaseUrl.Homepage}
          className="btn-primary h-10 px-6 text-sm inline-flex items-center justify-center"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
};

export default React.memo(Page404);
