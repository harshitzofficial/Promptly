import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, Zap, DollarSign, History, AlertCircle, Settings } from 'lucide-react';
import './style.css';

function SettingsView() {
  const [pricing, setPricing] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3005/api/pricing')
      .then(r => r.json())
      .then(d => { if (d.success) setPricing(d.pricing); })
      .catch(console.error);
  }, []);

  const handleSave = (platform: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    fetch('http://localhost:3005/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, pricePerMillion: num })
    });
  };

  const updateLocalPricing = (platform: string, val: string) => {
    setPricing(pricing.map(p => p.platform === platform ? { ...p, pricePerMillion: val } : p));
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings size={20} className="text-blue-500" />
        <h2 className="text-lg font-bold">API Pricing Configuration</h2>
      </div>
      <p className="text-xs text-[#888] leading-relaxed">
        Set your own costs per 1 Million tokens. This configures the cost calculator to show exactly how much money you save based on your real API expenses.
      </p>

      <div className="flex flex-col gap-3">
        {pricing.map(p => (
          <div key={p.platform} className="bg-[#111] border border-[#222] p-4 rounded-xl flex items-center justify-between hover:border-[#333] transition-colors shadow-sm">
            <div>
              <span className="text-[13px] capitalize font-bold text-white tracking-wide">
                {p.platform === 'default' ? 'Fallback Model' : p.platform}
              </span>
              <p className="text-[10px] text-[#666] mt-0.5">Cost per 1M Input Tokens</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#888] font-bold text-sm">$</span>
              <input
                type="number"
                step="0.01"
                value={p.pricePerMillion}
                onChange={e => updateLocalPricing(p.platform, e.target.value)}
                onBlur={() => handleSave(p.platform, String(p.pricePerMillion))}
                className="bg-[#0a0a0a] border border-[#333] rounded-lg px-2 py-1.5 text-sm w-20 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors shadow-inner text-right"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardView({ stats, search, setSearch, filteredHistory }: any) {
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#666] mb-4">Tokens Saved (Last 7 Days)</h2>
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${h.method === 'llmlingua' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
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

function App() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');

  useEffect(() => {
    fetch('http://localhost:3005/api/stats')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStats(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]); // Refetch stats when switching back to dashboard

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
          <DashboardView stats={stats} search={search} setSearch={setSearch} filteredHistory={filteredHistory} />
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
