import { LogOut, School, ShieldCheck } from 'lucide-react';

interface SchoolAdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export function SchoolAdminDashboard({ user, onLogout }: SchoolAdminDashboardProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-bold">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">School Workspace</h1>
            <p className="text-xs text-emerald-400 font-mono">ID: {user.username}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
          title="Log Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content (Requirement: After login, Admin can ONLY see: School Name) */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <School className="w-8 h-8" />
          </div>

          <span className="text-xs font-mono uppercase tracking-widest text-slate-400 block">
            Assigned School Workspace
          </span>

          <h2 className="text-2xl font-bold tracking-tight text-white">
            {user.schoolName || 'Unassigned School'}
          </h2>

          <div className="pt-4 border-t border-slate-800/80">
            <p className="text-xs text-slate-500">
              Current Admin Scope: Isolated school verification. Further administrative tools will be activated in future releases.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
