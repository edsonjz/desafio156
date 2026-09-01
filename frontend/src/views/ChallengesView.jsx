import React, { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle, Trophy, Users, Calendar, Sparkles } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function ChallengesView({ showToast, onTicketAlert }) {
  const [challenges, setChallenges] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Challenge Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-15');
  const [rewardPoints, setRewardPoints] = useState('30');
  const [selectedOpIds, setSelectedOpIds] = useState([]);

  // Conclude Modal
  const [concludeChallenge, setConcludeChallenge] = useState(null);
  const [completedOpIds, setCompletedOpIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ch, ops] = await Promise.all([
        apiFetch('/challenges'),
        apiFetch('/operators?status=active')
      ]);
      setChallenges(ch);
      setOperators(ops);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    if (!name || !description || !rewardPoints) {
      showToast('Preencha os campos obrigatórios do desafio.', 'error');
      return;
    }

    try {
      const res = await apiFetch('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          startDate,
          endDate,
          rewardPoints: Number(rewardPoints),
          operatorIds: selectedOpIds
        })
      });

      showToast(res.message, 'success');
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setSelectedOpIds([]);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleConcludeSubmit = async () => {
    if (!concludeChallenge) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/challenges/${concludeChallenge.id}/conclude`, {
        method: 'PUT',
        body: JSON.stringify({ completedOperatorIds: completedOpIds })
      });

      showToast(res.message, 'success');
      setConcludeChallenge(null);
      setCompletedOpIds([]);
      loadData();
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-400" />
            <span>🎯 Desafios Especiais da Operação</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Crie e gerencie campanhas temáticas e conceda pontos automáticos aos operadores que concluírem o objetivo
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Desafio Especial</span>
        </button>
      </div>

      {/* Challenges Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {challenges.map((ch) => (
          <div
            key={ch.id}
            className={`bg-slate-900 border rounded-2xl p-6 shadow-xl flex flex-col justify-between ${
              ch.status === 'concluido' ? 'border-slate-800 opacity-80' : 'border-amber-500/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>{ch.start_date} → {ch.end_date}</span>
                </span>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  ch.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  {ch.status}
                </span>
              </div>

              <h3 className="text-lg font-black text-white mb-2">{ch.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">{ch.description}</p>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs my-4">
                <span className="text-slate-400">Recompensa ao Concluir:</span>
                <strong className="text-amber-400 text-sm font-black">+{ch.reward_points} PONTOS</strong>
              </div>
            </div>

            {ch.status === 'ativo' ? (
              <button
                onClick={() => {
                  setConcludeChallenge(ch);
                  setCompletedOpIds(operators.map(o => o.id)); // default select all
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Concluir Desafio e Conceder Pontos</span>
              </button>
            ) : (
              <div className="text-center py-2 text-xs font-bold text-slate-500 bg-slate-950/60 border border-slate-800 rounded-xl">
                ✓ Desafio Concluído (Pontuação Concedida)
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              <span>Novo Desafio Especial</span>
            </h3>

            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Desafio *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Semana da Excelência"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição / Regra *</label>
                <textarea
                  rows="2"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Manter monitoria acima de 99% durante toda a semana."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Início *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Término *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pontos *</label>
                  <input
                    type="number"
                    required
                    value={rewardPoints}
                    onChange={(e) => setRewardPoints(e.target.value)}
                    placeholder="Ex: 30"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
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
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  Criar Desafio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conclude Challenge Modal */}
      {concludeChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>Concluir Desafio "{concludeChallenge.name}"</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Selecione os operadores que concluíram com êxito o desafio para receberem automaticamente <strong className="text-amber-400">+{concludeChallenge.reward_points} pontos</strong> cada.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1 bg-slate-950 p-2 border border-slate-800 rounded-xl mb-4">
              {operators.map(op => {
                const checked = completedOpIds.includes(op.id);
                return (
                  <label key={op.id} className="flex items-center gap-2 p-2 hover:bg-slate-900 rounded-lg cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setCompletedOpIds([...completedOpIds, op.id]);
                        else setCompletedOpIds(completedOpIds.filter(id => id !== op.id));
                      }}
                      className="rounded text-amber-500 border-slate-700 bg-slate-900"
                    />
                    <span className="font-bold text-white">{op.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConcludeChallenge(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConcludeSubmit}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {submitting ? 'Concedendo...' : `Confirmar +${concludeChallenge.reward_points} pts (${completedOpIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
