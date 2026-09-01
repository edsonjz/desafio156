import React from 'react';
import { LogOut, Monitor, ShieldCheck, Flame, Clock } from 'lucide-react';

export default function Navbar({ user, campaign, onLogout, onNavigate, activeTab }) {
  return (
    <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-amber-500/20">
          <Flame className="w-5 h-5 text-slate-950 animate-pulse" />
          <span className="tracking-wider text-sm font-extrabold">DESAFIO 156</span>
        </div>
        
        {campaign && (
          <div className="hidden md:flex items-center gap-2 bg-slate-900/60 border border-slate-700 px-3 py-1 rounded-full text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>01/09/2026 → 11/12/2026</span>
            <span className="text-slate-500">|</span>
            <span className={`font-bold ${campaign.isLocked ? 'text-rose-400' : 'text-emerald-400'}`}>
              {campaign.isLocked ? '🔒 Encerramento Concluído' : `${campaign.daysRemaining} dias restantes`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('tv')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'tv'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600'
          }`}
          title="Modo TV para exibição em tela cheia na operação"
        >
          <Monitor className="w-4 h-4 text-purple-300" />
          <span className="hidden sm:inline">Modo TV</span>
        </button>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1 rounded-lg text-xs">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <div className="flex flex-col">
            <span className="font-semibold text-slate-200">{user?.username || 'Administrador'}</span>
            <span className="text-[10px] text-slate-400">Supervisão 156</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          title="Sair do sistema"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
