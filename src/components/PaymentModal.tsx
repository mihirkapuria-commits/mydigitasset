import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, QrCode } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  token: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSubmitted, token }) => {
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const upiId = 'mydigitalasset@upi';

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ utr, notes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit UTR');
      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative border border-slate-100 my-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <h3 className="text-2xl font-extrabold text-slate-900">Annual Subscription Payment</h3>
          <p className="text-sm text-slate-600">
            Pay via UPI and submit your UTR / transaction reference for manual verification.
          </p>
        </div>

        {/* Pricing breakdown box */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 mb-6 space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Base Annual Subscription</span>
            <span className="font-mono font-semibold">₹252.00</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
            <span>GST (18% Applicable Tax)</span>
            <span className="font-mono font-semibold">₹45.36</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
            <span>Total Payable Amount</span>
            <span className="font-mono text-indigo-600">₹297.36</span>
          </div>
        </div>

        {/* UPI Details Box */}
        <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Official UPI ID</span>
              <p className="text-lg font-mono font-bold text-slate-900 mt-0.5">{upiId}</p>
            </div>
            <button
              onClick={handleCopyUpi}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy UPI'}
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-indigo-100">
            <p className="font-semibold text-slate-700">Payment Instructions:</p>
            <p>1. Open your UPI app (GPay, PhonePe, Paytm, BHIM).</p>
            <p>2. Transfer exact amount: <strong>₹297.36</strong> to <strong>{upiId}</strong>.</p>
            <p>3. Copy the 12-digit UPI Transaction Reference (UTR) and submit below.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            Payment UTR submitted successfully! Awaiting manual administrator verification.
          </div>
        )}

        <form onSubmit={handleSubmitUtr} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              UPI UTR / Transaction Reference Number *
            </label>
            <input
              type="text"
              required
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 423567890123"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Payment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via PhonePe from 9876543210"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm shadow-md mt-4 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit UTR for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
};
