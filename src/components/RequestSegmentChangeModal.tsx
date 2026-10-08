import React, { useState } from 'react';
import { X, RefreshCw, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Ride, TripSegmentType, PassengerParticipant } from '../types';
import { calculateSegmentPrice, getSegmentLabel } from '../lib/segmentUtils';

interface RequestSegmentChangeModalProps {
  ride: Ride;
  passenger: PassengerParticipant;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestedSegment: TripSegmentType) => void;
}

export const RequestSegmentChangeModal: React.FC<RequestSegmentChangeModalProps> = ({
  ride,
  passenger,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const currentSegment: TripSegmentType = passenger.segmentType || ride.segmentType || 'ida_e_volta';
  const [selectedSegment, setSelectedSegment] = useState<TripSegmentType>(currentSegment);

  if (!isOpen) return null;

  const isRoundTripRide = (ride.segmentType || 'ida_e_volta') === 'ida_e_volta';
  const basePrice = ride.price || 0;

  const options: {
    type: TripSegmentType;
    label: string;
    description: string;
    price: number;
    icon: React.ReactNode;
    disabled?: boolean;
  }[] = [
    {
      type: 'ida_e_volta',
      label: 'Ida e Volta Completa',
      description: `Partida às ${ride.departureTime}${ride.returnTime ? ` • Retorno às ${ride.returnTime}` : ''}`,
      price: basePrice,
      icon: <RefreshCw className="w-4 h-4 text-emerald-600" />,
      disabled: !isRoundTripRide,
    },
    {
      type: 'somente_ida',
      label: 'Somente Ida',
      description: `Partida às ${ride.departureTime}`,
      price: calculateSegmentPrice(basePrice, 'somente_ida', ride.segmentType),
      icon: <ArrowRight className="w-4 h-4 text-blue-600" />,
      disabled: ride.segmentType === 'somente_volta',
    },
    {
      type: 'somente_volta',
      label: 'Somente Volta',
      description: `Retorno às ${ride.returnTime || '17:30'}`,
      price: calculateSegmentPrice(basePrice, 'somente_volta', ride.segmentType),
      icon: <ArrowLeft className="w-4 h-4 text-purple-600" />,
      disabled: ride.segmentType === 'somente_ida',
    },
  ];

  const hasChanged = selectedSegment !== currentSegment;
  const newPrice = calculateSegmentPrice(basePrice, selectedSegment, ride.segmentType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-display">Alterar Trecho da Viagem</h3>
            <p className="text-xs text-indigo-200">Envie um pedido de alteração de trecho ao motorista</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium block">Trecho Confirmado Atual:</span>
            <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              <span>{getSegmentLabel(currentSegment)}</span>
              <span className="text-emerald-700 font-mono font-semibold">
                (R$ {(passenger.agreedPrice ?? basePrice).toFixed(2)})
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Selecione o novo trecho desejado:
            </label>
            {options.map((opt) => {
              if (opt.disabled) return null;
              const isSelected = selectedSegment === opt.type;
              const isCurrent = currentSegment === opt.type;

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
                        <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            Atual
                          </span>
                        )}
                        {!isCurrent && opt.type !== 'ida_e_volta' && isRoundTripRide && (
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

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start space-x-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              A alteração de trecho depende da aprovação do motorista ({ride.driverName}). Caso aprovada, o novo valor de <strong>R$ {newPrice.toFixed(2)}</strong> será aplicado automaticamente.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={!hasChanged}
            onClick={() => {
              onSubmit(selectedSegment);
              onClose();
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Solicitar Alteração</span>
          </button>
        </div>
      </div>
    </div>
  );
};
