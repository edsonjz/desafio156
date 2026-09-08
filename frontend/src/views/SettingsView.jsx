import React, { useState, useEffect } from 'react';
import {
  Settings,
  KeyRound,
  Lock,
  AlertTriangle,
  ShieldCheck,
  UserPlus,
  Users,
  Trash2,
  RefreshCw,
  Crown,
  Shield,
  User,
  CheckCircle2,
  X
} from 'lucide-react';
import { apiFetch } from '../services/api';

export default function SettingsView({ campaign, onCampaignUpdate, showToast, user }) {
  // Password change state (own password)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Lock Campaign Modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [locking, setLocking] = useState(false);

  // Admin users management state
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Create Admin Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createRole, setCreateRole] = useState('admin');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Reset Password Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Delete Admin Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const isMaster = user?.isMaster || user?.role === 'master';

  useEffect(() => {
    loadAdminUsers();
  }, []);

  const loadAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await apiFetch('/auth/users');
      setAdminUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar administradores:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Change own password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Preencha todos os campos da alteração de senha.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('A nova senha e a confirmação não coincidem.', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      showToast(res.message || 'Senha alterada com sucesso!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err.message || 'Falha ao alterar senha.', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Create new admin (Master only)
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    const cleanUser = createUsername.trim().toLowerCase();

    if (!cleanUser || cleanUser.length < 3) {
      showToast('O nome de usuário deve ter pelo menos 3 caracteres.', 'error');
      return;
    }

    if (!createPassword || createPassword.length < 6) {
      showToast('A senha inicial deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    if (createPassword !== createConfirmPassword) {
      showToast('As senhas digitadas não coincidem.', 'error');
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await apiFetch('/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username: cleanUser,
          password: createPassword,
          role: createRole
        })
      });

      showToast(res.message || 'Administrador criado com sucesso!', 'success');
      setShowCreateModal(false);
      setCreateUsername('');
      setCreatePassword('');
      setCreateConfirmPassword('');
      setCreateRole('admin');
      loadAdminUsers();
    } catch (err) {
      showToast(err.message || 'Erro ao criar administrador.', 'error');
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Reset another admin's password (Master only)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    if (!resetNewPassword || resetNewPassword.length < 6) {
      showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      showToast('As senhas digitadas não coincidem.', 'error');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await apiFetch(`/auth/users/${resetTargetUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: resetNewPassword })
      });

      showToast(res.message || 'Senha redefinida com sucesso!', 'success');
      setShowResetModal(false);
      setResetTargetUser(null);
      setResetNewPassword('');
      setResetConfirmPassword('');
    } catch (err) {
      showToast(err.message || 'Erro ao redefinir senha.', 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete admin (Master only)
  const handleConfirmDelete = async () => {
    if (!deleteTargetUser) return;

    setDeletingUser(true);
    try {
      const res = await apiFetch(`/auth/users/${deleteTargetUser.id}`, {
        method: 'DELETE'
      });

      showToast(res.message || 'Administrador removido com sucesso.', 'success');
      setShowDeleteModal(false);
      setDeleteTargetUser(null);
      loadAdminUsers();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir administrador.', 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  // Campaign lock
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Configurações &amp; Segurança</span>
            </h2>
            <p className="text-xs text-slate-400">
              Gerenciamento de credenciais, controle de acessos de administradores e encerramento de ciclo
            </p>
          </div>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl">
          {isMaster ? (
            <>
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Perfil de Acesso</div>
                <div className="text-xs font-black text-white">{user?.username} (Master Admin)</div>
              </div>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold tracking-wider text-sky-400">Perfil de Acesso</div>
                <div className="text-xs font-bold text-white">{user?.username} (Administrador)</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Alterar Minha Senha */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <KeyRound className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-base font-bold text-white">Alteração de Senha</h3>
                <p className="text-[11px] text-slate-400">Substitua sua senha de acesso a qualquer momento</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Senha Atual *</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nova Senha *</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-sky-600/20 transition disabled:opacity-50"
              >
                {passwordLoading ? 'Atualizando senha...' : 'Atualizar Minha Senha'}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Encerramento da Campanha */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Lock className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-base font-bold text-white">Encerramento da Campanha</h3>
                <p className="text-[11px] text-slate-400">Congelamento oficial de pontuação e bilhetes</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Campanha:</span>
                  <strong className="text-white">DESAFIO 156</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Período:</span>
                  <strong className="text-amber-400">01/09/2026 → 11/12/2026</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status Atual:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    campaign?.isLocked
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {campaign?.isLocked ? '🔒 ENCERRADA & CONGELADA' : '🟢 EM ANDAMENTO'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ao encerrar a campanha, todos os lançamentos manuais e em lote são bloqueados imediatamente, e os bilhetes gerados são congelados para o sorteio físico.
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

      {/* Card 3: Gestão de Administradores (Full Management for Master Admin) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Usuários Administradores</span>
                <span className="bg-slate-800 text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold">
                  {adminUsers.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isMaster
                  ? 'Como Master Admin, você pode criar novos usuários com acesso total, redefinir senhas e gerenciar acessos.'
                  : 'Lista de usuários administrativos com acesso autorizado ao sistema.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAdminUsers}
              disabled={loadingUsers}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
            </button>

            {isMaster && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Novo Administrador</span>
              </button>
            )}
          </div>
        </div>

        {/* Table of Admins */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Usuário</th>
                <th className="py-2.5 px-3">Perfil de Acesso</th>
                <th className="py-2.5 px-3">Cadastrado em</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {adminUsers.map((u) => {
                const isUserMaster = u.role === 'master';
                const isCurrent = u.id === user?.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span>{u.username}</span>
                        {isCurrent && (
                          <span className="ml-2 text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30">
                            Você
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {isUserMaster ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          <Crown className="w-3 h-3" />
                          Master Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-sky-500/10 border border-sky-500/30 text-sky-300 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          <Shield className="w-3 h-3" />
                          Administrador Total
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : 'Original'}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isMaster ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetUser(u);
                              setResetNewPassword('');
                              setResetConfirmPassword('');
                              setShowResetModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition flex items-center gap-1"
                            title="Redefinir Senha deste Administrador"
                          >
                            <KeyRound className="w-3 h-3 text-amber-400" />
                            <span>Redefinir Senha</span>
                          </button>

                          {!isCurrent && u.username !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTargetUser(u);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] transition"
                              title="Excluir Administrador"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Protegido</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isMaster && (
          <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Você está autenticado como <strong>Administrador</strong> com permissão total em todos os módulos da plataforma (lançamentos de pontos, regras, bilhetes, auditoria e avaliações).
            </span>
          </div>
        )}
      </div>

      {/* Modal: Criar Novo Administrador (Master only) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <span>Novo Usuário Administrador</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome de Usuário (Login) *</label>
                <input
                  type="text"
                  required
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="Ex: supervisor_ana, gestor.joao"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Apenas letras minúsculas, números, pontos ou hífens</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Perfil de Acesso *</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="admin">Administrador (Acesso Total à Operação)</option>
                  <option value="master">Master Admin (Acesso Total + Gestão de Usuários)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Senha Inicial *</label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Senha Inicial *</label>
                <input
                  type="password"
                  required
                  value={createConfirmPassword}
                  onChange={(e) => setCreateConfirmPassword(e.target.value)}
                  placeholder="Repita a senha inicial"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {creatingAdmin ? 'Cadastrando...' : 'Criar Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redefinir Senha de Outro Usuário (Master only) */}
      {showResetModal && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Redefinir Senha de {resetTargetUser.username}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-600/20 transition disabled:opacity-50"
                >
                  {resettingPassword ? 'Atualizando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Administrador (Master only) */}
      {showDeleteModal && deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white text-center mb-2">
              Remover Administrador
            </h3>

            <p className="text-xs text-slate-300 text-center mb-6 leading-relaxed">
              Tem certeza que deseja revogar o acesso do usuário <strong>"{deleteTargetUser.username}"</strong>? Ele não poderá mais autenticar no sistema.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingUser}
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
              >
                {deletingUser ? 'Excluindo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

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
