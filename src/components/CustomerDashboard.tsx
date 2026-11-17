
import React, { useState } from 'react';
import { User, Category } from '../types';
import {
  Send,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Lock,
  Save,
  LogOut,
  Bell
} from 'lucide-react';
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
  const [mobileNumber, setMobileNumber] = useState(
    currentUser.mobileNumber ||
    (currentUser.mobile
      ? currentUser.mobile.replace(/^\+91/, '')
      : '')
  );

  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  const handleUpdateMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');

    const cleanMobile = mobileNumber.replace(/\D/g, '');

    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setProfileErr(
        'Please enter a valid 10-digit Indian mobile number.'
      );
      return;
    }

    setSavingProfile(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mobileNumber: cleanMobile
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to update mobile number.'
        );
      }

      const updatedUser = data.user || data;
      onUpdateUser(updatedUser);

      setMobileNumber(
        updatedUser.mobileNumber || cleanMobile
      );

      setProfileMsg(
        'Mobile number successfully updated.'
      );
    } catch (err) {
      setProfileErr(
        err instanceof Error
          ? err.message
          : 'Something went wrong.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const trialStart = new Date(
    currentUser.trialStart ||
    currentUser.createdAt ||
    Date.now()
  );

  const trialExpiryDate = new Date(
    currentUser.trialExpiry ||
    currentUser.trialExpiresAt ||
    Date.now() + 3 * 24 * 60 * 60 * 1000
  );

  const isTrialActive =
    new Date() < trialExpiryDate &&
    currentUser.subscriptionStatus === 'trial';

  const firstNewsDateObj = new Date(
    trialStart.getTime() + 24 * 60 * 60 * 1000
  );

  const firstNewsDateStr =
    firstNewsDateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

  const expiryDateStr =
    trialExpiryDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

  const formattedExpiryDayDate =
    new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    }).format(trialExpiryDate);

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (trialExpiryDate.getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
    )
  );

  const firstNameVal =
    currentUser.firstName ||
    currentUser.name?.split(' ')[0] ||
    '';

  const surnameVal =
    currentUser.surname ||
    currentUser.name?.split(' ').slice(1).join(' ') ||
    '';

  const selectedCatObj = categories.find(
    c =>
      c.id ===
      (currentUser.category ||
        currentUser.categories?.[0])
  );

  const categoryTitle = selectedCatObj
    ? selectedCatObj.title
    : currentUser.category || 'No category selected';

  let chatIdStr =
    selectedCatObj?.telegramChatId || '';

  if (chatIdStr.startsWith('-100')) {
    chatIdStr = chatIdStr.replace('-100', '');
  }

  const categoryTelegramLink = chatIdStr
    ? `https://t.me/c/${chatIdStr}/1`
    : 'https://t.me/';

  const displayName =
    `${firstNameVal} ${surnameVal}`.trim() ||
    (currentUser.name &&
    !currentUser.name.includes('@')
      ? currentUser.name
      : 'Customer');

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-8">

        {/* Header and Welcome */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3">
              Customer Account Dashboard
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {displayName}
            </h1>

            <p className="text-sm text-slate-600 mt-1">
              Manage your subscription, Telegram connection and mobile number.
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

        {/* Telegram Access Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-8 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold">
              Subscriber Access & Telegram Channel
            </div>

            <h3 className="text-2xl font-extrabold text-white">
              User ID:{' '}
              <span className="font-mono text-indigo-400">
                {currentUser.id}
              </span>
            </h3>

            <p className="text-sm text-slate-300 max-w-xl">
              Category:{' '}
              <span className="font-semibold text-white">
                {categoryTitle}
              </span>.
              Use the button to access your category Telegram news channel.
            </p>
          </div>

          <a
            href={categoryTelegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center gap-3 text-sm shrink-0"
          >
            <Send className="w-5 h-5" />
            Join Telegram Channel
          </a>
        </div>

        {/* Trial Information */}
        {isTrialActive && (
          <div className="bg-indigo-900 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-2xl text-indigo-300 shrink-0">
                <Bell className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-base text-white">
                  Your News Schedule & Trial Status
                </h4>

                <p className="text-xs text-indigo-200">
                  • Your first news is scheduled for {firstNewsDateStr} at 6:15 AM IST.
                </p>

                <p className="text-xs text-indigo-200">
                  • Your 3-day free trial ends on {formattedExpiryDayDate}
                  ({daysLeft} {daysLeft === 1 ? 'day' : 'days'} left).
                </p>
              </div>
            </div>

            {!currentUser.telegramConnected && (
              <a
                href={categoryTelegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-colors shadow-sm shrink-0"
              >
                Connect Telegram Now
              </a>
            )}
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Subscription */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Subscription & Trial
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-slate-900 capitalize">
                  {currentUser.subscriptionStatus?.replace('_', ' ') || 'Trial'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Trial Expiry</span>
                <span className="font-mono text-xs text-slate-900">
                  {expiryDateStr}
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-slate-500">Payment Status</span>
                <span className="font-semibold text-slate-900 capitalize">
                  {currentUser.paymentStatus || 'None'}
                </span>
              </div>
            </div>

            {currentUser.subscriptionStatus !== 'active_paid' && (
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Submit Annual Subscription Payment
              </button>
            )}
          </div>

          {/* Telegram */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Telegram Bot
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Connection</span>
                <span
                  className={`font-semibold ${
                    currentUser.telegramConnected
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {currentUser.telegramConnected
                    ? 'Connected'
                    : 'Disconnected'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Username</span>
                <span className="font-mono text-xs text-slate-900">
                  {currentUser.telegramUsername || 'Not linked'}
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-slate-500">Bot Channel</span>
                <span className="font-mono text-xs text-indigo-600">
                  @MyDigitAssetBot
                </span>
              </div>
            </div>

            <a
              href={categoryTelegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Connect Telegram Account
            </a>

            <button
              type="button"
              onClick={() => setIsTelegramOpen(true)}
              className="w-full text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
            >
              Manage Telegram Bot Verification
            </button>
          </div>

          {/* Category */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Selected News Category (1 Category)
            </h3>

            <div className="p-3 bg-indigo-50/60 rounded-xl text-xs font-semibold text-slate-900 border border-indigo-100">
              {categoryTitle}
            </div>

            <p className="text-xs text-slate-500 pt-1">
              Your annual subscription covers daily Telegram news delivery for this category.
            </p>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Account Profile & Security Rules
              </h3>

              <p className="text-xs text-slate-500">
                Only your mobile number can be changed. Country code is fixed at +91. Other account details are read-only.
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
                First Name (Read-Only)
              </label>
              <input
                type="text"
                disabled
                value={firstNameVal}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Surname (Read-Only)
              </label>
              <input
                type="text"
                disabled
                value={surnameVal}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Email Address (Read-Only)
              </label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Selected News Category (Read-Only)
              </label>
              <input
                type="text"
                disabled
                value={categoryTitle}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                3-Day Trial Expiration (Read-Only)
              </label>
              <input
                type="text"
                disabled
                value={formattedExpiryDayDate}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 cursor-not-allowed font-mono"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <form
            onSubmit={handleUpdateMobile}
            className="space-y-4 pt-6 border-t border-slate-100"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Mobile Phone Number (Only Editable Field)
              </label>

              <div className="flex gap-2 max-w-md">
                <div className="flex items-center px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono font-semibold text-slate-700">
                  +91
                </div>

                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />

                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={e =>
                      setMobileNumber(
                        e.target.value.replace(/\D/g, '').slice(0, 10)
                      )
                    }
                    maxLength={10}
                    placeholder="9876543210"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900 font-mono"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-1">
                Country code +91 cannot be changed. Enter your 10-digit Indian mobile number.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingProfile
                ? 'Saving...'
                : 'Update Mobile Number'}
            </button>
          </form>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSubmitted={() => window.location.reload()}
        token={token}
        userId={Number(currentUser.id)}
      />

      {/* Telegram Connection Modal */}
      <TelegramConnectModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
        token={token}
        onConnected={updatedUser =>
          onUpdateUser(updatedUser)
        }
      />
    </div>
  );
};
