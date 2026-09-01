import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Search, Filter, ArrowUpRight, ArrowDownRight, Ticket, Sparkles } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function RankingView({ onNavigate, showToast }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState('all'); // all, month, week, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, [period, startDate, endDate]);

  const loadRanking = async () => {
    setLoading(true);
    try {
      let url = `/ranking?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const data = await apiFetch(url);
      setLeaderboard(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredList = leaderboard.filter(op =>
    op.name.toLowerCase().includes(search.toLowerCase()) ||
    op.registration.toLowerCase().includes(search.toLowerCase())
  );

  const top1 = leaderboard.length > 0 ? leaderboard[0] : null;
  const top2 = leaderboard.length > 1 ? leaderboard[1] : null;
  const top3 = leaderboard.length > 2 ? leaderboard[2] : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <span>🏆 Ranking de Desempenho e Pontuação</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Classificação geral e por período dos operadores da Operação 156
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              period === 'all' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Campanha Inteira
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              period === 'month' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              period === 'week' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Top 3 Podium Display */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* 2nd Place */}
          {top2 && (
            <div
              onClick={() => onNavigate(`operador-${top2.id}`)}
              className="bg-slate-900 border border-slate-700/80 hover:border-slate-400 rounded-2xl p-5 shadow-xl flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-1 relative order-2 md:order-1"
            >
              <div className="text-center mb-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-400/20 text-slate-200 text-2xl font-black flex items-center justify-center mx-auto mb-2 border border-slate-400/40">
                  🥈
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">2º Lugar</div>
                <div className="text-lg font-black text-white mt-1">{top2.name}</div>
                <div className="text-xs font-mono text-slate-400">{top2.registration}</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-slate-200">{top2.totalPoints} pts</div>
                <div className="text-xs font-semibold text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                  <Ticket className="w-3.5 h-3.5" />
                  <span>{top2.tickets} bilhetes</span>
                </div>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top1 && (
            <div
              onClick={() => onNavigate(`operador-${top1.id}`)}
              className="bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-900 border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl p-6 shadow-2xl flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-2 relative order-1 md:order-2"
            >
              <div className="absolute top-3 right-3 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>LÍDER DA CAMPANHA</span>
              </div>

              <div className="text-center mb-3 pt-2">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/30 text-amber-300 text-3xl font-black flex items-center justify-center mx-auto mb-2 border-2 border-amber-500/60 shadow-lg shadow-amber-500/20">
                  🥇
                </div>
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider">1º Lugar</div>
                <div className="text-xl font-black text-white mt-1">{top1.name}</div>
                <div className="text-xs font-mono text-slate-400">{top1.registration}</div>
              </div>

              <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-amber-400">{top1.totalPoints} pts</div>
                <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1 mt-1">
                  <Ticket className="w-4 h-4" />
                  <span>{top1.tickets} bilhetes conquistados</span>
                </div>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3 && (
            <div
              onClick={() => onNavigate(`operador-${top3.id}`)}
              className="bg-slate-900 border border-amber-700/50 hover:border-amber-600 rounded-2xl p-5 shadow-xl flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-1 relative order-3"
            >
              <div className="text-center mb-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-700/20 text-amber-400 text-2xl font-black flex items-center justify-center mx-auto mb-2 border border-amber-700/40">
                  🥉
                </div>
                <div className="text-xs font-bold text-amber-500 uppercase tracking-wider">3º Lugar</div>
                <div className="text-lg font-black text-white mt-1">{top3.name}</div>
                <div className="text-xs font-mono text-slate-400">{top3.registration}</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-amber-300">{top3.totalPoints} pts</div>
                <div className="text-xs font-semibold text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                  <Ticket className="w-3.5 h-3.5" />
                  <span>{top3.tickets} bilhetes</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no ranking..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4 text-center">Posição</th>
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4">Matrícula</th>
                <th className="py-3.5 px-4">Pontuação Total</th>
                <th className="py-3.5 px-4">Pontos Positivos</th>
                <th className="py-3.5 px-4">Pontos Negativos</th>
                <th className="py-3.5 px-4">Bilhetes Conquistados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Carregando ranking...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Nenhum operador encontrado no ranking.
                  </td>
                </tr>
              ) : (
                filteredList.map((op) => (
                  <tr
                    key={op.id}
                    onClick={() => onNavigate(`operador-${op.id}`)}
                    className="hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 text-center font-black text-sm">
                      {op.medal ? (
                        <span className="text-lg">{op.medal}</span>
                      ) : (
                        <span className="text-slate-400">{op.position}º</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white">
                      {op.name}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {op.registration}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-black text-sm ${op.totalPoints < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {op.totalPoints > 0 ? `+${op.totalPoints}` : op.totalPoints} pts
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      +{op.positivePoints}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-rose-400">
                      {op.negativePoints < 0 ? op.negativePoints : `-${op.negativePoints}`}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 font-bold text-slate-200">
                        <Ticket className="w-4 h-4 text-amber-400" />
                        <span>{op.tickets} bilhetes</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
