import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Filter } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function AuditView({ showToast }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/audit');
      setLogs(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.entity.toLowerCase().includes(search.toLowerCase()) ||
    log.user_id.toLowerCase().includes(search.toLowerCase()) ||
    JSON.stringify(log.new_value || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-sky-400" />
            <span>📋 Trilha de Auditoria do Sistema</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registro imutável de todas as ações administrativas realizadas no sistema
          </p>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar logs..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Usuário</th>
                <th className="py-3.5 px-4">Ação</th>
                <th className="py-3.5 px-4">Entidade</th>
                <th className="py-3.5 px-4">ID Entidade</th>
                <th className="py-3.5 px-4">Detalhes da Alteração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500 font-sans">
                    Carregando registros de auditoria...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500 font-sans">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {log.created_at}
                    </td>

                    <td className="py-3 px-4 font-bold text-sky-300">
                      {log.user_id}
                    </td>

                    <td className="py-3 px-4 font-bold text-amber-300">
                      {log.action}
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {log.entity}
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {log.entity_id || '-'}
                    </td>

                    <td className="py-3 px-4 text-slate-400 max-w-md truncate" title={log.new_value}>
                      {log.new_value || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
