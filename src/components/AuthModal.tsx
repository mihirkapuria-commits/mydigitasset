import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Lock, Mail, User as UserIcon, AlertCircle, Send } from 'lucide-react';
import { Category } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register' | 'recover';
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
  categories: Category[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
  categories
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('startup');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{ user: any; telegramLink: string; expiryText: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setSuccessData(null);
      setPassword('');
      setConfirmPassword('');
      setMobileNumber('');
      setFirstName('');
      setSurname('');
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0].id);
      }
    }
  }, [isOpen, initialMode, categories]);

  if (!isOpen) return null;

  const isPasswordValid = password.length === 8;
  const isConfirmValid = confirmPassword.length === 8;
  const isPasswordMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessData(null);

    if (mode === 'register') {
      if (!isPasswordValid) {
        setError('Password must be exactly 8 characters.');
        return;
      }
      if (!isConfirmValid || !isPasswordMatch) {
        setError('Passwords do not match or are not 8 characters.');
        return;
      }
      if (mobileNumber.replace(/\D/g, '').length !== 10) {
        setError('Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    setLoading(true);
    const fullMobile = countryCode + mobileNumber;
    const fullName = `${firstName.trim()} ${surname.trim()}`;

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        onSuccess(data.token, data.user);
        onClose();
      } else if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            surname,
            name: fullName,
            email,
            countryCode,
            mobileNumber,
            mobile: fullMobile,
            password,
            category: selectedCategory
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        // Calculate exact 3-day IST expiration date
        const now = new Date();
        const expiryMs = now.getTime() + 3 * 24 * 60 * 60 * 1000;
        const expiryDate = new Date(expiryMs);
        const formattedExpiry = new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Kolkata'
        }).format(expiryDate);

        // Safe Telegram link generation without phone number mapping issues
        const matchedCategoryObj = categories.find(c => c.id === selectedCategory);
        const telegramLink = matchedCategoryObj?.telegramChatId ? `https://t.me/` : 'https://t.me/';

        setSuccessData({
          user: data.user,
          telegramLink,
          expiryText: formattedExpiry
        });
      } else if (mode === 'recover') {
        if (newPassword.length !== 8) {
          setError('Password must be exactly 8 characters.');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setError('Passwords do not match.');
          return;
        }
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Password reset failed');
        setError('');
        setTimeout(() => {
          setMode('login');
          setEmail('');
          setNewPassword('');
          setConfirmNewPassword('');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (mode !== 'register' || successData) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 py-10 max-h-[90vh] overflow-y-auto shadow-2xl relative border border-slate-100 my-8">
        <button
          onClick={onClose}
          title="Close window"
          className="absolute top-6 right-6 p-2.5 text-slate-500 hover:text-red-600 rounded-full bg-slate-100 hover:bg-red-50 transition-colors shadow-sm flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6 pt-2">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-md">
            MA
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900">
            {mode === 'login' ? 'Sign In to MyDigitAsset' : mode === 'register' ? 'Start Your 3-Day Free Trial' : 'Password Recovery'}
          </h3>
          <p className="text-sm text-slate-600">
            {mode === 'login'
              ? 'Access your curated news subscription and Telegram settings.'
              : mode === 'register'
              ? 'Select 1 news category to receive daily updates on Telegram (₹297.36/yr incl. GST).'
              : 'Recover access using your registered email and mobile number.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 text-sm font-semibold flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successData ? (
          <div className="space-y-6 py-4">
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <Send className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-emerald-900">Trial Activated Successfully!</h4>
              <div className="bg-white p-4 rounded-xl text-left space-y-2 text-xs text-slate-700 shadow-sm border border-emerald-100">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">User ID (Serial No):</span>
                  {/* Clean User ID without # symbol */}
                  <span className="font-mono font-bold text-slate-900">{successData.user?.id || '1'}</span>[cite: 1]
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Registered Email:</span>
                  <span className="font-medium text-slate-900">{email}</span>[cite: 1]
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Trial Expires On:</span>
                  <span className="font-semibold text-emerald-700">{successData.expiryText}</span>[cite: 1]
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={successData.telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition-colors text-sm shadow-lg flex items-center justify-center gap-3"
              >
                <Send className="w-5 h-5" />
                Click Here to Join Telegram News Channel[cite: 1]
              </a>
              <button
                onClick={() => {
                  onSuccess('dummy_token_' + successData.user?.id, successData.user);
                  onClose();
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-xs"
              >
                Go to Dashboard / Continue
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    First Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Mihir"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Surname *
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder="Kapuria"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {(mode === 'register' || mode === 'recover') && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Mobile Number *
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900 font-mono"
                  >
                    <option value="+91">+91 (India)</option>
                    <option value="+1">+1 (USA/Canada)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+61">+61 (Australia)</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    placeholder="9876543210"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900 font-mono"
                  />
                </div>
              </div>
            )}

            {mode !== 'recover' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      maxLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 characters"
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Password must be exactly 8 characters</p>
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        maxLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'recover' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Registered Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      maxLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="8 characters"
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      required
                      maxLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Select Exactly ONE News Category (Subscription covers 1 category) *
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors text-xs">
                      <input
                        type="radio"
                        name="news_category"
                        value={cat.id}
                        checked={selectedCategory === cat.id}
                        onChange={() => setSelectedCategory(cat.id)}
                        className="border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900">{cat.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm shadow-md mt-4 disabled:opacity-50"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Start Free Trial' : 'Reset Password'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-xs mt-2"
            >
              Exit
            </button>
          </form>
        )}

        {!successData && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs pb-2">
            {mode === 'login' ? (
              <button
                onClick={() => setMode('recover')}
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Forgot Password?
              </button>
            ) : mode === 'register' ? (
              <span className="text-slate-500">
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="text-indigo-600 font-semibold hover:underline">
                  Sign In
                </button>
              </span>
            ) : (
              <button
                onClick={() => setMode('login')}
                className="text-indigo-600 font-semibold hover:underline"
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
