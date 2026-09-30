/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sparkles, Shield, User, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { SuperAdminDashboard } from './components/SuperAdminDashboard.tsx';
import { SchoolAdminDashboard } from './components/SchoolAdminDashboard.tsx';
import { StudentPortal } from './components/StudentPortal.tsx';
import { ForcePasswordModal } from './components/ForcePasswordModal.tsx';
import { MongoCompassNotice } from './components/MongoCompassNotice.tsx';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('puzzles_token'));
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('puzzles_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login & Setup form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((res) => res.json())
      .then((data) => {
        if (!data.hasUsers) {
          setSetupMode(true);
        }
      })
      .catch((err) => console.error('Setup check failed:', err))
      .finally(() => setCheckingSetup(false));
  }, []);

  const handleLoginOrSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const endpoint = setupMode ? '/api/auth/setup-first-admin' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('puzzles_token', data.token);
      localStorage.setItem('puzzles_user', JSON.stringify(data.user));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser?.role === 'student' && token) {
      try {
        await fetch('/api/student/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        console.error('Logout error', e);
      }
    }
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('puzzles_token');
    localStorage.removeItem('puzzles_user');
  };

  const handlePasswordChangeComplete = () => {
    if (currentUser) {
      const updated = { ...currentUser, mustChangePassword: false };
      setCurrentUser(updated);
      localStorage.setItem('puzzles_user', JSON.stringify(updated));
    }
  };

  // If user is authenticated
  if (token && currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans">
        {/* Force Password Change Modal if first login */}
        {currentUser.mustChangePassword && (
          <ForcePasswordModal
            username={currentUser.username}
            onSuccess={handlePasswordChangeComplete}
          />
        )}

        {/* Role-based dashboard */}
        {currentUser.role === 'super_admin' && (
          <SuperAdminDashboard token={token} currentUser={currentUser} onLogout={handleLogout} />
        )}

        {currentUser.role === 'school_admin' && (
          <SchoolAdminDashboard user={currentUser} onLogout={handleLogout} />
        )}

        {currentUser.role === 'student' && (
          <StudentPortal token={token} user={currentUser} onLogout={handleLogout} />
        )}
      </div>
    );
  }

  // Login Screen
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
            {setupMode ? <Shield className="w-7 h-7" /> : <Sparkles className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {setupMode ? 'Production Setup: First Super Admin' : 'School Puzzle Assessment'}
          </h1>
          <p className="text-xs text-slate-400">
            {setupMode
              ? 'Database is completely clean with 0 users. Initialize your first Super Admin account.'
              : 'Sign in to access your Super Admin, School Admin, or Student Portal'}
          </p>
        </div>

        {setupMode && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Clean Database Mode: Creating the initial root Super Admin account.</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login / Initial Setup Form */}
        <form onSubmit={handleLoginOrSetup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {setupMode ? 'Super Admin Username' : 'Username / ID'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={setupMode ? 'e.g. admin' : 'Username / Admin ID / Student ID'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={setupMode ? 'Enter strong admin password' : 'Password'}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5 focus:outline-none focus:text-indigo-400 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || checkingSetup}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Processing...' : setupMode ? 'Initialize First Super Admin' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* MongoDB Compass Connection Notice & Verification */}
      <MongoCompassNotice />
    </div>
  );
}
