import React, { useState, useEffect, useRef } from 'react';
import { Disc, Play, Sparkles, Trophy, History, Gift, Ticket, Flame, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiFetch } from '../services/api';

export default function RouletteView({ showToast, onTicketAlert }) {
  const [operators, setOperators] = useState([]);
  const [prizesList, setPrizesList] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedOpId, setSelectedOpId] = useState('');
  const [loading, setLoading] = useState(true);

  // Animation State
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinResultModal, setSpinResultModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ops, przs, hist] = await Promise.all([
        apiFetch('/operators?status=active'),
        apiFetch('/roulette/prizes'),
        apiFetch('/roulette/history')
      ]);
      setOperators(ops);
      setPrizesList(przs);
      setHistory(hist);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSpin = async () => {
    if (!selectedOpId) {
      showToast('Selecione o operador antes de girar a roleta.', 'error');
      return;
    }

    if (spinning) return;
    setSpinning(true);

    try {
      // Execute spin backend logic
      const res = await apiFetch('/roulette/spin', {
        method: 'POST',
        body: JSON.stringify({ operatorId: Number(selectedOpId) })
      });

      // Calculate animation target angle
      const prizeIndex = prizesList.findIndex(p => p.name === res.prize.name);
      const segmentAngle = 360 / prizesList.length;
      // Target angle = 5 full rotations (1800deg) + segment offset
      const targetDeg = rotationDeg + 1800 + (360 - (prizeIndex * segmentAngle) - segmentAngle / 2);
      
      setRotationDeg(targetDeg);

      // Wait 5 seconds for wheel spin animation to complete
      setTimeout(() => {
        setSpinning(false);
        setSpinResultModal(res);

        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });

        if (res.newlyEarnedTickets > 0 && onTicketAlert) {
          onTicketAlert({
            operatorName: res.operatorName,
            totalPoints: res.pointsAwarded,
            totalTickets: res.newlyEarnedTickets,
            newTicketCodes: res.newTicketCodes
          });
        }

        loadData();
      }, 5200);

    } catch (err) {
      setSpinning(false);
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const sliceAngle = 360 / (prizesList.length || 1);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Disc className="w-6 h-6 text-purple-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span>🎰 ROLETA 156</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gire a roleta de prêmios e sorteie recompensas e pontos instantâneos para os operadores
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Controle Exclusivo da Supervisão</span>
        </div>
      </div>

      {/* Main Wheel Area & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Controls Card */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-amber-400" />
            <span>Controle da Roleta</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Selecione o Operador *</label>
            <select
              value={selectedOpId}
              onChange={(e) => setSelectedOpId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none"
            >
              <option value="">-- Escolha o operador que vai girar --</option>
              {operators.map(op => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.registration}) — {op.totalPoints} pts
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSpin}
            disabled={spinning || !selectedOpId}
            className="w-full bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 hover:from-purple-700 hover:to-purple-700 text-white font-black py-4 px-6 rounded-2xl text-base shadow-2xl shadow-purple-600/30 transition transform active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Disc className={`w-6 h-6 ${spinning ? 'animate-spin' : ''}`} />
            <span>{spinning ? 'GIRANDO A ROLETA...' : '🎰 GIRAR ROLETA 156'}</span>
          </button>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-200">ℹ️ Regras da Roleta:</div>
            <div>• Prêmios de +10 / +20 pontos ou bilhetes entram imediatamente no saldo.</div>
            <div>• "Pontos em dobro" multiplica por 2 o próximo lançamento do dia.</div>
            <div>• Folgas e saídas antecipadas são enviadas para Prêmios Pendentes.</div>
          </div>
        </div>

        {/* Animated Visual Wheel */}
        <div className="lg:col-span-8 flex items-center justify-center py-6 relative">
          {/* Wheel Pointer */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[28px] border-t-amber-400 drop-shadow-xl" />

          {/* Canvas SVG Wheel container */}
          <div className="w-80 h-80 sm:w-96 sm:h-96 relative rounded-full border-8 border-slate-800 shadow-2xl overflow-hidden bg-slate-950">
            <div
              className="w-full h-full rounded-full relative animate-spin-wheel"
              style={{ transform: `rotate(${rotationDeg}deg)` }}
            >
              {prizesList.map((prize, idx) => {
                const angle = idx * sliceAngle;
                const colors = [
                  '#0284c7', '#7c3aed', '#d97706', '#059669', '#dc2626',
                  '#2563eb', '#9333ea', '#ca8a04', '#16a34a', '#e11d48'
                ];
                const bg = colors[idx % colors.length];

                return (
                  <div
                    key={prize.id}
                    className="absolute top-0 left-0 w-full h-full flex items-start justify-center origin-center"
                    style={{
                      transform: `rotate(${angle}deg)`,
                      clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(((angle - 90) * Math.PI) / 180)}% ${50 + 50 * Math.sin(((angle - 90) * Math.PI) / 180)}%, ${50 + 50 * Math.cos(((angle + sliceAngle - 90) * Math.PI) / 180)}% ${50 + 50 * Math.sin(((angle + sliceAngle - 90) * Math.PI) / 180)}%)`
                    }}
                  >
                    <div
                      className="h-full w-full flex flex-col items-center pt-6 text-[10px] sm:text-xs font-black text-white"
                      style={{ backgroundColor: bg }}
                    >
                      <span className="text-base">{prize.icon}</span>
                      <span className="truncate max-w-[70px] text-center">{prize.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Wheel Center Button */}
            <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-900 border-4 border-amber-400 flex items-center justify-center font-black text-amber-400 text-xs shadow-2xl z-10">
              156
            </div>
          </div>
        </div>
      </div>

      {/* Spin Result Celebratory Modal */}
      {spinResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative">
            <button
              onClick={() => setSpinResultModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-500/40 text-4xl animate-bounce">
              {spinResultModal.prize?.icon || '🎉'}
            </div>

            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-1">
              🎉 Resultado da Roleta 156!
            </div>

            <h3 className="text-2xl font-black text-white mb-3">
              PARABÉNS, {spinResultModal.operatorName}!
            </h3>

            <div className="bg-gradient-to-r from-amber-500/20 via-slate-800 to-amber-500/20 border border-amber-500/40 rounded-2xl p-5 my-4">
              <div className="text-xs text-slate-300 font-semibold mb-1">Você ganhou:</div>
              <div className="text-xl font-black text-amber-300 uppercase tracking-wide">
                {spinResultModal.prize?.name}
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Prêmio registrado com sucesso na ficha do operador e disponível no extrato.
            </p>

            <button
              onClick={() => setSpinResultModal(null)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              Excelente!
            </button>
          </div>
        </div>
      )}

      {/* Spin History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          <span>Histórico Recente de Giros da Roleta</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4">Prêmio Sorteado</th>
                <th className="py-3 px-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-slate-500">
                    Nenhum giro registrado.
                  </td>
                </tr>
              ) : (
                history.map((spin) => (
                  <tr key={spin.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {spin.created_at}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {spin.operator_name} ({spin.registration})
                    </td>
                    <td className="py-3 px-4 font-extrabold text-amber-300">
                      {spin.prize}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {spin.created_by}
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
