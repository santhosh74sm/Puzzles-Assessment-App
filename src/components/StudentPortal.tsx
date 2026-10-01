import { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  Sparkles,
  Trophy,
  History,
  Calendar,
  Lock,
} from 'lucide-react';
import { FlameMiniGameCanvas } from './FlameMiniGameCanvas.tsx';
import { ProfileMenu } from './ProfileMenu.tsx';
import confetti from 'canvas-confetti';

interface StudentPortalProps {
  token: string;
  user: any;
  onLogout: () => void;
}

export function StudentPortal({ token, user, onLogout }: StudentPortalProps) {
  const [assignedTests, setAssignedTests] = useState<any[]>([]);
  const [activeTest, setActiveTest] = useState<any | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<string, { answer: any; timeTaken: number }>>({});
  const [currentSelectedAnswer, setCurrentSelectedAnswer] = useState<any | null>(null);

  // Per-question timer
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const questionStartTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);

  const [testResult, setTestResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const loadStudentTests = async () => {
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const clientDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const res = await fetch('/api/student/tests', {
        headers: {
          ...headers,
          'x-client-now': clientDateTime,
          'x-timezone-offset': String(now.getTimezoneOffset()),
        },
      });
      const data = await res.json();
      setAssignedTests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadStudentTests();
  }, []);

  // Timer runner for current question
  useEffect(() => {
    if (!activeTest) return;

    const currentQ = activeTest.questions[currentQuestionIndex];
    if (!currentQ) return;

    questionStartTimeRef.current = Date.now();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Only run timer if timeAllowedSeconds is explicitly configured (> 0)
    if (currentQ.timeAllowedSeconds != null && currentQ.timeAllowedSeconds > 0) {
      setTimeRemaining(currentQ.timeAllowedSeconds);
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer expired! Automatic move to next question.
            handleAutoAdvanceOnTimerExpire();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeRemaining(0);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeTest, currentQuestionIndex]);

  // Start Test Attempt (Consumed immediately on start)
  const handleStartTest = async (assignmentId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/student/tests/${assignmentId}/start`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to start test. Please try again.');
      }

      const testData = {
        ...data,
        assignmentId: data.assignmentId || data._id || data.id || assignmentId,
      };

      // Restore previously saved answers if any (for IN_PROGRESS resumption)
      const initialAnswers: Record<string, { answer: any; timeTaken: number }> = {};
      let firstUnansweredIdx = 0;
      if (Array.isArray(testData.questions)) {
        testData.questions.forEach((q: any, idx: number) => {
          if (q.studentAnswer !== undefined && q.studentAnswer !== null) {
            initialAnswers[q.questionId] = {
              answer: q.studentAnswer,
              timeTaken: q.timeTakenSeconds || 0,
            };
            if (firstUnansweredIdx === idx) {
              firstUnansweredIdx = idx + 1;
            }
          }
        });
      }
      const startIndex = Math.min(firstUnansweredIdx, Math.max(0, (testData.questions?.length || 1) - 1));

      setActiveTest(testData);
      setCurrentQuestionIndex(startIndex);
      setAnswersMap(initialAnswers);
      setCurrentSelectedAnswer(initialAnswers[testData.questions?.[startIndex]?.questionId]?.answer ?? null);
      setTestResult(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Exit / Abandon Test -> Transitions to INCOMPLETE with Exit Type: EXIT
  const executeAbandonTest = async () => {
    if (!activeTest) return;
    const testId = activeTest.assignmentId || activeTest.id;
    setShowExitConfirmModal(false);
    try {
      await fetch(`/api/student/tests/${testId}/exit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ exitType: 'EXIT', reason: 'Student explicitly exited assessment' }),
      });
      setActiveTest(null);
      loadStudentTests();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAbandonTest = () => {
    setShowExitConfirmModal(true);
  };

  const performLogout = async () => {
    try {
      if (activeTest) {
        const testId = activeTest.assignmentId || activeTest.id;
        await fetch(`/api/student/tests/${testId}/exit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ exitType: 'LOGOUT', reason: 'Student logged out during active assessment' }),
        }).catch(console.error);
      }
      await fetch('/api/student/logout', {
        method: 'POST',
        headers,
      }).catch(console.error);
    } finally {
      onLogout();
    }
  };

  // Save current answer and advance
  const recordAndAdvance = (answer: any) => {
    if (!activeTest || isSubmitting) return;
    const currentQ = activeTest.questions[currentQuestionIndex];
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    const timeSpent = (currentQ.timeAllowedSeconds != null && currentQ.timeAllowedSeconds > 0)
      ? Math.min(currentQ.timeAllowedSeconds, elapsedSeconds)
      : elapsedSeconds;

    const answerToRecord = answer !== undefined ? answer : currentSelectedAnswer;
    const updatedAnswers: Record<string, { answer: any; timeTaken: number }> = {
      ...answersMap,
      [currentQ.questionId]: {
        answer: answerToRecord,
        timeTaken: timeSpent || 1,
      },
    };
    setAnswersMap(updatedAnswers);

    const testId = activeTest.assignmentId || activeTest._id || activeTest.id;
    const isFinalQuestion = currentQuestionIndex >= activeTest.questions.length - 1;

    // Save intermediate answer to backend ONLY if not the final question.
    // The final question submit payload sends all answers in one atomic request,
    // avoiding redundant parallel requests and document version race conditions.
    if (!isFinalQuestion) {
      fetch(`/api/student/tests/${testId}/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          questionId: currentQ.questionId,
          answer: answerToRecord,
          timeTakenSeconds: timeSpent || 1,
        }),
      }).catch(console.error);

      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      const nextQ = activeTest.questions[nextIndex];
      setCurrentSelectedAnswer(updatedAnswers[nextQ?.questionId]?.answer ?? null);
    } else {
      // Last question completed -> submit test
      submitFullTest(updatedAnswers);
    }
  };

  const handleAutoAdvanceOnTimerExpire = () => {
    recordAndAdvance(currentSelectedAnswer);
  };

  const submitFullTest = async (finalAnswers: Record<string, { answer: any; timeTaken: number }>) => {
    if (!activeTest || isSubmitting) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsSubmitting(true);
    setErrorMsg(null);

    const testId = activeTest.assignmentId || activeTest._id || activeTest.id;
    const answersPayload = (activeTest.questions || []).map((q: any) => {
      const entry = finalAnswers[q.questionId];
      return {
        questionId: q.questionId,
        answer: entry?.answer !== undefined ? entry.answer : (q.studentAnswer ?? null),
        timeTakenSeconds: Math.max(0, Number(entry?.timeTaken ?? q.timeTakenSeconds) || 0),
      };
    });

    try {
      const res = await fetch(`/api/student/tests/${testId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers: answersPayload }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
        setActiveTest(null);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        loadStudentTests();
      } else {
        const errorDetail = data.error || 'Unable to submit test. Please try again.';
        setErrorMsg(errorDetail);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Unable to submit test. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = activeTest?.questions?.[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 font-bold">
            P
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 dark:text-white">{user.studentName || user.username}</h1>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
              {user.className} ({user.section}) &bull; {user.schoolName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400 block">Student ID: {user.uniqueStudentId}</span>
          </div>
          <ProfileMenu 
            user={user} 
            onLogout={performLogout} 
            isAssessmentActive={!!activeTest} 
          />
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/50 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. TEST RESULT SUMMARY BANNER */}
        {testResult && (
          <div className="mb-8 p-8 rounded-3xl bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/80 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/40 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/40 shadow-xl">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Test Completed!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your answers have been submitted to your school.
            </p>

            <div className="max-w-xs mx-auto pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold">Status</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-300 font-mono">
                  Submitted
                </span>
              </div>
            </div>

            <button
              onClick={() => setTestResult(null)}
              className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* 2. ACTIVE TEST ENGINE (FLAME CANVAS + TIMER) */}
        {activeTest && currentQ && (
          <div className="space-y-6">
            {/* Top Game Bar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
              <div>
                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  {activeTest.publishName}
                </span>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Question {currentQuestionIndex + 1} of {activeTest.questions.length}
                </h3>
              </div>

              {/* Per-Question Countdown Timer - Only shown when configured */}
              <div className="flex items-center gap-4">
                {currentQ.timeAllowedSeconds != null && currentQ.timeAllowedSeconds > 0 && (
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-base font-bold transition-all ${
                      timeRemaining <= 5
                        ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/40 animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    <span>{timeRemaining}s</span>
                  </div>
                )}

                {/* Exit / Abandon Button */}
                <button
                  type="button"
                  onClick={handleAbandonTest}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold transition-all cursor-pointer"
                  title="Abandon attempt"
                >
                  Exit Test
                </button>
              </div>
            </div>

            {/* Flame Puzzle Canvas Mini-Game */}
            <FlameMiniGameCanvas
              content={currentQ.content}
              points={currentQ.points}
              timeRemaining={timeRemaining}
              options={currentQ.options}
              pairs={currentQ.metadata?.pairs || currentQ.pairs}
              onAnswerSubmit={(ans) => setCurrentSelectedAnswer(ans)}
              selectedAnswer={currentSelectedAnswer}
              disabled={false}
            />

            {/* Next / Submit Question Button */}
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-500">
                * Your answer will be saved when you move forward.
              </span>

              <button
                type="button"
                onClick={() => recordAndAdvance(currentSelectedAnswer)}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white shadow-xl shadow-indigo-600/30 flex items-center gap-2 text-sm transition-all cursor-pointer next-question-btn"
                style={{
                  backgroundImage: 'linear-gradient(to right, #4f46e5, #7c3aed)',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                }}
              >
                <span
                  className="next-question-btn-text text-white"
                  style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                >
                  {isSubmitting
                    ? 'Submitting Test...'
                    : currentQuestionIndex < activeTest.questions.length - 1
                    ? 'Next Question'
                    : 'Submit Test'}
                </span>
                <ArrowRight className="w-4 h-4 text-white" style={{ color: '#ffffff' }} />
              </button>
            </div>
          </div>
        )}

        {/* 3. ASSIGNED TEST CARDS */}
        {!activeTest && !testResult && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Your Tests</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tests assigned to you by your school. You can take each test once.
              </p>
            </div>

            {assignedTests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assignedTests.map((card) => {
                  const assignmentId = card.assignmentId || card._id || card.id;
                  const isCompleted = card.status === 'COMPLETED';
                  const isIncomplete = card.status === 'INCOMPLETE' || card.status === 'LOCKED_INCOMPLETE';

                  // Compute availability using client local time
                  const now = new Date();
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

                  const hasStart = card.startDate && card.startDate !== 'Today';
                  const startStr = hasStart ? `${card.startDate}T${card.startTime || '00:00'}` : null;
                  const hasEnd = card.endDate && card.endDate !== 'Open';
                  const endStr = hasEnd ? `${card.endDate}T${card.endTime || '23:59'}` : null;

                  const isUpcoming = startStr ? nowStr < startStr : (card.isUpcoming ?? false);
                  const isExpired = endStr ? nowStr > endStr : (card.isExpired ?? false);
                  const canStart = card.status === 'NOT_STARTED' && !isUpcoming && !isExpired;

                  return (
                    <div
                      key={assignmentId}
                      className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80">
                            {card.totalQuestions} Questions
                          </span>
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                              isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : isIncomplete
                                ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : card.isPaused
                                ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                : isExpired
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                            }`}
                          >
                            {isCompleted
                              ? 'Completed'
                              : isIncomplete
                              ? 'Incomplete'
                              : card.isPaused
                              ? 'Paused'
                              : card.status === 'NOT_STARTED' && isExpired
                              ? 'Expired'
                              : card.status === 'NOT_STARTED'
                              ? 'Ready'
                              : card.status}
                          </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-snug">{card.publishName}</h3>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Available: {card.startDate} to {card.endDate}</span>
                        </div>
                      </div>

                      {/* Action status */}
                      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                        {isCompleted && (
                          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Completed. Answers submitted.</span>
                          </div>
                        )}

                        {isIncomplete && (
                          <div className="flex flex-col gap-1 text-xs text-rose-700 dark:text-rose-400 font-semibold">
                            <div className="flex items-center gap-2">
                              <Lock className="w-4 h-4 shrink-0" />
                              <span>Test ended early (Incomplete). Cannot be reopened.</span>
                            </div>
                            {card.exitType && (card.exitType === 'EXIT' || card.exitType === 'LOGOUT') && (
                              <span className="font-mono text-[11px] text-rose-600 dark:text-rose-300/80 ml-6">
                                Exit Type: <strong>{card.exitType}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {!isCompleted && !isIncomplete && card.isPaused && (
                          <div className="w-full py-3 rounded-xl font-bold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm text-center">
                            Temporarily Paused
                          </div>
                        )}

                        {!isCompleted && !isIncomplete && !card.isPaused && card.status === 'NOT_STARTED' && (
                          <button
                            type="button"
                            onClick={() => handleStartTest(assignmentId)}
                            disabled={!canStart}
                            className="w-full py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                          >
                            {isUpcoming
                              ? 'Upcoming Test'
                              : isExpired
                              ? 'Test Has Expired'
                              : 'Start Test'}
                          </button>
                        )}

                        {!isCompleted && !isIncomplete && !card.isPaused && card.status === 'IN_PROGRESS' && (
                          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>Test in progress. You cannot restart once started.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/80 p-8 shadow-xs student-no-tests-empty-card">
                <Sparkles className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-3" />
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">No Tests Assigned</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  You do not have any tests assigned right now. Please check back later.
                </p>
              </div>
            )}
          </div>
        )}

        {/* In-app Exit / Abandon Confirmation Modal */}
        {showExitConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/30">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Exit Test?</h3>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  You can only take this test once. If you exit now, your test will end immediately and be marked as <strong>Incomplete</strong>. You will not be able to restart it.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-semibold text-xs transition-all cursor-pointer"
                >
                  Continue Test
                </button>
                <button
                  type="button"
                  onClick={executeAbandonTest}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  Yes, Exit Test
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
