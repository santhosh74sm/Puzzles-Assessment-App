/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sparkles, Shield, User, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Sun, Moon, Monitor, CheckCircle2 } from 'lucide-react';
import { SuperAdminDashboard } from './components/SuperAdminDashboard.tsx';
import { SchoolAdminDashboard } from './components/SchoolAdminDashboard.tsx';
import { StudentPortal } from './components/StudentPortal.tsx';
import { ForcePasswordModal } from './components/ForcePasswordModal.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme, setTheme } = useTheme();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('puzzles_token'));
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('puzzles_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login & Setup form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginFormKey, setLoginFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Forgot Password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

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

  // Sync latest user profile on mount if token exists
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((fresh) => {
          if (fresh) {
            setCurrentUser(fresh);
            try {
              localStorage.setItem('puzzles_user', JSON.stringify(fresh));
            } catch (_) {}
          }
        })
        .catch((err) => console.error('Failed to sync current user profile:', err));
    }
  }, [token]);

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
        throw new Error(data.error || 'Username or password is incorrect.');
      }

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('puzzles_token', data.token);
      localStorage.setItem('puzzles_user', JSON.stringify(data.user));

      // Reset login form fields completely
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setError(null);
      setSuccessMsg(null);
      setLoginFormKey((k) => k + 1);
    } catch (err: any) {
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('authentication') ||
        msg.toLowerCase().includes('credential') ||
        msg.toLowerCase().includes('invalid username') ||
        msg.toLowerCase().includes('failed to fetch')
      ) {
        setError('Username or password is incorrect.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMessage(null);

    const trimmed = forgotUsername.trim();
    if (!trimmed) {
      setForgotError('Please enter your Username or Student ID');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit reset request.');
      }
      setForgotMessage(
        data.message ||
          'Please contact your Super Admin. The Super Admin will provide you with a temporary password. Use the temporary password to log in and create a new password.'
      );
    } catch (err: any) {
      setForgotError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
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

    // Fully reset and clear login form state after logout
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setError(null);
    setSuccessMsg(null);
    setLoginFormKey((k) => k + 1);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 relative">
      {/* Theme Switcher in Top Right of Login Page */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Dark"
          aria-label="Dark theme"
        >
          <Moon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Light"
          aria-label="Light theme"
        >
          <Sun className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            theme === 'system'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="System"
          aria-label="System theme"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">System</span>
        </button>
      </div>

      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
            {setupMode ? <Shield className="w-7 h-7" /> : <Sparkles className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {setupMode
              ? 'First-Time Setup: Create Admin'
              : showForgotPassword
              ? 'Forgot Password'
              : 'School Puzzle Tests'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {setupMode
              ? 'No accounts have been created yet. Please create the first administrator account to get started.'
              : showForgotPassword
              ? 'Enter your username or Student ID to request a password reset.'
              : 'Sign in to access your school tests and account.'}
          </p>
        </div>

        {setupMode && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>First-Time Setup: Create your administrator account to get started.</span>
          </div>
        )}

        {showForgotPassword ? (
          /* Forgot Password View */
          <div className="space-y-4">
            {forgotError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotMessage ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-left space-y-2">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span>Request Submitted</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {forgotMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotMessage(null);
                    setForgotError(null);
                  }}
                  className="w-full py-2.5 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm transition-all cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Username / Student ID
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="e.g. STU-10B-1574 or admin"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <span>{forgotLoading ? 'Submitting...' : 'Submit'}</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotError(null);
                      setForgotMessage(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* Normal Sign In Form */
          <>
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form key={loginFormKey} onSubmit={handleLoginOrSetup} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {setupMode ? 'Admin Username' : 'Username or ID'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={setupMode ? 'e.g. admin' : 'Username or ID'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={setupMode ? 'Choose a password' : 'Password'}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 focus:outline-none focus:text-indigo-500 cursor-pointer"
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

              {!setupMode && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotError(null);
                      setForgotMessage(null);
                      setForgotUsername('');
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || checkingSetup}
                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer login-submit-btn"
                style={{
                  backgroundImage: 'linear-gradient(to right, #4f46e5, #7c3aed)',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                }}
              >
                <span
                  className="login-submit-text text-white"
                  style={{ backgroundColor: 'transparent', color: '#ffffff' }}
                >
                  {loading ? 'Signing in...' : setupMode ? 'Create First Admin Account' : 'Sign In'}
                </span>
                <ArrowRight className="w-4 h-4 text-white" style={{ color: '#ffffff' }} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
