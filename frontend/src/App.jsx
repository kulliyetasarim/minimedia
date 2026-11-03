import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DinoGame from "./DinoGame";

const BACKEND_URL = "https://minimedia-d2ns.onrender.com".replace(/\/+$/, "");
const MAX_MB = 200;

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
const DOC_FORMATS = ["pdf", "docx"];
const SCALES = [
  { label: "1x (Orijinal)", val: 1 },
  { label: "1.5x", val: 1.5 },
  { label: "2x (Büyük)", val: 2 },
  { label: "4x (Ultra)", val: 4 },
];

const ui = {
  label: "text-xs uppercase font-semibold tracking-wider text-zinc-500 dark:text-zinc-400",
  focus: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
  file: "mt-2 block w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-200 file:text-zinc-800 hover:file:bg-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer",
  pickOn: "bg-zinc-900 text-white font-semibold border-zinc-900 dark:bg-white dark:text-black dark:border-white",
  pickOff: "border-zinc-300 hover:border-zinc-500 dark:border-zinc-800 dark:hover:border-zinc-600",
  primary: "w-full bg-zinc-900 hover:bg-zinc-700 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed",
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

function MiniProgressBar({ phase, percent }) {
  const labels = {
    upload: "Yükleniyor",
    queued: "Sırada",
    processing: "Dönüştürülüyor",
    finishing: "İşleniyor",
  };
  const known = typeof percent === "number";
  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          {labels[phase] || "İşleniyor"}…
        </span>
        {known && <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">%{percent}</span>}
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden p-0.5 border border-zinc-300/50 dark:border-zinc-700/50">
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 overflow-hidden shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-300"
          style={{ width: known ? `${percent}%` : "100%" }}
        >
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className="absolute inset-0 w-[200%] h-full bg-[linear-gradient(115deg,transparent_25%,rgba(255,255,255,0.45)_50%,transparent_75%)] bg-[length:25px_100%]"
          />
        </motion.div>
      </div>
    </div>
  );
}

function BeforeAfterSlider({ originalUrl, sharpen, scale }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => e.touches[0] && handleMove(e.touches[0].clientX)}
      className="relative w-full h-48 rounded-xl overflow-hidden select-none cursor-ew-resize border border-zinc-200 dark:border-zinc-800 bg-black/40"
    >
      <div className="absolute inset-0 w-full h-full">
        <img
          src={originalUrl}
          alt="Sonrası"
          className="w-full h-full object-contain"
          style={{
            filter: sharpen ? "contrast(1.2) contrast(1.1) saturate(1.15)" : "none",
            transform: scale > 1 ? `scale(${Math.min(1.2, scale)})` : "none",
            transition: "filter 0.2s, transform 0.2s",
          }}
        />
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium tracking-wide">
          Sonrası {sharpen ? "(Keskin)" : ""}
        </span>
      </div>

      <div
        className="absolute top-0 left-0 bottom-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={originalUrl}
          alt="Öncesi"
          className="absolute top-0 left-0 max-w-none h-full object-contain"
          style={{ width: containerRef.current ? containerRef.current.clientWidth : "100%" }}
        />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium tracking-wide">
          Orijinal
        </span>
      </div>

      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-zinc-900 shadow-md flex items-center justify-center text-[10px] font-bold">
          ↔
        </div>
      </div>
    </div>
  );
}

/* API Runner Fonksiyonları */
async function runVideoJob(file, config, id, abortRef, onProgress, onDone, onError) {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("target_format", config.format);
    if (config.format !== "mp3" && config.res) form.append("resolution", config.res);
    form.append("volume", String((config.volume ?? 100) / 100));
    form.append("audio_normalize", String(!!config.audioNormalize));

    const uploadRes = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      abortRef.xhr = xhr;
      xhr.open("POST", `${BACKEND_URL}/api/process-video`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress("upload", Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Beklenmeyen yanıt formatı.")); }
        } else reject(new Error(errorText(xhr.status, xhr.responseText)));
      };
      xhr.onerror = () => reject(new Error("Sunucuya ulaşılamadı."));
      xhr.onabort = () => reject(new Error("İşlem kullanıcı tarafından iptal edildi."));
      xhr.send(form);
    });

    if (abortRef.current) return;
    const jobId = uploadRes.job_id;
    onProgress("queued", null);

    const started = Date.now();
    while (!abortRef.current && Date.now() - started < 20 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 1000));
      if (abortRef.current) return;

      let res;
      try { res = await fetch(`${BACKEND_URL}/api/status/${jobId}`); } catch { continue; }
      let data = null;
      try { data = await res.json(); } catch { /* boş */ }
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Durum alınamadı.");
      if (data.status === "error") throw new Error(data.error || "Dönüştürme başarısız oldu.");
      if (data.status === "done") {
        onDone(`${BACKEND_URL}${data.download_url}`);
        return;
      }
      onProgress(
        data.status === "queued" ? "queued" : "processing",
        typeof data.progress === "number" ? data.progress : null
      );
    }
  } catch (err) {
    if (!abortRef.current) onError(err.message);
  }
}

async function runImageJob(file, config, id, abortRef, onProgress, onDone, onError) {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("target_format", config.format);
    form.append("scale", String(config.scale || 1));
    form.append("sharpen", String(!!config.sharpen));
    form.append("exif_clean", String(!!config.exifClean));

    const resData = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      abortRef.xhr = xhr;
      xhr.open("POST", `${BACKEND_URL}/api/process-image`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          onProgress(p >= 100 ? "finishing" : "upload", p >= 100 ? null : p);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Beklenmeyen yanıt.")); }
        } else reject(new Error(errorText(xhr.status, xhr.responseText)));
      };
      xhr.onerror = () => reject(new Error("Sunucuya ulaşılamadı."));
      xhr.onabort = () => reject(new Error("İşlem kullanıcı tarafından iptal edildi."));
      xhr.send(form);
    });

    if (!abortRef.current) {
      onDone(`${BACKEND_URL}${resData.download_url}`);
    }
  } catch (err) {
    if (!abortRef.current) onError(err.message);
  }
}

async function runDocumentJob(file, config, id, abortRef, onProgress, onDone, onError) {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("target_format", config.format);

    const resData = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      abortRef.xhr = xhr;
      xhr.open("POST", `${BACKEND_URL}/api/process-document`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          onProgress(p >= 100 ? "finishing" : "upload", p >= 100 ? null : p);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Beklenmeyen yanıt.")); }
        } else reject(new Error(errorText(xhr.status, xhr.responseText)));
      };
      xhr.onerror = () => reject(new Error("Sunucuya ulaşılamadı."));
      xhr.onabort = () => reject(new Error("İşlem kullanıcı tarafından iptal edildi."));
      xhr.send(form);
    });

    if (!abortRef.current) {
      onDone(`${BACKEND_URL}${resData.download_url}`);
    }
  } catch (err) {
    if (!abortRef.current) onError(err.message);
  }
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch { /* depolama kapalı */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [isOverCard, setIsOverCard] = useState(false);

  /* HAFİF KALIN İP ŞERİT FARE İZİ (DÖNÜŞTÜRME KUTUSUNDA KAPANIR) */
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e) => {
      if (isOverCard) return;
      pointsRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() });
    };
    window.addEventListener("mousemove", handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!isOverCard) {
        const now = Date.now();
        const maxAge = 350;
        pointsRef.current = pointsRef.current.filter((p) => now - p.time < maxAge);

        const pts = pointsRef.current;
        if (pts.length > 1) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowBlur = 10;
          ctx.shadowColor = theme === "dark" ? "rgba(52, 211, 153, 0.5)" : "rgba(16, 185, 129, 0.4)";

          for (let i = 1; i < pts.length; i++) {
            const p1 = pts[i - 1];
            const p2 = pts[i];
            const ageRatio = (now - p2.time) / maxAge;
            const alpha = Math.max(0, (1 - ageRatio) * 0.65);
            const progress = i / pts.length;
            const width = Math.max(1.5, progress * 9);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = theme === "dark"
              ? `rgba(52, 211, 153, ${alpha})`
              : `rgba(16, 185, 129, ${alpha})`;
            ctx.lineWidth = width;
            ctx.stroke();
          }
          ctx.restore();
        }
      } else {
        pointsRef.current = [];
      }
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, [theme, isOverCard]);

  /* Giriş Modal State'leri */
  const [showAuthModal, setShowAuthModal] = useState(() => {
    try { return !localStorage.getItem("minimedia_skip_auth"); } catch { return true; }
  });
  const [authTab, setAuthTab] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeTab, setActiveTab] = useState("video");
  const [error, setError] = useState("");
  
  const [jobs, setJobs] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [openJobMenuId, setOpenJobMenuId] = useState(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [batchNotice, setBatchNotice] = useState("");

  /* İşlenen Medya Önizleme Player Modalı State'i */
  const [previewMedia, setPreviewMedia] = useState(null);

  /* 3 Nokta Menüsü Dış Tıklama Dinleyicisi */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openJobMenuId && !e.target.closest(".job-menu-container")) {
        setOpenJobMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openJobMenuId]);

  /* Video Ayarları */
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [videoFormat, setVideoFormat] = useState("mp4");
  const [selectedRes, setSelectedRes] = useState("");
  const [volume, setVolume] = useState(100);
  const [audioNormalize, setAudioNormalize] = useState(false);
  const [isEditingVol, setIsEditingVol] = useState(false);

  /* Fotoğraf Ayarları */
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imgFormat, setImgFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [sharpen, setSharpen] = useState(false);
  const [exifClean, setExifClean] = useState(true);

  /* Belge Ayarları */
  const [docFile, setDocFile] = useState(null);
  const [docFormat, setDocFormat] = useState("pdf");

  useEffect(() => {
    if (docFile) {
      const ext = docFile.name.split(".").pop().toLowerCase();
      if (ext === "pdf") setDocFormat("docx");
      else if (ext === "docx" || ext === "doc") setDocFormat("pdf");
    }
  }, [docFile]);

  /* Canlı Önizleme URL Yönetimi */
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoPreviewUrl(null);
    }
  }, [videoFile]);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [imageFile]);

  /* Preset Yönetimi */
  const [presets, setPresets] = useState(() => {
    try {
      const saved = localStorage.getItem("formatyap_presets");
      return saved ? JSON.parse(saved) : [
        { id: "1", name: "WhatsApp Video Modu", type: "video", format: "mp4", res: "640x480", volume: 100, audioNormalize: true },
        { id: "2", name: "HD Keskin Fotoğraf", type: "image", format: "webp", scale: 2, sharpen: true, exifClean: true },
      ];
    } catch { return []; }
  });
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    try { localStorage.setItem("formatyap_presets", JSON.stringify(presets)); } catch {}
  }, [presets]);

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      type: activeTab,
      format: activeTab === "video" ? videoFormat : activeTab === "image" ? imgFormat : docFormat,
      res: selectedRes,
      volume,
      audioNormalize,
      scale,
      sharpen,
      exifClean,
    };
    setPresets([newPreset, ...presets]);
    setNewPresetName("");
  };

  const applyPreset = (p) => {
    setActiveTab(p.type);
    if (p.type === "video") {
      setVideoFormat(p.format || "mp4");
      setSelectedRes(p.res || "");
      setVolume(p.volume ?? 100);
      setAudioNormalize(!!p.audioNormalize);
    } else if (p.type === "image") {
      setImgFormat(p.format || "png");
      setScale(p.scale || 1);
      setSharpen(!!p.sharpen);
      setExifClean(p.exifClean !== undefined ? !!p.exifClean : true);
    } else {
      setDocFormat(p.format || "pdf");
    }
    setIsSettingsOpen(false);
  };

  const removePreset = (id) => setPresets(presets.filter((p) => p.id !== id));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("theme", theme); } catch { /* depolama kapalı */ }
  }, [theme]);

  const tooBig = (file) => file.size > MAX_MB * 1024 * 1024;

  const startJob = (fileName, format, fileObj, config, runner) => {
    const id = Date.now().toString();
    const abortRef = { current: false, xhr: null };

    const newJob = {
      id,
      fileName,
      format,
      file: fileObj,
      config,
      phase: "upload",
      percent: 0,
      status: "running",
      downloadUrl: null,
      errorMsg: null,
      abortRef,
    };

    setJobs((prev) => [newJob, ...prev]);

    runner(
      id,
      abortRef,
      (phase, percent) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, phase, percent } : j)));
      },
      (downloadUrl) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "done", downloadUrl } : j)));
      },
      (errMsg) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "error", errorMsg: errMsg } : j)));
      }
    );
  };

  /* SÜRÜKLE - BIRAK */
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      const ext = file.name.split(".").pop().toLowerCase();
      if (["pdf", "doc", "docx"].includes(ext)) {
        setActiveTab("document");
        setDocFile(file);
        setError("");
      } else if (file.type.startsWith("image/")) {
        setActiveTab("image");
        setImageFile(file);
        setError("");
      } else {
        setActiveTab("video");
        setVideoFile(file);
        setError("");
      }
    } else {
      let addedCount = 0;
      files.forEach((file) => {
        if (tooBig(file)) return;
        addedCount++;
        const ext = file.name.split(".").pop().toLowerCase();

        if (["pdf", "doc", "docx"].includes(ext)) {
          const targetFmt = ext === "pdf" ? "docx" : "pdf";
          const config = { type: "document", format: targetFmt };
          startJob(file.name, targetFmt, file, config, (id, abortRef, onProgress, onDone, onError) => {
            runDocumentJob(file, config, id, abortRef, onProgress, onDone, onError);
          });
        } else if (file.type.startsWith("image/")) {
          const config = { type: "image", format: imgFormat, scale, sharpen, exifClean };
          startJob(file.name, imgFormat, file, config, (id, abortRef, onProgress, onDone, onError) => {
            runImageJob(file, config, id, abortRef, onProgress, onDone, onError);
          });
        } else {
          const config = { type: "video", format: videoFormat, res: selectedRes, volume, audioNormalize };
          startJob(file.name, videoFormat, file, config, (id, abortRef, onProgress, onDone, onError) => {
            runVideoJob(file, config, id, abortRef, onProgress, onDone, onError);
          });
        }
      });

      if (addedCount > 0) {
        setBatchNotice(`${addedCount} adet dosya topluca sıraya eklendi.`);
        setTimeout(() => setBatchNotice(""), 4000);
        setIsPanelOpen(true);
      }
    }
    e.dataTransfer.clearData();
  };

  const handleMultipleVideoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length === 1) {
      setVideoFile(files[0]);
      setError("");
    } else {
      let addedCount = 0;
      files.forEach((file) => {
        if (tooBig(file)) return;
        addedCount++;
        const config = { type: "video", format: videoFormat, res: selectedRes, volume, audioNormalize };
        startJob(file.name, videoFormat, file, config, (id, abortRef, onProgress, onDone, onError) => {
          runVideoJob(file, config, id, abortRef, onProgress, onDone, onError);
        });
      });
      if (addedCount > 0) {
        setBatchNotice(`${addedCount} adet video sıraya eklendi.`);
        setTimeout(() => setBatchNotice(""), 4000);
        setIsPanelOpen(true);
      }
      e.target.value = "";
    }
  };

  const handleMultipleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length === 1) {
      setImageFile(files[0]);
      setError("");
    } else {
      let addedCount = 0;
      files.forEach((file) => {
        if (tooBig(file)) return;
        addedCount++;
        const config = { type: "image", format: imgFormat, scale, sharpen, exifClean };
        startJob(file.name, imgFormat, file, config, (id, abortRef, onProgress, onDone, onError) => {
          runImageJob(file, config, id, abortRef, onProgress, onDone, onError);
        });
      });
      if (addedCount > 0) {
        setBatchNotice(`${addedCount} adet resim sıraya eklendi.`);
        setTimeout(() => setBatchNotice(""), 4000);
        setIsPanelOpen(true);
      }
      e.target.value = "";
    }
  };

  const restartJob = (job) => {
    if (!job.file) return;
    const id = job.id;
    const abortRef = { current: false, xhr: null };

    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status: "running", phase: "upload", percent: 0, errorMsg: null, downloadUrl: null, abortRef }
          : j
      )
    );

    const onProgress = (phase, percent) => {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, phase, percent } : j)));
    };
    const onDone = (downloadUrl) => {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "done", downloadUrl } : j)));
    };
    const onError = (errMsg) => {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "error", errorMsg: errMsg } : j)));
    };

    if (job.config?.type === "video") {
      runVideoJob(job.file, job.config, id, abortRef, onProgress, onDone, onError);
    } else if (job.config?.type === "image") {
      runImageJob(job.file, job.config, id, abortRef, onProgress, onDone, onError);
    } else {
      runDocumentJob(job.file, job.config, id, abortRef, onProgress, onDone, onError);
    }
  };

  const cancelJob = (job) => {
    if (job.abortRef) {
      job.abortRef.current = true;
      if (job.abortRef.xhr) job.abortRef.xhr.abort();
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "cancelled" } : j)));
  };

  const removeJob = (id) => setJobs((prev) => prev.filter((j) => j.id !== id));

  const handleVideoSubmit = () => {
    if (!videoFile) return setError("Lütfen bir video dosyası seçin.");
    if (tooBig(videoFile)) return setError(`Dosya ${MAX_MB} MB'tan büyük olamaz.`);
    setError("");

    const currentFile = videoFile;
    const currentFmt = videoFormat;
    const currentRes = selectedRes;
    const currentVol = volume;
    const currentNormalize = audioNormalize;

    setVideoFile(null);
    const fileInput = document.getElementById("video-file");
    if (fileInput) fileInput.value = "";

    const config = { type: "video", format: currentFmt, res: currentRes, volume: currentVol, audioNormalize: currentNormalize };

    setIsPanelOpen(true);
    startJob(currentFile.name, currentFmt, currentFile, config, (id, abortRef, onProgress, onDone, onError) => {
      runVideoJob(currentFile, config, id, abortRef, onProgress, onDone, onError);
    });
  };

  const handleImageSubmit = () => {
    if (!imageFile) return setError("Lütfen bir resim seçin.");
    if (tooBig(imageFile)) return setError(`Dosya ${MAX_MB} MB'tan büyük olamaz.`);
    setError("");

    const currentFile = imageFile;
    const currentFmt = imgFormat;
    const currentScale = scale;
    const currentSharpen = sharpen;
    const currentExif = exifClean;

    setImageFile(null);
    const fileInput = document.getElementById("image-file");
    if (fileInput) fileInput.value = "";

    const config = { type: "image", format: currentFmt, scale: currentScale, sharpen: currentSharpen, exifClean: currentExif };

    setIsPanelOpen(true);
    startJob(currentFile.name, currentFmt, currentFile, config, (id, abortRef, onProgress, onDone, onError) => {
      runImageJob(currentFile, config, id, abortRef, onProgress, onDone, onError);
    });
  };

  const handleDocSubmit = () => {
    if (!docFile) return setError("Lütfen bir Word veya PDF belgesi seçin.");
    if (tooBig(docFile)) return setError(`Dosya ${MAX_MB} MB'tan büyük olamaz.`);
    setError("");

    const currentFile = docFile;
    const currentFmt = docFormat;

    setDocFile(null);
    const fileInput = document.getElementById("doc-file");
    if (fileInput) fileInput.value = "";

    const config = { type: "document", format: currentFmt };

    setIsPanelOpen(true);
    startJob(currentFile.name, currentFmt, currentFile, config, (id, abortRef, onProgress, onDone, onError) => {
      runDocumentJob(currentFile, config, id, abortRef, onProgress, onDone, onError);
    });
  };

  const tabClass = (name) =>
    `flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition disabled:cursor-not-allowed ${ui.focus} ${
      activeTab === name
        ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white"
        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
    }`;

  const hasRunningJobs = jobs.some((j) => j.status === "running");

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative min-h-screen bg-zinc-100 text-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-200 flex flex-col items-center py-12 px-4 font-sans transition-colors overflow-x-hidden"
    >
      {/* SOL VE SAĞ ALT GRADYANLAR */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [-80, 100, -80],
            y: [30, -40, 30],
            scale: [1, 1.35, 1],
          }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 -left-24 w-[32rem] h-[32rem] bg-gradient-to-tr from-emerald-500/30 via-teal-400/20 to-transparent rounded-full blur-3xl opacity-80"
        />
        <motion.div
          animate={{
            x: [80, -100, 80],
            y: [-30, 40, -30],
            scale: [1.25, 0.9, 1.25],
          }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-28 -right-28 w-[36rem] h-[36rem] bg-gradient-to-tl from-indigo-500/25 via-emerald-400/20 to-transparent rounded-full blur-3xl opacity-80"
        />
      </div>

      {/* CANVAS FARE İZİ */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0"
      />

      {/* SÜRÜKLE BIRAK OVERLAY */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="p-10 rounded-3xl border border-emerald-400 bg-white/90 dark:bg-zinc-900/90 shadow-2xl flex flex-col items-center gap-2 text-center"
            >
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Dosyaları Bırakın</h3>
              <p className="text-xs text-zinc-500">Video, resim veya belgeleriniz otomatik eklenecektir</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BİLDİRİM */}
      <AnimatePresence>
        {batchNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 z-50 px-5 py-2.5 rounded-2xl bg-emerald-500 text-black font-bold text-xs shadow-2xl flex items-center gap-2 border border-emerald-400"
          >
            <span>{batchNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ÖNİZLEME MODALI */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setPreviewMedia(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between w-full pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-bold truncate max-w-[80%] text-zinc-800 dark:text-zinc-200">
                  {previewMedia.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-base font-bold p-1 transition"
                >
                  ✕
                </button>
              </div>

              <div className="w-full flex justify-center bg-black/60 rounded-xl overflow-hidden p-3 min-h-[250px] items-center">
                {previewMedia.type === "image" ? (
                  <img
                    src={previewMedia.url}
                    alt="Önizleme"
                    className="max-h-[70vh] object-contain rounded-lg shadow-md"
                  />
                ) : previewMedia.format === "pdf" || previewMedia.name.endsWith(".pdf") ? (
                  <iframe
                    src={previewMedia.url}
                    title="PDF Önizleme"
                    className="w-full h-[60vh] rounded-lg"
                  />
                ) : previewMedia.format === "mp3" || previewMedia.name.endsWith(".mp3") ? (
                  <div className="w-full py-8 flex flex-col items-center justify-center gap-4">
                    <audio src={previewMedia.url} controls autoPlay className="w-full max-w-md" />
                  </div>
                ) : (
                  <video
                    src={previewMedia.url}
                    controls
                    autoPlay
                    className="w-full max-h-[70vh] rounded-lg shadow-md"
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition"
                >
                  Kapat
                </button>
                <a
                  href={previewMedia.url}
                  download
                  className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition shadow-md"
                >
                  İndir
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* İLK GİRİŞ MODALİ */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-white p-1.5 shadow-md flex items-center justify-center border border-zinc-200/80 mb-3">
                <img
                  src="/logo.png"
                  alt="FormatYap logo"
                  className="w-full h-full object-contain"
                />
              </div>

              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
                FormatYap'a Hoş Geldin
              </h2>
              <p className="text-xs text-zinc-500 mb-6 text-center">
                Hızlı ve profesyonel medya dönüştürme platformu
              </p>

              <div className="flex w-full bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAuthTab("login")}
                  className={`flex-1 py-1.5 rounded-md transition ${
                    authTab === "login"
                      ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  Giriş Yap
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab("signup")}
                  className={`flex-1 py-1.5 rounded-md transition ${
                    authTab === "signup"
                      ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  Hesap Oluştur
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowAuthModal(false);
                  try { localStorage.setItem("minimedia_skip_auth", "true"); } catch {}
                }}
                className="w-full space-y-3.5"
              >
                <div>
                  <label className={ui.label}>E-Posta</label>
                  <input
                    type="email"
                    required
                    placeholder="eposta@ornek.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className={ui.label}>Şifre</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className={`${ui.primary} ${ui.focus} mt-2`}
                >
                  {authTab === "login" ? "Giriş Yap" : "Hesap Oluştur"}
                </motion.button>
              </form>

              <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 w-full text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    try { localStorage.setItem("minimedia_skip_auth", "true"); } catch {}
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition underline decoration-dotted"
                >
                  Hesap oluşturmadan ilerle →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AYARLAR BUTONU */}
      <div className="fixed top-4 left-4 z-30">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Ayarlar & Presetler"
          className={`p-2 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center justify-center ${ui.focus}`}
        >
          <svg className="w-4 h-4 text-zinc-800 dark:text-zinc-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </motion.button>
      </div>

      {/* AYARLAR PANELİ */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-80 sm:w-96 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 z-40 p-5 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-base font-bold">Ayarlar & Hazır Presetler</span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Mevcut Ayarlarını Kaydet
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Şu anki tercihlerinizi profilinize kaydedin.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Preset İsmi"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={saveCurrentAsPreset}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition"
                  >
                    Kaydet
                  </motion.button>
                </div>
              </div>

              <div>
                <span className={ui.label}>Kayıtlı Presetleriniz</span>
                <div className="mt-2 space-y-2">
                  {presets.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-3 text-center">Henüz kayıtlı preset bulunmuyor.</p>
                  ) : (
                    presets.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between"
                      >
                        <div className="flex flex-col overflow-hidden pr-2">
                          <span className="text-xs font-semibold truncate text-zinc-800 dark:text-zinc-200">
                            {p.name}
                          </span>
                          <span className="text-[10px] text-zinc-400 uppercase font-medium">
                            {p.type} • .{p.format} {p.res ? `• ${p.res}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="text-[11px] bg-zinc-900 hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold px-2.5 py-1 rounded-md transition"
                          >
                            Uygula
                          </motion.button>
                          <button
                            type="button"
                            onClick={() => removePreset(p.id)}
                            className="text-[11px] text-red-500 hover:text-red-700 p-1"
                            title="Sil"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* İŞLER VE TEMA BUTONU */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="relative p-[1.5px] rounded-full overflow-hidden shadow-sm transition-all flex items-center justify-center"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-[150%] bg-[conic-gradient(from_0deg,#10b981,#06b6d4,#f59e0b,#ef4444,#10b981)]"
          />
          <div className="relative flex items-center gap-2 rounded-full bg-white dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
            <span>İşler</span>
            {jobs.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow tabular-nums">
                {jobs.length}
              </span>
            )}
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Tema Değiştir"
          className={`p-2 rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center justify-center ${ui.focus}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              {theme === "dark" ? (
                <svg className="w-4 h-4 text-zinc-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* SAĞ TARAF İŞLER PANELİ */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-80 sm:w-96 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-200 dark:border-zinc-800 z-40 p-5 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">İşlem Listesi</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 font-semibold tabular-nums">
                  {jobs.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <AnimatePresence>
              {copiedNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 p-2 bg-emerald-500 text-black text-center text-xs font-bold rounded-lg shadow"
                >
                  İndirme bağlantısı kopyalandı!
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {jobs.length === 0 ? (
                <div className="text-center text-xs text-zinc-400 py-10">
                  Henüz işlenmiş bir dosya yok.
                </div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className="relative p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-semibold truncate dark:text-zinc-200" title={job.fileName}>
                          {job.fileName}
                        </span>
                        <span className="text-[10px] text-zinc-400 uppercase font-medium">
                          .{job.format}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {job.status === "running" && (
                          <button
                            type="button"
                            onClick={() => cancelJob(job)}
                            className="text-[11px] text-red-500 hover:text-red-600 font-semibold px-2 py-1 rounded bg-red-500/10 transition"
                          >
                            İptal
                          </button>
                        )}
                        {job.status === "done" && (
                          <div className="flex items-center gap-1">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="button"
                              onClick={() => setPreviewMedia({ url: job.downloadUrl, name: job.fileName, type: job.config?.type || "video", format: job.format })}
                              className="text-[11px] bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold px-2.5 py-1 rounded transition"
                            >
                              Önizle
                            </motion.button>
                            <motion.a
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              href={job.downloadUrl}
                              download
                              className="text-[11px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-2.5 py-1 rounded transition shadow-sm"
                            >
                              İndir
                            </motion.a>
                          </div>
                        )}
                        {job.status === "cancelled" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-400 font-medium">İptal Edildi</span>
                            <button
                              type="button"
                              onClick={() => restartJob(job)}
                              className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded transition"
                            >
                              Yeniden Başlat
                            </button>
                          </div>
                        )}
                        {job.status === "error" && (
                          <span className="text-[10px] text-red-400 font-medium">Hata</span>
                        )}
                      </div>
                    </div>

                    {job.status === "running" && (
                      <MiniProgressBar phase={job.phase} percent={job.percent} />
                    )}

                    {job.status === "error" && (
                      <p className="text-[10px] text-red-400 mt-1">{job.errorMsg}</p>
                    )}

                    <div className="flex justify-between items-center pt-1 mt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <button
                        type="button"
                        onClick={() => removeJob(job.id)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline"
                      >
                        Temizle
                      </button>

                      <div className="relative job-menu-container">
                        <button
                          type="button"
                          onClick={() => setOpenJobMenuId(openJobMenuId === job.id ? null : job.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </button>

                        <AnimatePresence>
                          {openJobMenuId === job.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 5 }}
                              className="absolute right-0 bottom-6 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 p-1 flex flex-col gap-0.5"
                            >
                              {job.downloadUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(job.downloadUrl);
                                    setCopiedNotice(true);
                                    setTimeout(() => setCopiedNotice(false), 2000);
                                    setOpenJobMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
                                >
                                  Bağlantıyı Kopyala
                                </button>
                              )}
                              
                              {job.config && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    applyPreset(job.config);
                                    setOpenJobMenuId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition"
                                >
                                  Tekrar Ayarla
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {hasRunningJobs && (
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowGame(!showGame)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                >
                  {showGame ? "Oyunu Gizle" : "Yüklenirken Oyun Oyna"}
                </button>
              </div>
            )}

            <AnimatePresence>
              {showGame && hasRunningJobs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  <DinoGame />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ORTA ANA İÇERİK */}
      <div className="relative z-10 w-full flex flex-col items-center">
        
        {/* HEADER & BEYAZ YUVARLAK LOGO */}
        <header className="mb-10 text-center flex flex-col items-center">
          <motion.div
            whileHover={{ scale: 1.04, rotateX: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="relative flex items-center gap-3.5 px-7 py-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-xl backdrop-blur-xl"
          >
            <div className="w-11 h-11 rounded-full bg-white p-1.5 shadow-md flex items-center justify-center shrink-0 border border-zinc-200/80">
              <img 
                src="/logo.png" 
                alt="FormatYap logo" 
                className="w-full h-full object-contain" 
              />
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-800 to-emerald-600 dark:from-white dark:via-zinc-200 dark:to-emerald-400 bg-clip-text text-transparent">
              Format<span className="text-emerald-500 dark:text-emerald-400">Yap</span>
            </h1>
          </motion.div>
        </header>

        {/* 3'LÜ TAB GRUBU */}
        <div role="tablist" className="flex bg-zinc-200 border border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg p-1 mb-8 w-full max-w-xl">
          <button 
            type="button" 
            role="tab" 
            aria-selected={activeTab === "video"} 
            onClick={() => { setActiveTab("video"); setError(""); }} 
            className={tabClass("video")}
          >
            Video Düzenle
          </button>

          <button 
            type="button" 
            role="tab" 
            aria-selected={activeTab === "image"} 
            onClick={() => { setActiveTab("image"); setError(""); }} 
            className={tabClass("image")}
          >
            Fotoğraf Düzenle
          </button>

          <button 
            type="button" 
            role="tab" 
            aria-selected={activeTab === "document"} 
            onClick={() => { setActiveTab("document"); setError(""); }} 
            className={tabClass("document")}
          >
            Belge Düzenle
          </button>
        </div>

        {/* ANA KART */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            onMouseEnter={() => setIsOverCard(true)}
            onMouseLeave={() => setIsOverCard(false)}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-xl bg-white border border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl"
          >
            {activeTab === "video" ? (
              <div className="space-y-6">
                <div>
                  <label htmlFor="video-file" className={ui.label}>Video Yükle</label>
                  
                  {videoFile ? (
                    <div className="mt-2 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {videoPreviewUrl && (
                          <video
                            src={videoPreviewUrl}
                            className="w-16 h-12 object-cover rounded-lg border border-emerald-500/30 bg-black shrink-0 pointer-events-none"
                            preload="metadata"
                            controls={false}
                          />
                        )}
                        <div className="flex flex-col truncate">
                          <span className="font-semibold truncate text-zinc-800 dark:text-zinc-200">
                            {videoFile.name}
                          </span>
                          <span className="text-[10px] text-zinc-500 tabular-nums mt-0.5">
                            {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVideoFile(null)}
                        className="text-zinc-400 hover:text-red-500 p-1.5 font-bold text-sm transition shrink-0 rounded-lg hover:bg-red-500/10"
                        title="Dosyayı Kaldır"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <input
                      id="video-file"
                      type="file"
                      multiple
                      accept="video/*,audio/*"
                      onChange={handleMultipleVideoSelect}
                      className={ui.file}
                    />
                  )}
                </div>

                <div>
                  <span className={ui.label}>Hedef Format</span>
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {VIDEO_FORMATS.map((fmt) => (
                      <motion.button
                        key={fmt}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        aria-pressed={videoFormat === fmt}
                        onClick={() => {
                          setVideoFormat(fmt);
                          if (fmt === "3gp" && !["320x240", "600x300", "640x480"].includes(selectedRes)) {
                            setSelectedRes("");
                          }
                        }}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition ${ui.focus} ${videoFormat === fmt ? ui.pickOn : ui.pickOff}`}
                      >
                        .{fmt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {videoFormat !== "mp3" && (
                  <div>
                    <span className={ui.label}>Boyut Değiştir (isteğe bağlı)</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {RESOLUTION_BOXES
                        .filter((box) => 
                          videoFormat !== "3gp" || ["320x240", "600x300", "640x480"].includes(box.value)
                        )
                        .map((box) => {
                          const on = selectedRes === box.value;
                          return (
                            <motion.button
                              key={box.value}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setSelectedRes(on ? "" : box.value)}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-left transition ${ui.focus} ${
                                on
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
                              }`}
                            >
                              <span className="flex flex-col">
                                <span className="text-xs font-semibold tracking-tight tabular-nums">{box.value}</span>
                                <span className="text-[10px] font-medium text-zinc-500">{box.label}</span>
                              </span>
                              <span
                                aria-hidden="true"
                                className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${on ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-400 dark:border-zinc-700"}`}
                              >
                                {on ? "✓" : ""}
                              </span>
                            </motion.button>
                          );
                        })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
                    <label htmlFor="volume">Ses Düzeyi</label>
                    
                    {isEditingVol ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-emerald-500">%</span>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          autoFocus
                          value={volume}
                          onChange={(e) => setVolume(Math.min(200, Math.max(0, Number(e.target.value))))}
                          onBlur={() => setIsEditingVol(false)}
                          onKeyDown={(e) => e.key === "Enter" && setIsEditingVol(false)}
                          className="w-14 text-right text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded px-1.5 py-0.5 border border-emerald-500 focus:outline-none tabular-nums"
                        />
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => setIsEditingVol(true)}
                        title="Manuel değer yazmak için tıklayın"
                        className="font-semibold text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition px-2.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer tabular-nums"
                      >
                        %{volume}
                      </motion.button>
                    )}
                  </div>
                  
                  <input
                    id="volume"
                    type="range"
                    min="0"
                    max="200"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-zinc-900 dark:accent-white h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setAudioNormalize(!audioNormalize)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors duration-200 ${
                    audioNormalize
                      ? "border-emerald-500/80 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex flex-col pr-2 pointer-events-none">
                    <span className="text-xs font-semibold">Ses Normalizasyonu & Cızırtı Filtresi</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Dip sesleri düşürür ve ses seviyesini dengeler</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out pointer-events-none ${audioNormalize ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${audioNormalize ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </motion.div>

                <motion.button
                  whileHover={!videoFile ? {} : { scale: 1.015 }}
                  whileTap={!videoFile ? {} : { scale: 0.975 }}
                  type="button"
                  disabled={!videoFile}
                  onClick={handleVideoSubmit}
                  className={`${ui.primary} ${ui.focus}`}
                >
                  Dönüştürmeye Başla
                </motion.button>
              </div>
            ) : activeTab === "image" ? (
              <div className="space-y-6">
                <div>
                  <label htmlFor="image-file" className={ui.label}>Fotoğraf Yükle</label>
                  
                  {imageFile && imagePreviewUrl ? (
                    <div className="mt-2 space-y-2">
                      <BeforeAfterSlider
                        originalUrl={imagePreviewUrl}
                        sharpen={sharpen}
                        scale={scale}
                      />
                      <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
                        <span className="truncate max-w-[200px]">{imageFile.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums">{(imageFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                          <button
                            type="button"
                            onClick={() => setImageFile(null)}
                            className="text-zinc-400 hover:text-red-500 font-bold"
                          >
                            Kaldır ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <input
                      id="image-file"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultipleImageSelect}
                      className={ui.file}
                    />
                  )}
                </div>

                <div>
                  <span className={ui.label}>Hedef Format</span>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {IMAGE_FORMATS.map((fmt) => (
                      <motion.button
                        key={fmt}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        aria-pressed={imgFormat === fmt}
                        onClick={() => setImgFormat(fmt)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition ${ui.focus} ${imgFormat === fmt ? ui.pickOn : ui.pickOff}`}
                      >
                        .{fmt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={ui.label}>Ölçek Büyüt (Scale)</span>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {SCALES.map((s) => (
                      <motion.button
                        key={s.val}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        aria-pressed={scale === s.val}
                        onClick={() => setScale(s.val)}
                        className={`py-2 text-xs rounded-lg border transition tabular-nums ${ui.focus} ${
                          scale === s.val
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold"
                            : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-800 dark:hover:border-zinc-700 font-medium"
                        }`}
                      >
                        {s.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSharpen(!sharpen)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors duration-200 ${
                    sharpen
                      ? "border-indigo-500/80 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex flex-col pr-2 pointer-events-none">
                    <span className="text-xs font-semibold">Keskinleştirme ve Kalite Düzeltme</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Görsel netliğini artırır ve detayları belirginleştirir</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out pointer-events-none ${sharpen ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${sharpen ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExifClean(!exifClean)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors duration-200 ${
                    exifClean
                      ? "border-emerald-500/80 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex flex-col pr-2 pointer-events-none">
                    <span className="text-xs font-semibold">EXIF & Gizlilik Temizleyici</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">GPS konumu, çekim saati ve cihaz bilgilerini fotoğraftan kaldırır</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out pointer-events-none ${exifClean ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${exifClean ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </motion.div>

                <motion.button
                  whileHover={!imageFile ? {} : { scale: 1.015 }}
                  whileTap={!imageFile ? {} : { scale: 0.975 }}
                  type="button"
                  disabled={!imageFile}
                  onClick={handleImageSubmit}
                  className={`${ui.primary} ${ui.focus}`}
                >
                  Dönüştürmeye Başla
                </motion.button>
              </div>
            ) : (
              /* BELGE DÜZENLEME SEKMESİ (3. SEKME) */
              <div className="space-y-6">
                <div>
                  <label htmlFor="doc-file" className={ui.label}>Word veya PDF Belgesi Yükle</label>
                  
                  {docFile ? (
                    <div className="mt-2 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between text-xs gap-3">
                      <div className="flex flex-col truncate">
                        <span className="font-semibold truncate text-zinc-800 dark:text-zinc-200">
                          {docFile.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 tabular-nums mt-0.5">
                          {(docFile.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocFile(null)}
                        className="text-zinc-400 hover:text-red-500 p-1.5 font-bold text-sm transition shrink-0 rounded-lg hover:bg-red-500/10"
                        title="Dosyayı Kaldır"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <input
                      id="doc-file"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setDocFile(e.target.files[0]);
                          setError("");
                        }
                      }}
                      className={ui.file}
                    />
                  )}
                </div>

                <div>
                  <span className={ui.label}>Hedef Format</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DOC_FORMATS.map((fmt) => (
                      <motion.button
                        key={fmt}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        aria-pressed={docFormat === fmt}
                        onClick={() => setDocFormat(fmt)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition uppercase ${ui.focus} ${docFormat === fmt ? ui.pickOn : ui.pickOff}`}
                      >
                        .{fmt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileHover={!docFile ? {} : { scale: 1.015 }}
                  whileTap={!docFile ? {} : { scale: 0.975 }}
                  type="button"
                  disabled={!docFile}
                  onClick={handleDocSubmit}
                  className={`${ui.primary} ${ui.focus}`}
                >
                  Belgeyi Dönüştür
                </motion.button>
              </div>
            )}

            {/* Hata Kutusu */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  role="alert"
                  className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}