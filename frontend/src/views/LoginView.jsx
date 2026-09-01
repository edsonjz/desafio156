import React, { useState } from 'react';
import { Target, Lock, User, KeyRound, ArrowRight, Flame } from 'lucide-react';
import { apiFetch, setToken } from '../services/api';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin156');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      setToken(data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Falha ao autenticar. Verifique o usuário e a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow graphics */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/20">
            <Flame className="w-9 h-9 text-slate-950" />
          </div>
          
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>🎯 DESAFIO 156</span>
          </h1>
          <p className="text-xs text-amber-400 font-semibold mt-1">
            Campanha de Performance &amp; Reconhecimento 156
          </p>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            01/09/2026 → 11/12/2026<br/>
            Chances de conquistar sua folga de Natal e Ano Novo.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Usuário</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                placeholder="Nome de usuário"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                placeholder="Sua senha"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {loading ? (
              <span>Entrando...</span>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-full">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Acesso exclusivo para Administrador / Supervisão 156</span>
          </div>
        </div>
      </div>
    </div>
  );
}
