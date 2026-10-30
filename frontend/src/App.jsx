import React, { useState } from 'react';

const RESOLUTION_BOXES = [
  { label: "Retro / Eski Mobil", value: "320x240" },
  { label: "Banner / Özel", value: "600x300" },
  { label: "Standart SD", value: "640x480" },
  { label: "HD Ready", value: "1280x720" },
  { label: "Full HD (1080p)", value: "1920x1080" },
  { label: "Dikey Hikaye/Reels", value: "1080x1920" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("video"); // 'video' | 'image'
  const [loading, setLoading] = useState(false);
  const [downloadLink, setDownloadLink] = useState(null);

  // Video State
  const [videoFile, setVideoFile] = useState(null);
  const [ytUrl, setYtUrl] = useState("");
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [videoFormat, setVideoFormat] = useState("mp4");
  const [selectedRes, setSelectedRes] = useState("");
  const [volume, setVolume] = useState(100);

  // Image State
  const [imageFile, setImageFile] = useState(null);
  const [imgFormat, setImgFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [sharpen, setSharpen] = useState(false);

  const handleVideoSubmit = async () => {
    setLoading(true);
    setDownloadLink(null);
    const formData = new FormData();

    try {
      let endpoint = "/api/process-video";
      if (isPlaylist) {
        endpoint = "/api/process-playlist";
        formData.append("youtube_url", ytUrl);
      } else {
        if (videoFile) formData.append("file", videoFile);
        if (ytUrl) formData.append("youtube_url", ytUrl);
        formData.append("target_format", videoFormat);
        if (selectedRes) formData.append("resolution", selectedRes);
        formData.append("volume", (volume / 100).toString());
      }

      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "İşlem başarısız");
      setDownloadLink(`http://localhost:8000${data.download_url}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSubmit = async () => {
    if (!imageFile) return alert("Lütfen bir resim seçin.");
    setLoading(true);
    setDownloadLink(null);

    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("target_format", imgFormat);
    formData.append("scale", scale.toString());
    formData.append("sharpen", sharpen.toString());

    try {
      const res = await fetch("http://localhost:8000/api/process-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "İşlem başarısız");
      setDownloadLink(`http://localhost:8000${data.download_url}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-zinc-200 flex flex-col items-center py-12 px-4 font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">minimedia</h1>
        <p className="text-sm text-zinc-500">Minimal medya dönüştürücü, ölçekleyici ve indirici</p>
      </header>

      {/* Menü Tabları */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-8 w-full max-w-xl">
        <button
          onClick={() => { setActiveTab("video"); setDownloadLink(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${activeTab === 'video' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
        >
          🎬 Video & YouTube
        </button>
        <button
          onClick={() => { setActiveTab("image"); setDownloadLink(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${activeTab === 'image' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
        >
          🖼️ Fotoğraf Düzenle
        </button>
      </div>

      <div className="w-full max-w-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur rounded-2xl p-6 shadow-xl">
        {activeTab === "video" ? (
          <div className="space-y-6">
            {/* Dosya veya Link Girişi */}
            <div>
              <label className="text-xs uppercase font-mono tracking-wider text-zinc-400">Dosya Yükle</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files[0])}
                className="mt-2 block w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-xs text-zinc-600 font-mono">VEYA LINK</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {/* YouTube Link */}
            <div>
              <input
                type="text"
                placeholder="YouTube Video veya Playlist Linki..."
                value={ytUrl}
                onChange={(e) => {
                  setYtUrl(e.target.value);
                  if (e.target.value.includes("list=")) setIsPlaylist(true);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
              <label className="flex items-center space-x-2 mt-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPlaylist}
                  onChange={(e) => setIsPlaylist(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0"
                />
                <span>Bu bir Playlist (Tümünü Tek ZIP Olarak İndir)</span>
              </label>
            </div>

            {!isPlaylist && (
              <>
                {/* İstenen Format */}
                <div>
                  <label className="text-xs uppercase font-mono tracking-wider text-zinc-400">Hedef Format</label>
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {["mp4", "3gp", "mkv", "avi", "mp3"].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setVideoFormat(fmt)}
                        className={`py-1.5 text-xs font-mono rounded-lg border transition ${videoFormat === fmt ? 'bg-white text-black font-semibold border-white' : 'border-zinc-800 hover:border-zinc-600'}`}
                      >
                        .{fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KUTULAR ŞEKLİNDE VİDEO BOYUTLARI */}
                <div>
                  <label className="text-xs uppercase font-mono tracking-wider text-zinc-400">Boyut Değiştir (Kutuları Seçin)</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {RESOLUTION_BOXES.map((box) => (
                      <div
                        key={box.value}
                        onClick={() => setSelectedRes(selectedRes === box.value ? "" : box.value)}
                        className={`cursor-pointer p-2.5 rounded-lg border flex items-center justify-between transition ${selectedRes === box.value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold">{box.value}</span>
                          <span className="text-[10px] text-zinc-500">{box.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedRes === box.value}
                          readOnly
                          className="rounded border-zinc-700 bg-zinc-900 pointer-events-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ses Seviyesi */}
                <div>
                  <div className="flex justify-between text-xs font-mono text-zinc-400 mb-2">
                    <span>Ses Düzeyi</span>
                    <span>%{volume}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              </>
            )}

            <button
              disabled={loading}
              onClick={handleVideoSubmit}
              className="w-full bg-white hover:bg-zinc-200 text-black font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? "İşleniyor..." : isPlaylist ? "Playlisti İndir (.ZIP)" : "Videoyu Dönüştür"}
            </button>
          </div>
        ) : (
          /* FOTOĞRAF TABI */
          <div className="space-y-6">
            <div>
              <label className="text-xs uppercase font-mono tracking-wider text-zinc-400">Fotoğraf Yükle</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="mt-2 block w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-mono tracking-wider text-zinc-400">Hedef Format</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {["png", "jpg", "webp", "bmp"].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setImgFormat(fmt)}
                    className={`py-1.5 text-xs font-mono rounded-lg border transition ${imgFormat === fmt ? 'bg-white text-black font-semibold border-white' : 'border-zinc-800 hover:border-zinc-600'}`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-mono tracking-wider text-zinc-400">Ölçek Büyüt (Scale)</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[
                  { label: "1x (Orijinal)", val: 1 },
                  { label: "1.5x", val: 1.5 },
                  { label: "2x (Büyük)", val: 2 },
                  { label: "4x (Ultra)", val: 4 },
                ].map((s) => (
                  <button
                    key={s.val}
                    onClick={() => setScale(s.val)}
                    className={`py-2 text-xs rounded-lg border transition ${scale === s.val ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-zinc-800 hover:border-zinc-700'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sharpen}
                onChange={(e) => setSharpen(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-700"
              />
              <span>Keskinleştirme ve Kalite Düzeltme Uygula</span>
            </label>

            <button
              disabled={loading}
              onClick={handleImageSubmit}
              className="w-full bg-white hover:bg-zinc-200 text-black font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? "İşleniyor..." : "Fotoğrafı İşle ve Kaydet"}
            </button>
          </div>
        )}

        {/* Sonuç & İndirme Kutusu */}
        {downloadLink && (
          <div className="mt-6 p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-400 font-medium">İşlem Tamamlandı</span>
              <span className="text-[10px] text-zinc-500">Dosyanız 1 saat sonra sunucudan otomatik silinecektir.</span>
            </div>
            <a
              href={downloadLink}
              download
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-lg transition"
            >
              İndir
            </a>
          </div>
        )}
      </div>
    </div>
  );
}