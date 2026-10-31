import os
import time
import shutil
import zipfile
import subprocess
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from apscheduler.schedulers.background import BackgroundScheduler
import imageio_ffmpeg
from PIL import Image, ImageEnhance, ImageFilter
import yt_dlp

app = FastAPI(title="MiniMedia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_DIR = Path("storage")
STORAGE_DIR.mkdir(exist_ok=True)
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

# --- 1 SAAT SONRA OTOMATİK SİLME MOTORU ---
def cleanup_old_files():
    now = time.time()
    for item in STORAGE_DIR.glob("*"):
        if now - item.stat().st_mtime > 3600:  # 3600 saniye = 1 saat
            if item.is_file():
                item.unlink(missing_ok=True)
            elif item.is_dir():
                shutil.rmtree(item, ignore_errors=True)

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_files, "interval", minutes=10)
scheduler.start()

# --- FOTOĞRAF İŞLEME ---
@app.post("/api/process-image")
async def process_image(
    file: UploadFile = File(...),
    target_format: str = Form("png"),      # png, jpg, webp vb.
    scale: float = Form(1.0),              # 1.5, 2.0 (büyütme oranı)
    sharpen: bool = Form(False)            # keskinleştirme
):
    task_id = f"img_{int(time.time()*1000)}"
    in_ext = Path(file.filename).suffix
    input_path = STORAGE_DIR / f"{task_id}_in{in_ext}"
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    out_format = target_format.lower().replace("jpg", "jpeg")
    output_filename = f"{task_id}_out.{target_format.lower()}"
    output_path = STORAGE_DIR / output_filename

    try:
        with Image.open(input_path) as img:
            # Format RGB dönüşümü (PNG transparanlığı JPG'ye çevrilirken hata vermesin)
            if out_format in ["jpeg", "jpg"] and img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Büyütme (Scale)
            if scale != 1.0:
                new_w = int(img.width * scale)
                new_h = int(img.height * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # Keskinleştirme (Kalite hissini artırır)
            if sharpen:
                img = img.filter(ImageFilter.SHARPEN)
                enhancer = ImageEnhance.Sharpness(img)
                img = enhancer.enhance(1.5)

            img.save(output_path, format=out_format.upper(), quality=95)
    finally:
        input_path.unlink(missing_ok=True)

    return {"download_url": f"/api/download/{output_filename}", "filename": output_filename}


# --- VİDEO DÖNÜŞTÜRME & BOYUTLANDIRMA & SES AYARI ---
@app.post("/api/process-video")
async def process_video(
    file: UploadFile = File(None),
    youtube_url: str = Form(None),
    target_format: str = Form("mp4"),      # mp4, mkv, avi, 3gp, mp3 vb.
    resolution: str = Form(None),          # '320x240', '600x300', '1280x720' vb.
    volume: float = Form(1.0)              # 0.5 (%50), 1.0 (%100), 1.8 (%180)
):
    task_id = f"vid_{int(time.time()*1000)}"
    input_path = None

    # 1. Dosya veya Tekil YouTube Videosu Al
    if file:
        in_ext = Path(file.filename).suffix or ".mp4"
        input_path = STORAGE_DIR / f"{task_id}_in{in_ext}"
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    elif youtube_url:
        input_path = STORAGE_DIR / f"{task_id}_yt.mp4"
        ydl_opts = {
            'outtmpl': str(input_path),
            'format': 'bestvideo+bestaudio/best',
            'merge_output_format': 'mp4'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([youtube_url])
    else:
        raise HTTPException(status_code=400, detail="Dosya veya YouTube linki girilmedi.")

    output_filename = f"{task_id}_out.{target_format.lower()}"
    output_path = STORAGE_DIR / output_filename

    # 2. FFmpeg Komutunu Hazırla
    cmd = [FFMPEG_PATH, "-y", "-i", str(input_path)]

    filter_complex = []
    if resolution and "x" in resolution:
        w, h = resolution.split("x")
        # FFmpeg çift sayılı boyut gerektirir
        filter_complex.append(f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2")

    if filter_complex:
        cmd.extend(["-vf", ",".join(filter_complex)])

    # Ses Seviyesi
    if volume != 1.0:
        cmd.extend(["-filter:a", f"volume={volume}"])
    if target_format.lower() == "3gp":
        cmd.extend(["-c:v", "mpeg4", "-c:a", "aac"])
    cmd.append(str(output_path))

    # Çalıştır
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if input_path.exists():
        input_path.unlink(missing_ok=True)

    if res.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Dönüştürme hatası: {res.stderr.decode('utf-8')[:300]}")

    return {"download_url": f"/api/download/{output_filename}", "filename": output_filename}


# --- YOUTUBE PLAYLIST TOPLU İNDİRME (ZIP) ---
@app.post("/api/process-playlist")
async def process_playlist(youtube_url: str = Form(...)):
    task_id = f"playlist_{int(time.time()*1000)}"
    playlist_folder = STORAGE_DIR / task_id
    playlist_folder.mkdir(exist_ok=True)

    ydl_opts = {
        'outtmpl': f'{playlist_folder}/%(title)s.%(ext)s',
        'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
        'merge_output_format': 'mp4'
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([youtube_url])

        # Zip dosyası oluştur
        zip_filename = f"{task_id}.zip"
        zip_path = STORAGE_DIR / zip_filename

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in playlist_folder.glob("*"):
                zipf.write(file, arcname=file.name)

        return {"download_url": f"/api/download/{zip_filename}", "filename": zip_filename}
    finally:
        shutil.rmtree(playlist_folder, ignore_errors=True)


# --- DOSYA İNDİRME VE ERİŞİM ---
@app.get("/api/download/{filename}")
async def download_file(filename: str):
    file_path = STORAGE_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dosya süresi dolmuş veya bulunamadı (1 saat dolmuş olabilir).")
    return FileResponse(file_path, filename=filename)
from fastapi.responses import HTMLResponse

# --- TUŞLU TELEFONLAR İÇİN JAVASCRIPT'SİZ LITE ARAYÜZ (GET) ---
@app.get("/lite", response_class=HTMLResponse)
async def lite_home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MiniMedia Lite</title>
        <style>
            body { font-family: sans-serif; background: #000; color: #fff; padding: 10px; font-size: 14px; }
            h1 { font-size: 18px; color: #0f0; margin-bottom: 5px; }
            .box { border: 1px solid #444; padding: 10px; margin-bottom: 15px; background: #111; }
            label { display: block; margin-top: 8px; font-weight: bold; }
            input[type="submit"] { background: #08c; color: #fff; border: none; padding: 8px 15px; margin-top: 10px; width: 100%; font-weight: bold; }
            select, input[type="file"], input[type="text"] { width: 100%; margin-top: 4px; background: #222; color: #fff; border: 1px solid #555; }
        </style>
    </head>
    <body>
        <h1>MiniMedia Lite (Tuşlu Telefon Sürümü)</h1>
        <p>JavaScript gerektirmeyen hafif dönüştürücü.</p>

        <!-- VİDEO DÖNÜŞTÜRME FORMU -->
        <div class="box">
            <h3>1. Video / YouTube Dönüştür</h3>
            <form action="/lite/process-video" method="POST" enctype="multipart/form-data">
                <label>Video Dosyası Seç:</label>
                <input type="file" name="file">
                
                <p style="text-align:center; margin: 5px 0;">-- VEYA --</p>
                
                <label>YouTube Linki:</label>
                <input type="text" name="youtube_url" placeholder="https://youtube.com/...">

                <label>Hedef Format:</label>
                <select name="target_format">
                    <option value="3gp">.3GP (Eski Tuşlu Telefon)</option>
                    <option value="mp4" selected>.MP4 (Standart)</option>
                    <option value="mp3">.MP3 (Sadece Ses)</option>
                    <option value="avi">.AVI</option>
                </select>

                <label>Çözünürlük (Tuşlu için 320x240 seçin):</label>
                <select name="resolution">
                    <option value="">Orijinal Boyut</option>
                    <option value="320x240" selected>320x240 (Retro / Tuşlu)</option>
                    <option value="640x480">640x480 (SD)</option>
                    <option value="1280x720">1280x720 (HD)</option>
                </select>

                <label>Ses Seviyesi:</label>
                <select name="volume">
                    <option value="1.0" selected>%100 (Normal)</option>
                    <option value="1.5">%150 (Yüksek)</option>
                    <option value="2.0">%200 (Çok Yüksek)</option>
                </select>

                <input type="submit" value="VİDEOYU İŞLE VE YÜKLE">
            </form>
        </div>

        <!-- FOTOĞRAF DÖNÜŞTÜRME FORMU -->
        <div class="box">
            <h3>2. Fotoğraf İşle</h3>
            <form action="/lite/process-image" method="POST" enctype="multipart/form-data">
                <label>Fotoğraf Seç:</label>
                <input type="file" name="file" required>

                <label>Format:</label>
                <select name="target_format">
                    <option value="jpg" selected>.JPG</option>
                    <option value="png">.PNG</option>
                    <option value="bmp">.BMP (Eski Ekranlar)</option>
                </select>

                <label>Büyütme (Scale):</label>
                <select name="scale">
                    <option value="1.0" selected>1x (Orijinal)</option>
                    <option value="1.5">1.5x</option>
                    <option value="2.0">2x</option>
                </select>

                <input type="submit" value="FOTOĞRAFI İŞLE">
            </form>
        </div>
    </body>
    </html>
    """

# --- LITE VİDEO İŞLEME ENDPOINT (POST) ---
@app.post("/lite/process-video", response_class=HTMLResponse)
async def lite_process_video(
    file: UploadFile = File(None),
    youtube_url: str = Form(None),
    target_format: str = Form("mp4"),
    resolution: str = Form(None),
    volume: float = Form(1.0)
):
    try:
        # Mevcut API fonksiyonumuzu çağırıyoruz
        res = await process_video(file=file, youtube_url=youtube_url, target_format=target_format, resolution=resolution, volume=volume)
        download_url = res["download_url"]
        filename = res["filename"]
        return f"""
        <html>
        <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
            <h2 style="color:#0f0;">İşlem Başarılı!</h2>
            <p>Dosyanız hazırlandı:</p>
            <p><a href="{download_url}" style="background:#0a0; color:#fff; padding:10px 20px; text-decoration:none; display:inline-block; font-weight:bold;">DOSYAYI İNDİR ({filename})</a></p>
            <br><br>
            <a href="/lite" style="color:#ccc;">&laquo; Geri Dön</a>
        </body>
        </html>
        """
    except Exception as e:
        return f"""
        <html>
        <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
            <h2 style="color:#f00;">Hata Oluştu</h2>
            <p>{str(e)}</p>
            <a href="/lite" style="color:#ccc;">&laquo; Tekrar Deneyin</a>
        </body>
        </html>
        """

# --- LITE FOTOĞRAF İŞLEME ENDPOINT (POST) ---
@app.post("/lite/process-image", response_class=HTMLResponse)
async def lite_process_image(
    file: UploadFile = File(...),
    target_format: str = Form("jpg"),
    scale: float = Form(1.0)
):
    try:
        res = await process_image(file=file, target_format=target_format, scale=scale, sharpen=False)
        download_url = res["download_url"]
        filename = res["filename"]
        return f"""
        <html>
        <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
            <h2 style="color:#0f0;">Fotoğraf İşlendi!</h2>
            <p><a href="{download_url}" style="background:#0a0; color:#fff; padding:10px 20px; text-decoration:none; display:inline-block; font-weight:bold;">İNDİR ({filename})</a></p>
            <br><br>
            <a href="/lite" style="color:#ccc;">&laquo; Geri Dön</a>
        </body>
        </html>
        """
    except Exception as e:
        return f"""
        <html>
        <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
            <h2 style="color:#f00;">Hata Oluştu</h2>
            <p>{str(e)}</p>
            <a href="/lite" style="color:#ccc;">&laquo; Tekrar Deneyin</a>
        </body>
        </html>
        """
    from fastapi import Request
from fastapi.responses import RedirectResponse

# Tuşlu ve eski telefonlarda yaygın kullanılan sistem/tarayıcı anahtar kelimeleri
FEATURE_PHONE_KEYWORDS = [
    "nokia", "symbian", "opera mini", "j2me", "midp", "series60",
    "kaios", "netfront", "up.browser", "obigo", "teleca", "samsung-sgh",
    "sonyericsson", "mot-", "lg/", "wap"
]

@app.middleware("http")
async def detect_feature_phone_and_redirect(request: Request, call_next):
    # Yalnızca ana sayfaya ("/") yapılan girişlerde yönlendirme kontrolü yap
    if request.url.path == "/":
        user_agent = request.headers.get("user-agent", "").lower()
        
        # Eğer User-Agent içinde tuşlu telefon kelimelerinden biri geçiyorsa
        if any(keyword in user_agent for keyword in FEATURE_PHONE_KEYWORDS):
            return RedirectResponse(url="/lite", status_code=307)
            
    response = await call_next(request)
    return response

@app.post("/api/process-video")
async def process_video(
    file: UploadFile = File(None),
    youtube_url: str = Form(None),
    target_format: str = Form("mp4"),
    resolution: str = Form(None),
    volume: float = Form(1.0)
):
    if not file and not youtube_url:
        raise HTTPException(status_code=400, detail="Lütfen bir dosya veya YouTube URL'si sağlayın.")
    
    # YouTube indirme seçenekleri
    ydl_opts = {
        'format': 'best',
        'outtmpl': str(STORAGE_DIR / '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }
    
    # YouTube Linki varsa indirme işlemi
    if youtube_url:
        import yt_dlp
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            input_path = ydl.prepare_filename(info)