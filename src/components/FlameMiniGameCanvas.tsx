import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface FlameMiniGameProps {
  content: string;
  points?: number | null;
  timeRemaining?: number;
  options?: string[];
  answerType?: 'single' | 'multiple';
  rankingQuestion?: boolean;
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
  rankingQuestion = false,
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

  // Ranking question state
  const [rankingItems, setRankingItems] = useState<string[]>(() => {
    if (Array.isArray(selectedAnswer) && selectedAnswer.length > 0) {
      const base = selectedAnswer.filter((s) => typeof s === 'string');
      const missing = (options || []).filter((opt) => !base.includes(opt));
      return [...base, ...missing];
    }
    return Array.isArray(options) ? [...options] : [];
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync ranking items when selectedAnswer or options or question changes
  useEffect(() => {
    if (!rankingQuestion) return;
    if (Array.isArray(selectedAnswer) && selectedAnswer.length > 0) {
      const base = selectedAnswer.filter((s) => typeof s === 'string');
      const missing = (options || []).filter((opt) => !base.includes(opt));
      const reconciled = [...base, ...missing];
      setRankingItems(reconciled);
    } else if (Array.isArray(options) && options.length > 0) {
      setRankingItems([...options]);
      if (!selectedAnswer) {
        onAnswerSubmit([...options]);
      }
    } else {
      setRankingItems([]);
    }
  }, [rankingQuestion, selectedAnswer, options]);

  const handleMoveUp = (index: number) => {
    if (disabled || index <= 0) return;
    const newItems = [...rankingItems];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(index - 1, 0, moved);
    setRankingItems(newItems);
    onAnswerSubmit(newItems);
    if (!checkReducedMotion()) {
      confetti({ particleCount: 15, spread: 35, origin: { y: 0.8 } });
    }
  };

  const handleMoveDown = (index: number) => {
    if (disabled || index >= rankingItems.length - 1) return;
    const newItems = [...rankingItems];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(index + 1, 0, moved);
    setRankingItems(newItems);
    onAnswerSubmit(newItems);
    if (!checkReducedMotion()) {
      confetti({ particleCount: 15, spread: 35, origin: { y: 0.8 } });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (disabled) return;
    e.preventDefault();
    const sourceIdxStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIdxStr !== '' ? Number(sourceIdxStr) : draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (sourceIndex === null || sourceIndex === undefined || isNaN(sourceIndex) || sourceIndex === targetIndex) {
      return;
    }

    const newItems = [...rankingItems];
    const [moved] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, moved);
    setRankingItems(newItems);
    onAnswerSubmit(newItems);
    if (!checkReducedMotion()) {
      confetti({ particleCount: 20, spread: 40, origin: { y: 0.8 } });
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
          <span>
            {rankingQuestion
              ? 'Ranking Question'
              : answerType === 'multiple'
              ? 'Multiple Selection'
              : pairs && pairs.length > 0
              ? 'Match Pairs'
              : 'Single Choice'}
          </span>
        </div>
        {points != null && points > 0 ? (
          <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {points} Points
          </span>
        ) : null}
      </div>

      {/* Main Interactive Gameplay Area */}
      <div className="relative z-10 min-h-[220px] flex flex-col justify-center">
        {rankingQuestion ? (
          /* Ranking Question Interface */
          <div className="space-y-5 max-w-2xl mx-auto w-full">
            <div className="text-center py-1">
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 leading-relaxed text-balance">
                {content}
              </h3>
              <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-400 font-medium">
                Arrange the items into your preferred ranking order using drag & drop or the Up/Down buttons:
              </p>
            </div>

            <div
              role="list"
              aria-label="Reorderable ranking items"
              className="space-y-2.5"
            >
              {rankingItems.map((item, idx) => {
                const isDragging = draggedIndex === idx;
                const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                return (
                  <div
                    key={`${item}-${idx}`}
                    role="listitem"
                    draggable={!disabled}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border transition-all select-none ${
                      isDragging
                        ? 'opacity-40 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : isDragOver
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div
                      className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing p-1 -ml-1 shrink-0"
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Rank Position Badge */}
                    <span className="shrink-0 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono font-bold text-xs tabular-nums">
                      Rank {idx + 1}
                    </span>

                    {/* Statement Text */}
                    <span className="flex-1 text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 break-words min-w-0">
                      {item}
                    </span>

                    {/* Up / Down Accessibility Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={disabled || idx === 0}
                        aria-label={`Move "${item}" up to Rank ${idx}`}
                        title={`Move up to Rank ${idx}`}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={disabled || idx === rankingItems.length - 1}
                        aria-label={`Move "${item}" down to Rank ${idx + 2}`}
                        title={`Move down to Rank ${idx + 2}`}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : pairs && pairs.length > 0 ? (
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
