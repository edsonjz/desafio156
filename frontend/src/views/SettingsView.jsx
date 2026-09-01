import React, { useState } from 'react';
import { Settings, KeyRound, Lock, AlertTriangle, CheckCircle2, ShieldCheck, Flame } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function SettingsView({ campaign, onCampaignUpdate, showToast }) {
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Lock Modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [locking, setLocking] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Preencha a senha atual e a nova senha.', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      showToast(res.message, 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConfirmLock = async () => {
    setLocking(true);
    try {
      const res = await apiFetch('/campaign/lock', { method: 'POST' });
      showToast(res.message, 'success');
      setShowLockModal(false);
      if (onCampaignUpdate) onCampaignUpdate();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">⚙️ Configurações do Sistema</h2>
          <p className="text-xs text-slate-400">Gerenciamento de credenciais administrativas e ciclo da campanha</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Alterar Senha */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <KeyRound className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">Alteração de Senha</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Senha Atual *</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-sky-600/20 transition disabled:opacity-50"
              >
                {passwordLoading ? 'Atualizando...' : 'Atualizar Minha Senha'}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Encerramento da Campanha */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Lock className="w-5 h-5 text-rose-400" />
              <h3 className="text-base font-bold text-white">Encerramento da Campanha</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div>Campanha: <strong className="text-white">DESAFIO 156</strong></div>
                <div>Período: <strong className="text-amber-400">01/09/2026 → 11/12/2026</strong></div>
                <div>Status Atual: <strong className={campaign?.isLocked ? 'text-rose-400' : 'text-emerald-400'}>
                  {campaign?.isLocked ? '🔒 ENCERRADA & CONGELADA' : '🟢 EM ANDAMENTO'}
                </strong></div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ao encerrar a campanha, todos os lançamentos de pontos serão bloqueados e os bilhetes gerados serão congelados para a realização do sorteio físico.
              </p>
            </div>
          </div>

          <div className="pt-4">
            {campaign?.isLocked ? (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl text-center font-bold">
                🔒 A Campanha DESAFIO 156 já se encontra encerrada e congelada.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLockModal(true)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>🔒 ENCERRAR CAMPANHA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Lock Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border-2 border-rose-500/40">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white text-center mb-3">
              Confirmação de Encerramento
            </h3>

            <div className="bg-slate-950 border border-rose-500/30 text-rose-200 text-xs p-4 rounded-2xl mb-6 text-center leading-relaxed font-semibold">
              "Ao encerrar a campanha, a pontuação e a quantidade de bilhetes serão congeladas para o sorteio físico. Essa ação deve ser realizada somente após a conferência dos dados."
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="w-1/2 py-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                disabled={locking}
                onClick={handleConfirmLock}
                className="w-1/2 py-3 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {locking ? 'Encerrando...' : 'Sim, Encerrar Campanha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
