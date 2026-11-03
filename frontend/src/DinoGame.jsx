import { useEffect, useRef, useState } from "react";

export default function DinoGame() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const gameState = useRef({
    dinoY: 110,
    dinoVelocityY: 0,
    isJumping: false,
    obstacles: [],
    frame: 0,
    currentScore: 0,
    speed: 4,
  });

  const jump = () => {
    if (!gameState.current.isJumping && !gameOver) {
      gameState.current.dinoVelocityY = -11;
      gameState.current.isJumping = true;
    }
    if (gameOver) {
      restart();
    }
  };

  const restart = () => {
    gameState.current = {
      dinoY: 110,
      dinoVelocityY: 0,
      isJumping: false,
      obstacles: [],
      frame: 0,
      currentScore: 0,
      speed: 4,
    };
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationId;

    const loop = () => {
      const state = gameState.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Zemin Çizimi
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 140);
      ctx.lineTo(canvas.width, 140);
      ctx.stroke();

      if (isPlaying && !gameOver) {
        state.frame++;
        state.currentScore = Math.floor(state.frame / 5);
        setScore(state.currentScore);

        // Hızlandırma
        if (state.frame % 300 === 0) state.speed += 0.5;

        // Dinozor Fiziği
        state.dinoY += state.dinoVelocityY;
        state.dinoVelocityY += 0.65; // Yerçekimi

        if (state.dinoY >= 110) {
          state.dinoY = 110;
          state.dinoVelocityY = 0;
          state.isJumping = false;
        }

        // Kaktüs Engel Üretimi
        if (state.frame % Math.floor(1000 / state.speed) === 0 || state.obstacles.length === 0) {
          if (Math.random() > 0.4) {
            state.obstacles.push({
              x: canvas.width,
              width: 14 + Math.random() * 8,
              height: 25 + Math.random() * 10,
            });
          }
        }

        // Engelleri Hareket Ettir & Çiz
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
          const obs = state.obstacles[i];
          obs.x -= state.speed;

          // Kaktüs Vektör Çizimi
          ctx.fillStyle = "#10b981"; // Emerald Kaktüs
          ctx.fillRect(obs.x, 140 - obs.height, obs.width, obs.height);
          // Kaktüs Kolları
          ctx.fillRect(obs.x - 3, 140 - obs.height + 6, 3, 8);
          ctx.fillRect(obs.x + obs.width, 140 - obs.height + 10, 3, 8);

          // Çarpışma Testi (Hitbox)
          const dinoX = 35;
          const dinoW = 22;
          const dinoH = 26;
          const dinoTop = state.dinoY;
          const dinoBottom = state.dinoY + dinoH;

          if (
            dinoX + dinoW > obs.x &&
            dinoX < obs.x + obs.width &&
            dinoBottom > 140 - obs.height
          ) {
            setGameOver(true);
            setHighScore((prev) => Math.max(prev, state.currentScore));
          }

          if (obs.x + obs.width < 0) {
            state.obstacles.splice(i, 1);
          }
        }
      }

      // Vektör Dinozor Çizimi
      const dinoX = 35;
      const dinoY = state.dinoY;
      ctx.fillStyle = "#10b981";

      // Dino Gövde & Kafa
      ctx.fillRect(dinoX + 6, dinoY, 14, 12); // Kafa
      ctx.fillRect(dinoX + 16, dinoY + 3, 3, 3); // Göz (Beyaz)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(dinoX + 14, dinoY + 2, 2, 2);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(dinoX, dinoY + 10, 16, 14); // Gövde
      ctx.fillRect(dinoX - 4, dinoY + 12, 5, 5); // Kuyruk

      // Bacaklar (Koşma Animasyonu)
      if (!state.isJumping && isPlaying && !gameOver) {
        if (Math.floor(state.frame / 6) % 2 === 0) {
          ctx.fillRect(dinoX + 2, dinoY + 24, 4, 6);
          ctx.fillRect(dinoX + 10, dinoY + 24, 4, 3);
        } else {
          ctx.fillRect(dinoX + 2, dinoY + 24, 4, 3);
          ctx.fillRect(dinoX + 10, dinoY + 24, 4, 6);
        }
      } else {
        ctx.fillRect(dinoX + 2, dinoY + 24, 4, 6);
        ctx.fillRect(dinoX + 10, dinoY + 24, 4, 6);
      }

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, gameOver]);

  return (
    <div
      onClick={jump}
      className="relative w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 select-none cursor-pointer overflow-hidden flex flex-col items-center"
    >
      {/* Skor Tablosu */}
      <div className="w-full flex justify-between items-center text-[11px] font-mono font-bold text-zinc-400 mb-1">
        <span>SKOR: {score}</span>
        <span className="text-emerald-400">EN YÜKSEK: {highScore}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={320}
        height={150}
        className="w-full h-32 bg-zinc-900 rounded-lg"
      />

      {/* Başlangıç / Yeniden Başlat Ekrani */}
      {(!isPlaying || gameOver) && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-center p-4">
          <span className="text-xs font-bold text-white">
            {gameOver ? "GAME OVER! 🌵" : "T-Rex Zıplama Oyunu 🦖"}
          </span>
          <span className="text-[10px] text-zinc-300 font-medium">
            {gameOver ? "Yeniden başlamak için tıkla veya Space'e bas" : "Zıplamak için tıkla"}
          </span>
          <button
            type="button"
            onClick={restart}
            className="mt-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] rounded transition shadow"
          >
            {gameOver ? "Yeniden Oyna 🔄" : "Oyunu Başlat 🎮"}
          </button>
        </div>
      )}
    </div>
  );
}