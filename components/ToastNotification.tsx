import React from 'react';
import { AlertTriangle, XCircle, Sparkles, Zap, Bot, Settings as Cog, Loader2 } from 'lucide-react';

export const ToastNotification = ({
  errorMsg,
  setErrorMsg,
  successNotice,
  isWorking
}: {
  errorMsg: string | null;
  setErrorMsg: (msg: string | null) => void;
  successNotice: { method: string } | null;
  isWorking?: boolean;
}) => {
  return (
    <>
      <style>{`
        .custom-toast-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-toast-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-toast-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
        }
        .custom-toast-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
      {errorMsg && (
        <div className="fixed top-8 right-8 z-[100001] bg-[#111] text-[#fca5a5] px-4 py-3 rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-red-500/30 text-[13px] pointer-events-auto flex items-start gap-3 max-w-[340px] animate-[fadeIn_0.2s_ease]">
          <AlertTriangle size={16} className="text-red-400 mt-0.5" />
          <div className="flex flex-col gap-1 flex-1 overflow-hidden">
            <span className="font-semibold text-[12px] text-red-300">Enhancement Failed</span>
            <span className="text-[11px] text-red-400/80 leading-snug break-words whitespace-pre-wrap max-h-32 overflow-y-auto pr-2 custom-toast-scrollbar">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500/50 hover:text-red-400">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {isWorking && (
        <div className="fixed top-8 right-8 z-[100000] bg-[#111] text-[#eee] px-4 py-3 rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-[#333] text-[13px] pointer-events-auto flex items-center gap-3 min-w-[200px] animate-[fadeIn_0.2s_ease]">
          <Loader2 size={16} className="text-blue-400 animate-spin" />
          <span className="font-medium tracking-wide text-[12px] text-gray-200">Optimizing Prompt...</span>
        </div>
      )}

      {successNotice && (
        <div className="fixed top-8 right-8 z-[100000] bg-[#111] text-[#eee] px-4 py-3 rounded-md shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-[#333] text-[13px] pointer-events-auto flex flex-col gap-2 min-w-[200px] animate-[fadeIn_0.2s_ease]">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-blue-500" />
            <span className="font-semibold tracking-wide">Prompt Enhanced</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#888]">
            {successNotice.method === 'gemini-agent'
                ? <><Bot size={12} className="text-purple-400" /> <span>Enhanced by AI Agent</span></>
                : successNotice.method === 'openai'
                  ? <><Bot size={12} className="text-emerald-400" /> <span>Enhanced by GPT-4o mini</span></>
                  : successNotice.method === 'anthropic'
                    ? <><Bot size={12} className="text-orange-400" /> <span>Enhanced by Claude Haiku</span></>
                    : successNotice.method === 'ollama'
                      ? <><Bot size={12} className="text-blue-400" /> <span>Enhanced locally via Ollama</span></>
                      : <><Cog size={12} className="text-yellow-500" /> <span>Enhanced by static fallback</span></>
            }
          </div>
        </div>
      )}
    </>
  );
};
