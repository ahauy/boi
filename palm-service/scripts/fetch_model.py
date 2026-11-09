"""
Tải model ONNX lúc build image và kiểm tra SHA-256. Sai checksum thì dừng build.

    python scripts/fetch_model.py <url> <sha256> <đường dẫn đích>

Chạy lúc `docker build`, không chạy lúc container khởi động: URL r2.dev công khai bị
Cloudflare giới hạn tốc độ và không dành cho production, nên không nên tải mỗi lần khởi động.
"""
import hashlib
import os
import sys
import urllib.request


def main(url: str, sha256: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    tmp = dest + ".part"
    digest = hashlib.sha256()
    req = urllib.request.Request(url, headers={"User-Agent": "palmsight-palm-service-build"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as out:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            digest.update(chunk)
            out.write(chunk)
    got = digest.hexdigest()
    if got != sha256.lower():
        os.remove(tmp)
        sys.exit(f"checksum mismatch for {url}: expected {sha256}, got {got}")
    os.replace(tmp, dest)
    print(f"model ok: {dest} ({os.path.getsize(dest)} bytes, sha256 {got})")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
