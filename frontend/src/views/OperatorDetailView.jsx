import React, { useState, useEffect } from 'react';
import {
  User,
  Ticket,
  Trophy,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Disc,
  Gift,
  Star,
  Receipt,
  ArrowLeft,
  Flame
} from 'lucide-react';
import { apiFetch } from '../services/api';

export default function OperatorDetailView({ operatorId, onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('extrato'); // extrato, bilhetes, premios, destaques

  useEffect(() => {
    if (operatorId) {
      loadOperator();
    }
  }, [operatorId]);

  const loadOperator = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/operators/${operatorId}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load operator profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const { operator, stats, transactions, tickets, prizes, highlights } = data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para Operadores</span>
      </button>

      {/* Operator Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {stats.hasDoublePoints && (
          <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[10px] uppercase px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
            <Flame className="w-3.5 h-3.5 fill-slate-950" />
            <span>Pontos em Dobro Ativo!</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 text-2xl font-black flex items-center justify-center shadow-lg">
              {operator.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{operator.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  operator.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                }`}>
                  {operator.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Matrícula: {operator.registration}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right bg-slate-900/80 border border-slate-700 px-4 py-2.5 rounded-xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Posição no Ranking</div>
              <div className="text-xl font-black text-amber-400 flex items-center justify-end gap-1.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>{stats.rankPosition}º Lugar</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
        {/* Card 1: Pontuação */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Pontuação Acumulada</div>
          <div className={`text-2xl font-black mt-1 ${stats.totalPoints < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
            {stats.totalPoints > 0 ? `+${stats.totalPoints}` : stats.totalPoints} pts
          </div>
        </div>

        {/* Card 2: Bilhetes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Bilhetes Conquistados</div>
          <div className="text-2xl font-black text-white flex items-center gap-1.5 mt-1">
            <Ticket className="w-6 h-6 text-amber-400" />
            <span>{stats.totalTickets}</span>
          </div>
        </div>

        {/* Card 3: Próximo Bilhete */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Próximo Bilhete</div>
          <div className="text-xs font-bold text-amber-300 mt-1">
            Faltam {stats.pointsToNextTicket} pts
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${(stats.currentTicketProgress / 50) * 100}%` }}
            />
          </div>
        </div>

        {/* Card 4: Ganhos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-400">Ganhos</div>
          <div className="text-sm font-black text-emerald-400 mt-1">+{stats.pointsGained}</div>
        </div>

        {/* Card 5: Perdas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-400">Perdas</div>
          <div className="text-sm font-black text-rose-400 mt-1">-{stats.pointsLost}</div>
        </div>

        {/* Card 6: Roleta */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-400">Roleta</div>
          <div className="text-sm font-black text-purple-300 mt-1">{stats.rouletteSpins}</div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('extrato')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'extrato' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Extrato de Pontos ({transactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bilhetes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'bilhetes' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Bilhetes Físicos ({tickets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('premios')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'premios' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Prêmios Operacionais ({prizes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('destaques')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'destaques' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Destaques da Semana ({highlights.length})</span>
        </button>
      </div>

      {/* Tab 1: Extrato de Pontos (Bank Statement Style) */}
      {activeTab === 'extrato' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              🧾 Extrato Bancário de Pontuações
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Saldo Atual: <strong className="text-amber-400">{stats.totalPoints} pts</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-3 px-4">Data do Evento</th>
                  <th className="py-3 px-4">Descrição do Lançamento</th>
                  <th className="py-3 px-4">Movimentação</th>
                  <th className="py-3 px-4">Saldo Anterior</th>
                  <th className="py-3 px-4">Novo Saldo</th>
                  <th className="py-3 px-4">Observação</th>
                  <th className="py-3 px-4">Lançado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
                      Nenhuma movimentação registrada no extrato.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {tx.event_date}
                      </td>

                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{tx.description}</span>
                          {tx.is_double_points === 1 && (
                            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-500/40">
                              DOBRO
                            </span>
                          )}
                          {tx.is_adjustment === 1 && (
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-500/40">
                              AJUSTE
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-black">
                        <span className={`inline-flex items-center gap-1 ${tx.points > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.points > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          <span>{tx.points > 0 ? `+${tx.points}` : tx.points} pts</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-400">
                        {tx.previousBalance} pts
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {tx.newBalance} pts
                      </td>

                      <td className="py-3 px-4 text-slate-400 italic">
                        {tx.observation || '-'}
                        {tx.indicator_value && (
                          <span className="ml-1 text-slate-300 font-semibold">({tx.indicator_value})</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {tx.created_by}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Bilhetes Físicos */}
      {activeTab === 'bilhetes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-amber-400" />
              <span>Bilhetes Físicos da Campanha</span>
            </h3>
            <button
              onClick={() => onNavigate('bilhetes')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Ir para Impressão Geral
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Este operador ainda não possui bilhetes conquistados. (A cada 50 pontos = 1 bilhete)
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {tickets.map((tkt, idx) => (
                <div key={tkt.id} className="bg-slate-800/80 border border-amber-500/40 rounded-xl p-4 relative overflow-hidden shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
                    <span className="text-[10px] font-black text-amber-400 tracking-wider">🎯 DESAFIO 156</span>
                    <span className="text-xs font-mono font-bold text-amber-300">{tkt.ticket_code}</span>
                  </div>
                  <div className="text-xs font-bold text-white mb-1">{operator.name}</div>
                  <div className="text-[10px] text-slate-400">Bilhete {idx + 1} de {tickets.length}</div>
                  <div className="text-[10px] text-amber-400/90 font-semibold mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span>Sorteio: Folga Natal/Ano Novo</span>
                    <span>{tkt.generated_at?.substring(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Prêmios Operacionais */}
      {activeTab === 'premios' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-400" />
            <span>Prêmios Operacionais Conquistados</span>
          </h3>

          {prizes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhum prêmio operacional registrado para este operador.
            </div>
          ) : (
            <div className="space-y-3">
              {prizes.map((prz) => (
                <div key={prz.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div>
                    <div className="text-xs font-bold text-white">{prz.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Concedido em {prz.awarded_at?.substring(0, 10)} • {prz.observation || 'Sem observações'}
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    prz.status === 'Pendente' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    prz.status === 'Utilizado' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {prz.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Destaques */}
      {activeTab === 'destaques' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            <span>Destaques da Semana Recebidos</span>
          </h3>

          {highlights.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Este operador ainda não recebeu nenhum destaque semanal.
            </div>
          ) : (
            <div className="space-y-3">
              {highlights.map((hl) => (
                <div key={hl.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div>
                    <div className="text-xs font-bold text-amber-300">Destaque da Semana: {hl.category}</div>
                    <div className="text-[10px] text-slate-400">Semana Referência: {hl.week_reference}</div>
                  </div>
                  <div className="text-xs font-black text-amber-400">+{hl.points} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
