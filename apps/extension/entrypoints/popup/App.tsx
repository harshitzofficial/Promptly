import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, Zap, DollarSign, History, AlertCircle, Settings } from 'lucide-react';
import './style.css';
import { BACKEND_URL } from '../../utils/config';

function SettingsView() {
  const [pricing, setPricing] = useState<any[]>([]);
  const [providerSettings, setProviderSettings] = useState<any>({ preferredProvider: 'gemini', hasOpenAiKey: false, hasAnthropicKey: false, hasGeminiKey: false });
  const [geminiInput, setGeminiInput] = useState('');
  const [openaiInput, setOpenaiInput] = useState('');
  const [anthropicInput, setAnthropicInput] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [savedProvider, setSavedProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/pricing`)
      .then(r => r.json())
      .then(d => { if (d.success) setPricing(d.pricing); })
      .catch(console.error);
    browser.runtime.sendMessage({ action: 'getProviderSettings' })
      .then((res: any) => { if (res.success) setProviderSettings(res.data); })
      .catch(console.error);
  }, []);

  const handleSaveKey = (provider: 'openai' | 'anthropic' | 'gemini') => {
    const key = provider === 'openai' ? openaiInput : provider === 'anthropic' ? anthropicInput : geminiInput;
    if (!key.trim()) return;
    browser.runtime.sendMessage({ action: 'setProviderKey', provider, key: key.trim() })
      .then(() => {
        setProviderSettings((s: any) => ({
          ...s,
          preferredProvider: provider,
          hasOpenAiKey: provider === 'openai' ? true : s.hasOpenAiKey,
          hasAnthropicKey: provider === 'anthropic' ? true : s.hasAnthropicKey,
          hasGeminiKey: provider === 'gemini' ? true : s.hasGeminiKey,
        }));
        if (provider === 'openai') setOpenaiInput('');
        else if (provider === 'anthropic') setAnthropicInput('');
        else setGeminiInput('');
        setSavedProvider(provider);
        setTimeout(() => setSavedProvider(null), 2000);
      });
  };

  const handleRemoveKey = (provider: 'openai' | 'anthropic' | 'gemini') => {
    browser.runtime.sendMessage({ action: 'removeProviderKey', provider })
      .then(() => {
        setProviderSettings((s: any) => ({
          ...s,
          preferredProvider: 'gemini',
          hasOpenAiKey: provider === 'openai' ? false : s.hasOpenAiKey,
          hasAnthropicKey: provider === 'anthropic' ? false : s.hasAnthropicKey,
          hasGeminiKey: provider === 'gemini' ? false : s.hasGeminiKey,
        }));
      });
  };

  const handleSavePricing = (platform: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    fetch(`${BACKEND_URL}/api/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, pricePerMillion: num })
    });
  };

  const updateLocalPricing = (platform: string, val: string) => {
    setPricing(pricing.map(p => p.platform === platform ? { ...p, pricePerMillion: val } : p));
  };

  const providers = [
    {
      id: 'gemini',
      name: 'Gemini 2.5 Flash Lite',
      logo: '✨',
      desc: providerSettings.hasGeminiKey ? 'Your key · Direct API · No server needed' : 'Default · Managed by server · No key needed',
      color: '#a78bfa',
      active: providerSettings.preferredProvider === 'gemini',
      hasKey: providerSettings.hasGeminiKey,
      inputVal: geminiInput,
      setInput: setGeminiInput,
      showKey: showGemini,
      toggleShow: () => setShowGemini(s => !s),
      placeholder: 'AIzaSy...',
      optional: true, // Gemini is optional — server handles it by default
    },
    {
      id: 'openai',
      name: 'GPT-4o mini',
      logo: '🟢',
      desc: 'Your key · Private · Never leaves your browser',
      color: '#10a37f',
      active: providerSettings.preferredProvider === 'openai',
      hasKey: providerSettings.hasOpenAiKey,
      inputVal: openaiInput,
      setInput: setOpenaiInput,
      showKey: showOpenai,
      toggleShow: () => setShowOpenai(s => !s),
      placeholder: 'sk-...',
    },
    {
      id: 'anthropic',
      name: 'Claude Haiku',
      logo: '🟠',
      desc: 'Your key · Private · Never leaves your browser',
      color: '#c96442',
      active: providerSettings.preferredProvider === 'anthropic',
      hasKey: providerSettings.hasAnthropicKey,
      inputVal: anthropicInput,
      setInput: setAnthropicInput,
      showKey: showAnthropic,
      toggleShow: () => setShowAnthropic(s => !s),
      placeholder: 'sk-ant-...',
    }
  ];

  return (
    <div className="p-4 flex flex-col gap-6">

      {/* Compression Provider */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚡</span>
          <h2 className="text-[14px] font-bold">Compression Provider</h2>
        </div>
        <p className="text-xs text-[#666] leading-relaxed -mt-1">
          Choose which AI to use for optimizing your prompts. Your API keys are stored locally and never sent to our server.
        </p>

        <div className="flex flex-col gap-2">
          {providers.map(p => (
            <div key={p.id} className={`bg-[#111] border rounded-xl p-3 flex flex-col gap-2 transition-colors ${p.active ? 'border-[#333] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]' : 'border-[#1c1c1c]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{p.logo}</span>
                  <div>
                    <div className="text-[13px] font-bold text-white flex items-center gap-1.5">
                      {p.name}
                      {p.active && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold tracking-wider uppercase" style={{ background: p.color + '22', color: p.color }}>Active</span>}
                    </div>
                    <div className="text-[10px] text-[#555] mt-0.5">{p.desc}</div>
                  </div>
                </div>
                {/* Gemini: no action needed. Others: show key status */}
                {'hasKey' in p && (
                  p.hasKey
                    ? <button onClick={() => handleRemoveKey(p.id as any)} className="text-[10px] text-red-500/70 hover:text-red-400 border border-red-500/20 px-2 py-1 rounded-lg transition-colors">Remove</button>
                    : null
                )}
              </div>

              {/* Key input — shown when provider supports key entry and no key saved yet */}
              {'inputVal' in p && !p.hasKey && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {p.optional && (
                    <p className="text-[10px] text-[#555] leading-tight">
                      Optional — paste your own key to bypass the server entirely.
                    </p>
                  )}
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type={p.showKey ? 'text' : 'password'}
                        value={p.inputVal}
                        onChange={e => p.setInput(e.target.value)}
                        placeholder={p.placeholder}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-[#444] transition-colors pr-8"
                      />
                      <button onClick={p.toggleShow} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] text-[10px]">
                        {p.showKey ? '🙈' : '👁'}
                      </button>
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

              {/* Already has key — show masked version */}
              {'hasKey' in p && p.hasKey && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-[#555] bg-[#0a0a0a] px-2 py-1 rounded border border-[#1f1f1f]">••••••••••••••••</span>
                  <span className="text-[10px]" style={{ color: p.color }}>✓ Key saved</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1a1a1a]" />

      {/* Pricing Config */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={18} className="text-blue-500" />
          <h2 className="text-[14px] font-bold">API Pricing Configuration</h2>
        </div>
        <p className="text-xs text-[#666] leading-relaxed -mt-1">
          Set costs per 1M tokens to accurately calculate how much money you save.
        </p>

        <div className="flex flex-col gap-2">
          {pricing.map(p => (
            <div key={p.platform} className="bg-[#111] border border-[#1c1c1c] p-3 rounded-xl flex items-center justify-between hover:border-[#2a2a2a] transition-colors">
              <div>
                <span className="text-[13px] capitalize font-bold text-white">
                  {p.platform === 'default' ? 'Fallback Model' : p.platform}
                </span>
                <p className="text-[10px] text-[#555] mt-0.5">Cost per 1M Input Tokens</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#555] font-bold text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={p.pricePerMillion}
                  onChange={e => updateLocalPricing(p.platform, e.target.value)}
                  onBlur={() => handleSavePricing(p.platform, String(p.pricePerMillion))}
                  className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm w-20 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-right"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardView({ stats, search, setSearch, filteredHistory, selectedDays, setSelectedDays }: any) {
  const rangeLabel = RANGE_OPTIONS.find(r => r.days === selectedDays)?.label || '7D';
  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#222] p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">
          <Zap size={18} />
        </div>
        <div>
          <h1 className="font-bold text-[15px] leading-tight">Prompt Shaper</h1>
          <p className="text-[11px] text-[#888]">Analytics Dashboard</p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        
        {/* Hero Stat: Total Money Saved */}
        <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-[#222] rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full"></div>
          
          <div className="flex items-center gap-2 text-[#aaa] font-medium mb-2 z-10 text-sm">
            <DollarSign size={16} className="text-green-500" /> Total Estimated Savings
          </div>
          <div className="text-5xl font-bold tracking-tight text-white z-10 flex items-start gap-1">
            <span className="text-2xl text-green-500 mt-1">$</span>
            {stats.totalMoneySaved.toFixed(2)}
          </div>
        </div>

        {/* Chart: Tokens Saved Over Time */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#666]">Tokens Saved ({rangeLabel})</h2>
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  onClick={() => setSelectedDays(opt.days)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                    selectedDays === opt.days
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-[#555] hover:text-[#999]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} width={35} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Line type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* History Table */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-end">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#666] flex items-center gap-1.5">
              <History size={14} /> Optimization History
            </h2>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666]" />
              <input 
                type="text" 
                placeholder="Search prompts..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#111] border border-[#333] text-[11px] rounded px-2 py-1 pl-6 focus:outline-none focus:border-blue-500 w-[140px] transition-colors"
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
                    {h.costSaved > 0 && (
                      <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-bold">
                        ${h.costSaved.toFixed(4)}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-[#ccc] line-clamp-2 leading-relaxed">
                    "{h.prompt}"
                  </div>
                  
                  <div className="flex items-center gap-3 pt-1 border-t border-[#222] mt-1">
                    <div className="text-[10px] text-[#666]">
                      <span className="text-white font-medium">{h.originalTokens}</span> tokens → <span className="text-blue-400 font-medium">{h.optimizedTokens}</span> tokens
                    </div>
                    <div className="text-[10px] text-[#666]">
                      Saved <span className="text-green-500 font-medium">{Math.round(((h.originalTokens - h.optimizedTokens) / h.originalTokens) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </>
  );
}

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

function App() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/stats?days=${selectedDays}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStats(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, selectedDays]); // Refetch on tab switch or range change

  if (loading) {
    return (
      <div className="w-[450px] h-[600px] bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="animate-spin text-blue-500"><Zap size={32} /></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-[450px] h-[600px] bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-4 text-[#888]">
        <AlertCircle size={48} className="text-red-500" />
        <p>Failed to connect to backend.</p>
      </div>
    );
  }

  const filteredHistory = stats.history.filter((h: any) => 
    h.prompt.toLowerCase().includes(search.toLowerCase()) || 
    h.compressed.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-[450px] h-[600px] bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'dashboard' ? (
          <DashboardView
            stats={stats}
            search={search}
            setSearch={setSearch}
            filteredHistory={filteredHistory}
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
          />
        ) : (
          <SettingsView />
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-t border-[#222] bg-[#050505] flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-full py-3 ${activeTab === 'dashboard' ? 'text-blue-400 bg-white/5' : 'text-[#666] hover:text-white hover:bg-white/5'} transition-all`}
        >
          <Zap size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`flex flex-col items-center justify-center gap-1.5 w-full py-3 ${activeTab === 'settings' ? 'text-blue-400 bg-white/5' : 'text-[#666] hover:text-white hover:bg-white/5'} transition-all`}
        >
          <Settings size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
        </button>
      </div>
    </div>
  );
}

export default App;
