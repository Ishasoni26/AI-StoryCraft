import React from 'react';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3 cursor-pointer">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">AI StoryCraft</span>
          <span className="text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded ml-1 font-medium">PRO</span>
        </Link>
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
          <a href="/#features" className="hover:text-white transition-colors">Features</a>
          <a href="/#showcase" className="hover:text-white transition-colors">Showcase</a>
          <a href="/#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">Sign In</button>
          <Link href="/studio" className="text-sm font-medium bg-white text-black px-5 py-2 rounded-full hover:bg-slate-200 transition-colors shadow-lg hover:shadow-white/20 inline-block">
            Start Creating
          </Link>
        </div>
      </div>
    </nav>
  );
}
