import React, { useState } from 'react';
import { Sparkles, Briefcase, Palette, Settings, Check, Scissors, Scale, Book } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

const TONES = [
  { id: 'professional', label: 'Professional', icon: <Briefcase size={24} />, desc: 'Formal, structured, business-ready' },
  { id: 'creative',     label: 'Creative',     icon: <Palette size={24} />, desc: 'Imaginative, expressive, open-ended' },
  { id: 'technical',    label: 'Technical',    icon: <Settings size={24} />, desc: 'Precise, detailed, expert-level' },
  { id: 'simple',       label: 'Simple',       icon: <Check size={24} />, desc: 'Clear, concise, easy to understand' },
];

const DETAILS = [
  { id: 'concise',       label: 'Concise',       icon: <Scissors size={24} />, desc: 'Short, precise, minimal instructions' },
  { id: 'balanced',      label: 'Balanced',      icon: <Scale size={24} />, desc: 'Good mix of detail and brevity' },
  { id: 'comprehensive', label: 'Comprehensive', icon: <Book size={24} />, desc: 'Extremely detailed, covers all edge cases' },
];

export function PopupStyleSelector() {
  const { settings, updateSetting } = useSettings();
  const [saved, setSaved] = useState(false);

  const handleSelectTone = (id: string) => {
    updateSetting('tone', id);
    showSaved();
  };

  const handleSelectDetail = (id: string) => {
    updateSetting('detail', id);
    showSaved();
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="p-4 flex flex-col gap-6 pb-8">
      <div className="flex items-center gap-2 mb-[-12px]">
        <Sparkles size={18} className="text-blue-500" />
        <h2 className="text-[14px] font-bold">Style & Detail</h2>
        {saved && <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md font-semibold border border-green-500/20 ml-auto flex items-center gap-1"><Check size={10} /> Saved</span>}
      </div>
      <p className="text-xs text-[#666] leading-relaxed">
        Choose how the AI should write your enhanced prompt. This applies globally.
      </p>

      {/* Tone Section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Tone</h3>
        {TONES.map(tone => (
          <button
            key={tone.id}
            onClick={() => handleSelectTone(tone.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              settings.tone === tone.id
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-[#1c1c1c] bg-[#111] hover:border-[#333]'
            }`}
          >
            <div className={`text-[#888] ${settings.tone === tone.id ? 'text-blue-400' : ''}`}>{tone.icon}</div>
            <div className="flex flex-col flex-1">
              <span className={`text-[13px] font-bold ${settings.tone === tone.id ? 'text-blue-300' : 'text-white'}`}>
                {tone.label}
              </span>
              <span className="text-[11px] text-[#555]">{tone.desc}</span>
            </div>
            {settings.tone === tone.id && (
              <span className="text-[10px] text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full font-bold">Active</span>
            )}
          </button>
        ))}
      </div>

      {/* Detail Section */}
      <div className="flex flex-col gap-2 border-t border-[#222] pt-4 mt-2">
        <h3 className="text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Level of Detail</h3>
        {DETAILS.map(detail => (
          <button
            key={detail.id}
            onClick={() => handleSelectDetail(detail.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              settings.detail === detail.id
                ? 'border-purple-500/50 bg-purple-500/10'
                : 'border-[#1c1c1c] bg-[#111] hover:border-[#333]'
            }`}
          >
            <div className={`text-[#888] ${settings.detail === detail.id ? 'text-purple-400' : ''}`}>{detail.icon}</div>
            <div className="flex flex-col flex-1">
              <span className={`text-[13px] font-bold ${settings.detail === detail.id ? 'text-purple-300' : 'text-white'}`}>
                {detail.label}
              </span>
              <span className="text-[11px] text-[#555]">{detail.desc}</span>
            </div>
            {settings.detail === detail.id && (
              <span className="text-[10px] text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full font-bold">Active</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
