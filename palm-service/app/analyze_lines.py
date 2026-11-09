"""
analyze_lines.py - từ mask đường chỉ tay (đầu ra của model) đến kết quả có tên và số đo.

Các bước:
  1. Làm mảnh: thu mỗi nét về một đường tâm rộng 1 pixel (skeleton), bỏ nhánh cụt ngắn và mảnh nhiễu.
  2. Tách thành các "nhánh": cắt skeleton tại các điểm giao nhau (nơi 3 nét trở lên gặp nhau).
  3. Nối các nhánh đi tiếp nhau thẳng hướng qua điểm giao thành các "đường".
  4. Đặt tên: sinh đạo (life), trí đạo (head), tâm đạo (heart) bằng vị trí so với các điểm mốc bàn tay.
  5. Tính vài đặc trưng: độ dài, độ cong, vị trí.

Đây là bản LUẬT ĐƠN GIẢN (heuristic), dựa trên dáng bàn tay trung bình, nên sẽ có lúc đặt tên sai.
Cần kiểm tra bằng mắt trên nhiều ảnh. Ảnh kết quả vẽ mỗi đường một màu kèm tên.

Dùng trong code:
    from analyze_lines import analyze, draw
    lines = analyze(mask, geom)     # geom lấy từ palm_lines.crop_palm_ex
    cv2.imwrite("ket_qua.png", draw(palm_bgr, lines))
"""
import math

import cv2
import numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

SPUR_LEN = 12        # nhánh cụt ngắn hơn mức này (px) bị coi là râu thừa và bị cắt
MIN_LINE_LEN = 35    # đường ngắn hơn mức này (px) bị bỏ
JOIN_COS = 0.7       # hai nhánh nối thẳng hướng nếu cos(góc lệch) lớn hơn mức này (~45 độ)
GAP_PX = 40          # hai đầu nét tự do cách nhau không quá chừng này (px) mới được nối lại
GAP_COS = 0.7        # và phải cùng hướng (cos góc lệch lớn hơn mức này)
OVERLAP_OFFSET = 20  # với hai đoạn chồng lên nhau: độ lệch ngang tối đa (px)
KERNEL8 = np.ones((3, 3), np.uint8)

COLORS = {            # BGR
    "life": (0, 200, 0),
    "head": (255, 120, 0),
    "heart": (0, 0, 255),
    "other": (170, 170, 170),
}


# ---------------------------------------------------------------- skeleton
def _remove_small(mask, min_size):
    """Bỏ các mảng trắng nhỏ hơn min_size pixel (tự viết để không phụ thuộc phiên bản scikit-image)."""
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= min_size
    return keep[lab]


def _neighbors(skel):
    return cv2.filter2D(skel.astype(np.uint8), -1, KERNEL8, borderType=cv2.BORDER_CONSTANT) - skel.astype(np.uint8)


def _branches(skel):
    """Cắt skeleton tại điểm giao, trả về (ảnh nhãn nhánh, số nhánh, mask điểm giao)."""
    nb = _neighbors(skel)
    junction = skel & (nb >= 3)
    zone = cv2.dilate(junction.astype(np.uint8), KERNEL8) > 0
    labels, n = ndi.label(skel & ~zone, structure=np.ones((3, 3)))
    return labels, n, zone


def prune(skel):
    """Bỏ các râu thừa (nhánh cụt ngắn dính vào một nét dài hơn) rồi bỏ mảnh nhỏ."""
    skel = skel.copy()
    for _ in range(3):
        nb = _neighbors(skel)
        endpoints = skel & (nb == 1)
        labels, n, zone = _branches(skel)
        zone_d = cv2.dilate(zone.astype(np.uint8), KERNEL8) > 0
        removed = False
        for k in range(1, n + 1):
            m = labels == k
            if m.sum() < SPUR_LEN and (m & endpoints).any() and (m & zone_d).any():
                skel[m] = False
                removed = True
        # Xóa cả phần gốc râu thừa 1px nằm sát điểm giao (nằm trong zone nên bị sót)
        for _ in range(2):
            nb = _neighbors(skel)
            junction = skel & (nb >= 3)
            z = cv2.dilate(junction.astype(np.uint8), KERNEL8) > 0
            stubs = skel & (nb == 1) & z
            if stubs.any():
                skel[stubs] = False
                removed = True
        skel = skeletonize(skel)
        if not removed:
            break
    comp, n = ndi.label(skel, structure=np.ones((3, 3)))
    sizes = ndi.sum(skel, comp, range(1, n + 1))
    for k, s in enumerate(sizes, 1):
        if s < MIN_LINE_LEN:
            skel[comp == k] = False
    return skel


def _order_path(pts):
    """Sắp xếp các pixel của một nhánh (đường đơn) theo thứ tự dọc đường."""
    pts_set = {tuple(p) for p in pts}
    def nbrs(p):
        y, x = p
        return [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                if (dy or dx) and (y + dy, x + dx) in pts_set]
    start = next((p for p in pts_set if len(nbrs(p)) <= 1), next(iter(pts_set)))
    path, seen = [start], {start}
    cur = start
    while True:
        nxt = [q for q in nbrs(cur) if q not in seen]
        if not nxt:
            break
        # ưu tiên điểm kề trực tiếp (không chéo) để đi mượt
        nxt.sort(key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
        cur = nxt[0]
        path.append(cur)
        seen.add(cur)
    return np.array(path, dtype=np.float32)  # (y, x)


def _tangent(path, at_start, k=8):
    """Hướng đi VÀO điểm giao tại một đầu của nhánh (vector đơn vị, dạng (x, y))."""
    if len(path) < 3:
        return None
    k = min(k, len(path) - 1)
    a, b = (path[k], path[0]) if at_start else (path[-1 - k], path[-1])
    d = np.array([b[1] - a[1], b[0] - a[0]], dtype=np.float32)
    n = np.linalg.norm(d)
    return d / n if n > 0 else None


# ---------------------------------------------------------------- lines
def build_lines(skel):
    """Trả về danh sách đường; mỗi đường là mảng (N, 2) các điểm (y, x) theo thứ tự."""
    labels, n, zone = _branches(skel)
    paths = {k: _order_path(np.argwhere(labels == k)) for k in range(1, n + 1)}
    paths = {k: p for k, p in paths.items() if len(p) >= 5}

    # các đầu nhánh nằm cạnh điểm giao
    zone_lab, nz = ndi.label(zone, structure=np.ones((3, 3)))
    near = cv2.dilate(zone.astype(np.uint8), KERNEL8, iterations=2) > 0
    ends = []  # (nhánh, đầu: True=đầu đầu, cụm giao, hướng vào)
    for k, p in paths.items():
        for at_start in (True, False):
            y, x = map(int, p[0] if at_start else p[-1])
            if near[y, x]:
                t = _tangent(p, at_start)
                if t is None:
                    continue
                zl = zone_lab[max(0, y - 3):y + 4, max(0, x - 3):x + 4]
                zl = zl[zl > 0]
                if zl.size:
                    ends.append((k, at_start, int(np.bincount(zl).argmax()), t))

    # ghép các đầu nhánh thẳng hướng nhau tại mỗi điểm giao
    parent = {k: k for k in paths}
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    links = []
    for z in range(1, nz + 1):
        es = [e for e in ends if e[2] == z]
        cand = []
        for i in range(len(es)):
            for j in range(i + 1, len(es)):
                if es[i][0] == es[j][0]:
                    continue
                cos = float(np.dot(es[i][3], -es[j][3]))
                if cos > JOIN_COS:
                    cand.append((cos, i, j))
        used = set()
        for cos, i, j in sorted(cand, reverse=True):
            if i in used or j in used:
                continue
            used.update((i, j))
            links.append((es[i], es[j]))
            parent[find(es[i][0])] = find(es[j][0])

    # nối các đoạn bị ĐỨT: hai đầu tự do (không nằm ở điểm giao) ở gần nhau và cùng hướng
    free = []  # (nhánh, điểm (x, y), hướng đi ra ngoài)
    for k, p in paths.items():
        for at_start in (True, False):
            y, x = map(int, p[0] if at_start else p[-1])
            if near[y, x]:
                continue
            t = _tangent(p, at_start)
            if t is not None:
                free.append((k, np.array([x, y], dtype=np.float32), t))
    gaps = []
    for i in range(len(free)):
        for j in range(i + 1, len(free)):
            ki, pi, ti = free[i]
            kj, pj, tj = free[j]
            if find(ki) == find(kj):
                continue
            w = pj - pi
            dist = float(np.linalg.norm(w))
            if dist < 1 or dist > GAP_PX:
                continue
            w = w / dist
            end_to_end = float(np.dot(ti, w)) > GAP_COS and float(np.dot(tj, -w)) > GAP_COS
            # hai đoạn chồng lên nhau một chút (đầu nọ đã đi qua đầu kia) nhưng lệch ngang ít
            lateral = abs(float(ti[0] * w[1] - ti[1] * w[0])) * dist
            overlap = float(np.dot(ti, tj)) < -GAP_COS and lateral < OVERLAP_OFFSET
            if end_to_end or overlap:
                gaps.append((dist, i, j))
    used_ends = set()
    for dist, i, j in sorted(gaps):
        if i in used_ends or j in used_ends:
            continue
        used_ends.update((i, j))
        parent[find(free[i][0])] = find(free[j][0])

    groups = {}
    for k in paths:
        groups.setdefault(find(k), []).append(k)

    lines = []
    for ks in groups.values():
        pts = np.vstack([paths[k] for k in ks])
        length = sum(_path_len(paths[k]) for k in ks)
        if length >= MIN_LINE_LEN:
            lines.append({"points": pts, "length_px": float(length), "n_branches": len(ks),
                          "paths": [paths[k] for k in ks]})
    return lines


def _path_len(p):
    d = np.diff(p, axis=0)
    return float(np.sqrt((d ** 2).sum(1)).sum())


# ---------------------------------------------------------------- naming
class Frame:
    """Hệ tọa độ theo giải phẫu: v = 0 ở hàng gốc ngón tay, 1 ở cổ tay; u = 0 ở gốc ngón út, 1 ở gốc ngón trỏ."""

    def __init__(self, geom):
        mcp = np.array([geom["index_mcp"], geom["middle_mcp"], geom["ring_mcp"], geom["pinky_mcp"]])
        self.y_top = float(mcp[:, 1].mean())
        self.y_bot = float(geom["wrist"][1])
        self.x_pinky = float(geom["pinky_mcp"][0])
        self.x_index = float(geom["index_mcp"][0])
        self.h = max(self.y_bot - self.y_top, 1.0)
        self.w = max(abs(self.x_index - self.x_pinky), 1.0)

    def uv(self, yx):
        y, x = yx[..., 0], yx[..., 1]
        return (x - self.x_pinky) / (self.x_index - self.x_pinky), (y - self.y_top) / self.h


def name_lines(lines, geom):
    """Gán tên cho từng đường (sinh đạo / trí đạo / tâm đạo / khác) và tính đặc trưng."""
    fr = Frame(geom)
    for ln in lines:
        p = ln["points"]
        u, v = fr.uv(p)
        # đầu mút = 2 điểm xa nhau nhất theo thứ tự lưu (xấp xỉ bằng điểm đầu/cuối của đường dài nhất)
        main = max(ln["paths"], key=len)
        a, b = main[0], main[-1]
        ua, va = fr.uv(a)
        ub, vb = fr.uv(b)
        ln.update(u_mean=float(u.mean()), v_mean=float(v.mean()),
                  du=float(u.max() - u.min()), dv=float(v.max() - v.min()),
                  u_min=float(u.min()), u_max=float(u.max()),
                  v_min=float(v.min()), v_max=float(v.max()))
        ln["name"] = "other"

    # sinh đạo: dài, chủ yếu đi dọc, nằm ở nửa gần ngón cái (u lớn), kéo xuống gần cổ tay
    best, best_score = None, 0.0
    for ln in lines:
        vertical = ln["dv"] * fr.h > ln["du"] * fr.w
        if vertical and ln["u_mean"] > 0.55 and ln["u_max"] > 0.7 and ln["dv"] > 0.25:
            score = ln["length_px"] * ln["dv"] * ln["v_max"]
            if score > best_score:
                best, best_score = ln, score
    if best is not None:
        best["name"] = "life"

    # trí đạo và tâm đạo: các đường nằm ngang, đủ dài
    horiz = [ln for ln in lines if ln["name"] == "other"
             and ln["du"] * fr.w >= ln["dv"] * fr.h * 0.8 and ln["length_px"] >= 0.25 * fr.w]
    horiz.sort(key=lambda ln: ln["v_mean"])
    if len(horiz) >= 2:
        # tâm đạo = đường nằm cao hơn (gần gốc ngón tay), trí đạo = đường nằm thấp hơn
        horiz[0]["name"] = "heart"
        lower = [ln for ln in horiz[1:]]
        lower.sort(key=lambda ln: -ln["length_px"])
        lower[0]["name"] = "head"
    elif len(horiz) == 1:
        ln = horiz[0]
        # một đường ngang duy nhất: nằm cao thì là tâm đạo, thấp thì là trí đạo
        ln["name"] = "heart" if ln["v_mean"] < 0.3 else "head"

    for ln in lines:
        main = max(ln["paths"], key=len)
        chord = float(np.linalg.norm(main[0] - main[-1]))
        mlen = _path_len(main)
        ln["features"] = {
            "length_rel": round(ln["length_px"] / fr.h, 3),      # độ dài so với chiều dài lòng bàn tay
            "curvature": round(mlen / chord, 3) if chord > 1 else 1.0,  # 1.0 = thẳng, càng lớn càng cong
            "v_mean": round(ln["v_mean"], 3),
            "u_mean": round(ln["u_mean"], 3),
            "branches": ln["n_branches"],
        }
    return lines


# ---------------------------------------------------------------- public API
def analyze(mask, geom, min_blob=60):
    """mask: ảnh 0/255 do model trả về. geom: dict các điểm mốc trong ảnh lòng bàn tay đã cắt."""
    m = _remove_small(mask > 0, min_blob)
    skel = prune(skeletonize(m))
    lines = build_lines(skel)
    return name_lines(lines, geom)


def draw(palm_bgr, lines):
    out = palm_bgr.copy()
    for ln in lines:
        col = COLORS[ln["name"]]
        for y, x in ln["points"].astype(int):
            cv2.circle(out, (int(x), int(y)), 2, col, -1)
        main = max(ln["paths"], key=len)
        y, x = main[len(main) // 2].astype(int)
        cv2.putText(out, ln["name"], (int(x) + 6, int(y) - 6), cv2.FONT_HERSHEY_SIMPLEX,
                    0.55, col, 2, cv2.LINE_AA)
    return out


def summary(lines):
    """Bản tóm tắt dễ đọc / dễ chuyển thành JSON."""
    return [{"name": ln["name"], **ln["features"]} for ln in lines]
