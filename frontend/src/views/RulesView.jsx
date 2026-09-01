import React, { useState, useEffect } from 'react';
import { Sliders, Edit2, CheckCircle2, XCircle, Save, X } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function RulesView({ showToast }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/rules');
      setRules(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!editingRule) return;

    try {
      const res = await apiFetch(`/rules/${editingRule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingRule.name,
          points: Number(editingRule.points),
          periodicity: editingRule.periodicity,
          description: editingRule.description,
          active: editingRule.active
        })
      });

      showToast(res.message, 'success');
      setEditingRule(null);
      loadRules();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleRuleActive = async (rule) => {
    try {
      const res = await apiFetch(`/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: rule.active === 1 ? 0 : 1 })
      });
      showToast(res.message, 'success');
      loadRules();
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-400" />
            <span>⚙️ Configuração das Regras da Campanha</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personalize a pontuação, descrição, periodicidade e ative ou desative regras para esta e futuras campanhas
          </p>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Nome da Regra</th>
                <th className="py-3.5 px-4">Tipo</th>
                <th className="py-3.5 px-4">Periodicidade</th>
                <th className="py-3.5 px-4">Pontuação</th>
                <th className="py-3.5 px-4">Descrição</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {rule.name}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      rule.type === 'positive' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {rule.type === 'positive' ? 'Positiva (+)' : 'Negativa (-)'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-slate-300 capitalize">
                    {rule.periodicity}
                  </td>

                  <td className="py-3.5 px-4 font-black">
                    <span className={rule.points > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {rule.points > 0 ? `+${rule.points}` : rule.points} pts
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-400 italic max-w-xs truncate">
                    {rule.description || '-'}
                  </td>

                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => toggleRuleActive(rule)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                        rule.active === 1 ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {rule.active === 1 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{rule.active === 1 ? 'Ativa' : 'Inativa'}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      title="Editar Regra"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Editar Regra da Campanha</span>
              </h3>
              <button onClick={() => setEditingRule(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Regra</label>
                <input
                  type="text"
                  required
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pontos (+/-)</label>
                  <input
                    type="number"
                    required
                    value={editingRule.points}
                    onChange={(e) => setEditingRule({ ...editingRule, points: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Periodicidade</label>
                  <select
                    value={editingRule.periodicity}
                    onChange={(e) => setEditingRule({ ...editingRule, periodicity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none capitalize"
                  >
                    <option value="diario">Diário</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="monitoria">Por Monitoria</option>
                    <option value="avulso">Avulso / Conforme lançamento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição</label>
                <textarea
                  rows="2"
                  value={editingRule.description || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
