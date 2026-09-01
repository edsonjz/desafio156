import React, { useState, useEffect } from 'react';
import { Gift, CheckCircle, Clock, XCircle, Search, Filter, Plus, Edit2, Check } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function PrizesView({ showToast }) {
  const [prizes, setPrizes] = useState([]);
  const [operators, setOperators] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Status Change Modal
  const [editingPrize, setEditingPrize] = useState(null);
  const [newStatus, setNewStatus] = useState('Utilizado');
  const [usageNotes, setUsageNotes] = useState('');

  // Create Manual Prize
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOpId, setCreateOpId] = useState('');
  const [createName, setCreateName] = useState('Saída 30 minutos mais cedo');
  const [createCat, setCreateCat] = useState('saida_mais_cedo');
  const [createObs, setCreateObs] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/prizes?status=${statusFilter}` : '/prizes';
      const [prz, ops] = await Promise.all([
        apiFetch(url),
        apiFetch('/operators?status=active')
      ]);
      setPrizes(prz);
      setOperators(ops);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!editingPrize) return;

    try {
      const res = await apiFetch(`/prizes/${editingPrize.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, observation: usageNotes })
      });

      showToast(res.message, 'success');
      setEditingPrize(null);
      setUsageNotes('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreatePrize = async (e) => {
    e.preventDefault();
    if (!createOpId || !createName) {
      showToast('Selecione o operador e o nome do prêmio.', 'error');
      return;
    }

    try {
      const res = await apiFetch('/prizes', {
        method: 'POST',
        body: JSON.stringify({
          operatorId: Number(createOpId),
          name: createName,
          category: createCat,
          observation: createObs
        })
      });

      showToast(res.message, 'success');
      setShowCreateModal(false);
      setCreateOpId('');
      setCreateObs('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredPrizes = prizes.filter(p =>
    p.operator_name.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.registration.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-emerald-400" />
            <span>🎁 Prêmios Operacionais</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Controle de recompensas concedidas, utilização e status (Pendente, Utilizado, Cancelado)
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Prêmio Operacional</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prêmio ou operador..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('Pendente')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'Pendente' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setStatusFilter('Utilizado')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'Utilizado' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Utilizados
          </button>
        </div>
      </div>

      {/* Prizes Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4">Prêmio / Recompensa</th>
                <th className="py-3.5 px-4">Data Concessão</th>
                <th className="py-3.5 px-4">Data Utilização</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Observações</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Carregando prêmios...
                  </td>
                </tr>
              ) : filteredPrizes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Nenhum prêmio operacional encontrado.
                  </td>
                </tr>
              ) : (
                filteredPrizes.map((prz) => (
                  <tr key={prz.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {prz.operator_name} ({prz.registration})
                    </td>

                    <td className="py-3.5 px-4 font-bold text-amber-300">
                      {prz.name}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {prz.awarded_at?.substring(0, 10)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {prz.used_at ? prz.used_at.substring(0, 10) : '-'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        prz.status === 'Pendente' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        prz.status === 'Utilizado' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {prz.status === 'Pendente' && <Clock className="w-3 h-3" />}
                        {prz.status === 'Utilizado' && <CheckCircle className="w-3 h-3" />}
                        {prz.status === 'Cancelado' && <XCircle className="w-3 h-3" />}
                        <span>{prz.status}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 italic">
                      {prz.observation || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingPrize(prz);
                          setNewStatus(prz.status);
                          setUsageNotes(prz.observation || '');
                        }}
                        className="p-1.5 text-sky-400 hover:bg-sky-500/10 rounded-lg transition text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Alterar Status</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Status Modal */}
      {editingPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              <span>Atualizar Status do Prêmio</span>
            </h3>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs space-y-1">
                <div>Operador: <strong className="text-white">{editingPrize.operator_name}</strong></div>
                <div>Prêmio: <strong className="text-amber-300">{editingPrize.name}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Novo Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                >
                  <option value="Pendente">🟡 Pendente (Ainda não utilizado)</option>
                  <option value="Utilizado">🟢 Utilizado (Já desfrutado pelo operador)</option>
                  <option value="Cancelado">🔴 Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações da Utilização</label>
                <textarea
                  rows="2"
                  value={usageNotes}
                  onChange={(e) => setUsageNotes(e.target.value)}
                  placeholder="Ex: Saída efetuada às 17h00 autorizada por Supervisão..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPrize(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                >
                  Atualizar Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Prize Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>Cadastrar Novo Prêmio</span>
            </h3>

            <form onSubmit={handleCreatePrize} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Operador *</label>
                <select
                  required
                  value={createOpId}
                  onChange={(e) => setCreateOpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Selecione o operador --</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.name} ({op.registration})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Prêmio *</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ex: Saída 30 minutos mais cedo, Pausa Extra, etc."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria</label>
                <select
                  value={createCat}
                  onChange={(e) => setCreateCat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="saida_mais_cedo">⏰ Saída mais cedo</option>
                  <option value="pausa_extra">☕ Pausa extra</option>
                  <option value="surpresa">😄 Prêmio surpresa</option>
                  <option value="desafio">🎯 Desafio especial</option>
                  <option value="outros">🎁 Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
                <textarea
                  rows="2"
                  value={createObs}
                  onChange={(e) => setCreateObs(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                >
                  Salvar Prêmio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
