import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Ticket, Sparkles, X } from 'lucide-react';

export default function TicketModal({ alertData, onClose }) {
  useEffect(() => {
    if (alertData) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [alertData]);

  if (!alertData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/40 animate-bounce">
          <Ticket className="w-8 h-8" />
        </div>

        <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-extrabold uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4" />
          <span>Novo Bilhete Conquistado!</span>
          <Sparkles className="w-4 h-4" />
        </div>

        <h3 className="text-xl font-black text-white mb-2">{alertData.operatorName}</h3>

        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 my-4">
          <p className="text-sm text-slate-300 mb-1">
            Atingiu <strong className="text-amber-300 font-bold">{alertData.totalPoints} pontos</strong>
          </p>
          <div className="text-2xl font-black text-amber-400 flex items-center justify-center gap-2 my-2">
            <Ticket className="w-7 h-7 text-amber-400" />
            <span>{alertData.totalTickets} {alertData.totalTickets === 1 ? 'BILHETE' : 'BILHETES'}</span>
          </div>
          {alertData.newTicketCodes && alertData.newTicketCodes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {alertData.newTicketCodes.map(tkt => (
                <span key={tkt.code} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded">
                  {tkt.code}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-6">
          O bilhete já foi gerado no sistema e está disponível para impressão e sorteio físico!
        </p>

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
