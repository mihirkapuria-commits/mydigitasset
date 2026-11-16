<CodeBlock language="tsx" editable>
import React, { useState, useEffect } from 'react';
import { X, Copy, Check, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  token: string;
  userId: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
  token,
  userId
}) => {
  const [settings, setSettings] = useState<any>({});
  const [utr, setUtr] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

useEffect(() => {
    if (!isOpen) return;

setError('');
    setSuccess(false);
    setUtr('');

async function fetchSettings() {
      try {
        const response = await fetch('/api/settings');

if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          setError('Unable to load payment details. Please try again later.');
        }
      } catch (err) {
        setError('Unable to load payment details. Please try again later.');
      }
    }

fetchSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const upiId = settings.upiId || '';

const basePrice = Number(settings.annualBasePrice ?? 252);
  const gstRate = Number(settings.gstRate ?? 18);
  const gstAmount = Number((basePrice * gstRate / 100).toFixed(2));
  const totalAmount = Number((basePrice + gstAmount).toFixed(2));

const handleCopyUpi = async () => {
    if (!upiId) return;

try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy the UPI ID. Please copy it manually.');
    }
  };

const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUtr = utr.trim();

if (!cleanUtr) {
      setError('Please enter your UTR/reference number.');
      return;
    }

if (cleanUtr.length < 6 || cleanUtr.length > 100) {
      setError('Please enter a valid UTR/reference number.');
      return;
    }

if (!userId || !token) {
      setError('Your login session is missing. Please sign in again.');
      return;
    }

if (!upiId) {
      setError('Payment details have not been configured by the administrator.');
      return;
    }

    setLoading(true);

try {
const response = await fetch('/api/auth/submit-payment', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
Authorization: Bearer $DIL0
},
body: JSON.stringify({
userId,
utrNumber: cleanUtr
})
});

      const data = await response.json();

if (!response.ok) {
        throw new Error(data.error || 'Failed to submit payment reference.');
      }

setSuccess(true);
      setUtr('');

window.setTimeout(() => {
        onSubmitted();
        onClose();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit payment reference.'
      );
    } finally {
      setLoading(false);
    }
  };

return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative border border-slate-100 my-8">

<button
          onClick={onClose}
          title="Close window"
          className="absolute top-6 right-6 p-2.5 text-slate-500 hover:text-red-600 rounded-full bg-slate-100 hover:bg-red-50 transition-colors shadow-sm flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

<div className="space-y-2 mb-6">
          <h3 className="text-2xl font-extrabold text-slate-900">
            Annual Subscription Payment
          </h3>

<p className="text-sm text-slate-600">
            Make your payment using UPI and submit only the UTR/reference number.
            No screenshot, file or payment-proof upload is required.
          </p>
        </div>

<div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6 space-y-3">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Annual Subscription</span>
            <span className="font-mono font-semibold">
              ₹{basePrice.toFixed(2)}
            </span>
          </div>

<div className="flex justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
            <span>GST ({gstRate}%)</span>
            <span className="font-mono font-semibold">
              ₹{gstAmount.toFixed(2)}
            </span>
          </div>

<div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
            <span>Total Payable Amount</span>
            <span className="font-mono text-indigo-600">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

<div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 mb-6 space-y-4">
          {upiId ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Official UPI ID
                  </span>

<p className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                    {upiId}
                  </p>
                </div>

<button
                  type="button"
                  onClick={handleCopyUpi}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
                >
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                    : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy UPI'}
                </button>
              </div>

<div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-indigo-100">
                <p className="font-semibold text-slate-700">
                  Payment Instructions:
                </p>
                <p>1. Open your UPI app (GPay, PhonePe, Paytm or BHIM).</p>
                <p>2. Transfer exactly ₹{totalAmount.toFixed(2)}.</p>
                <p>3. Enter the UTR/reference number below.</p>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              The administrator has not configured UPI payment details yet.
              Payment submission is unavailable until those details are configured.
            </div>
          )}
        </div>

{error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 text-sm font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

{success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            Your UTR/reference number has been submitted successfully for administrator verification.
          </div>
        )}

<form onSubmit={handleSubmitUtr} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              UTR / Reference Number *
            </label>

<input
              type="text"
              required
              value={utr}
              onChange={e => setUtr(e.target.value)}
              placeholder="Enter your payment reference number"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-slate-900"
            />
          </div>

<button
            type="submit"
            disabled={loading || success || !upiId}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm shadow-md mt-4 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit UTR Reference'}
          </button>

<button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-xs mt-2"
          >
            Exit
          </button>
        </form>
      </div>
    </div>
  );
};
</CodeBlock>
