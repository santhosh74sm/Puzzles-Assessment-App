import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface FlameMiniGameProps {
  content: string;
  points?: number | null;
  timeRemaining?: number;
  options?: string[];
  answerType?: 'single' | 'multiple';
  pairs?: { left: string; right: string }[];
  onAnswerSubmit: (answer: any) => void;
  selectedAnswer: any;
  disabled: boolean;
}

export function FlameMiniGameCanvas({
  content,
  points,
  options = [],
  answerType = 'single',
  pairs = [],
  onAnswerSubmit,
  selectedAnswer,
  disabled,
}: FlameMiniGameProps) {
  let isDark = true;
  try {
    const { effectiveTheme } = useTheme();
    isDark = effectiveTheme === 'dark';
  } catch {
    isDark = typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true;
  }

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

  // Check user preference for reduced motion
  const checkReducedMotion = () => {
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  };

  // Particle animation loop simulation inside Flame canvas
  // When prefers-reduced-motion: reduce is enabled, display only a static, subtle background grid and stop the particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mediaQuery =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let isReduced = mediaQuery ? mediaQuery.matches : false;
    let animationFrameId: number | null = null;
    let particles: { x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }[] = [];

    const drawGrid = () => {
      // Subtle game grid backdrop
      ctx.strokeStyle = document.documentElement.classList.contains('light')
        ? 'rgba(99, 102, 241, 0.04)'
        : 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const step = 40;
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
    };

    const renderStaticGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 24; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: (Math.random() - 0.5) * 0.4,
          opacity: Math.random() * 0.25 + 0.1,
        });
      }
    };

    const renderAnimated = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid();

      // Draw subtle focus particles
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(renderAnimated);
    };

    const updateRenderMode = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      if (isReduced) {
        // When reduced motion is preferred, render static subtle grid and stop particle animation
        renderStaticGrid();
      } else {
        if (particles.length === 0) {
          initParticles();
        }
        renderAnimated();
      }
    };

    updateRenderMode();

    const handleMotionPreferenceChange = (e: MediaQueryListEvent) => {
      isReduced = e.matches;
      updateRenderMode();
    };

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMotionPreferenceChange);
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(handleMotionPreferenceChange);
      }
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleMotionPreferenceChange);
        } else if ((mediaQuery as any).removeListener) {
          (mediaQuery as any).removeListener(handleMotionPreferenceChange);
        }
      }
    };
  }, [isDark]);

  const handlePairClick = (left: string, right: string) => {
    if (disabled) return;
    const updated = { ...matchState, [left]: right };
    setMatchState(updated);
    onAnswerSubmit(updated);
    if (!checkReducedMotion()) {
      confetti({ particleCount: 20, spread: 40, origin: { y: 0.8 } });
    }
  };

  const handleOptionClick = (opt: string) => {
    if (disabled) return;
    onAnswerSubmit(opt);
    if (!checkReducedMotion()) {
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
    }
  };

  const handleMultipleOptionToggle = (opt: string) => {
    if (disabled) return;
    const currentList: string[] = Array.isArray(selectedAnswer)
      ? [...selectedAnswer]
      : typeof selectedAnswer === 'string' && selectedAnswer
      ? [selectedAnswer]
      : [];
    const index = currentList.indexOf(opt);
    let updated: string[];
    if (index > -1) {
      updated = currentList.filter((item) => item !== opt);
    } else {
      updated = [...currentList, opt];
    }
    onAnswerSubmit(updated);
    if (!checkReducedMotion()) {
      confetti({ particleCount: 20, spread: 45, origin: { y: 0.8 } });
    }
  };

  const isMultiple = answerType === 'multiple';
  const selectedList: string[] = Array.isArray(selectedAnswer)
    ? selectedAnswer
    : typeof selectedAnswer === 'string' && selectedAnswer
    ? [selectedAnswer]
    : [];

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-7 text-slate-900 dark:text-white">
      {/* Background Animated Canvas (Subtle focus field) */}
      <canvas
        ref={canvasRef}
        width={800}
        height={320}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
      />

      {/* Header bar inside puzzle arena */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">Assessment Challenge</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>{answerType === 'multiple' ? 'Multiple Selection' : pairs && pairs.length > 0 ? 'Match Pairs' : 'Single Choice'}</span>
        </div>
        {points != null && points > 0 ? (
          <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {points} Points
          </span>
        ) : null}
      </div>

      {/* Main Interactive Gameplay Area */}
      <div className="relative z-10 min-h-[220px] flex flex-col justify-center">
        {/* Match Puzzle if pairs configured */}
        {pairs && pairs.length > 0 ? (
          <div className="space-y-4">
            <div className="text-center py-1">
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 text-balance leading-relaxed">
                {content}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Select an item on the left, then pick its corresponding match on the right:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-6 max-w-xl mx-auto w-full min-w-0">
              <div className="space-y-2.5 min-w-0">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Items</span>
                {pairs.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedLeft(p.left)}
                    disabled={disabled}
                    className={`w-full text-left px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer min-w-0 break-words ${
                      selectedLeft === p.left
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/30'
                        : matchState[p.left]
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-800 dark:text-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-1.5 min-w-0">
                      <span className="min-w-0 break-words flex-1">{p.left}</span>
                      {matchState[p.left] && (
                        <span className="shrink-0 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono font-semibold">Matched</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 min-w-0">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Matches</span>
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
                    className={`w-full text-left px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors min-w-0 break-words ${
                      selectedLeft
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer text-slate-900 dark:text-slate-100'
                        : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span className="min-w-0 break-words block">{p.right}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Currently mapped status */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center mt-3 max-w-full px-1">
              {Object.entries(matchState).map(([k, v]) => (
                <span key={k} className="text-xs px-2 sm:px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono max-w-full break-words min-w-0">
                  <span className="break-words">{k}</span> &rarr; <strong className="text-indigo-600 dark:text-indigo-400 font-semibold break-words">{v}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : (
          /* Multiple Choice or Text Answer */
          <div className="space-y-6">
            <div className="text-center py-1">
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 leading-relaxed text-balance">
                {content}
              </h3>
            </div>

            {options && options.length > 0 ? (
              <div className="space-y-4 max-w-2xl mx-auto">
                {isMultiple && (
                  <div className="flex items-center justify-center">
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                      Select all choices that apply
                    </span>
                  </div>
                )}
                <div
                  role={isMultiple ? 'group' : 'radiogroup'}
                  aria-label={isMultiple ? 'Answer choices - multiple selection' : 'Answer choices - single choice'}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
                >
                  {options.map((opt, idx) => {
                    const isSelected = isMultiple ? selectedList.includes(opt) : selectedAnswer === opt;
                    return (
                      <button
                        key={idx}
                        type="button"
                        role={isMultiple ? 'checkbox' : 'radio'}
                        aria-checked={isSelected}
                        onClick={() => (isMultiple ? handleMultipleOptionToggle(opt) : handleOptionClick(opt))}
                        disabled={disabled}
                        className={`relative flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border text-left font-medium transition-all cursor-pointer shadow-xs min-w-0 ${
                          isSelected
                            ? 'bg-indigo-600 dark:bg-indigo-600 border-indigo-600 text-white selected-answer-option ring-2 ring-indigo-500/20'
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-900 dark:text-slate-100 unselected-answer-option'
                        }`}
                      >
                        {isMultiple && (
                          <div
                            aria-hidden="true"
                            className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 transition-all border ${
                              isSelected
                                ? 'bg-white text-indigo-700 border-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5 text-indigo-700 stroke-[3]" /> : null}
                          </div>
                        )}
                        <span
                          aria-hidden="true"
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 font-mono transition-colors ${
                            isSelected
                              ? 'bg-white text-indigo-700 font-bold shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span
                          className={`text-sm sm:text-base flex-1 min-w-0 break-words ${
                            isSelected
                              ? 'font-bold text-white'
                              : 'font-medium text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={selectedAnswer || ''}
                  onChange={(e) => onAnswerSubmit(e.target.value)}
                  disabled={disabled}
                  className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
