import argparse
import csv
import os
import threading
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from flask import Flask, Response, jsonify, request, send_from_directory

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
LOGS_DIR = ROOT / "logs"
VIOLATION_DIR = ROOT / "captures" / "violations"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
VIOLATION_DIR.mkdir(parents=True, exist_ok=True)


def parse_source(value: str):
    value = str(value or "0").strip()
    return int(value) if value.isdigit() else value


def source_host(value: str) -> str:
    text = str(value or "").strip()
    if not text or text.isdigit():
        return ""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(text if "://" in text else f"http://{text}")
        return normalize_ip_host(parsed.hostname or "")
    except Exception:
        return ""


def is_private_source(value: str) -> bool:
    host = source_host(value)
    if not host:
        return False
    if host in {"localhost", "127.0.0.1"}:
        return True
    if host.startswith("10.") or host.startswith("192.168."):
        return True
    parts = host.split(".")
    return len(parts) > 1 and parts[0] == "172" and parts[1].isdigit() and 16 <= int(parts[1]) <= 31


def normalize_ip_host(host: str) -> str:
    host = str(host or "").strip()
    octets = host.split(".")
    if len(octets) == 4 and all(part.isdigit() for part in octets):
        normalized = [str(int(part)) for part in octets]
        if all(0 <= int(part) <= 255 for part in normalized):
            return ".".join(normalized)
    return host


def unique_items(items: List[str]) -> List[str]:
    seen = set()
    result = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def camera_source_candidates(value: str) -> List[str]:
    text = str(value or "0").strip()
    if not text:
        return ["0"]
    if text.isdigit():
        return [text]
    if text.lower().startswith("rtsp://"):
        return [text]

    has_http = text.lower().startswith(("http://", "https://"))
    without_protocol = text.replace("http://", "", 1).replace("https://", "", 1)
    slash_index = without_protocol.find("/")
    host_port = without_protocol if slash_index < 0 else without_protocol[:slash_index]
    path = "" if slash_index < 0 else without_protocol[slash_index:]
    host, port = (host_port.split(":", 1) + [""])[:2] if ":" in host_port else (host_port, "")
    host = normalize_ip_host(host)

    explicit_url = []
    protocol = "https" if text.lower().startswith("https://") else "http"
    if has_http and path and path != "/":
        explicit_url.append(f"{protocol}://{host}{':' + port if port else ''}{path}")

    if has_http and port:
        return unique_items(explicit_url + [
            f"http://{host}:{port}/stream",
            f"http://{host}:{port}/capture",
            f"http://{host}:{port}/video",
            f"http://{host}:{port}/mjpeg",
            f"http://{host}:{port}/?action=stream",
            f"http://{host}:{port}/",
        ])

    return unique_items(explicit_url + [
        f"http://{host}:81/stream",
        f"http://{host}/stream",
        f"http://{host}/capture",
        f"http://{host}:8080/video",
        f"http://{host}:8080/stream",
        f"http://{host}:8080/?action=stream",
        f"http://{host}:8081/",
        f"http://{host}:81/",
        f"http://{host}/video",
        f"http://{host}/mjpeg",
        f"http://{host}/?action=stream",
        f"http://{host}/jpg",
        f"http://{host}/shot.jpg",
        f"http://{host}/snapshot.jpg",
        f"http://{host}/",
    ])


def camera_control_urls(value: str) -> List[str]:
    text = str(value or "").strip()
    if not text or text.isdigit() or text.lower().startswith("rtsp://"):
        return []

    without_protocol = text.replace("http://", "", 1).replace("https://", "", 1)
    slash_index = without_protocol.find("/")
    host_port = without_protocol if slash_index < 0 else without_protocol[:slash_index]
    host, port = (host_port.split(":", 1) + [""])[:2] if ":" in host_port else (host_port, "")
    host = normalize_ip_host(host)

    if port:
        return [f"http://{host}:{port}/control"]
    return unique_items([
        f"http://{host}/control",
        f"http://{host}:80/control",
        f"http://{host}:81/control",
    ])


def safe_number(value, default, number_type=float, minimum=None, maximum=None):
    try:
        result = number_type(value)
    except Exception:
        result = default
    if minimum is not None:
        result = max(minimum, result)
    if maximum is not None:
        result = min(maximum, result)
    return result


def boolish(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {"0", "false", "off", "no", "tidak"}


class PPEVideoEngine:
    def __init__(self, source: str, model_path: str, conf: float = 0.45, imgsz: int = 320,
                 infer_every: int = 2, jpeg_quality: int = 85, yolo_enabled: bool = True):
        self.source_raw = str(source or "0")
        self.source_candidates = camera_source_candidates(self.source_raw)
        self.control_urls = camera_control_urls(self.source_raw)
        self.active_source_raw = self.source_candidates[0]
        self.source = parse_source(self.active_source_raw)
        self.model_path = str(model_path or (MODELS_DIR / "best.pt"))
        self.conf = safe_number(conf, 0.45, float, 0.05, 0.95)
        self.imgsz = safe_number(imgsz, 320, int, 160, 640)
        self.infer_every = safe_number(infer_every, 2, int, 1, 10)
        self.jpeg_quality = safe_number(jpeg_quality, 85, int, 30, 95)
        self.stream_width = int(os.getenv("STREAM_WIDTH", "480"))
        if self.imgsz <= 192:
            self.stream_width = min(self.stream_width, 240)
        elif self.imgsz <= 224:
            self.stream_width = min(self.stream_width, 360)
        elif self.imgsz <= 256:
            self.stream_width = min(self.stream_width, 426)
        self.yolo_enabled = bool(yolo_enabled)

        self.lock = threading.RLock()
        self.raw_frame: Optional[np.ndarray] = None
        self.annotated_frame: Optional[np.ndarray] = None
        self.latest_jpeg: Optional[bytes] = None
        self.latest_jpeg_id = 0
        self.frame_id = 0
        self.stop_event = threading.Event()
        self.capture_thread: Optional[threading.Thread] = None
        self.infer_thread: Optional[threading.Thread] = None
        self.capture_fps = 0.0
        self.infer_fps = 0.0
        self.last_capture_error = ""
        self.last_model_error = ""
        self.camera_control_done = False
        self.camera_control_message = ""
        self.custom_model_available = Path(self.model_path).exists()
        self.model = None
        self.names: Dict[int, str] = {}
        self.last_logged_status = ""
        self.last_log_time = 0.0
        self.last_detections: List[Dict[str, Any]] = []
        self.last_detection_time = 0.0
        self.last_status: Dict[str, Any] = {
            "system": "starting",
            "message": "Menyiapkan kamera dan model YOLO..." if self.yolo_enabled else "Menyiapkan kamera untuk mode CCTV...",
            "camera_source": self.source_raw,
            "active_camera_source": self.active_source_raw,
            "camera_candidates": self.source_candidates,
            "camera_control": "",
            "model_path": self.model_path,
            "custom_model_available": self.custom_model_available,
            "yolo_enabled": self.yolo_enabled,
            "people": 0,
            "helmet": 0,
            "vest": 0,
            "helmet_detected": False,
            "vest_detected": False,
            "ppe_status": "BELUM ADA DATA",
            "confidence": 0.0,
            "fps_camera": 0.0,
            "fps_inference": 0.0,
            "last_update": "-",
            "camera_error": "",
            "model_error": "",
        }

    def start(self):
        if self.yolo_enabled:
            self.load_model()
        self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.infer_thread = threading.Thread(target=self._infer_loop, daemon=True)
        self.capture_thread.start()
        self.infer_thread.start()

    def stop(self):
        self.stop_event.set()
        for thread in (self.capture_thread, self.infer_thread):
            if thread and thread.is_alive():
                thread.join(timeout=1.5)

    def load_model(self):
        if YOLO is None:
            self.last_model_error = "Package ultralytics belum terpasang. Jalankan pip install -r yolo_backend/requirements.txt."
            return
        try:
            selected_model = self.model_path if Path(self.model_path).exists() else os.getenv("FALLBACK_MODEL", "yolo11n.pt")
            self.model = YOLO(selected_model)
            self.names = getattr(self.model, "names", {}) or {}
            if not Path(self.model_path).exists():
                self.last_model_error = "Model custom models/best.pt belum ada. Backend memakai model demo; training dulu agar helm/rompi AirNav akurat."
        except Exception as exc:
            self.last_model_error = f"Gagal memuat model YOLO: {exc}"
            self.model = None

    def _configure_camera_if_supported(self):
        if self.camera_control_done:
            return
        self.camera_control_done = True
        if os.getenv("CAMERA_AUTO_CONFIG", "1").lower() in {"0", "false", "no"}:
            self.camera_control_message = "Auto-config kamera dimatikan."
            return
        if not self.control_urls:
            self.camera_control_message = "Kamera tidak punya API control."
            return

        # Frame kecil menjaga ESP32-S3, tunnel, dan browser tetap ringan.
        frame_size = os.getenv("CAMERA_FRAME_SIZE_VALUE", "5")
        quality = os.getenv("CAMERA_QUALITY_VALUE", "10")
        commands = [
            ("framesize", frame_size),
            ("quality", quality),
        ]
        messages = []
        for base_url in self.control_urls:
            ok_count = 0
            for var, val in commands:
                url = f"{base_url}?var={var}&val={val}"
                try:
                    with urllib.request.urlopen(url, timeout=2.5) as response:
                        body = response.read(80).decode("utf-8", errors="ignore")
                    if 200 <= getattr(response, "status", 200) < 300:
                        ok_count += 1
                        messages.append(f"{var}={val}: OK")
                    else:
                        messages.append(f"{var}={val}: HTTP {getattr(response, 'status', '-')}")
                except Exception as exc:
                    messages.append(f"{var}={val}: {exc}")
                    break
            if ok_count:
                self.camera_control_message = f"HD camera API: {base_url} ({'; '.join(messages[-ok_count:])})"
                return

        self.camera_control_message = "API control kamera tidak merespons untuk mode HD."

    def _capture_loop(self):
        while not self.stop_event.is_set():
            self._configure_camera_if_supported()

            if any(
                not candidate.isdigit() and any(key in candidate.lower() for key in ["/stream", "/mjpeg", "/video", "action=stream"])
                for candidate in self.source_candidates
            ):
                if self._mjpeg_capture_cycle():
                    continue

            cap = None
            opened_source_raw = ""
            opened_source = None

            for candidate in self.source_candidates:
                if self.stop_event.is_set():
                    return
                parsed_candidate = parse_source(candidate)
                trial_cap = cv2.VideoCapture(parsed_candidate)
                if trial_cap.isOpened():
                    trial_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    cap = trial_cap
                    opened_source_raw = candidate
                    opened_source = parsed_candidate
                    break
                trial_cap.release()

            if cap is None or not cap.isOpened():
                if self._mjpeg_capture_cycle():
                    continue

                if self._snapshot_capture_cycle():
                    continue

                self.last_capture_error = f"Kamera tidak terbuka. API mencoba: {', '.join(self.source_candidates[:5])}"
                with self.lock:
                    self.last_status.update({
                        "system": "camera_error",
                        "message": self.last_capture_error,
                        "camera_error": self.last_capture_error,
                        "camera_source": self.source_raw,
                        "active_camera_source": "",
                        "camera_candidates": self.source_candidates,
                        "camera_control": self.camera_control_message,
                        "fps_camera": 0.0,
                        "fps_inference": round(self.infer_fps, 1),
                        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })
                self._update_placeholder("KAMERA BELUM TERBUKA", self.last_capture_error[:80])
                time.sleep(1.5)
                continue

            self.active_source_raw = opened_source_raw
            self.source = opened_source

            # Ringankan webcam lokal bila sumber berupa index kamera.
            if isinstance(self.source, int):
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_FPS, 15)

            self.last_capture_error = ""
            frames = 0
            started = time.time()
            while not self.stop_event.is_set():
                ok, frame = cap.read()
                if not ok or frame is None:
                    self.last_capture_error = "Frame kamera putus. Backend mencoba reconnect."
                    with self.lock:
                        self.last_status.update({
                            "system": "camera_error",
                            "message": self.last_capture_error,
                            "camera_error": self.last_capture_error,
                            "camera_source": self.source_raw,
                            "active_camera_source": self.active_source_raw,
                            "camera_candidates": self.source_candidates,
                            "camera_control": self.camera_control_message,
                            "fps_camera": 0.0,
                            "fps_inference": round(self.infer_fps, 1),
                            "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        })
                    break
                with self.lock:
                    self.raw_frame = frame
                    self.frame_id += 1
                frames += 1
                elapsed = time.time() - started
                if elapsed >= 1.0:
                    self.capture_fps = round(frames / elapsed, 1)
                    frames = 0
                    started = time.time()
            cap.release()
            time.sleep(0.3)

    def _mjpeg_capture_cycle(self) -> bool:
        stream_candidates = [
            candidate for candidate in self.source_candidates
            if not candidate.isdigit() and any(key in candidate.lower() for key in ["/stream", "/mjpeg", "/video", "action=stream"])
        ]
        if not stream_candidates:
            return False

        for candidate in stream_candidates:
            if self.stop_event.is_set():
                return True

            try:
                with urllib.request.urlopen(candidate, timeout=4.0) as response:
                    buffer = b""
                    frames = 0
                    started = time.time()
                    self.last_capture_error = ""
                    self.active_source_raw = candidate

                    while not self.stop_event.is_set():
                        chunk = response.read(1024)
                        if not chunk:
                            break
                        buffer += chunk

                        # MJPEG over tunnels can queue old frames. Decode only the
                        # newest complete JPEG in the buffer so the dashboard follows
                        # live camera movement instead of draining stale frames.
                        end = buffer.rfind(b"\xff\xd9")
                        start = buffer.rfind(b"\xff\xd8", 0, end)
                        if start < 0 or end < 0:
                            if len(buffer) > 1024 * 1024:
                                buffer = buffer[-4096:]
                            continue

                        jpg = buffer[start:end + 2]
                        buffer = buffer[end + 2:]
                        data = np.frombuffer(jpg, dtype=np.uint8)
                        frame = cv2.imdecode(data, cv2.IMREAD_COLOR)
                        if frame is None:
                            continue

                        with self.lock:
                            self.raw_frame = frame
                            self.frame_id += 1
                            self.last_status.update({
                                "system": "camera_connected",
                                "message": f"Kamera MJPEG aktif: {candidate}",
                                "camera_error": "",
                                "camera_source": self.source_raw,
                                "active_camera_source": candidate,
                                "camera_candidates": self.source_candidates,
                                "camera_control": self.camera_control_message,
                                "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            })

                        frames += 1
                        elapsed = time.time() - started
                        if elapsed >= 1.0:
                            self.capture_fps = round(frames / elapsed, 1)
                            frames = 0
                            started = time.time()

                    self.last_capture_error = f"Stream MJPEG putus: {candidate}"
            except Exception as exc:
                self.last_capture_error = f"{candidate}: {exc}"

        return False

    def _snapshot_capture_cycle(self) -> bool:
        snapshot_candidates = [
            candidate for candidate in self.source_candidates
            if not candidate.isdigit() and any(key in candidate.lower() for key in ["/capture", "/jpg", "snapshot", "shot"])
        ]
        if not snapshot_candidates:
            return False

        opened_candidate = ""
        frames = 0
        started = time.time()

        while not self.stop_event.is_set():
            frame = None
            last_error = ""

            for candidate in snapshot_candidates:
                try:
                    with urllib.request.urlopen(candidate, timeout=2.5) as response:
                        payload = response.read()
                    data = np.frombuffer(payload, dtype=np.uint8)
                    decoded = cv2.imdecode(data, cv2.IMREAD_COLOR)
                    if decoded is not None:
                        frame = decoded
                        opened_candidate = candidate
                        break
                    last_error = f"Snapshot bukan JPEG valid: {candidate}"
                except Exception as exc:
                    last_error = f"{candidate}: {exc}"

            if frame is None:
                self.last_capture_error = f"Kamera snapshot tidak terbuka. {last_error}"
                with self.lock:
                    self.last_status.update({
                        "system": "camera_error",
                        "message": self.last_capture_error,
                        "camera_error": self.last_capture_error,
                        "camera_source": self.source_raw,
                        "active_camera_source": opened_candidate,
                        "camera_candidates": self.source_candidates,
                        "camera_control": self.camera_control_message,
                        "fps_camera": 0.0,
                        "fps_inference": round(self.infer_fps, 1),
                        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })
                self._update_placeholder("KAMERA BELUM TERBUKA", self.last_capture_error[:80])
                time.sleep(1.5)
                return False

            self.last_capture_error = ""
            self.active_source_raw = opened_candidate
            with self.lock:
                self.raw_frame = frame
                self.frame_id += 1
                self.last_status.update({
                    "system": "camera_connected",
                    "message": f"Kamera snapshot aktif: {opened_candidate}",
                    "camera_error": "",
                    "camera_source": self.source_raw,
                    "active_camera_source": opened_candidate,
                    "camera_candidates": self.source_candidates,
                    "camera_control": self.camera_control_message,
                    "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                })

            frames += 1
            elapsed = time.time() - started
            if elapsed >= 1.0:
                self.capture_fps = round(frames / elapsed, 1)
                frames = 0
                started = time.time()
            time.sleep(0.08)

        return True

    def _infer_loop(self):
        frames = 0
        started = time.time()
        last_seen_frame = -1
        while not self.stop_event.is_set():
            with self.lock:
                frame = None if self.raw_frame is None else self.raw_frame.copy()
                frame_id = self.frame_id

            if frame is None:
                self._update_placeholder("AIRNAV PPE YOLO", "Menunggu frame kamera / ESP32-S3 stream...")
                time.sleep(0.05)
                continue
            if frame_id == last_seen_frame:
                time.sleep(0.01)
                continue
            last_seen_frame = frame_id

            if not self.yolo_enabled:
                with self.lock:
                    self.annotated_frame = frame
                    self.infer_fps = 0.0
                    self.last_status.update({
                        "system": "cctv",
                        "message": "Mode CCTV aktif. Kamera tampil tanpa deteksi YOLO dan tanpa bounding box.",
                        "people": 0,
                        "helmet": 0,
                        "vest": 0,
                        "helmet_detected": False,
                        "vest_detected": False,
                        "ppe_status": "CCTV MODE",
                        "confidence": 0.0,
                        "fps_camera": self.capture_fps,
                        "fps_inference": 0.0,
                        "camera_error": self.last_capture_error,
                        "model_error": "",
                        "camera_source": self.source_raw,
                        "active_camera_source": self.active_source_raw,
                        "camera_candidates": self.source_candidates,
                        "camera_control": self.camera_control_message,
                        "model_path": self.model_path,
                        "custom_model_available": self.custom_model_available,
                        "yolo_enabled": False,
                        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })
                self._encode_latest()
                time.sleep(0.005)
                continue

            if frame_id % self.infer_every != 0:
                preview = frame.copy()
                with self.lock:
                    current_status = dict(self.last_status)
                    last_detections = list(self.last_detections)
                self._draw_detections(preview, last_detections)
                if current_status.get("system") in {"running", "camera_connected"}:
                    self._draw_panel(
                        preview,
                        "AIRNAV PPE",
                        f"P:{current_status.get('people', 0)} H:{current_status.get('helmet', 0)} R:{current_status.get('vest', 0)} | {current_status.get('ppe_status', 'PROSES')}",
                    )
                with self.lock:
                    self.annotated_frame = preview
                    self.last_status.update({
                        "fps_camera": self.capture_fps,
                        "fps_inference": round(self.infer_fps, 1),
                        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })
                self._encode_latest()
                time.sleep(0.005)
                continue

            annotated, status = self._detect_and_annotate(frame)
            with self.lock:
                self.annotated_frame = annotated
                self.last_status.update(status)
                self.last_status.update({
                    "fps_camera": self.capture_fps,
                    "fps_inference": round(self.infer_fps, 1),
                    "camera_error": self.last_capture_error,
                    "model_error": self.last_model_error,
                    "camera_source": self.source_raw,
                    "active_camera_source": self.active_source_raw,
                    "camera_candidates": self.source_candidates,
                    "camera_control": self.camera_control_message,
                    "model_path": self.model_path,
                    "custom_model_available": self.custom_model_available,
                    "yolo_enabled": self.yolo_enabled,
                    "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                })
            self._encode_latest()
            self._write_log_if_needed(status, annotated)

            frames += 1
            elapsed = time.time() - started
            if elapsed >= 1.0:
                self.infer_fps = frames / elapsed
                frames = 0
                started = time.time()

    def _detect_and_annotate(self, frame: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        if self.model is None:
            annotated = frame.copy()
            self._draw_panel(annotated, "MODEL YOLO BELUM SIAP", self.last_model_error[:80] if self.last_model_error else "Cek terminal backend")
            return annotated, {
                "system": "model_error",
                "message": self.last_model_error or "Model YOLO belum siap.",
                "people": 0,
                "helmet": 0,
                "vest": 0,
                "helmet_detected": False,
                "vest_detected": False,
                "ppe_status": "MODEL ERROR",
                "confidence": 0.0,
            }
        try:
            result = self.model.predict(frame, imgsz=self.imgsz, conf=self.conf, verbose=False)[0]
            annotated = frame.copy()
            detections = self._extract_detections(result)
            with self.lock:
                if detections:
                    self.last_detections = detections
                    self.last_detection_time = time.time()
                elif (time.time() - self.last_detection_time) > 0.8:
                    self.last_detections = []
                detections_to_draw = list(self.last_detections)
            self._draw_detections(annotated, detections_to_draw)
            counts = self._summarize_result(result)
            ppe_status = self._decide_status(counts)
            self._draw_panel(annotated, "AIRNAV PPE", f"P:{counts['people']} H:{counts['helmet']} R:{counts['vest']} | {ppe_status}")
            message = "Deteksi YOLO berjalan normal."
            if not self.custom_model_available:
                message = "Mode demo. Letakkan model training ke models/best.pt agar deteksi helm/rompi AirNav akurat."
            return annotated, {
                "system": "running",
                "message": message,
                "people": counts["people"],
                "helmet": counts["helmet"],
                "vest": counts["vest"],
                "helmet_detected": counts["helmet"] > 0,
                "vest_detected": counts["vest"] > 0,
                "ppe_status": ppe_status,
                "confidence": round(counts["max_conf"], 3),
            }
        except Exception as exc:
            annotated = frame.copy()
            self.last_model_error = f"Inferensi gagal: {exc}"
            self._draw_panel(annotated, "INFERENCE ERROR", str(exc)[:80])
            return annotated, {
                "system": "inference_error",
                "message": self.last_model_error,
                "people": 0,
                "helmet": 0,
                "vest": 0,
                "helmet_detected": False,
                "vest_detected": False,
                "ppe_status": "INFERENCE ERROR",
                "confidence": 0.0,
            }

    def _extract_detections(self, result) -> List[Dict[str, Any]]:
        detections = []
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return detections
        xyxy = boxes.xyxy.tolist() if hasattr(boxes, "xyxy") else []
        cls_values = boxes.cls.tolist() if hasattr(boxes, "cls") else []
        conf_values = boxes.conf.tolist() if hasattr(boxes, "conf") else []
        for coords, cls_id, conf in zip(xyxy, cls_values, conf_values):
            name = str(self.names.get(int(cls_id), int(cls_id)))
            detections.append({
                "xyxy": [int(round(v)) for v in coords],
                "label": name.upper(),
                "conf": float(conf),
                "kind": self._class_kind(name),
            })
        return detections

    def _summarize_result(self, result) -> Dict[str, Any]:
        people = helmet = vest = 0
        max_conf = 0.0
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return {"people": 0, "helmet": 0, "vest": 0, "max_conf": 0.0}
        for cls_id, conf in zip(boxes.cls.tolist(), boxes.conf.tolist()):
            name = str(self.names.get(int(cls_id), int(cls_id))).lower().replace("-", "_").replace(" ", "_")
            max_conf = max(max_conf, float(conf))
            if name in {"person", "orang", "man", "woman"}:
                people += 1
            if any(key in name for key in ["helmet", "helm", "hardhat", "safety_helmet", "helmet_airnav"]):
                helmet += 1
            if any(key in name for key in ["vest", "rompi", "safety_vest", "reflective_vest", "vest_airnav"]):
                vest += 1
        return {"people": people, "helmet": helmet, "vest": vest, "max_conf": max_conf}

    @staticmethod
    def _class_kind(name: str) -> str:
        normalized = str(name).lower().replace("-", "_").replace(" ", "_")
        if any(key in normalized for key in ["helmet", "helm", "hardhat", "safety_helmet", "helmet_airnav"]):
            return "helmet"
        if any(key in normalized for key in ["vest", "rompi", "safety_vest", "reflective_vest", "vest_airnav"]):
            return "vest"
        if normalized in {"person", "orang", "man", "woman"}:
            return "person"
        return "object"

    def _draw_detections(self, frame: np.ndarray, detections: List[Dict[str, Any]]):
        h, w = frame.shape[:2]
        colors = {
            "helmet": (0, 180, 255),
            "vest": (0, 220, 110),
            "person": (255, 170, 40),
            "object": (230, 230, 230),
        }
        for item in detections:
            x1, y1, x2, y2 = item.get("xyxy", [0, 0, 0, 0])
            x1, x2 = max(0, min(w - 1, x1)), max(0, min(w - 1, x2))
            y1, y2 = max(0, min(h - 1, y1)), max(0, min(h - 1, y2))
            if x2 <= x1 or y2 <= y1:
                continue
            color = colors.get(item.get("kind"), colors["object"])
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{item.get('label', 'OBJECT')} {item.get('conf', 0.0):.2f}"
            font_scale = max(0.4, min(0.65, w / 1050))
            thickness = 1 if w < 540 else 2
            (label_w, label_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
            label_x2 = min(w - 1, x1 + label_w + 8)
            label_y1 = max(0, y1 - label_h - baseline - 8)
            label_y2 = max(label_h + baseline + 8, y1)
            cv2.rectangle(frame, (x1, label_y1), (label_x2, label_y2), color, -1)
            cv2.putText(frame, label, (x1 + 4, label_y2 - baseline - 4), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (5, 10, 20), thickness, cv2.LINE_AA)

    @staticmethod
    def _decide_status(counts: Dict[str, Any]) -> str:
        if counts["people"] == 0 and counts["helmet"] == 0 and counts["vest"] == 0:
            return "TIDAK ADA OBJEK"
        if counts["helmet"] > 0 and counts["vest"] > 0:
            return "APD LENGKAP"
        if counts["helmet"] == 0 and counts["vest"] > 0:
            return "TIDAK PAKAI HELM"
        if counts["helmet"] > 0 and counts["vest"] == 0:
            return "TIDAK PAKAI ROMPI"
        return "APD TIDAK LENGKAP"

    @staticmethod
    def _fit_text(text: str, max_width: int, font_scale: float, thickness: int) -> str:
        value = str(text or "")
        if cv2.getTextSize(value, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)[0][0] <= max_width:
            return value
        ellipsis = "..."
        while value:
            candidate = value[:-1].rstrip() + ellipsis
            width = cv2.getTextSize(candidate, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)[0][0]
            if width <= max_width:
                return candidate
            value = value[:-1]
        return ellipsis

    def _draw_panel(self, frame: np.ndarray, title: str, text: str):
        h, w = frame.shape[:2]
        margin = max(6, int(min(w, h) * 0.018))
        panel_w = min(w - (margin * 2), max(220, int(w * 0.72)))
        panel_h = max(48, min(68, int(h * 0.14)))
        x1, y1 = margin, margin
        x2, y2 = x1 + panel_w, y1 + panel_h

        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (3, 7, 18), -1)
        cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (34, 211, 238), 1)

        title_scale = max(0.42, min(0.66, w / 980))
        text_scale = max(0.36, min(0.52, w / 1150))
        title_thickness = 1 if w < 520 else 2
        text_thickness = 1
        max_text_w = panel_w - (margin * 4)
        safe_title = self._fit_text(title, max_text_w, title_scale, title_thickness)
        safe_text = self._fit_text(text, max_text_w, text_scale, text_thickness)

        title_y = y1 + max(19, int(panel_h * 0.42))
        text_y = y1 + max(38, int(panel_h * 0.78))
        cv2.putText(frame, safe_title, (x1 + margin * 2, title_y), cv2.FONT_HERSHEY_SIMPLEX, title_scale, (255, 255, 255), title_thickness, cv2.LINE_AA)
        cv2.putText(frame, safe_text, (x1 + margin * 2, text_y), cv2.FONT_HERSHEY_SIMPLEX, text_scale, (103, 232, 249), text_thickness, cv2.LINE_AA)

    def _update_placeholder(self, title="AIRNAV PPE YOLO", text="Menunggu kamera..."):
        frame = np.zeros((480, 800, 3), dtype=np.uint8)
        self._draw_panel(frame, title, text)
        ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality])
        if ok:
            with self.lock:
                self.latest_jpeg = jpg.tobytes()
                self.latest_jpeg_id += 1

    def _encode_latest(self):
        with self.lock:
            frame = None if self.annotated_frame is None else self.annotated_frame.copy()
        if frame is None:
            return
        h, w = frame.shape[:2]
        if w > self.stream_width:
            next_h = max(1, int(h * (self.stream_width / w)))
            frame = cv2.resize(frame, (self.stream_width, next_h), interpolation=cv2.INTER_AREA)
        ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality])
        if ok:
            with self.lock:
                self.latest_jpeg = jpg.tobytes()
                self.latest_jpeg_id += 1

    def _write_log_if_needed(self, status: Dict[str, Any], frame: np.ndarray):
        now = time.time()
        current = status.get("ppe_status", "")
        if not current or (current == self.last_logged_status and (now - self.last_log_time) < 5):
            return
        self.last_logged_status = current
        self.last_log_time = now

        log_file = LOGS_DIR / "detections.csv"
        write_header = not log_file.exists()
        with open(log_file, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(["timestamp", "ppe_status", "people", "helmet", "vest", "confidence", "source"])
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                current,
                status.get("people", 0),
                status.get("helmet", 0),
                status.get("vest", 0),
                status.get("confidence", 0.0),
                self.source_raw,
            ])

        if current in {"TIDAK PAKAI HELM", "TIDAK PAKAI ROMPI", "APD TIDAK LENGKAP"}:
            fname = datetime.now().strftime("violation_%Y%m%d_%H%M%S.jpg")
            cv2.imwrite(str(VIOLATION_DIR / fname), frame)

    def get_jpeg(self) -> bytes:
        with self.lock:
            if self.latest_jpeg is None:
                self._update_placeholder()
            return self.latest_jpeg or b""

    def get_jpeg_with_id(self) -> Tuple[int, bytes]:
        with self.lock:
            if self.latest_jpeg is None:
                self._update_placeholder()
            return self.latest_jpeg_id, self.latest_jpeg or b""

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            return dict(self.last_status)


app = Flask(__name__)
engine: Optional[PPEVideoEngine] = None
engine_lock = threading.RLock()
tunnel_request_lock = threading.RLock()
pending_tunnel_request: Dict[str, Any] = {}


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Access-Control-Request-Private-Network"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.route("/health")
def health():
    return jsonify({"ok": True, "service": "airnav-yolo-backend"})


@app.route("/video_feed")
def video_feed():
    def generate():
        last_frame_id = -1
        while True:
            with engine_lock:
                local_engine = engine
            if local_engine is None:
                time.sleep(0.1)
                continue
            frame_id, frame = local_engine.get_jpeg_with_id()
            if frame_id == last_frame_id:
                time.sleep(0.005)
                continue
            last_frame_id = frame_id
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
    response = Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    return response


@app.route("/api/status")
@app.route("/api/ppe/status")
def api_status():
    with engine_lock:
        local_engine = engine
    if local_engine is None:
        return jsonify({"system": "not_started", "ppe_status": "BACKEND BELUM START", "message": "Engine belum dibuat."})
    return jsonify(local_engine.get_status())


@app.route("/api/ppe/tunnel-request", methods=["GET", "POST", "OPTIONS"])
def api_tunnel_request():
    global pending_tunnel_request
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    if request.method == "GET":
        with tunnel_request_lock:
            return jsonify({"ok": True, "request": dict(pending_tunnel_request)})

    payload = request.get_json(silent=True) or {}
    public_source = str(payload.get("public_source", "")).strip()
    if not public_source:
        return jsonify({"ok": False, "message": "public_source wajib diisi."}), 400

    with tunnel_request_lock:
        request_config = dict(pending_tunnel_request)
        pending_tunnel_request = {}

    if not request_config:
        request_config = {
            "source": public_source,
            "model_path": str(MODELS_DIR / "best.pt"),
            "conf": 0.45,
            "imgsz": 160,
            "infer_every": 4,
            "jpeg_quality": 32,
            "yolo_enabled": True,
        }

    restart_engine(
        public_source,
        str(request_config.get("model_path") or (MODELS_DIR / "best.pt")),
        safe_number(request_config.get("conf", 0.45), 0.45, float, 0.05, 0.95),
        safe_number(request_config.get("imgsz", 160), 160, int, 160, 640),
        safe_number(request_config.get("infer_every", 4), 4, int, 1, 10),
        safe_number(request_config.get("jpeg_quality", 32), 32, int, 30, 95),
        boolish(request_config.get("yolo_enabled", True), True),
    )
    return jsonify({"ok": True, "message": f"Tunnel aktif. YOLO membaca {public_source}", "source": public_source})


@app.route("/api/ppe/source", methods=["POST", "OPTIONS"])
def api_change_source():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    payload = request.get_json(silent=True) or {}
    source = str(payload.get("source", "0")).strip() or "0"
    model_path = str(payload.get("model_path", str(MODELS_DIR / "best.pt"))).strip() or str(MODELS_DIR / "best.pt")
    conf = safe_number(payload.get("conf", 0.45), 0.45, float, 0.05, 0.95)
    imgsz = safe_number(payload.get("imgsz", 320), 320, int, 160, 640)
    infer_every = safe_number(payload.get("infer_every", 2), 2, int, 1, 10)
    jpeg_quality = safe_number(payload.get("jpeg_quality", 85), 85, int, 30, 95)
    yolo_enabled = boolish(payload.get("yolo_enabled", True), True)

    if is_private_source(source):
        global pending_tunnel_request
        with tunnel_request_lock:
            pending_tunnel_request = {
                "source": source,
                "model_path": model_path,
                "conf": conf,
                "imgsz": imgsz,
                "infer_every": infer_every,
                "jpeg_quality": jpeg_quality,
                "yolo_enabled": yolo_enabled,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
        return jsonify({
            "ok": True,
            "needs_tunnel": True,
            "message": f"IP lokal {source} diterima. Menunggu camera tunnel agent membuat URL public otomatis.",
            "source": source,
            "yolo_enabled": yolo_enabled,
            "camera_candidates": camera_source_candidates(source),
        })

    restart_engine(source, model_path, conf, imgsz, infer_every, jpeg_quality, yolo_enabled)
    candidates = camera_source_candidates(source)
    mode_label = "YOLO" if yolo_enabled else "CCTV"
    return jsonify({
        "ok": True,
        "message": f"API kamera diterima. Mode {mode_label} mencoba membaca source: {source}",
        "source": source,
        "yolo_enabled": yolo_enabled,
        "camera_candidates": candidates,
    })


@app.route("/api/ppe/logs")
def api_logs():
    log_file = LOGS_DIR / "detections.csv"
    rows = []
    if log_file.exists():
        with open(log_file, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                rows.append(row)
    rows.reverse()
    captures = sorted(VIOLATION_DIR.glob("*.jpg"), reverse=True)[:10]
    return jsonify({
        "rows": rows[:100],
        "latest_violations": [str(p.relative_to(ROOT)).replace("\\", "/") for p in captures],
    })


@app.route("/logs/<path:filename>")
def log_file(filename):
    return send_from_directory(LOGS_DIR, filename)


@app.route("/captures/violations/<path:filename>")
def violation_file(filename):
    return send_from_directory(VIOLATION_DIR, filename)


def restart_engine(source: str, model_path: str, conf: float, imgsz: int, infer_every: int, jpeg_quality: int, yolo_enabled: bool = True):
    global engine
    with engine_lock:
        old_engine = engine
        engine = PPEVideoEngine(source, model_path, conf, imgsz, infer_every, jpeg_quality, yolo_enabled)
        engine.start()
    if old_engine is not None:
        old_engine.stop()


def main():
    parser = argparse.ArgumentParser(description="AirNav PPE YOLO backend untuk dashboard React")
    parser.add_argument("--source", default=os.getenv("CAMERA_SOURCE", "0"), help="0 untuk webcam, atau URL ESP32-S3: http://IP:81/stream")
    parser.add_argument("--model", default=os.getenv("MODEL_PATH", str(MODELS_DIR / "best.pt")), help="Path model custom YOLO")
    parser.add_argument("--conf", type=float, default=float(os.getenv("CONF", "0.45")))
    parser.add_argument("--imgsz", type=int, default=int(os.getenv("IMG_SIZE", "320")))
    parser.add_argument("--infer-every", type=int, default=int(os.getenv("INFER_EVERY", "2")))
    parser.add_argument("--jpeg-quality", type=int, default=int(os.getenv("JPEG_QUALITY", "85")))
    parser.add_argument("--no-yolo", action="store_true", help="Jalankan kamera sebagai CCTV tanpa inferensi YOLO")
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "5050")))
    args = parser.parse_args()

    restart_engine(args.source, args.model, args.conf, args.imgsz, args.infer_every, args.jpeg_quality, not args.no_yolo)
    print("\n==============================================")
    print(" AIRNAV PPE YOLO BACKEND")
    print("==============================================")
    print(f"API       : http://127.0.0.1:{args.port}/api/ppe/status")
    print(f"Video     : http://127.0.0.1:{args.port}/video_feed")
    print(f"Source    : {args.source}")
    print(f"Model     : {args.model}")
    print("Buka dashboard React lalu menu Deteksi YOLO.\n")
    app.run(host=args.host, port=args.port, threaded=True)


if __name__ == "__main__":
    main()
