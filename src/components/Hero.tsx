import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Send } from 'lucide-react';

interface HeroProps {
  onStartTrial: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartTrial }) => {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32 bg-gradient-to-b from-slate-50 via-white to-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline and CTA */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Curated Daily News for Students & Professionals via Telegram
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] text-balance">
              Stay Informed About What Matters to You.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
              Select <strong className="text-slate-900 font-semibold">one category</strong> and receive 10 curated daily updates every day directly through Telegram. Designed for students, founders, and anyone interested in staying updated. Start with a <strong className="text-slate-900 font-semibold">three-day free trial</strong> with no upfront payment.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button
                onClick={onStartTrial}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 group"
              >
                <span>Start 3-Day Free Trial</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                View Annual Pricing (₹297.36)
              </a>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Privacy by Design</h4>
                  <p className="text-xs text-slate-500">Never sell your data</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Telegram Delivery</h4>
                  <p className="text-xs text-slate-500">Direct & clutter-free</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">No Upfront Cost</h4>
                  <p className="text-xs text-slate-500">3-day calendar trial</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Service Preview Card */}
          <div className="lg:col-span-5">
            <div className="relative bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg">
                    TG
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">MyDigitAsset Bot</h3>
                    <p className="text-xs text-slate-400">Secure News Delivery Channel</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Operational
                </span>
              </div>

              <div className="py-6 space-y-4">
                <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">India Startups & Funding Update</span>
                    <span>10:00 AM IST</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    "Bengaluru-based SaaS enterprise secures $15M Series B funding led by Tier-1 venture firms..."
                  </p>
                </div>

                <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">India Banking & FinTech</span>
                    <span>10:01 AM IST</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    "RBI issues updated guidelines on digital lending verification standards for non-banking entities..."
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Annual Plan: ₹252 + GST (₹297.36)</span>
                <span className="font-semibold text-indigo-400">Manual UPI Verification</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
