"""
API của dịch vụ vẽ đường chỉ tay.

    GET  /health        -> {"status": "ok"}
    POST /v1/analyze    -> body là byte ảnh (image/jpeg hoặc image/png),
                           header Authorization: Bearer <PALM_SERVICE_TOKEN>

Biến môi trường:
    PALM_SERVICE_TOKEN  bắt buộc; backend gửi cùng giá trị
    MODEL_PATH          mặc định /models/palm_lines.onnx
    ORT_THREADS         số luồng onnxruntime (0 = để onnxruntime tự chọn)
    PORT                cổng HTTP (đọc trong Dockerfile)
"""
import hmac
import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from . import pipeline

MAX_BYTES = 8 * 1024 * 1024  # cùng giới hạn với backend

log = logging.getLogger("palm-service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(model=None, token: str | None = None) -> FastAPI:
    expected_token = token if token is not None else os.environ.get("PALM_SERVICE_TOKEN", "")
    if not expected_token:
        # Không có token thì ai cũng gọi được và đẩy ảnh vào: không cho chạy.
        raise RuntimeError("PALM_SERVICE_TOKEN is required")

    # MediaPipe Hands dùng chung một đối tượng và không an toàn khi chạy song song: xử lý từng ảnh một.
    infer_lock = threading.Lock()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if model is None:
            from .line_model import load_from_env

            app.state.model = load_from_env()
            log.info("model loaded")
        else:
            app.state.model = model
        yield

    app = FastAPI(title="PalmSight palm-lines", docs_url=None, redoc_url=None, lifespan=lifespan)

    def check_auth(request: Request):
        header = request.headers.get("authorization", "")
        scheme, _, value = header.partition(" ")
        if scheme.lower() != "bearer" or not hmac.compare_digest(value.encode(), expected_token.encode()):
            raise HTTPException(status_code=401, detail="unauthorized")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/v1/analyze")
    async def analyze(request: Request):
        check_auth(request)
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="image too large")
        data = await request.body()
        if not data:
            raise HTTPException(status_code=400, detail="empty body")
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="image too large")

        def work():
            with infer_lock:
                return pipeline.run(data, request.app.state.model)

        try:
            result = await run_in_threadpool(work)
        except pipeline.InvalidImage:
            return {"ok": False, "reason": "invalid_image", "hand": None}
        except Exception:
            # Chỉ ghi loại lỗi và stack, không ghi byte ảnh.
            log.exception("analyze failed")
            raise HTTPException(status_code=500, detail="analyze failed")

        if result["ok"]:
            log.info("analyze ok lines=%d timing=%s", len(result["lines"]), result["timingMs"])
        else:
            log.info("analyze skipped reason=%s", result["reason"])
        return result

    return app


def app_factory() -> FastAPI:
    """Dùng với `uvicorn --factory app.main:app_factory`."""
    return create_app()
