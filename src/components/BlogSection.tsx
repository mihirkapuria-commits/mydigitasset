import React from 'react';
import { BookOpen, Calendar, User, ArrowRight, Sparkles } from 'lucide-react';

interface BlogSectionProps {
  onNavigateHome: () => void;
}

export const BlogSection: React.FC<BlogSectionProps> = ({ onNavigateHome }) => {
  const articles = [
    {
      id: '1',
      title: 'Navigating India’s Startup Funding Landscape in 2026',
      excerpt: 'An in-depth look at emerging venture capital trends, seed funding benchmarks, and how founders can optimize cash runway.',
      category: 'Startups & Funding',
      date: 'October 28, 2026',
      author: 'Mihir Kapuria',
      readTime: '4 min read'
    },
    {
      id: '2',
      title: 'The Evolution of Digital Payments and UPI Integration for Businesses',
      excerpt: 'How UPI QR automation and UTR verification are transforming subscription models and secure digital commerce across India.',
      category: 'FinTech & Banking',
      date: 'October 24, 2026',
      author: 'Editorial Team',
      readTime: '5 min read'
    },
    {
      id: '3',
      title: 'Commercial Real Estate and Infrastructure Growth in Mumbai Metropolitan Region',
      excerpt: 'Key growth corridors, commercial leasing demand, and infrastructure catalysts shaping modern realty investments.',
      category: 'Real Estate',
      date: 'October 20, 2026',
      author: 'TMK Realty Insights',
      readTime: '6 min read'
    }
  ];

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        {/* Header */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              MyDigitAsset Insights & Blog
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Curated Business Articles</h1>
            <p className="text-sm text-slate-600">
              Expert analysis on India’s startup ecosystem, fintech advancements, real estate, and digital assets.
            </p>
          </div>
          <button
            onClick={onNavigateHome}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            ← Back to Home
          </button>
        </div>

        {/* Google AdSense Top Ad Banner Space */}
        <div className="w-full bg-slate-100 border-2 border-dashed border-slate-300 rounded-3xl p-6 text-center space-y-2">
          <div className="inline-block px-2.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-mono uppercase tracking-wider rounded">
            Google AdSense Space (Responsive Banner)
          </div>
          <div className="h-24 flex items-center justify-center text-slate-400 text-xs font-mono">
            [ AdSlot ID: MDA-Blog-Header-728x90 / Responsive ]
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.map((art) => (
            <article key={art.id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{art.category}</span>
                  <span className="text-slate-400 font-mono">{art.readTime}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug hover:text-indigo-600 transition-colors cursor-pointer">
                  {art.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {art.excerpt}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{art.author}</span>
                </div>
                <span className="font-mono">{art.date}</span>
              </div>
            </article>
          ))}
        </div>

        {/* Google AdSense In-Feed Ad Space */}
        <div className="w-full bg-slate-100 border-2 border-dashed border-slate-300 rounded-3xl p-6 text-center space-y-2">
          <div className="inline-block px-2.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-mono uppercase tracking-wider rounded">
            Google AdSense In-Feed Advertisement Slot
          </div>
          <div className="h-20 flex items-center justify-center text-slate-400 text-xs font-mono">
            [ AdSlot ID: MDA-Blog-InFeed-Native ]
          </div>
        </div>
      </div>
    </div>
  );
};
