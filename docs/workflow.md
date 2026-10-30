# workflow — Luồng xử lý

## 1. Đăng ký và đăng nhập

Cách chính là email/username + mật khẩu; Google/Facebook là cách đăng nhập phụ. Xem [ADR-0008](adr/0008-email-password-auth.md). Mọi cách đăng nhập thành công đều trả cùng một [response](api-contract.md#response-đăng-nhập-dùng-chung). Nếu `isNewUser = true` thì chuyển tới màn nhập mã giới thiệu.

### 1.1 Đăng ký bằng email và xác minh

```mermaid
flowchart TB
    form["/register<br/>tên hiển thị, username, email, mật khẩu"]
    reg["POST /auth/register"]
    check{"Email / username?"}
    taken["409 EMAIL_TAKEN<br/>hoặc USERNAME_TAKEN"]
    pending["Lưu pending_registrations<br/>hash mật khẩu + hash token<br/>hết hạn sau 24 giờ"]
    mail["Gửi email qua Gmail SMTP<br/>link /verify-email?token=..."]
    wait["202 · màn 'Kiểm tra email'<br/>nút gửi lại"]
    click["Người dùng bấm link<br/>POST /auth/verify-email"]
    valid{"Token hợp lệ?"}
    bad["400 VERIFICATION_TOKEN_INVALID<br/>gợi ý gửi lại email"]
    exists{"Email đã thuộc user<br/>Google/Facebook?"}
    attach["Gắn username + mật khẩu<br/>vào user đó, không cộng credits"]
    create["Tạo user + referralCode<br/>+3 credits SIGNUP_BONUS<br/>trong 1 transaction"]
    login["Xoá đăng ký chờ<br/>cấp access token + cookie rt"]

    form --> reg --> check
    check -->|"email có mật khẩu<br/>hoặc username đã dùng"| taken
    check -->|hợp lệ| pending --> mail --> wait
    wait -.-> click --> valid
    valid -->|"sai / hết hạn / đã dùng"| bad
    valid -->|đúng| exists
    exists -->|có| attach --> login
    exists -->|không| create --> login

    classDef accent stroke:#2f6fde,stroke-width:2px
    classDef bad stroke:#d64545,stroke-width:2px
    class create accent
    class taken,bad bad
```

- Chưa bấm link thì **chưa có user**, nên không đăng nhập được, không có credits, không nhập được mã giới thiệu.
- Đăng ký lại cùng email trước khi xác minh thì ghi đè đăng ký cũ và gửi link mới.
- Hết 24 giờ mà chưa xác minh: MongoDB tự xoá đăng ký chờ (TTL), username được giải phóng.

### 1.2 Đăng nhập bằng mật khẩu

```mermaid
flowchart TB
    form["/login<br/>email hoặc username + mật khẩu"]
    post["POST /auth/login"]
    locked{"Sai 5 lần<br/>trong 15 phút?"}
    limited["429 RATE_LIMITED"]
    find{"Tìm user<br/>có '@' → email<br/>không → username"}
    ok["Đúng mật khẩu<br/>cấp access token + cookie rt"]
    pendingCheck{"Khớp đăng ký<br/>chưa xác minh?"}
    notVerified["403 EMAIL_NOT_VERIFIED<br/>nút gửi lại email"]
    invalid["401 INVALID_CREDENTIALS"]

    form --> post --> locked
    locked -->|có| limited
    locked -->|chưa| find
    find -->|"có user, đúng mật khẩu"| ok
    find -->|"không có / sai / chưa đặt mật khẩu"| pendingCheck
    pendingCheck -->|"có, đúng mật khẩu"| notVerified
    pendingCheck -->|không| invalid

    classDef accent stroke:#2f6fde,stroke-width:2px
    classDef bad stroke:#d64545,stroke-width:2px
    class ok accent
    class limited,notVerified,invalid bad
```

### 1.3 Quên và đặt lại mật khẩu

1. `/forgot-password`: người dùng nhập email → `POST /auth/forgot-password` → luôn `202`, hiện "Nếu email có tài khoản, bạn sẽ nhận được link trong vài phút".
2. Nếu email thuộc một user: server tạo token (1 giờ, dùng một lần), huỷ token cũ, gửi link `/reset-password?token=...`.
3. Bấm link → nhập mật khẩu mới → `POST /auth/reset-password` → `204`. Mọi phiên đăng nhập bị thu hồi; chuyển tới `/login`.

User chỉ dùng Google/Facebook cũng dùng luồng này để đặt mật khẩu lần đầu.

### 1.4 Đăng nhập Google / Facebook

```mermaid
flowchart TB
    sdk["Client lấy token từ SDK<br/>Google GIS / Facebook SDK"]
    post["POST /auth/:provider<br/>idToken | accessToken"]
    verify["Server xác minh token<br/>gọi Google / Facebook API"]
    invalid["401 OAUTH_INVALID_TOKEN"]
    hasId{"Đã có identity?"}
    emailMatch{"Email trùng user cũ?"}
    create["Tạo user mới<br/>referralCode + identity<br/>+3 credits SIGNUP_BONUS<br/>trong 1 transaction"]
    link["Gộp: thêm identity vào user đó<br/>không cộng thêm credits"]
    existing["Cập nhật profile user cũ<br/>tên, avatar"]
    token["Cấp access token + cookie rt<br/>JWT 15 phút · refresh token 30 ngày, xoay vòng mỗi lần refresh"]
    refScreen["Màn nhập mã giới thiệu<br/>isNewUser = true<br/>điền sẵn từ cookie ref_code"]
    home["Vào trang chủ<br/>isNewUser = false"]

    sdk --> post --> verify
    verify -->|sai| invalid
    verify --> hasId
    hasId -->|có| existing
    hasId -->|chưa| emailMatch
    emailMatch -->|có| link
    emailMatch -->|không| create
    create --> token
    link --> token
    existing --> token
    token -->|mới| refScreen
    token -->|cũ| home

    classDef accent stroke:#2f6fde,stroke-width:2px
    classDef bad stroke:#d64545,stroke-width:2px
    class create accent
    class invalid bad
```

Chỉ nhánh tạo user mới mới cộng 3 credits. Gộp theo email chỉ áp dụng khi provider trả email đã xác minh (Google luôn có, Facebook có thể không), để một người dùng nhiều cách đăng nhập không nhận nhiều lần 3 credits.

"Email trùng user cũ" tính cả user đăng ký bằng mật khẩu. Email của họ đã được xác minh qua link, nên đăng nhập Google cùng email sẽ gắn Google vào tài khoản mật khẩu đó.

## 2. Nhập mã giới thiệu

```mermaid
flowchart TB
    submit["POST /me/referral<br/>body code + Bearer token"]
    validate["Kiểm tra hợp lệ<br/>tài khoản được phép nhập mã<br/>mã tồn tại, không tự nhập<br/>chưa từng nhập mã<br/>không nhập mã của người mình đã mời"]
    reject["Từ chối 4xx<br/>mã lỗi REFERRAL_*<br/>không ghi dữ liệu"]
    cap{"Chủ mã đã nhận<br/>10 lượt hôm nay?"}
    capped["CAPPED<br/>người nhập +1 REFEREE_BONUS<br/>chủ mã không được cộng"]
    rewarded["REWARDED<br/>người nhập +1 REFEREE_BONUS<br/>chủ mã +2 REFERRAL_BONUS"]
    done["201 { accepted, creditsEarned: 1, creditBalance }"]

    submit --> validate
    validate -->|sai| reject
    validate --> cap
    cap -->|có| capped --> done
    cap -->|chưa| rewarded --> done

    classDef accent stroke:#2f6fde,stroke-width:2px
    classDef warn stroke:#e0a100,stroke-width:2px
    classDef bad stroke:#d64545,stroke-width:2px
    class rewarded accent
    class capped warn
    class reject bad
```

Ghi referral, cộng credits cho cả hai người và ghi sổ cái chạy trong một MongoDB transaction. Unique index trên `referrals.refereeId` chặn việc một người gửi hai request nhập mã cùng lúc.

## 3. Xem bói & Vẽ đường chỉ tay bằng ONNX

Luồng nhận diện và vẽ chỉ tay trên client kết hợp với luận giải AI và lưu trữ Cloudinary trên server ([ADR-0011](adr/0011-cloudinary-image-storage-and-onnx-palm-lines.md)):

```mermaid
flowchart TB
    choose["Client chọn trường phái<br/>Tây / Đông / Ấn Độ + mục muốn bói + tay"]
    cam["[Camera Frame / Ảnh tải lên]"]
    mp["[MediaPipe Hands]<br/>Tìm 21 tọa độ bàn tay · kiểm tra mặt lòng bàn tay"]
    cv["[OpenCV / Canvas Affine]<br/>Cắt & xoay thẳng vùng lòng bàn tay 512×512"]
    onnx["[Mô hình AI đã train (palm_lines.onnx)]<br/>Phân đoạn nét · skeletonize · vẽ đè Sinh đạo / Trí đạo / Tâm đạo"]
    post["POST /readings<br/>multipart: image, annotatedImage?, palmLines?, school, topics, hand, aiConsent<br/>header Idempotency-Key"]
    key{"Key đã dùng?"}
    inProgress["409 READING_IN_PROGRESS<br/>client hỏi lại GET /readings/{id}"]
    replay["Trả lại kết quả cũ<br/>200 hoặc 503, không trừ thêm credit"]
    validate["Validate<br/>ảnh ≤ 8 MB · JPEG/PNG/WebP/HEIC<br/>school hợp lệ, topics thuộc school<br/>hand LEFT/RIGHT · aiConsent = true"]
    badReq["400 / 413 / 415<br/>không trừ credit"]
    spend["Trừ 1 credit + tạo reading<br/>PROCESSING + READING_SPEND<br/>trong 1 transaction"]
    noCredit["402<br/>INSUFFICIENT_CREDITS"]
    ai["Xử lý ảnh + gọi AI luận giải<br/>xoay, xoá EXIF, resize 1280 px<br/>Gemini → Groq, timeout 40 s"]
    result{"Kết quả AI?"}
    rejected["REJECTED<br/>hoàn 1 credit, không lưu ảnh<br/>200, gợi ý chụp lại"]
    failed["FAILED<br/>hoàn 1 credit, không lưu ảnh<br/>503 AI_UNAVAILABLE"]
    cloud["Upload ảnh (đã xoá EXIF) & ảnh vẽ chỉ tay<br/>lên Cloudinary"]
    done["DONE<br/>lưu result + imageUrl + annotatedImageUrl + palmLines<br/>Hiển thị kết quả bói toán & hình vẽ chỉ tay lên màn hình"]

    choose --> cam --> mp --> cv --> onnx --> post --> key
    key -->|có, đang PROCESSING| inProgress
    key -->|có, đã xong| replay
    key -->|chưa| validate
    validate -->|sai| badReq
    validate --> spend
    spend -->|hết| noCredit
    spend --> ai --> result
    result -->|ảnh sai| rejected
    result -->|lỗi| failed
    result -->|hợp lệ| cloud --> done

    classDef accent stroke:#2f6fde,stroke-width:2px
    classDef warn stroke:#e0a100,stroke-width:2px
    classDef bad stroke:#d64545,stroke-width:2px
    class done,onnx accent
    class rejected,failed,inProgress warn
    class badReq,noCredit bad
```

Trừ credit **trước** khi gọi AI, để hai request gửi cùng lúc không thể dùng chung một credit cuối cùng. Hoàn credit ghi `READING_REFUND` kèm `readingId`; unique index đảm bảo mỗi reading chỉ được hoàn một lần.

**Idempotency-Key:**

- Client chỉ gửi lại **cùng** key khi không nhận được response (mất mạng, timeout).
- Đã nhận response bất kỳ thì lần bấm sau dùng key mới. Vì vậy sau `503 AI_UNAVAILABLE`, người dùng bấm thử lại sẽ là một lần xem mới, trừ credit mới (credit cũ đã được hoàn).

Chi tiết ở [api-contract.md](api-contract.md#post-readings).

Nếu server chết giữa chừng, reading bị kẹt ở `PROCESSING`. Reading kẹt quá 2 phút được chuyển sang `FAILED` và hoàn credit. Việc này chạy ở hai chỗ, vì server miễn phí có thể đang ngủ:

- Định kỳ mỗi 5 phút trong lúc API đang chạy, và một lần khi API khởi động.
- Khi người dùng mở lịch sử hoặc chi tiết của reading đó.
