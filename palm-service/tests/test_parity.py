"""
Chạy pipeline thật trên ảnh mẫu để so với kết quả của bản thử nghiệm.
Cần model và ảnh thật, nên mặc định bỏ qua:

    MODEL_PATH=/đường/dẫn/palm_lines.onnx PARITY_IMAGES="hand.jpg,righthand.jpg" \
    PARITY_OUT=ket_qua_service pytest tests/test_parity.py -s

Mỗi ảnh ghi ra <PARITY_OUT>/<tên>_service.jpg (ảnh đã vẽ) và <tên>_service.json để so bằng mắt
với ô thứ ba của *_compare.png do predict.py tạo.
"""
import base64
import json
import os
from pathlib import Path

import pytest

MODEL_PATH = os.environ.get("MODEL_PATH", "")
IMAGES = [p for p in os.environ.get("PARITY_IMAGES", "").split(",") if p]

pytestmark = pytest.mark.skipif(
    not (MODEL_PATH and Path(MODEL_PATH).exists() and IMAGES),
    reason="cần MODEL_PATH và PARITY_IMAGES",
)


@pytest.mark.parametrize("image", IMAGES)
def test_pipeline_on_real_image(image):
    from app import pipeline
    from app.line_model import LineModel

    model = LineModel(MODEL_PATH)
    result = pipeline.run(Path(image).read_bytes(), model)
    out_dir = Path(os.environ.get("PARITY_OUT", "parity_out"))
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image).stem
    summary = {k: v for k, v in result.items() if k != "annotatedImage"}
    (out_dir / f"{stem}_service.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    if result.get("annotatedImage"):
        (out_dir / f"{stem}_service.jpg").write_bytes(base64.b64decode(result["annotatedImage"]))
    print(stem, json.dumps({
        "ok": result["ok"],
        "reason": result.get("reason"),
        "hand": result.get("hand"),
        "lines": [(ln["name"], ln["lengthRel"], ln["curvature"], len(ln["points"])) for ln in result.get("lines", [])],
        "timingMs": result.get("timingMs"),
    }, ensure_ascii=False))
    assert result["ok"], result.get("reason")
