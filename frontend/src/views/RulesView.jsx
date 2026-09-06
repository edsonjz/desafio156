import React, { useState, useEffect } from 'react';
import { Sliders, Edit2, Trash2, Plus, CheckCircle2, XCircle, AlertTriangle, Calendar, Award, X, Settings2 } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function RulesView({ showToast }) {
  const [rules, setRules] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Rule Modal
  const [editingRule, setEditingRule] = useState(null);

  // Create Rule Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('positive');
  const [newPoints, setNewPoints] = useState(5);
  const [newPeriodicity, setNewPeriodicity] = useState('diario');
  const [newDescription, setNewDescription] = useState('');

  // Delete Rule Modal
  const [deletingRule, setDeletingRule] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Campaign Modal
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campName, setCampName] = useState('');
  const [campSubtitle, setCampSubtitle] = useState('');
  const [campStart, setCampStart] = useState('');
  const [campEnd, setCampEnd] = useState('');
  const [campStatus, setCampStatus] = useState('active');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rulesData, campData] = await Promise.all([
        apiFetch('/rules'),
        apiFetch('/campaign/status')
      ]);
      setRules(rulesData);
      setCampaign(campData);
      if (campData) {
        setCampName(campData.name || '');
        setCampSubtitle(campData.subtitle || '');
        setCampStart(campData.start_date || '');
        setCampEnd(campData.end_date || '');
        setCampStatus(campData.status || 'active');
      }
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
          type: editingRule.type,
          points: Number(editingRule.points),
          periodicity: editingRule.periodicity,
          description: editingRule.description,
          active: editingRule.active
        })
      });

      showToast(res.message, 'success');
      setEditingRule(null);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast('O nome da regra é obrigatório.', 'error');
      return;
    }

    try {
      const res = await apiFetch('/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          type: newType,
          points: Number(newPoints),
          periodicity: newPeriodicity,
          description: newDescription,
          active: 1
        })
      });

      showToast(res.message, 'success');
      setShowCreateModal(false);
      setNewName('');
      setNewPoints(5);
      setNewDescription('');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    setIsDeleting(true);
    try {
      const res = await apiFetch(`/rules/${deletingRule.id}`, {
        method: 'DELETE'
      });

      showToast(res.message, 'success');
      setDeletingRule(null);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleRuleActive = async (rule) => {
    try {
      const res = await apiFetch(`/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: rule.active === 1 ? 0 : 1 })
      });
      showToast(res.message, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/campaign', {
        method: 'PUT',
        body: JSON.stringify({
          name: campName,
          subtitle: campSubtitle,
          startDate: campStart,
          endDate: campEnd,
          status: campStatus
        })
      });

      showToast(res.message, 'success');
      setShowCampaignModal(false);
      loadAll();
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
            <span>⚙️ Regras e Diretrizes da Campanha</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie o catálogo de regras (incluir, editar, ativar e excluir) e ajuste as configurações gerais do período da campanha
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCampaignModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-amber-400" />
            <span>Configurações Gerais</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Regra de Pontuação</span>
          </button>
        </div>
      </div>

      {/* Campaign Info Card */}
      {campaign && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{campaign.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  campaign.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {campaign.status === 'active' ? 'Em Andamento' : 'Congelada / Finalizada'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{campaign.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Período: <strong className="text-white">{campaign.start_date}</strong> a <strong className="text-white">{campaign.end_date}</strong></span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-slate-400">Restam:</span> <strong className="text-amber-400 font-mono text-sm">{campaign.daysRemaining} dias</strong>
            </div>
          </div>
        </div>
      )}

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
              {rules.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Nenhuma regra cadastrada. Clique em "+ Nova Regra de Pontuação" para começar.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
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
                      <span className={Number(rule.points) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {Number(rule.points) > 0 ? `+${rule.points}` : rule.points} pts
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

                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setEditingRule({ ...rule })}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        title="Editar Regra"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingRule(rule)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title="Excluir Regra"
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

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Editar Regra de Pontuação</span>
              </h3>
              <button onClick={() => setEditingRule(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Regra *</label>
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Pontuação</label>
                  <select
                    value={editingRule.type || 'positive'}
                    onChange={(e) => setEditingRule({ ...editingRule, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                  >
                    <option value="positive">🟢 Positiva (Bônus)</option>
                    <option value="negative">🔴 Negativa (Penalidade)</option>
                  </select>
                </div>

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

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Nova Regra de Pontuação</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome da Regra *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Pontualidade Nota 10, Elogio formal, etc."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Pontuação</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                  >
                    <option value="positive">🟢 Positiva (Bônus)</option>
                    <option value="negative">🔴 Negativa (Penalidade)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pontos (+/-) *</label>
                  <input
                    type="number"
                    required
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Periodicidade</label>
                <select
                  value={newPeriodicity}
                  onChange={(e) => setNewPeriodicity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none capitalize"
                >
                  <option value="diario">Diário</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="monitoria">Por Monitoria</option>
                  <option value="avulso">Avulso / Conforme lançamento</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição</label>
                <textarea
                  rows="2"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Critérios para concessão da pontuação..."
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
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Cadastrar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Rule Modal */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Regra de Pontuação</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Tem certeza que deseja excluir a regra <strong className="text-white">{deletingRule.name}</strong> ({deletingRule.points > 0 ? `+${deletingRule.points}` : deletingRule.points} pts)?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingRule(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteRule}
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

      {/* Campaign Settings Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-400" />
                <span>Configurações Gerais da Campanha</span>
              </h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título da Campanha</label>
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subtítulo / Descrição Curta</label>
                <input
                  type="text"
                  value={campSubtitle}
                  onChange={(e) => setCampSubtitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Data de Início</label>
                  <input
                    type="date"
                    required
                    value={campStart}
                    onChange={(e) => setCampStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Data de Término</label>
                  <input
                    type="date"
                    required
                    value={campEnd}
                    onChange={(e) => setCampEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status da Campanha</label>
                <select
                  value={campStatus}
                  onChange={(e) => setCampStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                >
                  <option value="active">🟢 Ativa (Pontos e lançamentos permitidos)</option>
                  <option value="locked">🔴 Congelada / Bloqueada (Pronta para sorteio)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
