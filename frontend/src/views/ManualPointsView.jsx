import React, { useState, useEffect } from 'react';
import { PlusCircle, AlertCircle, CheckCircle2, Flame, AlertTriangle, ShieldAlert, ListFilter, Edit2, Trash2, Search, X, Calendar, Filter } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function ManualPointsView({ showToast, onTicketAlert }) {
  const [activeTab, setActiveTab] = useState('novo'); // 'novo' | 'historico'
  const [operators, setOperators] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedOp, setSelectedOp] = useState('');
  const [selectedRule, setSelectedRule] = useState('');
  const [points, setPoints] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useState('');
  const [indicatorValue, setIndicatorValue] = useState('');
  const [isAdjustment, setIsAdjustment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Duplicate Modal State
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // History & Management State
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [searchTx, setSearchTx] = useState('');
  const [filterOpId, setFilterOpId] = useState('');

  // Edit Modal State
  const [editingTx, setEditingTx] = useState(null);
  const [editPoints, setEditPoints] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editIndicator, setEditIndicator] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [deletingTx, setDeletingTx] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') {
      loadTransactions();
    }
  }, [activeTab, filterOpId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ops, rls] = await Promise.all([
        apiFetch('/operators?status=active'),
        apiFetch('/rules')
      ]);
      setOperators(ops);
      setRules(rls.filter(r => r.active === 1));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const url = filterOpId ? `/points?operatorId=${filterOpId}&limit=200` : '/points?limit=200';
      const data = await apiFetch(url);
      setTransactions(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTxLoading(false);
    }
  };

  const handleRuleChange = (ruleId) => {
    setSelectedRule(ruleId);
    if (!ruleId) {
      setPoints('');
      return;
    }
    const rule = rules.find(r => r.id === Number(ruleId));
    if (rule) {
      setPoints(rule.points);
      setIsAdjustment(false);
    }
  };

  const handleCheckAndSubmit = async (e, forceDuplicate = false) => {
    if (e) e.preventDefault();

    if (!selectedOp || !eventDate) {
      showToast('Selecione o operador e a data do evento.', 'error');
      return;
    }

    if (points === '' || isNaN(Number(points))) {
      showToast('Informe uma quantidade de pontos válida.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedRule && !forceDuplicate && !isAdjustment) {
        const dupRes = await apiFetch('/points/check-duplicate', {
          method: 'POST',
          body: JSON.stringify({
            operatorIds: [Number(selectedOp)],
            ruleId: Number(selectedRule),
            eventDate
          })
        });

        if (dupRes.hasDuplicates && dupRes.duplicates.length > 0) {
          setDuplicateWarning(dupRes.duplicates[0]);
          setSubmitting(false);
          return;
        }
      }

      const res = await apiFetch('/points/single', {
        method: 'POST',
        body: JSON.stringify({
          operatorId: Number(selectedOp),
          ruleId: selectedRule ? Number(selectedRule) : null,
          points: Number(points),
          eventDate,
          observation,
          indicatorValue,
          isAdjustment,
          forceDuplicate
        })
      });

      showToast(res.message, 'success');
      setDuplicateWarning(null);

      if (res.newlyEarnedTickets > 0 && onTicketAlert) {
        onTicketAlert({
          operatorName: res.operatorName,
          totalPoints: res.totalPoints,
          totalTickets: res.totalTickets,
          newlyEarnedTickets: res.newlyEarnedTickets,
          newTicketCodes: res.newTicketCodes
        });
      }

      setObservation('');
      setIndicatorValue('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (tx) => {
    setEditingTx(tx);
    setEditPoints(tx.points);
    setEditDate(tx.event_date ? tx.event_date.substring(0, 10) : '');
    setEditDesc(tx.description || '');
    setEditObs(tx.observation || '');
    setEditIndicator(tx.indicator_value || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;

    setSavingEdit(true);
    try {
      const res = await apiFetch(`/points/${editingTx.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          points: Number(editPoints),
          eventDate: editDate,
          description: editDesc,
          observation: editObs,
          indicatorValue: editIndicator
        })
      });

      showToast(res.message, 'success');
      setEditingTx(null);
      loadTransactions();
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTx) return;
    setDeletingLoading(true);
    try {
      const res = await apiFetch(`/points/${deletingTx.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      setDeletingTx(null);
      loadTransactions();
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const filteredTxs = transactions.filter(t => {
    const s = searchTx.toLowerCase();
    return (
      !s ||
      (t.operator_name && t.operator_name.toLowerCase().includes(s)) ||
      (t.operator_registration && t.operator_registration.toLowerCase().includes(s)) ||
      (t.description && t.description.toLowerCase().includes(s)) ||
      (t.observation && t.observation.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('novo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'novo'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>➕ Novo Lançamento</span>
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'historico'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>📋 Gerenciar Lançamentos Realizados</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Formulário de Inclusão Manual */}
      {activeTab === 'novo' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">➕ Lançamento Manual de Pontos</h2>
                <p className="text-xs text-slate-400">Lançamento individual para um operador específico</p>
              </div>
            </div>

            <form onSubmit={(e) => handleCheckAndSubmit(e, false)} className="space-y-4">
              {/* Operator Select */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Operador *</label>
                <select
                  required
                  value={selectedOp}
                  onChange={(e) => setSelectedOp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Selecione o operador --</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.registration}) — {op.totalPoints} pts
                    </option>
                  ))}
                </select>
              </div>

              {/* Rule or Adjustment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Regra da Campanha</label>
                  <select
                    disabled={isAdjustment}
                    value={selectedRule}
                    onChange={(e) => handleRuleChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none disabled:opacity-40"
                  >
                    <option value="">-- Selecione a regra --</option>
                    <optgroup label="Positivas (+)">
                      {rules.filter(r => r.type === 'positive').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.points > 0 ? `+${r.points}` : r.points} pts)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Negativas (-)">
                      {rules.filter(r => r.type === 'negative').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.points} pts)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Quantidade de Pontos *</label>
                  <input
                    type="number"
                    required
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none ${
                      Number(points) < 0 ? 'text-rose-400 border-rose-500/40' : 'text-amber-400 border-slate-800'
                    }`}
                    placeholder="Ex: +10 ou -5"
                  />
                </div>
              </div>

              {/* Toggle Admin Adjustment */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="is-adjustment-check"
                  checked={isAdjustment}
                  onChange={(e) => {
                    setIsAdjustment(e.target.checked);
                    if (e.target.checked) setSelectedRule('');
                  }}
                  className="w-4 h-4 rounded text-amber-500 border-slate-700 bg-slate-900 focus:ring-amber-500"
                />
                <label htmlFor="is-adjustment-check" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Marcar como <strong>Ajuste Administrativo</strong> (Reconhecimento / Correção excepcional)
                </label>
              </div>

              {/* Date & Indicator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Data do Evento *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Indicador / Nota (opcional)</label>
                  <input
                    type="text"
                    value={indicatorValue}
                    onChange={(e) => setIndicatorValue(e.target.value)}
                    placeholder="Ex: Nota 99,5% ou TMA 3:48"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Observation */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Observação / Justificativa</label>
                <textarea
                  rows="2"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Digite detalhes ou justificativa do lançamento..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                {submitting ? 'Salvando Lançamento...' : 'Confirmar e Lançar Pontos'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Tabela de Gerenciamento / Edição / Exclusão */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          {/* Header & Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  placeholder="Buscar por operador, regra ou descrição..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <select
                value={filterOpId}
                onChange={(e) => setFilterOpId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todos os Operadores</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.name} ({op.registration})</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Total exibido: <strong className="text-white font-bold">{filteredTxs.length}</strong> lançamentos
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {txLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Carregando lançamentos...
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum lançamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Operador</th>
                      <th className="py-3 px-4">Descrição / Regra</th>
                      <th className="py-3 px-4">Pontos</th>
                      <th className="py-3 px-4">Observação</th>
                      <th className="py-3 px-4">Lançado por</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTxs.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {tx.event_date ? tx.event_date.substring(0, 10) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{tx.operator_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{tx.operator_registration}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          {tx.description}
                          {tx.is_double_points === 1 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              DOBRO
                            </span>
                          )}
                          {tx.indicator_value && (
                            <span className="ml-1.5 text-[10px] text-amber-400/80 font-mono">
                              ({tx.indicator_value})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-black whitespace-nowrap">
                          <span className={tx.points > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                          {tx.observation || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {tx.created_by || 'Admin'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(tx)}
                              title="Editar Lançamento"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingTx(tx)}
                              title="Excluir Lançamento"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar Lançamento */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Editar Lançamento de Pontos</span>
              </h3>
              <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Operador</label>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold">
                  {editingTx.operator_name} ({editingTx.operator_registration})
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Descrição / Motivo</label>
                <input
                  type="text"
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Pontos *</label>
                  <input
                    type="number"
                    required
                    value={editPoints}
                    onChange={(e) => setEditPoints(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Data do Evento *</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Indicador / Nota</label>
                <input
                  type="text"
                  value={editIndicator}
                  onChange={(e) => setEditIndicator(e.target.value)}
                  placeholder="Ex: Nota 100% ou TMA 3:40"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Observação / Justificativa</label>
                <textarea
                  rows="2"
                  value={editObs}
                  onChange={(e) => setEditObs(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Lançamento */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-500/40">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white text-center mb-2">Excluir Lançamento de Pontos?</h3>

            <p className="text-xs text-slate-300 text-center leading-relaxed mb-4">
              Você está prestes a excluir o lançamento de{' '}
              <strong className="text-amber-400 font-bold">{deletingTx.points > 0 ? `+${deletingTx.points}` : deletingTx.points} pts</strong> de{' '}
              <strong className="text-white">{deletingTx.operator_name}</strong> ({deletingTx.description}).
            </p>

            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl mb-6 text-[11px] text-slate-400">
              ⚠️ O saldo total e a quantidade de bilhetes físicos do operador serão recalculados automaticamente.
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                disabled={deletingLoading}
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20"
              >
                {deletingLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white text-center mb-2">Atenção: Lançamento Já Existente</h3>

            <p className="text-xs text-slate-300 text-center leading-relaxed mb-4">
              O operador <strong>{duplicateWarning.name}</strong> já possui um lançamento da regra{' '}
              <strong className="text-amber-300">"{duplicateWarning.ruleName}"</strong> registrado para o período{' '}
              <strong className="text-amber-300 font-mono">({duplicateWarning.periodRef})</strong>.
            </p>

            <p className="text-[11px] text-slate-400 text-center mb-6">
              Deseja permitir este lançamento adicional?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={(e) => handleCheckAndSubmit(e, true)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20"
              >
                Permitir Adicional
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
