"""
Chạy model ONNX tìm đường chỉ tay trên ảnh lòng bàn tay 512x512.

Lấy từ predict.py (v2) của bản thử nghiệm: predict_prob và predict_mask, giữ nguyên ngưỡng
và chuẩn hoá. Model nhận tensor "image" 1x3x512x512 (RGB, chuẩn hoá ImageNet) và trả logit
từng pixel; sigmoid ra xác suất là đường chỉ tay.
"""
import os

import cv2
import numpy as np
import onnxruntime as ort
from skimage.morphology import remove_small_objects

THRESH = 0.4       # xác suất lớn hơn mức này thì coi là đường chỉ tay (thấp hơn = vẽ nhiều hơn)
MIN_SIZE = 150     # bỏ các mảnh nét nhỏ hơn mức này (nhiễu)
USE_REGION = True  # chỉ giữ nét nằm trong vùng lòng bàn tay (giống lúc tạo dữ liệu)

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


class LineModel:
    def __init__(self, model_path: str, threads: int | None = None):
        opts = ort.SessionOptions()
        if threads:
            opts.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])

    def predict_prob(self, palm_bgr):
        """Đưa ảnh lòng bàn tay (512x512) qua model, trả về bản đồ xác suất 0-1 cho từng pixel."""
        rgb = cv2.cvtColor(palm_bgr, cv2.COLOR_BGR2RGB)
        x = (rgb.astype(np.float32) / 255.0 - MEAN) / STD       # giống hệt lúc train
        x = x.transpose(2, 0, 1)[None].astype(np.float32)
        logits = self.sess.run(None, {"image": x})[0][0, 0]
        return 1.0 / (1.0 + np.exp(-logits))                    # sigmoid

    def predict_mask(self, palm_bgr, region=None, prob=None):
        """Trả về mask 0/255. Có thể truyền sẵn prob để khỏi chạy model lần nữa."""
        if prob is None:
            prob = self.predict_prob(palm_bgr)
        mask = prob > THRESH
        if USE_REGION and region is not None:
            mask &= region > 0
        mask = remove_small_objects(mask, min_size=MIN_SIZE)
        return (mask * 255).astype(np.uint8)


def load_from_env() -> LineModel:
    path = os.environ.get("MODEL_PATH", "/models/palm_lines.onnx")
    threads = int(os.environ.get("ORT_THREADS", "0")) or None
    return LineModel(path, threads)
