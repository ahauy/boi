import { Sparkles } from "lucide-react";

export const RegisterHeader = () => {
  return (
    <section className="w-full md:w-[360px] md:pr-10">
      <div
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Khởi Tạo Duyên Mệnh</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#f7e7b4] leading-tight mb-3 tracking-normal">
        Tạo tài khoản
      </h1>
      <p className="text-base text-body mb-8">
        Xác thực email để nhận 3 credits.
      </p>

      <div className="space-y-3 border-t border-hairline pt-5">
        <div className="p-3 rounded-xl bg-[#0b0716]/60 border border-hairline/70 text-sm sm:text-base text-body flex items-center">
          <span className="font-bold text-[#d4af37] mr-2.5 font-rune">[+]</span>
          <span>1 lần xem bói = 1 credit</span>
        </div>
        <div className="p-3 rounded-xl bg-[#0b0716]/60 border border-hairline/70 text-sm sm:text-base text-body flex items-center">
          <span className="font-bold text-[#d4af37] mr-2.5 font-rune">[+]</span>
          <span>Chọn phương Tây, phương Đông hoặc Ấn Độ</span>
        </div>
        <div className="p-3 rounded-xl bg-[#0b0716]/60 border border-hairline/70 text-sm sm:text-base text-body flex items-center">
          <span className="font-bold text-[#d4af37] mr-2.5 font-rune">[+]</span>
          <span>Xoá ảnh và dữ liệu bất cứ lúc nào</span>
        </div>
      </div>
    </section>
  );
};

export default RegisterHeader;
