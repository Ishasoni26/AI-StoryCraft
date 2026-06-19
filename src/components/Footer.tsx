import React from 'react';
import { Sparkles, Globe, Mail, Link } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-32 border-t border-slate-800/50 bg-slate-900/30 backdrop-blur-lg pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center space-x-2 mb-4">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
               <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-bold text-xl">AI StoryCraft</span>
          </div>
          <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
            The world's easiest AI storyboard generator. Type a script, choose a visual style, and let AI do the magic. Build stunning narratives in seconds.
          </p>
          <div className="flex space-x-4 mt-6 text-slate-500">
            <Globe className="w-5 h-5 hover:text-indigo-400 cursor-pointer transition-colors" />
            <Mail className="w-5 h-5 hover:text-indigo-400 cursor-pointer transition-colors" />
            <Link className="w-5 h-5 hover:text-indigo-400 cursor-pointer transition-colors" />
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-6 text-slate-200">Product</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Features</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Pricing</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Showcase</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">API Documentation</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-6 text-slate-200">Legal</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-indigo-400 transition-colors">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-slate-800/50 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} AI StoryCraft Inc. All rights reserved. Powered by Next.js & Gemini.
      </div>
    </footer>
  );
}
