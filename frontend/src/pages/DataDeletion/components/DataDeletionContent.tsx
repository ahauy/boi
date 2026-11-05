import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";

export const DataDeletionContent = () => {
  return (
    <article className="w-full text-left font-sans">
      <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        <span>Quyền Tự Quyết Dữ Liệu</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient leading-tight mb-2 tracking-normal">
        Xoá dữ liệu của bạn
      </h1>
      <div className="text-xs sm:text-sm text-mute mb-6 font-rune">Cập nhật: 15/10/2026</div>

      <p className="text-base text-body leading-relaxed mb-8 p-4 rounded-xl bg-[#0b0716]/55 border border-[#d4af37]/25">
        Bạn có quyền yêu cầu xoá tài khoản và toàn bộ dữ liệu cá nhân liên quan bất cứ lúc nào.
      </p>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Quy trình yêu cầu xoá (Thủ công qua email)</span>
        </h2>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>
            Gửi email từ chính địa chỉ email của tài khoản tới:{" "}
            <strong className="text-[#f7e7b4]">palmsight.app@gmail.com</strong>.
          </span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>
            Tiêu đề email:{" "}
            <code className="text-xs sm:text-sm bg-[#241842] border border-[#d4af37]/30 px-2 py-0.5 rounded text-[#f7e7b4] font-rune">
              [Yêu cầu xoá dữ liệu] - &lt;email của bạn&gt;
            </code>
          </span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>
            Đối với tài khoản chỉ đăng nhập Facebook (không có email): Vào mục{" "}
            <strong className="text-[#f7e7b4]">Tài khoản</strong>, bấm sao chép{" "}
            <strong className="text-[#f7e7b4]">ID tài khoản</strong> và gửi kèm trong email để đội ngũ kỹ thuật đối soát.
          </span>
        </div>
        <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
          <span>
            Ứng dụng <strong className="text-[#f7e7b4]">không có nút tự xoá tài khoản</strong>. Mục Hồ sơ trong ứng dụng chỉ mở trang này, nhằm bảo vệ dữ liệu và ngăn ngừa việc lợi dụng vòng xoá – tạo tài khoản.
          </span>
        </div>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Thời gian xử lý</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed m-0">
          Đội ngũ kỹ thuật PalmSight sẽ tiếp nhận, xác minh danh tính và hoàn tất xoá dữ liệu trong vòng{" "}
          <strong className="text-[#f7e7b4]">30 ngày</strong> kể từ khi nhận được yêu cầu hợp lệ.
        </p>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Những gì bị xoá vĩnh viễn</span>
        </h2>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[-]</span>
          <span>Lịch sử các bài bói và toàn bộ kết quả luận giải chi tiết.</span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[-]</span>
          <span>Tên hiển thị, tên đăng nhập, địa chỉ email, ảnh đại diện.</span>
        </div>
        <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[-]</span>
          <span>Mật khẩu và thông tin xác thực danh tính.</span>
        </div>
        <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
          <span className="font-bold font-rune text-[#d4af37] shrink-0">[-]</span>
          <span>Mọi phiên đăng nhập trên toàn bộ thiết bị (thu hồi token ngay lập tức).</span>
        </div>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Ảnh lòng bàn tay</span>
        </h2>
        <p className="text-sm sm:text-base text-body leading-relaxed mb-3">
          Toàn bộ siêu dữ liệu EXIF, gồm vị trí GPS, bị xoá khỏi ảnh trước khi xử lý.
        </p>
        <p className="text-sm sm:text-base text-body leading-relaxed mb-3">
          Ảnh của lần xem thành công được lưu trên Cloudinary cho tới khi bạn{" "}
          <strong className="text-[#f7e7b4]">xoá lần xem đó hoặc xoá tài khoản</strong>. Ảnh của lần xem bị từ chối hoặc lỗi không được lưu.
        </p>
        <p className="text-sm sm:text-base text-body leading-relaxed m-0">
          Khi xoá tài khoản, chúng tôi xoá ảnh lòng bàn tay và ảnh đại diện của bạn.
        </p>
      </section>

      <section className="p-5 rounded-xl bg-[#0b0716]/45 border border-hairline">
        <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
          <span>Những gì được giữ lại &amp; Cảnh báo khi đăng ký lại</span>
        </h2>
        <div className="mb-3">
          <div className="py-2.5 border-b border-hairline/60 text-sm sm:text-base text-body flex items-baseline gap-2.5">
            <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
            <span>
              <strong className="text-[#f7e7b4]">Mã băm của email, ID đăng nhập và định danh thiết bị:</strong> giữ sau khi xoá tài khoản để chặn nhận lại quà khuyến mãi. Không đảo ngược được thành dữ liệu gốc.
            </span>
          </div>
          <div className="py-2.5 text-sm sm:text-base text-body flex items-baseline gap-2.5">
            <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
            <span>
              <strong className="text-[#f7e7b4]">Lịch sử GEM:</strong> giữ ở dạng ẩn danh để đối soát.
            </span>
          </div>
        </div>
        <p className="text-sm sm:text-base text-body leading-relaxed mb-4">
          Chi tiết thời hạn lưu trữ nằm ở mục 6 của{" "}
          <Link to={BaseUrl.Privacy} className="text-[#f7e7b4] underline underline-offset-4">
            Chính sách riêng tư
          </Link>
          .
        </p>
        <div className="p-4 bg-[#241842]/80 border border-[#d4af37]/40 text-sm text-ink rounded-xl">
          <p className="font-bold text-[#f5d77f] mb-1.5 font-rune">[!] Cảnh báo khi tạo lại tài khoản:</p>
          <p className="text-body leading-relaxed m-0">
            Nếu bạn đăng ký lại bằng địa chỉ email hoặc tài khoản Google/Facebook đã từng bị xoá, bạn vẫn có thể sử dụng bình thường nhưng <strong className="text-[#f7e7b4]">tài khoản sẽ bắt đầu với 0 GEM</strong> (không nhận quà tặng ban đầu) và <strong className="text-[#f7e7b4]">không được quyền nhập mã giới thiệu</strong> của người khác.
          </p>
        </div>
      </section>
    </article>
  );
};

export default DataDeletionContent;
