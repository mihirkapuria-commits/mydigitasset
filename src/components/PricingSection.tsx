import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

interface PricingSectionProps { onStartTrial: () => void; }
type Pricing = { monthlyPrice: number; annualBasePrice: number; gstRate: number; gstAmount: number; totalAmount: number; };

export const PricingSection: React.FC<PricingSectionProps> = ({ onStartTrial }) => {
  const [pricing, setPricing] = useState<Pricing>({
    monthlyPrice: 21, annualBasePrice: 252, gstRate: 18, gstAmount: 45.36, totalAmount: 297.36
  });
  useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (active && data && Number.isFinite(Number(data.totalAmount))) setPricing(data);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <section id="pricing" className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Transparent Pricing</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Simple Annual Subscription with No Hidden Fees</h3>
          <p className="text-base text-slate-600 leading-relaxed">Start with a 3-day calendar free trial. No upfront payment required until trial completion.</p>
        </div>
        <div className="max-w-xl mx-auto bg-slate-950 rounded-3xl p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div><span className="text-xs font-bold tracking-widest uppercase text-indigo-400">Annual News Subscription</span><h4 className="text-2xl font-extrabold text-white mt-1">1 Selected Category Plan</h4></div>
            <div className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">3-Day Free Trial</div>
          </div>
          <div className="py-8 space-y-6">
            <div className="space-y-3 bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
              <div className="flex justify-between text-sm text-slate-300"><span>Monthly category price</span><span className="font-mono">₹{pricing.monthlyPrice.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-slate-300"><span>Annual base price (12 months)</span><span className="font-mono">₹{pricing.annualBasePrice.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-slate-400 pb-3 border-b border-slate-800"><span>GST ({pricing.gstRate}% applicable tax)</span><span className="font-mono">₹{pricing.gstAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold text-white pt-1"><span>Total Annual Price</span><span className="font-mono text-indigo-400">₹{pricing.totalAmount.toFixed(2)}</span></div>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /><span>Daily curated news updates delivered on Telegram in the selected category</span></div>
              <div className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /><span>Useful industry information for students, investment/business learners, founders, investors, and business professionals</span></div>
              <div className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /><span>Secure manual UPI payment verification</span></div>
              <div className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /><span>Customer personal information is not sold to third parties</span></div>
            </div>
          </div>
          <div className="space-y-4">
            <button onClick={onStartTrial} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg text-center block">Start Free Trial Now</button>
            <p className="text-center text-xs text-slate-400">No credit card required upfront. Manual UPI payment required after trial.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
