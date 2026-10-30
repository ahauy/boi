import { ShieldCheck } from "lucide-react";

export const PrivacyContent = () => {
  return (
    <article className="w-full text-left font-sans">
      <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2">
        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
        <span>Ấn Mật Bảo Hộ</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient leading-tight mb-2 tracking-normal">
        Chính sách riêng tư
      </h1>
      <div className="text-xs sm:text-sm text-mute mb-6 font-rune">Cập nhật: 15/10/2026</div>

      <p className="text-base text-body leading-relaxed mb-8 p-4 rounded-xl bg-[#0b0716]/55 border border-[#d4af37]/25">
        PalmSight cam kết bảo vệ dữ liệu cá nhân của người dùng một cách minh bạch, an toàn và có trách nhiệm.
      </p>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Chính sách không lưu trữ ảnh lòng bàn tay</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed">
          Chúng tôi tuân thủ nguyên tắc quyền riêng tư theo kiến trúc ADR-0010: máy chủ PalmSight{" "}
          <strong className="text-[#f7e7b4]">hoàn toàn không lưu trữ ảnh lòng bàn tay</strong> của bạn. Khi bạn tải ảnh lên:
        </p>
        <div className="mt-3">
          <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
            <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
            <span>Mọi siêu dữ liệu EXIF (vị trí địa lý GPS, dòng máy, thời gian chụp) đều bị xoá bỏ hoàn toàn.</span>
          </div>
          <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
            <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
            <span>Ảnh chỉ được đưa vào bộ nhớ tạm (RAM) để gửi qua API được mã hóa an toàn tới engine AI.</span>
          </div>
          <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
            <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
            <span>Sau khi AI hoàn tất luận giải, dữ liệu ảnh tạm trên RAM bị giải phóng ngay lập tức.</span>
          </div>
        </div>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Dữ liệu chúng tôi thu thập</span>
        </h2>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Thông tin tài khoản: Địa chỉ email, tên người dùng, tên hiển thị.</span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Nội dung văn bản kết quả bói toán (chỉ bạn mới có quyền xem trong mục Lịch sử).</span>
        </div>
        <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Nhật ký giao dịch credits và mã giới thiệu liên kết.</span>
        </div>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Chia sẻ thông tin với bên thứ ba</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed m-0">
          PalmSight không bán, cho thuê hoặc chia sẻ dữ liệu cá nhân cho bên thứ ba vì mục đích quảng cáo. Hình ảnh lòng bàn tay chỉ được chuyển tiếp tạm thời tới nhà cung cấp mô hình trí tuệ nhân tạo (Google Gemini hoặc Groq) qua API để sinh kết quả luận giải, tuân thủ các điều khoản bảo mật của nhà cung cấp.
        </p>
      </section>

      <section className="p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Lưu trữ mã băm định danh đã xoá (ADR-0009)</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed m-0">
          Sau khi tài khoản được xoá theo yêu cầu của bạn, toàn bộ dữ liệu cá nhân sẽ bị xoá vĩnh viễn trong 30 ngày. Chúng tôi chỉ giữ lại một chuỗi mã băm một chiều bảo mật (HMAC-SHA256) của email/ID đăng nhập để ngăn chặn việc nhận lại khuyến mãi đăng ký và mã giới thiệu nhiều lần. Chuỗi băm này không thể giải mã ngược để biết email hoặc danh tính thực của bạn.
        </p>
      </section>
    </article>
  );
};

export default PrivacyContent;
