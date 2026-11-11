import React, { useState } from 'react';
import { User, Category } from '../types';
import { ShieldCheck, Send, CreditCard, Clock, CheckCircle2, AlertCircle, Phone, Lock, Save, LogOut, Bell } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { TelegramConnectModal } from './TelegramConnectModal';

interface CustomerDashboardProps {
  currentUser: User;
  categories: Category[];
  token: string;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  currentUser,
  categories,
  token,
  onUpdateUser,
  onLogout
}) => {
  const [mobile, setMobile] = useState(currentUser.mobile || '+91');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.startsWith('+91')) {
      setMobile('+91');
      return;
    }
    const digits = val.slice(3).replace(/\D/g, '').slice(0, 10);
    setMobile('+91' + digits);
  };

  const handleUpdateMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    if (mobile.replace(/\D/g, '').length !== 12) {
      setProfileErr('Please enter a valid 10-digit mobile number after +91.');
      return;
    }
    setSavingProfile(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mobile })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update mobile number');
      onUpdateUser(data);
      setProfileMsg('Mobile number successfully updated.');
    } catch (err: any) {
      setProfileErr(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const trialStart = new Date(currentUser.trialStart || currentUser.createdAt || Date.now());
  const trialExpiryDate = new Date(currentUser.trialExpiry);
  const isTrialActive = new Date() < trialExpiryDate && currentUser.subscriptionStatus === 'trial';

  // First news arrives on trial start + 1 day at 10:00 AM IST
  const firstNewsDateObj = new Date(trialStart.getTime() + 24 * 60 * 60 * 1000);
  const firstNewsDateStr = firstNewsDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const expiryDateStr = trialExpiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const daysLeft = Math.max(0, Math.ceil((trialExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Header / Welcome */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3">
              Customer Account Dashboard
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {currentUser.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage your subscription, Telegram bot connection, and mobile profile settings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentUser.subscriptionStatus === 'active_paid' ? (
              <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Annual Subscription Active (Paid)
              </div>
            ) : isTrialActive ? (
              <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                3-Day Free Trial Active
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Trial Expired — Payment Required
              </div>
            )}
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-2.5 text-slate-500 hover:text-red-600 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trial & First News Info Banner */}
        {isTrialActive && (
          <div className="bg-indigo-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-2xl text-indigo-300 shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-white">Your News Schedule & Trial Status</h4>
                <p className="text-xs text-indigo-200">
                  • Your first news will arrive on {firstNewsDateStr} at 10:00 AM IST via Telegram
                </p>
                <p className="text-xs text-indigo-200">
                  • Your 3-day free trial ends on {expiryDateStr} — {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                </p>
              </div>
            </div>
            {!currentUser.telegramConnected && (
              <button
                onClick={() => setIsTelegramOpen(true)}
                className="px-5 py-2.5 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-colors shadow-sm shrink-0"
              >
                Connect Telegram Now
              </button>
            )}
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Trial & Subscription Status */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Subscription & Trial</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-slate-900 capitalize">{currentUser.subscriptionStatus.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Trial Expiry</span>
                <span className="font-mono text-xs text-slate-900">{new Date(currentUser.trialExpiry).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Payment Status</span>
                <span className="font-semibold text-slate-900 capitalize">{currentUser.paymentStatus}</span>
              </div>
            </div>

            {currentUser.subscriptionStatus !== 'active_paid' && (
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Pay Annual Subscription (₹297.36)
              </button>
            )}
          </div>

          {/* Telegram Connection Status */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Telegram Channel</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Connection</span>
                <span className={`font-semibold ${currentUser.telegramConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {currentUser.telegramConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Username</span>
                <span className="font-mono text-xs text-slate-900">{currentUser.telegramUsername || 'Not linked'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Bot Channel</span>
                <span className="font-mono text-xs text-indigo-600">@MyDigitAssetBot</span>
              </div>
            </div>

            <button
              onClick={() => setIsTelegramOpen(true)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {currentUser.telegramConnected ? 'Manage Telegram Bot' : 'Connect Telegram Account'}
            </button>
          </div>

          {/* Selected Category */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected News Category (1 Category)</h3>
            <div className="p-3 bg-indigo-50/60 rounded-xl text-xs font-semibold text-slate-900 border border-indigo-100">
              {(() => {
                const catId = currentUser.category || currentUser.categories?.[0];
                const catObj = categories.find(c => c.id === catId);
                return catObj ? catObj.title : catId || 'No category selected';
              })()}
            </div>
            <p className="text-xs text-slate-500 pt-1">
              Your ₹297.36 annual subscription covers daily Telegram news delivery for this category.
            </p>
          </div>
        </div>

        {/* Profile Settings (Mobile editable only, Name/Email/Country Code locked) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Account Profile & Security Rules</h3>
              <p className="text-xs text-slate-500">
                Only mobile number can be changed. Name, email address, and country code (+91) are locked.
              </p>
            </div>
            <Lock className="w-5 h-5 text-slate-400" />
          </div>

          {profileMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              {profileMsg}
            </div>
          )}

          {profileErr && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {profileErr}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Registered Name (Read-Only)
              </label>
              <input
                type="text"
                disabled
                value={currentUser.name}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Registered Email (Read-Only)
              </label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          <form onSubmit={handleUpdateMobile} className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Mobile Number (+91 Locked + 10 Digits Editable)
              </label>
              <div className="relative max-w-md">
                <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={handleMobileChange}
                  maxLength={13}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Only mobile number can be changed.</p>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving...' : 'Update Mobile Number'}
            </button>
          </form>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSubmitted={() => {
          window.location.reload();
        }}
        token={token}
      />

      <TelegramConnectModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
        token={token}
        onConnected={(updatedUser) => onUpdateUser(updatedUser)}
      />
    </div>
  );
};
