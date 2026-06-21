import { useState, useEffect } from 'react';
import { History, AlertCircle, Settings, BookOpen, Zap } from 'lucide-react';
import './style.css';
import { HistoryList } from '../../components/HistoryList';
import { ProviderSettings } from '../../components/ProviderSettings';
import { PopupStyleSelector } from '../../components/PopupStyleSelector';

type Tab = 'history' | 'style' | 'settings';

function App() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('history');

  useEffect(() => {
    setLoading(true);
    browser.runtime.sendMessage({ action: 'getHistory' })
      .then((data: any) => {
        if (data.success) {
          setStats({ history: data.history });
        } else {
          setStats({ history: [] });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filteredHistory = stats?.history?.filter((h: any) =>
    h.prompt.toLowerCase().includes(search.toLowerCase()) ||
    h.compressed.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'history',    label: 'History',    icon: <History size={16} /> },
    { id: 'style',      label: 'Style',      icon: <BookOpen size={16} /> },
    { id: 'settings',   label: 'Settings',   icon: <Settings size={16} /> },
  ];

  if (loading) {
    return (
      <div className="w-[450px] h-[600px] bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="animate-spin text-blue-500"><Zap size={32} /></div>
      </div>
    );
  }

  if (!stats && activeTab === 'history') {
    return (
      <div className="w-[450px] h-[600px] bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-4 text-[#888]">
        <AlertCircle size={48} className="text-red-500" />
        <p>Failed to load history.</p>
      </div>
    );
  }

  return (
    <div className="w-[450px] h-[600px] bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'history'    && <HistoryList filteredHistory={filteredHistory} search={search} setSearch={setSearch} />}
        {activeTab === 'style'      && <PopupStyleSelector />}
        {activeTab === 'settings'   && <ProviderSettings />}
      </div>

      {/* Tab Navigation */}
      <div className="border-t border-[#222] bg-[#050505] flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 w-full py-2.5 transition-all ${
              activeTab === tab.id ? 'text-blue-400 bg-white/5' : 'text-[#555] hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span className="text-[9px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
