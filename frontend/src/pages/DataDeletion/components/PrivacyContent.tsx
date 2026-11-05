import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

const SECTION_CLASS = "mb-8 p-5 rounded-xl bg-[#0b0716]/45 border border-hairline";
const LAST_SECTION_CLASS = "p-5 rounded-xl bg-[#0b0716]/45 border border-hairline";
const PARAGRAPH_CLASS = "text-sm sm:text-base text-body leading-relaxed mb-3 last:mb-0";

const Section = ({ title, last = false, children }: { title: string; last?: boolean; children: ReactNode }) => (
  <section className={last ? LAST_SECTION_CLASS : SECTION_CLASS}>
    <h2 className="font-display text-xl font-bold text-[#f7e7b4] pb-2.5 border-b border-hairline mb-4 flex items-center gap-2">
      <span aria-hidden="true" className="text-[#d4af37] text-sm">✦</span>
      <span>{title}</span>
    </h2>
    {children}
  </section>
);

const Para = ({ children }: { children: ReactNode }) => <p className={PARAGRAPH_CLASS}>{children}</p>;

const Strong = ({ children }: { children: ReactNode }) => <strong className="text-[#f7e7b4]">{children}</strong>;

const Items = ({ items }: { items: { lead: string; text: string }[] }) => (
  <div className="mb-3 last:mb-0">
    {items.map((item, index) => (
      <div
        key={item.lead}
        className={`py-2.5 ${
          index < items.length - 1 ? "border-b border-hairline/60 " : ""
        }text-sm sm:text-base text-body flex items-baseline gap-2.5`}
      >
        <span className="font-bold font-rune text-[#d4af37] shrink-0">[+]</span>
        <span>
          <Strong>{item.lead}</Strong> {item.text}
        </span>
      </div>
    ))}
  </div>
);

// Bảng đọc được ở màn hẹp: dưới `sm` mỗi hàng xếp thành thẻ, nhãn cột lấy từ data-label.
const DataTable = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="mb-3 last:mb-0">
    <table className="w-full border-collapse text-sm sm:text-base text-body">
      <thead className="hidden sm:table-header-group">
        <tr>
          {headers.map((header) => (
            <th
              key={header}
              scope="col"
              className="text-left align-top font-bold text-[#f7e7b4] px-3 py-2 border-b border-hairline"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block sm:table-row-group">
        {rows.map((row) => (
          <tr
            key={row[0]}
            className="block sm:table-row mb-3 sm:mb-0 rounded-lg sm:rounded-none border border-hairline/60 sm:border-0 bg-[#0b0716]/40 sm:bg-transparent"
          >
            {row.map((cell, index) => (
              <td
                key={`${row[0]}-${headers[index]}`}
                data-label={headers[index]}
                className={`block sm:table-cell align-top px-3 py-2 sm:border-b sm:border-hairline/60 leading-relaxed before:content-[attr(data-label)] before:block before:text-xs before:text-mute before:font-rune sm:before:hidden ${
                  index === 0 ? "font-bold text-[#f7e7b4] sm:font-normal sm:text-body" : ""
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const COLLECTED_HEADERS = ["Loại dữ liệu", "Bao gồm", "Khi nào"];
const COLLECTED_ROWS = [
  ["Tài khoản", "Email, tên hiển thị, tên người dùng, mật khẩu ở dạng băm; tên, ảnh đại diện và ID nếu đăng nhập bằng Google hoặc Facebook", "Khi đăng ký trên web"],
  ["Tài khoản khách", "Mã băm của định danh thiết bị; không cần email. Tên hiển thị và ảnh đại diện nếu bạn tự đặt trong mục Sửa hồ sơ", "Khi mở ứng dụng Android"],
  ["Ảnh lòng bàn tay", "Ảnh bạn chụp hoặc chọn, ảnh đã vẽ đường chỉ tay. Toàn bộ siêu dữ liệu EXIF, gồm vị trí GPS, bị xoá trước khi xử lý", "Khi bạn đồng ý và gửi ảnh"],
  ["Kết quả luận giải", "Nội dung do AI tạo, tọa độ đường chỉ tay, lịch sử các lần xem", "Sau mỗi lần xem thành công"],
  ["Thông tin trên thiết bị", "Ngôn ngữ, giới tính, nhóm tuổi và sở thích bạn chọn khi bắt đầu. Các câu trả lời này chỉ lưu trên thiết bị", "Khi bắt đầu dùng ứng dụng"],
  ["GEM và hoạt động trong ứng dụng", "Số dư, lịch sử nhận và dùng GEM, điểm danh, vòng quay, mã giới thiệu", "Khi bạn dùng các tính năng đó"],
  ["Định danh thiết bị", "Android ID, chúng tôi chỉ lưu ở dạng mã băm. Dùng để nhận ra tài khoản khách và chống lạm dụng", "Khi mở ứng dụng"],
  ["Địa chỉ IP", "Chỉ lưu ở dạng mã băm khi dùng để giới hạn đăng ký và phần thưởng", "Khi tạo tài khoản, nhận thưởng"],
  ["Quảng cáo và phân tích", "Mã quảng cáo Google (GAID), Adjust ADID, lượt hiển thị và doanh thu quảng cáo, báo cáo lỗi", "Khi bạn dùng ứng dụng, theo lựa chọn đồng ý ở mục 5"],
  ["Thanh toán", "Mã gói, mã đơn hàng, purchase token, giá, thời hạn VIP. Google Play xử lý thanh toán, chúng tôi không nhận số thẻ", "Khi bạn mua hoặc khôi phục VIP"],
];

const PARTNER_HEADERS = ["Bên thứ ba", "Vai trò", "Dữ liệu liên quan"];
const PARTNER_ROWS = [
  ["Google (Gemini), Groq", "Phân tích ảnh và tạo nội dung luận giải", "Ảnh lòng bàn tay đã xoá EXIF, lựa chọn chủ đề xem"],
  ["Cloudinary", "Lưu và phân phối ảnh", "Ảnh lòng bàn tay, ảnh đã vẽ đường chỉ tay, ảnh đại diện bạn tải lên"],
  ["AppLovin MAX và các mạng quảng cáo: Google AdMob, Meta Audience Network, Mintegral, Unity Ads, Liftoff/Vungle, DT Exchange, Yandex, Bigo Ads, Pangle", "Hiển thị quảng cáo", "Định danh quảng cáo, IP, thông tin thiết bị, dữ liệu tương tác với quảng cáo"],
  ["Adjust", "Đo nguồn cài đặt và doanh thu", "GAID, Adjust ADID, sự kiện mua, doanh thu quảng cáo"],
  ["Google Firebase", "Phân tích và báo cáo lỗi", "Sự kiện hiển thị quảng cáo, báo cáo lỗi, thông tin thiết bị"],
  ["Google Play", "Thanh toán, quản lý gói VIP", "Mã đơn hàng, purchase token, mã tham chiếu tài khoản đã làm mờ"],
  ["Google, Facebook", "Đăng nhập trên web", "ID tài khoản, tên, email, ảnh đại diện"],
  ["[ĐIỀN: nhà cung cấp email và hosting đang dùng, ví dụ Render, Vercel, MongoDB]", "Gửi email, lưu trữ máy chủ và cơ sở dữ liệu", "Dữ liệu tài khoản, dữ liệu dịch vụ"],
];

const RETENTION_HEADERS = ["Dữ liệu", "Thời hạn"];
const RETENTION_ROWS = [
  ["Ảnh của lần xem thành công", "Lưu trên Cloudinary cho tới khi bạn xoá lần xem đó hoặc xoá tài khoản"],
  ["Ảnh của lần xem bị từ chối hoặc lỗi", "Không lưu"],
  ["Kết quả luận giải", "Tới khi bạn xoá lần xem đó hoặc xoá tài khoản"],
  ["Tài khoản", "Tới khi xoá tài khoản"],
  ["Đăng ký chưa xác minh", "Tự xoá sau 24 giờ"],
  ["Lượt dùng thử không đăng nhập", "Tự xoá sau 7 ngày"],
  ["Vé thưởng quảng cáo", "Tự xoá sau khi hết ngày"],
  ["Dữ liệu giao dịch VIP", "[ĐIỀN: thời hạn theo yêu cầu kế toán và pháp lý]"],
  ["Lịch sử GEM", "Giữ sau khi xoá tài khoản ở dạng ẩn danh để đối soát"],
  ["Mã băm email, ID đăng nhập và định danh thiết bị", "Giữ sau khi xoá tài khoản để chặn nhận lại quà khuyến mãi. Không đảo ngược được thành dữ liệu gốc. [XÁC NHẬN: thời hạn tối đa, hiện chưa có]"],
];

export const PrivacyContent = () => {
  return (
    <article className="w-full text-left font-sans">
      <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2">
        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
        <span>Ấn Mật Bảo Hộ</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient leading-tight mb-2 tracking-normal">
        Chính sách Quyền riêng tư PalmSight
      </h1>
      <div className="text-xs sm:text-sm text-mute mb-6 font-rune">Cập nhật: [ĐIỀN: ngày đăng]</div>

      <Section title="1. Giới thiệu">
        <Para>Chính sách này giải thích PalmSight thu thập dữ liệu gì, dùng để làm gì và bạn có quyền gì với dữ liệu đó.</Para>
        <Para>
          PalmSight là ứng dụng xem chỉ tay bằng AI trên Android và web, do [ĐIỀN: tên cá nhân hoặc công ty vận hành, địa chỉ] vận hành. Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.
        </Para>
        <Para>
          Chính sách áp dụng cho ứng dụng PalmSight, trang web PalmSight và các dịch vụ liên quan. Khi dùng PalmSight, bạn đồng ý với nội dung dưới đây.
        </Para>
      </Section>

      <Section title="2. Dữ liệu chúng tôi thu thập">
        <Para>PalmSight thu thập dữ liệu bạn cung cấp, ảnh bạn tải lên và một số dữ liệu kỹ thuật từ thiết bị.</Para>
        <DataTable headers={COLLECTED_HEADERS} rows={COLLECTED_ROWS} />
        <Para>
          Ứng dụng dùng quyền Camera để chụp ảnh bàn tay và quyền Thông báo nếu bạn cho phép. Bạn có thể tắt các quyền này trong cài đặt thiết bị.
        </Para>
      </Section>

      <Section title="3. Mục đích sử dụng">
        <Para>Chúng tôi dùng dữ liệu để vận hành dịch vụ, tài trợ cho ứng dụng bằng quảng cáo và gói VIP, và chống lạm dụng.</Para>
        <Items
          items={[
            { lead: "Cung cấp tính năng:", text: "phân tích ảnh, tạo và hiển thị kết quả, lưu lịch sử." },
            { lead: "Quản lý tài khoản:", text: "đăng nhập, nhận ra tài khoản khách khi bạn cài lại ứng dụng, giữ số dư GEM." },
            { lead: "Xử lý VIP:", text: "xác minh giao dịch với Google Play, gia hạn, khôi phục và huỷ gói." },
            { lead: "Hiển thị quảng cáo:", text: "hiển thị, đo lường và giới hạn tần suất quảng cáo." },
            { lead: "Đo lường:", text: "biết người dùng đến từ kênh nào, doanh thu và hiệu quả tiếp thị." },
            { lead: "Chống lạm dụng:", text: "áp dụng giới hạn phần thưởng theo tài khoản, thiết bị và mạng." },
            { lead: "Ổn định dịch vụ:", text: "theo dõi lỗi và cải thiện ứng dụng." },
            { lead: "Liên hệ:", text: "gửi email xác minh và đặt lại mật khẩu." },
          ]}
        />
        <Para>
          Chúng tôi không bán ảnh lòng bàn tay và không dùng ảnh để nhận dạng danh tính của bạn. [XÁC NHẬN: điều khoản của nhà cung cấp AI có cho phép dùng dữ liệu để huấn luyện mô hình không.]
        </Para>
      </Section>

      <Section title="4. Bên thứ ba nhận dữ liệu">
        <Para>
          Chúng tôi không bán dữ liệu cá nhân của bạn, nhưng có chia sẻ dữ liệu với các đối tác dưới đây để vận hành dịch vụ và quảng cáo.
        </Para>
        <DataTable headers={PARTNER_HEADERS} rows={PARTNER_ROWS} />
        <Para>
          Các mạng quảng cáo xử lý dữ liệu theo chính sách riêng của họ. Chúng tôi không gửi mã tài khoản PalmSight của bạn cho SDK quảng cáo.
        </Para>
        <Para>
          Dữ liệu có thể được xử lý ở ngoài nơi bạn sống, tùy vị trí máy chủ của các đối tác. Chúng tôi có thể tiết lộ dữ liệu khi pháp luật yêu cầu.
        </Para>
      </Section>

      <Section title="5. Quảng cáo và lựa chọn của bạn">
        <Para>PalmSight hiển thị quảng cáo và hỏi ý kiến của bạn khi luật yêu cầu.</Para>
        <Items
          items={[
            { lead: "Đồng ý:", text: "tại EEA, Anh và các khu vực liên quan, ứng dụng hiển thị biểu mẫu đồng ý trước khi khởi động quảng cáo." },
            { lead: "Khi chưa xác định được đồng ý:", text: "ứng dụng tắt chia sẻ dữ liệu với bên thứ ba cho mục đo lường, không cá nhân hoá quảng cáo và không đọc GAID." },
            { lead: "Đổi ý:", text: "tại EEA và khu vực áp dụng, bạn mở lại biểu mẫu từ mục Hồ sơ, chọn Lựa chọn quyền riêng tư quảng cáo." },
            { lead: "Mã quảng cáo:", text: "bạn có thể đặt lại hoặc xoá mã quảng cáo trong cài đặt Android." },
            { lead: "VIP:", text: "người dùng VIP không thấy banner, quảng cáo xen kẽ và quảng cáo gốc. Quảng cáo có thưởng vẫn có nếu bạn chọn xem." },
          ]}
        />
      </Section>

      <Section title="6. Lưu trữ">
        <Para>Chúng tôi giữ dữ liệu trong thời gian cần để cung cấp dịch vụ, rồi xoá hoặc ẩn danh theo bảng dưới đây.</Para>
        <DataTable headers={RETENTION_HEADERS} rows={RETENTION_ROWS} />
        <Para>
          Ảnh đại diện bạn tải lên được xoá siêu dữ liệu, lưu trên Cloudinary tới khi bạn đổi ảnh, gỡ ảnh hoặc xoá tài khoản. Dữ liệu do bên thứ ba nắm giữ được lưu theo chính sách của họ.
        </Para>
      </Section>

      <Section title="7. Quyền của bạn">
        <Para>Bạn có thể xem, sửa hoặc xoá dữ liệu của mình, và rút lại đồng ý bất cứ lúc nào.</Para>
        <Items
          items={[
            { lead: "Xoá một lần xem:", text: "mở lần xem và chọn xoá. Ảnh và kết quả bị xoá ngay." },
            { lead: "Xoá tài khoản:", text: "làm theo hướng dẫn tại [ĐIỀN: URL trang /data-deletion], hoặc mở từ mục Hồ sơ trong ứng dụng. Chúng tôi xác minh và hoàn tất trong vòng 30 ngày." },
            { lead: "Khi xoá tài khoản:", text: "chúng tôi xoá ảnh lòng bàn tay, ảnh đại diện, kết quả luận giải, mật khẩu, phiên đăng nhập và thông tin nhận dạng. Những gì vẫn giữ được nêu ở mục 6." },
            { lead: "Rút lại đồng ý:", text: "dùng lựa chọn ở mục 5, thu hồi quyền trong cài đặt thiết bị." },
            { lead: "Yêu cầu khác:", text: "bạn có thể yêu cầu truy cập, đính chính hoặc phản đối xử lý qua email ở mục 8." },
          ]}
        />
        <Para>Huỷ tài khoản PalmSight không tự huỷ gói VIP. Bạn cần huỷ gói trong Google Play.</Para>
      </Section>

      <Section title="8. Điều khoản khác" last>
        <Para>
          <Strong>Trẻ em.</Strong> PalmSight dành cho người từ 16 tuổi trở lên. Chúng tôi không cố ý thu thập dữ liệu của người chưa đủ tuổi. Nếu phát hiện, hãy liên hệ để chúng tôi xoá.
        </Para>
        <Para>
          <Strong>Bảo mật.</Strong> Dữ liệu truyền qua kết nối mã hoá. Mật khẩu, định danh thiết bị và IP chỉ lưu ở dạng băm khi cần lưu. Không hệ thống nào an toàn tuyệt đối, nên chúng tôi không thể cam kết không bao giờ xảy ra sự cố.
        </Para>
        <Para>
          <Strong>Thay đổi.</Strong> Khi cập nhật chính sách, chúng tôi đổi ngày ghi ở đầu trang và thông báo trong ứng dụng nếu thay đổi quan trọng.
        </Para>
        <Para>
          <Strong>Liên hệ.</Strong> [ĐIỀN: email hỗ trợ quyền riêng tư] · [ĐIỀN: tên và địa chỉ người vận hành]
        </Para>
      </Section>
    </article>
  );
};

export default PrivacyContent;
