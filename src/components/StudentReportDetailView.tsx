import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  GraduationCap,
  Building2,
  FileBarChart,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export interface StudentReportDetailViewProps {
  token: string;
  studentId: string;
  student?: any;
  schoolName?: string;
  onBack: () => void;
}

// Helper to format date and time as DD-MM-YYYY | hh:mm A in user's local timezone
function formatStudentAssessmentDateTime(item: any): string {
  const isCompleted = item?.status === 'COMPLETED';
  const rawDate = isCompleted
    ? (item?.completedAt || item?.updatedAt || item?.createdAt)
    : (item?.lockedAt || item?.startedAt || item?.updatedAt || item?.createdAt || item?.date);

  if (!rawDate) return '—';

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    return String(rawDate);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = pad(hours);

  return `${day}-${month}-${year} | ${hoursStr}:${minutes} ${ampm}`;
}

// Helper to format published/created date and time as DD-MM-YYYY • hh:mm A in user's local timezone
function formatPublishedDateTime(rawDateVal?: Date | string | null): string {
  if (!rawDateVal) return '—';
  const d = new Date(rawDateVal);
  if (isNaN(d.getTime())) return String(rawDateVal);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = pad(hours);
  return `${day}-${month}-${year} • ${hoursStr}:${minutes} ${ampm}`;
}

export function StudentReportDetailView({
  token,
  studentId,
  student,
  schoolName,
  onBack,
}: StudentReportDetailViewProps) {
  const [report, setReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchStudentReport = async () => {
    if (!studentId) {
      setLoadError('Student not found.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/reports/students/${encodeURIComponent(studentId)}`, { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Unable to load student report.');
      }
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load student report', err);
      setLoadError(err.message || 'Unable to load student report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentReport();
  }, [studentId]);

  const activeStudent = report?.student || student || {};
  const timeline: any[] = report?.timeline || [];

  return (
    <div className="space-y-6 max-w-7xl animate-in fade-in duration-150">
      {/* Top Navigation Bar with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Back to Students</span>
          </button>

          <span className="text-slate-600 text-xs hidden sm:inline">&bull;</span>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white font-medium">{activeStudent.studentName || 'Student'}</span>
            <span className="font-mono text-indigo-300">({activeStudent.uniqueStudentId || studentId})</span>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStudentReport}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          title="Refresh Report"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Report Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        {isLoading ? (
          <div className="py-24 text-center space-y-3 font-mono">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400 animate-pulse">
              Loading student report...
            </p>
          </div>
        ) : loadError ? (
          <div className="p-6 rounded-xl bg-rose-950/60 border border-rose-800/80 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h4 className="text-sm font-bold text-rose-200">Unable to load student report</h4>
            <p className="text-xs text-rose-300/80 max-w-md mx-auto">{loadError}</p>
            <button
              type="button"
              onClick={fetchStudentReport}
              className="px-4 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Profile Summary */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-800 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    {activeStudent.studentName || 'Student Name'}
                  </h3>
                  {activeStudent.className && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700">
                      {activeStudent.className}
                      {activeStudent.section ? ` - Sec ${activeStudent.section}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{activeStudent.schoolName || schoolName || 'School'}</span>
                </p>
              </div>

              {/* Identity & Reference Codes */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                <div className="px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Student ID</span>
                  <span className="text-indigo-300 font-bold text-sm">
                    {activeStudent.uniqueStudentId || studentId}
                  </span>
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Admission Number</span>
                  <span className="text-slate-200 font-bold text-sm">
                    {activeStudent.schoolAdmissionNumber || '—'}
                  </span>
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans">Tests Taken</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {timeline.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Chronological Test History Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Test History ({timeline.length})</span>
                </h4>
              </div>

              {timeline.length > 0 ? (
                timeline.map((item: any, idx: number) => (
                  <div
                    key={item.assignmentId || idx}
                    className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4 hover:border-slate-700 transition-colors"
                  >
                    {/* Test Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-base text-white leading-snug">
                          {(() => {
                            const num = item.assessmentNumber || idx + 1;
                            const baseTitle = item.assessmentName || item.originalPublishName || item.publishName || item.testName || 'Test';
                            return (/^\d+\./.test(baseTitle) || baseTitle.startsWith('Assessment -')) ? baseTitle : `${num}. ${baseTitle}`;
                          })()}
                        </h5>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <span>{item.publishMode || 'Selected Questions'}</span>
                          <span className="text-slate-600">&bull;</span>
                          <span>{formatPublishedDateTime(item.publishedCreatedAt || item.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {/* Status Badge */}
                        <div className="flex items-center gap-1 font-mono text-xs">
                          <span className="text-slate-400">Status:</span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              item.status === 'COMPLETED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {item.status === 'COMPLETED' ? 'Completed' : 'Incomplete'}
                          </span>
                        </div>

                        {/* Exit Type Badge - Only display for incomplete/locked attempts when an actual EXIT or LOGOUT event occurred */}
                        {(item.status === 'INCOMPLETE' || item.status === 'LOCKED_INCOMPLETE') && (item.exitType === 'EXIT' || item.exitType === 'LOGOUT') && (
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <span className="text-slate-400">Exit Type:</span>
                            <span
                              className={`font-semibold ${
                                item.exitType === 'EXIT'
                                  ? 'text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800 font-bold'
                                  : 'text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800 font-bold'
                              }`}
                            >
                              {item.exitType}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Completion / Submission Date & Time (Directly below header before Question Breakdown) */}
                    {item.status === 'COMPLETED' && (
                      <div className="text-xs text-slate-300 font-mono">
                        <span>Completed: {formatPublishedDateTime(item.completedAt || item.updatedAt || item.createdAt)}</span>
                      </div>
                    )}

                    {/* Question Level Evaluation Breakdown */}
                    <div className="pt-3 border-t border-slate-700/60 space-y-2">
                      <div className="text-xs font-semibold text-slate-400">
                        <span>Question Results:</span>
                      </div>

                      <div className="space-y-2">
                        {item.questions && item.questions.length > 0 ? (
                          item.questions.map((q: any, qIdx: number) => (
                            <div
                              key={qIdx}
                              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700/80 transition-colors"
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                {/* Question Group & Difficulty Level */}
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                                  <span className="text-slate-400">
                                    Group: <strong className="text-indigo-300 font-sans font-semibold">{q.groupName || 'General'}</strong>
                                  </span>
                                  <span className="text-slate-600">&bull;</span>
                                  <span className="text-slate-400 flex items-center gap-1">
                                    Difficulty:
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                        String(q.difficulty || '').toLowerCase() === 'easy'
                                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                          : String(q.difficulty || '').toLowerCase() === 'hard'
                                          ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                                          : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                                      }`}
                                    >
                                      {q.difficulty || 'Medium'}
                                    </span>
                                  </span>
                                </div>

                                <div className="flex items-start gap-2">
                                  <span className="font-mono text-[11px] text-slate-500 font-bold shrink-0 mt-0.5">Q{qIdx + 1} &mdash;</span>
                                  <p className="font-medium text-slate-200 leading-relaxed">{q.content}</p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-slate-400 pl-6 sm:pl-7">
                                  <span>
                                    Student's Answer:{' '}
                                    <strong className="text-white">
                                      {Array.isArray(q.studentAnswer)
                                        ? (q.studentAnswer.length > 0 ? q.studentAnswer.join(', ') : 'None')
                                        : typeof q.studentAnswer === 'object' && q.studentAnswer !== null
                                        ? JSON.stringify(q.studentAnswer)
                                        : String(q.studentAnswer || 'None')}
                                    </strong>
                                  </span>
                                  {q.correctAnswer != null && String(q.correctAnswer).trim() !== '' && (
                                    <>
                                      <span>&bull;</span>
                                      <span>
                                        Correct Answer:{' '}
                                        <strong className="text-emerald-400">
                                          {Array.isArray(q.correctAnswer)
                                            ? q.correctAnswer.join(', ')
                                            : typeof q.correctAnswer === 'object' && q.correctAnswer !== null
                                            ? JSON.stringify(q.correctAnswer)
                                            : String(q.correctAnswer)}
                                        </strong>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 font-mono self-end sm:self-auto">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {q.timeAllowedSeconds != null && q.timeAllowedSeconds > 0
                                    ? `${q.timeTakenSeconds}s / ${q.timeAllowedSeconds}s`
                                    : `${q.timeTakenSeconds}s`}
                                </span>
                                {q.correctAnswer != null && String(q.correctAnswer).trim() !== '' ? (
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      q.isCorrect
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                        : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                    }`}
                                  >
                                    {q.isCorrect
                                      ? `+${q.earnedPoints || (q.points != null ? q.points : 0)} pts`
                                      : '0 pts'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                    Saved
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500 italic p-2">No question details recorded.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 rounded-2xl bg-slate-800/30 border border-slate-800 text-center space-y-2">
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No tests taken yet</p>
                  <p className="text-xs text-slate-500">
                    This student has not taken any tests yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
