import React, { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { AdSenseSlot } from './AdSenseSlot';

interface OffersSectionProps {
  onNavigateHome: () => void;
  onStartTrial: () => void;
}
type Offer = {
  id: string; title: string; summary: string; body: string;
  imageUrl?: string; image_url?: string; targetUrl?: string; target_url?: string;
};

export const OffersSection: React.FC<OffersSectionProps> = ({ onNavigateHome, onStartTrial }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  useEffect(() => {
    let active = true;
    fetch('/api/site-content/offers')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (active) setOffers(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setOffers([]); });
    return () => { active = false; };
  }, []);

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-10">
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"><Tag className="w-3.5 h-3.5" /> Special Offers</div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Promotions & Partner Deals</h1>
            <p className="text-sm text-slate-600">Offers and partner information published by MyDigitAsset.</p>
          </div>
          <button onClick={onNavigateHome} className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl">← Back to Home</button>
        </div>
        <AdSenseSlot placementKey="offers-top" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => (
            <article key={offer.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              {(offer.imageUrl || offer.image_url) && <img src={offer.imageUrl || offer.image_url} alt="" className="w-full h-44 object-cover rounded-xl" />}
              <h2 className="text-xl font-bold text-slate-900">{offer.title}</h2>
              <p className="text-sm text-slate-600">{offer.summary}</p>
              {offer.body && <p className="text-xs text-slate-500 whitespace-pre-wrap">{offer.body}</p>}
              {offer.targetUrl || offer.target_url ? (
                <a href={offer.targetUrl || offer.target_url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold">View Offer</a>
              ) : (
                <button onClick={onStartTrial} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold">Start Free Trial</button>
              )}
            </article>
          ))}
        </div>
        {!offers.length && <p className="bg-white border rounded-2xl p-8 text-center text-sm text-slate-500">No offers are currently published.</p>}
        <AdSenseSlot placementKey="offers-bottom" />
      </div>
    </div>
  );
};
