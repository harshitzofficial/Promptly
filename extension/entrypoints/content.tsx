import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import '@/assets/tailwind.css';

declare global {
  interface Window {
    __lastSubmitActionTime?: number;
  }
}

function getActiveEditable() {
  // Try ChatGPT
  const chatGptInput = document.getElementById('prompt-textarea');
  if (chatGptInput) return chatGptInput as HTMLTextAreaElement | HTMLElement;
  
  // Try Claude
  const claudeInput = document.querySelector('.ProseMirror');
  if (claudeInput) return claudeInput as HTMLElement;

  // Try Gemini
  const geminiInput = document.querySelector('rich-textarea > div[contenteditable="true"], .ql-editor, div[role="textbox"][contenteditable="true"]');
  if (geminiInput) return geminiInput as HTMLElement;

  // Fallback to active element
  const active = document.activeElement;
  if (active) {
    if (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') {
      return active as HTMLInputElement | HTMLTextAreaElement;
    }
    if (active.getAttribute('contenteditable') === 'true') {
      return active as HTMLElement;
    }
  }

  return null;
}

function getEditableText(element: HTMLElement): string {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    return (element as HTMLInputElement).value;
  }
  return element.innerText || '';
}

function setEditableText(element: HTMLElement, text: string) {
  // Normalize: collapse multiple spaces and excessive newlines before inserting
  const clean = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const input = element as HTMLInputElement;
    input.value = clean;
    // Dispatch event so React/Vue notices the change
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Contenteditable
    element.innerText = clean;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

const App = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [stats, setStats] = useState<{ saved: number, percent: number, method?: string, costSaved?: number } | null>(null);
  const [totalSaved, setTotalSaved] = useState<number | null>(null);
  const [totalCostSaved, setTotalCostSaved] = useState<number | null>(null);
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(10000);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<number>(0);
  const [compressionRatio, setCompressionRatio] = useState<number>(0.6);
  const [targetContainer, setTargetContainer] = useState<HTMLElement | null>(null);
  const [lastText, setLastText] = useState<string>("");

  // Track global user interactions that look like a "Send" action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        window.__lastSubmitActionTime = Date.now();
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]') || target.closest('svg')) {
        window.__lastSubmitActionTime = Date.now();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, []);

  // Poll for active editable, set portal target, AND detect submission
  useEffect(() => {
    const interval = setInterval(() => {
      const el = getActiveEditable();
      if (el) {
        // Portal container logic
        let container = el.parentElement;
        if (window.location.hostname.includes('gemini.google.com')) {
          container = el.closest('rich-textarea') as HTMLElement;
        } else if (window.location.hostname.includes('chatgpt.com')) {
          container = el.closest('form') as HTMLElement;
        } else if (window.location.hostname.includes('claude.ai')) {
          container = el.closest('fieldset') as HTMLElement;
        }
        
        if (container && container !== targetContainer) {
          setTargetContainer(container);
        }

        // Submission detection logic
        const currentText = getEditableText(el).trim();
        
        // If text was cleared AND a submit action happened recently
        if (currentText.length === 0 && lastText.length > 0) {
          const timeSinceAction = Date.now() - (window.__lastSubmitActionTime || 0);
          if (timeSinceAction < 2000) {
            // User likely submitted the prompt! Send to backend to track usage.
            browser.runtime.sendMessage({ action: 'trackUsage', prompt: lastText }).then(() => {
              // Refresh session stats
              browser.runtime.sendMessage({ action: 'getSession' }).then((res: any) => {
                if (res.success && res.data) {
                  setTotalSaved(res.data.tokensSaved);
                  setTokensRemaining(res.data.remaining);
                }
              });
            });
          }
        }
        
        setLastText(currentText);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [targetContainer, lastText]);

  // Fetch session
  useEffect(() => {
    browser.runtime.sendMessage({ action: 'getSession' })
      .then((res: any) => {
        if (res.success && res.data) {
          setTotalSaved(res.data.tokensSaved);
          setTotalCostSaved(res.data.totalCostSaved);
          setTokensRemaining(res.data.remaining);
          setLimit(res.data.limit);
          setTimeUntilRefresh(res.data.timeUntilRefreshMs);
        }
      })
      .catch(console.error);

    const handleMessage = (msg: any) => {
      if (msg.action === 'trigger-optimize') {
        handleOptimize();
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Keyboard shortcut listener (Ctrl+Shift+O)
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      // Ctrl + Shift + O
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        e.stopPropagation();
        handleOptimize();
      }
    };
    document.addEventListener('keydown', handleShortcut, true);
    return () => document.removeEventListener('keydown', handleShortcut, true);
  });

  const handleOptimize = async () => {
    const target = getActiveEditable();
    if (!target) { alert('Please focus on the text box first!'); return; }

    const text = getEditableText(target);
    if (!text.trim()) { alert('Please enter a prompt first.'); return; }

    setIsOptimizing(true);

    try {
      // ── 1. Check cache first (instant) ───────────────────────────────────
      const cacheRes = await browser.runtime.sendMessage({ action: 'checkCache', prompt: text });
      if (cacheRes?.hit && cacheRes.data?.optimizedPrompt) {
        setEditableText(target, cacheRes.data.optimizedPrompt);
        setStats({ saved: cacheRes.data.tokensSaved, percent: cacheRes.data.percentSaved, method: cacheRes.data.method, costSaved: cacheRes.data.costSaved });
        setLastFromCache(true);
        setTimeout(() => setStats(null), 4000);
        
        // Notify backend of cache hit so it logs history and increments savings
        const sessionRes = await browser.runtime.sendMessage({ action: 'getSession' });
        const sessionId = sessionRes?.data?.sessionId ?? '';
        if (sessionId) {
          await fetch('http://localhost:3005/api/log-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId, prompt: text,
              compressed: cacheRes.data.optimizedPrompt,
              originalTokens: cacheRes.data.originalTokens,
              optimizedTokens: cacheRes.data.optimizedTokens
            })
          });
        }

        browser.runtime.sendMessage({ action: 'getSession' }).then((r: any) => {
          if (r?.success && r.data) { setTotalSaved(r.data.tokensSaved); setTotalCostSaved(r.data.totalCostSaved); setTokensRemaining(r.data.remaining); setLimit(r.data.limit); setTimeUntilRefresh(r.data.timeUntilRefreshMs); }
        });
        return;
      }

      // ── 2. Cache miss — stream from backend ───────────────────────────────
      const sessionRes = await browser.runtime.sendMessage({ action: 'getSession' });
      const sessionId = sessionRes?.data?.sessionId ?? '';

      const response = await fetch('http://localhost:3005/api/optimize/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, sessionId, ratio: compressionRatio }),
      });

      if (!response.body) throw new Error('No stream body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamedText = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              if (firstChunk) {
                setEditableText(target, ''); // clear box on first word
                firstChunk = false;
              }
              streamedText += data.text;
              setEditableText(target, streamedText);

            } else if (data.type === 'done') {
              // Cache result for next time
              browser.runtime.sendMessage({ action: 'cacheResult', prompt: text, result: data });
              setStats({ saved: data.tokensSaved, percent: data.percentSaved, method: data.method, costSaved: data.costSaved });
              setLastFromCache(false);
              setTimeout(() => setStats(null), 4000);
              browser.runtime.sendMessage({ action: 'getSession' }).then((r: any) => {
                if (r?.success && r.data) { setTotalSaved(r.data.tokensSaved); setTotalCostSaved(r.data.totalCostSaved); setTokensRemaining(r.data.remaining); setLimit(r.data.limit); setTimeUntilRefresh(r.data.timeUntilRefreshMs); }
              });

            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch { /* skip malformed lines */ }
        }
      }

    } catch (e) {
      console.error('[optimize stream]', e);
      alert('Optimization failed. Make sure the backend is running.');
    } finally {
      setIsOptimizing(false);
    }
  };



  const formatTime = (ms: number) => {
    const totalMins = Math.floor(ms / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours}h ${mins}m`;
  };

  const usedTokens = limit && tokensRemaining !== null ? limit - tokensRemaining : 0;
  const usedPercent = limit ? Math.min(100, (usedTokens / limit) * 100).toFixed(1) : "0";

  const [isHovered, setIsHovered] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ entries: number, hits: number }>({ entries: 0, hits: 0 });
  const [lastFromCache, setLastFromCache] = useState(false);

  // Fetch cache stats on mount and after optimize
  useEffect(() => {
    browser.runtime.sendMessage({ action: 'getCacheStats' })
      .then((res: any) => {
        if (res.success) setCacheStats(res.data);
      })
      .catch(console.error);
  }, [stats]); // re-fetch after each optimization

  // The floating Toast remains fixed at the top right
  const toastUI = stats && (
    <div className="fixed top-8 right-8 z-[100000] bg-[#1a1a2e] text-[#e5e5e5] px-4 py-3 rounded-lg shadow-xl border border-[#333] text-[13px] pointer-events-auto flex flex-col gap-1">
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[#3b82f6] font-bold">✨</span>
          <span>Saved <strong>{stats.saved} tokens</strong> ({stats.percent}%)</span>
        </div>
        {stats.costSaved !== undefined && (
          <span className="text-[#22c55e] font-mono bg-[#22c55e]/10 px-1.5 py-0.5 rounded text-[11px] font-bold">
            ${stats.costSaved.toFixed(4)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {lastFromCache
          ? <span className="text-[#22c55e]">⚡ Served from cache</span>
          : stats.method === 'llmlingua'
            ? <span className="text-[#a78bfa]">🤖 Compressed by LLMLingua AI</span>
            : <span className="text-[#f59e0b]">⚙️ Compressed by regex fallback</span>
        }
      </div>
    </div>
  );

  // The persistent tracker is now a sleek hovering tab on the right edge
  const trackerUI = (
    <div 
      className={`fixed top-1/2 right-0 z-[99999] -translate-y-1/2 flex items-center transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isHovered ? 'translate-x-0' : 'translate-x-[calc(100%-24px)]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The Tab Handle */}
      <div className="w-6 h-20 bg-[#0f0f11]/90 backdrop-blur-md border border-r-0 border-white/10 rounded-l-xl flex flex-col items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-[#1a1a24] transition-colors">
        <div className="w-1 h-10 bg-white/20 rounded-full"></div>
      </div>

      {/* The Expanded Content */}
      <div className="bg-[#0f0f11]/80 backdrop-blur-2xl border border-r-0 border-white/10 p-5 rounded-bl-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] flex flex-col gap-5 text-[12px] text-[#a0a0a0] font-sans w-72">
        
        {/* Saved Stats */}
        <div className="flex justify-between items-start">
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300 tracking-wide text-sm uppercase">Tokens Saved</span>
          <div className="flex flex-col items-end">
            <span className="text-white font-black text-lg flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
              <span className="text-blue-500">✨</span> {totalSaved || 0}
            </span>
            {totalCostSaved !== null && totalCostSaved > 0 && (
              <span className="text-[#22c55e] text-[10px] font-mono font-bold leading-none mt-1 px-1.5 py-0.5 bg-[#22c55e]/10 rounded">
                Saved ~${totalCostSaved.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div className="flex flex-col gap-2 bg-white/[0.03] p-3 rounded-xl border border-white/5">
          <div className="flex justify-between items-center text-[11px] uppercase tracking-wider font-semibold">
            <span className="text-[#666]">Remaining</span>
            <span className="text-[#ddd]">{(tokensRemaining ?? limit)?.toLocaleString()} <span className="text-[#555]">/</span> {limit?.toLocaleString()}</span>
          </div>
          <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
              style={{ width: `${usedPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Compression Mode Selector */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[#666] font-bold ml-1">Compression Level</span>
          <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5 relative">
            <button 
              onClick={() => setCompressionRatio(0.8)} 
              className={`flex-1 py-1.5 text-center rounded-md text-[11px] font-medium transition-all duration-300 ${compressionRatio === 0.8 ? 'bg-white/15 text-white shadow-sm' : 'text-[#777] hover:text-[#bbb]'}`}>
              <span className="mr-1.5 opacity-80">🟢</span>Light
            </button>
            <button 
              onClick={() => setCompressionRatio(0.6)} 
              className={`flex-1 py-1.5 text-center rounded-md text-[11px] font-medium transition-all duration-300 ${compressionRatio === 0.6 ? 'bg-white/15 text-white shadow-sm' : 'text-[#777] hover:text-[#bbb]'}`}>
              <span className="mr-1.5 opacity-80">🟡</span>Bal.
            </button>
            <button 
              onClick={() => setCompressionRatio(0.3)} 
              className={`flex-1 py-1.5 text-center rounded-md text-[11px] font-medium transition-all duration-300 ${compressionRatio === 0.3 ? 'bg-white/15 text-white shadow-sm' : 'text-[#777] hover:text-[#bbb]'}`}>
              <span className="mr-1.5 opacity-80">🔴</span>Max
            </button>
          </div>
        </div>

        {/* Cache Stats */}
        <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-[#555] uppercase tracking-wider text-[9px] font-sans font-bold">Cache Entries</span>
            <span className="text-[#aaa]">{cacheStats.entries}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[#555] uppercase tracking-wider text-[9px] font-sans font-bold">Cache Hits</span>
            <span className="text-green-400 font-bold">{cacheStats.hits}</span>
          </div>
        </div>

        {/* Refresh Info */}
        <div className="text-center text-[#555] text-[10px] font-medium mt-[-4px]">
          Quota resets in {formatTime(timeUntilRefresh)}
        </div>

      </div>
    </div>
  );

  return (
    <>
      {/* Render Toast Globally */}
      {toastUI}
      
      {/* Hovering Right-Side Tracker */}
      {trackerUI}
    </>
  );
};

export default defineContentScript({
  matches: ['*://chatgpt.com/*', '*://claude.ai/*', '*://gemini.google.com/*'],
  cssInjectionMode: 'ui',
  
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'prompt-shaper-ui',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
