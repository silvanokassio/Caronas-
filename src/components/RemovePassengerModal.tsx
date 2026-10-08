import React, { useState, useEffect } from 'react';
import { 
  UserX, 
  AlertTriangle, 
  Send, 
  X, 
  Loader2, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { Ride, PassengerParticipant, User } from '../types';

interface RemovePassengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ride: Ride | null;
  passenger: PassengerParticipant | null;
  passengerUser?: User | null;
  onConfirmRemove: (rideId: string, passengerUserId: string, justification: string) => Promise<void>;
}

const QUICK_JUSTIFICATIONS = [
  'Alteração imprevista no itinerário da viagem',
  'Problema mecânico com o veículo',
  'Horário de saída precisou ser alterado',
  'Ponto de encontro fora do trajeto viável',
  'Emergência pessoal imprevista',
  'Ajuste na capacidade do veículo',
];

export const RemovePassengerModal: React.FC<RemovePassengerModalProps> = ({
  isOpen,
  onClose,
  ride,
  passenger,
  passengerUser,
  onConfirmRemove,
}) => {
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setJustification('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, passenger]);

  if (!isOpen || !ride || !passenger) return null;

  const passengerName = passengerUser?.name || passenger.userName || 'Passageiro(a)';
  const passengerAvatar = passengerUser?.avatar || passenger.userAvatar;
  const passengerEmail = passengerUser?.email || passenger.userEmail;

  const originText = ride.origin?.name || ride.origin?.address?.split(',')[0] || 'Origem';
  const destinationText = ride.destinationAlias || ride.destination?.alias || ride.destination?.name || ride.destination?.address?.split(',')[0] || 'Destino';

  const handleApplyQuickReason = (reason: string) => {
    setJustification((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return reason;
      if (trimmed.includes(reason)) return trimmed;
      return `${trimmed}. ${reason}`;
    });
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = justification.trim();

    if (!trimmed) {
      setErrorMsg('Por favor, informe a justificativa da exclusão.');
      return;
    }

    if (trimmed.length < 6) {
      setErrorMsg('A justificativa deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfirmRemove(ride.id, passenger.userId, trimmed);
      onClose();
    } catch (err: any) {
      console.error('Erro ao excluir passageiro:', err);
      setErrorMsg(err?.message || 'Falha ao excluir o passageiro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-remove-passenger-title"
    >
      <div 
        className="bg-white border border-rose-200/90 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-auto transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-50 via-rose-50/80 to-amber-50/50 px-5 sm:px-6 py-4 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100/90 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-remove-passenger-title" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Excluir Passageiro da Viagem
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Liberação de vaga e envio de justificativa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Passenger & Ride Preview Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={passengerAvatar}
                  alt={passengerName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-200 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                    Passageiro a ser removido
                  </span>
                  <p className="font-bold text-slate-900 text-sm truncate">
                    {passengerName}
                  </p>
                  {passengerEmail && (
                    <p className="text-xs text-slate-500 truncate">
                      {passengerEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg block">
                  R$ {(ride.price || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  1 vaga ocupada
                </span>
              </div>
            </div>

            {/* Ride Mini Details */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center space-x-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">{originText} ➔ {destinationText}</span>
              </div>
              <div className="flex items-center space-x-1.5 justify-end">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{ride.departureDate || 'Hoje'}</span>
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                <span className="font-semibold text-slate-800">{ride.departureTime}</span>
              </div>
            </div>
          </div>

          {/* Justification Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="passenger-removal-reason" 
                className="text-xs font-bold text-slate-800 flex items-center space-x-1"
              >
                <span>Justificativa da Exclusão</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[11px] ${justification.trim().length < 6 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                {justification.trim().length}/6 caracteres mín.
              </span>
            </div>

            <textarea
              id="passenger-removal-reason"
              rows={3}
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Descreva o motivo para o passageiro (ex: Alteração na rota de trabalho, imprevisto com o horário de saída, etc.)..."
              className="w-full bg-white border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition outline-none resize-none"
              disabled={isSubmitting}
            />

            {/* Quick Reason Suggestions */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Sugestões rápidas de justificativa (clique para aplicar):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_JUSTIFICATIONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleApplyQuickReason(reason)}
                    disabled={isSubmitting}
                    className="text-[11px] font-medium bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 px-2 py-1 rounded-lg transition active:scale-95 cursor-pointer text-left"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Warning / Notification Assurance Notice */}
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 leading-relaxed">
              <strong>O que acontece ao confirmar:</strong>
              <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-amber-800">
                <li>A vaga na carona será <strong>liberada imediatamente</strong> para outros usuários.</li>
                <li>O passageiro receberá um <strong>aviso Push no celular</strong> e um <strong>e-mail oficial</strong> com a justificativa acima.</li>
                <li>Nenhum rateio ou débito será cobrado do passageiro.</li>
              </ul>
            </div>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || justification.trim().length < 6}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center space-x-2 shadow-xs transition active:scale-95 cursor-pointer ${
                isSubmitting || justification.trim().length < 6
                  ? 'bg-rose-400 cursor-not-allowed opacity-80'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo e Notificando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Excluir Passageiro e Notificar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
