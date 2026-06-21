import React, { useState } from 'react';
import { History, Search, ChevronRight } from 'lucide-react';

export const HistoryList = ({ filteredHistory, search, setSearch }: any) => {
  const [injected, setInjected] = useState<number | null>(null);

  const handleInject = async (enhanced: string, id: number) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { action: 'inject-prompt', prompt: enhanced });
      setInjected(id);
      setTimeout(() => setInjected(null), 2000);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={14} className="text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#666]">Enhancement History</h2>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#111] border border-[#333] text-[11px] rounded px-2 py-1 pl-6 focus:outline-none focus:border-blue-500 w-[130px] transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-6 text-[#555] text-xs bg-[#111] rounded-lg border border-[#222]">
            No history found.
          </div>
        ) : (
          filteredHistory.map((h: any) => (
            <div key={h.id} className="bg-[#111] border border-[#222] rounded-lg p-3 flex flex-col gap-2 hover:border-[#333] transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    h.method === 'gemini-agent' ? 'bg-purple-500/20 text-purple-400' :
                    h.method === 'cache'        ? 'bg-green-500/20 text-green-400'  :
                                                  'bg-orange-500/20 text-orange-400'
                  }`}>
                    {h.method}
                  </span>
                  <span className="text-[10px] text-[#666]">
                    {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="text-xs text-[#ccc] leading-relaxed">
                <span className="text-[#444] text-[9px] uppercase font-bold">Original: </span>
                "{h.prompt}"
              </div>

              <div className="text-[10px] text-[#666] leading-snug line-clamp-2">
                <span className="text-[#444] text-[9px] uppercase font-bold">Enhanced: </span>
                {h.compressed?.slice(0, 100)}{h.compressed?.length > 100 ? '...' : ''}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-[#222] mt-1">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleInject(h.compressed, h.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                      injected === h.id
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                    }`}
                  >
                    <ChevronRight size={10} />
                    {injected === h.id ? 'Done!' : 'Use'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
