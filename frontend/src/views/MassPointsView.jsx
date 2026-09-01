import React, { useState, useEffect } from 'react';
import { Zap, CheckSquare, Square, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function MassPointsView({ showToast, onTicketAlert }) {
  const [operators, setOperators] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedOpIds, setSelectedOpIds] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [pointsOverride, setPointsOverride] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useState('');
  const [indicatorValue, setIndicatorValue] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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

  const handleRuleChange = (ruleId) => {
    setSelectedRuleId(ruleId);
    if (!ruleId) {
      setPointsOverride('');
      return;
    }
    const r = rules.find(rule => rule.id === Number(ruleId));
    if (r) {
      setPointsOverride(r.points);
    }
  };

  const handleSelectAll = () => {
    const visibleIds = filteredOperators.map(o => o.id);
    setSelectedOpIds(visibleIds);
  };

  const handleClearAll = () => {
    setSelectedOpIds([]);
  };

  const toggleSelectOp = (id) => {
    if (selectedOpIds.includes(id)) {
      setSelectedOpIds(selectedOpIds.filter(opId => opId !== id));
    } else {
      setSelectedOpIds([...selectedOpIds, id]);
    }
  };

  const filteredOperators = operators.filter(o =>
    o.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    o.registration.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeRule = rules.find(r => r.id === Number(selectedRuleId));
  const finalPointsEach = pointsOverride !== '' ? Number(pointsOverride) : (activeRule ? activeRule.points : 0);
  const totalDistributed = selectedOpIds.length * finalPointsEach;

  const handleOpenSummary = (e) => {
    e.preventDefault();
    if (selectedOpIds.length === 0) {
      showToast('Selecione pelo menos um operador para a aplicação em massa.', 'error');
      return;
    }
    if (!eventDate) {
      showToast('Selecione a data do evento.', 'error');
      return;
    }
    if (isNaN(finalPointsEach)) {
      showToast('Informe a quantidade de pontos.', 'error');
      return;
    }
    setShowSummaryModal(true);
  };

  const handleConfirmMassLaunch = async (forceDuplicate = true) => {
    setSubmitting(true);
    try {
      const res = await apiFetch('/points/mass', {
        method: 'POST',
        body: JSON.stringify({
          operatorIds: selectedOpIds,
          ruleId: selectedRuleId ? Number(selectedRuleId) : null,
          points: finalPointsEach,
          eventDate,
          observation,
          indicatorValue,
          forceDuplicate
        })
      });

      showToast(res.message, 'success');
      setShowSummaryModal(false);

      // Trigger alerts if tickets unlocked
      if (res.ticketAlerts && res.ticketAlerts.length > 0 && onTicketAlert) {
        onTicketAlert(res.ticketAlerts[0]);
      }

      // Reset selection
      setSelectedOpIds([]);
      setObservation('');
      setIndicatorValue('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">⚡ Lançamento em Massa de Pontos</h2>
            <p className="text-xs text-slate-400">Aplique pontuação simultânea para múltiplos operadores</p>
          </div>
        </div>

        <form onSubmit={handleOpenSummary} className="space-y-6">
          {/* Controls: Rule, Points, Date, Indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Evento / Regra *</label>
              <select
                value={selectedRuleId}
                onChange={(e) => handleRuleChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">-- Selecione o evento --</option>
                {rules.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.points > 0 ? `+${r.points}` : r.points} pts)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Pontos por Operador *</label>
              <input
                type="number"
                required
                value={pointsOverride}
                onChange={(e) => setPointsOverride(e.target.value)}
                placeholder="Ex: +5 ou +15"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Data do Evento *</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Observação / Nota</label>
              <input
                type="text"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Lançamento referente à escala do dia"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Selection Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-200">
                Operadores Selecionados: <strong className="text-amber-400">{selectedOpIds.length}</strong> de {operators.length}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 underline"
              >
                Selecionar Todos ({filteredOperators.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Limpar Seleção
              </button>
            </div>

            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar lista..."
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 w-full sm:w-64 focus:outline-none"
            />
          </div>

          {/* Multi-select Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-xl">
            {filteredOperators.map((op) => {
              const isSelected = selectedOpIds.includes(op.id);
              return (
                <div
                  key={op.id}
                  onClick={() => toggleSelectOp(op.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 text-white'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-600 shrink-0" />
                  )}
                  <div className="truncate text-xs">
                    <div className="font-bold truncate">{op.name}</div>
                    <div className="text-[10px] text-slate-500">{op.registration} • {op.totalPoints} pts</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              Total a distribuir: <strong className="text-amber-400">{totalDistributed > 0 ? `+${totalDistributed}` : totalDistributed} pontos</strong>
            </div>

            <button
              type="submit"
              disabled={selectedOpIds.length === 0}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold py-3 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-40"
            >
              APLICAR {finalPointsEach > 0 ? `+${finalPointsEach}` : finalPointsEach} PONTOS ({selectedOpIds.length})
            </button>
          </div>
        </form>
      </div>

      {/* Summary Modal before launch */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
              <Zap className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white text-center mb-2">Resumo do Lançamento em Massa</h3>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 my-4 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Evento / Regra:</span>
                <span className="font-bold text-white">{activeRule ? activeRule.name : 'Personalizado'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Operadores Selecionados:</span>
                <span className="font-bold text-amber-400">{selectedOpIds.length} operadores</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Pontos cada:</span>
                <span className="font-bold text-emerald-400">{finalPointsEach > 0 ? `+${finalPointsEach}` : finalPointsEach} pontos</span>
              </div>
              <div className="flex justify-between font-black pt-1">
                <span className="text-slate-300">Total distribuído:</span>
                <span className="text-amber-400 text-sm">{totalDistributed > 0 ? `+${totalDistributed}` : totalDistributed} pontos</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mb-6">
              Será criado um registro individual no extrato de cada um dos {selectedOpIds.length} operadores.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleConfirmMassLaunch(true)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {submitting ? 'Aplicando...' : 'Confirmar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
