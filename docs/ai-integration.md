# ai-integration — Tích hợp AI (luận giải bằng LLM)

PalmSight dùng hai thành phần AI ở backend: Google Gemini (chính) và Groq (dự phòng) đọc ảnh lòng bàn tay và viết bài luận giải; dịch vụ `palm-service` (MediaPipe + model ONNX tự train) vẽ đường chỉ tay.

| Thành phần | Vai trò |
| --- | --- |
| Google Gemini API — chính | Model vision đọc ảnh và viết bài luận giải (`AI_MODEL`) |
| Groq — dự phòng | Fallback khi Gemini hết quota hoặc lỗi (`AI_FALLBACK_*`, API tương thích OpenAI) |
| `palm-service` (Python) — tuỳ chọn | Cắt, xoay thẳng lòng bàn tay, tìm và đặt tên 3 đường chính, trả `palmLines` và ảnh đã vẽ (`PALM_SERVICE_*`) |

## Vẽ đường chỉ tay (palm-service)

Chi tiết dịch vụ, API và cách đổi model: [palm-service/README.md](../palm-service/README.md).

- `ReadingsService.createReading` gọi `PalmLinesService.analyze` **song song** với Gemini, trên cùng ảnh đã qua `sharp` mà Gemini đọc.
- `PalmLinesService` không bao giờ ném lỗi: thiếu `PALM_SERVICE_URL`/`PALM_SERVICE_TOKEN` (tắt), quá `PALM_SERVICE_TIMEOUT_MS` (mặc định 20 000), lỗi mạng hay dữ liệu lạ đều trả `null`. Lần xem vẫn `DONE` bằng kết quả AI, không hoàn GEM, chỉ thiếu ảnh đã vẽ.
- Chỉ dùng kết quả khi AI xác nhận `isPalm: true`. Ảnh đã vẽ đi qua `sharp` lần nữa rồi lên Cloudinary với public id `reading_<id>_lines` (`annotatedImageUrl`), nên xoá lần xem và xoá tài khoản dọn được như ảnh vẽ cũ.
- Kết quả của server được ưu tiên hơn `palmLines`/`annotatedImage` client tự gửi. `palmLines` từ dịch vụ vẫn đi qua `parsePalmLinesInput`.
- Toạ độ `points` chuẩn hoá theo **ảnh đã cắt 512×512** (`annotatedImageUrl`), không theo `imageUrl`.
- Chưa đưa `palmLines` vào prompt của Gemini (sẽ phải chờ palm-service xong mới gọi AI) và chưa dùng nhãn trái/phải của MediaPipe để từ chối ảnh: nhãn của MediaPipe bản legacy ngược với tay thật trên ảnh camera sau.

---

## 1. Nhà cung cấp AI Luận Giải & Lưu trữ Cloudinary

Backend chỉ phụ thuộc interface `AiProvider.readPalm(image, { school, topics, hand }) → PalmResult`; đổi nhà cung cấp bằng biến môi trường, không sửa code nghiệp vụ. API key AI và Cloudinary secret chỉ nằm trên server, không bao giờ gửi xuống client.

**Biến môi trường**

```bash
AI_PROVIDER=gemini                   # gemini | groq
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=xxx
AI_FALLBACK_PROVIDER=groq
AI_FALLBACK_MODEL=qwen/qwen3.8-27b
AI_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_xxx
AI_TIMEOUT_MS=40000
AI_MAX_TOKENS=2000
AI_TEMPERATURE=0.7

CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
CLOUDINARY_FOLDER=palmsight/readings
```

**Tiền xử lý ảnh & Lưu trữ**:
- Chuyển HEIC → JPEG, xoay theo EXIF rồi **xoá toàn bộ EXIF (có GPS)** bằng `sharp` trong bộ nhớ, resize cạnh dài tối đa 1280 px, JPEG quality 85.
- Gửi ảnh dạng base64 data URL cho Gemini/Groq để nhận bài luận giải `PalmResult`.
- Khi `result.isPalm === true`, upload ảnh lòng bàn tay (đã xóa EXIF) lên **Cloudinary** (và ảnh đã vẽ của palm-service, hoặc `annotatedImage` client gửi), lưu `imageUrl`, `imagePublicId`, kết quả vào document `readings`. Ảnh bị từ chối hoặc lỗi không được lưu; ở production, Cloudinary lỗi thì lần xem hoàn tất nhưng không có ảnh.

## Trường phái bói

Người dùng chọn một trường phái trước khi chụp. AI vẫn đọc toàn bộ bàn tay, nhưng diễn giải và trình bày theo trường phái đã chọn. Mọi trường phái đều tốn 5 GEM. Danh sách trường phái và các mục bên dưới là **đề xuất**, có thể thêm/bớt.

| `school` | Tên hiển thị | Các mục bói riêng (`sections`, theo thứ tự hiển thị) |
| --- | --- | --- |
| `WESTERN` | Chỉ tay phương Tây | `handShape` dáng tay theo 4 nguyên tố (Đất, Khí, Lửa, Nước) · `heartLine` đường tình cảm · `headLine` đường trí tuệ · `lifeLine` đường sinh mệnh · `fateLine` đường định mệnh · `sunLine` đường danh vọng · `mounts` 7 gò (Kim Tinh, Mộc Tinh, Thổ Tinh, Thái Dương, Thuỷ Tinh, Thái Âm, Hoả Tinh) |
| `EASTERN` | Chỉ tay phương Đông (Trung Hoa) | `nguHanh` dáng tay ngũ hành (Kim, Mộc, Thuỷ, Hoả, Thổ) · `thienVan` Thiên văn (đường tình cảm) · `nhanVan` Nhân văn (đường trí tuệ) · `diaVan` Địa văn (đường sinh mệnh) · `batQuai` 8 cung bát quái và Minh Đường giữa lòng bàn tay · `fingers` hình dáng các ngón |
| `VEDIC` | Chỉ tay Ấn Độ (Hast Samudrika Shastra) | `planetMounts` các gò theo 9 hành tinh · `majorLines` các đường chính · `specialSigns` dấu hiệu đặc biệt (hình cá, đinh ba, hoa sen, ngôi sao, chữ thập…) · `thumb` ngón cái |

Ngoài các mục riêng, mọi trường phái có chung 6 **khía cạnh cuộc sống** (`aspects`): `personality` tính cách · `love` tình cảm · `career` sự nghiệp · `finance` tài chính · `health` sức khoẻ · `family` gia đạo.

`summary`, `advice`, `disclaimer` luôn có trong kết quả, không cần chọn.

## Chọn mục bói

Sau khi chọn trường phái, người dùng tích các **mục** muốn bói, hoặc bấm **Bói toàn bộ**. Mỗi mục (`topic`) là:

- một mục riêng của trường phái đã chọn (ví dụ `heartLine`, `nguHanh`), hoặc
- một khía cạnh cuộc sống (`love`, `career`…).

| Quy tắc | Chi tiết |
| --- | --- |
| Số mục tối thiểu | 1 |
| Bói toàn bộ | Gửi `topics` rỗng hoặc bỏ trống → server tự điền tất cả mục của trường phái + 6 khía cạnh |
| Mục không thuộc trường phái | `400 VALIDATION_ERROR` (ví dụ chọn `nguHanh` với `WESTERN`) |
| Giá | Luôn 5 GEM, dù chọn 1 mục hay toàn bộ |

## Thiết kế Prompt & Tiêu thụ Token

### Vai trò của AI

Prompt đóng vai trò của một **chuyên gia bói chỉ tay giàu kinh nghiệm, thấu cảm và chừng mực**.

- Không nói những câu mê tín dị đoan tuyệt đối ("bạn sẽ phá sản vào năm 35 tuổi", "bạn sẽ kết hôn hai lần"), không phán xét đạo đức.
- Lời văn tự nhiên, có cấu trúc rõ ràng, dùng thuật ngữ đúng trường phái người dùng chọn nhưng giải thích dễ hiểu.
- Kết luận bằng lời khuyên tích cực, hướng người dùng tới hành động và tư duy phát triển bản thân.
- Luôn kèm `disclaimer`: *"Kết quả chỉ mang tính tham khảo và giải trí, không thay thế cho lời khuyên y tế, tài chính hay pháp lý chuyên nghiệp."*

### Ngôn ngữ

- Mặc định trả kết quả bằng **tiếng Việt**.
- Mở rộng đa ngôn ngữ trong tương lai: thêm trường `language: "vi" | "en"` vào `AiReadingOptions`, chèn vào system prompt yêu cầu AI trả về đúng ngôn ngữ đó.

### Tối ưu Prompt theo trường phái

System prompt chung quy định định dạng JSON đầu ra nghiêm ngặt. User prompt được sinh tự động dựa trên:

1. Trường phái (`school`): đưa vào bảng thuật ngữ và các đường/gò tương ứng.
2. Danh sách mục được chọn (`topics`): chỉ thị AI **chỉ phân tích các mục này**, bỏ qua các mục không được chọn để tiết kiệm token và tăng tốc độ phản hồi.
3. Bàn tay (`hand`): `LEFT` (tiềm năng bẩm sinh, tính cách nội tâm) hoặc `RIGHT` (thực tế phát triển, hiện tại và tương lai theo quan niệm phổ biến).

### Cấu trúc Prompt

**System Prompt (rút gọn minh hoạ)**:

```text
Bạn là chuyên gia nhân tướng học và thuật xem chỉ tay (Palmistry) giàu kinh nghiệm, thấu cảm và khách quan.
Nhiệm vụ của bạn là quan sát kỹ lưỡng ảnh bàn tay được cung cấp và đưa ra bài luận giải chi tiết theo đúng trường phái và các mục được yêu cầu.

YÊU CẦU ĐẦU RA BẮT BUỘC:
- Định dạng JSON hợp lệ duy nhất, tuân thủ schema PalmResult.
- Không bọc JSON trong bất kỳ thẻ markdown nào khác ngoài ```json ... ``` (hoặc trả raw JSON nếu model hỗ trợ json_object mode).
- Nếu ảnh không phải bàn tay người, hoặc bàn tay quá mờ/không nhìn rõ các đường chỉ, đặt isPalm: false và ghi rõ rejectReason ("NOT_A_PALM", "TOO_BLURRY", "BAD_LIGHTING").
- Không dự đoán thời điểm tử vong, bệnh tật hiểm nghèo hay thông tin tiêu cực tuyệt đối.
```

**User Prompt**:

```text
Trường phái: [WESTERN | EASTERN | VEDIC]
Tay xem: [LEFT | RIGHT]
Các mục cần phân tích: [danh sách key các section và aspect được chọn]

Hãy phân tích ảnh bàn tay đính kèm và trả về JSON theo đúng cấu trúc yêu cầu.
```

### Dự toán Token

| Nội dung | Chi phí Token (ước tính) |
| --- | --- |
| System Prompt & Rules | ~400 tokens |
| User Prompt (danh sách mục) | ~100 tokens |
| Ảnh bàn tay (Groq Vision / Gemini) | ~800 - 1,200 tokens (tuỳ độ phân giải và model) |
| Kết quả phân tích (JSON) | 600 - 1,500 tokens (tuỳ số lượng mục chọn) |
| **Tổng mỗi lần gọi** | **~2,000 - 3,200 tokens** |

Hạn mức `AI_MAX_TOKENS=2000` cho output đủ để chứa trọn vẹn kết quả bói toàn bộ mà không bị cắt cụt JSON (`JSON.parse` thất bại).

## Pipeline Gọi AI & Xử lý Fallback

```text
App: [Camera hoặc thư viện ảnh] → tích đồng ý gửi AI và lưu Cloudinary
         │
         ▼
App POST /readings (image, school, topics, hand, aiConsent) + Idempotency-Key, trừ 5 GEM
         │
         ▼
Tiền xử lý ảnh trên RAM (Sharp):
resize 1280px, strip EXIF, quality 85
         │
         ▼
Gọi AI chính: Google Gemini API (gemini-3.8-flash)
         │
    ┌────┴────────────────────────┐
    │ Thành công                  │ Thất bại (429 Quota / Timeout / 5xx)
    ▼                             ▼
Sanitize & Validate           Gọi AI dự phòng: Groq (qwen/qwen3.8-27b)
(palmResultSchema)                │
    │                        ┌────┴────────────────────┐
    │                        │ Thành công              │ Thất bại
    ▼                        ▼                         ▼
Nếu isPalm === true:     Sanitize & Validate       Hoàn 5 GEM vào ví
Upload ảnh lên           (palmResultSchema)        Ghi nhận FAILED (không lưu ảnh)
Cloudinary + Lưu DB          │                     Trả lỗi 503 AI_UNAVAILABLE
    │                        ▼
    ▼                    Upload ảnh lên Cloudinary + Lưu DB
Trả kết quả 201              │
                             ▼
                         Trả kết quả 201
```

## Schema Kết quả (PalmResult & PalmLine)

Backend đảm bảo kết quả luận giải từ AI được kiểm tra qua `palmResultSchema` (Yup) (và `palmLines` nếu client gửi) được kiểm tra trước khi lưu vào MongoDB và trả cho client.

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| `isPalm` | boolean | bắt buộc; `false` → reading `REJECTED`, hoàn GEM, không lưu ảnh lên Cloudinary |
| `school` | `WESTERN` \| `EASTERN` \| `VEDIC` | phải trùng trường phái trong request |
| `hand` | `LEFT` \| `RIGHT` | server tự gắn bằng `hand` người dùng chọn trong request, không lấy từ AI |
| `imageQuality` | `GOOD` \| `FAIR` \| `POOR` | `POOR` vẫn trả kết quả, UI gợi ý chụp lại |
| `topics` | string[] | trùng `readings.topics` (server tự gắn, không lấy từ AI) |
| `sections` | array | đúng các mục riêng **được chọn**, đúng thứ tự chuẩn; mảng rỗng nếu không chọn mục riêng nào |
| `sections[].title` | string | ≤ 60 ký tự |
| `aspects` | object | đúng các khía cạnh **được chọn**; object rỗng nếu không chọn khía cạnh nào |
| `summary` | string | ≤ 300 ký tự |
| mọi chuỗi khác | string | ≤ 800 ký tự |

**Cấu trúc một phần tử trong `palmLines` (trường tuỳ chọn, do palm-service tạo; dữ liệu cũ từ bản web cũng có dạng này)**:

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `name` | `"life"` \| `"head"` \| `"heart"` \| `"other"` | Tên đường chỉ tay được phân loại theo giải phẫu |
| `points` | `[number, number][]` | Mảng tọa độ `[x, y]` chuẩn hoá `0..1` theo ảnh đã cắt (`annotatedImageUrl`), dọc theo nhánh dài nhất của đường, tối đa 128 điểm |
| `lengthRel` | `number` | Độ dài tương đối so với chiều dài lòng bàn tay (`fr.h`) |
| `curvature` | `number` | Độ cong (`>= 1.0`, `1.0` là thẳng) |
| `branches` | `number` | Số nhánh tạo nên đường chỉ tay |

**Xử lý lỗi nhà cung cấp**: HTTP 429 hoặc 5xx từ Gemini → thử `AI_FALLBACK_PROVIDER` (Groq) một lần; vẫn lỗi hoặc quá `AI_TIMEOUT_MS` → reading `FAILED`, hoàn GEM, trả `AI_UNAVAILABLE`.
