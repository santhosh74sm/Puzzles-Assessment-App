import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  Send,
  History,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { SchoolsSection } from './SchoolsSection.tsx';
import { QuestionBankSection } from './QuestionBankSection.tsx';
import {
  PublishAssessmentSection,
  PublishAssessmentFormState,
} from './PublishAssessmentSection.tsx';
import { PublishHistorySection } from './PublishHistorySection.tsx';

interface SuperAdminDashboardProps {
  token: string;
  onLogout?: () => void;
}

export type SuperAdminNavTab =
  | 'schools'
  | 'question_bank'
  | 'publish'
  | 'history';

export function SuperAdminDashboard({ token, onLogout }: SuperAdminDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<SuperAdminNavTab>('schools');

  // Shared shared data
  const [schools, setSchools] = useState<any[]>([]);
  const [questionGroups, setQuestionGroups] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<any | null>(null);

  // Preserve in-progress Publish Assessment state across sidebar page navigation
  const [publishFormState, setPublishFormState] = useState<PublishAssessmentFormState | undefined>(undefined);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const loadSchools = async () => {
    try {
      const res = await fetch('/api/schools', { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const sorted = [...list].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      setSchools(sorted);
    } catch (e) {
      console.error('Failed to load schools', e);
    }
  };

  const loadQuestionBank = async () => {
    try {
      const [resGrp, resQ] = await Promise.all([
        fetch('/api/question-groups', { headers }),
        fetch('/api/questions', { headers }),
      ]);
      const dataGrp = await resGrp.json();
      const dataQ = await resQ.json();
      setQuestionGroups(Array.isArray(dataGrp) ? dataGrp : []);
      setAllQuestions(Array.isArray(dataQ) ? dataQ : []);
    } catch (e) {
      console.error('Failed to load question bank', e);
    }
  };

  const loadPublishHistory = async () => {
    try {
      const res = await fetch('/api/publish-history', { headers });
      const data = await res.json();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load publish history', e);
    }
  };

  const loadHistoryDetail = async (publishId: string) => {
    try {
      const res = await fetch(`/api/publish-history/${publishId}`, { headers });
      const data = await res.json();
      setSelectedHistoryDetail(data);
    } catch (e) {
      console.error('Failed to load history detail', e);
    }
  };

  const loadAllInitialData = async () => {
    await Promise.all([
      loadSchools(),
      loadQuestionBank(),
      loadPublishHistory(),
    ]);
  };

  useEffect(() => {
    loadAllInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation - Strictly the 5 specified items */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-800 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-white">Super Admin</h1>
              <p className="text-xs text-indigo-400 font-mono">Workspace Director</p>
            </div>
          </div>

          {/* Strictly 5 Navigation Items */}
          <nav className="space-y-1.5">
            {/* 1. Schools & Students */}
            <button
              type="button"
              onClick={() => setActiveTab('schools')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'schools'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="truncate">Schools & Students</span>
            </button>

            {/* 2. Question Bank & Groups */}
            <button
              type="button"
              onClick={() => setActiveTab('question_bank')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'question_bank'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="truncate">Question Bank & Groups</span>
            </button>

            {/* 3. Publish Assessment */}
            <button
              type="button"
              onClick={() => setActiveTab('publish')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'publish'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Send className="w-4 h-4 shrink-0" />
              <span className="truncate">Publish Assessment</span>
            </button>

            {/* 4. Publish History */}
            <button
              type="button"
              onClick={() => {
                setSelectedHistoryDetail(null);
                setActiveTab('history');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span className="truncate">Publish History</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-500 space-y-2">
          <div className="flex items-center justify-between">
            <span>Role: Super Admin</span>
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1 text-slate-400 hover:text-rose-400 text-[11px] transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-600">Puzzles Assessment Engine v2.0</p>
        </div>
      </aside>

      {/* Main Content Area - Renders ONLY the selected section */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-950">
        {activeTab === 'schools' && (
          <SchoolsSection
            token={token}
            schools={schools}
            onRefreshSchools={loadSchools}
          />
        )}

        {activeTab === 'question_bank' && (
          <QuestionBankSection
            token={token}
            questionGroups={questionGroups}
            allQuestions={allQuestions}
            onRefreshData={loadQuestionBank}
          />
        )}

        {activeTab === 'publish' && (
          <PublishAssessmentSection
            token={token}
            schools={schools}
            allQuestions={allQuestions}
            formState={publishFormState}
            onFormStateChange={setPublishFormState}
            onResetFormState={() => setPublishFormState(undefined)}
            onPublishSuccess={async () => {
              setPublishFormState(undefined);
              await loadPublishHistory();
            }}
          />
        )}

        {activeTab === 'history' && (
          <PublishHistorySection
            token={token}
            schools={schools}
            historyList={historyList}
            selectedHistoryDetail={selectedHistoryDetail}
            onSelectHistory={loadHistoryDetail}
          />
        )}
      </main>
    </div>
  );
}
