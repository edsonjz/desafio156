import React from 'react';
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  Receipt,
  Ticket,
  Trophy,
  Star,
  Disc,
  Target,
  Gift,
  BarChart3,
  Tv,
  Settings,
  ShieldAlert,
  Sliders,
  FileCheck
} from 'lucide-react';

export default function Sidebar({ activeTab, onNavigate }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'prova-iptu', label: 'Prova IPTU', icon: FileCheck, badge: 'NOVO' },
    { id: 'operadores', label: 'Operadores', icon: Users },
    { id: 'pontos', label: 'Pontuação', icon: PlusCircle },
    { id: 'extrato', label: 'Extrato', icon: Receipt },
    { id: 'bilhetes', label: 'Bilhetes', icon: Ticket },
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'destaques', label: 'Destaques', icon: Star },
    { id: 'roleta', label: 'Roleta 156', icon: Disc, badge: 'PROMO' },
    { id: 'desafios', label: 'Desafios', icon: Target },
    { id: 'premios', label: 'Prêmios', icon: Gift },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'tv', label: 'Modo TV', icon: Tv, highlight: true },
    { id: 'regras', label: 'Regras', icon: Sliders },
    { id: 'auditoria', label: 'Auditoria', icon: ShieldAlert },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-57px)]">
      <div className="p-4 border-b border-slate-800">
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">Painel do Supervisor</div>
        <div className="text-sm font-bold text-amber-400">Operação 156</div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? item.highlight
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-amber-500/40">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
        Desafio 156 &copy; 2026 Operação 156
      </div>
    </aside>
  );
}
