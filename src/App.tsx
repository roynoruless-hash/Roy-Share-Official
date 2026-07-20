import React, { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import BotSimulator from './components/BotSimulator';
import { Bot } from './types';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function App() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [activeBot, setActiveBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch registered bots on mount
  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bots');
      const data = await res.json();
      if (data.success) {
        setBots(data.bots);
        // Default to first active bot if none selected
        if (data.bots.length > 0 && !activeBot) {
          setActiveBot(data.bots[0]);
        } else if (activeBot) {
          // Sync state if bot attributes updated
          const updated = data.bots.find((b: Bot) => b.id === activeBot.id);
          if (updated) setActiveBot(updated);
        }
      } else {
        setError('Failed to fetch registered bots from database API.');
      }
    } catch (err) {
      setError('Could not connect to full-stack backend. Please verify your Express dev server is running on Port 3000.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBotCreated = (newBot: Bot) => {
    setBots(prev => [...prev, newBot]);
    setActiveBot(newBot);
  };

  const handleSelectBot = (bot: Bot | null) => {
    setActiveBot(bot);
  };

  if (isLoading && bots.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <h2 className="text-sm font-semibold tracking-wider font-display uppercase">Booting Roy Share Ecosystem...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full p-6 bg-slate-900 rounded-2xl border border-rose-900/30 text-center space-y-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold font-display text-rose-400">Connection Failure</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {error}
            </p>
          </div>
          <button 
            onClick={fetchBots}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 rounded-lg transition"
          >
            Retry Connection Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* LEFT COLUMN: Admin Dashboard */}
      <div className="w-full md:w-3/5 h-1/2 md:h-screen overflow-hidden flex flex-col border-b md:border-b-0 md:border-r border-slate-800">
        <AdminPanel 
          bots={bots}
          activeBot={activeBot}
          onSelectBot={handleSelectBot}
          onRefreshBots={fetchBots}
          onBotCreated={handleBotCreated}
        />
      </div>

      {/* RIGHT COLUMN: Telegram Client Emulator / Mini App */}
      <div className="w-full md:w-2/5 h-1/2 md:h-screen overflow-hidden flex flex-col">
        <BotSimulator 
          activeBot={activeBot}
          onRefreshBots={fetchBots}
        />
      </div>
    </div>
  );
}
