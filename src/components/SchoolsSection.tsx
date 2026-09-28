import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  CheckCircle,
  Key,
  GraduationCap,
  Filter,
  Edit,
  Trash2,
  X,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { StudentReportDetailView } from './StudentReportDetailView.tsx';

interface SchoolsSectionProps {
  token: string;
  schools: any[];
  onRefreshSchools: () => Promise<void>;
}

export function SchoolsSection({ token, schools, onRefreshSchools }: SchoolsSectionProps) {
  // New school form
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [isSubmittingSchool, setIsSubmittingSchool] = useState(false);

  // New student form
  const [studentForm, setStudentForm] = useState({
    schoolId: '',
    studentName: '',
    className: '',
    section: '',
    schoolAdmissionNumber: '',
  });
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  // Results & alerts
  const [createdAdminResult, setCreatedAdminResult] = useState<any | null>(null);
  const [createdStudentResult, setCreatedStudentResult] = useState<any | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected school for student list drilldown
  const [activeSchoolId, setActiveSchoolId] = useState<string>(schools.length > 0 ? schools[0].id : '');
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // Student Edit state
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    studentName: '',
    schoolAdmissionNumber: '',
    className: 'Class 7',
    section: 'A',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Student Delete confirmation state
  const [deletingStudent, setDeletingStudent] = useState<any | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // School Admin Delete confirmation state
  const [deletingAdmin, setDeletingAdmin] = useState<any | null>(null);
  const [isSubmittingDeleteAdmin, setIsSubmittingDeleteAdmin] = useState(false);

  // Student Report detail view state
  const [viewingReportStudent, setViewingReportStudent] = useState<any | null>(null);

  // Alphabetically sorted schools (A -> Z, case-insensitive)
  const sortedSchools = [...schools].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  );

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (sortedSchools.length > 0 && !activeSchoolId) {
      setActiveSchoolId(sortedSchools[0].id);
    }
  }, [schools]);

  // Load students & admins for active school
  const loadSchoolDetails = async (schoolId: string) => {
    if (!schoolId) return;
    setLoadingData(true);
    try {
      const [resStudents, resAdmins] = await Promise.all([
        fetch(`/api/students?schoolId=${schoolId}`, { headers }),
        fetch(`/api/schools/${schoolId}/admins`, { headers }),
      ]);
      const dataStu = await resStudents.json();
      const dataAdm = await resAdmins.json();
      const listStu = Array.isArray(dataStu) ? dataStu : [];
      const sortedStu = [...listStu].sort((a, b) =>
        (a.studentName || '').localeCompare(b.studentName || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      setStudentsList(sortedStu);
      setAdminsList(Array.isArray(dataAdm) ? dataAdm : []);
    } catch (err) {
      console.error('Failed to fetch school details', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeSchoolId) {
      setClassFilter('');
      setSectionFilter('');
      loadSchoolDetails(activeSchoolId);
    }
  }, [activeSchoolId]);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim() || !newSchoolCode.trim()) return;
    setIsSubmittingSchool(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newSchoolName.trim(), code: newSchoolCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewSchoolName('');
        setNewSchoolCode('');
        setFeedbackMessage({ type: 'success', text: `School workspace "${data.name}" created successfully!` });
        await onRefreshSchools();
        setActiveSchoolId(data.id);
        setStudentForm((prev) => ({ ...prev, schoolId: data.id }));
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to create school' });
      }
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: e.message || 'Error creating school' });
    } finally {
      setIsSubmittingSchool(false);
    }
  };

  const handleCreateSchoolAdmin = async (schoolId: string) => {
    try {
      const res = await fetch(`/api/schools/${schoolId}/admins`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedAdminResult(data);
        loadSchoolDetails(schoolId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.schoolId) {
      setFeedbackMessage({ type: 'error', text: 'Please select a school.' });
      return;
    }
    if (!studentForm.className) {
      setFeedbackMessage({ type: 'error', text: 'Please select a class.' });
      return;
    }
    if (!studentForm.section.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Please enter a section.' });
      return;
    }
    setIsSubmittingStudent(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...studentForm,
          section: studentForm.section.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedStudentResult(data);
        const registeredSchoolId = studentForm.schoolId;
        setStudentForm({
          schoolId: '',
          studentName: '',
          className: '',
          section: '',
          schoolAdmissionNumber: '',
        });
        if (registeredSchoolId === activeSchoolId) {
          loadSchoolDetails(activeSchoolId);
        }
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to register student' });
      }
    } catch (e: any) {
      setFeedbackMessage({ type: 'error', text: e.message || 'Error registering student' });
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleStartEdit = (student: any) => {
    setEditingStudent(student);
    setEditForm({
      studentName: student.studentName || '',
      schoolAdmissionNumber: student.schoolAdmissionNumber || '',
      className: student.className || 'Class 7',
      section: (student.section || '').toUpperCase(),
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsSubmittingEdit(true);
    setFeedbackMessage(null);
    try {
      const studentId = editingStudent.id || editingStudent.uniqueStudentId;
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          studentName: editForm.studentName.trim(),
          schoolAdmissionNumber: editForm.schoolAdmissionNumber.trim(),
          className: editForm.className.trim(),
          section: editForm.section.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: `Student "${data.student?.studentName || editForm.studentName}" updated successfully in MongoDB Atlas.` });
        setEditingStudent(null);
        if (activeSchoolId) {
          await loadSchoolDetails(activeSchoolId);
        }
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to update student' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error updating student' });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setIsSubmittingDelete(true);
    setFeedbackMessage(null);
    try {
      const studentId = deletingStudent.id || deletingStudent.uniqueStudentId;
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: data.message || `Student deleted successfully.` });
        setDeletingStudent(null);
        if (activeSchoolId) {
          await loadSchoolDetails(activeSchoolId);
        }
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to delete student' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error deleting student' });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!deletingAdmin || !activeSchoolId) return;
    setIsSubmittingDeleteAdmin(true);
    setFeedbackMessage(null);
    try {
      const adminId = deletingAdmin.id || deletingAdmin.username;
      const res = await fetch(`/api/schools/${activeSchoolId}/admins/${adminId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: data.message || `School Admin deleted successfully from MongoDB Atlas.` });
        setDeletingAdmin(null);
        await loadSchoolDetails(activeSchoolId);
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to delete school admin' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error deleting school admin' });
    } finally {
      setIsSubmittingDeleteAdmin(false);
    }
  };

  // Dynamically load available classes from actual MongoDB Atlas student records
  // Show ONLY the classes that actually have at least one student in the current student data
  const availableRosterClasses = Array.from(
    new Set(
      studentsList
        .map((s) => s.className)
        .filter((cls): cls is string => typeof cls === 'string' && cls.trim().length > 0)
        .map((cls) => cls.trim())
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Dynamically load available sections from the actual sections present in the current school's students
  const availableRosterSections = Array.from(
    new Set(
      (classFilter
        ? studentsList.filter((s) => s.className === classFilter)
        : studentsList
      )
        .map((s) => s.section)
        .filter((sec): sec is string => typeof sec === 'string' && sec.trim().length > 0)
        .map((sec) => sec.trim().toUpperCase())
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  useEffect(() => {
    if (classFilter && availableRosterClasses.length > 0 && !availableRosterClasses.includes(classFilter)) {
      setClassFilter('');
    }
  }, [availableRosterClasses, classFilter]);

  const filteredStudents = studentsList
    .filter((s) => {
      const matchesSearch =
        !studentSearch ||
        s.studentName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.schoolAdmissionNumber?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.uniqueStudentId?.toLowerCase().includes(studentSearch.toLowerCase());
      const matchesClass = !classFilter || s.className === classFilter;
      const matchesSection =
        !sectionFilter ||
        (s.section && s.section.trim().toUpperCase() === sectionFilter.trim().toUpperCase());
      return matchesSearch && matchesClass && matchesSection;
    })
    .sort((a, b) =>
      (a.studentName || '').localeCompare(b.studentName || '', undefined, { numeric: true, sensitivity: 'base' })
    );

  const activeSchool = schools.find((s) => s.id === activeSchoolId);

  // If viewing an individual student's report & timeline
  if (viewingReportStudent) {
    return (
      <StudentReportDetailView
        token={token}
        studentId={viewingReportStudent.id || viewingReportStudent._id || viewingReportStudent.uniqueStudentId}
        student={viewingReportStudent}
        schoolName={activeSchool?.name || viewingReportStudent.schoolName}
        onBack={() => setViewingReportStudent(null)}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase text-indigo-400 tracking-wider">Institution Directory</span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-0.5">Schools & Students</h2>
        <p className="text-sm text-slate-400">
          Manage partner schools, provision School Admin accounts, register students, and view student rosters.
        </p>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-xs underline opacity-80 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Admin Credential Banner */}
      {createdAdminResult && (
        <div className="p-5 rounded-2xl bg-indigo-950/80 border border-indigo-500/60 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-indigo-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              School Admin Credentials Generated
            </span>
            <button
              onClick={() => setCreatedAdminResult(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              &times; Close
            </button>
          </div>
          <p className="text-sm text-slate-300">
            Assigned to: <strong className="text-white">{createdAdminResult.schoolName}</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xs text-slate-400 block font-mono">Username / Admin ID</span>
              <span className="text-sm font-bold text-emerald-400 font-mono select-all">
                {createdAdminResult.username}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xs text-slate-400 block font-mono">Initial Password</span>
              <span className="text-sm font-bold text-amber-400 font-mono select-all">
                {createdAdminResult.initialPassword}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 italic">
            * The school admin must change this password upon first login.
          </p>
        </div>
      )}

      {/* Student Credential Banner */}
      {createdStudentResult && (
        <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Student Successfully Registered
            </span>
            <button
              onClick={() => setCreatedStudentResult(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              &times; Close
            </button>
          </div>
          <div className="text-sm text-slate-200">
            Registered: <strong className="text-white">{createdStudentResult.student?.studentName}</strong> (
            {createdStudentResult.student?.className} - {createdStudentResult.student?.section})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xs text-slate-400 block font-mono">Unique Student App ID</span>
              <span className="text-sm font-bold text-emerald-400 font-mono select-all">
                {createdStudentResult.credentials?.username}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xs text-slate-400 block font-mono">Initial Password</span>
              <span className="text-sm font-bold text-amber-400 font-mono select-all">
                {createdStudentResult.credentials?.initialPassword}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 italic">
            * Initial password equals their App ID. Student will be prompted to reset upon first login.
          </p>
        </div>
      )}

      {/* Top Grid: Create School & Active Schools list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create School Form */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Add School Workspace
          </h3>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                School Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Green Valley Public School"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                School Code (Unique Prefix)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GVPS"
                value={newSchoolCode}
                onChange={(e) => setNewSchoolCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">Used to generate unique Admin & Student IDs.</p>
            </div>
            <button
              type="submit"
              disabled={isSubmittingSchool}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmittingSchool ? 'Creating Workspace...' : '+ Create School Workspace'}
            </button>
          </form>
        </div>

        {/* Active School Workspaces List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Active School Workspaces ({schools.length})</h3>
            <span className="text-xs text-slate-400">Click a school to view its roster below</span>
          </div>

          {sortedSchools.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-1">
              {sortedSchools.map((sch) => {
                const isSelected = activeSchoolId === sch.id;
                return (
                  <div
                    key={sch.id}
                    onClick={() => setActiveSchoolId(sch.id)}
                    className={`p-5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/60 font-mono font-bold">
                          {sch.code}
                        </span>
                        {isSelected ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">
                            Viewing Roster
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Workspace</span>
                        )}
                      </div>
                      <h4 className="font-bold text-base mt-2 text-white">{sch.name}</h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {sch.createdAt ? new Date(sch.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateSchoolAdmin(sch.id);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium transition-all flex items-center gap-1 border border-slate-700/60"
                      >
                        <Key className="w-3 h-3 text-indigo-400" />
                        + Create Admin ID
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center py-12">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-slate-300">No schools added yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Use the form on the left to create your first school workspace.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Student Registration Form */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-400" />
          Register New Student (School Roster)
        </h3>
        <form onSubmit={handleCreateStudent} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Select School
            </label>
            <select
              value={studentForm.schoolId}
              onChange={(e) => setStudentForm({ ...studentForm, schoolId: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">-- Select School --</option>
              {sortedSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Student Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sophia Martinez"
              value={studentForm.studentName}
              onChange={(e) => setStudentForm({ ...studentForm, studentName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              School Admission Number
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ADM-2026-99"
              value={studentForm.schoolAdmissionNumber}
              onChange={(e) =>
                setStudentForm({ ...studentForm, schoolAdmissionNumber: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Class
            </label>
            <select
              value={studentForm.className}
              onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">-- Select Class --</option>
              <option value="Class 1">Class 1</option>
              <option value="Class 2">Class 2</option>
              <option value="Class 3">Class 3</option>
              <option value="Class 4">Class 4</option>
              <option value="Class 5">Class 5</option>
              <option value="Class 6">Class 6</option>
              <option value="Class 7">Class 7</option>
              <option value="Class 8">Class 8</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 11">Class 11</option>
              <option value="Class 12">Class 12</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Section
            </label>
            <input
              type="text"
              required
              placeholder="e.g. A, B, AB"
              value={studentForm.section}
              onChange={(e) =>
                setStudentForm({ ...studentForm, section: e.target.value.toUpperCase() })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex items-end">
            <button
              type="submit"
              disabled={isSubmittingStudent || schools.length === 0}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {isSubmittingStudent ? 'Registering...' : '+ Register Student & Issue ID'}
            </button>
          </div>
        </form>
      </div>

      {/* School Detail View: School Admins & Registered Students */}
      {activeSchool ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{activeSchool.name}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-indigo-950 text-indigo-400 border border-indigo-800">
                  {activeSchool.code}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                School Workspace Roster &bull; {adminsList.length} Admins &bull; {studentsList.length} Students Registered
              </p>
            </div>
            <button
              onClick={() => handleCreateSchoolAdmin(activeSchool.id)}
              className="text-xs px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all flex items-center gap-1.5 w-fit"
            >
              <Key className="w-3.5 h-3.5" />
              + Issue New Admin ID
            </button>
          </div>

          {/* School Admins section */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                School Administrators ({adminsList.length})
              </h4>
              <span className="text-xs text-slate-500">School Admin credentials for this school</span>
            </div>

            {adminsList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {adminsList.map((adm) => (
                  <div key={adm.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs space-y-1.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-300">{adm.username}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">
                          {adm.mustChangePassword ? 'PW Reset Required' : 'Active'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Created: {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-700/50 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setDeletingAdmin(adm)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 text-[11px] font-medium transition-all flex items-center gap-1"
                        title="Delete School Admin"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete Admin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No admin credentials issued yet. Click "+ Issue New Admin ID" above.</p>
            )}
          </div>

          {/* Students Roster Section with Search & Filter */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-base text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                  Student Roster ({filteredStudents.length} of {studentsList.length})
                </h4>
                <p className="text-xs text-slate-400">All registered students in {activeSchool.name}</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search name, App ID, admission..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none w-52"
                  />
                </div>

                <select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    setSectionFilter('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {availableRosterClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>

                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">All Sections</option>
                  {availableRosterSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingData ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading student roster...</div>
            ) : filteredStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Unique App ID</th>
                      <th className="py-2.5 px-3">Admission #</th>
                      <th className="py-2.5 px-3">Class & Sec</th>
                      <th className="py-2.5 px-3">Password Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStudents.map((stu) => (
                      <tr key={stu.id || stu.uniqueStudentId} className="hover:bg-slate-800/40 text-slate-200 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-white">{stu.studentName}</td>
                        <td className="py-2.5 px-3 font-mono text-indigo-400 font-bold">{stu.uniqueStudentId}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{stu.schoolAdmissionNumber}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                            {stu.className} - {stu.section}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              stu.mustChangePassword
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            }`}
                          >
                            {stu.mustChangePassword ? 'Initial PW' : 'Updated'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingReportStudent(stu)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/70 hover:border-indigo-500 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                              title="View Student Report & Timeline"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              <span>View Report</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(stu)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-400 border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer"
                              title="Edit Student"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingStudent(stu)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 transition-all cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-slate-800/30 border border-slate-800 text-center py-8">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h5 className="text-sm font-semibold text-slate-300">No students found</h5>
                <p className="text-xs text-slate-500 mt-1">
                  {studentsList.length === 0
                    ? 'No students registered for this school yet. Use the form above to add students.'
                    : 'No students match the selected filter criteria.'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Edit Student Details</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    App ID: <span className="text-indigo-400 font-bold">{editingStudent.uniqueStudentId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Student Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.studentName}
                  onChange={(e) => setEditForm({ ...editForm, studentName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  School Admission Number
                </label>
                <input
                  type="text"
                  required
                  value={editForm.schoolAdmissionNumber}
                  onChange={(e) => setEditForm({ ...editForm, schoolAdmissionNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  placeholder="e.g. ADM-2026-001"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Class
                  </label>
                  <select
                    value={editForm.className}
                    onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                    <option value="Class 4">Class 4</option>
                    <option value="Class 5">Class 5</option>
                    <option value="Class 6">Class 6</option>
                    <option value="Class 7">Class 7</option>
                    <option value="Class 8">Class 8</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A, B, AB"
                    value={editForm.section}
                    onChange={(e) =>
                      setEditForm({ ...editForm, section: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors shadow-lg shadow-indigo-600/20"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-900/40 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete Student</h3>
                <p className="text-xs text-slate-400">Confirmation required</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to delete this student?
            </p>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-1">
              <div><span className="text-slate-400">Name:</span> <span className="font-semibold text-white">{deletingStudent.studentName}</span></div>
              <div><span className="text-slate-400">App ID:</span> <span className="font-mono text-indigo-400 font-bold">{deletingStudent.uniqueStudentId}</span></div>
              <div><span className="text-slate-400">Class & Section:</span> <span className="text-slate-200">{deletingStudent.className} - {deletingStudent.section}</span></div>
              <div><span className="text-slate-400">Admission #:</span> <span className="font-mono text-slate-300">{deletingStudent.schoolAdmissionNumber}</span></div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                disabled={isSubmittingDelete}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmittingDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors shadow-lg shadow-rose-600/20"
              >
                {isSubmittingDelete ? 'Deleting...' : 'Yes, Delete Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete School Admin Confirmation Modal */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-900/40 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete School Admin</h3>
                <p className="text-xs text-slate-400">Confirmation required</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 font-medium">
              Are you sure you want to delete this School Admin?
            </p>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-1">
              <div>
                <span className="text-slate-400">Admin Username / ID:</span>{' '}
                <span className="font-mono text-indigo-400 font-bold">{deletingAdmin.username}</span>
              </div>
              <div>
                <span className="text-slate-400">School Workspace:</span>{' '}
                <span className="text-slate-200">{activeSchool?.name || deletingAdmin.schoolName}</span>
              </div>
              <div>
                <span className="text-slate-400">Role:</span>{' '}
                <span className="font-mono text-slate-300">school_admin</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              This will permanently revoke access for this admin ID. Students, tests, and school records will remain unaffected.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                disabled={isSubmittingDeleteAdmin}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAdmin}
                disabled={isSubmittingDeleteAdmin}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors shadow-lg shadow-rose-600/20"
              >
                {isSubmittingDeleteAdmin ? 'Deleting...' : 'Yes, Delete School Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
