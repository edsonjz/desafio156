import React, { useState, useEffect } from 'react';
import { PlusCircle, AlertCircle, CheckCircle2, Flame, AlertTriangle, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function ManualPointsView({ showToast, onTicketAlert }) {
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
      // 1. Check duplicate if rule is selected and forceDuplicate is false
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
          return; // Stop and prompt user confirmation
        }
      }

      // 2. Perform Launch
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

      // Check for ticket unlock alert modal
      if (res.newlyEarnedTickets > 0 && onTicketAlert) {
        onTicketAlert({
          operatorName: res.operatorName,
          totalPoints: res.totalPoints,
          totalTickets: res.totalTickets,
          newlyEarnedTickets: res.newlyEarnedTickets,
          newTicketCodes: res.newTicketCodes
        });
      }

      // Reset fields
      setObservation('');
      setIndicatorValue('');
    } catch (err) {
      showToast(err.message, 'error');
    } fontally: {
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

      {/* Duplicate Launch Warning Modal */}
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
