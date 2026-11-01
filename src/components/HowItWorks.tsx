import React from 'react';
import { UserPlus, Sliders, Send, CreditCard } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Register Your Account',
      description: 'Create your secure account with your name, email, and mobile number. No upfront payment required.'
    },
    {
      step: '02',
      title: 'Start 3-Day Free Trial',
      description: 'Enjoy immediate full access to all news categories for three calendar days without any credit card or payment authorization.'
    },
    {
      step: '03',
      title: 'Connect Telegram',
      description: 'Link your Telegram account securely using our single-use token connection flow to receive news directly.'
    },
    {
      step: '04',
      title: 'UPI Payment & Verification',
      description: 'Pay the total annual amount (₹297.36 incl. GST) via UPI, submit your UTR reference, and await manual admin verification.'
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-slate-50/50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Simple Workflow</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How MyDigitAsset Works
          </h3>
          <p className="text-base text-slate-600 leading-relaxed">
            Designed for busy founders, investors, and professionals who value time over endless news browsing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item) => (
            <div key={item.step} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <span className="text-2xl font-black text-indigo-600 font-mono">
                {item.step}
              </span>
              <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                {item.title}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
