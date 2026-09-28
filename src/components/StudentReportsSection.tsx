import React, { useState, useEffect, useRef } from 'react';
import {
  FileBarChart,
  Search,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Building2,
  GraduationCap,
  Layers,
  User,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';

interface StudentReportsSectionProps {
  token: string;
  schools: any[];
}

export function StudentReportsSection({ token, schools }: StudentReportsSectionProps) {
  // Alphabetically sorted schools (A -> Z, case-insensitive)
  const sortedSchools = [...schools].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  );

  // 1. School (Single-Select)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => (sortedSchools.length > 0 ? sortedSchools[0].id : ''));

  // 2. Class (Single-Select)
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(false);

  // 3. Section (Single-Select)
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [isLoadingSections, setIsLoadingSections] = useState<boolean>(false);

  // 4. Student (Single-Select)
  const [matchingStudents, setMatchingStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState<boolean>(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // Close student dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    if (isStudentDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isStudentDropdownOpen]);

  // Report & Timeline Details
  const [selectedStudentReport, setSelectedStudentReport] = useState<any | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Load classes for a school from actual student records in MongoDB Atlas
  const loadClassesForSchool = async (schId: string) => {
    if (!schId) {
      setAvailableClasses([]);
      return;
    }
    setIsLoadingClasses(true);
    try {
      const res = await fetch(`/api/reports/schools/${schId}/classes`, { headers });
      const data = await res.json();
      setAvailableClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch (e) {
      console.error('Failed to load classes for school', e);
      setAvailableClasses([]);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  // Load sections for school (and optionally class) from actual student records in MongoDB Atlas
  const loadSections = async (schId: string, cls?: string) => {
    if (!schId) {
      setAvailableSections([]);
      return;
    }
    setIsLoadingSections(true);
    try {
      const url = cls && cls.trim()
        ? `/api/reports/schools/${schId}/sections?className=${encodeURIComponent(cls.trim())}`
        : `/api/reports/schools/${schId}/sections`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      setAvailableSections(Array.isArray(data.sections) ? data.sections : []);
    } catch (e) {
      console.error('Failed to load sections for class', e);
      setAvailableSections([]);
    } finally {
      setIsLoadingSections(false);
    }
  };

  // Load students for school (and optionally class, section) from MongoDB Atlas
  const loadStudents = async (schId: string, cls?: string, sec?: string) => {
    if (!schId) {
      setMatchingStudents([]);
      return;
    }
    setIsLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      if (cls && cls.trim()) params.set('className', cls.trim());
      if (sec && sec.trim()) params.set('section', sec.trim());
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/reports/schools/${schId}/students${queryStr}`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const sorted = [...list].sort((a, b) =>
        (a.studentName || '').localeCompare(b.studentName || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      setMatchingStudents(sorted);
    } catch (e) {
      console.error('Failed to load students for section', e);
      setMatchingStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Load individual student performance report & test timeline
  const viewStudentReportDetail = async (studentId: string) => {
    if (!studentId) {
      setSelectedStudentReport(null);
      return;
    }
    setIsLoadingReport(true);
    try {
      const res = await fetch(`/api/reports/students/${studentId}`, { headers });
      const data = await res.json();
      setSelectedStudentReport(data);
    } catch (e) {
      console.error('Failed to fetch student report detail', e);
      setSelectedStudentReport(null);
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Initialize first school on mount: immediately load classes, sections, and students
  useEffect(() => {
    if (sortedSchools.length > 0 && !selectedSchoolId) {
      const initialSchoolId = sortedSchools[0].id;
      setSelectedSchoolId(initialSchoolId);
      loadClassesForSchool(initialSchoolId);
      loadSections(initialSchoolId, '');
      loadStudents(initialSchoolId, '', '');
    } else if (selectedSchoolId) {
      loadClassesForSchool(selectedSchoolId);
      loadSections(selectedSchoolId, selectedClass);
      loadStudents(selectedSchoolId, selectedClass, selectedSection);
    }
  }, [schools]);

  // Handler: Change School -> Immediately enables and loads Class, Section, and Student
  const handleSchoolChange = (newSchoolId: string) => {
    setSelectedSchoolId(newSchoolId);
    setSelectedClass('');
    setSelectedSection('');
    setSelectedStudentId('');
    setSelectedStudentReport(null);
    setStudentSearch('');
    setIsStudentDropdownOpen(false);
    if (newSchoolId) {
      loadClassesForSchool(newSchoolId);
      loadSections(newSchoolId, '');
      loadStudents(newSchoolId, '', '');
    } else {
      setAvailableClasses([]);
      setAvailableSections([]);
      setMatchingStudents([]);
    }
  };

  // Handler: Change Class -> Dynamically updates Section and Student options
  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    setSelectedSection('');
    setSelectedStudentId('');
    setSelectedStudentReport(null);
    setStudentSearch('');
    setIsStudentDropdownOpen(false);
    if (selectedSchoolId) {
      loadSections(selectedSchoolId, newClass);
      loadStudents(selectedSchoolId, newClass, '');
    }
  };

  // Handler: Change Section -> Dynamically updates Student options
  const handleSectionChange = (newSection: string) => {
    setSelectedSection(newSection);
    setSelectedStudentId('');
    setSelectedStudentReport(null);
    setStudentSearch('');
    setIsStudentDropdownOpen(false);
    if (selectedSchoolId) {
      loadStudents(selectedSchoolId, selectedClass, newSection);
    }
  };

  // Handler: Select Student
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (studentId) {
      viewStudentReportDetail(studentId);
    } else {
      setSelectedStudentReport(null);
    }
  };

  // Currently selected student object
  const selectedStudent = matchingStudents.find(
    (s) => s.uniqueStudentId === selectedStudentId || s.id === selectedStudentId
  );

  // In-memory student search across Student Name, Admission Number, App ID / Username (sorted A -> Z)
  const filteredStudents = matchingStudents
    .filter((stu) => {
      if (!studentSearch.trim()) return true;
      const q = studentSearch.trim().toLowerCase();
      return (
        (stu.studentName && stu.studentName.toLowerCase().includes(q)) ||
        (stu.schoolAdmissionNumber && stu.schoolAdmissionNumber.toLowerCase().includes(q)) ||
        (stu.uniqueStudentId && stu.uniqueStudentId.toLowerCase().includes(q)) ||
        (stu.username && stu.username.toLowerCase().includes(q))
      );
    })
    .sort((a, b) =>
      (a.studentName || '').localeCompare(b.studentName || '', undefined, { numeric: true, sensitivity: 'base' })
    );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase text-indigo-400 tracking-wider">Analytics & Evaluation</span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-0.5">Student Reports & Timeline</h2>
        <p className="text-sm text-slate-400">
          Flow: School &rarr; Class &rarr; Section &rarr; Student &rarr; Detailed Question-Level Results & Chronological Test Timeline.
        </p>
      </div>

      {/* 4-Step Single-Select Filter Bar: School -> Class -> Section -> Student */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. School (Single-Select) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              1. School
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-indigo-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={selectedSchoolId}
                onChange={(e) => handleSchoolChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium truncate cursor-pointer"
              >
                {sortedSchools.length === 0 ? (
                  <option value="">No schools available</option>
                ) : (
                  <>
                    <option value="">-- Select School --</option>
                    {sortedSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* 2. Class (Single-Select) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>2. Class</span>
              {isLoadingClasses && <span className="text-[10px] text-indigo-400 font-mono">Loading...</span>}
            </label>
            <div className="relative">
              <GraduationCap className="w-4 h-4 text-indigo-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                disabled={!selectedSchoolId || isLoadingClasses}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 outline-none font-medium truncate cursor-pointer"
              >
                <option value="">
                  {!selectedSchoolId
                    ? 'Select School First'
                    : isLoadingClasses
                    ? 'Loading classes...'
                    : availableClasses.length === 0
                    ? 'No classes found'
                    : '-- Select Class --'}
                </option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Section (Single-Select) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>3. Section</span>
              {isLoadingSections && <span className="text-[10px] text-indigo-400 font-mono">Loading...</span>}
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-indigo-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={selectedSection}
                onChange={(e) => handleSectionChange(e.target.value)}
                disabled={!selectedSchoolId || isLoadingSections}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 outline-none font-medium truncate cursor-pointer"
              >
                <option value="">
                  {!selectedSchoolId
                    ? 'Select School First'
                    : isLoadingSections
                    ? 'Loading sections...'
                    : availableSections.length === 0
                    ? 'No sections found'
                    : selectedClass
                    ? `-- All Sections (${selectedClass}) --`
                    : '-- All Sections --'}
                </option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Student (Single-Select Searchable Dropdown) */}
          <div className="space-y-1.5" ref={studentDropdownRef}>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>4. Student</span>
              {isLoadingStudents && <span className="text-[10px] text-indigo-400 font-mono">Loading...</span>}
            </label>
            <div className="relative">
              {/* Trigger Button */}
              <button
                type="button"
                disabled={!selectedSchoolId || isLoadingStudents}
                onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs text-left flex items-center justify-between transition-all outline-none font-medium ${
                  isStudentDropdownOpen
                    ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                } ${
                  !selectedSchoolId || isLoadingStudents
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <User className="w-4 h-4 text-indigo-400 absolute left-3 top-3 pointer-events-none" />
                <div className="truncate pr-2 w-full">
                  {selectedStudent ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-white font-medium truncate">{selectedStudent.studentName}</span>
                        <span className="text-indigo-300 font-mono text-[11px] shrink-0">
                          ({selectedStudent.uniqueStudentId})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 truncate">
                      {!selectedSchoolId
                        ? 'Select School First'
                        : isLoadingStudents
                        ? 'Loading students...'
                        : matchingStudents.length === 0
                        ? 'No students found'
                        : `-- Select Student (${matchingStudents.length}) --`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  {selectedStudent && (
                    <span
                      role="button"
                      title="Clear student selection"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStudentSelect('');
                        setStudentSearch('');
                      }}
                      className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isStudentDropdownOpen ? 'rotate-180 text-indigo-400' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Searchable Dropdown Menu with Student Search */}
              {isStudentDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden min-w-[280px]">
                  {/* Search bar inside the Student filter */}
                  <div className="p-2 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search name, adm #, or app ID..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {studentSearch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStudentSearch('');
                          }}
                          className="absolute right-2 top-2 text-slate-400 hover:text-white p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                    {filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {studentSearch ? 'No matching students found' : 'No students found for this selection'}
                      </div>
                    ) : (
                      filteredStudents.map((stu) => {
                        const isSelected = selectedStudentId === stu.uniqueStudentId;
                        return (
                          <button
                            key={stu.uniqueStudentId || stu.id}
                            type="button"
                            onClick={() => {
                              handleStudentSelect(stu.uniqueStudentId);
                              setIsStudentDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-950/80 text-white border border-indigo-700/80 font-medium'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="truncate">
                              <div className="font-semibold text-white truncate">{stu.studentName}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                                <span className="text-indigo-400">ID: {stu.uniqueStudentId}</span>
                                {stu.className && (
                                  <span>{stu.className} - {stu.section}</span>
                                )}
                                {stu.schoolAdmissionNumber && (
                                  <span>Adm: {stu.schoolAdmissionNumber}</span>
                                )}
                                {stu.username && stu.username !== stu.uniqueStudentId && (
                                  <span className="text-slate-500">@{stu.username}</span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Student Report & Chronological Timeline */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          {isLoadingReport ? (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse font-mono">
              Loading student performance report...
            </div>
          ) : selectedStudentReport ? (
            <div className="space-y-6">
              {/* Header profile */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedStudentReport.student?.studentName}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedStudentReport.student?.className} ({selectedStudentReport.student?.section}) &bull;{' '}
                    {selectedStudentReport.student?.schoolName}
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-indigo-400 block font-bold">
                    App ID: {selectedStudentReport.student?.uniqueStudentId}
                  </span>
                  <span className="text-slate-500">
                    Adm: {selectedStudentReport.student?.schoolAdmissionNumber || '—'}
                  </span>
                </div>
              </div>

              {/* Timeline section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    Student Test History Timeline ({selectedStudentReport.timeline?.length || 0} attempts)
                  </h4>
                </div>

                {selectedStudentReport.timeline && selectedStudentReport.timeline.length > 0 ? (
                  selectedStudentReport.timeline.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs text-indigo-400 font-mono">{item.date}</span>
                          <h5 className="font-bold text-base text-white">{item.testName}</h5>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <span className="text-slate-400">Status:</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                item.status === 'COMPLETED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 font-mono text-xs">
                            <span className="text-slate-400">Exit Type:</span>
                            <span
                              className={`font-semibold ${
                                item.status === 'COMPLETED'
                                  ? 'text-slate-500'
                                  : item.exitType === 'EXIT'
                                  ? 'text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800 font-bold'
                                  : item.exitType === 'LOGOUT'
                                  ? 'text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800 font-bold'
                                  : 'text-slate-500'
                              }`}
                            >
                              {item.status === 'COMPLETED' ? '—' : (item.exitType || '—')}
                            </span>
                          </div>

                          <span className="font-mono text-base font-bold text-white bg-slate-900 px-2.5 py-0.5 rounded-xl border border-slate-700">
                            {item.scoreOutOf100} / 100
                          </span>
                        </div>
                      </div>

                      {/* Question Level Breakdown: answers, correct/wrong, points, time taken */}
                      <div className="pt-3 border-t border-slate-700/60 space-y-2">
                        <span className="text-xs font-semibold text-slate-400 block">
                          Question-Level Evaluation Breakdown:
                        </span>
                        <div className="space-y-2">
                          {item.questions && item.questions.length > 0 ? (
                            item.questions.map((q: any, qIdx: number) => (
                              <div
                                key={qIdx}
                                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="space-y-1">
                                  <p className="font-medium text-slate-200">{q.content}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-slate-400">
                                    <span>
                                      Student Ans:{' '}
                                      <strong className="text-white">
                                        {typeof q.studentAnswer === 'object' && q.studentAnswer !== null
                                          ? JSON.stringify(q.studentAnswer)
                                          : String(q.studentAnswer || 'None')}
                                      </strong>
                                    </span>
                                    {q.correctAnswer != null && String(q.correctAnswer).trim() !== '' && (
                                      <>
                                        <span>&bull;</span>
                                        <span>
                                          Correct Ans:{' '}
                                          <strong className="text-emerald-400">
                                            {typeof q.correctAnswer === 'object'
                                              ? JSON.stringify(q.correctAnswer)
                                              : String(q.correctAnswer)}
                                          </strong>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 font-mono">
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
                                      Answer Recorded
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No question-level logs recorded.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No assessment attempts recorded for this student yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-24 text-center space-y-2">
              <FileBarChart className="w-12 h-12 text-slate-700 mx-auto" />
              <h4 className="text-base font-semibold text-slate-300">No student selected</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select School &rarr; Class &rarr; Section &rarr; Student above to view their scorecard, question-level breakdown, and test attempt timeline.
              </p>
            </div>
          )}
        </div>
    </div>
  );
}
