import React from 'react';
import { Shield, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
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
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Support & Inquiries: mihirkapuria@gmail.com</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Platform</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="#categories" className="hover:text-white transition-colors">News Categories</a></li>
            <li><a href="#pricing" className="hover:text-white transition-colors">Annual Pricing</a></li>
            <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
            <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Privacy & Terms</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><span className="text-slate-400">Never sell phone numbers</span></li>
            <li><span className="text-slate-400">Manual UPI verification</span></li>
            <li><span className="text-slate-400">Secure password recovery</span></li>
            <li><span className="text-slate-400">Authorized Admin: mihirkapuria@gmail.com</span></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-slate-950 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <p>© {new Date().getFullYear()} MyDigitAsset (mydigitasset.com). All rights reserved.</p>
        <p className="mt-2 sm:mt-0">Designed for reliability, simplicity, and data privacy.</p>
      </div>
    </footer>
  );
};
