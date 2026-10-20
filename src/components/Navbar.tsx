import React from 'react';
import { Shield, User as UserIcon, LogOut, LayoutDashboard, Settings } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  currentUser: User | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  currentView: string;
  onNavigate: (view: 'home' | 'dashboard' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  currentView,
  onNavigate
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-left group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-sm group-hover:bg-indigo-600 transition-colors">
            MA
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            MyDigitAsset
          </span>
        </button>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button onClick={() => onNavigate('home')} className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${currentView === 'home' ? 'text-slate-900 font-semibold' : ''}`}>
            Home
          </button>
          <a href="#categories" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Categories
          </a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Pricing
          </a>
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            How It Works
          </a>
          <a href="#faq" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            FAQ
          </a>
        </nav>

        {/* Zone 3: Primary action / Auth state */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.email === 'mihirkapuria@gmail.com' && (
                <button
                  onClick={() => onNavigate('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    currentView === 'admin' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Admin Portal
                </button>
              )}
              <button
                onClick={() => onNavigate('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  currentView === 'dashboard' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </button>
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
              >
                Start Free Trial
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
