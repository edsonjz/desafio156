import React, { useState, useEffect } from 'react';
import { Ticket, Printer, Search, Sparkles, Filter, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function TicketsView({ showToast }) {
  const [data, setData] = useState(null);
  const [printableTickets, setPrintableTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedOpFilter, setSelectedOpFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-amber-400" />
            <span>🎟️ Controladora de Bilhetes da Campanha</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualização, conferência e geração de bilhetes físicos para a urna do sorteio
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-xs">
            <span className="text-slate-400">Total de Bilhetes Gerados:</span>{' '}
            <strong className="text-amber-400 text-sm font-black">{data?.totalTicketsGenerated || 0}</strong>
          </div>

          <button
            onClick={() => loadPrintableTickets('')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Todos os Bilhetes</span>
          </button>
        </div>
      </div>

      {/* Rules Indicator Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-200">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <strong>Regra Oficial:</strong> A cada 50 pontos acumulados = 1 bilhete físico. Os pontos acumulam continuamente e não são consumidos com a emissão dos bilhetes. Sorteio físico manual na operação 156.
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por operador ou matrícula..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
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
            <tbody className="divide-y divide-slate-800/60 text-xs">
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
