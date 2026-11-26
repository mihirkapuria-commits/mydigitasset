import React, { useEffect, useState } from 'react';
import { AdSenseSlot } from './AdSenseSlot';

type FAQ = { id: string; title: string; summary: string; body: string; adPlacements?: string[]; };

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
          {faqs.map(faq => {
            const placements = Array.isArray(faq.adPlacements) ? faq.adPlacements : ['top', 'inline', 'bottom', 'left', 'right'];
            const has = (position: string) => placements.includes(position);
            return <div key={faq.id} className="grid grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)_180px] gap-4 items-start">
              <aside className="hidden xl:block">{has('left') && <AdSenseSlot placementKey="faq-left" />}</aside>
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/80 space-y-2 min-w-0">
                {has('top') && <AdSenseSlot placementKey="faq-top" />}
                <h4 className="text-lg font-bold text-slate-900">{faq.title}</h4>
                {has('inline') && <AdSenseSlot placementKey="faq-inline" />}
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{faq.body || faq.summary}</p>
                {has('bottom') && <AdSenseSlot placementKey="faq-bottom" />}
              </div>
              <aside className="hidden xl:block">{has('right') && <AdSenseSlot placementKey="faq-right" />}</aside>
            </div>;
          })}
          {!faqs.length && <p className="text-sm text-slate-500 text-center">No FAQs have been published yet.</p>}
        </div>
      </div>
    </section>
  );
};
