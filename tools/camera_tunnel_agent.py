#!/usr/bin/env python3
import json
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


BACKEND_URL = "https://yolo.34.101.183.214.sslip.io"
POLL_SECONDS = 3


def normalize_source(value):
    text = str(value or "").strip()
    if not text:
        return ""
    if re.match(r"^[a-z]+://", text, re.I):
        return text
    return f"http://{text}"


def source_candidates(value):
    source = normalize_source(value)
    if not source:
        return []
    parsed = urllib.parse.urlparse(source)
    host = parsed.hostname or ""
    port = f":{parsed.port}" if parsed.port else ""
    path = parsed.path if parsed.path and parsed.path != "/" else ""
    base = f"{parsed.scheme}://{host}{port}"
    explicit = [source] if path else []
    if parsed.port:
        return explicit + [
            f"{base}/video",
            f"{base}/stream",
            f"{base}/mjpeg",
            f"{base}/?action=stream",
            f"{base}/shot.jpg",
            f"{base}/capture",
            base,
        ]
    return explicit + [
        f"http://{host}:8080/video",
        f"http://{host}:81/stream",
        f"http://{host}/stream",
        f"http://{host}/video",
        f"http://{host}/mjpeg",
        f"http://{host}/?action=stream",
        f"http://{host}/shot.jpg",
        f"http://{host}/capture",
        f"http://{host}",
    ]


def probe(url):
    try:
        request = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(request, timeout=4) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            if response.status >= 400:
                return False
            if "multipart" in content_type or "image/jpeg" in content_type:
                return True
            return url.rstrip("/").endswith((":8080", ":80")) and "text/html" in content_type
    except Exception:
        return False


def find_camera_url(source):
    for candidate in source_candidates(source):
        if probe(candidate):
            return candidate
    return normalize_source(source)


def split_origin_and_path(url):
    parsed = urllib.parse.urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path or ""
    if parsed.query:
        path = f"{path}?{parsed.query}"
    return origin, path


def read_json(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def stop_process(process):
    if not process:
        return
    process.send_signal(signal.SIGINT)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def start_tunnel(origin):
    process = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", origin],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    tunnel_url = ""
    started = time.time()
    while time.time() - started < 45:
        line = process.stdout.readline() if process.stdout else ""
        if not line:
            time.sleep(0.2)
            continue
        print(line.rstrip())
        match = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            break
    if not tunnel_url:
        stop_process(process)
        raise RuntimeError("Cloudflare Tunnel tidak memberikan URL public.")
    return process, tunnel_url


def main():
    backend = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else BACKEND_URL
    active_process = None
    active_source = ""
    print(f"Camera tunnel agent aktif. Backend: {backend}")
    print("Biarkan terminal ini tetap berjalan agar upload IP lokal bisa otomatis.")

    try:
        while True:
            try:
                payload = read_json(f"{backend}/api/ppe/tunnel-request")
                request = payload.get("request") or {}
                source = request.get("source") or ""
                if source and source != active_source:
                    print(f"Request kamera lokal diterima: {source}")
                    camera_url = find_camera_url(source)
                    origin, path = split_origin_and_path(camera_url)
                    print(f"Endpoint lokal terpilih: {camera_url}")
                    stop_process(active_process)
                    active_process, public_origin = start_tunnel(origin)
                    public_source = f"{public_origin}{path}"
                    print(f"URL public kamera: {public_source}")
                    result = post_json(f"{backend}/api/ppe/tunnel-request", {"public_source": public_source})
                    print(result.get("message", result))
                    active_source = source
            except urllib.error.HTTPError as exc:
                print(f"HTTP error: {exc}")
            except Exception as exc:
                print(f"Agent error: {exc}")
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("Menghentikan camera tunnel agent.")
    finally:
        stop_process(active_process)


if __name__ == "__main__":
    main()
