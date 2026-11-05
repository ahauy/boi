# business-rules — Quy tắc nghiệp vụ

Số liệu lấy từ `shared/src/constants/index.ts` (`ECONOMY_DEFAULTS`, `CREDIT_AMOUNTS`). Backend có thể ghi đè bằng biến môi trường (xem `backend/.env.example`); `GET /api/v1/config` trả giá trị đang áp dụng cho app.

## Tài khoản

- Không có đăng ký hay đăng nhập. App gửi định danh thiết bị (Android ID, hoặc UUID nếu không đọc được) tới `POST /auth/device`; backend chỉ lưu mã băm HMAC (`IDENTITY_HASH_SECRET`) và trả phiên khách (access token + refresh token).
- Mỗi thiết bị một tài khoản. Cài lại app trên cùng thiết bị thì về đúng tài khoản cũ.
- Tạo tài khoản mới bị giới hạn theo IP (`ANONYMOUS_SIGNUP_DAILY_CAP`, mặc định 20 mỗi ngày); vượt giới hạn trả `DEVICE_SESSION_LIMIT_REACHED`.
- Tên hiển thị mặc định là "Nhà chiêm tinh" (theo ngôn ngữ); người dùng có thể đổi tên và ảnh đại diện trong Sửa hồ sơ.
- Dữ liệu giới tính, nhóm tuổi, sở thích chọn lúc onboarding chỉ lưu trên thiết bị.
- Dịch vụ dành cho người từ 16 tuổi. App không có bước xác nhận riêng: bước chọn nhóm tuổi là xác nhận, và Điều khoản ghi rõ điều đó.

## GEM

| Mục | Giá trị |
| --- | --- |
| Giá một lần xem | 5 GEM (`PRICE_PER_ACTION`) |
| Quà khởi đầu | 5 GEM, mỗi thiết bị một lần, tối đa 5 lần mỗi ngày mỗi mạng (`STARTER_NETWORK_DAILY_CAP`) |
| Điểm danh | thang 3, 3, 5, 3, 3, 8, 10 theo ngày liên tiếp; thưởng mốc 20/30/50/80/100/200 GEM ở ngày 30/60/100/180/270/365; khôi phục chuỗi tốn 10 GEM mỗi ngày bỏ lỡ, tối đa 3 ngày |
| Vòng quay | giải 2, 3, 5, 10, 20, 50 GEM theo trọng số phía server; 1 lượt miễn phí và 3 lượt xem quảng cáo mỗi ngày; quay trả phí 3 GEM (kỳ vọng nhỏ hơn giá quay) |
| Quảng cáo có thưởng | +3 GEM, tối đa 5 lần mỗi ngày; điểm danh nhân đôi bằng quảng cáo 1 lần mỗi ngày |
| Giới thiệu | người nhập mã +5 GEM, người mời +3 GEM; người mời tối đa 5 lượt mỗi ngày và 5 lượt mỗi mạng mỗi ngày |
| VIP hằng ngày | +50 GEM mỗi ngày cho người đang VIP |

- Ngày thưởng tính theo múi giờ `Asia/Ho_Chi_Minh` (`REWARD_TZ`).
- GEM không quy ra tiền, không chuyển giữa tài khoản, mất khi xoá tài khoản.
- Sổ cái `credit_transactions` là nguồn sự thật: tổng `amount` của một tài khoản phải bằng `creditBalance` (script `pnpm --filter backend credits:reconcile`).
- Lần xem trừ GEM trước khi gọi AI; AI lỗi hoặc ảnh không phải lòng bàn tay thì hoàn đúng một lần (`READING_REFUND`).

## Xem bói

- Header `Idempotency-Key` (UUID v4) bắt buộc; gửi lại cùng key không trừ thêm GEM.
- Gửi lại cùng key khi lần xem trước còn đang xử lý trả `READING_IN_PROGRESS`; `POST /readings` giới hạn 5 yêu cầu mỗi phút mỗi tài khoản.
- Trường phái phương Tây dùng được cho mọi người; Phương Đông và Ấn Độ (Vedic) chỉ cho VIP khi `ENFORCE_VIP_SCHOOLS` bật (mặc định bật), nếu không trả `vip_required`.
- Ảnh tối đa 8 MB; backend đổi HEIC sang JPEG, xoay theo EXIF, xoá toàn bộ EXIF, thu nhỏ cạnh dài tối đa 1280 px.
- Ảnh chỉ được lưu lên Cloudinary khi AI xác nhận là lòng bàn tay. Lần xem bị từ chối hoặc lỗi không lưu ảnh. Ở production, nếu Cloudinary lỗi thì lần xem vẫn hoàn tất nhưng không có ảnh.
- Xoá một lần xem: xoá ảnh trên Cloudinary trước; nếu không xoá được ảnh thì giữ lần xem và báo `IMAGE_DELETE_FAILED` để thử lại. Khi xoá xong, kết quả, đường chỉ tay và chủ đề (`topics = []`) bị xoá, chỉ còn bản ghi rút gọn.

## VIP

- Gói đăng ký Google Play: `weeklyid`, `monthlyid`, `yearlyid` (ghi đè bằng `SUB_*_ID`). App gửi giao dịch tới `POST /billing/verify`; backend xác minh với Google Play bằng service account và nhận thông báo gia hạn/huỷ qua RTDN (`POST /billing/rtdn?token=`).
- Quyền lợi: mở trường phái Phương Đông và Ấn Độ, không banner/quảng cáo xen kẽ/quảng cáo gốc, +50 GEM mỗi ngày.
- Quà hằng ngày chỉ phát một lần mỗi thiết bị mỗi ngày (dấu `vipDailyDay`/`vipDailyUserId` trong `devices`), nên xoá tài khoản rồi khôi phục VIP trong cùng ngày không nhận lại.
- Khôi phục: cùng `purchaseToken` được chuyển sang tài khoản hiện tại và tài khoản cũ mất VIP.
- Xoá tài khoản **không** huỷ gói Play; người dùng phải tự huỷ trong Google Play.

## Mã giới thiệu

- Mỗi tài khoản có mã 8 ký tự; người khác nhập một lần, bất cứ lúc nào.
- Từ chối khi: tự nhập mã của mình (`REFERRAL_SELF`), vòng giới thiệu (`REFERRAL_CYCLE`), thiết bị đã nhập mã (`REFERRAL_DEVICE_USED`), vượt giới hạn mạng (`REFERRAL_NETWORK_LIMIT`), thiết bị từng xoá tài khoản (`REFERRAL_NOT_ALLOWED`), mã không tồn tại (`REFERRAL_CODE_NOT_FOUND`), đã nhập rồi (`REFERRAL_ALREADY_USED`).
- Link `…/r/<mã>` mở trang tĩnh `legal/referral` (nút sao chép mã và cài từ Google Play); người dùng nhập mã tay trong app.

## Quảng cáo

- Người không VIP thấy banner, quảng cáo xen kẽ và quảng cáo gốc; khoảng cách tối thiểu giữa hai quảng cáo xen kẽ là 90 giây, và 60 giây cho "ads user" (người từ chối paywall 3 lần).
- Quảng cáo có thưởng chỉ hiện khi người dùng chọn xem.
- Đo lường bên thứ ba (Adjust, Firebase Analytics, Crashlytics) chỉ bật khi vùng được xác định là `OTHER` (ngoài GDPR); vùng GDPR hoặc chưa rõ thì tắt.

## Xoá tài khoản

`DELETE /me` (và `pnpm --filter backend users:delete` cho xử lý thủ công) dùng chung một hàm. Ảnh trên Cloudinary được xoá trước; lỗi ảnh thì không đụng DB và báo lại. Sau đó một transaction MongoDB xoá hoặc ẩn dữ liệu. Chi tiết dữ liệu xoá/giữ nằm ở [database-erd.md](database-erd.md). Thiết bị từng xoá tài khoản nhận tài khoản mới với 0 GEM, không quà khởi đầu và không nhập được mã giới thiệu.
