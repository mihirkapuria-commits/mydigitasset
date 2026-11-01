import React from 'react';
import { Shield, Mail } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: 'home' | 'dashboard' | 'admin' | 'blog' | 'offers' | 'utilities' | 'contact') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-950 text-white py-16 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tight">
              MA
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              MyDigitAsset
            </span>
          </div>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            The right news. The right categories. Delivered directly to you through Telegram. Built for founders, investors, and business professionals.
          </p>
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>Primary / Realty: <strong>tmkrealty@gmail.com</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Support / Admin: mihirkapuria@gmail.com</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Quick Links</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><button onClick={() => onNavigate('home')} className="hover:text-white transition-colors">Home & Categories</button></li>
            <li><button onClick={() => onNavigate('blog')} className="hover:text-white transition-colors">Blog & AdSense</button></li>
            <li><button onClick={() => onNavigate('offers')} className="hover:text-white transition-colors">Offers & Advertisements</button></li>
            <li><button onClick={() => onNavigate('utilities')} className="hover:text-white transition-colors">Utilities & Calculators</button></li>
            <li><button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">Contact Us (tmkrealty@gmail.com)</button></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Privacy & Compliance</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><span className="text-slate-400">Never sell phone numbers</span></li>
            <li><span className="text-slate-400">Manual UPI verification</span></li>
            <li><span className="text-slate-400">Secure password recovery</span></li>
            <li><span className="text-slate-400">Authorized Admin: mihirkapuria@gmail.com</span></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <p>© {new Date().getFullYear()} MyDigitAsset (mydigitasset.com). All rights reserved.</p>
        <p className="mt-2 sm:mt-0">Designed for reliability, simplicity, and data privacy.</p>
      </div>
    </footer>
  );
};
