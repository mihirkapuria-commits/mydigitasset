import React, { useEffect, useState } from 'react';

type FAQ = { id: string; title: string; summary: string; body: string; };

export const FAQSection: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  useEffect(() => {
    let active = true;
    fetch('/api/site-content/faq')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (active) setFaqs(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setFaqs([]); });
    return () => { active = false; };
  }, []);

  return (
    <section id="faq" className="py-24 bg-white border-b border-slate-100">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Got Questions?</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Frequently Asked Questions</h3>
        </div>
        <div className="space-y-6">
          {faqs.map(faq => (
            <div key={faq.id} className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/80 space-y-2">
              <h4 className="text-lg font-bold text-slate-900">{faq.title}</h4>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{faq.body || faq.summary}</p>
            </div>
          ))}
          {!faqs.length && <p className="text-sm text-slate-500 text-center">No FAQs have been published yet.</p>}
        </div>
      </div>
    </section>
  );
};
