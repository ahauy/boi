import { ScrollText } from "lucide-react";

export const TermsContent = () => {
  return (
    <article className="w-full text-left font-sans">
      <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2">
        <ScrollText aria-hidden="true" className="h-3.5 w-3.5" />
        <span>Ước Giao Huyền Môn</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient leading-tight mb-2 tracking-normal">
        Điều khoản dịch vụ
      </h1>
      <div className="text-xs sm:text-sm text-mute mb-6 font-rune">Cập nhật: 15/10/2026</div>

      <p className="text-base text-body leading-relaxed mb-8 p-4 rounded-xl bg-[#0b0716]/55 border border-[#d4af37]/25">
        Chào mừng bạn đến với PalmSight. Vui lòng đọc kỹ các điều khoản dưới đây trước khi trải nghiệm ứng dụng.
      </p>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Mục đích giải trí</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed m-0">
          Toàn bộ kết quả bói toán và phân tích đường chỉ tay trên PalmSight được tạo tự động bởi mô hình trí tuệ nhân tạo và chỉ mang tính chất tham khảo, giải trí. Kết quả này hoàn toàn không có giá trị thay thế cho các lời khuyên, chẩn đoán hay tư vấn chuyên môn về y tế, pháp lý, tài chính hoặc tâm lý học.
        </p>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Tài khoản người dùng</span>
        </h2>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Mỗi cá nhân chỉ được tạo và sở hữu một tài khoản chính chủ.</span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Nghiêm cấm hành vi lợi dụng công cụ tự động hoặc tạo tài khoản ảo để gian lận credits.</span>
        </div>
        <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Bạn có trách nhiệm bảo mật mật khẩu và thông tin đăng nhập của mình.</span>
        </div>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Chính sách Credits</span>
        </h2>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Mỗi lượt luận giải chỉ tay tiêu tốn chính xác 1 credit.</span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>Credits khuyến mãi (khi đăng ký hoặc qua mã giới thiệu) không có giá trị quy đổi tiền mặt.</span>
        </div>
        <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>PalmSight có toàn quyền thu hồi credits thu được bất chính hoặc vi phạm điều khoản.</span>
        </div>
      </section>

      <section className="p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Quyền sở hữu trí tuệ</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed m-0">
          Giao diện huyền học, mã nguồn, phong cách mỹ thuật và toàn bộ nội dung hiển thị thuộc bản quyền độc quyền của PalmSight. Mọi hành vi sao chép, thu thập hoặc khai thác thương mại khi chưa được sự đồng ý bằng văn bản đều bị nghiêm cấm.
        </p>
      </section>
    </article>
  );
};

export default TermsContent;
