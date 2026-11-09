# palm-service

Dịch vụ Python vẽ đường chỉ tay cho PalmSight. Backend NestJS gọi nó song song với Gemini trong mỗi lần xem bói. Dịch vụ lỗi hoặc chậm thì lần xem vẫn hoàn tất, chỉ thiếu ảnh đã vẽ.

## Quy trình

```text
ảnh (đã xoay EXIF, xoá metadata ở backend)
  -> MediaPipe Hands: tìm bàn tay, loại mu bàn tay, cắt và xoay thẳng lòng bàn tay 512x512   app/palm_crop.py
  -> model ONNX: xác suất từng pixel là đường chỉ tay, ngưỡng 0.4                             app/line_model.py
  -> làm mảnh, nối nét, đặt tên life / head / heart                                          app/analyze_lines.py
  -> JSON PalmLineDto + JPEG đã vẽ 3 đường chính                                              app/pipeline.py
```

Code lấy từ bản thử nghiệm (`palm_lines.py`, `predict.py`, `analyze_lines.py`) và giữ nguyên ngưỡng, phép tính. `analyze_lines.py` được chép nguyên văn. Muốn chỉnh ngưỡng thì chỉnh ở bản thử nghiệm, kiểm chứng xong mới chép sang.

## API

| | |
| --- | --- |
| `GET /health` | `{"status": "ok"}` |
| `POST /v1/analyze` | Body là byte ảnh JPEG/PNG (tối đa 8 MB). Header `Authorization: Bearer <PALM_SERVICE_TOKEN>`. |

Kết quả thành công:

```json
{
  "ok": true,
  "lines": [{ "name": "life", "points": [[0.43, 0.32], ...], "lengthRel": 0.93, "curvature": 1.22, "branches": 1 }],
  "annotatedImage": "<base64 JPEG 512x512>",
  "hand": { "label": "Right", "score": 0.9 },
  "timingMs": { "crop": 93, "model": 327, "lines": 80 }
}
```

- `points` là `[x, y]` chuẩn hoá 0-1 **theo ảnh đã cắt `annotatedImage`**, không theo ảnh gốc. Mỗi đường lấy nhánh dài nhất, tối đa 128 điểm.
- `annotatedImage` chỉ vẽ 3 đường chính bằng màu (life xanh lá, head xanh dương, heart đỏ), không in tên đường vì app có 9 ngôn ngữ. Là `null` khi không tìm được đường chính nào.
- Ảnh không dùng được trả HTTP 200 với `{"ok": false, "reason": ...}`. Mã lý do: `invalid_image`, `no_hand`, `low_confidence`, `back_of_hand`, `hand_too_small`.
- `hand.label` là nhãn thô của MediaPipe bản legacy. Bản này coi ảnh là ảnh selfie đã lật gương, nên với ảnh camera sau nhãn **ngược** với tay thật: `righthand.jpg` (tay phải) cho `Left`. Chỉ dùng để ghi log; đừng dùng nó để từ chối lần xem khi chưa kiểm chứng trên ảnh camera trước.

Ảnh chỉ nằm trong bộ nhớ, không ghi ra đĩa và không ghi vào log.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PALM_SERVICE_TOKEN` | (bắt buộc) | Khoá dùng chung với backend. Thiếu thì dịch vụ không khởi động. |
| `PORT` | `8000` | Cổng HTTP |
| `MODEL_PATH` | `/models/palm_lines.onnx` | File model trong image |
| `ORT_THREADS` | `0` | Số luồng onnxruntime, 0 là tự chọn |

## Model

Model không nằm trong git (`*.onnx` bị ignore). `Dockerfile` tải nó lúc build từ `MODEL_URL` và kiểm tra `MODEL_SHA256`, sai checksum thì build dừng. Đổi model:

```bash
sha256sum palm_lines.onnx      # lấy checksum mới
# tải file mới lên R2, rồi sửa MODEL_URL và MODEL_SHA256 trong Dockerfile (hoặc truyền --build-arg)
```

URL `r2.dev` công khai: ai có link đều tải được model, và Cloudflare giới hạn tốc độ loại URL này. Tải một lần lúc build thì ổn; muốn giữ model riêng tư thì chuyển sang bucket riêng và truyền khoá qua build secret.

## Tài nguyên

Đo trong container trên ảnh mẫu: khoảng 475 MB RAM sau vài ảnh; ảnh đầu tiên khoảng 2 giây (MediaPipe khởi tạo), sau đó khoảng 0,7 giây mỗi ảnh. Image khoảng 2,2 GB. Cần máy **1 GB RAM** trở lên; gói 512 MB quá sát.

## Chạy local

```bash
cd palm-service
python -m venv .venv && .venv/Scripts/activate      # Windows; Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
MODEL_PATH="E:/AI test/palm_lines.onnx" PALM_SERVICE_TOKEN=dev-token uvicorn --factory app.main:app_factory --port 8000
```

Backend (`backend/.env`): `PALM_SERVICE_URL=http://localhost:8000`, `PALM_SERVICE_TOKEN=dev-token`.

Hoặc bằng Docker:

```bash
docker build -t palm-service palm-service
docker run --rm -p 8000:8000 -e PALM_SERVICE_TOKEN=dev-token palm-service
```

## Test

```bash
pytest tests/test_api.py                     # không cần model
MODEL_PATH="E:/AI test/palm_lines.onnx" PARITY_IMAGES="E:/AI test/hand.jpg" PARITY_OUT=parity_out pytest -s tests/test_parity.py
```

`test_parity.py` ghi ảnh đã vẽ vào `PARITY_OUT` để so bằng mắt với ô thứ ba của `*_compare.png` do `predict.py` tạo.
