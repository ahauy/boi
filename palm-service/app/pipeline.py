"""
Toàn bộ quy trình cho một ảnh:
    ảnh JPEG/PNG -> (MediaPipe) cắt, xoay thẳng lòng bàn tay -> (ONNX) mask đường chỉ tay
    -> (analyze_lines) làm mảnh, nối nét, đặt tên -> JSON + ảnh đã vẽ 3 đường chính

Ảnh chỉ nằm trong bộ nhớ, không ghi ra đĩa.
"""
import base64
import time

import cv2
import numpy as np

from . import analyze_lines
from .line_model import LineModel
from .palm_crop import OUT_SIZE, crop_palm_ex

MAIN_LINES = ("life", "head", "heart")
# Số điểm tối đa cho mỗi đường gửi về backend (parsePalmLinesInput giữ tối đa 512).
MAX_POINTS = 128
MAX_SIDE = 2048  # ảnh lớn hơn thì thu nhỏ trước khi đưa vào MediaPipe
JPEG_QUALITY = 90


class InvalidImage(ValueError):
    pass


def decode_image(data: bytes):
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise InvalidImage("cannot decode image")
    h, w = bgr.shape[:2]
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        bgr = cv2.resize(bgr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return bgr


def _subsample(path, limit=MAX_POINTS):
    """Giữ thứ tự dọc đường, lấy đều tối đa `limit` điểm, luôn giữ hai đầu mút."""
    n = len(path)
    if n <= limit:
        return path
    idx = np.unique(np.linspace(0, n - 1, limit).round().astype(int))
    return path[idx]


def draw_lines(palm_bgr, lines):
    """Vẽ các đường bằng màu như analyze_lines.draw nhưng không in tên (app có 9 ngôn ngữ)."""
    out = palm_bgr.copy()
    for ln in lines:
        col = analyze_lines.COLORS[ln["name"]]
        for y, x in ln["points"].astype(int):
            cv2.circle(out, (int(x), int(y)), 2, col, -1)
    return out


def to_dto(lines):
    """Đổi kết quả analyze_lines sang dạng PalmLineDto của @palmsight/shared.

    analyze_lines lưu điểm dạng (y, x) theo pixel của ảnh đã cắt 512x512. DTO dùng [x, y]
    chuẩn hoá 0-1 theo chính ảnh đã cắt đó (ảnh annotatedImage), không phải ảnh gốc.
    Mỗi đường lấy nhánh dài nhất, vì các nhánh nối nhau có thể không liền mạch.
    """
    out = []
    for ln in lines:
        main = max(ln["paths"], key=len)
        pts = _subsample(main)
        points = [[round(float(x) / OUT_SIZE, 4), round(float(y) / OUT_SIZE, 4)] for y, x in pts]
        if len(points) < 2:
            continue
        feats = ln["features"]
        out.append({
            "name": ln["name"],
            "points": points,
            "lengthRel": feats["length_rel"],
            "curvature": feats["curvature"],
            "branches": int(feats["branches"]),
        })
    return out


def run(data: bytes, model: LineModel) -> dict:
    """Trả về dict JSON cho API. Ảnh không dùng được thì ok=False kèm mã lý do (không ném lỗi)."""
    t0 = time.perf_counter()
    bgr = decode_image(data)

    result, reason, detection = crop_palm_ex(bgr)
    t_crop = time.perf_counter()
    if result is None:
        return {"ok": False, "reason": reason, "hand": detection}
    palm, region, geom = result

    mask = model.predict_mask(palm, region)
    t_model = time.perf_counter()

    lines = analyze_lines.analyze(mask, geom)
    main = [ln for ln in lines if ln["name"] in MAIN_LINES]
    t_lines = time.perf_counter()

    annotated = None
    if main:
        drawn = draw_lines(palm, main)
        ok, buf = cv2.imencode(".jpg", drawn, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if ok:
            annotated = base64.b64encode(buf.tobytes()).decode("ascii")

    return {
        "ok": True,
        "lines": to_dto(lines),
        "annotatedImage": annotated,
        "hand": detection,
        "timingMs": {
            "crop": round((t_crop - t0) * 1000),
            "model": round((t_model - t_crop) * 1000),
            "lines": round((t_lines - t_model) * 1000),
        },
    }
