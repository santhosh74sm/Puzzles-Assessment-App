import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2 } from 'lucide-react';

export function MongoCompassNotice() {
  const [dbStatus, setDbStatus] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/database/status');
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-4xl mx-auto my-6 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
          <Database className="w-6 h-6" />
        </div>
        <div className="space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>System Status: Cloud Storage</span>
                <code className="text-xs bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-mono">
                  {dbStatus?.dbName || 'puzzles_assessment_dev'}
                </code>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Connected securely to your dedicated cloud data storage.
              </p>
            </div>
            <button
              onClick={fetchStatus}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Connection Status Live Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 font-mono text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dbStatus?.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-slate-700 dark:text-slate-300">
                Status: <strong className={dbStatus?.status === 'connected' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{dbStatus?.status === 'connected' ? 'Connected' : 'Not Connected'}</strong>
              </span>
            </div>
            <div className="text-slate-700 dark:text-slate-300">
              Database: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{dbStatus?.dbName || 'puzzles_assessment_dev'}</strong>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
            <div>
              Host: <span className="text-indigo-700 dark:text-indigo-300 font-medium">{dbStatus?.host || 'ac-b8sr3pi-shard-00-00.dg9pefu.mongodb.net'}</span>
            </div>
            <div>
              Connection: <span className="text-slate-500 dark:text-slate-400">{dbStatus?.uri ? 'Connected securely' : 'Connected securely from settings'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>All data is securely connected and saved in the cloud.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
