import React, { useState, useEffect } from 'react';
import { Sparkles, Briefcase, Scissors } from 'lucide-react';
import { getActiveEditable } from '../utils/dom';

export const QuickActionPills = ({ handleOptimize }: { handleOptimize: (action: string) => void }) => {
  const [position, setPosition] = useState<{ top: number, left: number, width: number } | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    let lastRectStr = '';
    
    const checkPosition = () => {
      const active = getActiveEditable();
      if (active && (document.activeElement === active || active.contains(document.activeElement))) {
        const rect = active.getBoundingClientRect();
        const rectStr = `${rect.top},${rect.left},${rect.width}`;
        if (rectStr !== lastRectStr) {
          setPosition({ top: rect.top - 36, left: rect.left, width: rect.width });
          lastRectStr = rectStr;
        }
      } else {
        if (position !== null) setPosition(null);
        lastRectStr = '';
      }
      animationFrameId = requestAnimationFrame(checkPosition);
    };
    
    animationFrameId = requestAnimationFrame(checkPosition);
    return () => cancelAnimationFrame(animationFrameId);
  }, [position]);

  if (!position) return null;

  return (
    <div 
      className="fixed z-[100000] flex gap-2 pointer-events-auto animate-[fadeIn_0.2s_ease]"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <button onMouseDown={(e) => { e.preventDefault(); handleOptimize('Fix Grammar'); }} className="px-3 py-1.5 bg-[#111] hover:bg-[#222] border border-[#333] text-[#bbb] hover:text-white text-[11px] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-medium transition-all flex items-center gap-1.5"><Sparkles size={12} className="text-blue-400" /> Fix Grammar</button>
      <button onMouseDown={(e) => { e.preventDefault(); handleOptimize('Make Professional'); }} className="px-3 py-1.5 bg-[#111] hover:bg-[#222] border border-[#333] text-[#bbb] hover:text-white text-[11px] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-medium transition-all flex items-center gap-1.5"><Briefcase size={12} className="text-amber-400" /> Make Professional</button>
      <button onMouseDown={(e) => { e.preventDefault(); handleOptimize('Summarize'); }} className="px-3 py-1.5 bg-[#111] hover:bg-[#222] border border-[#333] text-[#bbb] hover:text-white text-[11px] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-medium transition-all flex items-center gap-1.5"><Scissors size={12} className="text-purple-400" /> Summarize</button>
    </div>
  );
};
