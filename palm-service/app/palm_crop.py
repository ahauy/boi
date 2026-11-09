"""
Cắt và xoay thẳng lòng bàn tay bằng MediaPipe Hands.

Lấy từ palm_lines.py (v2) của bản thử nghiệm: detect_hand, facing_info, crop_palm_ex và các
hằng số đi kèm. Phép tính giữ nguyên để model nhận đúng kiểu ảnh lúc train. Khác bản gốc:
  - lý do bỏ qua là mã ngắn (no_hand, back_of_hand, ...) thay cho câu tiếng Việt;
  - trả thêm nhãn và độ tin cậy của MediaPipe để ghi log;
  - MediaPipe Hands tạo lần đầu khi dùng, không tạo lúc import.
"""
import threading

import cv2
import numpy as np

OUT_SIZE = 512
PALM_IDX = [0, 1, 2, 5, 9, 13, 17]  # cổ tay, gốc ngón cái, gốc 4 ngón còn lại

# Giữ nguyên giá trị đã hiệu chỉnh bằng `palm_lines.py --check` trên ảnh thật.
PALM_RULE_FLIP = False
# Độ tin cậy tối thiểu khi MediaPipe đoán tay trái/phải. Dưới mức này thì không dùng nhãn
# để kiểm tra mặt tay (xem crop_palm_ex), nhưng ảnh vẫn được cắt và vẽ.
HAND_SCORE_MIN = 0.7

_hands = None
_hands_lock = threading.Lock()


def _get_hands():
    global _hands
    with _hands_lock:
        if _hands is None:
            import mediapipe as mp

            _hands = mp.solutions.hands.Hands(
                static_image_mode=True, max_num_hands=1, min_detection_confidence=0.5
            )
        return _hands


def detect_hand(bgr):
    """Trả về (21 điểm mốc, nhãn Left/Right, độ tin cậy) hoặc None."""
    h, w = bgr.shape[:2]
    res = _get_hands().process(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    if not res.multi_hand_landmarks:
        return None
    lm = res.multi_hand_landmarks[0].landmark
    pts = np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float32)
    cls = res.multi_handedness[0].classification[0]
    return pts, cls.label, float(cls.score)


def facing_info(pts, label):
    """
    Phân biệt mặt lòng bàn tay / mu bàn tay.
    - MediaPipe cho biết đây là tay trái hay tay phải.
    - Từ các điểm mốc ta biết ngón cái nằm bên trái hay bên phải của ảnh (dấu của 'cross').
    Hai thông tin này ghép lại cho biết ta đang nhìn mặt nào của bàn tay.

    Lưu ý: MediaPipe bản legacy coi ảnh đầu vào là ảnh selfie đã lật gương, nên `label`
    không nhất thiết là tay thật của người dùng. Đừng dùng nó để từ chối lần xem khi chưa kiểm chứng.
    """
    a = pts[5] - pts[0]    # cổ tay -> gốc ngón trỏ
    b = pts[17] - pts[0]   # cổ tay -> gốc ngón út
    cross = float(a[0] * b[1] - a[1] * b[0])
    palm = (cross > 0 and label == "Right") or (cross < 0 and label == "Left")
    if PALM_RULE_FLIP:
        palm = not palm
    return palm, cross


def crop_palm_ex(bgr):
    """
    Trả về (kết quả, lý do, thông tin nhận diện):
      - kết quả: (ảnh lòng bàn tay 512x512, mask vùng lòng bàn tay, geom) hoặc None
      - lý do: None khi thành công, ngược lại là mã: no_hand | back_of_hand | hand_too_small
      - thông tin nhận diện: {"label", "score"} của MediaPipe, hoặc None khi không thấy tay
    """
    found = detect_hand(bgr)
    if found is None:
        return None, "no_hand", None
    pts, label, score = found
    detection = {"label": label, "score": round(score, 3)}
    # `score` là độ chắc chắn của nhãn trái/phải, không phải của việc tìm thấy bàn tay.
    # Việc cắt ảnh chỉ cần 21 điểm mốc. Nhãn chỉ dùng để phân biệt lòng bàn tay với mu bàn tay,
    # nên khi nhãn không chắc thì bỏ qua bước đó thay vì bỏ cả ảnh. Backend chỉ dùng kết quả
    # sau khi AI đã xác nhận ảnh là lòng bàn tay.
    # (Trước đây ảnh bị loại với lý do low_confidence, dù tay rõ ràng nhưng điểm trái/phải chỉ đạt 0,65.)
    if score >= HAND_SCORE_MIN:
        palm_side, _ = facing_info(pts, label)
        if not palm_side:
            return None, "back_of_hand", detection

    wrist, mid_mcp = pts[0], pts[9]
    palm_len = float(np.linalg.norm(mid_mcp - wrist))
    if palm_len < 20:
        return None, "hand_too_small", detection

    up = (mid_mcp - wrist) / palm_len
    down = -up
    right = np.array([down[1], -down[0]])
    center = (wrist + mid_mcp) / 2
    side = 1.7 * palm_len

    src = np.float32([
        center - right * side / 2 - down * side / 2,
        center + right * side / 2 - down * side / 2,
        center - right * side / 2 + down * side / 2,
    ])
    dst = np.float32([[0, 0], [OUT_SIZE, 0], [0, OUT_SIZE]])
    M = cv2.getAffineTransform(src, dst)
    palm = cv2.warpAffine(bgr, M, (OUT_SIZE, OUT_SIZE), flags=cv2.INTER_CUBIC)

    palm_pts = cv2.transform(pts[PALM_IDX].reshape(-1, 1, 2), M).reshape(-1, 2)

    # mở rộng mask về phía ngón út để không cắt mất đuôi trí đạo
    wrist_c, index_c, pinky_c = palm_pts[0], palm_pts[3], palm_pts[6]
    dir_x = 1.0 if pinky_c[0] > index_c[0] else -1.0
    extra = np.array([
        pinky_c + [dir_x * 0.10 * OUT_SIZE, 0],
        wrist_c + [dir_x * 0.12 * OUT_SIZE, 0],
    ])
    hull = cv2.convexHull(np.vstack([palm_pts, extra]).astype(np.int32))
    region = np.zeros((OUT_SIZE, OUT_SIZE), np.uint8)
    cv2.fillConvexPoly(region, hull, 255)
    region = cv2.erode(region, np.ones((9, 9), np.uint8))
    geom = {
        "thumb_side": "left" if dir_x > 0 else "right",  # dir_x > 0: ngón út ở bên phải ảnh
        "wrist": palm_pts[0].tolist(),
        "thumb_cmc": palm_pts[1].tolist(),
        "thumb_mcp": palm_pts[2].tolist(),
        "index_mcp": palm_pts[3].tolist(),
        "middle_mcp": palm_pts[4].tolist(),
        "ring_mcp": palm_pts[5].tolist(),
        "pinky_mcp": palm_pts[6].tolist(),
    }
    return (palm, region, geom), None, detection
