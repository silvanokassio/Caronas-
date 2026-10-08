import React, { useState } from 'react';
import { X, Check, Clock, Calendar, ArrowRight, ArrowLeft, RefreshCw, Car, ShieldCheck } from 'lucide-react';
import { Ride, TripSegmentType } from '../types';
import { calculateSegmentPrice } from '../lib/segmentUtils';

interface JoinRideSegmentModalProps {
  ride: Ride;
  isOpen: boolean;
  canAutoAccept: boolean;
  onClose: () => void;
  onConfirm: (segment: TripSegmentType) => void;
}

export const JoinRideSegmentModal: React.FC<JoinRideSegmentModalProps> = ({
  ride,
  isOpen,
  canAutoAccept,
  onClose,
  onConfirm,
}) => {
  const initialSegment: TripSegmentType = ride.segmentType || 'ida_e_volta';
  const [selectedSegment, setSelectedSegment] = useState<TripSegmentType>(initialSegment);

  if (!isOpen) return null;

  const isRoundTripRide = (ride.segmentType || 'ida_e_volta') === 'ida_e_volta';
  const basePrice = ride.price || 0;

  const segmentOptions: {
    type: TripSegmentType;
    title: string;
    description: string;
    price: number;
    icon: React.ReactNode;
    disabled?: boolean;
  }[] = [
    {
      type: 'ida_e_volta',
      title: 'Ida e Volta Completa',
      description: `Partida às ${ride.departureTime}${ride.returnTime ? ` • Retorno às ${ride.returnTime}` : ''}`,
      price: basePrice,
      icon: <RefreshCw className="w-4 h-4 text-emerald-600" />,
      disabled: !isRoundTripRide,
    },
    {
      type: 'somente_ida',
      title: 'Somente Ida',
      description: `Embarque no horário de ida às ${ride.departureTime}`,
      price: calculateSegmentPrice(basePrice, 'somente_ida', ride.segmentType),
      icon: <ArrowRight className="w-4 h-4 text-blue-600" />,
      disabled: ride.segmentType === 'somente_volta',
    },
    {
      type: 'somente_volta',
      title: 'Somente Volta',
      description: `Embarque apenas no retorno às ${ride.returnTime || '17:30'}`,
      price: calculateSegmentPrice(basePrice, 'somente_volta', ride.segmentType),
      icon: <ArrowLeft className="w-4 h-4 text-purple-600" />,
      disabled: ride.segmentType === 'somente_ida',
    },
  ];

  const currentPrice = calculateSegmentPrice(basePrice, selectedSegment, ride.segmentType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Car className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display">Escolha o Trecho da Viagem</h3>
              <p className="text-xs text-indigo-200">Selecione o segmento em que deseja viajar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Ride Context */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                {ride.departureDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Ida: {ride.departureTime}
                {ride.returnTime && ` | Volta: ${ride.returnTime}`}
              </span>
            </div>
            <div className="text-slate-900 font-semibold truncate">
              {ride.origin.address.split(',')[0]} ➔ {ride.destinationAlias || ride.destination.name || ride.destination.address.split(',')[0]}
            </div>
            <div className="text-[11px] text-slate-500">
              Motorista: <span className="font-semibold text-slate-700">{ride.driverName}</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Selecione sua modalidade de embarque:
            </label>
            {segmentOptions.map((opt) => {
              const isSelected = selectedSegment === opt.type;
              if (opt.disabled) return null;

              return (
                <div
                  key={opt.type}
                  onClick={() => setSelectedSegment(opt.type)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5 p-2 rounded-xl bg-slate-100 border border-slate-200/60 shrink-0">
                      {opt.icon}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                        {opt.type !== 'ida_e_volta' && isRoundTripRide && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            50% da Tarifa
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      R$ {opt.price.toFixed(2)}
                    </div>
                    <div className="w-5 h-5 rounded-full border flex items-center justify-center ml-auto mt-1 transition ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                    }">
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pricing summary & Info */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Valor para este trecho:
              </span>
              <p className="text-xs text-emerald-900 mt-0.5">
                Compensado automaticamente via conta Caronas Bank na conclusão.
              </p>
            </div>
            <div className="text-base font-extrabold text-emerald-700 font-mono">
              R$ {currentPrice.toFixed(2)}
            </div>
          </div>

          {canAutoAccept ? (
            <div className="flex items-center space-x-2 text-[11px] text-indigo-700 font-medium bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Você é membro deste grupo: sua vaga neste trecho será confirmada imediatamente!</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-xl">
              Sua solicitação de embarque para este trecho será enviada ao motorista para aprovação.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(selectedSegment);
              onClose();
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{canAutoAccept ? 'Confirmar Reserva de Vaga' : 'Enviar Solicitação de Vaga'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
