import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  Eye,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { FlameMiniGameCanvas } from './FlameMiniGameCanvas.tsx';

export interface AssessmentPreviewQuestion {
  id?: string;
  questionId?: string;
  groupId?: string;
  groupName?: string;
  difficulty?: string;
  content: string;
  points?: number | null;
  timeSeconds?: number | null;
  timeAllowedSeconds?: number | null;
  options?: string[];
  answerType?: 'single' | 'multiple';
  enableWrittenExplanation?: boolean;
  metadata?: any;
  pairs?: { left: string; right: string }[];
  isQuestionDeleted?: boolean;
}

export interface StudentAssessmentPreviewModalProps {
  title: string;
  subtitle?: string;
  questions: AssessmentPreviewQuestion[];
  onClose: () => void;
}

export function StudentAssessmentPreviewModal({
  title,
  subtitle,
  questions,
  onClose,
}: StudentAssessmentPreviewModalProps) {
  // Exclude deleted questions so previews only ever display remaining valid questions
  const activeQuestions = useMemo(
    () => (Array.isArray(questions) ? questions.filter((q) => !q.isQuestionDeleted) : []),
    [questions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  // Store temporary preview answers in purely local component state
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, any>>({});
  const [previewExplanations, setPreviewExplanations] = useState<Record<number, string>>({});
  const [currentSelectedAnswer, setCurrentSelectedAnswer] = useState<any | null>(null);
  const [currentWrittenExplanation, setCurrentWrittenExplanation] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);

  const currentSelectedAnswerRef = useRef<any | null>(null);
  const currentWrittenExplanationRef = useRef<string>('');

  // Per-question timer state (simulated locally)
  const currentQ = activeQuestions[currentIndex];
  const initialTime =
    currentQ?.timeAllowedSeconds != null && currentQ.timeAllowedSeconds > 0
      ? currentQ.timeAllowedSeconds
      : currentQ?.timeSeconds != null && currentQ.timeSeconds > 0
      ? currentQ.timeSeconds
      : 0;

  const [timeRemaining, setTimeRemaining] = useState<number>(initialTime);
  const timerIntervalRef = useRef<any>(null);

  // Sync refs and update inputs when currentIndex changes
  useEffect(() => {
    if (!currentQ) return;
    const existingAns =
      previewAnswers[currentIndex] !== undefined
        ? previewAnswers[currentIndex]
        : currentQ.answerType === 'multiple'
        ? []
        : null;
    const existingExp = previewExplanations[currentIndex] || '';

    setCurrentSelectedAnswer(existingAns);
    currentSelectedAnswerRef.current = existingAns;
    setCurrentWrittenExplanation(existingExp);
    currentWrittenExplanationRef.current = existingExp;

    const qTime =
      currentQ.timeAllowedSeconds != null && currentQ.timeAllowedSeconds > 0
        ? currentQ.timeAllowedSeconds
        : currentQ.timeSeconds != null && currentQ.timeSeconds > 0
        ? currentQ.timeSeconds
        : 0;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (qTime > 0) {
      setTimeRemaining(qTime);
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            // Auto-advance to next question when timer expires
            setTimeout(() => {
              handleAdvance(true);
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeRemaining(0);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentIndex, activeQuestions]);

  const handleAdvance = (_autoAdvanced = false) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const currentAnswer = currentSelectedAnswerRef.current;
    const currentExplanation = currentWrittenExplanationRef.current;

    setPreviewAnswers((prev) => ({
      ...prev,
      [currentIndex]: currentAnswer,
    }));
    setPreviewExplanations((prev) => ({
      ...prev,
      [currentIndex]: currentExplanation,
    }));

    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Save current question's state locally before navigating back
      setPreviewAnswers((prev) => ({
        ...prev,
        [currentIndex]: currentSelectedAnswerRef.current,
      }));
      setPreviewExplanations((prev) => ({
        ...prev,
        [currentIndex]: currentWrittenExplanationRef.current,
      }));
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleResetPreview = () => {
    setPreviewAnswers({});
    setPreviewExplanations({});
    setIsCompleted(false);
    setCurrentIndex(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col my-4 max-h-[94vh] overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Close Button */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white px-4 py-2 text-xs flex items-center justify-end font-mono shrink-0 border-b border-indigo-700/50">
          <button
            type="button"
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeQuestions.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 my-6 shadow-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/60">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No questions available to preview
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No active questions remain for this assessment. Any previously attached questions may have been removed or deleted from the Question Bank.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          ) : isCompleted ? (
            /* Completed Preview Screen */
            <div className="p-8 rounded-3xl bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/80 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/40 text-center shadow-2xl space-y-4 my-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/40 shadow-xl">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Preview Completed!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                You have reached the end of the student preview for <strong>{title}</strong>. In the real student portal, the student's attempt would now be submitted.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-all cursor-pointer border border-slate-700"
                >
                  Restart Preview
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          ) : (
            /* Active Question Screen (Student Experience) */
            <div className="space-y-6">
              {/* Top Game Bar */}
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block truncate">
                    {title} {subtitle ? `· ${subtitle}` : ''}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                    Question {currentIndex + 1} of {activeQuestions.length}
                  </h3>
                </div>

                {/* Per-Question Countdown Timer */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  {initialTime > 0 && (
                    <div
                      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-sm sm:text-base font-bold transition-all ${
                        timeRemaining <= 5
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/40 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span>{timeRemaining}s</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer shrink-0"
                    title="Exit preview"
                  >
                    Exit Preview
                  </button>
                </div>
              </div>

              {/* Flame Puzzle Canvas Mini-Game */}
              <FlameMiniGameCanvas
                content={currentQ.content}
                points={currentQ.points}
                timeRemaining={timeRemaining > 0 ? timeRemaining : undefined}
                options={currentQ.options || []}
                answerType={currentQ.answerType || 'single'}
                pairs={currentQ.metadata?.pairs || currentQ.pairs || []}
                onAnswerSubmit={(ans) => {
                  currentSelectedAnswerRef.current = ans;
                  setCurrentSelectedAnswer(ans);
                }}
                selectedAnswer={currentSelectedAnswer}
                disabled={false}
              />

              {/* Written Explanation (Optional) - Shown only when enabled */}
              {Boolean(currentQ.enableWrittenExplanation) && (
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Your Explanation (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={currentWrittenExplanation}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentWrittenExplanation(val);
                      currentWrittenExplanationRef.current = val;
                    }}
                    placeholder="Write your reason here..."
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all resize-y min-h-[80px]"
                  />
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {currentIndex > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Previous Question</span>
                    </button>
                  )}
                  <span className="text-xs text-slate-500 font-mono">
                    Question {currentIndex + 1} of {activeQuestions.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdvance(false)}
                  className="next-question-btn w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer shrink-0"
                  style={{
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                  }}
                >
                  <span
                    className="next-question-btn-text text-white"
                    style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                  >
                    {currentIndex < activeQuestions.length - 1 ? 'Next Question' : 'Finish Preview'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white" style={{ color: '#ffffff' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
