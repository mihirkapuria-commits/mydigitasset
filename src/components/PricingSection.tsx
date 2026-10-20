import React from 'react';
import { Check, ShieldCheck, Zap } from 'lucide-react';

interface PricingSectionProps {
  onStartTrial: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onStartTrial }) => {
  return (
    <section id="pricing" className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Transparent Pricing</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Simple Annual Subscription with No Hidden Fees
          </h3>
          <p className="text-base text-slate-600 leading-relaxed">
            Start with a 3-day calendar free trial. No upfront payment required until trial completion.
          </p>
        </div>

        <div className="max-w-xl mx-auto bg-slate-950 rounded-3xl p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold tracking-widest uppercase text-indigo-400">Annual Professional Plan</span>
              <h4 className="text-2xl font-extrabold text-white mt-1">Full Category Access</h4>
            </div>
            <div className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              3-Day Free Trial
            </div>
          </div>

          <div className="py-8 space-y-6">
            <div className="space-y-3 bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Base Annual Subscription</span>
                <span className="font-mono font-semibold">₹252.00</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400 pb-3 border-b border-slate-800">
                <span>GST (18% Applicable Tax)</span>
                <span className="font-mono font-semibold">₹45.36</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white pt-1">
                <span>Total Annual Price</span>
                <span className="font-mono text-indigo-400">₹297.36</span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Access to all 10 India business and industry categories</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Direct daily news delivery through Telegram</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Secure manual UPI payment verification (UTR submission)</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Strict privacy guarantee: phone numbers are never sold</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={onStartTrial}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20 text-center block"
            >
              Start Free Trial Now
            </button>
            <p className="text-center text-xs text-slate-400">
              No credit card required upfront. Manual UPI payment required after trial.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
