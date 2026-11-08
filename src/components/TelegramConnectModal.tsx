import React, { useState, useEffect, useRef } from 'react';
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
  const [expired, setExpired] = useState(false);
  const [success, setSuccess] = useState(false);

  const pollIntervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setExpired(false);
      setSuccess(false);
      setError('');
      fetchVerificationToken();
    } else {
      cleanupTimers();
    }
    return () => {
      cleanupTimers();
    };
  }, [isOpen]);

  const cleanupTimers = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPolling(false);
  };

  const fetchVerificationToken = async () => {
    cleanupTimers();
    setError('');
    setExpired(false);
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
    if (pollIntervalRef.current) return;
    setPolling(true);

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/telegram/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.status === 401) {
          cleanupTimers();
          setError('Session expired. Please log in again.');
          return;
        }
        const data = await res.json();
        if (data.connected) {
          cleanupTimers();
          setSuccess(true);
          // Confirm connection & refresh profile
          const connectRes = await fetch('/api/telegram/connect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ verificationToken })
          });
          const connectData = await connectRes.json();
          if (connectRes.ok && connectData.user) {
            onConnected(connectData.user);
          } else {
            const meRes = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const meData = await meRes.json();
            if (meRes.ok) {
              onConnected(meData);
            }
          }
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } catch (e) {
        // Ignore temporary network errors during polling
      }
    }, 3000);

    // Timeout after 5 minutes (300,000 ms)
    timeoutRef.current = setTimeout(() => {
      cleanupTimers();
      setExpired(true);
      setError('Verification token has expired. Please generate a new code.');
    }, 300000);
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
          onClick={() => {
            cleanupTimers();
            onClose();
          }}
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

        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 text-sm font-semibold flex items-center gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Telegram account successfully verified and connected!</span>
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
          ) : expired ? (
            <div className="text-center py-3 space-y-2">
              <p className="text-xs text-red-600 font-semibold">Verification token expired.</p>
              <button
                type="button"
                onClick={fetchVerificationToken}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Generate New Code
              </button>
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

          {!expired && !success && (
            <div className="pt-2 flex items-center gap-3 text-xs text-slate-500 border-t border-slate-200/60">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span>Waiting for bot response via webhook...</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            cleanupTimers();
            onClose();
          }}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-xs"
        >
          Close & Return to Dashboard
        </button>
      </div>
    </div>
  );
};
