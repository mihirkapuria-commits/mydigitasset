import React from 'react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      q: 'How does the three-day free trial work?',
      a: 'Your trial begins immediately upon registration. You get full access to all categories for three calendar days without entering any payment details. You will be notified before trial expiry.'
    },
    {
      q: 'How are payments handled?',
      a: 'Payments are handled manually through UPI. Once you submit your UPI UTR / payment reference number, our administrator (mihirkapuria@gmail.com) verifies the transaction manually before activating your annual subscription.'
    },
    {
      q: 'How do I receive the news?',
      a: 'News is delivered directly through our Telegram news bot. Once you connect your Telegram account in your dashboard, curated updates for your selected categories arrive in your Telegram chat.'
    },
    {
      q: 'Is my phone number and personal data safe?',
      a: 'Yes. Privacy is a core principle. We will never sell your phone number or personal information to third parties. Data is protected with robust server-side security.'
    },
    {
      q: 'What is the password recovery policy?',
      a: 'In accordance with our accepted product policy, password recovery is handled without OTP, email, or SMS verification. You can reset your password by providing your registered email and mobile number combination.'
    }
  ];

  return (
    <section id="faq" className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Got Questions?</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/80 space-y-2">
              <h4 className="text-lg font-bold text-slate-900">{faq.q}</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
