import React, { useState, useEffect } from 'react';
import { Receipt, Search, ArrowUpRight, ArrowDownRight, Trash2, Ticket, AlertTriangle, X } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function ExtratoView({ showToast }) {
  const [operators, setOperators] = useState([]);
  const [selectedOpId, setSelectedOpId] = useState('');
  const [operatorData, setOperatorData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Delete transaction modal
  const [txToDelete, setTxToDelete] = useState(null);

  useEffect(() => {
    loadOperators();
  }, []);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const ops = await apiFetch('/operators');
      setOperators(ops);
      if (ops.length > 0) {
        setSelectedOpId(ops[0].id);
        loadExtrato(ops[0].id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadExtrato = async (opId) => {
    if (!opId) return;
    try {
      const data = await apiFetch(`/operators/${opId}`);
      setOperatorData(data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOperatorChange = (e) => {
    const id = e.target.value;
    setSelectedOpId(id);
    loadExtrato(id);
  };

  const handleDeleteTransaction = async () => {
    if (!txToDelete) return;
    try {
      const res = await apiFetch(`/points/${txToDelete.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      setTxToDelete(null);
      loadExtrato(selectedOpId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const { operator, stats, transactions } = operatorData || {};

  return (
    <div className="space-y-6">
      {/* Top Header & Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-400" />
            <span>🧾 Extrato de Pontos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Consulte o extrato completo estilo bancário com movimentações e saldos
          </p>
        </div>

        <div className="w-full md:w-80">
          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Selecione o Operador</label>
          <select
            value={selectedOpId}
            onChange={handleOperatorChange}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-amber-500 focus:outline-none"
          >
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name} ({op.registration}) — {op.totalPoints} pts
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Operator Extrato Summary Cards */}
      {operator && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-bold text-slate-400 uppercase">Saldo Atual</div>
            <div className={`text-3xl font-black mt-2 ${stats.totalPoints < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
              {stats.totalPoints > 0 ? `+${stats.totalPoints}` : stats.totalPoints} pts
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-bold text-slate-400 uppercase">Bilhetes Conquistados</div>
            <div className="text-3xl font-black text-white flex items-center gap-2 mt-2">
              <Ticket className="w-8 h-8 text-amber-400" />
              <span>{stats.totalTickets}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-bold text-slate-400 uppercase">Próximo Bilhete</div>
            <div className="text-sm font-bold text-amber-300 mt-1">
              Faltam {stats.pointsToNextTicket} pts ({stats.currentTicketProgress}/50)
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                style={{ width: `${(stats.currentTicketProgress / 50) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bank Statement Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Histórico Detalhado do Operador: <strong className="text-white">{operator?.name}</strong>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Data do Evento</th>
                <th className="py-3.5 px-4">Evento / Regra</th>
                <th className="py-3.5 px-4">Movimentação</th>
                <th className="py-3.5 px-4">Saldo Anterior</th>
                <th className="py-3.5 px-4">Saldo Atualizado</th>
                <th className="py-3.5 px-4">Observação / Nota</th>
                <th className="py-3.5 px-4">Lançado por</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {!transactions || transactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    Nenhum lançamento encontrado no extrato deste operador.
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

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setTxToDelete(tx)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                        title="Excluir este lançamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-500/40">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white text-center mb-2">Excluir Lançamento?</h3>

            <p className="text-xs text-slate-300 text-center leading-relaxed mb-4">
              Você tem certeza que deseja excluir o lançamento de{' '}
              <strong className="text-rose-300">{txToDelete.points > 0 ? `+${txToDelete.points}` : txToDelete.points} pontos</strong> ({txToDelete.description})?
              Esta ação recalculará o extrato e os bilhetes do operador.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleDeleteTransaction}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
