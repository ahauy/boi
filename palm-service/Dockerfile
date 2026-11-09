# syntax=docker/dockerfile:1
# Dịch vụ vẽ đường chỉ tay (MediaPipe + model ONNX). Build từ thư mục palm-service/:
#   docker build -t palm-service .
#   docker run --rm -p 8000:8000 -e PALM_SERVICE_TOKEN=dev-token palm-service
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# mediapipe kéo theo opencv-contrib-python bản có GUI, cần libGL và glib dù không mở cửa sổ nào.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

# Model tải lúc build (không tải lúc khởi động) và phải khớp SHA-256, sai thì build dừng.
# Đổi model: cập nhật cả hai ARG, hoặc truyền --build-arg khi build.
ARG MODEL_URL=https://pub-d76d41e7b18e4b89949a626c28eb4527.r2.dev/palm_lines.onnx
ARG MODEL_SHA256=2cfbceee3a26c7223f6d4e3a0d9227b5e7102393e0c72a36615586cb95506d17
COPY scripts/fetch_model.py scripts/fetch_model.py
RUN python scripts/fetch_model.py "$MODEL_URL" "$MODEL_SHA256" /models/palm_lines.onnx

COPY app/ app/

RUN useradd --system --uid 1001 --no-create-home palm
USER palm

ENV MODEL_PATH=/models/palm_lines.onnx \
    PORT=8000
EXPOSE 8000

# Một worker: MediaPipe Hands không chạy song song được, ảnh xử lý lần lượt (khoảng 0,5 giây mỗi ảnh).
CMD ["sh", "-c", "exec uvicorn --factory app.main:app_factory --host 0.0.0.0 --port ${PORT} --workers 1"]
