import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, CheckCircle2, Sparkles, MessageSquare, Image as ImageIcon, Mic, Scissors } from 'lucide-react';

export default function Features() {
  return (
    <section id="features" className="relative py-20 mt-12 px-6 max-w-5xl mx-auto text-center overflow-hidden">
      <div className="mb-12 relative z-30">
        <h2 className="text-4xl md:text-6xl font-black mb-8">4 Tools. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">1 Magical Click.</span></h2>
        <div className="flex flex-col items-center justify-center space-y-6 max-w-3xl mx-auto px-4">
          <p className="text-xl md:text-3xl text-slate-200 font-medium leading-relaxed">
            Stop juggling between <span className="text-slate-500 line-through">4 different AI subscriptions</span>. 
          </p>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed">
            StoryCraft fuses world-class Scripting, Image Generation, Voice Cloning, and Video Editing into <span className="text-indigo-400 font-bold">one unified engine</span>.
          </p>
        </div>
      </div>

      <div className="relative h-[300px] flex items-center justify-center">
         <motion.div 
           className="absolute z-20 w-32 h-32 bg-indigo-600 rounded-3xl flex flex-col items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.6)] border border-indigo-400/50"
           animate={{ scale: [1, 1, 1.25, 1], rotate: [0, 0, 5, 0] }}
           transition={{ duration: 4, times: [0, 0.4, 0.5, 1], repeat: Infinity, ease: "easeInOut" }}
         >
            <Sparkles className="w-10 h-10 text-white mb-1" />
            <span className="font-bold text-white text-sm">StoryCraft</span>
         </motion.div>

         {[
           { icon: MessageSquare, label: "Script AI", color: "bg-blue-500", x: -180, y: -100 },
           { icon: ImageIcon, label: "Image AI", color: "bg-pink-500", x: 180, y: -100 },
           { icon: Mic, label: "Voice AI", color: "bg-amber-500", x: -180, y: 100 },
           { icon: Scissors, label: "Video Editor", color: "bg-emerald-500", x: 180, y: 100 }
         ].map((node, idx) => (
            <motion.div
              key={idx}
              className={`absolute z-10 w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl border border-white/20 ${node.color}`}
              animate={{ 
                x: [node.x, node.x, 0, node.x], 
                y: [node.y, node.y, 0, node.y],
                scale: [1, 1, 0, 1],
                opacity: [1, 1, 0, 1]
              }}
              transition={{ duration: 4, times: [0, 0.3, 0.5, 1], repeat: Infinity, ease: "easeInOut" }}
            >
              <node.icon className="w-7 h-7" />
              <span className="absolute -bottom-8 text-sm font-bold text-slate-300 w-24 text-center">{node.label}</span>
            </motion.div>
         ))}
      </div>
    </section>
  );
}
