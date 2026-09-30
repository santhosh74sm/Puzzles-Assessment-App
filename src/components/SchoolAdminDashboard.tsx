import { School } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';

interface SchoolAdminDashboardProps {
  user: any;
  onLogout: () => void;
}

export function SchoolAdminDashboard({ user, onLogout }: SchoolAdminDashboardProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-bold">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 dark:text-white">School Portal</h1>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">User: {user.username}</p>
          </div>
        </div>

        <ProfileMenu user={user} onLogout={onLogout} />
      </header>

      {/* Main Content (Requirement: After login, Admin can ONLY see: School Name) */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
            <School className="w-8 h-8" />
          </div>

          <span className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 block">
            Your School
          </span>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {user.schoolName || 'Unassigned School'}
          </h2>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <p className="text-xs text-slate-500">
              You are signed in as the administrator for this school.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
