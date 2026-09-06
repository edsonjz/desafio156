import React, { useState, useEffect } from 'react';
import { Ticket, Printer, Search, Sparkles, Filter, CheckCircle2, Plus, Edit2, Trash2, X, AlertTriangle, Layers } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function TicketsView({ showToast }) {
  const [activeTab, setActiveTab] = useState('resumo'); // 'resumo' | 'gerenciar'
  const [data, setData] = useState(null);
  const [individualTickets, setIndividualTickets] = useState([]);
  const [operatorsList, setOperatorsList] = useState([]);
  const [printableTickets, setPrintableTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Filter for individual tickets
  const [statusFilter, setStatusFilter] = useState('');
  const [filterOpId, setFilterOpId] = useState('');

  // Create Manual Ticket Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOpId, setCreateOpId] = useState('');
  const [createTicketCode, setCreateTicketCode] = useState('');
  const [createTicketNumber, setCreateTicketNumber] = useState('');
  const [createStatus, setCreateStatus] = useState('valid');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Edit Ticket Modal
  const [editingTicket, setEditingTicket] = useState(null);
  const [editStatus, setEditStatus] = useState('valid');
  const [editCode, setEditCode] = useState('');
  const [editOpId, setEditOpId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Ticket Modal
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    loadSummary();
    loadOperators();
  }, []);

  useEffect(() => {
    if (activeTab === 'gerenciar') {
      loadIndividualTickets();
    }
  }, [activeTab, statusFilter, filterOpId]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/tickets');
      setData(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    try {
      const ops = await apiFetch('/operators?status=active');
      setOperatorsList(ops);
    } catch (err) {
      console.error(err);
    }
  };

  const loadIndividualTickets = async () => {
    setTicketsLoading(true);
    try {
      let url = '/tickets/list';
      const params = [];
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (filterOpId) params.push(`operatorId=${filterOpId}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await apiFetch(url);
      setIndividualTickets(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!createOpId) {
      showToast('Selecione um operador.', 'error');
      return;
    }

    setCreatingTicket(true);
    try {
      const res = await apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          operatorId: Number(createOpId),
          ticketCode: createTicketCode || undefined,
          ticketNumber: createTicketNumber ? Number(createTicketNumber) : undefined,
          status: createStatus
        })
      });

      showToast(res.message, 'success');
      setShowCreateModal(false);
      setCreateOpId('');
      setCreateTicketCode('');
      setCreateTicketNumber('');
      setCreateStatus('valid');

      loadSummary();
      if (activeTab === 'gerenciar') loadIndividualTickets();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreatingTicket(false);
    }
  };

  const openEditModal = (t) => {
    setEditingTicket(t);
    setEditStatus(t.status || 'valid');
    setEditCode(t.ticket_code || '');
    setEditOpId(t.operator_id || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTicket) return;

    setSavingEdit(true);
    try {
      const res = await apiFetch(`/tickets/${editingTicket.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          operatorId: Number(editOpId),
          ticketCode: editCode,
          status: editStatus
        })
      });

      showToast(res.message, 'success');
      setEditingTicket(null);
      loadSummary();
      loadIndividualTickets();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTicket) return;
    setDeletingLoading(true);
    try {
      const res = await apiFetch(`/tickets/${deletingTicket.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      setDeletingTicket(null);
      loadSummary();
      loadIndividualTickets();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  const loadPrintableTickets = async (operatorId = '') => {
    try {
      const url = operatorId ? `/tickets/printable?operatorId=${operatorId}` : '/tickets/printable';
      const tickets = await apiFetch(url);
      setPrintableTickets(tickets);
      setShowPrintModal(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handlePrintWindow = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const operators = data?.operators || [];
  const filteredOperators = operators.filter(op =>
    op.operator_name.toLowerCase().includes(search.toLowerCase()) ||
    op.registration.toLowerCase().includes(search.toLowerCase())
  );

  const filteredIndividualTickets = individualTickets.filter(t => {
    const s = search.toLowerCase();
    return (
      !s ||
      (t.ticket_code && t.ticket_code.toLowerCase().includes(s)) ||
      (t.operator_name && t.operator_name.toLowerCase().includes(s)) ||
      (t.operator_registration && t.operator_registration.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-amber-400" />
            <span>🎟️ Controladora e Gestão de Bilhetes</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualização, conferência, impressão e controle manual de bilhetes para o sorteio físico
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-xs">
            <span className="text-slate-400">Total de Bilhetes:</span>{' '}
            <strong className="text-amber-400 text-sm font-black">{data?.totalTicketsGenerated || 0}</strong>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Bilhete Manual</span>
          </button>

          <button
            onClick={() => loadPrintableTickets('')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Todos</span>
          </button>
        </div>
      </div>

      {/* Rules Indicator Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-200">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <strong>Regra Oficial:</strong> A cada 50 pontos acumulados = 1 bilhete físico. Os supervisores também podem emitir bilhetes avulsos de bonificação, editar ou cancelar bilhetes emitidos.
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('resumo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'resumo'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Resumo por Operador</span>
        </button>

        <button
          onClick={() => setActiveTab('gerenciar')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'gerenciar'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Gerenciar Bilhetes Individuais</span>
        </button>
      </div>

      {/* Tab 1: Resumo por Operador */}
      {activeTab === 'resumo' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por operador ou matrícula..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="py-3.5 px-4">Operador</th>
                    <th className="py-3.5 px-4">Matrícula</th>
                    <th className="py-3.5 px-4">Pontos Acumulados</th>
                    <th className="py-3.5 px-4">Bilhetes Conquistados</th>
                    <th className="py-3.5 px-4">Faltam p/ Próximo</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ação de Impressão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOperators.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-500">
                        Nenhum operador encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredOperators.map((op) => (
                      <tr key={op.operator_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {op.operator_name}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {op.registration}
                        </td>

                        <td className="py-3.5 px-4 font-black text-amber-400">
                          {op.total_points > 0 ? `+${op.total_points}` : op.total_points} pts
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <Ticket className="w-4 h-4 text-amber-400" />
                            <span>{op.ticket_count} {op.ticket_count === 1 ? 'bilhete' : 'bilhetes'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 font-semibold">
                          {op.points_remaining} pts
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Disponível</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            disabled={op.ticket_count === 0}
                            onClick={() => loadPrintableTickets(op.operator_id)}
                            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ml-auto transition border border-slate-700"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Ver / Imprimir ({op.ticket_count})</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Gerenciamento de Bilhetes Individuais */}
      {activeTab === 'gerenciar' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por código, operador ou matrícula..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <select
                value={filterOpId}
                onChange={(e) => setFilterOpId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todos os Operadores</option>
                {operatorsList.map(op => (
                  <option key={op.id} value={op.id}>{op.name} ({op.registration})</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todos os Status</option>
                <option value="valid">Válido</option>
                <option value="used">Utilizado / Sorteado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Total listado: <strong className="text-white font-bold">{filteredIndividualTickets.length}</strong> bilhetes
            </div>
          </div>

          {/* Individual Tickets Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {ticketsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Carregando bilhetes...</div>
            ) : filteredIndividualTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Nenhum bilhete encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="py-3 px-4">Número</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Operador</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Data Emissão</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredIndividualTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          #{String(t.ticket_number).padStart(4, '0')}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {t.ticket_code}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{t.operator_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.operator_registration}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'valid'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : t.status === 'used'
                              ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          }`}>
                            {t.status === 'valid' ? 'Válido' : t.status === 'used' ? 'Utilizado' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {t.generated_at ? t.generated_at.substring(0, 16).replace('T', ' ') : '-'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(t)}
                              title="Editar Bilhete"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingTicket(t)}
                              title="Excluir Bilhete"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Novo Bilhete Manual */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Emitir Bilhete Manual</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Operador *</label>
                <select
                  required
                  value={createOpId}
                  onChange={(e) => setCreateOpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Selecione o operador --</option>
                  {operatorsList.map(op => (
                    <option key={op.id} value={op.id}>{op.name} ({op.registration})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Número (opcional)</label>
                  <input
                    type="number"
                    value={createTicketNumber}
                    onChange={(e) => setCreateTicketNumber(e.target.value)}
                    placeholder="Automático se vazio"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Código (opcional)</label>
                  <input
                    type="text"
                    value={createTicketCode}
                    onChange={(e) => setCreateTicketCode(e.target.value)}
                    placeholder="Ex: TKT-1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Status Inicial</label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="valid">Válido (apto ao sorteio)</option>
                  <option value="used">Utilizado / Já Sorteado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                >
                  {creatingTicket ? 'Emitindo...' : 'Emitir Bilhete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Bilhete */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Editar Bilhete #{editingTicket.ticket_number}</span>
              </h3>
              <button onClick={() => setEditingTicket(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Operador</label>
                <select
                  required
                  value={editOpId}
                  onChange={(e) => setEditOpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {operatorsList.map(op => (
                    <option key={op.id} value={op.id}>{op.name} ({op.registration})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Código do Bilhete</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="valid">Válido (apto ao sorteio)</option>
                  <option value="used">Utilizado / Já Sorteado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Bilhete */}
      {deletingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white mb-1">Excluir Bilhete?</h3>
              <p className="text-xs text-slate-300">
                Tem certeza que deseja excluir o bilhete <strong className="text-amber-400 font-mono">{deletingTicket.ticket_code}</strong> (#{deletingTicket.ticket_number}) de <strong className="text-white">{deletingTicket.operator_name}</strong>?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTicket(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deletingLoading}
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {deletingLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print View Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3 no-print">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-400" />
                  <span>Visualização de Bilhetes Físicos para Impressão</span>
                </h3>
                <p className="text-xs text-slate-400">Pronto para recortar e depositar na urna física</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintWindow}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Agora (Ctrl+P)</span>
                </button>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Printable Cards Grid */}
            <div id="printable-tickets-area" className="flex-1 overflow-y-auto p-4 space-y-4">
              {printableTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Nenhum bilhete para exibir.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6">
                  {printableTickets.map((tkt) => (
                    <div
                      key={tkt.ticketId}
                      className="ticket-border bg-slate-800/90 text-white rounded-2xl p-5 relative shadow-xl border-amber-500/40"
                    >
                      <div className="ticket-notch-left" />
                      <div className="ticket-notch-right" />

                      <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 mb-3">
                        <div>
                          <div className="text-xs font-black text-amber-400 tracking-wider">🎯 DESAFIO 156</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{tkt.campaignName}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                            {tkt.ticketNumberFormatted}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 mb-4">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Operador Participante</div>
                        <div className="text-base font-black text-white">{tkt.operatorName}</div>
                        <div className="text-xs font-mono text-slate-300">Matrícula: {tkt.operatorRegistration}</div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px]">Bilhete do Operador:</span>
                          <div className="font-bold text-amber-400">
                            Bilhete {tkt.operatorTicketIndex} de {tkt.operatorTotalTickets}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-400 text-[10px]">Data de Emissão:</span>
                          <div className="font-mono text-slate-300">{tkt.issueDate}</div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-dashed border-slate-700 text-center text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                        🎟️ {tkt.sorteioTag}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
