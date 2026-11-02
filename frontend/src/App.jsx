import { useEffect, useRef, useState } from "react";

const BACKEND_URL = "https://minimedia-d2ns.onrender.com".replace(/\/+$/, "");
const MAX_MB = 100; // backend'deki MAX_UPLOAD_MB ile aynı olsun

const RESOLUTION_BOXES = [
  { label: "Retro / Eski Mobil", value: "320x240" },
  { label: "Banner / Özel", value: "600x300" },
  { label: "Standart SD", value: "640x480" },
  { label: "HD Ready", value: "1280x720" },
  { label: "Full HD (1080p)", value: "1920x1080" },
  { label: "Dikey Hikaye/Reels", value: "1080x1920" },
];
const VIDEO_FORMATS = ["mp4", "3gp", "mkv", "avi", "mp3"];
const IMAGE_FORMATS = ["png", "jpg", "webp", "bmp"];
const SCALES = [
  { label: "1x (Orijinal)", val: 1 },
  { label: "1.5x", val: 1.5 },
  { label: "2x (Büyük)", val: 2 },
  { label: "4x (Ultra)", val: 4 },
];

const ui = {
  label: "text-xs uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400",
  focus: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
  file: "mt-2 block w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-200 file:text-zinc-800 hover:file:bg-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer",
  pickOn: "bg-zinc-900 text-white font-semibold border-zinc-900 dark:bg-white dark:text-black dark:border-white",
  pickOff: "border-zinc-300 hover:border-zinc-500 dark:border-zinc-800 dark:hover:border-zinc-600",
  primary: "w-full bg-zinc-900 hover:bg-zinc-700 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed",
};

function errorText(status, text) {
  let data = null;
  try { data = JSON.parse(text); } catch { /* JSON değil */ }
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(", ");
  if (status === 413) return "Dosya sunucu için çok büyük.";
  return `Sunucu hatası (${status}).`;
}

// fetch yükleme ilerlemesini vermediği için XMLHttpRequest kullanıyoruz
function sendForm(url, formData, onUpload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUpload(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Sunucudan beklenmeyen bir yanıt geldi.")); }
      } else {
        reject(new Error(errorText(xhr.status, xhr.responseText)));
      }
    };
    xhr.onerror = () => reject(new Error("Sunucuya ulaşılamadı. Sunucu uyuyor olabilir, bir dakika bekleyip tekrar deneyin."));
    xhr.send(formData);
  });
}

async function pollJob(jobId, onUpdate, alive) {
  const started = Date.now();
  while (alive.current && Date.now() - started < 20 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 1000));
    if (!alive.current) return null;
    let res;
    try { res = await fetch(`${BACKEND_URL}/api/status/${jobId}`); } catch { continue; }
    let data = null;
    try { data = await res.json(); } catch { /* boş yanıt */ }
    if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "İşlem durumu alınamadı.");
    if (data.status === "error") throw new Error(data.error || "Dönüştürme başarısız oldu.");
    if (data.status === "done") return data;
    onUpdate(data);
  }
  throw new Error("İşlem çok uzun sürdü, lütfen tekrar deneyin.");
}

function ProgressBar({ phase, percent }) {
  const labels = {
    upload: "Yükleniyor",
    queued: "Sırada bekliyor",
    processing: "Dönüştürülüyor",
    finishing: "İşleniyor",
  };
  const known = typeof percent === "number";
  return (
    <div
      className="mt-5"
      role="progressbar"
      aria-label={labels[phase]}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? percent : undefined}
    >
      <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
        <span>{labels[phase]}…</span>
        {known && <span>%{percent}</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-emerald-500 transition-all duration-300 ${known ? "" : "w-full animate-pulse motion-reduce:animate-none"}`}
          style={known ? { width: `${percent}%` } : undefined}
        />
      </div>
      {phase === "upload" && percent === 0 && (
        <p className="mt-1.5 text-[10px] text-zinc-500">
          Sunucu uyuyorsa ilk istek bir dakikaya kadar sürebilir.
        </p>
      )}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch { /* depolama kapalı */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [activeTab, setActiveTab] = useState("video");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [downloadLink, setDownloadLink] = useState(null);
  const alive = useRef(true);

  const [videoFile, setVideoFile] = useState(null);
  const [videoFormat, setVideoFormat] = useState("mp4");
  const [selectedRes, setSelectedRes] = useState("");
  const [volume, setVolume] = useState(100);

  const [imageFile, setImageFile] = useState(null);
  const [imgFormat, setImgFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [sharpen, setSharpen] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("theme", theme); } catch { /* depolama kapalı */ }
  }, [theme]);

  const resetResult = () => { setError(""); setDownloadLink(null); };

  const run = async (task) => {
    setBusy(true);
    resetResult();
    setProgress({ phase: "upload", percent: 0 });
    try {
      const url = await task();
      if (url) setDownloadLink(`${BACKEND_URL}${url}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const tooBig = (file) => file.size > MAX_MB * 1024 * 1024;

  const handleVideoSubmit = () => {
    if (!videoFile) return setError("Lütfen bir video dosyası seçin.");
    if (tooBig(videoFile)) return setError(`Dosya ${MAX_MB} MB'tan büyük olamaz.`);
    const form = new FormData();
    form.append("file", videoFile);
    form.append("target_format", videoFormat);
    if (videoFormat !== "mp3" && selectedRes) form.append("resolution", selectedRes);
    form.append("volume", String(volume / 100));
    return run(async () => {
      const { job_id } = await sendForm(
        `${BACKEND_URL}/api/process-video`,
        form,
        (percent) => setProgress({ phase: "upload", percent }),
      );
      setProgress({ phase: "queued", percent: null });
      const done = await pollJob(
        job_id,
        (d) => setProgress({
          phase: d.status === "queued" ? "queued" : "processing",
          percent: typeof d.progress === "number" ? d.progress : null,
        }),
        alive,
      );
      return done?.download_url;
    });
  };

  const handleImageSubmit = () => {
    if (!imageFile) return setError("Lütfen bir resim seçin.");
    if (tooBig(imageFile)) return setError(`Dosya ${MAX_MB} MB'tan büyük olamaz.`);
    const form = new FormData();
    form.append("file", imageFile);
    form.append("target_format", imgFormat);
    form.append("scale", String(scale));
    form.append("sharpen", String(sharpen));
    return run(async () => {
      const data = await sendForm(
        `${BACKEND_URL}/api/process-image`,
        form,
        (percent) => setProgress(percent >= 100
          ? { phase: "finishing", percent: null }
          : { phase: "upload", percent }),
      );
      return data.download_url;
    });
  };

  const tabClass = (name) =>
    `flex-1 py-2 text-sm font-medium rounded-md transition disabled:cursor-not-allowed ${ui.focus} ${
      activeTab === name
        ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white"
        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
    }`;

  const switchTab = (name) => { setActiveTab(name); resetResult(); };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-200 flex flex-col items-center py-12 px-4 font-sans transition-colors">
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={theme === "dark" ? "Gündüz moduna geç" : "Gece moduna geç"}
        className={`fixed top-4 right-4 z-10 flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition ${ui.focus}`}
      >
        <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
        {theme === "dark" ? "Gündüz" : "Gece"}
      </button>

      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-1">minimedia</h1>
        <p className="text-sm text-zinc-500">Minimal medya dönüştürücü ve ölçekleyici</p>
      </header>

      <div role="tablist" className="flex bg-zinc-200 border border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg p-1 mb-8 w-full max-w-xl">
        <button type="button" role="tab" aria-selected={activeTab === "video"} disabled={busy} onClick={() => switchTab("video")} className={tabClass("video")}>
          🎬 Video
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "image"} disabled={busy} onClick={() => switchTab("image")} className={tabClass("image")}>
          🖼️ Fotoğraf Düzenle
        </button>
      </div>

      <div className="w-full max-w-xl bg-white border border-zinc-200 dark:bg-zinc-900/60 dark:border-zinc-800/80 backdrop-blur rounded-2xl p-6 shadow-xl">
        {activeTab === "video" ? (
          <div className="space-y-6">
            <div>
              <label htmlFor="video-file" className={ui.label}>Video Yükle</label>
              <input
                id="video-file"
                type="file"
                accept="video/*,audio/*"
                disabled={busy}
                onChange={(e) => { setVideoFile(e.target.files[0] || null); resetResult(); }}
                className={ui.file}
              />
            </div>

            <div>
              <span className={ui.label}>Hedef Format</span>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {VIDEO_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    aria-pressed={videoFormat === fmt}
                    disabled={busy}
                    onClick={() => setVideoFormat(fmt)}
                    className={`py-1.5 text-xs font-mono rounded-lg border transition ${ui.focus} ${videoFormat === fmt ? ui.pickOn : ui.pickOff}`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>

            {videoFormat !== "mp3" && (
              <div>
                <span className={ui.label}>Boyut Değiştir (isteğe bağlı)</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {RESOLUTION_BOXES.map((box) => {
                    const on = selectedRes === box.value;
                    return (
                      <button
                        key={box.value}
                        type="button"
                        aria-pressed={on}
                        disabled={busy}
                        onClick={() => setSelectedRes(on ? "" : box.value)}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-left transition ${ui.focus} ${
                          on
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
                        }`}
                      >
                        <span className="flex flex-col">
                          <span className="text-xs font-mono font-bold">{box.value}</span>
                          <span className="text-[10px] text-zinc-500">{box.label}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${on ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-400 dark:border-zinc-700"}`}
                        >
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">
                <label htmlFor="volume">Ses Düzeyi</label>
                <span>%{volume}</span>
              </div>
              <input
                id="volume"
                type="range"
                min="0"
                max="200"
                value={volume}
                disabled={busy}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-zinc-900 dark:accent-white h-1.5 cursor-pointer"
              />
            </div>

            <button type="button" disabled={busy || !videoFile} onClick={handleVideoSubmit} className={`${ui.primary} ${ui.focus}`}>
              {busy ? "İşleniyor..." : "Videoyu Dönüştür"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label htmlFor="image-file" className={ui.label}>Fotoğraf Yükle</label>
              <input
                id="image-file"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => { setImageFile(e.target.files[0] || null); resetResult(); }}
                className={ui.file}
              />
            </div>

            <div>
              <span className={ui.label}>Hedef Format</span>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {IMAGE_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    aria-pressed={imgFormat === fmt}
                    disabled={busy}
                    onClick={() => setImgFormat(fmt)}
                    className={`py-1.5 text-xs font-mono rounded-lg border transition ${ui.focus} ${imgFormat === fmt ? ui.pickOn : ui.pickOff}`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={ui.label}>Ölçek Büyüt (Scale)</span>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {SCALES.map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    aria-pressed={scale === s.val}
                    disabled={busy}
                    onClick={() => setScale(s.val)}
                    className={`py-2 text-xs rounded-lg border transition ${ui.focus} ${
                      scale === s.val
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center space-x-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sharpen}
                disabled={busy}
                onChange={(e) => setSharpen(e.target.checked)}
                className="rounded border-zinc-400 dark:bg-zinc-950 dark:border-zinc-700"
              />
              <span>Keskinleştirme ve Kalite Düzeltme Uygula</span>
            </label>

            <button type="button" disabled={busy || !imageFile} onClick={handleImageSubmit} className={`${ui.primary} ${ui.focus}`}>
              {busy ? "İşleniyor..." : "Fotoğrafı İşle ve Kaydet"}
            </button>
          </div>
        )}

        {progress && <ProgressBar phase={progress.phase} percent={progress.percent} />}

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {downloadLink && (
          <div className="mt-6 p-4 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">İşlem Tamamlandı</span>
              <span className="text-[10px] text-zinc-500">Dosyanız 1 saat sonra sunucudan otomatik silinecektir.</span>
            </div>
            <a
              href={downloadLink}
              download
              className={`px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-lg transition ${ui.focus}`}
            >
              İndir
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
