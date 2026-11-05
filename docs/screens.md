# screens — Màn hình của app

Route nằm trong `mobile-2/src/app/` (expo-router). Chuỗi hiển thị đủ 9 ngôn ngữ trong `mobile-2/src/i18n/`.

| Route | Màn hình | Ghi chú |
| --- | --- | --- |
| `onboarding` | Chọn ngôn ngữ, giới tính, nhóm tuổi, sở thích | Câu trả lời chỉ lưu trên máy. Có thông báo từ 16 tuổi; bước nhóm tuổi là xác nhận độ tuổi |
| `(tabs)/index` | Trang chủ | Giá một lần xem, lối vào quét; dòng "ảnh được truyền qua kết nối mã hoá" |
| `(tabs)/scan` | Quét | Chọn trường phái, tay, mục; chụp hoặc chọn ảnh; checkbox đồng ý gửi ảnh cho AI và lưu trên Cloudinary; trường phái Phương Đông và Ấn Độ yêu cầu VIP |
| `camera` | Camera | Quyền Camera (chụp ảnh bàn tay) |
| `reading/[id]` | Kết quả | Luận giải, ảnh (nếu có), xoá lần xem, câu miễn trừ giải trí |
| `(tabs)/history` | Lịch sử | Danh sách lần xem theo trang |
| `(tabs)/currency` | GEM | Số dư, điểm danh, vòng quay, quảng cáo có thưởng |
| `(tabs)/profile` | Hồ sơ | Tên, mã tài khoản (sao chép), mã giới thiệu, quản lý gói VIP (mở Google Play), Chính sách riêng tư, Điều khoản, hướng dẫn xoá dữ liệu, "Quyền riêng tư quảng cáo" (chỉ vùng GDPR), Xoá tài khoản (xác nhận hai bước) |
| `edit-profile` | Sửa hồ sơ | Tên hiển thị, ảnh đại diện |
| `enter-referral` | Nhập mã giới thiệu | Một lần mỗi tài khoản |
| `referral` | Chia sẻ mã giới thiệu | Mời bạn bè; link trỏ về trang tĩnh `legal/referral` |

Chính sách, điều khoản và hướng dẫn xoá dữ liệu mở bằng trình duyệt trong app từ trang tĩnh `legal/` (URL gốc là `EXPO_PUBLIC_WEB_URL`); không có màn hình riêng. Không có màn đăng nhập hay đăng ký.

Mọi trang kết quả phải hiện câu miễn trừ: kết quả mang tính giải trí.
