import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Trophy, RotateCcw } from 'lucide-react';

interface FlameMiniGameProps {
  content: string;
  points?: number | null;
  timeRemaining?: number;
  options?: string[];
  pairs?: { left: string; right: string }[];
  onAnswerSubmit: (answer: any) => void;
  selectedAnswer: any;
  disabled: boolean;
}

export function FlameMiniGameCanvas({
  content,
  points,
  timeRemaining,
  options = [],
  pairs = [],
  onAnswerSubmit,
  selectedAnswer,
  disabled,
}: FlameMiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match interaction state
  const [matchState, setMatchState] = useState<Record<string, string>>(
    () => (typeof selectedAnswer === 'object' && selectedAnswer !== null ? selectedAnswer : {})
  );
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  // Number grid mini-game state (for Number/3x3 puzzle)
  const [gridCells, setGridCells] = useState<(string | number | null)[]>([
    2, 7, 6,
    9, selectedAnswer || '?', 1,
    4, 3, 8,
  ]);

  // Particle animation loop simulation inside Flame canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: { x: number; y: number; size: number; speedX: number; speedY: number; color: string }[] = [];

    const colors = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle game grid backdrop
      ctx.strokeStyle = document.documentElement.classList.contains('light')
        ? 'rgba(0, 0, 0, 0.08)'
        : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const step = 30;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw floating particles
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handlePairClick = (left: string, right: string) => {
    if (disabled) return;
    const updated = { ...matchState, [left]: right };
    setMatchState(updated);
    onAnswerSubmit(updated);
    confetti({ particleCount: 20, spread: 40, origin: { y: 0.8 } });
  };

  const handleOptionClick = (opt: string) => {
    if (disabled) return;
    onAnswerSubmit(opt);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
  };

  const handleGridCenterSelect = (val: string) => {
    if (disabled) return;
    const copy = [...gridCells];
    copy[4] = val;
    setGridCells(copy);
    onAnswerSubmit(val);
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-white">
      {/* Background Animated Canvas (Flame visual effect engine) */}
      <canvas
        ref={canvasRef}
        width={800}
        height={320}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
      />

      {/* Header bar inside puzzle arena */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Puzzle
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-slate-400">Puzzle Area</span>
        </div>
      </div>

      {/* Main Interactive Gameplay Area */}
      <div className="relative z-10 min-h-[220px] flex flex-col justify-center">
        {/* Match Puzzle if pairs configured */}
        {pairs && pairs.length > 0 ? (
          <div className="space-y-4">
            <div className="text-center py-1">
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">{content}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Choose an item on the left, then pick its match on the right:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 max-w-xl mx-auto">
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-2">Item</span>
                {pairs.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedLeft(p.left)}
                    disabled={disabled}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      selectedLeft === p.left
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400'
                        : matchState[p.left]
                        ? 'bg-slate-800/90 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{p.left}</span>
                      {matchState[p.left] && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400">Matched</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-2">Match</span>
                {pairs.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (selectedLeft) {
                        handlePairClick(selectedLeft, p.right);
                        setSelectedLeft(null);
                      }
                    }}
                    disabled={disabled || !selectedLeft}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      selectedLeft
                        ? 'bg-slate-800 border-indigo-500/60 hover:bg-indigo-950/40 cursor-pointer animate-pulse'
                        : 'bg-slate-800/40 border-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>{p.right}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Currently mapped status */}
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {Object.entries(matchState).map(([k, v]) => (
                <span key={k} className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {k} &rarr; <strong className="text-indigo-400">{v}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : (
          /* Multiple Choice or Text Answer */
          <div className="space-y-6">
            <div className="text-center py-2">
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-2">{content}</h3>
            </div>

            {options && options.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {options.map((opt, idx) => {
                  const isSelected = selectedAnswer === opt;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOptionClick(opt)}
                      disabled={disabled}
                      className={`relative flex items-center gap-3 p-4 rounded-xl border text-left font-medium transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-400 text-white shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-400'
                          : 'bg-slate-800/70 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-black/30 border border-white/10">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-base">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={selectedAnswer || ''}
                  onChange={(e) => onAnswerSubmit(e.target.value)}
                  disabled={disabled}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
