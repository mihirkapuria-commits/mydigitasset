import React, { useState, useEffect } from 'react';
import { Wrench, Calculator, Percent } from 'lucide-react';
import { AdSenseSlot } from './AdSenseSlot';

interface UtilitiesSectionProps { onNavigateHome: () => void; }
type Tool = { id: string; title: string; description: string; targetUrl: string; iconName?: string; };
type UtilityItem = { id: string; title: string; summary: string; body: string; imageUrl?: string; targetUrl?: string; adPlacements?: string[]; };

export const UtilitiesSection: React.FC<UtilitiesSectionProps> = ({ onNavigateHome }) => {
  const [subAmount, setSubAmount] = useState<number>(252);
  const gstRate = 18;
  const calculatedGst = (subAmount * gstRate) / 100;
  const totalPayable = subAmount + calculatedGst;
  const [principal, setPrincipal] = useState<number>(50000);
  const [rate, setRate] = useState<number>(12);
  const [years, setYears] = useState<number>(5);
  const futureValue = principal * Math.pow(1 + rate / 100, years);
  const totalInterest = futureValue - principal;
  const [tools, setTools] = useState<Tool[]>([]);
  const [utilityItems, setUtilityItems] = useState<UtilityItem[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/tools')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (active) setTools(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setTools([]); });
    fetch('/api/site-content/utilities')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (active) setUtilityItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setUtilityItems([]); });
    return () => { active = false; };
  }, []);

  const gstTool = tools.find(tool => tool.iconName === 'gst-calculator');
  const compoundTool = tools.find(tool => tool.iconName === 'compound-calculator');
  const linkTools = tools.filter(tool => tool.iconName !== 'gst-calculator' && tool.iconName !== 'compound-calculator');

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-10">
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"><Wrench className="w-3.5 h-3.5" /> Financial Utilities & Calculators</div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Interactive Business Tools</h1>
            <p className="text-sm text-slate-600">Useful financial calculators and reference tools for students, investment/business learners, founders, investors, and business professionals.</p>
          </div>
          <button onClick={onNavigateHome} className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl">← Back to Home</button>
        </div>
        <AdSenseSlot placementKey="tools-top" />

        {utilityItems.length > 0 && <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Useful resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {utilityItems.map(item => {
              const placements = Array.isArray(item.adPlacements) ? item.adPlacements : ['top', 'inline', 'bottom', 'left', 'right'];
              const has = (position: string) => placements.includes(position);
              return <div key={item.id} className="grid grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)_180px] gap-4 items-start">
                <aside className="hidden xl:block">{has('left') && <AdSenseSlot placementKey="utilities-left" />}</aside>
                <article className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm min-w-0">
                  {has('top') && <AdSenseSlot placementKey="utilities-top" />}
                  <h3 className="font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-600 mt-2">{item.summary}</p>
                  {has('inline') && <AdSenseSlot placementKey="utilities-inline" />}
                  {item.body && <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{item.body}</p>}
                  {item.targetUrl && <a href={item.targetUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-xs font-semibold text-indigo-700">Open resource →</a>}
                  {has('bottom') && <AdSenseSlot placementKey="utilities-bottom" />}
                </article>
                <aside className="hidden xl:block">{has('right') && <AdSenseSlot placementKey="utilities-right" />}</aside>
              </div>;
            })}
          </div>
        </section>}

        {linkTools.length > 0 && <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">More tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {linkTools.map(tool => <a key={tool.id} href={tool.targetUrl || '#'} target={tool.targetUrl ? '_blank' : undefined} rel="noopener noreferrer" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-indigo-300">
              <h3 className="font-bold text-slate-900">{tool.title}</h3><p className="text-xs text-slate-600 mt-2">{tool.description}</p>
              {tool.targetUrl && <span className="inline-block mt-4 text-xs font-semibold text-indigo-700">Open tool →</span>}
            </a>)}
          </div>
        </section>}

        <AdSenseSlot placementKey="tools-inline" />

        {(gstTool || compoundTool) && <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {gstTool && <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Calculator className="w-5 h-5" /></div><div><h3 className="text-lg font-bold text-slate-900">{gstTool.title}</h3><p className="text-xs text-slate-500">{gstTool.description}</p></div></div>
            <label className="block text-xs font-semibold text-slate-600">Base Amount (₹)<input type="number" value={subAmount} onChange={e => setSubAmount(Number(e.target.value))} className="mt-1 w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-mono" /></label>
            <div className="p-5 bg-slate-50 rounded-2xl border space-y-3"><div className="flex justify-between text-xs"><span>Base Price</span><span>₹{subAmount.toFixed(2)}</span></div><div className="flex justify-between text-xs"><span>GST ({gstRate}%)</span><span>₹{calculatedGst.toFixed(2)}</span></div><div className="flex justify-between text-sm font-bold border-t pt-3"><span>Total Payable</span><span className="text-indigo-600">₹{totalPayable.toFixed(2)}</span></div></div>
          </div>}
          {compoundTool && <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Percent className="w-5 h-5" /></div><div><h3 className="text-lg font-bold text-slate-900">{compoundTool.title}</h3><p className="text-xs text-slate-500">{compoundTool.description}</p></div></div>
            <div className="grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Principal (₹)<input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border rounded-lg" /></label><label className="text-xs font-semibold">Annual Return (%)<input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border rounded-lg" /></label></div>
            <label className="block text-xs font-semibold">Time Period (Years): {years}<input type="range" min="1" max="30" value={years} onChange={e => setYears(Number(e.target.value))} className="w-full accent-indigo-600" /></label>
            <div className="p-5 bg-emerald-50/50 rounded-2xl border space-y-3"><div className="flex justify-between text-xs"><span>Invested Principal</span><span>₹{principal.toLocaleString()}</span></div><div className="flex justify-between text-xs"><span>Estimated Returns</span><span>₹{Math.round(totalInterest).toLocaleString()}</span></div><div className="flex justify-between text-sm font-bold border-t pt-3"><span>Future Value</span><span>₹{Math.round(futureValue).toLocaleString()}</span></div></div>
          </div>}
        </div>}
        {!tools.length && <p className="bg-white border rounded-2xl p-6 text-sm text-slate-500">No tools are currently published.</p>}
        <AdSenseSlot placementKey="tools-bottom" />
      </div>
    </div>
  );
};
