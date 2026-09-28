import { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';

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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-4xl mx-auto my-6 text-slate-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Database className="w-6 h-6" />
        </div>
        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>MongoDB Atlas Cluster: Dedicated Database <code>puzzles_assessment_dev</code></span>
              </h3>
              <p className="text-xs text-slate-400">
                Connected exclusively to your Atlas cluster with zero fallback connections.
              </p>
            </div>
            <button
              onClick={fetchStatus}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Connection Status Live Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dbStatus?.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300">
                Database Status: <strong className={dbStatus?.status === 'connected' ? 'text-emerald-400' : 'text-amber-400'}>{dbStatus?.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}</strong>
              </span>
            </div>
            <div className="text-slate-300">
              Target Database: <strong className="text-emerald-400">{dbStatus?.dbName || 'puzzles_assessment_dev'}</strong>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono break-all p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
            Host: <span className="text-indigo-300">{dbStatus?.host || 'ac-b8sr3pi-shard-00-00.dg9pefu.mongodb.net'}</span>
            <br />
            URI: <span className="text-slate-400">{dbStatus?.uri || 'Loaded securely from MONGO_URI'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>All legacy connections (localhost, memory-server, previous clusters) have been purged.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
