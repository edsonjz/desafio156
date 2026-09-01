import React, { useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, Download, Printer, Filter, Search, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../services/api';

export default function ReportsView({ showToast }) {
  const [reportType, setReportType] = useState('ranking'); // ranking, points, positive, negative, tickets, roulette, prizes, highlights, audit
  const [reportData, setReportData] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [reportType]);

  const loadReport = async () => {
    setLoading(true);
    try {
      let data = [];
      if (reportType === 'ranking') {
        data = await apiFetch('/ranking?period=all');
      } else if (reportType === 'tickets') {
        const res = await apiFetch('/tickets');
        data = res.operators;
      } else if (reportType === 'roulette') {
        data = await apiFetch('/roulette/history');
      } else if (reportType === 'prizes') {
        data = await apiFetch('/prizes');
      } else if (reportType === 'highlights') {
        data = await apiFetch('/highlights');
      } else if (reportType === 'audit') {
        data = await apiFetch('/audit');
      } else {
        // Default ranking data
        data = await apiFetch('/ranking?period=all');
      }
      setReportData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (reportData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportType.toUpperCase());
    XLSX.writeFile(workbook, `relatorio_desafio156_${reportType}_2026.xlsx`);
    showToast('Relatório exportado para Excel com sucesso!', 'success');
  };

  const exportCSV = () => {
    if (reportData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_desafio156_${reportType}_2026.csv`;
    a.click();
    showToast('Relatório exportado para CSV com sucesso!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredData = reportData.filter(item => {
    const jsonStr = JSON.stringify(item).toLowerCase();
    return jsonStr.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-400" />
            <span>📊 Central de Relatórios e Exportação</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gere e exporte relatórios consolidados em Excel, CSV e PDF da Operação 156
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={exportCSV}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl text-xs">
        <button
          onClick={() => setReportType('ranking')}
          className={`px-3 py-1.5 rounded-xl font-bold transition ${
            reportType === 'ranking' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          🏆 Ranking Geral
        </button>

        <button
          onClick={() => setReportType('tickets')}
          className={`px-3 py-1.5 rounded-xl font-bold transition ${
            reportType === 'tickets' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          🎟️ Bilhetes Emitidos
        </button>

        <button
          onClick={() => setReportType('roulette')}
          className={`px-3 py-1.5 rounded-xl font-bold transition ${
            reportType === 'roulette' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          🎰 Historico da Roleta
        </button>

        <button
          onClick={() => setReportType('prizes')}
          className={`px-3 py-1.5 rounded-xl font-bold transition ${
            reportType === 'prizes' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          🎁 Prêmios Operacionais
        </button>

        <button
          onClick={() => setReportType('highlights')}
          className={`px-3 py-1.5 rounded-xl font-bold transition ${
            reportType === 'highlights' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          🌟 Destaques Semanais
        </button>

        <button
          onClick={() => setReportType('audit')}
          className={`px-3 py-1.5 rounded-xl font-bold transition ${
            reportType === 'audit' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          📋 Logs de Auditoria
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar dados do relatório..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Report Table Display */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-bold sticky top-0 backdrop-blur">
                {filteredData.length > 0 &&
                  Object.keys(filteredData[0]).map((key) => (
                    <th key={key} className="py-3 px-4">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-slate-500 font-sans">
                    Gerando relatório...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-slate-500 font-sans">
                    Nenhum registro encontrado para este relatório.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    {Object.values(row).map((val, vIdx) => (
                      <td key={vIdx} className="py-3 px-4 truncate max-w-xs text-slate-300">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
                      </td>
                    ))}
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
