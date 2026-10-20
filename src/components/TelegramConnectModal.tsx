import React, { useState } from 'react';
import { X, Send, CheckCircle2 } from 'lucide-react';

interface TelegramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (updatedUser: any) => void;
  token: string;
}

export const TelegramConnectModal: React.FC<TelegramConnectModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  token
}) => {
  const [telegramUsername, setTelegramUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ telegramUsername })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Telegram');
      onConnected(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative border border-slate-100 my-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            <Send className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900">Connect Telegram Bot</h3>
          <p className="text-sm text-slate-600">
            Receive your curated India business news updates directly in Telegram.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-6 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-900">Connection Instructions:</p>
          <p>1. Open Telegram and search for <strong className="text-indigo-600">@MyDigitAssetBot</strong>.</p>
          <p>2. Send the command <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">/start</code> to the bot.</p>
          <p>3. Enter your Telegram handle or username below to complete authorization.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Telegram Username / Handle *
            </label>
            <input
              type="text"
              required
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@your_telegram_handle"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-md mt-4 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Verify & Link Telegram Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
