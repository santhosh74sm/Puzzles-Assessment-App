import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Shuffle,
  Play,
  HelpCircle,
  Calendar,
  Clock,
  Send,
  Building2,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  AlertTriangle,
  X,
  Users,
  Search,
} from 'lucide-react';
import { FlameMiniGameCanvas } from './FlameMiniGameCanvas.tsx';

const VALID_CLASSES = [
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
] as const;

export interface TargetItem {
  id: string;
  selectedSchoolIds: string[];
  selectedClasses: string[];
  availableClasses: string[];
  isLoadingClasses: boolean;
  selectedSections: string[];
  availableSections: string[];
  isLoadingSections: boolean;
  selectedStudentIds: string[];
  availableStudents: any[];
  isLoadingStudents: boolean;
}

export interface PublishAssessmentFormState {
  publishName: string;
  publishMode: 'Selected Questions' | 'Random Questions';
  targets: TargetItem[];
  selectedQuestionsForPublish: string[];
  shuffleQuestions: boolean;
  randomCount: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export interface PublishAssessmentSectionProps {
  token: string;
  schools: any[];
  allQuestions: any[];
  onPublishSuccess: () => Promise<void>;
  formState?: PublishAssessmentFormState;
  onFormStateChange?: (state: PublishAssessmentFormState) => void;
  onResetFormState?: () => void;
}

// -------------------------------------------------------------
// School Multi-Select Dropdown Component
// -------------------------------------------------------------
function SchoolMultiSelectDropdown({
  schools,
  selectedSchoolIds,
  onChange,
  disabled,
}: {
  schools: any[];
  selectedSchoolIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const isAllSchoolsSelected = selectedSchoolIds.includes('ALL');

  const sortedSchools = [...schools].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  );

  const filteredSchools = sortedSchools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedSchools = sortedSchools.filter((s) => selectedSchoolIds.includes(s.id));

  const toggleSchool = (id: string) => {
    if (isAllSchoolsSelected) {
      // User is clicking a specific school while "All Schools" is active:
      // Deselect "All Schools" and select this specific school
      onChange([id]);
      return;
    }
    if (selectedSchoolIds.includes(id)) {
      onChange(selectedSchoolIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedSchoolIds, id]);
    }
  };

  const toggleAllSchools = () => {
    if (isAllSchoolsSelected) {
      onChange([]);
    } else {
      onChange(['ALL']);
    }
  };

  const handleSelectAll = () => {
    onChange(['ALL']);
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled || schools.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all outline-none text-sm ${
          isOpen
            ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
        } ${disabled || schools.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          {schools.length === 0 ? (
            <span className="text-slate-500">No schools available</span>
          ) : isAllSchoolsSelected ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">All Schools</span>
              <span className="text-xs text-indigo-300 font-mono">
                ({schools.length} Schools)
              </span>
            </div>
          ) : selectedSchoolIds.length === 0 ? (
            <span className="text-slate-400">Select School(s)...</span>
          ) : selectedSchoolIds.length === 1 ? (
            <span className="text-white font-medium truncate">
              {selectedSchools[0]?.name}
              {selectedSchools[0]?.code && (
                <span className="ml-1.5 text-[11px] font-mono text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800">
                  {selectedSchools[0].code}
                </span>
              )}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">
                {selectedSchoolIds.length} Schools Selected
              </span>
              <span className="text-xs text-slate-400 truncate">
                ({selectedSchools.map((s) => s.code || s.name).slice(0, 2).join(', ')}
                {selectedSchoolIds.length > 2 ? ` +${selectedSchoolIds.length - 2}` : ''})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAllSchoolsSelected ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              All
            </span>
          ) : selectedSchoolIds.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              {selectedSchoolIds.length}
            </span>
          ) : null}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Quick Actions & Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">
              Choose Schools ({isAllSchoolsSelected ? `All (${schools.length})` : `${selectedSchoolIds.length}/${schools.length}`})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-600">&bull;</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-400 hover:text-slate-300 font-medium underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Filter if schools > 3 */}
          {schools.length > 3 && (
            <input
              type="text"
              placeholder="Search school name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          )}

          {/* Scrollable School List */}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {/* "All Schools" option */}
            {(!search || 'all schools'.includes(search.toLowerCase())) && (
              <div
                onClick={toggleAllSchools}
                className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                  isAllSchoolsSelected
                    ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                    : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <input
                    type="checkbox"
                    checked={isAllSchoolsSelected}
                    readOnly
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                  />
                  <span className="font-semibold text-white">All Schools</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0 ml-2">
                  {schools.length} Schools
                </span>
              </div>
            )}

            {filteredSchools.length === 0 && search ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching schools found
              </div>
            ) : (
              filteredSchools.map((s) => {
                const isSelected = !isAllSchoolsSelected && selectedSchoolIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSchool(s.id)}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                        : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                      />
                      <span className="truncate">{s.name}</span>
                    </div>
                    {s.code && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 shrink-0 ml-2">
                        {s.code}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Done Button */}
          <div className="pt-1.5 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Class Multi-Select Dropdown Component
// -------------------------------------------------------------
function ClassMultiSelectDropdown({
  availableClasses = [],
  selectedClasses,
  onChange,
  disabled,
  isLoading,
}: {
  availableClasses?: string[];
  selectedClasses: string[];
  onChange: (classes: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const isAllClassesSelected =
    selectedClasses.length === 0 ||
    selectedClasses.includes('ALL') ||
    selectedClasses.includes('All Classes') ||
    (availableClasses.length > 0 && selectedClasses.length === availableClasses.length);

  const toggleClass = (cls: string) => {
    if (isAllClassesSelected) {
      // User is clicking a specific class while "All Classes" is active:
      // Deselect "All Classes" and select this specific class
      onChange([cls]);
      return;
    }
    if (selectedClasses.includes(cls)) {
      const next = selectedClasses.filter((c) => c !== cls);
      onChange(next);
    } else {
      const next = [...selectedClasses, cls];
      onChange(next);
    }
  };

  const toggleAllClasses = () => {
    if (isAllClassesSelected) {
      onChange([]);
    } else {
      onChange(['ALL']);
    }
  };

  const handleSelectAll = () => {
    onChange(['ALL']);
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all outline-none text-sm ${
          isOpen
            ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
        } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          {isLoading ? (
            <span className="text-slate-400">Loading classes...</span>
          ) : availableClasses.length === 0 ? (
            <span className="text-slate-500">No classes with students found</span>
          ) : isAllClassesSelected ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">All Classes</span>
              <span className="text-xs text-indigo-300 font-mono">
                ({availableClasses.length} {availableClasses.length === 1 ? 'Class' : 'Classes'})
              </span>
            </div>
          ) : selectedClasses.length === 0 ? (
            <span className="text-slate-400">Select Class(es)...</span>
          ) : selectedClasses.length === 1 ? (
            <span className="text-white font-medium truncate">
              {selectedClasses[0]}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">
                {selectedClasses.length} Classes Selected
              </span>
              <span className="text-xs text-slate-400 truncate">
                ({selectedClasses.slice(0, 3).join(', ')}
                {selectedClasses.length > 3 ? ` +${selectedClasses.length - 3}` : ''})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : isAllClassesSelected && availableClasses.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              All
            </span>
          ) : selectedClasses.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              {selectedClasses.length}
            </span>
          ) : null}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header & Quick Actions */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">
              Choose Classes ({isAllClassesSelected ? `All (${availableClasses.length})` : `${selectedClasses.length}/${availableClasses.length}`})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-600">&bull;</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-400 hover:text-slate-300 font-medium underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Scrollable Class Checkboxes */}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {/* "All Classes" option */}
            {availableClasses.length > 0 && (
              <div
                onClick={toggleAllClasses}
                className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                  isAllClassesSelected
                    ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                    : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <input
                    type="checkbox"
                    checked={isAllClassesSelected}
                    readOnly
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                  />
                  <span className="font-semibold text-white">All Classes</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0 ml-2">
                  {availableClasses.length} {availableClasses.length === 1 ? 'Class' : 'Classes'}
                </span>
              </div>
            )}

            {/* Individual Classes */}
            {availableClasses.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No classes found with registered students
              </div>
            ) : (
              availableClasses.map((cls) => {
                const isSelected = !isAllClassesSelected && selectedClasses.includes(cls);
                return (
                  <div
                    key={cls}
                    onClick={() => toggleClass(cls)}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                        : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                      />
                      <span className="truncate">{cls}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Done Button */}
          <div className="pt-1.5 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Multi-Select Dropdown Component
// -------------------------------------------------------------
function SectionMultiSelectDropdown({
  availableSections,
  selectedSections,
  onChange,
  disabled,
  isLoading,
}: {
  availableSections: string[];
  selectedSections: string[];
  onChange: (sections: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const isAllSectionsSelected =
    selectedSections.length === 0 ||
    selectedSections.includes('ALL') ||
    selectedSections.includes('All Sections') ||
    (availableSections.length > 0 && selectedSections.length === availableSections.length);

  const toggleSection = (sec: string) => {
    if (isAllSectionsSelected) {
      onChange([sec]);
      return;
    }
    if (selectedSections.includes(sec)) {
      const next = selectedSections.filter((s) => s !== sec);
      onChange(next);
    } else {
      const next = [...selectedSections, sec];
      onChange(next);
    }
  };

  const toggleAllSections = () => {
    if (isAllSectionsSelected) {
      onChange([]);
    } else {
      onChange(['ALL']);
    }
  };

  const handleSelectAll = () => {
    onChange(['ALL']);
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all outline-none text-sm ${
          isOpen
            ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
        } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          {isLoading ? (
            <span className="text-slate-400">Loading sections...</span>
          ) : availableSections.length === 0 ? (
            <span className="text-slate-500">No sections available</span>
          ) : isAllSectionsSelected ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">All Sections</span>
              <span className="text-xs text-indigo-300 font-mono">
                ({availableSections.length > 0 ? availableSections.map((s) => `Sec ${s}`).join(', ') : 'All'})
              </span>
            </div>
          ) : selectedSections.length === 0 ? (
            <span className="text-slate-400">Select Section(s)...</span>
          ) : selectedSections.length === 1 ? (
            <span className="text-white font-medium truncate">
              Sec {selectedSections[0]}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">
                {selectedSections.length} Sections Selected
              </span>
              <span className="text-xs text-slate-400 truncate">
                ({selectedSections.map((s) => `Sec ${s}`).slice(0, 3).join(', ')}
                {selectedSections.length > 3 ? ` +${selectedSections.length - 3}` : ''})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : isAllSectionsSelected && availableSections.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              All
            </span>
          ) : selectedSections.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              {selectedSections.length}
            </span>
          ) : null}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">
              Choose Sections ({isAllSectionsSelected ? `All (${availableSections.length})` : `${selectedSections.length}/${availableSections.length}`})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-600">&bull;</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-400 hover:text-slate-300 font-medium underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {/* "All Sections" option */}
            {availableSections.length > 0 && (
              <div
                onClick={toggleAllSections}
                className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                  isAllSectionsSelected
                    ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                    : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <input
                    type="checkbox"
                    checked={isAllSectionsSelected}
                    readOnly
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                  />
                  <span className="font-semibold text-white">All Sections</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0 ml-2">
                  {availableSections.length} Sections
                </span>
              </div>
            )}

            {availableSections.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No sections found for selected School(s) & Class(es)
              </div>
            ) : (
              availableSections.map((sec) => {
                const isSelected = !isAllSectionsSelected && selectedSections.includes(sec);
                return (
                  <div
                    key={sec}
                    onClick={() => toggleSection(sec)}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                        : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                      />
                      <span className="truncate">Section {sec}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-1.5 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Student Multi-Select Dropdown Component
// -------------------------------------------------------------
function StudentMultiSelectDropdown({
  availableStudents,
  selectedStudentIds,
  onChange,
  disabled,
  isLoading,
}: {
  availableStudents: any[];
  selectedStudentIds: string[];
  onChange: (studentIds: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const isAllStudentsSelected =
    selectedStudentIds.length === 0 ||
    selectedStudentIds.includes('ALL') ||
    selectedStudentIds.includes('All Students') ||
    (availableStudents.length > 0 && selectedStudentIds.length === availableStudents.length);

  const toggleStudent = (stuKey: string) => {
    if (isAllStudentsSelected) {
      onChange([stuKey]);
      return;
    }
    if (selectedStudentIds.includes(stuKey)) {
      const next = selectedStudentIds.filter((id) => id !== stuKey);
      onChange(next);
    } else {
      const next = [...selectedStudentIds, stuKey];
      onChange(next);
    }
  };

  const toggleAllStudents = () => {
    if (isAllStudentsSelected) {
      onChange([]);
    } else {
      onChange(['ALL']);
    }
  };

  const handleSelectAll = () => {
    onChange(['ALL']);
  };

  const handleClear = () => {
    onChange([]);
  };

  // Search filter across Student Name, Admission Number, App ID / Username, Class, Section
  const filteredStudents = availableStudents.filter((stu) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (stu.studentName && stu.studentName.toLowerCase().includes(q)) ||
      (stu.schoolAdmissionNumber && stu.schoolAdmissionNumber.toLowerCase().includes(q)) ||
      (stu.uniqueStudentId && stu.uniqueStudentId.toLowerCase().includes(q)) ||
      (stu.username && stu.username.toLowerCase().includes(q)) ||
      (stu.className && stu.className.toLowerCase().includes(q)) ||
      (stu.section && stu.section.toLowerCase().includes(q))
    );
  });

  const selectedStudents = availableStudents.filter(
    (s) =>
      selectedStudentIds.includes(s.uniqueStudentId) ||
      selectedStudentIds.includes(s.id) ||
      selectedStudentIds.includes(s._id)
  );

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all outline-none text-sm ${
          isOpen
            ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
        } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <Users className="w-4 h-4 text-indigo-400 shrink-0" />
          {isLoading ? (
            <span className="text-slate-400">Loading students...</span>
          ) : availableStudents.length === 0 ? (
            <span className="text-slate-500">No students found</span>
          ) : isAllStudentsSelected ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">All Students</span>
              <span className="text-xs text-indigo-300 font-mono">
                ({availableStudents.length} Students)
              </span>
            </div>
          ) : selectedStudentIds.length === 0 ? (
            <span className="text-slate-400">Select Student(s)...</span>
          ) : selectedStudentIds.length === 1 ? (
            <span className="text-white font-medium truncate">
              {selectedStudents[0]?.studentName || selectedStudentIds[0]}
              {selectedStudents[0]?.uniqueStudentId && (
                <span className="ml-1.5 text-[11px] font-mono text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800">
                  {selectedStudents[0].uniqueStudentId}
                </span>
              )}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-white font-semibold">
                {selectedStudentIds.length} Students Selected
              </span>
              <span className="text-xs text-slate-400 truncate">
                ({selectedStudents.map((s) => s.studentName).slice(0, 2).join(', ')}
                {selectedStudentIds.length > 2 ? ` +${selectedStudentIds.length - 2}` : ''})
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : isAllStudentsSelected && availableStudents.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              All
            </span>
          ) : selectedStudentIds.length > 0 ? (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
              {selectedStudentIds.length}
            </span>
          ) : null}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95 duration-100 min-w-[280px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">
              Choose Students ({isAllStudentsSelected ? `All (${availableStudents.length})` : `${selectedStudentIds.length}/${availableStudents.length}`})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-600">&bull;</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-400 hover:text-slate-300 font-medium underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search bar inside student filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Search name, admission #, App ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {/* "All Students" option */}
            {(!search || 'all students'.includes(search.toLowerCase())) && availableStudents.length > 0 && (
              <div
                onClick={toggleAllStudents}
                className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                  isAllStudentsSelected
                    ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                    : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <input
                    type="checkbox"
                    checked={isAllStudentsSelected}
                    readOnly
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                  />
                  <span className="font-semibold text-white">All Students</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0 ml-2">
                  {availableStudents.length} Students
                </span>
              </div>
            )}

            {filteredStudents.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                {search ? 'No matching students found' : 'No students found for this target selection'}
              </div>
            ) : (
              filteredStudents.map((stu) => {
                const stuKey = stu.uniqueStudentId || stu.id || stu._id;
                const isSelected =
                  !isAllStudentsSelected &&
                  (selectedStudentIds.includes(stu.uniqueStudentId) ||
                    selectedStudentIds.includes(stu.id) ||
                    selectedStudentIds.includes(stu._id));
                return (
                  <div
                    key={stuKey}
                    onClick={() => toggleStudent(stu.uniqueStudentId || stu.id)}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/70 border border-indigo-500/80 text-white font-medium shadow-sm'
                        : 'bg-slate-800/50 border border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                      />
                      <div className="truncate">
                        <span className="truncate font-medium text-white">{stu.studentName}</span>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="text-indigo-400">ID: {stu.uniqueStudentId}</span>
                          {stu.className && (
                            <span>&bull; {stu.className}{stu.section ? ` - ${stu.section}` : ''}</span>
                          )}
                          {stu.schoolAdmissionNumber && (
                            <span>&bull; Adm: {stu.schoolAdmissionNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-1.5 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Target Card Component (Individual Target Configuration)
// -------------------------------------------------------------
function TargetCard({
  target,
  index,
  totalTargets,
  schools,
  token,
  onUpdate,
  onRemove,
}: {
  target: TargetItem;
  index: number;
  totalTargets: number;
  schools: any[];
  token: string;
  onUpdate: (updates: Partial<TargetItem>) => void;
  onRemove: () => void;
}) {
  const {
    selectedSchoolIds,
    selectedClasses,
    availableClasses = [],
    isLoadingClasses = false,
    selectedSections,
    availableSections,
    isLoadingSections,
    selectedStudentIds = [],
    availableStudents = [],
    isLoadingStudents = false,
  } = target;

  // 1. Whenever selectedSchoolIds changes, fetch dynamic classes with actual students from MongoDB Atlas
  useEffect(() => {
    let isCancelled = false;

    const effectiveSchoolIds = selectedSchoolIds.includes('ALL')
      ? schools.map((s) => s.id)
      : selectedSchoolIds;

    if (effectiveSchoolIds.length === 0) {
      onUpdate({ availableClasses: [], selectedClasses: [], isLoadingClasses: false });
      return;
    }

    const fetchClasses = async () => {
      onUpdate({ isLoadingClasses: true });
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('schoolIds', effectiveSchoolIds.join(','));

        const res = await fetch(`/api/target-classes?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const list: string[] = Array.isArray(data) ? data : data.classes || [];
          if (!isCancelled) {
            const validSelected = selectedClasses.filter(
              (cls) => cls === 'ALL' || cls === 'All Classes' || list.includes(cls)
            );
            onUpdate({
              availableClasses: list,
              selectedClasses: validSelected,
              isLoadingClasses: false,
            });
          }
        } else {
          if (!isCancelled) {
            onUpdate({ availableClasses: [], selectedClasses: [], isLoadingClasses: false });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          onUpdate({ availableClasses: [], selectedClasses: [], isLoadingClasses: false });
        }
      }
    };

    fetchClasses();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedSchoolIds.join(','),
    token,
    schools.map((s) => s.id).join(','),
  ]);

  // 2. Whenever selectedSchoolIds or selectedClasses changes, fetch dynamic sections from MongoDB Atlas
  useEffect(() => {
    let isCancelled = false;

    const effectiveSchoolIds = selectedSchoolIds.includes('ALL')
      ? schools.map((s) => s.id)
      : selectedSchoolIds;

    if (effectiveSchoolIds.length === 0) {
      onUpdate({ availableSections: [], selectedSections: [], isLoadingSections: false });
      return;
    }

    const fetchSections = async () => {
      onUpdate({ isLoadingSections: true });
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('schoolIds', effectiveSchoolIds.join(','));

        const isAll =
          selectedClasses.length === 0 ||
          selectedClasses.includes('ALL') ||
          selectedClasses.includes('All Classes');

        if (!isAll && selectedClasses.length > 0) {
          queryParams.set('classes', selectedClasses.join(','));
        }

        const res = await fetch(`/api/target-sections?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const list: string[] = Array.isArray(data) ? data : data.sections || [];
          if (!isCancelled) {
            const validSelected = selectedSections.filter((sec) => sec === 'ALL' || list.includes(sec));
            onUpdate({
              availableSections: list,
              selectedSections: validSelected,
              isLoadingSections: false,
            });
          }
        } else {
          if (!isCancelled) {
            onUpdate({ availableSections: [], selectedSections: [], isLoadingSections: false });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          onUpdate({ availableSections: [], selectedSections: [], isLoadingSections: false });
        }
      }
    };

    fetchSections();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedSchoolIds.join(','),
    selectedClasses.join(','),
    token,
    schools.map((s) => s.id).join(','),
  ]);

  // 2. Whenever selectedSchoolIds, selectedClasses, or selectedSections changes, fetch dynamic students from MongoDB Atlas
  useEffect(() => {
    let isCancelled = false;

    const effectiveSchoolIds = selectedSchoolIds.includes('ALL')
      ? schools.map((s) => s.id)
      : selectedSchoolIds;

    if (effectiveSchoolIds.length === 0) {
      onUpdate({ availableStudents: [], selectedStudentIds: [], isLoadingStudents: false });
      return;
    }

    const fetchStudents = async () => {
      onUpdate({ isLoadingStudents: true });
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('schoolIds', effectiveSchoolIds.join(','));

        const isAllCls =
          selectedClasses.length === 0 ||
          selectedClasses.includes('ALL') ||
          selectedClasses.includes('All Classes');

        if (!isAllCls && selectedClasses.length > 0) {
          queryParams.set('classes', selectedClasses.join(','));
        }

        const isAllSec =
          selectedSections.length === 0 ||
          selectedSections.includes('ALL') ||
          selectedSections.includes('All Sections');

        if (!isAllSec && selectedSections.length > 0) {
          queryParams.set('sections', selectedSections.join(','));
        }

        const res = await fetch(`/api/target-students?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const list: any[] = Array.isArray(data) ? data : data.students || [];
          if (!isCancelled) {
            const validStudentKeys = new Set(
              list.flatMap((s) => [s.uniqueStudentId, s.id, s._id].filter(Boolean))
            );
            const validSelected = (selectedStudentIds || []).filter(
              (id) => id === 'ALL' || validStudentKeys.has(id)
            );
            onUpdate({
              availableStudents: list,
              selectedStudentIds: validSelected,
              isLoadingStudents: false,
            });
          }
        } else {
          if (!isCancelled) {
            onUpdate({ availableStudents: [], selectedStudentIds: [], isLoadingStudents: false });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          onUpdate({ availableStudents: [], selectedStudentIds: [], isLoadingStudents: false });
        }
      }
    };

    fetchStudents();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedSchoolIds.join(','),
    selectedClasses.join(','),
    selectedSections.join(','),
    token,
    schools.map((s) => s.id).join(','),
  ]);

  const isAllClasses =
    selectedClasses.length === 0 ||
    selectedClasses.includes('ALL') ||
    selectedClasses.includes('All Classes') ||
    (availableClasses.length > 0 && selectedClasses.length === availableClasses.length);

  const classesText = isAllClasses
    ? availableClasses.length > 0
      ? `All Classes (${availableClasses.length})`
      : 'All Classes'
    : selectedClasses.length === 1
    ? selectedClasses[0]
    : selectedClasses.join(' + ');

  const isAllSections =
    selectedSections.length === 0 ||
    selectedSections.includes('ALL') ||
    selectedSections.includes('All Sections');

  const sectionsText = isAllSections
    ? 'All Sections'
    : selectedSections.length === 1
    ? `Sec ${selectedSections[0]}`
    : `Sec ${selectedSections.join(', ')}`;

  const isAllStudents =
    selectedStudentIds.length === 0 ||
    selectedStudentIds.includes('ALL') ||
    selectedStudentIds.includes('All Students');

  const studentsText = isAllStudents
    ? 'All Students'
    : selectedStudentIds.length === 1
    ? '1 Student'
    : `${selectedStudentIds.length} Students`;

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm hover:border-slate-700/80 transition-all">
      {/* Target Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-700 text-xs font-bold font-mono">
            Target {index + 1}
          </span>
          <span className="text-xs text-slate-400">
            {selectedSchoolIds.length === 0
              ? 'No school selected'
              : selectedSchoolIds.includes('ALL')
              ? `All Schools (${schools.length}) • ${classesText} • ${sectionsText} • ${studentsText}`
              : `${selectedSchoolIds.length} school(s) • ${classesText} • ${sectionsText} • ${studentsText}`}
          </span>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove Target
        </button>
      </div>

      {/* Target Controls Grid: School -> Class -> Section -> Student */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {/* 1. School Selection -> Multi-Select Dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase text-slate-400">
            1. Target School(s) *
          </label>
          <SchoolMultiSelectDropdown
            schools={schools}
            selectedSchoolIds={selectedSchoolIds}
            onChange={(ids) => onUpdate({ selectedSchoolIds: ids })}
          />
          <p className="text-[11px] text-slate-400">
            {selectedSchoolIds.length === 0
              ? 'Select one or more schools from dropdown'
              : selectedSchoolIds.includes('ALL')
              ? `All ${schools.length} school workspace(s) included`
              : `${selectedSchoolIds.length} school workspace(s) selected`}
          </p>
        </div>

        {/* 2. Class Selection -> Multi-Select Dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase text-slate-400">
            2. Target Class(es)
          </label>
          <ClassMultiSelectDropdown
            availableClasses={availableClasses}
            selectedClasses={selectedClasses}
            onChange={(classes) => onUpdate({ selectedClasses: classes })}
            disabled={selectedSchoolIds.length === 0}
            isLoading={isLoadingClasses}
          />
          <p className="text-[11px] text-slate-400">
            {isLoadingClasses
              ? 'Fetching classes...'
              : availableClasses.length === 0
              ? 'No classes with students found'
              : isAllClasses
              ? `All classes included (${availableClasses.length > 0 ? availableClasses.join(', ') : 'All'})`
              : selectedClasses.length === 1
              ? `Filtered to ${selectedClasses[0]}`
              : `Selected: ${selectedClasses.join(' + ')}`}
          </p>
        </div>

        {/* 3. Section Selection -> Multi-Select Dropdown (Same UI pattern as Class) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase text-slate-400">
            3. Target Section(s)
          </label>
          <SectionMultiSelectDropdown
            availableSections={availableSections}
            selectedSections={selectedSections}
            onChange={(sections) => onUpdate({ selectedSections: sections })}
            disabled={selectedSchoolIds.length === 0}
            isLoading={isLoadingSections}
          />
          <p className="text-[11px] text-slate-400">
            {isLoadingSections
              ? 'Fetching sections...'
              : availableSections.length === 0
              ? 'No sections found'
              : isAllSections
              ? `All sections included (${availableSections.length > 0 ? availableSections.map((s) => `Sec ${s}`).join(', ') : 'All'})`
              : selectedSections.length === 1
              ? `Filtered to Sec ${selectedSections[0]}`
              : `Selected: ${selectedSections.map((s) => `Sec ${s}`).join(' + ')}`}
          </p>
        </div>

        {/* 4. Student Selection -> Multi-Select Dropdown (Same UI pattern as Class) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase text-slate-400">
            4. Target Student(s)
          </label>
          <StudentMultiSelectDropdown
            availableStudents={availableStudents}
            selectedStudentIds={selectedStudentIds}
            onChange={(studentIds) => onUpdate({ selectedStudentIds: studentIds })}
            disabled={selectedSchoolIds.length === 0}
            isLoading={isLoadingStudents}
          />
          <p className="text-[11px] text-slate-400">
            {isLoadingStudents
              ? 'Fetching students...'
              : availableStudents.length === 0
              ? 'No students found'
              : isAllStudents
              ? `All ${availableStudents.length} student(s) included`
              : selectedStudentIds.length === 1
              ? `Filtered to 1 student`
              : `Selected: ${selectedStudentIds.length} students`}
          </p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Main Publish Assessment Section
// -------------------------------------------------------------
export function PublishAssessmentSection({
  token,
  schools,
  allQuestions,
  onPublishSuccess,
  formState,
  onFormStateChange,
  onResetFormState,
}: PublishAssessmentSectionProps) {
  const [publishName, setPublishName] = useState(formState?.publishName ?? '');
  const [publishMode, setPublishMode] = useState<'Selected Questions' | 'Random Questions'>(
    formState?.publishMode ?? 'Selected Questions'
  );

  // Multi-target list state
  const [targets, setTargets] = useState<TargetItem[]>(
    formState?.targets ?? [
      {
        id: 'target-1',
        selectedSchoolIds: ['ALL'],
        selectedClasses: ['ALL'],
        availableClasses: [],
        isLoadingClasses: false,
        selectedSections: [],
        availableSections: [],
        isLoadingSections: false,
        selectedStudentIds: [],
        availableStudents: [],
        isLoadingStudents: false,
      },
    ]
  );

  const [selectedQuestionsForPublish, setSelectedQuestionsForPublish] = useState<string[]>(
    formState?.selectedQuestionsForPublish ?? []
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(formState?.shuffleQuestions ?? false);
  const [randomCount, setRandomCount] = useState(formState?.randomCount ?? 5);
  const [startDate, setStartDate] = useState(
    formState?.startDate ?? new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState(formState?.startTime ?? '00:00');
  const [endDate, setEndDate] = useState(
    formState?.endDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endTime, setEndTime] = useState(formState?.endTime ?? '23:59');
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state back to parent container so it is preserved across page navigation
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        publishName,
        publishMode,
        targets,
        selectedQuestionsForPublish,
        shuffleQuestions,
        randomCount,
        startDate,
        startTime,
        endDate,
        endTime,
      });
    }
  }, [
    publishName,
    publishMode,
    targets,
    selectedQuestionsForPublish,
    shuffleQuestions,
    randomCount,
    startDate,
    startTime,
    endDate,
    endTime,
    onFormStateChange,
  ]);

  // In-section preview modal
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const resolveTargetSchoolIds = (ids: string[]) => {
    if (ids.includes('ALL')) {
      return schools.map((s) => s.id);
    }
    return ids;
  };

  const handleAddTarget = () => {
    setTargets((prev) => [
      ...prev,
      {
        id: `target-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        selectedSchoolIds: ['ALL'],
        selectedClasses: ['ALL'],
        availableClasses: [],
        isLoadingClasses: false,
        selectedSections: [],
        availableSections: [],
        isLoadingSections: false,
        selectedStudentIds: [],
        availableStudents: [],
        isLoadingStudents: false,
      },
    ]);
  };

  const handleRemoveTarget = (id: string) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTarget = (index: number, updates: Partial<TargetItem>) => {
    setTargets((prev) => {
      if (!prev[index]) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleClearAllTargets = () => {
    setTargets([]);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishFeedback(null);

    if (targets.length === 0) {
      setPublishFeedback('Please add at least one target configuration before publishing.');
      return;
    }

    if (!publishName.trim()) {
      setPublishFeedback('Please specify a Publish Name (e.g. Class 7 Reasoning Test - September)');
      return;
    }

    // Validate that each target has at least one school selected
    for (let i = 0; i < targets.length; i++) {
      const resolvedIds = resolveTargetSchoolIds(targets[i].selectedSchoolIds);
      if (resolvedIds.length === 0) {
        setPublishFeedback(`Target ${i + 1}: Please select at least one target school workspace.`);
        return;
      }
    }

    // Client-side exact duplicate target check
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const t1 = targets[i];
        const t2 = targets[j];
        const s1 = [...resolveTargetSchoolIds(t1.selectedSchoolIds)].sort().join(',');
        const s2 = [...resolveTargetSchoolIds(t2.selectedSchoolIds)].sort().join(',');
        const c1 = [...t1.selectedClasses].map((c) => c.toLowerCase()).sort().join(',');
        const c2 = [...t2.selectedClasses].map((c) => c.toLowerCase()).sort().join(',');
        const sec1 = [...t1.selectedSections].sort().join(',');
        const sec2 = [...t2.selectedSections].sort().join(',');
        const stu1 = [...(t1.selectedStudentIds || [])].sort().join(',');
        const stu2 = [...(t2.selectedStudentIds || [])].sort().join(',');

        if (s1 === s2 && c1 === c2 && sec1 === sec2 && stu1 === stu2) {
          setPublishFeedback(
            `Duplicate Target Detected: Target ${i + 1} and Target ${j + 1} are exact duplicates with identical School(s), Class(es), Section(s), and Student(s). Please remove or edit one of the duplicate targets.`
          );
          return;
        }
      }
    }

    if (publishMode === 'Selected Questions' && selectedQuestionsForPublish.length === 0) {
      setPublishFeedback('Please select at least 1 question from Question Bank.');
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedTargetsForApi = targets.map((t) => {
        const isAllCls =
          t.selectedClasses.length === 0 ||
          t.selectedClasses.includes('ALL') ||
          t.selectedClasses.includes('All Classes');

        const isAllSec =
          t.selectedSections.length === 0 ||
          t.selectedSections.includes('ALL') ||
          t.selectedSections.includes('All Sections');

        const isAllStu =
          !t.selectedStudentIds ||
          t.selectedStudentIds.length === 0 ||
          t.selectedStudentIds.includes('ALL') ||
          t.selectedStudentIds.includes('All Students');

        return {
          schoolIds: resolveTargetSchoolIds(t.selectedSchoolIds),
          classes: isAllCls ? [] : t.selectedClasses,
          className: isAllCls ? '' : t.selectedClasses.join(', '),
          sections: isAllSec ? [] : t.selectedSections,
          studentIds: isAllStu ? [] : t.selectedStudentIds,
        };
      });

      // 1. Validate targets with backend against actual student records in MongoDB Atlas
      const valRes = await fetch('/api/publish/validate-targets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targets: normalizedTargetsForApi,
        }),
      });

      const valData = await valRes.json();
      if (!valRes.ok || !valData.valid) {
        setPublishFeedback(valData.error || 'Target configuration validation failed.');
        setIsSubmitting(false);
        return;
      }

      // 2. Publish assessment with validated target configurations
      const allSelectedSchoolIds = Array.from(
        new Set(targets.flatMap((t) => resolveTargetSchoolIds(t.selectedSchoolIds)))
      );
      const allSelectedClasses = Array.from(
        new Set(
          targets.flatMap((t) => {
            const isAll =
              t.selectedClasses.length === 0 ||
              t.selectedClasses.includes('ALL') ||
              t.selectedClasses.includes('All Classes');
            return isAll ? ['All Classes'] : t.selectedClasses;
          })
        )
      );
      const allSelectedSections = Array.from(new Set(targets.flatMap((t) => t.selectedSections)));
      const allSelectedStudentIds = Array.from(
        new Set(
          targets.flatMap((t) => {
            const isAllStu =
              !t.selectedStudentIds ||
              t.selectedStudentIds.length === 0 ||
              t.selectedStudentIds.includes('ALL') ||
              t.selectedStudentIds.includes('All Students');
            return isAllStu ? [] : t.selectedStudentIds;
          })
        )
      );

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          publishName: publishName.trim(),
          publishMode,
          targets: normalizedTargetsForApi,
          // Aggregated target for backward compatibility
          target: {
            schoolId: allSelectedSchoolIds[0] || '',
            schoolIds: allSelectedSchoolIds,
            classes: allSelectedClasses,
            sections: allSelectedSections,
            studentIds: allSelectedStudentIds,
          },
          startDate,
          startTime,
          endDate,
          endTime,
          selectedQuestionIds: selectedQuestionsForPublish,
          randomCount: Number(randomCount),
          shuffle: shuffleQuestions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPublishFeedback(`Successfully published to ${data.assignedStudentCount ?? data.totalAssignedStudents} students!`);
        setPublishName('');
        setSelectedQuestionsForPublish([]);
        setTargets([
          {
            id: `target-${Date.now()}`,
            selectedSchoolIds: ['ALL'],
            selectedClasses: ['ALL'],
            availableClasses: [],
            isLoadingClasses: false,
            selectedSections: [],
            availableSections: [],
            isLoadingSections: false,
            selectedStudentIds: [],
            availableStudents: [],
            isLoadingStudents: false,
          },
        ]);
        if (onResetFormState) {
          onResetFormState();
        }
        await onPublishSuccess();
      } else {
        setPublishFeedback(data.error || 'Failed to publish test');
      }
    } catch (err: any) {
      setPublishFeedback(err.message || 'Network error publishing test');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase text-indigo-400 tracking-wider">Assessment Dispatch</span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-0.5">Publish Assessment</h2>
        <p className="text-sm text-slate-400">
          Configure publication options: choose between <strong>Selected Questions</strong> or <strong>Random Questions</strong>, define student targets, and schedule availability.
        </p>
      </div>

      {publishFeedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-start justify-between gap-3 ${
            publishFeedback.includes('Successfully')
              ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border border-rose-500/70 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {publishFeedback.includes('Successfully') ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="whitespace-pre-line leading-relaxed">{publishFeedback}</span>
          </div>
          <button onClick={() => setPublishFeedback(null)} className="text-xs underline opacity-80 hover:opacity-100 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handlePublish} className="space-y-6">
        {/* Publish Name */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <label className="block text-xs font-semibold uppercase text-slate-400">
            Publish Name (Permanently Saved in History & Student Logs)
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Class 7 Reasoning & Thinking Test - September"
            value={publishName}
            onChange={(e) => setPublishName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-base text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPublishMode('Selected Questions')}
            className={`p-5 rounded-2xl border text-left transition-all ${
              publishMode === 'Selected Questions'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white text-base">Selected Questions</span>
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-xs text-slate-400">
              Hand-pick questions from Question Bank. Supports question order shuffling and interactive test preview.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPublishMode('Random Questions')}
            className={`p-5 rounded-2xl border text-left transition-all ${
              publishMode === 'Random Questions'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white text-base">Random Questions</span>
              <Shuffle className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-xs text-slate-400">
              Rule-based engine automatically selects questions dynamically matching student past performance and repetition gap.
            </p>
          </button>
        </div>

        {/* Target Configuration: Multiple Targets with Multi-Select Dropdowns */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Target Configuration
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure one or more independent student targets for this assessment.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAllTargets}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-700/80 text-slate-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>

          {/* List of independent targets */}
          {targets.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center bg-slate-950/40 space-y-2">
              <p className="text-xs text-slate-400">
                No targets currently configured. Click <strong>+ Add Target</strong> below to create a target.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {targets.map((target, idx) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  index={idx}
                  totalTargets={targets.length}
                  schools={schools}
                  token={token}
                  onUpdate={(updates) => handleUpdateTarget(idx, updates)}
                  onRemove={() => handleRemoveTarget(target.id)}
                />
              ))}
            </div>
          )}

          {/* Secondary Add Target action */}
          <div className="pt-2 flex justify-start">
            <button
              type="button"
              onClick={handleAddTarget}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-indigo-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              + Add Target
            </button>
          </div>
        </div>

        {/* Availability Window */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Test Availability Window
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Selected Questions vs Random Questions Configuration */}
        {publishMode === 'Selected Questions' ? (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-white">Selected Questions Bank Picker</h3>
                <p className="text-xs text-slate-400">
                  Selected: <strong className="text-indigo-400">{selectedQuestionsForPublish.length}</strong> questions
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                  />
                  Shuffle Questions for each student
                </label>

                <button
                  type="button"
                  disabled={selectedQuestionsForPublish.length === 0}
                  onClick={() => {
                    setPreviewActiveIndex(0);
                    setShowPreviewModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-700/80 hover:bg-indigo-900 flex items-center gap-1.5 text-xs font-medium transition-all disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />
                  Preview with Test ({selectedQuestionsForPublish.length})
                </button>
              </div>
            </div>

            {/* List of selectable questions */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {allQuestions.length > 0 ? (
                allQuestions.map((q) => {
                  const isChecked = selectedQuestionsForPublish.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedQuestionsForPublish(
                            selectedQuestionsForPublish.filter((id) => id !== q.id)
                          );
                        } else {
                          setSelectedQuestionsForPublish([...selectedQuestionsForPublish, q.id]);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-sm flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-indigo-950/40 border-indigo-500 text-white ring-1 ring-indigo-500/50'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 pointer-events-none"
                        />
                        <div>
                          <p className="font-medium text-white">{q.content}</p>
                          <span className="text-xs text-indigo-400">
                            {q.groupName} &bull; {q.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                        {q.timeSeconds != null && q.timeSeconds > 0 && (
                          <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">
                            {q.timeSeconds}s
                          </span>
                        )}
                        {q.points != null && q.points > 0 && (
                          <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {q.points} pts
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center py-8">
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-slate-300">No questions available</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    No questions added to the Question Bank yet. Please add questions before publishing.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-base text-white">Random Adaptive Engine Settings</h3>
            <p className="text-xs text-slate-400">
              Super Admin specifies the number of questions. The rule-based engine dynamically determines
              question difficulty (Easy &rarr; Medium &rarr; Hard) and enforces anti-repetition exclusion for each student.
            </p>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Number of Questions per Student
              </label>
              <input
                type="number"
                required
                min={1}
                max={50}
                value={randomCount}
                onChange={(e) => setRandomCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-indigo-300">Engine Rule Pipeline:</p>
              <p>&bull; Fresh student &rarr; Easy difficulty tier</p>
              <p>&bull; High Easy performance (&gt;=70%) &rarr; Easy or Easy + Medium</p>
              <p>&bull; High Medium performance (&gt;=70%) &rarr; Medium or Medium + Hard</p>
              <p>&bull; Hard is the final difficulty level</p>
              <p>&bull; Anti-repetition gap prevents recently used questions from repeating</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || schools.length === 0}
          className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/30 transition-all text-base disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? 'Validating & Publishing Assessment...' : 'Publish Test to Target'}
        </button>
      </form>

      {/* Interactive Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono uppercase text-indigo-400">Super Admin Preview</span>
                <h3 className="text-xl font-bold text-white">Preview with Test</h3>
                <p className="text-xs text-slate-400">
                  Simulating candidate test experience for {selectedQuestionsForPublish.length} selected questions.
                </p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all cursor-pointer"
              >
                &times; Close Preview
              </button>
            </div>

            {selectedQuestionsForPublish.length > 0 ? (
              <div className="space-y-6">
                {(() => {
                  const qId = selectedQuestionsForPublish[previewActiveIndex];
                  const q = allQuestions.find((item) => item.id === qId);
                  if (!q) return <p className="text-slate-400">Question not found.</p>;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          Question {previewActiveIndex + 1} of {selectedQuestionsForPublish.length}
                        </span>
                        <span>
                          Configured Timer: {q.timeSeconds != null && q.timeSeconds > 0 ? `${q.timeSeconds}s` : 'None'} | Points: {q.points != null && q.points > 0 ? q.points : 'None'}
                        </span>
                      </div>

                      <FlameMiniGameCanvas
                        content={q.content}
                        points={q.points}
                        timeRemaining={q.timeSeconds || undefined}
                        options={q.options}
                        pairs={q.metadata?.pairs || []}
                        onAnswerSubmit={() => {}}
                        selectedAnswer={null}
                        disabled={false}
                      />

                      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                        <button
                          disabled={previewActiveIndex === 0}
                          onClick={() => setPreviewActiveIndex(previewActiveIndex - 1)}
                          className="px-4 py-2 rounded-xl bg-slate-800 disabled:opacity-40 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer"
                        >
                          &larr; Previous
                        </button>
                        <span className="text-xs text-slate-400 font-mono">
                          {previewActiveIndex + 1} / {selectedQuestionsForPublish.length}
                        </span>
                        <button
                          disabled={previewActiveIndex >= selectedQuestionsForPublish.length - 1}
                          onClick={() => setPreviewActiveIndex(previewActiveIndex + 1)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 disabled:opacity-40 text-white text-sm hover:bg-indigo-500 cursor-pointer"
                        >
                          Next Preview Question &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-slate-400">No questions selected for preview.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
