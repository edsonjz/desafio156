import React, { useState, useEffect } from 'react';
import { Trophy, Ticket, Disc, Star, Clock, Flame, X, Maximize2 } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function TVModeView({ onExit, campaign }) {
  const [reportData, setReportData] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [rep, hl] = await Promise.all([
        apiFetch('/reports/summary'),
        apiFetch('/highlights')
      ]);
      setReportData(rep);
      setHighlights(hl);
    } catch (err) {
      console.error('Failed to load TV data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 overflow-hidden font-sans select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black flex items-center justify-center text-3xl shadow-xl shadow-amber-500/20">
            <Flame className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>🎯 DESAFIO 156</span>
              <span className="text-amber-400 text-lg sm:text-xl font-bold">| MURAL DA OPERAÇÃO</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
              Campanha de Performance &amp; Incentivo • 01/09/2026 → 11/12/2026
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Days Countdown */}
          <div className="bg-amber-500/10 border border-amber-500/30 px-5 py-2.5 rounded-2xl text-right">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Contagem Regressiva</div>
            <div className="text-2xl font-black text-amber-300 flex items-center gap-1.5 justify-end">
              <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
              <span>{campaign?.daysRemaining || 0} DIAS RESTANTES</span>
            </div>
          </div>

          <button
            onClick={onExit}
            className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-2xl transition"
            title="Sair do Modo TV"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content Grid: TOP 5 & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
        {/* TOP 5 Leaderboard (Left Side) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
            <h2 className="text-2xl font-black text-amber-400 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
              <span>🏆 RANKING TOP 5 OPERADORES</span>
            </h2>
            <span className="text-xs font-mono font-bold text-slate-400 uppercase">Atualização ao Vivo</span>
          </div>

          <div className="space-y-4">
            {reportData?.top5.map((op, idx) => {
              const medals = ['🥇', '🥈', '🥉', '4º', '5º'];
              const isFirst = idx === 0;

              return (
                <div
                  key={op.id}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition ${
                    isFirst
                      ? 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/10 border-amber-500/60 shadow-xl'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black w-10 text-center">{medals[idx]}</span>
                    <div>
                      <div className={`text-lg font-black ${isFirst ? 'text-amber-300 text-xl' : 'text-white'}`}>
                        {op.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400">Matrícula: {op.registration}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-xl font-black ${isFirst ? 'text-amber-400 text-2xl' : 'text-slate-200'}`}>
                      {op.totalPoints} pts
                    </div>
                    <div className="text-xs font-bold text-amber-400/90 flex items-center justify-end gap-1 mt-0.5">
                      <Ticket className="w-3.5 h-3.5" />
                      <span>{op.tickets} bilhetes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side Stats & Highlights */}
        <div className="lg:col-span-5 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl text-center">
              <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <div className="text-3xl font-black text-white">{reportData?.metrics.totalTickets || 0}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Bilhetes Conquistados</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl text-center">
              <Disc className="w-10 h-10 text-purple-400 mx-auto mb-2" />
              <div className="text-3xl font-black text-purple-300">
                {reportData?.rouletteBreakdown.reduce((acc, r) => acc + r.count, 0) || 0}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Rodadas da Roleta</div>
            </div>
          </div>

          {/* Destaques da Semana Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Star className="w-6 h-6 text-amber-400" />
              <span>🌟 DESTAQUES DA SEMANA</span>
            </h3>

            <div className="space-y-3">
              {highlights.slice(0, 3).map((hl) => (
                <div key={hl.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⭐</span>
                    <div>
                      <div className="text-xs font-bold text-white">{hl.operator_name}</div>
                      <div className="text-[10px] text-amber-300 font-semibold">{hl.category}</div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-400">+{hl.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Ticker */}
      <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs text-slate-400 font-semibold">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span>SISTEMA DE CAMPANHA OPERAÇÃO 156 • EXIBIÇÃO AO VIVO</span>
        </div>
        <div>Folga Natal &amp; Ano Novo</div>
      </div>
    </div>
  );
}
