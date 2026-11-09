"""Test API và phần chuyển đổi, không cần file model (dùng model giả)."""
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import pipeline
from app.main import create_app

TOKEN = "test-token"


class FakeModel:
    def predict_mask(self, palm_bgr, region=None, prob=None):
        return np.zeros(palm_bgr.shape[:2], np.uint8)


@pytest.fixture()
def client():
    app = create_app(model=FakeModel(), token=TOKEN)
    with TestClient(app) as c:
        yield c


def auth():
    return {"Authorization": f"Bearer {TOKEN}"}


def jpeg(color=(200, 200, 200), size=(64, 64)):
    img = np.full((size[1], size[0], 3), color, np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_requires_token_to_start():
    with pytest.raises(RuntimeError):
        create_app(model=FakeModel(), token="")


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_rejects_missing_or_wrong_token(client):
    assert client.post("/v1/analyze", content=jpeg()).status_code == 401
    bad = {"Authorization": "Bearer nope"}
    assert client.post("/v1/analyze", content=jpeg(), headers=bad).status_code == 401


def test_rejects_empty_body(client):
    assert client.post("/v1/analyze", content=b"", headers=auth()).status_code == 400


def test_rejects_oversized_body(client):
    big = b"\xff" * (8 * 1024 * 1024 + 1)
    assert client.post("/v1/analyze", content=big, headers=auth()).status_code == 413


def test_invalid_image_is_not_a_server_error(client):
    res = client.post("/v1/analyze", content=b"not an image", headers=auth())
    assert res.status_code == 200
    assert res.json() == {"ok": False, "reason": "invalid_image", "hand": None}


def test_image_without_hand(client):
    res = client.post("/v1/analyze", content=jpeg(), headers=auth())
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert body["reason"] == "no_hand"


def test_to_dto_swaps_axes_normalises_and_subsamples():
    path = np.array([[y, 100.0] for y in range(300)], np.float32)  # (y, x)
    lines = [{
        "name": "life",
        "paths": [path[:10], path],
        "features": {"length_rel": 0.8, "curvature": 1.05, "branches": 2, "v_mean": 0, "u_mean": 0},
    }]
    [dto] = pipeline.to_dto(lines)
    assert dto["name"] == "life"
    assert dto["lengthRel"] == 0.8 and dto["curvature"] == 1.05 and dto["branches"] == 2
    assert len(dto["points"]) <= pipeline.MAX_POINTS
    # [x, y] chuẩn hoá theo 512, giữ hai đầu mút của nhánh dài nhất
    assert dto["points"][0] == [round(100 / 512, 4), 0.0]
    assert dto["points"][-1] == [round(100 / 512, 4), round(299 / 512, 4)]
    assert all(0 <= x <= 1 and 0 <= y <= 1 for x, y in dto["points"])
