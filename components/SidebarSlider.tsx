import React, { useState } from 'react';
import { Settings, ChevronLeft, Briefcase, Palette, Settings as Cog, Check, Scissors, Scale, Book } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

const TONES = [
  { id: 'professional', label: 'Professional', icon: <Briefcase size={14} /> },
  { id: 'creative',     label: 'Creative',     icon: <Palette size={14} /> },
  { id: 'technical',    label: 'Technical',    icon: <Cog size={14} /> },
  { id: 'simple',       label: 'Simple',       icon: <Check size={14} /> },
];

const DETAILS = [
  { id: 'concise',       label: 'Concise',       icon: <Scissors size={14} /> },
  { id: 'balanced',      label: 'Balanced',      icon: <Scale size={14} /> },
  { id: 'comprehensive', label: 'Comprehensive', icon: <Book size={14} /> },
];

export const SidebarSlider = () => {
  const [isHovered, setIsHovered] = useState(false);
  const { settings, updateSetting } = useSettings();

  return (
    <>
      <style>{`
        .custom-sidebar-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
      <div
        className={`fixed top-1/2 right-0 z-[99999] -translate-y-1/2 flex items-center transition-transform duration-300 ease-in-out ${isHovered ? 'translate-x-0' : 'translate-x-[calc(100%-24px)]'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {/* The Tab Handle */}
      <div className="w-6 h-20 bg-[#111] border border-r-0 border-[#333] rounded-l-md flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-[#1a1a1a] transition-colors relative">
        <ChevronLeft size={14} className="text-[#888]" />
      </div>

      {/* The Expanded Content */}
      <div className="bg-[#111] border border-r-0 border-[#333] p-5 rounded-l-md shadow-[0_8px_32px_rgba(0,0,0,0.7)] flex flex-col gap-5 text-[12px] text-[#a0a0a0] font-sans w-72">
        <div className="flex items-center gap-2 border-b border-[#333] pb-3">
          <Settings size={16} className="text-blue-500" />
          <h2 className="text-[#eee] font-semibold text-sm uppercase tracking-wider">Optimization Profile</h2>
        </div>

        {/* Tone Selector */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Tone</h3>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map(t => (
              <button
                key={t.id}
                onClick={() => updateSetting('tone', t.id)}
                className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                  settings.tone === t.id
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                    : 'border-[#222] bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-[#bbb]'
                }`}
              >
                {t.icon}
                <span className="text-[11px] font-medium tracking-wide">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail Selector */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Level of Detail</h3>
          <div className="flex flex-col gap-2">
            {DETAILS.map(d => (
              <button
                key={d.id}
                onClick={() => updateSetting('detail', d.id)}
                className={`flex items-center justify-between p-2 rounded border transition-colors ${
                  settings.detail === d.id
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                    : 'border-[#222] bg-[#1a1a1a] text-[#888] hover:bg-[#222] hover:text-[#bbb]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {d.icon}
                  <span className="text-[11px] font-medium tracking-wide">{d.label}</span>
                </div>
                {settings.detail === d.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">Custom Rules (Optional)</h3>
          <textarea
            value={settings.customInstructions}
            onChange={(e) => updateSetting('customInstructions', e.target.value)}
            placeholder="e.g. Act as a senior dev. Output in JSON format."
            className="w-full h-16 bg-[#1a1a1a] border border-[#222] rounded p-2 text-[11px] text-[#eee] focus:outline-none focus:border-blue-500/50 transition-colors resize-none placeholder-[#555] custom-sidebar-scrollbar overflow-y-auto"
          />
        </div>

        {/* Shortcut Hint */}
        <div className="flex justify-between items-center pt-3 border-t border-[#333] mt-1">
          <span className="text-[#666] text-[10px] font-semibold uppercase tracking-wider">Optimize Selection</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-mono text-[#888] leading-none">Ctrl</kbd>
            <span className="text-[#444] text-[9px]">+</span>
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-mono text-[#888] leading-none">Shift</kbd>
            <span className="text-[#444] text-[9px]">+</span>
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-mono text-[#888] leading-none">O</kbd>
          </div>
        </div>

      </div>
    </div>
    </>
  );
};
