import React from 'react';
import { Category } from '../types';
import { Building2, Landmark, Home, Cpu, ShoppingBag, Factory, Zap, TrendingUp, Users, Megaphone } from 'lucide-react';

interface CategoriesSectionProps {
  categories: Category[];
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({ categories }) => {
  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'startups': return <TrendingUp className="w-5 h-5 text-indigo-600" />;
      case 'banking_fintech': return <Landmark className="w-5 h-5 text-emerald-600" />;
      case 'real_estate': return <Home className="w-5 h-5 text-amber-600" />;
      case 'it_ai': return <Cpu className="w-5 h-5 text-blue-600" />;
      case 'consumer_fmcg': return <ShoppingBag className="w-5 h-5 text-purple-600" />;
      case 'manufacturing_auto': return <Factory className="w-5 h-5 text-slate-700" />;
      case 'energy_renewables': return <Zap className="w-5 h-5 text-yellow-600" />;
      case 'economy_business': return <Building2 className="w-5 h-5 text-rose-600" />;
      case 'hr_employment': return <Users className="w-5 h-5 text-teal-600" />;
      case 'marketing_advertising': return <Megaphone className="w-5 h-5 text-orange-600" />;
      default: return <Building2 className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <section id="categories" className="py-24 bg-slate-50/50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Tailored Coverage</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Ten Essential India Business Categories
          </h3>
          <p className="text-base text-slate-600 leading-relaxed">
            Choose the exact sectors that impact your decisions. Avoid news overload and focus exclusively on high-signal developments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    {getCategoryIcon(cat.id)}
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                  {cat.title}
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Delivered via Telegram</span>
                <span className="text-indigo-600 font-semibold">Active Service</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
