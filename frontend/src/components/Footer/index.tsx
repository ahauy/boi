import BaseUrl from "@/consts/baseUrl";
import PwaInstallButton from "@/components/PwaInstallButton";

const Footer = () => {
  return (
    <footer className="relative z-10 w-full bg-[#080510]/90 backdrop-blur-md border-t border-hairline py-8 sm:py-10 mt-auto text-ink">
      <div className="w-full max-w-[92%] 2xl:max-w-[1536px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-mute">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-[#d4af37] text-base">
            ☽
          </span>
          <p>Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.</p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm">
          <a
            href={BaseUrl.Privacy}
            className="text-mute hover:text-[#f7e7b4] underline decoration-[#d4af37]/40 underline-offset-4 transition-colors"
          >
            Chính sách riêng tư
          </a>
          <a
            href={BaseUrl.Terms}
            className="text-mute hover:text-[#f7e7b4] underline decoration-[#d4af37]/40 underline-offset-4 transition-colors"
          >
            Điều khoản
          </a>
          <a
            href={BaseUrl.DataDeletion}
            className="text-mute hover:text-[#f7e7b4] underline decoration-[#d4af37]/40 underline-offset-4 transition-colors"
          >
            Xoá dữ liệu
          </a>
          <PwaInstallButton />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span aria-hidden="true" className="text-xs tracking-widest text-[#d4af37]/70">
            ✦ ☼ ✦
          </span>
          <p className="shrink-0 font-display font-bold tracking-widest text-[#f5e6c8]">
            © PALMSIGHT
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
