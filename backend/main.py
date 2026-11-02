import re
import threading
import time
import uuid
import subprocess
from collections import deque
from pathlib import Path

import imageio_ffmpeg
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

Image.MAX_IMAGE_PIXELS = 60_000_000

STORAGE = Path(__file__).parent / "storage"
STORAGE.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

MAX_UPLOAD_MB = 100          # yükleme sınırı (frontend'deki MAX_MB ile aynı olsun)
KEEP_SECONDS = 3600          # dosyalar 1 saat sonra silinir
JOB_TIMEOUT = 15 * 60        # tek video işi en fazla 15 dakika
MAX_PARALLEL_JOBS = 2        # aynı anda en fazla 2 ffmpeg

VIDEO_FORMATS = {"mp4", "3gp", "mkv", "avi", "mp3"}
IMAGE_FORMATS = {"png", "jpg", "webp", "bmp"}
VIDEO_INPUTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".3gp", ".m4v", ".flv",
                ".wmv", ".mpg", ".mpeg", ".ts", ".mp3", ".wav", ".m4a", ".aac", ".ogg"}
IMAGE_INPUTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}

RES_RE = re.compile(r"(\d{2,4})x(\d{2,4})")
DURATION_RE = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")
ID_RE = re.compile(r"[a-f0-9]{32}")
NAME_RE = re.compile(r"([a-f0-9]{32})_out\.(mp4|3gp|mkv|avi|mp3|png|jpg|webp|bmp)")

app = FastAPI(title="MiniMedia API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://formatyap.free.je",
        "http://formatyap.free.je",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https://.*\.app\.github\.dev",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

jobs = {}
jobs_lock = threading.Lock()
slots = threading.Semaphore(MAX_PARALLEL_JOBS)


def update_job(job_id, **fields):
    with jobs_lock:
        jobs[job_id].update(fields)


def save_upload(file: UploadFile, allowed: set) -> Path:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, "Bu dosya türü desteklenmiyor.")
    path = STORAGE / f"{uuid.uuid4().hex}_in{ext}"
    limit = MAX_UPLOAD_MB * 1024 * 1024
    size, too_big = 0, False
    with open(path, "wb") as out:
        while True:
            chunk = file.file.read(1 << 20)
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                too_big = True
                break
            out.write(chunk)
    if too_big or size == 0:
        path.unlink(missing_ok=True)
        if too_big:
            raise HTTPException(413, f"Dosya {MAX_UPLOAD_MB} MB'tan büyük olamaz.")
        raise HTTPException(400, "Dosya boş.")
    return path


def video_args(fmt: str, resolution: str, volume: float) -> list:
    args = []
    if fmt == "mp3":
        args += ["-vn", "-c:a", "libmp3lame", "-b:a", "192k"]
    else:
        if resolution:
            w, h = (int(n) - int(n) % 2 for n in RES_RE.fullmatch(resolution).groups())
            args += ["-vf", f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
                            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"]
        if fmt in ("mp4", "mkv"):
            args += ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac"]
            if fmt == "mp4":
                args += ["-movflags", "+faststart"]
        elif fmt == "3gp":
            args += ["-c:v", "mpeg4", "-c:a", "aac"]
    if volume != 1.0:
        args += ["-filter:a", f"volume={volume}"]
    return args


def run_video_job(job_id: str, in_path: Path, out_path: Path, args: list):
    try:
        with slots:
            update_job(job_id, status="processing", progress=None)
            cmd = [FFMPEG, "-y", "-hide_banner", "-nostdin", "-i", str(in_path),
                   "-progress", "pipe:1", "-nostats", *args, str(out_path)]
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, encoding="utf-8", errors="replace")
            killed = []

            def kill():
                killed.append(True)
                proc.kill()

            timer = threading.Timer(JOB_TIMEOUT, kill)
            timer.start()
            duration, tail = None, deque(maxlen=8)
            try:
                for raw in proc.stdout:
                    line = raw.strip()
                    match = DURATION_RE.search(line)
                    if duration is None and match:
                        h, m, s = match.groups()
                        duration = int(h) * 3600 + int(m) * 60 + float(s)
                    elif line.startswith(("out_time_us=", "out_time_ms=")):
                        value = line.split("=", 1)[1]
                        if duration and value.isdigit():
                            pct = int(int(value) / (duration * 1_000_000) * 100)
                            update_job(job_id, progress=max(0, min(99, pct)))
                    elif line and not re.match(r"^\w+=", line):
                        tail.append(line)
            finally:
                proc.wait()
                timer.cancel()

            if proc.returncode == 0 and out_path.exists():
                update_job(job_id, status="done", progress=100,
                           download_url=f"/api/download/{out_path.name}")
            else:
                reason = "İşlem çok uzun sürdüğü için durduruldu." if killed else \
                    "Dönüştürme başarısız oldu. " + " ".join(tail).replace(str(STORAGE), "")[-300:]
                out_path.unlink(missing_ok=True)
                update_job(job_id, status="error", error=reason)
    except Exception as exc:
        print("video işi hatası:", exc)
        update_job(job_id, status="error", error="Beklenmeyen bir hata oluştu.")
    finally:
        in_path.unlink(missing_ok=True)


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/api/process-video")
def process_video(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    resolution: str = Form(""),
    volume: float = Form(1.0),
):
    fmt = target_format.lower()
    if fmt not in VIDEO_FORMATS:
        raise HTTPException(400, "Desteklenmeyen hedef format.")
    if resolution:
        match = RES_RE.fullmatch(resolution)
        if not match or any(int(n) > 4096 for n in match.groups()):
            raise HTTPException(400, "Geçersiz çözünürlük.")
    if not 0 <= volume <= 2:
        raise HTTPException(400, "Ses düzeyi %0 ile %200 arasında olmalı.")

    in_path = save_upload(file, VIDEO_INPUTS)
    job_id = uuid.uuid4().hex
    out_path = STORAGE / f"{job_id}_out.{fmt}"
    with jobs_lock:
        jobs[job_id] = {"status": "queued", "progress": 0, "download_url": None,
                        "error": None, "created": time.time()}
    threading.Thread(target=run_video_job, daemon=True,
                     args=(job_id, in_path, out_path, video_args(fmt, resolution, volume))).start()
    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
def job_status(job_id: str):
    if not ID_RE.fullmatch(job_id):
        raise HTTPException(404, "İş bulunamadı.")
    with jobs_lock:
        job = jobs.get(job_id)
        data = dict(job) if job else None
    if not data:
        raise HTTPException(404, "İş bulunamadı. Sunucu yeniden başlamış olabilir, işlemi tekrar başlatın.")
    return {k: data[k] for k in ("status", "progress", "download_url", "error")}


@app.post("/api/process-image")
def process_image(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    scale: float = Form(1.0),
    sharpen: bool = Form(False),
):
    fmt = target_format.lower()
    if fmt not in IMAGE_FORMATS:
        raise HTTPException(400, "Desteklenmeyen hedef format.")
    if not 0.1 <= scale <= 4:
        raise HTTPException(400, "Ölçek 0.1 ile 4 arasında olmalı.")

    in_path = save_upload(file, IMAGE_INPUTS)
    out_name = f"{uuid.uuid4().hex}_out.{fmt}"
    try:
        with Image.open(in_path) as original:
            original.load()
            img = ImageOps.exif_transpose(original)
            w, h = img.size
            new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
            if new_w * new_h > 60_000_000:
                raise HTTPException(400, "Sonuç görsel çok büyük olur, ölçeği azaltın.")
            if img.mode not in ("RGB", "RGBA", "L"):
                img = img.convert("RGBA")
            if (new_w, new_h) != (w, h):
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            if sharpen:
                img = ImageEnhance.Sharpness(img.filter(ImageFilter.SHARPEN)).enhance(1.3)
            if fmt in ("jpg", "bmp") and img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.getchannel("A"))
                img = background
            pil_format = {"png": "PNG", "jpg": "JPEG", "webp": "WEBP", "bmp": "BMP"}[fmt]
            options = {"quality": 92} if fmt in ("jpg", "webp") else {}
            img.save(STORAGE / out_name, pil_format, **options)
    except HTTPException:
        raise
    except Exception as exc:
        print("görsel hatası:", exc)
        raise HTTPException(400, "Görsel işlenemedi. Dosya bozuk ya da desteklenmeyen biçimde olabilir.")
    finally:
        in_path.unlink(missing_ok=True)
    return {"download_url": f"/api/download/{out_name}"}


@app.get("/api/download/{filename}")
def download(filename: str):
    match = NAME_RE.fullmatch(filename)
    path = STORAGE / filename
    if not match or not path.is_file():
        raise HTTPException(404, "Dosya bulunamadı ya da süresi doldu.")
    return FileResponse(path, filename=f"minimedia_{match.group(1)[:8]}.{match.group(2)}")


def cleanup_loop():
    while True:
        time.sleep(600)
        now = time.time()
        for p in STORAGE.glob("*"):
            try:
                if p.is_file() and now - p.stat().st_mtime > KEEP_SECONDS:
                    p.unlink()
            except OSError:
                pass
        with jobs_lock:
            for key in [k for k, j in jobs.items() if now - j["created"] > KEEP_SECONDS]:
                del jobs[key]


threading.Thread(target=cleanup_loop, daemon=True).start()
