import React from 'react';
import { Tag, Megaphone, CheckCircle2, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

interface OffersSectionProps {
  onNavigateHome: () => void;
  onStartTrial: () => void;
}

export const OffersSection: React.FC<OffersSectionProps> = ({ onNavigateHome, onStartTrial }) => {
  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        {/* Header */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <Tag className="w-3.5 h-3.5" />
              Special Offers & Advertisements
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Promotions & Partner Deals</h1>
            <p className="text-sm text-slate-600">
              Exclusive offers for MyDigitAsset subscribers and advertising sponsorship opportunities for businesses.
            </p>
          </div>
          <button
            onClick={onNavigateHome}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            ← Back to Home
          </button>
        </div>

        {/* Featured Subscriber Offer */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-8 md:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Megaphone className="w-3.5 h-3.5" />
              Limited Period Offer
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">Annual Subscription Deal</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Get unlimited daily curated news delivery on 1 category via Telegram for an entire year at just <strong className="text-white font-mono">₹297.36</strong> (inclusive of 18% GST). Includes a 3-day free trial.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-indigo-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>3-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-indigo-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Manual UPI Verification</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-indigo-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Instant Telegram Delivery</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/15 text-center space-y-4 shrink-0 w-full md:w-80">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Annual All-Inclusive</div>
            <div className="text-4xl font-extrabold font-mono text-white">₹297.36</div>
            <p className="text-[11px] text-slate-300">₹252.00 base + ₹45.36 GST (18%)</p>
            <button
              onClick={onStartTrial}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors text-xs shadow-md"
            >
              Start Free Trial Now
            </button>
          </div>
        </div>

        {/* Advertisement & Sponsorship Info */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-slate-900">Advertise with MyDigitAsset</h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            Reach thousands of verified founders, startup investors, finance professionals, and real estate leaders in India. We offer premium banner placements, sponsored newsletter features, and targeted channel announcements.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Banner Ad Placement</h4>
              <p className="text-xs text-slate-600">High-visibility header and inline ad slots across our platform web pages.</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Sponsored Broadcasts</h4>
              <p className="text-xs text-slate-600">Featured mentions and promotional spotlights in our curated Telegram news delivery.</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Partner Collaborations</h4>
              <p className="text-xs text-slate-600">Co-branded industry reports and startup showcase features.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>For advertising & sponsorship inquiries, contact: <strong>tmkrealty@gmail.com</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
