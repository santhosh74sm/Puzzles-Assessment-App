import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, 
  Moon, 
  Sun, 
  Monitor, 
  LogOut, 
  ChevronDown, 
  Check, 
  ShieldCheck, 
  School, 
  GraduationCap, 
  AlertTriangle 
} from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface ProfileMenuProps {
  user: any;
  onLogout: () => void;
  confirmMessage?: string;
  isAssessmentActive?: boolean;
}

export function ProfileMenu({ 
  user, 
  onLogout, 
  confirmMessage,
  isAssessmentActive = false 
}: ProfileMenuProps) {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    right: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Open cleanly below the button with an 8px gap
    const top = Math.round(rect.bottom + 8);
    // Align with the right of the button, keeping at least 12px from viewport edge
    const right = Math.max(12, Math.round(viewportWidth - rect.right));
    // Responsive width up to 320px, staying within available viewport width
    const width = Math.min(320, viewportWidth - 24);
    // Stay within the visible viewport vertically
    const maxHeight = Math.max(180, Math.round(viewportHeight - top - 16));

    setMenuCoords({ top, right, width, maxHeight });
  };

  // Keep menu position accurate during resize or scroll
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle Escape key to close menu or confirmation modal
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (showConfirmModal) {
          setShowConfirmModal(false);
        } else if (isOpen) {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showConfirmModal]);

  // Lock body scroll when logout confirmation modal is open
  useEffect(() => {
    if (showConfirmModal && typeof document !== 'undefined') {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [showConfirmModal]);

  const handleLogoutClick = () => {
    setIsOpen(false);
    setShowConfirmModal(true);
  };

  const handleConfirmLogout = () => {
    setShowConfirmModal(false);
    onLogout();
  };

  const role = user?.role || 'super_admin';
  const displayName = user?.name || user?.username || (role === 'super_admin' ? 'Super Admin' : 'Admin');

  const getRoleBadge = () => {
    if (role === 'super_admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Super Admin
        </span>
      );
    }
    if (role === 'school_admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
          <School className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          School Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
        <GraduationCap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        Student
      </span>
    );
  };

  return (
    <div className="relative inline-block text-left">
      {/* Profile Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User Profile and Settings Menu"
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 transition-all text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-sm">
          <span className="font-bold text-xs" style={{ color: '#ffffff' }}>
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight max-w-[120px] truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize font-medium">
            {role.replace('_', ' ')}
          </span>
        </div>
        <ChevronDown 
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu rendered via Portal into document.body */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="profile-menu-button"
          style={{
            position: 'fixed',
            top: menuCoords ? `${menuCoords.top}px` : undefined,
            right: menuCoords ? `${menuCoords.right}px` : undefined,
            width: menuCoords ? `${menuCoords.width}px` : undefined,
            maxHeight: menuCoords ? `${menuCoords.maxHeight}px` : undefined,
            zIndex: 9000,
          }}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 focus:outline-none"
        >
          {/* User Profile Information */}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md">
                  <span className="font-bold text-sm" style={{ color: '#ffffff' }}>
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{displayName}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate font-medium">
                    {user?.username || user?.uniqueStudentId || 'admin'}
                  </p>
                </div>
              </div>
              {getRoleBadge()}
            </div>

            {/* School / Class Details if available */}
            {(user?.schoolName || user?.className) && (
              <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2 border border-slate-200 dark:border-slate-800/80 space-y-0.5">
                {user?.schoolName && (
                  <div className="truncate">
                    <span className="text-slate-500 dark:text-slate-500">School: </span>
                    <span className="text-slate-800 dark:text-slate-300 font-semibold">{user.schoolName}</span>
                  </div>
                )}
                {user?.className && (
                  <div className="truncate">
                    <span className="text-slate-500 dark:text-slate-500">Grade / Class: </span>
                    <span className="text-slate-800 dark:text-slate-300 font-semibold">
                      Class {user.className} {user.section ? `(${user.section})` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Theme Selection */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-1">
              <span>Theme</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 lowercase font-normal capitalize">
                {theme === 'system' ? `System (${effectiveTheme})` : theme}
              </span>
            </div>

            {/* Exactly 3 Theme Options */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
              {/* 1. Dark */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-indigo-600 text-white shadow-md font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                }`}
                title="Dark"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
                {theme === 'dark' && <Check className="w-3 h-3 ml-0.5" />}
              </button>

              {/* 2. Light */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-indigo-600 text-white shadow-md font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                }`}
                title="Light"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
                {theme === 'light' && <Check className="w-3 h-3 ml-0.5" />}
              </button>

              {/* 3. System */}
              <button
                type="button"
                onClick={() => setTheme('system')}
                aria-pressed={theme === 'system'}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'bg-indigo-600 text-white shadow-md font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/50'
                }`}
                title="Match device setting"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>System</span>
                {theme === 'system' && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Logout Section */}
          <div className="p-2">
            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-rose-50/80 text-rose-600 border border-rose-300 hover:border-rose-400 dark:bg-transparent dark:hover:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Log Out</span>
              </div>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Sign out</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Viewport-level Logout Confirmation Modal rendered in document.body via Portal */}
      {showConfirmModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          aria-describedby="logout-dialog-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmModal(false);
          }}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-6 shadow-2xl transition-all my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center shrink-0">
                {isAssessmentActive ? (
                  <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                ) : (
                  <LogOut className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 id="logout-dialog-title" className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {isAssessmentActive ? 'Leave Test Early?' : 'Are you sure you want to log out?'}
                </h3>
                <p id="logout-dialog-desc" className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {confirmMessage || (
                    isAssessmentActive
                      ? 'You are taking a test right now. If you log out, your test will end immediately and you will not be able to restart or resume it.'
                      : 'You will be logged out and taken back to the sign-in page.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-rose-600/25 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
