import React, { useState, useEffect } from 'react';
import { Star, Sparkles, CheckCircle2, User, Plus, Award } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function HighlightsView({ showToast, onTicketAlert }) {
  const [suggestions, setSuggestions] = useState([]);
  const [confirmedHighlights, setConfirmedHighlights] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Add Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualOpId, setManualOpId] = useState('');
  const [manualCat, setManualCat] = useState('Performance geral');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sug, conf, ops] = await Promise.all([
        apiFetch('/highlights/suggestions'),
        apiFetch('/highlights'),
        apiFetch('/operators?status=active')
      ]);
      setSuggestions(sug);
      setConfirmedHighlights(conf);
      setOperators(ops);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmHighlight = async (operatorId, category, weekRef = '2026-W37') => {
    try {
      const res = await apiFetch('/highlights/confirm', {
        method: 'POST',
        body: JSON.stringify({ operatorId, category, weekReference: weekRef })
      });
      showToast(res.message, 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualOpId || !manualCat) {
      showToast('Selecione o operador e a categoria.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await handleConfirmHighlight(Number(manualOpId), manualCat);
      setShowManualModal(false);
      setManualOpId('');
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400" />
            <span>🌟 Destaques da Semana</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sugestões automáticas baseadas em desempenho e concessão oficial de +10 pontos
          </p>
        </div>

        <button
          onClick={() => setShowManualModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Destaque Manual</span>
        </button>
      </div>

      {/* Automated Engine Suggestions */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Sugestões Automáticas do Sistema (+10 pts cada)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {suggestions.map((sug, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-amber-500 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{sug.icon}</span>
                  <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    +10 PONTOS
                  </span>
                </div>

                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">{sug.category}</div>
                <div className="text-base font-black text-white mt-1">{sug.operatorName}</div>
              </div>

              <button
                onClick={() => handleConfirmHighlight(sug.operatorId, sug.category, sug.weekReference)}
                className="mt-4 w-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-slate-700 hover:border-amber-500"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Destaque</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmed Highlights History */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span>Histórico de Destaques Confirmados</span>
        </h3>

        <div className="space-y-3">
          {confirmedHighlights.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhum destaque confirmado ainda.
            </div>
          ) : (
            confirmedHighlights.map((hl) => (
              <div key={hl.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 font-black flex items-center justify-center border border-amber-500/30">
                    🌟
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{hl.operator_name} ({hl.registration})</div>
                    <div className="text-[10px] text-slate-400">
                      Categoria: <strong className="text-amber-300">{hl.category}</strong> • Semana: {hl.week_reference}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-black text-amber-400">+{hl.points} pts</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Add Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              <span>Adicionar Destaque Manual</span>
            </h3>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Operador *</label>
                <select
                  required
                  value={manualOpId}
                  onChange={(e) => setManualOpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Selecione o operador --</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.name} ({op.registration})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria de Destaque *</label>
                <select
                  value={manualCat}
                  onChange={(e) => setManualCat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="Qualidade">🎧 Qualidade</option>
                  <option value="NPS">💬 NPS</option>
                  <option value="TMA">⏱️ TMA</option>
                  <option value="Atendimento">💬 Atendimento</option>
                  <option value="Evolução">📈 Evolução</option>
                  <option value="Colaboração">🤝 Colaboração</option>
                  <option value="Aderência">⭐ Aderência</option>
                  <option value="Performance geral">🏅 Performance geral</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  Confirmar e Conceder +10 pts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
