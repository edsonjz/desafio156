import React, { useState, useEffect } from 'react';
import { Gift, CheckCircle, Clock, XCircle, Search, Filter, Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function PrizesView({ showToast }) {
  const [prizes, setPrizes] = useState([]);
  const [operators, setOperators] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit Prize Modal
  const [editingPrize, setEditingPrize] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStatus, setEditStatus] = useState('Pendente');
  const [editObs, setEditObs] = useState('');

  // Delete Prize Modal
  const [deletingPrize, setDeletingPrize] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create Manual Prize Modal
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

  const openEditModal = (prize) => {
    setEditingPrize(prize);
    setEditName(prize.name || '');
    setEditCategory(prize.category || 'outros');
    setEditStatus(prize.status || 'Pendente');
    setEditObs(prize.observation || '');
  };

  const handleSavePrize = async (e) => {
    e.preventDefault();
    if (!editingPrize) return;

    try {
      const res = await apiFetch(`/prizes/${editingPrize.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          category: editCategory,
          status: editStatus,
          observation: editObs
        })
      });

      showToast(res.message, 'success');
      setEditingPrize(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeletePrize = async () => {
    if (!deletingPrize) return;

    setIsDeleting(true);
    try {
      const res = await apiFetch(`/prizes/${deletingPrize.id}`, {
        method: 'DELETE'
      });

      showToast(res.message, 'success');
      setDeletingPrize(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDeleting(false);
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
    (p.operator_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.registration || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-emerald-400" />
            <span>🎁 Gestão Completa de Prêmios</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Controle de recompensas concedidas: incluir manualmente, editar detalhes/status e excluir registros
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Cadastrar Prêmio Manual</span>
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
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === '' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('Pendente')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'Pendente' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setStatusFilter('Utilizado')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'Utilizado' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Utilizados
          </button>
          <button
            onClick={() => setStatusFilter('Cancelado')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              statusFilter === 'Cancelado' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cancelados
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
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Data Concessão</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Observações</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
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

                    <td className="py-3.5 px-4 text-slate-400 capitalize">
                      {prz.category ? prz.category.replace(/_/g, ' ') : '-'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {prz.awarded_at?.substring(0, 10)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        prz.status === 'Pendente' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        prz.status === 'Utilizado' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {prz.status === 'Pendente' && <Clock className="w-3 h-3" />}
                        {prz.status === 'Utilizado' && <CheckCircle className="w-3 h-3" />}
                        {prz.status === 'Cancelado' && <XCircle className="w-3 h-3" />}
                        <span>{prz.status}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 italic max-w-xs truncate">
                      {prz.observation || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(prz)}
                        className="p-1.5 text-sky-400 hover:bg-sky-500/10 rounded-lg transition inline-flex items-center gap-1 cursor-pointer font-bold"
                        title="Editar Prêmio"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => setDeletingPrize(prz)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition inline-flex items-center gap-1 cursor-pointer font-bold"
                        title="Excluir Prêmio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Prize Modal */}
      {editingPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Editar Prêmio Operacional</span>
              </h3>
              <button onClick={() => setEditingPrize(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrize} className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs space-y-1">
                <div>Operador: <strong className="text-white">{editingPrize.operator_name}</strong> ({editingPrize.registration})</div>
                <div>Data Concessão: <strong className="text-slate-300">{editingPrize.awarded_at?.substring(0, 10)}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Prêmio *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                  >
                    <option value="Pendente">🟡 Pendente</option>
                    <option value="Utilizado">🟢 Utilizado</option>
                    <option value="Cancelado">🔴 Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações da Utilização</label>
                <textarea
                  rows="3"
                  value={editObs}
                  onChange={(e) => setEditObs(e.target.value)}
                  placeholder="Ex: Utilizado em 10/10 com aprovação da supervisão..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPrize(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Prize Modal */}
      {deletingPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Prêmio</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Tem certeza que deseja excluir o prêmio <strong className="text-amber-300">{deletingPrize.name}</strong> pertencente ao operador <strong className="text-white">{deletingPrize.operator_name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingPrize(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletePrize}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Manual Prize Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Cadastrar Novo Prêmio Manual</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 cursor-pointer"
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
