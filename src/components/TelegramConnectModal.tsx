import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Copy, RefreshCw } from 'lucide-react';

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
  const [verificationToken, setVerificationToken] = useState('');
  const [loadingToken, setLoadingToken] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchVerificationToken();
    }
  }, [isOpen]);

  const fetchVerificationToken = async () => {
    setError('');
    setLoadingToken(true);
    try {
      const res = await fetch('/api/telegram/request-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate verification token');
      setVerificationToken(data.verificationToken);
      startPolling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingToken(false);
    }
  };

  const startPolling = () => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telegram/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.connected) {
          clearInterval(interval);
          setPolling(false);
          // Fetch updated user profile
          const meRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const meData = await meRes.json();
          if (meRes.ok) {
            onConnected(meData);
          }
          onClose();
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(`/verify ${verificationToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative border border-slate-100 my-8">
        <button
          onClick={onClose}
          title="Close window"
          className="absolute top-6 right-6 p-2.5 text-slate-500 hover:text-red-600 rounded-full bg-slate-100 hover:bg-red-50 transition-colors shadow-sm flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            <Send className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900">Connect Telegram Bot</h3>
          <p className="text-sm text-slate-600">
            Receive your curated India business news updates securely via Telegram bot verification.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 text-sm font-semibold flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 mb-6 space-y-4">
          <p className="font-semibold text-xs uppercase tracking-wider text-slate-700">Genuine Verification Steps:</p>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
            <li>Open Telegram and search for <strong className="text-indigo-600">@MyDigitAssetBot</strong>.</li>
            <li>Send the following single-use verification command to the bot:</li>
          </ol>

          {loadingToken ? (
            <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              Generating secure verification token...
            </div>
          ) : (
            <div className="bg-white p-3 rounded-xl border border-indigo-200 flex items-center justify-between gap-2 shadow-inner">
              <code className="text-xs font-mono font-bold text-indigo-700 select-all overflow-x-auto">
                /verify {verificationToken}
              </code>
              <button
                type="button"
                onClick={copyCommand}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3 text-xs text-slate-500 border-t border-slate-200/60">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>Waiting for genuine bot verification... (listening via webhook)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-xs"
        >
          Close & Return to Dashboard
        </button>
      </div>
    </div>
  );
};
