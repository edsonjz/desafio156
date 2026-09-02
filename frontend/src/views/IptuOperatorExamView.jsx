import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  ShieldCheck,
  Award,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function IptuOperatorExamView({ tokenCode, onBackToApp = null }) {
  const [token, setToken] = useState(tokenCode || '');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  // Exam flow states: 'welcome' | 'exam' | 'confirm' | 'result'
  const [flowState, setFlowState] = useState('welcome');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState(null);

  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const startTimeRef = useRef(null);

  // If tokenCode wasn't passed directly, check URL path
  useEffect(() => {
    let tok = tokenCode;
    if (!tok && window.location.pathname.startsWith('/prova-iptu/')) {
      tok = window.location.pathname.replace('/prova-iptu/', '').trim();
    }
    if (tok) {
      setToken(tok);
      loadSession(tok);
    } else {
      setLoading(false);
      setError('Token de avaliação não fornecido no link.');
    }
  }, [tokenCode]);

  const loadSession = async (tok) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/iptu/public/session/${encodeURIComponent(tok)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar dados da prova.');
      }

      setSession(data);
      if (data.savedAnswers) {
        // Map question ID to letter
        const map = {};
        data.questions.forEach((q, idx) => {
          if (data.savedAnswers[q.id]) {
            map[q.numero] = data.savedAnswers[q.id];
          }
        });
        setSelectedAnswers(map);
      }

      // If already finished, jump to result
      if (data.attempt && (data.attempt.status === 'concluida' || data.attempt.status === 'expirada_tempo')) {
        setFinalResult({
          operador: data.operator.nome,
          matricula: data.operator.matricula,
          nota: data.attempt.nota,
          percentual: data.attempt.percentual,
          acertos: data.attempt.acertos,
          erros: data.attempt.erros,
          resultado: data.attempt.resultado,
          finalizada_em: data.attempt.finalizada_em
        });
        setFlowState('result');
      } else if (data.attempt && data.attempt.status === 'em_andamento') {
        // Resume in progress
        setFlowState('exam');
        initTimer(data.config.tempo_maximo_minutos, data.attempt.iniciada_em);
      } else {
        setFlowState('welcome');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initTimer = (maxMinutes, startedAtStr) => {
    if (!maxMinutes || maxMinutes <= 0) return;
    const totalSeconds = maxMinutes * 60;
    const startTime = startedAtStr ? new Date(startedAtStr).getTime() : Date.now();
    startTimeRef.current = startTime;

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsedSeconds);
    setTimeRemaining(remaining);
    setTimerActive(true);
  };

  // Timer countdown
  useEffect(() => {
    let interval = null;
    if (timerActive && timeRemaining !== null && timeRemaining > 0 && flowState === 'exam') {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAutoSubmitOnTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timeRemaining, flowState]);

  const handleStartExam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/iptu/public/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar prova.');

      setFlowState('exam');
      initTimer(session?.config?.tempo_maximo_minutos, data.iniciada_em || new Date().toISOString());
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (letra) => {
    if (!session || !session.questions) return;
    const currentQ = session.questions[currentQIndex];
    if (!currentQ) return;

    const newAnswers = { ...selectedAnswers, [currentQ.numero]: letra };
    setSelectedAnswers(newAnswers);

    // Save answer in real time
    setSavingAnswer(true);
    try {
      await fetch('/api/iptu/public/save-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          questaoNumero: currentQ.numero,
          letra
        })
      });
    } catch (err) {
      console.warn('Erro ao salvar resposta no backend:', err);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleFinishExam = async (timedOut = false) => {
    setSubmitting(true);
    const elapsedSeconds = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;

    try {
      const res = await fetch('/api/iptu/public/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tempoGastoSegundos: elapsedSeconds,
          timedOut
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao finalizar a prova.');

      setFinalResult(data);
      setFlowState('result');
      setTimerActive(false);

      if (data.resultado === 'aprovado') {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmitOnTimeout = () => {
    alert('⏱️ O tempo limite da prova foi atingido. Suas respostas foram salvas e a prova foi finalizada automaticamente.');
    handleFinishExam(true);
  };

  const formatTime = (secs) => {
    if (secs === null || secs === undefined) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-16 h-16 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm font-semibold tracking-wide">Carregando avaliação...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Não Disponível</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          {onBackToApp ? (
            <button
              onClick={onBackToApp}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-6 rounded-2xl transition"
            >
              Voltar ao Painel
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              Caso acredite que se trata de um engano, solicite ao seu supervisor a liberação ou geração de um novo link.
            </div>
          )}
        </div>
      </div>
    );
  }

  const questions = session?.questions || [];
  const currentQ = questions[currentQIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // 1. TELA DE BOAS-VINDAS / INSTRUÇÕES
  if (flowState === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 text-slate-100">
        <div className="max-w-2xl w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-amber-400">156+POA &bull; Capacitação Operacional</div>
              <h1 className="text-xl sm:text-2xl font-black text-white">{session?.config?.nome_prova || 'PROVA IPTU — 156+POA'}</h1>
            </div>
          </div>

          {/* Operator Identification */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400 font-medium">Operador(a) Identificado(a)</div>
              <div className="text-base sm:text-lg font-bold text-white">{session?.operator?.nome}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl">
              <span className="text-xs text-slate-400 font-semibold">Matrícula: </span>
              <span className="text-sm font-mono font-bold text-amber-300">{session?.operator?.matricula}</span>
            </div>
          </div>

          {/* Notice & Instructions */}
          <div className="space-y-4 mb-8">
            <p className="text-sm text-slate-300 leading-relaxed">
              Esta avaliação tem como objetivo verificar e aprimorar seus conhecimentos técnicos e operacionais sobre <strong>IPTU (Imposto Predial e Territorial Urbano)</strong> e <strong>TCL (Taxa de Coleta de Lixo)</strong> da Prefeitura de Porto Alegre.
            </p>

            <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 text-xs sm:text-sm text-sky-200 space-y-2">
              <div className="font-bold flex items-center gap-2 text-sky-300">
                <HelpCircle className="w-4 h-4" /> Instruções Importantes:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs sm:text-sm pl-1">
                <li>A prova contém <strong>20 questões</strong> de múltipla escolha.</li>
                <li>Cada questão possui <strong>4 alternativas (A, B, C, D)</strong> e uma <strong>única resposta correta</strong>.</li>
                <li>Suas respostas são salvas automaticamente a cada seleção.</li>
                {session?.config?.tempo_maximo_minutos > 0 ? (
                  <li>Tempo máximo total: <strong>{session?.config?.tempo_maximo_minutos} minutos</strong> com cronômetro em tempo real.</li>
                ) : (
                  <li>Sem limite de tempo estabelecido.</li>
                )}
                <li>Após confirmar a finalização, <strong>suas respostas não poderão mais ser alteradas</strong>.</li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartExam}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm sm:text-base py-4 px-6 rounded-2xl transition duration-200 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 cursor-pointer"
          >
            <span>INICIAR PROVA</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. TELA DE REALIZAÇÃO DA PROVA (UMA QUESTÃO POR VEZ)
  if (flowState === 'exam' && currentQ) {
    const selectedLetra = selectedAnswers[currentQ.numero] || null;
    const diffBadge = {
      facil: { label: 'Fácil', bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
      medio: { label: 'Médio', bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
      dificil: { label: 'Difícil', bg: 'bg-rose-500/10 text-rose-300 border-rose-500/30' }
    }[currentQ.dificuldade] || { label: 'Geral', bg: 'bg-slate-800 text-slate-300 border-slate-700' };

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center font-black text-sm">
              156
            </div>
            <div>
              <div className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-xs">{session?.operator?.nome}</div>
              <div className="text-[11px] font-mono text-slate-400">Matrícula: {session?.operator?.matricula}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-save Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
              {savingAnswer ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Salvo</span>
                </>
              )}
            </div>

            {/* Countdown Timer */}
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-extrabold border ${
                timeRemaining <= 300
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-slate-950 text-amber-300 border-slate-800'
              }`}>
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Progress & Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Questão {currentQ.numero} de {totalQuestions}</span>
                <span>{answeredCount} de {totalQuestions} respondidas ({Math.round(progressPercent)}%)</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                  QUESTÃO #{currentQ.numero}
                </span>
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${diffBadge.bg}`}>
                  Dificuldade: {diffBadge.label}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-white mb-6 leading-relaxed">
                {currentQ.enunciado}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {currentQ.alternativas.map((alt) => {
                  const isSelected = selectedLetra === alt.letra;
                  return (
                    <button
                      key={alt.id}
                      onClick={() => handleSelectOption(alt.letra)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 group cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                          : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 group-hover:border-slate-700 group-hover:text-slate-200'
                      }`}>
                        {alt.letra}
                      </div>
                      <div className="flex-1 text-xs sm:text-sm pt-1 leading-relaxed">
                        {alt.texto}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Navigation Matrix of 20 questions */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 mb-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Navegação Rápida entre Questões
              </div>
              <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentQIndex;
                  const isAnswered = !!selectedAnswers[q.numero];
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center border ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-400/40'
                          : isAnswered
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {q.numero}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQIndex === 0}
              className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-slate-300 border border-slate-800 flex items-center gap-2 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            {currentQIndex < totalQuestions - 1 ? (
              <button
                onClick={() => setCurrentQIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 transition shadow-md shadow-amber-500/20"
              >
                <span>Próxima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setFlowState('confirm')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-black flex items-center gap-2 transition shadow-lg shadow-emerald-500/20"
              >
                <Send className="w-4 h-4" />
                <span>Revisar e Finalizar</span>
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // 3. TELA DE CONFIRMAÇÃO ANTES DE ENVIAR
  if (flowState === 'confirm') {
    const unAnsweredCount = totalQuestions - answeredCount;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Finalizar Avaliação?</h2>
          
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 text-xs text-slate-300 text-left space-y-2">
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Total de Questões:</span>
              <span className="font-bold text-white">{totalQuestions}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-emerald-400">Respondidas:</span>
              <span className="font-bold text-emerald-400">{answeredCount}</span>
            </div>
            {unAnsweredCount > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Não Respondidas:</span>
                <span className="font-bold">{unAnsweredCount}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Após confirmar, suas respostas serão computadas para correção automática e <strong>não poderão mais ser alteradas</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setFlowState('exam')}
              disabled={submitting}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl text-xs transition"
            >
              VOLTAR À PROVA
            </button>
            <button
              onClick={() => handleFinishExam(false)}
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{submitting ? 'CORRIGINDO...' : 'FINALIZAR PROVA'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. TELA DE RESULTADO DO OPERADOR (GABARITO OCULTO CONFORME SEÇÃO 16 E 17)
  if (flowState === 'result' && finalResult) {
    const isApproved = finalResult.resultado === 'aprovado';

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 text-slate-100">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center">
          {/* Status Icon */}
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 border shadow-xl ${
            isApproved
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-rose-500/10'
          }`}>
            {isApproved ? <Award className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
          </div>

          <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1">
            Avaliação Concluída
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            PROVA CONCLUÍDA
          </h1>

          {/* Operator Identification */}
          <div className="text-sm text-slate-300 font-semibold mb-6">
            {finalResult.operador || session?.operator?.nome} &bull; <span className="text-amber-400 font-mono">Matrícula: {finalResult.matricula || session?.operator?.matricula}</span>
          </div>

          {/* Score Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Nota</div>
              <div className="text-xl sm:text-2xl font-black text-amber-400">{finalResult.nota?.toFixed(1) || '0.0'}</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Aproveitamento</div>
              <div className="text-xl sm:text-2xl font-black text-sky-400">{finalResult.percentual?.toFixed(0) || '0'}%</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Acertos</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">{finalResult.acertos}</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Erros</div>
              <div className="text-xl sm:text-2xl font-black text-rose-400">{finalResult.erros}</div>
            </div>
          </div>

          {/* Result Banner */}
          <div className={`p-4 rounded-2xl border font-black text-base sm:text-lg flex items-center justify-center gap-2.5 mb-6 ${
            isApproved
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className="text-xl">{isApproved ? '🟢' : '🔴'}</span>
            <span>{isApproved ? 'APROVADO(A)' : 'REPROVADO(A)'}</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Seu resultado foi registrado com sucesso no sistema da Supervisão do 156+POA. Conforme as normas da avaliação, a correção detalhada por questão é de uso exclusivo da supervisão.
          </p>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 px-6 rounded-xl transition"
            >
              Fechar e Retornar ao Painel
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
