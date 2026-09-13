import React, { useState, useEffect, useRef } from 'react';
import {
  Disc,
  Play,
  Sparkles,
  Trophy,
  History,
  Gift,
  Ticket,
  Flame,
  X,
  Info,
  Award,
  Clock,
  Coffee,
  AlertCircle,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle,
  ArrowRight,
  User,
  Zap,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiFetch } from '../services/api';

// Native Web Audio API Sound Effects
const playTickSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.035);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // Ignore audio context error
  }
};

const playFanfareSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.11);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.11);
      osc.stop(ctx.currentTime + i * 0.11 + 0.55);
    });
  } catch (e) {
    // Ignore audio context error
  }
};

export default function RouletteView({ showToast, onTicketAlert }) {
  const [operators, setOperators] = useState([]);
  const [prizesList, setPrizesList] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedOpId, setSelectedOpId] = useState('');
  const [selectedOpSearch, setSelectedOpSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Animation State
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinResultModal, setSpinResultModal] = useState(null);
  const [highlightedPrizeId, setHighlightedPrizeId] = useState(null);

  // Deletion Modals State
  const [spinToDelete, setSpinToDelete] = useState(null);
  const [isDeletingSpin, setIsDeletingSpin] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const tickTimerRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => {
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
    };
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

  const startTickSounds = () => {
    if (!soundEnabled) return;
    let count = 0;
    const maxTicks = 38;
    const runTick = () => {
      if (count >= maxTicks) return;
      playTickSound();
      count++;
      // Easing progression: fast at first (50ms) gradually easing to 360ms
      const delay = 50 + Math.pow(count / maxTicks, 2.8) * 310;
      tickTimerRef.current = setTimeout(runTick, delay);
    };
    runTick();
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

      // Calculate slice angle and target rotation
      const numPrizes = prizesList.length || 10;
      const sliceAngle = 360 / numPrizes;
      const prizeIndex = prizesList.findIndex(p => p.name === res.prize.name);
      const safeIndex = prizeIndex >= 0 ? prizeIndex : 0;

      // Slice center formula:
      // Slice i center is at angle (i * sliceAngle + sliceAngle / 2 - 90).
      // We want to bring this center exactly to 12 o'clock (270° in standard SVG math):
      const targetMod = ((270 - (safeIndex * sliceAngle + sliceAngle / 2 - 90)) % 360 + 360) % 360;
      const currentMod = rotationDeg % 360;
      const neededOffset = (targetMod - currentMod + 360) % 360;
      // 6 complete spins (2160deg) for optimal dramatic suspense
      const totalNewRotation = rotationDeg + 2160 + neededOffset;

      setRotationDeg(totalNewRotation);
      startTickSounds();

      setTimeout(() => {
        setSpinning(false);
        setSpinResultModal(res);

        if (soundEnabled) {
          playFanfareSound();
        }

        confetti({
          particleCount: 180,
          spread: 90,
          origin: { y: 0.58 }
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
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
      showToast(err.message, 'error');
    }
  };

  // Delete specific spin
  const confirmDeleteSpin = async () => {
    if (!spinToDelete) return;
    setIsDeletingSpin(true);
    try {
      const res = await apiFetch(`/roulette/history/${spinToDelete.id}`, {
        method: 'DELETE'
      });
      showToast(res.message || 'Giro e premiação removidos com sucesso!', 'success');
      setSpinToDelete(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir giro.', 'error');
    } finally {
      setIsDeletingSpin(false);
    }
  };

  // Reset entire roulette history
  const confirmResetHistory = async () => {
    setIsResetting(true);
    try {
      const res = await apiFetch('/roulette/history', {
        method: 'DELETE'
      });
      showToast(res.message || 'Histórico e premiações da roleta zerados com sucesso!', 'success');
      setShowResetModal(false);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao zerar histórico da roleta.', 'error');
    } finally {
      setIsResetting(false);
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

  // Wheel geometry calculations
  const numSlices = prizesList.length || 10;
  const sliceDeg = 360 / numSlices;
  const radius = 230;
  const center = 250;

  // Outer LED light bulb coordinates around the rim (20 bulbs)
  const bulbCount = 20;
  const bulbs = Array.from({ length: bulbCount }).map((_, i) => {
    const angle = (i * (360 / bulbCount) * Math.PI) / 180;
    return {
      x: center + 240 * Math.cos(angle),
      y: center + 240 * Math.sin(angle),
      id: i
    };
  });

  // Prize category badges helper
  const getPrizeEffectLabel = (prizeName, prizeType) => {
    if (prizeType === 'double_points') return { text: '🔥 Pontos em Dobro Ativo', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
    if (prizeType === 'ticket') return { text: '🎟️ +1 Bilhete Oficial (+50 pts)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    if (prizeType === 'duo_prize') return { text: '🤝 Prêmio em Dupla (+1 Bilhete)', color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' };
    if (prizeType === 'extra_break') return { text: '☕ Pausa Extra Autorizada', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (prizeType === 'early_leave') return { text: '⏰ Saída Antecipada Autorizada', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    if (prizeType === 'wildcard') return { text: '👑 Coringa da Supervisão', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (prizeType === 'extra_spin') return { text: '🎲 Novo Giro Liberado', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    return { text: '🎁 Premiação Operacional', color: 'text-slate-300 bg-slate-800 border-slate-700' };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-60 h-60 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Campanha DESAFIO 156 • 100% de Premiações Oficiais</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
              <Disc className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '12s' }} />
              <span>ROLETA DA SORTE 156</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Gire a roleta oficial para agraciar os operadores com benefícios reais: pausas estendidas, saídas antecipadas, pontos em dobro, bilhetes extras e o exclusivo Coringa 156!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-3 rounded-2xl border transition shadow-lg flex items-center gap-2 text-xs font-bold ${
                soundEnabled
                  ? 'bg-slate-900 border-amber-500/40 text-amber-300 hover:bg-slate-800'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={soundEnabled ? 'Efeitos sonoros ativados' : 'Efeitos sonoros desativados'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Som Ativo' : 'Mudo'}</span>
            </button>

            <div className="bg-slate-950/90 border border-amber-500/30 px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur shadow-lg">
              <Trophy className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Gestão Oficial</div>
                <div className="text-xs font-extrabold text-amber-300">Supervisão 156</div>
              </div>
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
                1. Selecione o Operador a ser premiado:
              </label>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Filtrar operador por nome ou matrícula..."
                  value={selectedOpSearch}
                  onChange={(e) => setSelectedOpSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />

                <select
                  value={selectedOpId}
                  onChange={(e) => setSelectedOpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition"
                >
                  <option value="">-- Clique para escolher o operador --</option>
                  {filteredOperators.map(op => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.registration}) • {op.totalPoints} pts • {op.totalTickets} 🎟️
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Operator Summary Card */}
              {selectedOperatorObj ? (
                <div className="mt-3.5 bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-900 border border-amber-500/30 rounded-2xl p-3.5 text-xs shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black flex items-center justify-center text-xs">
                        {selectedOperatorObj.name.charAt(0)}
                      </div>
                      <div>
                        <strong className="text-white block font-bold text-xs">{selectedOperatorObj.name}</strong>
                        <span className="text-slate-400 text-[10px]">Matrícula: {selectedOperatorObj.registration}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-lg text-[10px] inline-block shadow-sm">
                        {selectedOperatorObj.totalPoints} pts
                      </span>
                      <span className="text-amber-300 font-bold text-[10px] block mt-0.5">
                        {selectedOperatorObj.totalTickets} 🎟️ bilhetes
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500 italic">
                  Selecione quem fará o giro para habilitar o botão.
                </div>
              )}
            </div>

            {/* Spin Button */}
            <button
              onClick={handleSpin}
              disabled={spinning || !selectedOpId}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-4 px-6 rounded-2xl text-base shadow-2xl shadow-amber-500/30 transition transform active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-3"
            >
              <Disc className={`w-6 h-6 text-slate-950 ${spinning ? 'animate-spin' : 'group-hover:rotate-45 transition duration-300'}`} />
              <span className="tracking-wide">
                {spinning ? 'GIRANDO A ROLETA 156...' : 'GIRAR ROLETA 156'}
              </span>
            </button>

            {/* Rules Quick Info */}
            <div className="bg-slate-950/90 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Info className="w-4 h-4 text-sky-400" />
                <span>Dinâmica e Benefícios Oficiais:</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-400">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>100% Premiada:</strong> Todas as 10 fatias garantem um benefício real ao operador.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Controle Total da Gestão:</strong> Qualquer premiação pode ser revogada ou zerada a qualquer hora no histórico.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>Sincronização Imediata:</strong> Pontos, bilhetes e status em dobro refletem instantaneamente no dashboard.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: SVG Roulette Wheel */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative py-4">
          <div className="relative flex items-center justify-center p-2 sm:p-4 max-w-full">
            {/* Top Precision Indicator Arrow (at 12 o'clock) */}
            <div className="absolute -top-3 z-30 flex flex-col items-center drop-shadow-2xl">
              <div className="w-9 h-9 bg-gradient-to-b from-amber-300 to-yellow-500 rotate-45 rounded-md shadow-2xl border-2 border-slate-950 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950 ring-2 ring-amber-200" />
              </div>
              <div className="w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[24px] border-t-amber-400 -mt-2.5 drop-shadow-[0_4px_10px_rgba(245,158,11,0.8)]" />
            </div>

            {/* Outer Golden Studded Ring */}
            <div className="w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full p-3 bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-700 shadow-[0_0_60px_rgba(245,158,11,0.3)] flex items-center justify-center relative">
              <div className="w-full h-full rounded-full p-2 bg-slate-950 border-4 border-amber-500/50 flex items-center justify-center overflow-hidden relative shadow-inner">

                {/* Rotating SVG Wheel */}
                <div
                  className="w-full h-full relative"
                  style={{
                    transform: `rotate(${rotationDeg}deg)`,
                    transition: spinning ? 'transform 5.2s cubic-bezier(0.12, 0.82, 0.18, 1)' : 'none'
                  }}
                >
                  <svg viewBox="0 0 500 500" className="w-full h-full select-none">
                    <defs>
                      <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="50%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#854d0e" />
                      </radialGradient>
                      <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.8" />
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

                      const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
                      const sliceColor = prize.color || '#7c3aed';
                      const isHighlighted = highlightedPrizeId === prize.id;

                      // Split name for optimal 2-line rendering
                      const nameParts = prize.name.split(' ');
                      let line1 = prize.name;
                      let line2 = '';
                      if (nameParts.length > 2) {
                        line1 = nameParts.slice(0, 2).join(' ');
                        line2 = nameParts.slice(2).join(' ');
                      }

                      return (
                        <g key={prize.id} className="transition-opacity duration-300 cursor-pointer">
                          {/* Sector Arc */}
                          <path
                            d={pathData}
                            fill={sliceColor}
                            stroke="#0f172a"
                            strokeWidth="2.8"
                            className={isHighlighted ? 'brightness-125 transition' : 'transition'}
                          />

                          {/* Inner subtle glow line */}
                          <line
                            x1={center}
                            y1={center}
                            x2={center + (radius - 8) * Math.cos((midAngle * Math.PI) / 180)}
                            y2={center + (radius - 8) * Math.sin((midAngle * Math.PI) / 180)}
                            stroke="rgba(255,255,255,0.12)"
                            strokeWidth="1.5"
                          />

                          {/* Sector Content (Text + Icon oriented along the sector) */}
                          <g transform={`rotate(${midAngle + 90} 250 250)`}>
                            {/* Icon near the outer rim */}
                            <text
                              x="250"
                              y="85"
                              textAnchor="middle"
                              fontSize="22"
                              filter="url(#shadowFilter)"
                              className="select-none"
                            >
                              {prize.icon}
                            </text>

                            {/* Label Line 1 */}
                            <text
                              x="250"
                              y="114"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="11.5"
                              fontWeight="900"
                              letterSpacing="0.02em"
                              filter="url(#shadowFilter)"
                              className="select-none font-sans"
                            >
                              {line1}
                            </text>

                            {/* Label Line 2 */}
                            {line2 && (
                              <text
                                x="250"
                                y="128"
                                textAnchor="middle"
                                fill="#fef08a"
                                fontSize="9.5"
                                fontWeight="800"
                                filter="url(#shadowFilter)"
                                className="select-none font-sans"
                              >
                                {line2}
                              </text>
                            )}
                          </g>
                        </g>
                      );
                    })}

                    {/* Outer Circumference Ring */}
                    <circle cx={center} cy={center} r={radius} fill="none" stroke="#f59e0b" strokeWidth="4.5" />

                    {/* Golden Perimeter LED Lights */}
                    {bulbs.map((b, i) => (
                      <circle
                        key={b.id}
                        cx={b.x}
                        cy={b.y}
                        r={i % 2 === 0 ? "3.2" : "2.5"}
                        fill={spinning ? (i % 2 === 0 ? "#fef08a" : "#ffffff") : "#fef08a"}
                        stroke="#78350f"
                        strokeWidth="1"
                        opacity={spinning ? 0.95 : 0.8}
                      />
                    ))}
                  </svg>
                </div>

                {/* Fixed Center Metallic Hub */}
                <div className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-300 border-4 border-slate-900 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)] z-20 pointer-events-none">
                  <div className="w-20 h-20 rounded-full bg-slate-950 border border-amber-400/60 flex flex-col items-center justify-center text-center p-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 mb-0.5 animate-pulse" />
                    <div className="text-[8.5px] font-black text-amber-400 uppercase tracking-widest leading-none">ROLETA</div>
                    <div className="text-xl font-black text-white leading-none tracking-tight">156</div>
                  </div>
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
              <span>Quadro Oficial de Prêmios e Benefícios da Roleta</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Todos os 10 prêmios garantem benefícios reais à rotina e desempenho dos operadores
            </p>
          </div>
          <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 font-extrabold px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
            10 Premiações Ativas
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
                className={`p-4 rounded-2xl border transition duration-200 flex flex-col justify-between cursor-pointer ${
                  isHovered
                    ? 'bg-slate-800 border-amber-400 shadow-xl scale-[1.03]'
                    : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-2xl p-2 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">{prize.icon}</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/25 shadow-md"
                      style={{ backgroundColor: prize.color }}
                      title={`Cor na roleta: ${prize.color}`}
                    />
                  </div>

                  <div className="text-xs font-black text-white mb-1.5">
                    {prize.name}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {prize.description}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="bg-slate-900 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-800">
                    {prize.badge || 'Benefício 156'}
                  </span>
                  {prize.points > 0 && (
                    <span className="text-amber-400 font-black">
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
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 bg-gradient-to-tr from-amber-500/25 to-yellow-500/25 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-500/40 text-4xl animate-bounce shadow-xl">
              {spinResultModal.prize?.icon || '🎉'}
            </div>

            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-1">
              🎉 Sorteio da Roleta 156!
            </div>

            <h3 className="text-2xl font-black text-white mb-2">
              PARABÉNS, {spinResultModal.operatorName}!
            </h3>

            <div className="bg-gradient-to-r from-amber-500/15 via-slate-800 to-amber-500/15 border border-amber-500/40 rounded-2xl p-5 my-4 shadow-inner">
              <div className="text-xs text-slate-300 font-semibold mb-1">Você conquistou:</div>
              <div className="text-xl font-black text-amber-300 uppercase tracking-wide">
                {spinResultModal.prize?.name}
              </div>
              <div className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                {spinResultModal.prize?.description}
              </div>
            </div>

            {spinResultModal.newlyEarnedTickets > 0 && (
              <div className="mb-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
                <Ticket className="w-4 h-4" />
                <span>+{spinResultModal.newlyEarnedTickets} Novo Bilhete Conquistado para o Sorteio!</span>
              </div>
            )}

            <p className="text-xs text-slate-400 mb-6">
              O prêmio foi sincronizado com sucesso no Supabase e já está ativo na ficha do operador.
            </p>

            <button
              onClick={() => setSpinResultModal(null)}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-98"
            >
              Excelente! Concluir
            </button>
          </div>
        </div>
      )}

      {/* Histórico de Giros da Roleta (Salvo no Supabase) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <span>Histórico de Giros da Roleta (Salvo no Supabase)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie os giros efetuados. Ao excluir ou zerar um giro, o prêmio e benefícios ativos somem do Supabase e do dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-950 border border-slate-800 text-slate-400 font-bold px-3 py-1.5 rounded-xl">
              {history.length} {history.length === 1 ? 'giro registrado' : 'giros registrados'}
            </span>

            {history.length > 0 && (
              <button
                onClick={() => setShowResetModal(true)}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Zerar Todo Histórico</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4">Prêmio Sorteado</th>
                <th className="py-3.5 px-4">Efeito / Benefício</th>
                <th className="py-3.5 px-4">Responsável</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Disc className="w-8 h-8 text-slate-700" />
                      <span>Nenhum giro registrado na Roleta 156 ainda.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((spin) => {
                  const effect = getPrizeEffectLabel(spin.prize, spin.prize_type);
                  return (
                    <tr key={spin.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {spin.created_at ? new Date(spin.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                            {spin.operator_name ? spin.operator_name.charAt(0) : 'O'}
                          </div>
                          <div>
                            <div>{spin.operator_name}</div>
                            {spin.registration && (
                              <div className="text-[10px] text-slate-500 font-mono">Matrícula: {spin.registration}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-amber-300 whitespace-nowrap">
                        {spin.prize}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${effect.color}`}>
                          {effect.text}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {spin.created_by || 'Admin'}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSpinToDelete(spin)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 p-2 rounded-xl transition inline-flex items-center justify-center gap-1.5 text-[11px] font-bold"
                          title="Excluir este giro e revogar a premiação no Supabase e dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
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

      {/* Modal: Confirm Delete Specific Spin */}
      {spinToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-scale-up space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-white">
                Excluir Giro & Revogar Premiação?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Esta ação cancela o benefício atribuído ao operador no Supabase.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Operador:</span>
                <strong className="text-white">{spinToDelete.operator_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Prêmio:</span>
                <strong className="text-amber-300">{spinToDelete.prize}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data do Giro:</span>
                <span className="font-mono text-slate-300">
                  {spinToDelete.created_at ? new Date(spinToDelete.created_at).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-[11px] text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Ao confirmar, este giro será apagado do Supabase e o benefício (como <strong>Pontos em Dobro ativo</strong> ou bilhetes extras) sumirá imediatamente do dashboard.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSpinToDelete(null)}
                disabled={isDeletingSpin}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSpin}
                disabled={isDeletingSpin}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {isDeletingSpin ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Sim, Excluir</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reset All History */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-scale-up space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <RotateCcw className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-black text-white">
                Zerar Todo o Histórico da Roleta?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Atenção: Esta ação é definitiva e removerá todos os {history.length} giros já registrados.
              </p>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>O que será limpo no Supabase:</strong>
                </span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-rose-200/80 space-y-1 pl-1">
                <li>Todos os registros de giros efetuados.</li>
                <li>Status ativos de <strong>Pontos em Dobro</strong> concedidos pela roleta.</li>
                <li>Premiações operacionais pendentes oriundas da roleta.</li>
                <li>Os contadores de giros do dashboard serão zerados.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmResetHistory}
                disabled={isResetting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30"
              >
                {isResetting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Zerando...</span>
                  </>
                ) : (
                  <span>Sim, Zerar Tudo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
