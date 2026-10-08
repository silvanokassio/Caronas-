import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  Navigation,
  Car,
  Home
} from 'lucide-react';
import { Ride, User, TripSegmentType, PassengerParticipant, GeoLocation } from '../types';
import { calculateSegmentPrice, getSegmentLabel } from '../lib/segmentUtils';
import { LocationPickerModal } from './LocationPickerModal';

export interface PassengerEditRideModalProps {
  ride: Ride;
  passenger: PassengerParticipant;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    rideId: string,
    updates: {
      segmentType: TripSegmentType;
      meetingPoint: GeoLocation;
      passengerNotes?: string;
    }
  ) => Promise<void> | void;
}

export const PassengerEditRideModal: React.FC<PassengerEditRideModalProps> = ({
  ride,
  passenger,
  currentUser,
  isOpen,
  onClose,
  onSave,
}) => {
  // Driver's offered segment
  const driverSegment: TripSegmentType = ride.segmentType || 'ida_e_volta';
  const isDriverRoundTrip = driverSegment === 'ida_e_volta';
  const basePrice = Number(ride.price) || 0;

  // Initial values from passenger participation
  const currentSegment: TripSegmentType = passenger.segmentType || driverSegment || 'ida_e_volta';
  const [selectedSegment, setSelectedSegment] = useState<TripSegmentType>(currentSegment);

  const [meetingPointAddress, setMeetingPointAddress] = useState<string>('');
  const [meetingPointName, setMeetingPointName] = useState<string>('');
  const [meetingPointLat, setMeetingPointLat] = useState<number>(-23.5539);
  const [meetingPointLng, setMeetingPointLng] = useState<number>(-46.6896);
  const [passengerNotes, setPassengerNotes] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Sync state whenever modal opens or passenger changes
  useEffect(() => {
    if (isOpen && passenger) {
      setSelectedSegment(passenger.segmentType || driverSegment || 'ida_e_volta');
      setMeetingPointAddress(
        passenger.meetingPoint?.address ||
        currentUser?.ponto_encontro_default?.address ||
        ride.origin?.address ||
        ''
      );
      setMeetingPointName(
        passenger.meetingPoint?.name ||
        currentUser?.ponto_encontro_default?.name ||
        ''
      );
      setMeetingPointLat(
        passenger.meetingPoint?.lat ||
        currentUser?.ponto_encontro_default?.lat ||
        ride.origin?.lat ||
        -23.5539
      );
      setMeetingPointLng(
        passenger.meetingPoint?.lng ||
        currentUser?.ponto_encontro_default?.lng ||
        ride.origin?.lng ||
        -46.6896
      );
      setPassengerNotes(passenger.passengerNotes || '');
      setErrorMessage('');
    }
  }, [isOpen, passenger, driverSegment, currentUser, ride]);

  if (!isOpen) return null;

  // Price calculations
  const originalAgreedPrice = passenger.agreedPrice ?? calculateSegmentPrice(basePrice, passenger.segmentType, driverSegment);
  const newCalculatedPrice = calculateSegmentPrice(basePrice, selectedSegment, driverSegment);

  // Segment options configuration
  const segmentOptions: {
    type: TripSegmentType;
    label: string;
    badge: string;
    description: string;
    price: number;
    icon: React.ReactNode;
    disabled?: boolean;
    disabledReason?: string;
  }[] = [
    {
      type: 'ida_e_volta',
      label: 'Ida e Volta Completa (Padrão)',
      badge: isDriverRoundTrip ? 'Padrão do Motorista' : 'Indisponível',
      description: `Partida às ${ride.departureTime} • Retorno às ${ride.returnTime || '17:30'}`,
      price: basePrice,
      icon: <RefreshCw className="w-4 h-4 text-emerald-600" />,
      disabled: driverSegment === 'somente_ida' || driverSegment === 'somente_volta',
      disabledReason: 'O motorista só oferece viagem em sentido único nesta publicação.',
    },
    {
      type: 'somente_ida',
      label: 'Somente Ida',
      badge: isDriverRoundTrip ? '50% da contribuição' : 'Sentido Único',
      description: `Embarque no horário de partida às ${ride.departureTime}`,
      price: calculateSegmentPrice(basePrice, 'somente_ida', driverSegment),
      icon: <ArrowRight className="w-4 h-4 text-blue-600" />,
      disabled: driverSegment === 'somente_volta',
      disabledReason: 'O motorista cadastrou esta viagem exclusivamente como volta.',
    },
    {
      type: 'somente_volta',
      label: 'Somente Volta',
      badge: isDriverRoundTrip ? '50% da contribuição' : 'Sentido Único',
      description: `Embarque no horário de retorno às ${ride.returnTime || '17:30'}`,
      price: calculateSegmentPrice(basePrice, 'somente_volta', driverSegment),
      icon: <ArrowLeft className="w-4 h-4 text-purple-600" />,
      disabled: driverSegment === 'somente_ida',
      disabledReason: 'O motorista cadastrou esta viagem exclusivamente como ida.',
    },
  ];

  const handleUseDefaultMeetingPoint = () => {
    if (currentUser?.ponto_encontro_default) {
      setMeetingPointAddress(currentUser.ponto_encontro_default.address || '');
      setMeetingPointName(currentUser.ponto_encontro_default.name || '');
      setMeetingPointLat(currentUser.ponto_encontro_default.lat || -23.5539);
      setMeetingPointLng(currentUser.ponto_encontro_default.lng || -46.6896);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingPointAddress.trim()) {
      setErrorMessage('Por favor, informe seu ponto de encontro/embarque.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      await onSave(ride.id, {
        segmentType: selectedSegment,
        meetingPoint: {
          address: meetingPointAddress.trim(),
          name: meetingPointName.trim() || undefined,
          lat: meetingPointLat,
          lng: meetingPointLng,
        },
        passengerNotes: passengerNotes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Error updating passenger participation:', err);
      setErrorMessage(err.message || 'Erro ao salvar alterações da viagem.');
    } finally {
      setIsSaving(false);
    }
  };

  const destAlias = ride.destinationAlias || ride.destination?.alias || ride.destination?.name || ride.destination?.address;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-200 shrink-0">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display flex items-center gap-2">
                  <span>Editar Viagem do Passageiro</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/40 text-indigo-100 border border-indigo-400/30">
                    Minha Participação
                  </span>
                </h3>
                <p className="text-xs text-indigo-200/80">
                  Altere o trecho que você vai participar, ponto de encontro e observações.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Ride Overview Card */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <img
                    src={ride.driverAvatar}
                    alt={ride.driverName}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/30"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight">
                      Motorista: {ride.driverName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {ride.driverVehicle?.model || 'Veículo Cadastrado'}{ride.driverVehicle?.plate ? ` • ${ride.driverVehicle.plate}` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Data da Viagem</span>
                  <strong className="text-slate-800 font-mono text-xs">{ride.departureDate}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Rota</span>
                  <p className="font-semibold text-slate-800 truncate text-xs">
                    {ride.origin?.name || ride.origin?.address} ➔ <strong className="text-indigo-900">{destAlias}</strong>
                  </p>
                </div>
                <div className="shrink-0 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-right">
                  <span className="text-[10px] text-slate-500 block">Oferta do Motorista</span>
                  <span className="font-bold text-indigo-700 text-xs">
                    {getSegmentLabel(driverSegment)}
                  </span>
                </div>
              </div>
            </div>

            {/* SEGMENT SELECTION SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block font-mono">
                    1. Trecho que você vai participar:
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    O motorista oferece <strong>{getSegmentLabel(driverSegment)}</strong>. Escolha se você deseja ir e voltar ou apenas um dos sentidos:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {segmentOptions.map((opt) => {
                  const isSelected = selectedSegment === opt.type;
                  const isCurrent = currentSegment === opt.type;

                  if (opt.disabled) {
                    return (
                      <div
                        key={opt.type}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-100/60 opacity-60 flex items-center justify-between gap-3 cursor-not-allowed"
                        title={opt.disabledReason}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="mt-0.5 p-2 rounded-xl bg-slate-200/60 text-slate-400 shrink-0">
                            {opt.icon}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-600 line-through">{opt.label}</span>
                            <p className="text-[11px] text-slate-400 mt-0.5">{opt.disabledReason}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">
                          Indisponível
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={opt.type}
                      onClick={() => setSelectedSegment(opt.type)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                        }`}>
                          {opt.icon}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className={`text-xs font-bold ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                              {opt.label}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Seu Trecho Atual
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.description}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900 font-mono">
                          R$ {opt.price.toFixed(2)}
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ml-auto mt-1 transition ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informative pill */}
              {isDriverRoundTrip && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-start space-x-2 text-xs text-indigo-950">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="leading-snug text-[11px]">
                    <strong>Regra de Participação:</strong> Ao escolher <strong>Somente Ida</strong> ou <strong>Somente Volta</strong> em uma viagem de ida e volta cadastrada pelo motorista, sua contribuição financeira é recalculada automaticamente para a metade do valor (50%).
                  </p>
                </div>
              )}
            </div>

            {/* MEETING POINT SECTION */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block font-mono">
                  2. Ponto de Encontro / Embarque:
                </label>
                {currentUser?.ponto_encontro_default?.address && (
                  <button
                    type="button"
                    onClick={handleUseDefaultMeetingPoint}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Home className="w-3 h-3" />
                    <span>Usar Padrão</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="text"
                    required
                    value={meetingPointAddress}
                    onChange={(e) => setMeetingPointAddress(e.target.value)}
                    placeholder="Endereço de embarque (Ex: Portaria 1 USP, Estação Butantã)"
                    className="w-full pl-9 pr-24 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center space-x-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>No Mapa</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={meetingPointName}
                  onChange={(e) => setMeetingPointName(e.target.value)}
                  placeholder="Nome ou referência do local (Ex: Em frente à guarita)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white"
                />
              </div>
            </div>

            {/* PASSENGER NOTES SECTION */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block font-mono">
                3. Observações para o Motorista (Opcional):
              </label>
              <textarea
                rows={2}
                value={passengerNotes}
                onChange={(e) => setPassengerNotes(e.target.value)}
                placeholder="Ex: Vou aguardar com mochila pequena; qualquer imprevisto me avise..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50/50"
              />
            </div>

            {/* SUMMARY BOX */}
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-emerald-800 uppercase font-mono font-bold block">
                  Resumo da sua Participação
                </span>
                <p className="font-bold text-slate-900 mt-0.5">
                  Trecho: <span className="text-indigo-900">{getSegmentLabel(selectedSegment)}</span>
                </p>
                {selectedSegment !== currentSegment && (
                  <span className="text-[10px] text-emerald-700 font-medium">
                    (Alteração de {getSegmentLabel(currentSegment)} para {getSegmentLabel(selectedSegment)})
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Contribuição</span>
                <span className="text-base font-extrabold text-emerald-800 font-mono">
                  R$ {newCalculatedPrice.toFixed(2)}
                </span>
                {originalAgreedPrice !== newCalculatedPrice && (
                  <span className="text-[10px] text-slate-400 line-through block font-mono">
                    R$ {originalAgreedPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Alterações da Viagem</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Location Picker Submodal */}
      {isMapPickerOpen && (
        <LocationPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          title="Selecionar Ponto de Embarque no Mapa"
          initialAddress={meetingPointAddress}
          initialLat={meetingPointLat}
          initialLng={meetingPointLng}
          currentUser={currentUser}
          onConfirm={(selected) => {
            setMeetingPointAddress(selected.address);
            if (selected.name) {
              setMeetingPointName(selected.name);
            }
            setMeetingPointLat(selected.lat);
            setMeetingPointLng(selected.lng);
            setIsMapPickerOpen(false);
          }}
        />
      )}
    </>
  );
};
