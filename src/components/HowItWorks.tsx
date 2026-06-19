import React from 'react';
import { PenTool, Wand2, Download, Edit3 } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      step: "1",
      title: "Write your Script",
      description: "Type your story in Hindi or English, and choose a visual style.",
      icon: PenTool,
      color: "text-cyan-400"
    },
    {
      step: "2",
      title: "Review & Edit",
      description: "Tweak the generated storyboard. Modify dialogue or image prompts for perfect scenes.",
      icon: Edit3,
      color: "text-indigo-400"
    },
    {
      step: "3",
      title: "AI Generates Magic",
      description: "Our AI creates stunning images and voices for every scene in seconds.",
      icon: Wand2,
      color: "text-purple-400"
    },
    {
      step: "4",
      title: "Export & Share",
      description: "Download your fully animated and voiced MP4 video ready for YouTube Shorts.",
      icon: Download,
      color: "text-emerald-400"
    }
  ];

  return (
    <section className="relative py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-black mb-6">How It Works</h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Create viral faceless videos in four simple steps. Full creative control, zero editing skills.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-8 relative">
        {/* Connecting line for desktop */}
        <div className="hidden md:block absolute top-[2.5rem] left-[12%] right-[12%] h-0.5 bg-slate-800 z-0"></div>

        {steps.map((s, idx) => (
          <div key={idx} className="relative z-10 flex flex-col items-center text-center group">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-8 bg-slate-900 border-2 border-slate-700 shadow-2xl group-hover:scale-110 transition-transform duration-300 relative`}>
               <s.icon className={`w-8 h-8 ${s.color}`} />
               <div className="absolute -top-3 -right-3 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-sm text-white border-4 border-[#0b1120]">
                 {s.step}
               </div>
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-200">{s.title}</h3>
            <p className="text-slate-400 leading-relaxed text-sm max-w-[200px]">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
