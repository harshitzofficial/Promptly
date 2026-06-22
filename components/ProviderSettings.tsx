import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Bot, Eye, EyeOff } from 'lucide-react';

export const ProviderSettings = () => {
  const [providerSettings, setProviderSettings] = useState<any>({ preferredProvider: null, hasOpenAiKey: false, hasAnthropicKey: false, hasGeminiKey: false, hasOllamaModel: false, ollamaModel: null });
  const [geminiInput, setGeminiInput] = useState('');
  const [openaiInput, setOpenaiInput] = useState('');
  const [anthropicInput, setAnthropicInput] = useState('');
  const [ollamaInput, setOllamaInput] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [savedProvider, setSavedProvider] = useState<string | null>(null);

  useEffect(() => {
    browser.runtime.sendMessage({ action: 'getProviderSettings' })
      .then((res: any) => { if (res.success) setProviderSettings(res.data); })
      .catch(console.error);
  }, []);

  const handleSaveKey = (provider: 'openai' | 'anthropic' | 'gemini' | 'ollama') => {
    const key = provider === 'openai' ? openaiInput : provider === 'anthropic' ? anthropicInput : provider === 'ollama' ? ollamaInput : geminiInput;
    if (!key.trim()) return;
    browser.runtime.sendMessage({ action: 'setProviderKey', provider, key: key.trim() })
      .then(() => {
        setProviderSettings((s: any) => ({
          ...s,
          preferredProvider: provider,
          hasOpenAiKey: provider === 'openai' ? true : s.hasOpenAiKey,
          hasAnthropicKey: provider === 'anthropic' ? true : s.hasAnthropicKey,
          hasGeminiKey: provider === 'gemini' ? true : s.hasGeminiKey,
          hasOllamaModel: provider === 'ollama' ? true : s.hasOllamaModel,
          ollamaModel: provider === 'ollama' ? key.trim() : s.ollamaModel,
        }));
        if (provider === 'openai') setOpenaiInput('');
        else if (provider === 'anthropic') setAnthropicInput('');
        else if (provider === 'ollama') setOllamaInput('');
        else setGeminiInput('');
        setSavedProvider(provider);
        setTimeout(() => setSavedProvider(null), 2000);
      });
  };

  const handleRemoveKey = (provider: 'openai' | 'anthropic' | 'gemini' | 'ollama') => {
    browser.runtime.sendMessage({ action: 'removeProviderKey', provider })
      .then(() => {
        setProviderSettings((s: any) => ({
          ...s,
          preferredProvider: null,
          hasOpenAiKey: provider === 'openai' ? false : s.hasOpenAiKey,
          hasAnthropicKey: provider === 'anthropic' ? false : s.hasAnthropicKey,
          hasGeminiKey: provider === 'gemini' ? false : s.hasGeminiKey,
          hasOllamaModel: provider === 'ollama' ? false : s.hasOllamaModel,
          ollamaModel: provider === 'ollama' ? null : s.ollamaModel,
        }));
      });
  };

  const providers = [
    {
      id: 'ollama', name: 'Ollama (Local AI)', icon: <Bot size={18} className="text-[#3b82f6]" />,
      desc: providerSettings.hasOllamaModel ? '100% Free · Runs locally · No internet needed' : '100% Free · Runs locally · No internet needed',
      color: '#3b82f6', active: providerSettings.preferredProvider === 'ollama',
      hasKey: providerSettings.hasOllamaModel, inputVal: ollamaInput, setInput: setOllamaInput,
      showKey: true, toggleShow: () => {}, placeholder: 'e.g. llama3', isModelName: true
    },
    {
      id: 'gemini', name: 'Gemini 2.5 Flash Lite', icon: <Bot size={18} className="text-[#a78bfa]" />,
      desc: 'Your key · Direct API · Never leaves your browser',
      color: '#a78bfa', active: providerSettings.preferredProvider === 'gemini',
      hasKey: providerSettings.hasGeminiKey, inputVal: geminiInput, setInput: setGeminiInput,
      showKey: showGemini, toggleShow: () => setShowGemini(s => !s), placeholder: 'AIzaSy...', optional: false,
    },
    {
      id: 'openai', name: 'GPT-4o mini', icon: <Bot size={18} className="text-[#10a37f]" />,
      desc: 'Your key · Private · Never leaves your browser',
      color: '#10a37f', active: providerSettings.preferredProvider === 'openai',
      hasKey: providerSettings.hasOpenAiKey, inputVal: openaiInput, setInput: setOpenaiInput,
      showKey: showOpenai, toggleShow: () => setShowOpenai(s => !s), placeholder: 'sk-...',
    },
    {
      id: 'anthropic', name: 'Claude Haiku', icon: <Bot size={18} className="text-[#c96442]" />,
      desc: 'Your key · Private · Never leaves your browser',
      color: '#c96442', active: providerSettings.preferredProvider === 'anthropic',
      hasKey: providerSettings.hasAnthropicKey, inputVal: anthropicInput, setInput: setAnthropicInput,
      showKey: showAnthropic, toggleShow: () => setShowAnthropic(s => !s), placeholder: 'sk-ant-...',
    }
  ];

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={18} className="text-gray-400" />
          <h2 className="text-[14px] font-bold">Choose Provider</h2>
        </div>
        <p className="text-xs text-[#666] leading-relaxed -mt-1">
          Choose which AI to use for expanding and perfecting your prompts. Your API keys are stored locally and never sent to our server.
        </p>
        <div className="flex flex-col gap-2">
          {providers.map(p => (
            <div key={p.id} className={`bg-[#111] border rounded-xl p-3 flex flex-col gap-2 transition-colors ${p.active ? 'border-[#333] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]' : 'border-[#1c1c1c]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-6 h-6">{p.icon}</div>
                  <div>
                    <div className="text-[13px] font-bold text-white flex items-center gap-1.5">
                      {p.name}
                      {p.active && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold tracking-wider uppercase" style={{ background: p.color + '22', color: p.color }}>Active</span>}
                    </div>
                    <div className="text-[10px] text-[#555] mt-0.5">{p.desc}</div>
                  </div>
                </div>
                {'hasKey' in p && p.hasKey && (
                  <button onClick={() => handleRemoveKey(p.id as any)} className="text-[10px] text-red-500/70 hover:text-red-400 border border-red-500/20 px-2 py-1 rounded-lg transition-colors">Remove</button>
                )}
              </div>
              {'inputVal' in p && !p.hasKey && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {p.optional && <p className="text-[10px] text-[#555] leading-tight">Optional — paste your own key to bypass the server entirely.</p>}
                  {'isModelName' in p && p.isModelName && <p className="text-[10px] text-[#555] leading-tight">Enter the name of the model you downloaded (e.g., llama3). Ensure Ollama is running.</p>}
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type={('isModelName' in p && p.isModelName) || p.showKey ? 'text' : 'password'}
                        value={p.inputVal}
                        onChange={e => p.setInput(e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-[#444] transition-colors pr-8"
                      />
                      {!('isModelName' in p && p.isModelName) && (
                        <button onClick={p.toggleShow} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]">
                          {p.showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleSaveKey(p.id as any)}
                      disabled={!p.inputVal?.trim()}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}44` }}
                    >
                      {savedProvider === p.id ? '✓ Saved!' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
              {'hasKey' in p && p.hasKey && (
                <div className="flex items-center gap-2 mt-0.5">
                  {'isModelName' in p && p.isModelName ? (
                    <span className="text-[10px] font-mono text-[#555] bg-[#0a0a0a] px-2 py-1 rounded border border-[#1f1f1f]">{providerSettings.ollamaModel}</span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#555] bg-[#0a0a0a] px-2 py-1 rounded border border-[#1f1f1f]">••••••••••••••••</span>
                  )}
                  <span className="text-[10px]" style={{ color: p.color }}>✓ {'isModelName' in p && p.isModelName ? 'Model saved' : 'Key saved'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
