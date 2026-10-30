import { Compass, Camera, ScrollText } from "lucide-react";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const HowItWorksSection = () => {
  const steps = [
    {
      roman: "I",
      icon: Compass,
      title: "Chọn trường phái",
      desc: "Phương Tây, phương Đông hoặc Ấn Độ.",
      lore: "Định vị hệ quy chiếu huyền học phù hợp với trực giác của bạn.",
    },
    {
      roman: "II",
      icon: Camera,
      title: "Chụp lòng bàn tay",
      desc: "Bằng camera hoặc ảnh có sẵn.",
      lore: "Thấu kính AI quét đường chỉ, gò bàn tay và dấu ấn thiên mệnh.",
    },
    {
      roman: "III",
      icon: ScrollText,
      title: "Nhận bài bói",
      desc: "Quan sát, ý nghĩa và lời khuyên.",
      lore: "Bản luận giải chi tiết từng đường chỉ và lời khuyên ứng xử.",
    },
  ];

  return (
    <section
      id="cach-hoat-dong"
      className="max-w-[1100px] mx-auto px-4 mt-20 sm:mt-24 pt-8 hairline-top text-left scroll-mt-20 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
        <div>
          <span
            aria-hidden="true"
            className="text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold block mb-1"
          >
            ✦ Nghi Thức Khai Mở ✦
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Cách hoạt động
          </h2>
        </div>
        <p aria-hidden="true" className="text-sm text-mute">
          Ba bước kết nối cổ thư tướng số và trí tuệ nhân tạo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => {
          const IconComponent = step.icon;
          return (
            <div
              key={step.title}
              className="relative mystic-card-interactive rounded-xl p-6 flex flex-col justify-between"
            >
              <TarotCorners />
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d4af37]/50 bg-[#0b0716]/80 text-[#f5d77f] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <span
                    aria-hidden="true"
                    className="font-display text-2xl font-bold text-[#d4af37]/40 tracking-widest"
                  >
                    {step.roman}
                  </span>
                </div>

                <div className="text-lg font-bold text-[#f7e7b4] mb-1.5">
                  <span>[+] {step.title}</span>
                </div>
                <div className="text-base text-body font-medium mb-2">
                  {step.desc}
                </div>
                <p aria-hidden="true" className="text-xs text-mute leading-relaxed">
                  {step.lore}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HowItWorksSection;
