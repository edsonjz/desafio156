import React, { useEffect, useState } from 'react';
import {
  Users,
  Sparkles,
  Ticket,
  Disc,
  Gift,
  Trophy,
  Clock,
  PlusCircle,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Tv
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '../services/api';

export default function DashboardView({ onNavigate, campaign }) {
  const [reportData, setReportData] = useState(null);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rep, ops] = await Promise.all([
        apiFetch('/reports/summary'),
        apiFetch('/operators?status=active')
      ]);
      setReportData(rep);
      setOperators(ops);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const topOperator = operators.length > 0 ? operators[0] : null;

  return (
    <div className="space-y-6">
      {/* Title & Subtitle Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Performance, reconhecimento e chances de conquistar sua folga de Natal e Ano Novo</span>
            </div>
            
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>🎯 DESAFIO 156</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Período Oficial da Campanha: <strong className="text-slate-200">01/09/2026 → 11/12/2026</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('pontos')}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Lançar Pontos</span>
            </button>
            
            <button
              onClick={() => onNavigate('tv')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 transition"
            >
              <Tv className="w-4 h-4" />
              <span>Abrir Modo TV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7 Main Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* Card 1: Operadores */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Operadores</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {reportData?.metrics.activeOperators || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {reportData?.metrics.participatingOperators || 0} pontuaram
          </div>
        </div>

        {/* Card 2: Pontos Distribuidos */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Pontos Lançados</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            +{reportData?.metrics.positivePoints || 0}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-rose-400 mt-1 font-semibold">
            <ArrowDownRight className="w-3 h-3" />
            <span>-{reportData?.metrics.negativePoints || 0} neg.</span>
          </div>
        </div>

        {/* Card 3: Bilhetes Conquistados */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Bilhetes</span>
            <Ticket className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {reportData?.metrics.totalTickets || 0}
          </div>
          <div className="text-[11px] text-amber-300 font-semibold mt-1">
            50 pts = 1 bilhete
          </div>
        </div>

        {/* Card 4: Rodadas da Roleta */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Roleta 156</span>
            <Disc className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">
            {reportData?.rouletteBreakdown.reduce((acc, r) => acc + r.count, 0) || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Giros efetuados
          </div>
        </div>

        {/* Card 5: Premios Entregues */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Prêmios</span>
            <Gift className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">
            {reportData?.rouletteBreakdown.find(r => r.prize.includes('Pausa') || r.prize.includes('Saída'))?.count || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Recompensas
          </div>
        </div>

        {/* Card 6: Maior Pontuação */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg col-span-1 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>1º Lugar</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-base font-extrabold text-white truncate" title={topOperator?.name || '-'}>
            {topOperator?.name ? topOperator.name.split(' ')[0] : '-'}
          </div>
          <div className="text-[11px] font-bold text-amber-400 mt-1">
            {topOperator ? `${topOperator.totalPoints} pts (${topOperator.totalTickets} 🎟️)` : '0 pts'}
          </div>
        </div>

        {/* Card 7: Dias Restantes */}
        <div className="bg-gradient-to-br from-amber-500/20 to-slate-800 border border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between shadow-lg col-span-1 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between text-amber-300 text-xs font-semibold mb-2">
            <span>Encerramento</span>
            <Clock className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-2xl font-black text-amber-300">
            {campaign?.daysRemaining || 0}d
          </div>
          <div className="text-[11px] text-amber-200/80 mt-1 font-semibold">
            {campaign?.isLocked ? 'Encerrada' : 'Contagem Ativa'}
          </div>
        </div>
      </div>

      {/* Middle Section: Evolution Chart & Top 5 Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📈 Evolução da Pontuação na Campanha</span>
              </h3>
              <p className="text-xs text-slate-400">Acúmulo total de pontos ao longo do período</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {reportData?.evolution && reportData.evolution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportData.evolution}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorCumulative)" name="Pontos Acumulados" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">
                Nenhum dado de evolução registrado ainda.
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Preview */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Top 5 Operadores</span>
            </h3>
            <button
              onClick={() => onNavigate('ranking')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>Ver Ranking</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {reportData?.top5.map((op) => (
              <div
                key={op.id}
                onClick={() => onNavigate(`operador-${op.id}`)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-amber-500/40 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 text-xs font-black flex items-center justify-center border border-amber-500/30">
                    {op.rank}º
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-100">{op.name}</div>
                    <div className="text-[10px] text-slate-400">{op.registration}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-amber-400">{op.totalPoints} pts</div>
                  <div className="text-[10px] font-semibold text-slate-400">{op.tickets} bilhetes</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
