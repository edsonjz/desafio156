import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  FileCheck,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  TrendingUp,
  Download,
  Upload,
  Plus,
  Search,
  Filter,
  Copy,
  RotateCcw,
  Ban,
  ExternalLink,
  Eye,
  Sliders,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  BarChart3,
  HelpCircle
} from 'lucide-react';
import { apiFetch, apiUpload } from '../services/api';

export default function IptuAdminView({ showToast }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'operadores' | 'resultados' | 'desempenho' | 'configuracoes'
  const [loading, setLoading] = useState(true);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [operators, setOperators] = useState([]);
  const [results, setResults] = useState([]);
  const [questionsStats, setQuestionsStats] = useState(null);
  const [difficultyStats, setDifficultyStats] = useState(null);
  const [settings, setSettings] = useState({
    nome_prova: 'Avaliação de Conhecimentos — IPTU e TCL Porto Alegre',
    nota_minima_aprovacao: 70,
    tempo_maximo_minutos: 30,
    max_tentativas_padrao: 1,
    exibir_resultado_operador: true
  });

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showOpModal, setShowOpModal] = useState(false);
  const [editingOp, setEditingOp] = useState(null);
  const [opFormData, setOpFormData] = useState({ nome: '', matricula: '' });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionData, setCorrectionData] = useState(null);
  const [correctionLoading, setCorrectionLoading] = useState(false);

  // Test Runner preview modal (simulate operator link directly)
  const [previewToken, setPreviewToken] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dash, ops, res, qStats, diffStats, cfg] = await Promise.all([
        apiFetch('/iptu/dashboard'),
        apiFetch('/iptu/operators'),
        apiFetch('/iptu/results'),
        apiFetch('/iptu/stats/questions'),
        apiFetch('/iptu/stats/difficulty'),
        apiFetch('/iptu/settings')
      ]);

      setDashboardData(dash);
      setOperators(ops);
      setResults(res);
      setQuestionsStats(qStats);
      setDifficultyStats(diffStats);
      if (cfg) setSettings(cfg);
    } catch (err) {
      showToast(err.message || 'Erro ao carregar dados da Prova IPTU.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Operator Actions
  const handleSaveOperator = async (e) => {
    e.preventDefault();
    if (!opFormData.nome || !opFormData.nome.trim()) {
      showToast('O nome completo do operador é obrigatório.', 'warning');
      return;
    }

    try {
      if (editingOp) {
        await apiFetch(`/iptu/operators/${editingOp.id}`, {
          method: 'PUT',
          body: JSON.stringify(opFormData)
        });
        showToast('Operador atualizado com sucesso!', 'success');
      } else {
        await apiFetch('/iptu/operators', {
          method: 'POST',
          body: JSON.stringify(opFormData)
        });
        showToast('Operador cadastrado com sucesso!', 'success');
      }
      setShowOpModal(false);
      setEditingOp(null);
      setOpFormData({ nome: '', matricula: '' });
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteOperator = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este operador da prova?')) return;
    try {
      await apiFetch(`/iptu/operators/${id}`, { method: 'DELETE' });
      showToast('Operador excluído com sucesso.', 'info');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGenerateToken = async (id) => {
    try {
      const res = await apiFetch(`/iptu/operators/${id}/generate-token`, { method: 'POST' });
      showToast(`Novo token gerado: ${res.token}`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleGenerateAllTokens = async () => {
    if (!window.confirm('Deseja gerar novos tokens para TODOS os operadores cadastrados?')) return;
    try {
      const res = await apiFetch('/iptu/operators/generate-all-tokens', { method: 'POST' });
      showToast(`${res.generatedCount} tokens gerados com sucesso!`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleInvalidateToken = async (token) => {
    if (!window.confirm(`Deseja invalidar o token ${token}?`)) return;
    try {
      await apiFetch('/iptu/operators/invalidate-token', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      showToast('Token invalidado com sucesso.', 'info');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAllowRetry = async (id) => {
    if (!window.confirm('Deseja liberar uma NOVA TENTATIVA para este operador? A tentativa anterior será mantida no histórico.')) return;
    try {
      const res = await apiFetch(`/iptu/operators/${id}/retry`, { method: 'POST' });
      showToast(`Nova tentativa liberada! Token: ${res.token}`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCopyLink = (token) => {
    if (!token) return;
    const url = `${window.location.origin}/prova-iptu/${token}`;
    navigator.clipboard.writeText(url);
    showToast('Link da prova copiado para a área de transferência!', 'success');
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      showToast('Selecione um arquivo .xlsx ou .csv.', 'warning');
      return;
    }

    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await apiUpload('/iptu/operators/import', formData);
      setImportResult(res);
      showToast(`Importação concluída: ${res.importedCount} importados, ${res.duplicateCount} duplicados.`, 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const handleOpenCorrection = async (tentativaId) => {
    setShowCorrectionModal(true);
    setCorrectionLoading(true);
    try {
      const res = await apiFetch(`/iptu/results/${tentativaId}/correction`);
      setCorrectionData(res);
    } catch (err) {
      showToast(err.message, 'error');
      setShowCorrectionModal(false);
    } finally {
      setCorrectionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/iptu/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      showToast('Configurações da Prova IPTU salvas com sucesso!', 'success');
      loadAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExportExcel = () => {
    window.open('/api/iptu/export/results', '_blank');
  };

  const filteredOperators = operators.filter((op) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      op.nome.toLowerCase().includes(s) ||
      op.matricula.toLowerCase().includes(s) ||
      (op.token && op.token.toLowerCase().includes(s));

    if (!filterStatus) return matchSearch;
    if (filterStatus === 'aprovado') return matchSearch && op.resultado === 'aprovado';
    if (filterStatus === 'reprovado') return matchSearch && op.resultado === 'reprovado';
    if (filterStatus === 'em_andamento') return matchSearch && op.tentativa_status === 'em_andamento';
    if (filterStatus === 'nao_iniciada') return matchSearch && op.tentativa_status === 'nao_iniciada';
    return matchSearch;
  });

  const metrics = dashboardData?.metrics || {
    totalOperadores: 0,
    naoIniciadas: 0,
    emAndamento: 0,
    concluidas: 0,
    aprovadas: 0,
    reprovadas: 0,
    mediaGeral: 0,
    aproveitamentoMedio: 0,
    taxaAprovacao: 0
  };

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center font-bold">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span>MÓDULO DE AVALIAÇÃO</span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
                156+POA
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Prova IPTU & TCL — Supervisão</h1>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 cursor-pointer"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard & Métricas', icon: BarChart3 },
          { id: 'operadores', label: 'Operadores & Tokens', icon: Users, badge: operators.length },
          { id: 'resultados', label: 'Resultados & Correção', icon: CheckCircle2, badge: results.length },
          { id: 'desempenho', label: 'Desempenho por Questão', icon: TrendingUp },
          { id: 'configuracoes', label: 'Configurações', icon: Sliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shrink-0 transition cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. ABA DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-slate-400 font-semibold mb-1">Total Operadores</div>
              <div className="text-2xl font-black text-white">{metrics.totalOperadores}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-slate-400 font-semibold mb-1">Não Iniciadas</div>
              <div className="text-2xl font-black text-slate-400">{metrics.naoIniciadas}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-slate-400 font-semibold mb-1">Em Andamento</div>
              <div className="text-2xl font-black text-amber-400">{metrics.emAndamento}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-slate-400 font-semibold mb-1">Concluídas</div>
              <div className="text-2xl font-black text-sky-400">{metrics.concluidas}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-emerald-400 font-semibold mb-1">Aprovadas</div>
              <div className="text-2xl font-black text-emerald-400">{metrics.aprovadas}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-rose-400 font-semibold mb-1">Reprovadas</div>
              <div className="text-2xl font-black text-rose-400">{metrics.reprovadas}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-amber-300 font-semibold mb-1">Média Geral</div>
              <div className="text-2xl font-black text-amber-300">{metrics.mediaGeral.toFixed(1)}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[11px] text-purple-400 font-semibold mb-1">Aproveitamento</div>
              <div className="text-2xl font-black text-purple-400">{metrics.aproveitamentoMedio.toFixed(0)}%</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Breakdown Pie Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white mb-1">Status de Realização</h3>
                <p className="text-xs text-slate-400 mb-4">Distribuição do progresso dos operadores</p>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData?.statusPieData || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {(dashboardData?.statusPieData || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="text-center pt-3 border-t border-slate-800/80">
                <span className="text-xs text-slate-400">Taxa de Aprovação: </span>
                <span className="text-sm font-black text-emerald-400">{metrics.taxaAprovacao}%</span>
              </div>
            </div>

            {/* Performance by Difficulty Card */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white mb-1">Aproveitamento por Dificuldade</h3>
                <p className="text-xs text-slate-400 mb-4">Desempenho dos operadores dividido nos níveis Fácil, Médio e Difícil</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {difficultyStats && Object.keys(difficultyStats).map((k) => {
                  const item = difficultyStats[k];
                  const colorClass = k === 'facil' ? 'emerald' : k === 'medio' ? 'amber' : 'rose';
                  return (
                    <div key={k} className={`bg-slate-950/80 border border-${colorClass}-500/30 p-4 rounded-2xl flex flex-col justify-between`}>
                      <div>
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider text-${colorClass}-400`}>
                          {item.nome}
                        </span>
                        <div className="text-2xl font-black text-white mt-1">{item.percentual.toFixed(1)}%</div>
                      </div>
                      <div className="mt-3 text-[11px] text-slate-400">
                        {item.acertos} acertos de {item.totalRespostas} respostas
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl text-xs text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">Critério Oficial de Aprovação:</span>
                  <span>Nota mínima de <strong>{settings.nota_minima_aprovacao}% (14 acertos de 20)</strong></span>
                </div>
                <button
                  onClick={() => setActiveTab('configuracoes')}
                  className="text-sky-400 hover:underline text-xs font-bold cursor-pointer"
                >
                  Alterar Regra &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA OPERADORES & TOKENS */}
      {activeTab === 'operadores' && (
        <div className="space-y-4">
          {/* Action & Filter Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, matrícula ou token..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-10 pr-4 py-2.5 rounded-xl focus:border-amber-400 outline-none"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 px-3 py-2.5 rounded-xl outline-none"
              >
                <option value="">Todos os Status</option>
                <option value="aprovado">Aprovados</option>
                <option value="reprovado">Reprovados</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="nao_iniciada">Não Iniciados</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingOp(null);
                  setOpFormData({ nome: '', matricula: '' });
                  setShowOpModal(true);
                }}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Operador</span>
              </button>

              <button
                onClick={() => {
                  setImportFile(null);
                  setImportResult(null);
                  setShowImportModal(true);
                }}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition border border-slate-700 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Importar Excel / CSV</span>
              </button>

              <button
                onClick={handleGenerateAllTokens}
                className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md shadow-purple-600/20"
                title="Gera novos tokens únicos para todos os operadores"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Gerar Tokens em Massa</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-4 font-bold">Operador</th>
                    <th className="p-4 font-bold">Matrícula</th>
                    <th className="p-4 font-bold">Token Individual</th>
                    <th className="p-4 font-bold">Status da Prova</th>
                    <th className="p-4 font-bold text-center">Nota</th>
                    <th className="p-4 font-bold text-center">Aproveitamento</th>
                    <th className="p-4 font-bold text-center">Resultado</th>
                    <th className="p-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOperators.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500">
                        Nenhum operador encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOperators.map((op) => {
                      const isCompleted = op.tentativa_status === 'concluida' || op.tentativa_status === 'expirada_tempo';
                      const isApproved = op.resultado === 'aprovado';

                      return (
                        <tr key={op.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-4 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                              {op.nome.charAt(0)}
                            </div>
                            <span>{op.nome}</span>
                          </td>

                          <td className="p-4 font-mono text-amber-300 font-semibold">{op.matricula}</td>

                          <td className="p-4 font-mono">
                            {op.token ? (
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  op.token_status === 'ativo'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {op.token}
                                </span>
                                <button
                                  onClick={() => handleCopyLink(op.token)}
                                  className="p-1 hover:text-white text-slate-400 transition"
                                  title="Copiar Link da Prova"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={`/prova-iptu/${op.token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:text-amber-300 text-slate-400 transition"
                                  title="Abrir Link da Prova"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Sem token</span>
                            )}
                          </td>

                          <td className="p-4">
                            {op.tentativa_status === 'nao_iniciada' && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                Não Iniciada
                              </span>
                            )}
                            {op.tentativa_status === 'em_andamento' && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                Em Andamento
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                Concluída ({op.total_tentativas}ª tent.)
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-center font-bold text-white">
                            {op.nota !== null ? op.nota.toFixed(1) : '-'}
                          </td>

                          <td className="p-4 text-center font-bold">
                            {op.percentual !== null ? `${op.percentual.toFixed(0)}%` : '-'}
                          </td>

                          <td className="p-4 text-center">
                            {op.resultado ? (
                              <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                                isApproved
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              }`}>
                                {isApproved ? 'APROVADO' : 'REPROVADO'}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isCompleted && (
                                <button
                                  onClick={() => handleAllowRetry(op.id)}
                                  className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-bold rounded-lg border border-purple-500/40 transition cursor-pointer"
                                  title="Liberar Nova Tentativa"
                                >
                                  Liberar Tentativa
                                </button>
                              )}

                              <button
                                onClick={() => handleGenerateToken(op.id)}
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg transition"
                                title="Gerar Novo Token"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>

                              {op.token && op.token_status === 'ativo' && (
                                <button
                                  onClick={() => handleInvalidateToken(op.token)}
                                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                                  title="Invalidar Token"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setEditingOp(op);
                                  setOpFormData({ nome: op.nome, matricula: op.matricula });
                                  setShowOpModal(true);
                                }}
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteOperator(op.id)}
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA RESULTADOS & CORREÇÃO DETALHADA */}
      {activeTab === 'resultados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="text-xs text-slate-300">
              Total de avaliações realizadas: <strong>{results.length}</strong>
            </div>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Resultados (Excel)</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-4 font-bold">Operador</th>
                    <th className="p-4 font-bold">Matrícula</th>
                    <th className="p-4 font-bold text-center">Tentativa</th>
                    <th className="p-4 font-bold text-center">Nota</th>
                    <th className="p-4 font-bold text-center">% Acerto</th>
                    <th className="p-4 font-bold text-center">Acertos</th>
                    <th className="p-4 font-bold text-center">Erros</th>
                    <th className="p-4 font-bold text-center">Resultado</th>
                    <th className="p-4 font-bold">Data Realização</th>
                    <th className="p-4 font-bold text-right">Correção Oficial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-500">
                        Nenhuma prova concluída ainda.
                      </td>
                    </tr>
                  ) : (
                    results.map((r) => {
                      const isApproved = r.resultado === 'aprovado';
                      return (
                        <tr key={r.tentativa_id} className="hover:bg-slate-800/40 transition">
                          <td className="p-4 font-bold text-white">{r.nome}</td>
                          <td className="p-4 font-mono text-amber-300 font-semibold">{r.matricula}</td>
                          <td className="p-4 text-center font-bold">{r.numero_tentativa}ª</td>
                          <td className="p-4 text-center font-black text-amber-400 text-sm">
                            {r.nota !== null ? r.nota.toFixed(1) : '-'}
                          </td>
                          <td className="p-4 text-center font-black text-sky-400">
                            {r.percentual !== null ? `${r.percentual.toFixed(0)}%` : '-'}
                          </td>
                          <td className="p-4 text-center text-emerald-400 font-bold">{r.acertos}</td>
                          <td className="p-4 text-center text-rose-400 font-bold">{r.erros}</td>
                          <td className="p-4 text-center">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              isApproved
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}>
                              {isApproved ? 'APROVADO' : 'REPROVADO'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 text-[11px]">
                            {r.finalizada_em ? new Date(r.finalizada_em).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleOpenCorrection(r.tentativa_id)}
                              className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 text-[11px] font-bold rounded-xl border border-sky-600/40 flex items-center gap-1.5 ml-auto transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Abrir Correção</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ABA DESEMPENHO POR QUESTÃO & DIFICULDADE */}
      {activeTab === 'desempenho' && (
        <div className="space-y-6">
          {/* Difficulty Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {difficultyStats && Object.keys(difficultyStats).map((k) => {
              const diff = difficultyStats[k];
              return (
                <div key={k} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-extrabold uppercase text-amber-400 mb-1">{diff.nome}</div>
                    <div className="text-3xl font-black text-white">{diff.percentual.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400 mt-1">Taxa de Acerto Geral</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 flex justify-between">
                    <span>Acertos: <strong>{diff.acertos}</strong></span>
                    <span>Total Respostas: <strong>{diff.totalRespostas}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranking of Questions with Highest Error Rates */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-extrabold text-white mb-1">Ranking de Questões com Maior Índice de Erro</h3>
            <p className="text-xs text-slate-400 mb-4">Utilize estes dados para orientar treinamentos e reciclagens no 156+POA</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-bold text-center">Nº</th>
                    <th className="p-3 font-bold">Dificuldade</th>
                    <th className="p-3 font-bold">Enunciado Resumido</th>
                    <th className="p-3 font-bold text-center">Gabarito</th>
                    <th className="p-3 font-bold text-center">Total Respostas</th>
                    <th className="p-3 font-bold text-center">Acertos</th>
                    <th className="p-3 font-bold text-center">Erros</th>
                    <th className="p-3 font-bold text-center">% Erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {questionsStats?.rankingErros?.map((q) => (
                    <tr key={q.numero} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 text-center font-black text-amber-400">{q.numero}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          q.dificuldade === 'facil'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : q.dificuldade === 'medio'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}>
                          {q.dificuldade.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 max-w-md truncate text-slate-200">{q.enunciado}</td>
                      <td className="p-3 text-center font-bold text-emerald-400">{q.gabarito}</td>
                      <td className="p-3 text-center">{q.total_respostas}</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{q.acertos}</td>
                      <td className="p-3 text-center text-rose-400 font-bold">{q.erros}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-black ${q.percentual_erro > 40 ? 'text-rose-400' : 'text-slate-300'}`}>
                          {q.percentual_erro.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. ABA CONFIGURAÇÕES */}
      {activeTab === 'configuracoes' && (
        <div className="max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-extrabold text-white mb-2">Configurações Gerais da Prova IPTU</h3>
          <p className="text-xs text-slate-400 mb-6">Ajuste os parâmetros de aplicação, aprovação e cronômetro</p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Nome da Avaliação</label>
              <input
                type="text"
                value={settings.nome_prova}
                onChange={(e) => setSettings({ ...settings, nome_prova: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-400 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nota Mínima para Aprovação (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.nota_minima_aprovacao}
                  onChange={(e) => setSettings({ ...settings, nota_minima_aprovacao: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-400 outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Padrão: 70% (14 acertos de 20)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tempo Máximo da Prova (minutos)
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={settings.tempo_maximo_minutos}
                  onChange={(e) => setSettings({ ...settings, tempo_maximo_minutos: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-400 outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">0 = Sem cronômetro (tempo livre)</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.exibir_resultado_operador}
                  onChange={(e) => setSettings({ ...settings, exibir_resultado_operador: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                <span className="text-xs font-semibold text-slate-300">
                  Exibir nota e aproveitamento geral ao operador após a conclusão (o gabarito permanece sempre oculto ao operador)
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CADASTRO / EDIÇÃO DE OPERADOR */}
      {showOpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-white mb-1">
              {editingOp ? 'Editar Operador' : 'Cadastrar Operador na Prova'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Informe os dados do operador para gerar o link individual de acesso.
            </p>

            <form onSubmit={handleSaveOperator} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  value={opFormData.nome}
                  onChange={(e) => setOpFormData({ ...opFormData, nome: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Matrícula (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: OP15625 (Opcional — gerada automaticamente se vazio)"
                  value={opFormData.matricula}
                  onChange={(e) => setOpFormData({ ...opFormData, matricula: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-400 outline-none font-mono"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOpModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black py-3 rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {editingOp ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAÇÃO DE PLANILHA EXCEL / CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-white mb-1">Importar Operadores da Prova</h3>
            <p className="text-xs text-slate-400 mb-4">
              Envie uma planilha <strong>.xlsx</strong> ou <strong>.csv</strong> contendo as colunas <strong>Nome</strong> e <strong>Matrícula</strong>.
            </p>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 text-center cursor-pointer transition">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="hidden"
                  id="file-import-input"
                />
                <label htmlFor="file-import-input" className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-white block">
                    {importFile ? importFile.name : 'Clique para selecionar o arquivo (.xlsx ou .csv)'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Formato aceito: Nome / Nome Completo &bull; Matrícula / Matricula
                  </span>
                </label>
              </div>

              {importResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="text-emerald-400 font-bold">Importados: {importResult.importedCount}</div>
                  <div className="text-amber-400 font-bold">Duplicados ignorados: {importResult.duplicateCount}</div>
                  {importResult.errorCount > 0 && (
                    <div className="text-rose-400 font-bold">Erros: {importResult.errorCount}</div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3 rounded-xl transition"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black py-3 rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{importLoading ? 'Processando...' : 'Iniciar Importação'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CORREÇÃO DETALHADA ADMINISTRATIVA (20 QUESTÕES COM JUSTIFICATIVA) */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">Correção Oficial Detalhada</div>
                <h3 className="text-lg font-black text-white">
                  {correctionData?.attempt?.operador} &bull; <span className="text-amber-300 font-mono text-sm">Matrícula: {correctionData?.attempt?.matricula}</span>
                </h3>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Summary Banner */}
            {correctionData?.attempt && (
              <div className="my-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-2 sm:grid-cols-5 gap-3 text-center shrink-0">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Nota Final</div>
                  <div className="text-xl font-black text-amber-400">{correctionData.attempt.nota?.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Aproveitamento</div>
                  <div className="text-xl font-black text-sky-400">{correctionData.attempt.percentual?.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Acertos</div>
                  <div className="text-xl font-black text-emerald-400">{correctionData.attempt.acertos}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Erros</div>
                  <div className="text-xl font-black text-rose-400">{correctionData.attempt.erros}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold">Resultado</div>
                  <div className={`text-sm font-black mt-1 ${
                    correctionData.attempt.resultado === 'aprovado' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {correctionData.attempt.resultado?.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {correctionLoading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
                  <span>Carregando correção detalhada...</span>
                </div>
              ) : (
                correctionData?.correction?.map((q) => (
                  <div
                    key={q.numero}
                    className={`p-5 rounded-2xl border ${
                      q.is_correta
                        ? 'bg-emerald-950/10 border-emerald-500/30'
                        : 'bg-rose-950/10 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-slate-800 text-amber-400">
                          Questão #{q.numero}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          ({q.dificuldade})
                        </span>
                      </div>

                      <span className={`text-xs font-black px-3 py-0.5 rounded-full border ${
                        q.is_correta
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      }`}>
                        {q.is_correta ? '🟢 CORRETA' : '🔴 INCORRETA'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white mb-3 leading-relaxed">{q.enunciado}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Resposta do Operador:</span>
                        <span className={`font-black text-sm ${q.is_correta ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {q.resposta_operador ? `Alternativa ${q.resposta_operador}` : 'Não respondeu'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Gabarito Oficial:</span>
                        <span className="font-black text-sm text-emerald-400">
                          Alternativa {q.gabarito_oficial}
                        </span>
                      </div>
                    </div>

                    {/* Official Justification */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-300">
                      <span className="font-bold text-amber-400 block mb-1">Justificativa Oficial SMF / 156+POA:</span>
                      <p className="text-slate-300 leading-relaxed">{q.justificativa}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 shrink-0 flex justify-end">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
