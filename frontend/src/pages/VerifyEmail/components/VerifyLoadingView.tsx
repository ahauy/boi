import { TarotCorners } from "@/components/mystic/MysticDivider";

export const VerifyLoadingView = () => {
  return (
    <div
      data-testid="verify-loading"
      className="relative flex flex-col items-start gap-3 mystic-card rounded-2xl p-6 sm:p-10 overflow-hidden"
    >
      <TarotCorners />
      <div className="flex items-center gap-3 text-[#f7e7b4] text-lg sm:text-xl font-display font-bold relative z-10">
        <span className="animate-spin text-[#d4af37] font-rune">[✦]</span>
        <span>Đang xác thực email và kích hoạt tài khoản...</span>
      </div>
      <p className="text-sm text-mute relative z-10">Vui lòng chờ trong giây lát.</p>
    </div>
  );
};

export default VerifyLoadingView;
