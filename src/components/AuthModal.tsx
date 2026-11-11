import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, ShieldCheck, Lock, Mail, Phone, User as UserIcon, AlertCircle } from 'lucide-react';
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
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('+91');
  const [selectedCategory, setSelectedCategory] = useState<string>('startups');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setSuccessMsg('');
      setPassword('');
      setConfirmPassword('');
      setMobile('+91');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.startsWith('+91')) {
      setMobile('+91');
      return;
    }
    const digits = val.slice(3).replace(/\D/g, '').slice(0, 10);
    setMobile('+91' + digits);
  };

  const isPasswordValid = password.length === 8;
  const isConfirmValid = confirmPassword.length === 8;
  const isPasswordMatch = password === confirmPassword;

  const getRegisterValidationError = () => {
    if (mode !== 'register') return '';
    if (password.length > 0 && !isPasswordValid) return 'Password must be exactly 8 characters';
    if (confirmPassword.length > 0 && !isConfirmValid) return 'Confirm password must be exactly 8 characters';
    if (password.length === 8 && confirmPassword.length === 8 && !isPasswordMatch) return 'Passwords do not match';
    if (mobile.replace(/\D/g, '').length !== 12) return 'Mobile number must be exactly 10 digits after +91';
    return '';
  };

  const registerError = getRegisterValidationError();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'register') {
      if (!isPasswordValid || !isConfirmValid || !isPasswordMatch) {
        setError('Password must be exactly 8 characters and match confirm password.');
        return;
      }
      if (mobile.replace(/\D/g, '').length !== 12) {
        setError('Please enter a valid 10-digit mobile number after +91.');
        return;
      }
    }

    setLoading(true);

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
          body: JSON.stringify({ name, email, mobile, password, category: selectedCategory })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        onSuccess(data.token, data.user);
        onClose();
      } else if (mode === 'recover') {
        const res = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, mobile, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Password recovery failed');
        setSuccessMsg(data.message);
        setTimeout(() => {
          setMode('login');
          setSuccessMsg('');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 pt-10 shadow-2xl relative border border-slate-100 my-8">
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

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mihir Kapuria"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Email Address
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
                Mobile Number (Fixed +91 Country Code + 10 Digits)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={handleMobileChange}
                  maxLength={13}
                  placeholder="+919876543210"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Country code +91 is locked. Enter 10 digits after +91.</p>
            </div>
          )}

          {mode !== 'recover' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Password (Exactly 8 Characters)
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
                {mode === 'register' && password.length > 0 && !isPasswordValid && (
                  <p className="text-[11px] text-red-600 font-semibold mt-0.5">Password must be exactly 8 characters</p>
                )}
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Confirm Password (Exactly 8 Characters)
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
                  <p className="text-[11px] text-slate-500 mt-1">Password must be exactly 8 characters</p>
                  {confirmPassword.length > 0 && !isConfirmValid && (
                    <p className="text-[11px] text-red-600 font-semibold mt-0.5">Password must be exactly 8 characters</p>
                  )}
                  {password.length === 8 && confirmPassword.length === 8 && !isPasswordMatch && (
                    <p className="text-[11px] text-red-600 font-semibold mt-0.5">Passwords do not match</p>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'recover' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                New Password (Exactly 8 Characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 characters"
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Password must be exactly 8 characters</p>
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
            disabled={loading || (mode === 'register' && (!isPasswordValid || !isConfirmValid || !isPasswordMatch || mobile.replace(/\D/g, '').length !== 12))}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm shadow-md mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs">
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
      </div>
    </div>
  );
};
