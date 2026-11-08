import React, { useState } from 'react';
import { Wrench, Calculator, DollarSign, Percent, ArrowRight, ShieldCheck, Check } from 'lucide-react';

interface UtilitiesSectionProps {
  onNavigateHome: () => void;
}

export const UtilitiesSection: React.FC<UtilitiesSectionProps> = ({ onNavigateHome }) => {
  // Calculator 1: GST & Subscription
  const [subAmount, setSubAmount] = useState<number>(252);
  const gstRate = 18;
  const calculatedGst = (subAmount * gstRate) / 100;
  const totalPayable = subAmount + calculatedGst;

  // Calculator 2: Compound Investment Growth
  const [principal, setPrincipal] = useState<number>(50000);
  const [rate, setRate] = useState<number>(12);
  const [years, setYears] = useState<number>(5);

  const futureValue = principal * Math.pow(1 + rate / 100, years);
  const totalInterest = futureValue - principal;

  // UPI QR String helper
  const [upiRef, setUprRef] = useState('UTR123456789012');
  const [copiedUpr, setCopiedUpr] = useState(false);

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        {/* Header */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <Wrench className="w-3.5 h-3.5" />
              Financial Utilities & Calculators
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Interactive Business Tools</h1>
            <p className="text-sm text-slate-600">
              Useful financial calculators, GST breakdown tools, and reference generators for founders and investors.
            </p>
          </div>
          <button
            onClick={onNavigateHome}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            ← Back to Home
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tool 1: GST & Subscription Calculator */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">GST & Subscription Calculator</h3>
                <p className="text-xs text-slate-500">Calculate base pricing and 18% GST for digital subscriptions.</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Base Amount (₹)
                </label>
                <input
                  type="number"
                  value={subAmount}
                  onChange={(e) => setSubAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Base Price</span>
                  <span className="font-mono font-semibold">₹{subAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
                  <span>GST ({gstRate}%)</span>
                  <span className="font-mono font-semibold">₹{calculatedGst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>Total Payable</span>
                  <span className="font-mono text-indigo-600">₹{totalPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tool 2: Compound Investment Calculator */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Compound Investment Growth</h3>
                <p className="text-xs text-slate-500">Project long-term asset and capital appreciation.</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Initial Principal (₹)
                  </label>
                  <input
                    type="number"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Annual Return (%)
                  </label>
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Time Period (Years): {years}
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Invested Principal</span>
                  <span className="font-mono font-semibold">₹{principal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 pb-2 border-b border-emerald-100">
                  <span>Estimated Returns</span>
                  <span className="font-mono font-semibold text-emerald-700">₹{Math.round(totalInterest).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>Future Value</span>
                  <span className="font-mono text-emerald-800">₹{Math.round(futureValue).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
