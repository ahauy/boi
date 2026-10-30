# ai-integration — Tích hợp AI (Vẽ chỉ tay ONNX & Luận giải LLM)

Hệ thống PalmSight kết hợp **2 mô hình AI chuyên biệt**:

1. **Mô hình AI Vẽ Chỉ Tay (`palm_lines.onnx` + MediaPipe Hands + OpenCV/Canvas)**: Chạy trực tiếp từ file `.onnx` (không cần deploy server Python riêng), chuyên phát hiện tọa độ bàn tay, cắt xoay thẳng vùng lòng bàn tay `512×512` và vẽ đè các đường chỉ tay (Sinh đạo, Trí đạo, Tâm đạo, đường phụ). **Mô hình này chỉ dùng để vẽ chỉ tay từ ảnh của người dùng, không sinh văn bản luận giải.**
2. **Mô hình AI Luận Giải (Google Gemini API / Groq)**: Nhận ảnh bàn tay và viết bài luận giải chi tiết theo trường phái và các mục người dùng đã chọn.

| Thành phần | Vai trò | Ghi chú |
| --- | --- | --- |
| **MediaPipe Hands** (`@mediapipe/tasks-vision`) | Phát hiện 21 điểm mốc bàn tay, kiểm tra trái/phải và mặt lòng bàn tay | Chạy trực tiếp trên trình duyệt (WebGL/WASM) |
| **OpenCV / Canvas Affine Crop** | Xoay thẳng trục cổ tay → ngón giữa, cắt vùng lòng bàn tay `512×512` và tạo mask `region` | Biến đổi hình học chuẩn hóa đầu vào cho ONNX |
| **Model U-Net ONNX** (`palm_lines.onnx`) | Phân đoạn pixel đường chỉ tay → làm mảnh (skeletonize) → nối nhánh → đặt tên & vẽ đường chỉ tay | Chạy bằng `onnxruntime-web` (WASM/WebGPU), không cần server riêng |
| **Google Gemini API** (free tier) — chính | Model vision đọc ảnh và viết bài luận giải | Gemini 3.8 Flash |
| **Groq** (free API key) — dự phòng | Fallback khi Gemini hết quota hoặc lỗi | API tương thích OpenAI |

ngrok xuất hiện trong tài liệu chỉ là công cụ dev, không liên quan tới AI: nó mở server local ra HTTPS để test Facebook Login và camera điện thoại (`getUserMedia` chỉ chạy trên HTTPS).

---

## 1. Pipeline AI Vẽ Chỉ Tay bằng File `.onnx` (Không cần Server Python riêng)

Toàn bộ luồng phát hiện và vẽ đường chỉ tay từ dự án `AI test` (`palm_lines.py` → `predict.py` → `analyze_lines.py`) được đóng gói và chạy trực tiếp qua file `.onnx` theo workflow 5 bước:

```text
[Camera Frame / Ảnh tải lên]
          │
          ▼
[MediaPipe Hands]
(Tìm 21 tọa độ điểm mốc bàn tay, kiểm tra mặt lòng bàn tay / mu bàn tay)
          │
          ▼
[OpenCV / Canvas Affine Transform]
(Xoay thẳng hướng cổ tay -> gốc ngón giữa, cắt vùng lòng bàn tay 512×512 + mask đa giác lồi)
          │
          ▼
[Mô hình AI đã train (palm_lines.onnx)]
(Chạy ONNX Inference -> Bản đồ xác suất -> Skeletonize & Nối nhánh -> Định danh life / head / heart / other -> Vẽ đè lên ảnh)
          │
          ▼
[Lưu ảnh lên Cloudinary & Hiển thị kết quả bói toán lên màn hình]
```

### Chi tiết từng bước trong Pipeline `.onnx`

1. **Bước 1 — Tìm tọa độ bàn tay (`MediaPipe Hands`)**:
   - Trích xuất 21 điểm mốc (`landmarks`) từ khung hình camera hoặc ảnh tải lên.
   - Kiểm tra độ tin cậy (`score >= 0.7`) và tính tích có hướng (`cross product`) giữa vector `cổ tay → gốc ngón trỏ` (`pts[5] - pts[0]`) và `cổ tay → gốc ngón út` (`pts[17] - pts[0]`) để xác nhận ảnh chụp đúng **mặt lòng bàn tay** (loại bỏ ảnh chụp mu bàn tay).

2. **Bước 2 — Cắt và xoay thẳng vùng lòng bàn tay (`OpenCV / Canvas Affine`)**:
   - Lấy điểm cổ tay (`wrist = pts[0]`) và gốc ngón giữa (`mid_mcp = pts[9]`) làm trục chuẩn.
   - Dựng khung vuông cạnh `side = 1.7 * palm_len` quanh tâm `(wrist + mid_mcp) / 2`, áp dụng phép biến đổi Affine (`warpAffine`) để xoay thẳng bàn tay và đưa về kích thước chuẩn `512×512`.
   - Biến đổi 7 điểm mốc vùng lòng bàn tay (`PALM_IDX = [0, 1, 2, 5, 9, 13, 17]`) sang hệ tọa độ `512×512`, mở rộng nhẹ về phía ngón út (`10%–12%`) để không cắt mất đuôi đường Trí đạo/Tâm đạo, rồi dựng đa giác lồi (`convexHull`) và co nhẹ (`erode`) tạo thành mặt nạ vùng lòng bàn tay `region` cùng hệ tọa độ giải phẫu `geom`.

3. **Bước 3 — Phân đoạn nét bằng mô hình `palm_lines.onnx`**:
   - Chuẩn hóa ảnh RGB `512×512` về kiểu `float32` theo hằng số ImageNet:
     - `MEAN = [0.485, 0.456, 0.406]`
     - `STD = [0.229, 0.224, 0.225]`
     - `x = (rgb / 255.0 - MEAN) / STD`, tensor đầu vào kích thước `[1, 3, 512, 512]`.
   - Chạy inference qua `onnxruntime-web` (trên trình duyệt bằng WebAssembly/WebGPU) để lấy `logits`.
   - Tính xác suất từng pixel `prob = 1 / (1 + exp(-logits))`, lọc ngưỡng `THRESH = 0.4`, giao với mặt nạ vùng lòng bàn tay (`region > 0`) và loại bỏ các mảng nhiễu nhỏ hơn `150 pixel`.

4. **Bước 4 — Làm mảnh, nối nhánh và định danh đường chỉ tay (`analyze_lines`)**:
   - **Thu mảnh (`skeletonize` & `prune`)**: Đưa các nét về đường tâm rộng 1 pixel, cắt bỏ các nhánh râu thừa ngắn (`SPUR_LEN = 12 px`) tại điểm giao và bỏ các đoạn vụn ngắn hơn `MIN_LINE_LEN = 35 px`.
   - **Tách và nối nhánh (`build_lines`)**: Tách skeleton tại các điểm giao (nơi $\ge 3$ nét gặp nhau), ghép các nhánh đi thẳng hướng qua điểm giao (`cos > 0.7`, góc lệch $< 45^\circ$) và nối các đoạn đứt gần nhau cùng hướng (`GAP_PX = 40 px`).
   - **Định danh theo hệ tọa độ giải phẫu `Frame(geom)` (`name_lines`)**:
     - `life` (**Đường Sinh Đạo** — vẽ màu xanh lá `#00c800`): Đường dài, đi dọc theo nửa gần ngón cái (`u_mean > 0.55`, `u_max > 0.7`, `dv > 0.25`), vòng xuống cổ tay.
     - `heart` (**Đường Tâm Đạo** — vẽ màu đỏ `#ff0000`): Đường nằm ngang ở vị trí cao hơn, gần hàng gốc các ngón tay.
     - `head` (**Đường Trí Đạo** — vẽ màu xanh dương/cam `#0078ff`): Đường nằm ngang dài ở vị trí thấp hơn đường Tâm đạo.
     - `other` (**Đường phụ** — vẽ màu xám `#aaaaaa`): Các đường chỉ phụ khác.
   - **Vẽ đè (`draw`)**: Vẽ từng đường theo màu quy ước và gắn nhãn (`life`, `head`, `heart`) lên ảnh lòng bàn tay (hoặc trả về mảng tọa độ `palmLines` để render lớp overlay tương tác).

---

## 2. Nhà cung cấp AI Luận Giải & Lưu trữ Cloudinary

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
- Khi `result.isPalm === true`, upload ảnh lòng bàn tay (đã xóa EXIF) và ảnh đã vẽ chỉ tay lên **Cloudinary**, lưu `imageUrl`, `annotatedImageUrl`, `imagePublicId` và `palmLines` vào document `readings` ([ADR-0011](adr/0011-cloudinary-image-storage-and-onnx-palm-lines.md)).

## Trường phái bói

Người dùng chọn một trường phái trước khi chụp. AI vẫn đọc toàn bộ bàn tay, nhưng diễn giải và trình bày theo trường phái đã chọn. Mọi trường phái đều tốn 1 credit. Danh sách trường phái và các mục bên dưới là **đề xuất**, có thể thêm/bớt.

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
| Giá | Luôn 1 credit, dù chọn 1 mục hay toàn bộ |

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

## Pipeline Gọi AI, Vẽ Chỉ Tay & Xử lý Fallback

```text
Client: [Camera Frame] → [MediaPipe Hands] → [OpenCV/Canvas Crop 512x512] → [ONNX palm_lines.onnx vẽ chỉ tay]
         │
         ▼
Client POST /readings (image, annotatedImage / palmLines, school, topics, hand, aiConsent)
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
Nếu isPalm === true:     Sanitize & Validate       Hoàn 1 credit vào ví
Upload ảnh lên           (palmResultSchema)        Ghi nhận FAILED (không lưu ảnh)
Cloudinary + Lưu DB          │                     Trả lỗi 503 AI_UNAVAILABLE
    │                        ▼
    ▼                    Upload ảnh lên Cloudinary + Lưu DB
Trả kết quả 201              │
                             ▼
                         Trả kết quả 201
```

## Schema Kết quả (PalmResult & PalmLine)

Backend đảm bảo kết quả luận giải từ AI được kiểm tra qua `palmResultSchema` (Yup) và dữ liệu đường chỉ tay từ model ONNX được kiểm tra qua `palmLineSchema` trước khi lưu vào MongoDB và trả cho client.

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| `isPalm` | boolean | bắt buộc; `false` → reading `REJECTED`, hoàn credit, không lưu ảnh lên Cloudinary |
| `school` | `WESTERN` \| `EASTERN` \| `VEDIC` | phải trùng trường phái trong request |
| `hand` | `LEFT` \| `RIGHT` | server tự gắn bằng `hand` người dùng chọn trong request, không lấy từ AI |
| `imageQuality` | `GOOD` \| `FAIR` \| `POOR` | `POOR` vẫn trả kết quả, UI gợi ý chụp lại |
| `topics` | string[] | trùng `readings.topics` (server tự gắn, không lấy từ AI) |
| `sections` | array | đúng các mục riêng **được chọn**, đúng thứ tự chuẩn; mảng rỗng nếu không chọn mục riêng nào |
| `sections[].title` | string | ≤ 60 ký tự |
| `aspects` | object | đúng các khía cạnh **được chọn**; object rỗng nếu không chọn khía cạnh nào |
| `summary` | string | ≤ 300 ký tự |
| mọi chuỗi khác | string | ≤ 800 ký tự |

**Cấu trúc một phần tử trong `palmLines` (kết quả từ model ONNX)**:

| Trường | Kiểu | Mô tả |
| --- | --- | --- |
| `name` | `"life"` \| `"head"` \| `"heart"` \| `"other"` | Tên đường chỉ tay được phân loại theo giải phẫu |
| `points` | `[number, number][]` | Mảng tọa độ `[x, y]` (chuẩn hóa `0..1` hoặc trên khung `512×512`) dọc theo đường chỉ tay để vẽ polyline |
| `lengthRel` | `number` | Độ dài tương đối so với chiều dài lòng bàn tay (`fr.h`) |
| `curvature` | `number` | Độ cong (`>= 1.0`, `1.0` là thẳng) |
| `branches` | `number` | Số nhánh tạo nên đường chỉ tay |

**Xử lý lỗi nhà cung cấp**: HTTP 429 hoặc 5xx từ Gemini → thử `AI_FALLBACK_PROVIDER` (Groq) một lần; vẫn lỗi hoặc quá `AI_TIMEOUT_MS` → reading `FAILED`, hoàn credit, trả `AI_UNAVAILABLE`.
