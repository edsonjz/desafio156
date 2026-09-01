import React, { useState, useEffect } from 'react';
import { Disc, Play, Sparkles, Trophy, History, Gift, Ticket, Flame, X, Info, Award, Clock, Coffee, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiFetch } from '../services/api';

export default function RouletteView({ showToast, onTicketAlert }) {
  const [operators, setOperators] = useState([]);
  const [prizesList, setPrizesList] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedOpId, setSelectedOpId] = useState('');
  const [selectedOpSearch, setSelectedOpSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Animation State
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinResultModal, setSpinResultModal] = useState(null);
  const [highlightedPrizeId, setHighlightedPrizeId] = useState(null);

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
      setOperators(ops || []);
      setPrizesList(przs || []);
      setHistory(hist || []);
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
      const res = await apiFetch('/roulette/spin', {
        method: 'POST',
        body: JSON.stringify({ operatorId: Number(selectedOpId) })
      });

      // Calculate winning slice angle
      const numPrizes = prizesList.length || 10;
      const sliceAngle = 360 / numPrizes;
      const prizeIndex = prizesList.findIndex(p => p.name === res.prize.name);
      const safeIndex = prizeIndex >= 0 ? prizeIndex : 0;

      // In our SVG, slice 0 starts at angle -90deg (top). Slice i center is at angle: (i * sliceAngle + sliceAngle / 2)
      // To bring slice i center to top (0deg relative to pointer at 12 o'clock), we rotate by:
      // - (i * sliceAngle + sliceAngle / 2)
      const currentMod = rotationDeg % 360;
      const targetSliceCenter = safeIndex * sliceAngle + sliceAngle / 2;
      const neededOffset = (360 - targetSliceCenter) % 360;
      // Add 6 full revolutions (2160deg) for thrilling spin duration
      const totalNewRotation = rotationDeg + (2160 - currentMod) + neededOffset;

      setRotationDeg(totalNewRotation);

      setTimeout(() => {
        setSpinning(false);
        setSpinResultModal(res);

        confetti({
          particleCount: 160,
          spread: 85,
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

  const filteredOperators = operators.filter(op =>
    (op.name && op.name.toLowerCase().includes(selectedOpSearch.toLowerCase())) ||
    (op.registration && op.registration.toLowerCase().includes(selectedOpSearch.toLowerCase()))
  );

  const selectedOperatorObj = operators.find(o => String(o.id) === String(selectedOpId));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  // Wheel sector rendering helpers
  const numSlices = prizesList.length || 10;
  const sliceDeg = 360 / numSlices;
  const radius = 180;
  const center = 200;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Campanha DESAFIO 156 • Reconhecimento & Performance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <Disc className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '10s' }} />
              <span>ROLETA DA SORTE 156</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Gire a roleta oficial e premie os operadores com pontos adicionais, bilhetes extras para o sorteio de folgas de fim de ano ou benefícios operacionais.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-amber-500/30 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur shadow-lg">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Controle Oficial</div>
              <div className="text-xs font-extrabold text-amber-300">Supervisão Operação 156</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Wheel Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Controls Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur space-y-5">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Play className="w-4 h-4 text-amber-400" />
              <span>Painel de Disparo do Giro</span>
            </h3>

            {/* Operator Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                1. Selecione o Operador que vai girar:
              </label>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Filtrar operador por nome ou matrícula..."
                  value={selectedOpSearch}
                  onChange={(e) => setSelectedOpSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />

                <select
                  value={selectedOpId}
                  onChange={(e) => setSelectedOpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Clique para escolher o operador --</option>
                  {filteredOperators.map(op => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.registration}) • {op.totalPoints} pts • {op.totalTickets} bilhetes
                    </option>
                  ))}
                </select>
              </div>

              {selectedOperatorObj && (
                <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Selecionado: </span>
                    <strong className="text-amber-300">{selectedOperatorObj.name}</strong>
                    <span className="text-slate-400"> ({selectedOperatorObj.registration})</span>
                  </div>
                  <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-lg text-[10px]">
                    {selectedOperatorObj.totalPoints} pts
                  </span>
                </div>
              )}
            </div>

            {/* Spin Button */}
            <button
              onClick={handleSpin}
              disabled={spinning || !selectedOpId}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-4 px-6 rounded-2xl text-base shadow-2xl shadow-amber-500/30 transition transform active:scale-98 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-3"
            >
              <Disc className={`w-6 h-6 text-slate-950 ${spinning ? 'animate-spin' : 'group-hover:rotate-45 transition'}`} />
              <span className="tracking-wide">
                {spinning ? 'ROLETA GIRANDO...' : 'GIRAR ROLETA 156'}
              </span>
            </button>

            {/* Rules Quick Reminder */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Info className="w-4 h-4 text-sky-400" />
                <span>Como funciona a pontuação:</span>
              </div>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-400">
                <li><strong className="text-slate-300">Pontos e Bilhetes:</strong> Creditados imediatamente no extrato.</li>
                <li><strong className="text-slate-300">Pontos em Dobro:</strong> O próximo lançamento do operador vale x2.</li>
                <li><strong className="text-slate-300">Folgas / Saídas:</strong> Registradas automaticamente em Prêmios Pendentes.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: SVG Roulette Wheel */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative py-4">
          {/* Wheel Container with Glow */}
          <div className="relative flex items-center justify-center p-4">
            {/* Top Indicator Arrow (Pointer at 12 o'clock) */}
            <div className="absolute -top-3 z-30 flex flex-col items-center">
              <div className="w-8 h-8 bg-amber-400 rotate-45 rounded-sm shadow-2xl border-2 border-slate-950 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-950" />
              </div>
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[20px] border-t-amber-400 -mt-2 drop-shadow-xl" />
            </div>

            {/* Outer Golden Studded Ring */}
            <div className="w-[360px] h-[360px] sm:w-[440px] sm:h-[440px] rounded-full p-2.5 bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-700 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex items-center justify-center">
              <div className="w-full h-full rounded-full p-2 bg-slate-950 border-4 border-amber-500/40 flex items-center justify-center overflow-hidden relative">

                {/* Rotating SVG Wheel */}
                <div
                  className="w-full h-full relative"
                  style={{
                    transform: `rotate(${rotationDeg}deg)`,
                    transition: spinning ? 'transform 5.2s cubic-bezier(0.15, 0.9, 0.2, 1)' : 'none'
                  }}
                >
                  <svg viewBox="0 0 400 400" className="w-full h-full">
                    <defs>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="glow" />
                        <feComposite in="SourceGraphic" in2="glow" operator="over" />
                      </filter>
                    </defs>

                    {/* Slices */}
                    {prizesList.map((prize, idx) => {
                      const startAngle = idx * sliceDeg - 90;
                      const endAngle = (idx + 1) * sliceDeg - 90;
                      const midAngle = startAngle + sliceDeg / 2;

                      const radStart = (startAngle * Math.PI) / 180;
                      const radEnd = (endAngle * Math.PI) / 180;

                      const x1 = center + radius * Math.cos(radStart);
                      const y1 = center + radius * Math.sin(radStart);
                      const x2 = center + radius * Math.cos(radEnd);
                      const y2 = center + radius * Math.sin(radEnd);

                      // SVG Arc Path
                      const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;

                      // Radial text coordinate
                      const textRadius = radius * 0.65;
                      const textAngleRad = (midAngle * Math.PI) / 180;
                      const tx = center + textRadius * Math.cos(textAngleRad);
                      const ty = center + textRadius * Math.sin(textAngleRad);

                      const sliceColor = prize.color || '#7c3aed';
                      const isHighlighted = highlightedPrizeId === prize.id;

                      return (
                        <g key={prize.id} className="transition-opacity duration-300">
                          {/* Sector Path */}
                          <path
                            d={pathData}
                            fill={sliceColor}
                            stroke="#0f172a"
                            strokeWidth="2.5"
                            className={isHighlighted ? 'brightness-125' : ''}
                          />

                          {/* Sector Content (Text + Icon oriented along radius) */}
                          <g transform={`translate(${tx}, ${ty}) rotate(${midAngle + 90})`}>
                            {/* Icon */}
                            <text
                              x="0"
                              y="-8"
                              textAnchor="middle"
                              fontSize="18"
                              className="select-none"
                            >
                              {prize.icon}
                            </text>

                            {/* Label */}
                            <text
                              x="0"
                              y="10"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10.5"
                              fontWeight="900"
                              className="select-none font-sans drop-shadow-md"
                            >
                              {prize.name}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Outer Ring Border */}
                    <circle cx={center} cy={center} r={radius} fill="none" stroke="#f59e0b" strokeWidth="4" />
                  </svg>
                </div>

                {/* Wheel Center Golden Hub (Fixed in center, does not spin) */}
                <div className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-300 border-4 border-slate-900 flex flex-col items-center justify-center shadow-2xl z-20">
                  <div className="text-[10px] font-black text-slate-950 uppercase tracking-tighter leading-none">ROLETA</div>
                  <div className="text-xl font-black text-slate-950 leading-none">156</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prize Showcase / Detailed Catalog */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              <span>Quadro Oficial de Prêmios e Descrições da Roleta</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Confira os 10 prêmios disponíveis nesta edição do Desafio 156 e seus critérios
            </p>
          </div>
          <span className="text-xs bg-slate-950 border border-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded-xl self-start sm:self-auto">
            10 Prêmios Oficiais
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {prizesList.map((prize) => {
            const isHovered = highlightedPrizeId === prize.id;
            return (
              <div
                key={prize.id}
                onMouseEnter={() => setHighlightedPrizeId(prize.id)}
                onMouseLeave={() => setHighlightedPrizeId(null)}
                className={`p-4 rounded-2xl border transition duration-200 flex flex-col justify-between ${
                  isHovered
                    ? 'bg-slate-800 border-amber-400/80 shadow-lg scale-[1.02]'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl p-1.5 rounded-xl bg-slate-900 border border-slate-800">{prize.icon}</span>
                    <span
                      className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: prize.color }}
                    />
                  </div>

                  <div className="text-xs font-black text-white mb-1">
                    {prize.name}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {prize.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-medium capitalize">
                    {prize.prize_type.replace('_', ' ')}
                  </span>
                  {prize.points > 0 && (
                    <span className="text-amber-400 font-extrabold">
                      +{prize.points} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spin Result Modal */}
      {spinResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setSpinResultModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-500/40 text-4xl animate-bounce shadow-lg">
              {spinResultModal.prize?.icon || '🎉'}
            </div>

            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-1">
              🎉 Sorteio da Roleta 156!
            </div>

            <h3 className="text-2xl font-black text-white mb-2">
              PARABÉNS, {spinResultModal.operatorName}!
            </h3>

            <div className="bg-gradient-to-r from-amber-500/20 via-slate-800 to-amber-500/20 border border-amber-500/40 rounded-2xl p-5 my-4">
              <div className="text-xs text-slate-300 font-semibold mb-1">Você conquistou:</div>
              <div className="text-xl font-black text-amber-300 uppercase tracking-wide">
                {spinResultModal.prize?.name}
              </div>
              <div className="text-xs text-slate-300 mt-2 font-medium">
                {spinResultModal.prize?.description}
              </div>
            </div>

            {spinResultModal.newlyEarnedTickets > 0 && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
                <Ticket className="w-4 h-4" />
                <span>+{spinResultModal.newlyEarnedTickets} Novo(s) Bilhete(s) Conquistado(s)!</span>
              </div>
            )}

            <p className="text-xs text-slate-400 mb-6">
              O prêmio já foi registrado com sucesso na ficha do operador e sincronizado no Supabase.
            </p>

            <button
              onClick={() => setSpinResultModal(null)}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              Excelente! Fechar
            </button>
          </div>
        </div>
      )}

      {/* Spin History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <span>Histórico de Giros da Roleta (Salvo no Supabase)</span>
          </h3>
          <span className="text-xs text-slate-400">
            {history.length} giros registrados
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4">Prêmio Sorteado</th>
                <th className="py-3.5 px-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-slate-500">
                    Nenhum giro registrado na Roleta ainda.
                  </td>
                </tr>
              ) : (
                history.map((spin) => (
                  <tr key={spin.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {spin.created_at ? new Date(spin.created_at).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {spin.operator_name} {spin.registration ? `(${spin.registration})` : ''}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-amber-300">
                      {spin.prize}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {spin.created_by || 'Admin'}
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
