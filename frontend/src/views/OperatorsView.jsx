import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Edit2,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  Ticket,
  Sparkles
} from 'lucide-react';
import { apiFetch, apiUpload } from '../services/api';

export default function OperatorsView({ onNavigate, showToast }) {
  const [operators, setOperators] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newReg, setNewReg] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit Modal
  const [editOp, setEditOp] = useState(null);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadOperators();
  }, [statusFilter]);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/operators?status=${statusFilter}`);
      setOperators(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/operators', {
        method: 'POST',
        body: JSON.stringify({ name: newName, registration: newReg, notes: newNotes })
      });
      showToast(res.message, 'success');
      setShowCreateModal(false);
      setNewName('');
      setNewReg('');
      setNewNotes('');
      loadOperators();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editOp) return;
    try {
      const res = await apiFetch(`/operators/${editOp.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editOp.name,
          registration: editOp.registration,
          status: editOp.status,
          notes: editOp.notes
        })
      });
      showToast(res.message, 'success');
      setEditOp(null);
      loadOperators();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiUpload('/operators/import-preview', formData);
      setImportPreview(res);
    } catch (err) {
      showToast(err.message, 'error');
      setImportPreview(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !importPreview.previewList) return;
    setImporting(true);
    try {
      const opsToImport = importPreview.previewList.map(p => ({
        name: p.name,
        registration: p.registration,
        notes: p.notes
      }));

      const res = await apiFetch('/operators/import-confirm', {
        method: 'POST',
        body: JSON.stringify({ operators: opsToImport })
      });

      showToast(res.message, 'success');
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      loadOperators();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/operators/template', '_blank');
  };

  const filteredOperators = operators.filter(op =>
    op.name.toLowerCase().includes(search.toLowerCase()) ||
    op.registration.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            <span>Gestão de Operadores</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre, edite e importe os operadores participantes da Operação 156
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Baixar Modelo Excel</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Excel / CSV</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Operador</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'active' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ativos ({operators.filter(o => o.status === 'active').length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'inactive' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inativos
          </button>
        </div>
      </div>

      {/* Operators Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4">Matrícula</th>
                <th className="py-3.5 px-4">Pontuação Atual</th>
                <th className="py-3.5 px-4">Bilhetes Conquistados</th>
                <th className="py-3.5 px-4">Próximo Bilhete</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Carregando operadores...
                  </td>
                </tr>
              ) : filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Nenhum operador encontrado.
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-bold text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-amber-400 text-xs">
                          {op.name.charAt(0)}
                        </div>
                        <div>
                          <span>{op.name}</span>
                          {op.notes && (
                            <div className="text-[10px] text-slate-500 font-normal">{op.notes}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300 font-semibold">
                      {op.registration}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`font-black text-sm ${op.totalPoints < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {op.totalPoints > 0 ? `+${op.totalPoints}` : op.totalPoints} pts
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        <Ticket className="w-4 h-4 text-amber-400" />
                        <span>{op.totalTickets} {op.totalTickets === 1 ? 'bilhete' : 'bilhetes'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
                          <span>{op.currentTicketProgress}/50</span>
                          <span>Faltam {op.pointsToNextTicket} pts</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                            style={{ width: `${(op.currentTicketProgress / 50) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        op.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                      }`}>
                        {op.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onNavigate(`operador-${op.id}`)}
                          className="p-1.5 text-sky-400 hover:bg-sky-500/10 rounded-lg transition"
                          title="Ver Perfil e Extrato"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setEditOp(op)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Editar Cadastro"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Novo Operador</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Ex: Pedro Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Matrícula</label>
                <input
                  type="text"
                  required
                  value={newReg}
                  onChange={(e) => setNewReg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Ex: OP15650"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações (opcional)</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows="2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Ex: Turno Tarde"
                />
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
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Editar Operador</span>
              </h3>
              <button onClick={() => setEditOp(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editOp.name}
                  onChange={(e) => setEditOp({ ...editOp, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Matrícula</label>
                <input
                  type="text"
                  required
                  value={editOp.registration}
                  onChange={(e) => setEditOp({ ...editOp, registration: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                <select
                  value={editOp.status}
                  onChange={(e) => setEditOp({ ...editOp, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo (soft delete - preserva histórico)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
                <textarea
                  value={editOp.notes || ''}
                  onChange={(e) => setEditOp({ ...editOp, notes: e.target.value })}
                  rows="2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950"
                >
                  Atualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Importação em Massa via Excel / CSV</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center bg-slate-950/50">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-file-input"
                />
                <label htmlFor="excel-file-input" className="cursor-pointer flex flex-col items-center">
                  <FileSpreadsheet className="w-10 h-10 text-slate-500 mb-2" />
                  <span className="text-xs font-bold text-slate-200">
                    {importFile ? importFile.name : 'Clique para selecionar o arquivo Excel (.xlsx) ou CSV'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Colunas aceitas: Nome Completo, Matrícula, Observações
                  </span>
                </label>
              </div>

              {/* Preview Box */}
              {importPreview && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Prévia da Importação</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                      <div className="text-slate-400 text-[10px]">Encontrados</div>
                      <div className="text-sm font-black text-white">{importPreview.totalFound}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                      <div className="text-slate-400 text-[10px]">Novos</div>
                      <div className="text-sm font-black text-emerald-400">+{importPreview.newCount}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">
                      <div className="text-slate-400 text-[10px]">Atualizações</div>
                      <div className="text-sm font-black text-amber-400">{importPreview.existingCount}</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    Foram encontrados <strong>{importPreview.totalFound} operadores</strong> no arquivo.
                    Serão inseridos <strong>{importPreview.newCount} novos operadores</strong> e atualizados <strong>{importPreview.existingCount} já existentes</strong>.
                    Deseja confirmar a importação?
                  </p>

                  {importPreview.errors && importPreview.errors.length > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] p-2.5 rounded-lg space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Avisos nas linhas do arquivo:</span>
                      </div>
                      {importPreview.errors.map((err, idx) => (
                        <div key={idx}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!importPreview || importing}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {importing ? 'Importando...' : 'Confirmar Importação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
