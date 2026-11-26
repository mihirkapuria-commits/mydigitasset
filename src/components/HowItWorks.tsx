import React, { useEffect, useState } from 'react';
import { AdSenseSlot } from './AdSenseSlot';

type Step = { id: string; title: string; summary: string; body: string; display_order?: number; displayOrder?: number; adPlacements?: string[]; };

export const HowItWorks: React.FC = () => {
  const [steps, setSteps] = useState<Step[]>([]);
  useEffect(() => {
    let active = true;
    fetch('/api/site-content/how-it-works')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (active) setSteps(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setSteps([]); });
    return () => { active = false; };
  }, []);

  return (
    <section id="how-it-works" className="py-24 bg-slate-50/50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Simple Workflow</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">How MyDigitAsset Works</h3>
          <p className="text-base text-slate-600 leading-relaxed">A simple way to receive useful, curated industry news.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => {
            const placements = Array.isArray(item.adPlacements) ? item.adPlacements : ['top', 'inline', 'bottom', 'left', 'right'];
            const has = (position: string) => placements.includes(position);
            return <div key={item.id} className="grid grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)_180px] gap-4 items-start xl:col-span-2">
              <aside className="hidden xl:block">{has('left') && <AdSenseSlot placementKey="how-it-works-left" />}</aside>
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4 min-w-0">
                {has('top') && <AdSenseSlot placementKey="how-it-works-top" />}
                <span className="text-2xl font-black text-indigo-600 font-mono">{String(index + 1).padStart(2, '0')}</span>
                <h4 className="text-lg font-bold text-slate-900 tracking-tight">{item.title}</h4>
                {has('inline') && <AdSenseSlot placementKey="how-it-works-inline" />}
                <p className="text-sm text-slate-600 leading-relaxed">{item.body || item.summary}</p>
                {has('bottom') && <AdSenseSlot placementKey="how-it-works-bottom" />}
              </div>
              <aside className="hidden xl:block">{has('right') && <AdSenseSlot placementKey="how-it-works-right" />}</aside>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
};
