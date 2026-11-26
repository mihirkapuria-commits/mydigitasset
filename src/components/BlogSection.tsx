import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, User } from 'lucide-react';
import { AdSenseSlot } from './AdSenseSlot';
interface BlogSectionProps { onNavigateHome: () => void; }
type Article = {
  id: string; title: string; slug: string; excerpt: string; body: string;
  featuredImageUrl?: string; featured_image_url?: string; publishedAt?: string; published_at?: string;
  adPlacements?: string[]; disclaimerOverride?: number;
};
type DisplaySettings = {
  disclaimerEnabled: boolean; disclaimerText: string; backgroundColor: string;
  textColor: string; fontSize: number; fontWeight: number; alignment: 'left' | 'center';
};
const defaultDisplaySettings: DisplaySettings = {
  disclaimerEnabled: true,
  disclaimerText: 'Please exercise caution when viewing advertisements displayed on this website. Advertisements are provided by third-party advertisers and are not necessarily endorsed or verified by MyDigitAsset. Any decision to click on an advertisement, purchase a product, or use an advertised service is entirely independent of MyDigitAsset.',
  backgroundColor: '#FCE8E8', textColor: '#7F1D1D', fontSize: 14, fontWeight: 500, alignment: 'left'
};
const defaultPlacements = ['blog-top', 'blog-inline', 'blog-bottom', 'blog-left', 'blog-right'];
export const BlogSection: React.FC<BlogSectionProps> = ({ onNavigateHome }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(defaultDisplaySettings);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/blog').then(r => r.ok ? r.json() : []),
      fetch('/api/blog-display-settings').then(r => r.ok ? r.json() : defaultDisplaySettings)
    ]).then(([articleData, settingsData]) => {
      if (!active) return;
      setArticles(Array.isArray(articleData) ? articleData : []);
      setDisplaySettings({ ...defaultDisplaySettings, ...(settingsData || {}) });
    }).catch(() => { if (active) setArticles([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const dateLabel = (a: Article) => {
    const value = a.publishedAt || a.published_at;
    return value ? new Date(value).toLocaleDateString() : '';
  };
  const placementsFor = (a: Article) => Array.isArray(a.adPlacements) ? a.adPlacements : defaultPlacements;
  const showDisclaimer = selected && (selected.disclaimerOverride === 0 ? false :
    selected.disclaimerOverride === 1 ? true : displaySettings.disclaimerEnabled);
  const paragraphs = selected ? (selected.body || selected.excerpt || '').split(/\n\s*\n/).filter(Boolean) : [];
  return <div className="py-12 bg-slate-50 min-h-screen">
    <div className="max-w-7xl mx-auto px-6 space-y-10">
      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"><BookOpen className="w-3.5 h-3.5" /> MyDigitAsset Insights & Blog</div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Curated Business Articles</h1>
          <p className="text-sm text-slate-600">Business insights, analysis and useful industry information.</p>
        </div>
        <button onClick={onNavigateHome} className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl">← Back to Home</button>
      </div>
      {!selected && <AdSenseSlot placementKey="blog-top" />}
      {selected ? <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_220px] gap-5 items-start">
        <aside className="hidden xl:block">{placementsFor(selected).includes('blog-left') && <AdSenseSlot placementKey="blog-left" />}</aside>
        <article className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm min-w-0 space-y-5">
          <button onClick={() => setSelected(null)} className="text-xs font-semibold text-indigo-700">← All articles</button>
          {selected.featuredImageUrl || selected.featured_image_url ? <img src={selected.featuredImageUrl || selected.featured_image_url} alt="" className="w-full max-h-96 object-cover rounded-2xl" /> : null}
          <h2 className="text-3xl font-extrabold text-slate-900">{selected.title}</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500"><Calendar className="w-4 h-4" />{dateLabel(selected)}</div>
          {placementsFor(selected).includes('blog-top') && <AdSenseSlot placementKey="blog-top" />}
          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap space-y-4">
            {paragraphs.map((paragraph, index) => <React.Fragment key={index}><p>{paragraph}</p>{index === 0 && placementsFor(selected).includes('blog-inline') && <AdSenseSlot placementKey="blog-inline" />}</React.Fragment>)}
          </div>
          {placementsFor(selected).includes('blog-bottom') && <AdSenseSlot placementKey="blog-bottom" />}
          {showDisclaimer && <div className="rounded-xl border border-red-100 p-4" role="note" aria-label="Advertisement disclaimer"
            style={{ backgroundColor: displaySettings.backgroundColor, color: displaySettings.textColor, fontSize: `${displaySettings.fontSize}px`, fontWeight: displaySettings.fontWeight, textAlign: displaySettings.alignment }}>
            <strong className="block mb-1">⚠️ Advertisement Disclaimer</strong>{displaySettings.disclaimerText}
          </div>}
        </article>
        <aside className="hidden xl:block">{placementsFor(selected).includes('blog-right') && <AdSenseSlot placementKey="blog-right" />}</aside>
      </div> : <>
        {loading && <p className="text-sm text-slate-500">Loading articles...</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.map(article => <article key={article.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              {article.featuredImageUrl || article.featured_image_url ? <img src={article.featuredImageUrl || article.featured_image_url} alt="" className="w-full h-44 object-cover rounded-xl" /> : null}
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{article.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{article.excerpt}</p>
            </div>
            <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> MyDigitAsset</span><span className="font-mono">{dateLabel(article)}</span>
            </div>
            <button onClick={() => setSelected(article)} className="mt-4 text-left text-xs font-semibold text-indigo-700">Read article →</button>
          </article>)}
        </div>
        {!loading && !articles.length && <p className="bg-white rounded-2xl border p-8 text-center text-sm text-slate-500">No published articles yet.</p>}
        <AdSenseSlot placementKey="blog-inline" /><AdSenseSlot placementKey="blog-bottom" />
      </>}
    </div>
  </div>;
};
