import React, { useState, useMemo } from 'react';
import { 
  X, 
  Car, 
  MapPin, 
  Clock, 
  Calendar, 
  Sparkles, 
  Send,
  UserCheck,
  PlusCircle,
  Route,
  CheckCircle2,
  Users,
  Compass,
  AlertCircle
} from 'lucide-react';
import { Ride, User, getUserVehicles, Vehicle, GeoLocation } from '../types';
import { calculateDistanceKm } from '../lib/geo';
import { isRideInPast, canJoinRide } from '../lib/dateUtils';

interface WelcomeRideRequestModalProps {
  ride: Ride;
  currentUser: User | null;
  rides: Ride[];
  onClose: () => void;
  onSendProposal: (
    requestRideId: string,
    proposalData: {
      mode: 'existing_ride' | 'new_ride';
      existingRideId?: string;
      existingRideTitle?: string;
      destinationDistanceKm?: number;
      offeredPrice: number;
      departureTime: string;
      departureDate: string;
      totalSeats?: number;
      vehicle?: Vehicle;
      notes?: string;
      meetingPoint?: GeoLocation;
    }
  ) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const WelcomeRideRequestModal: React.FC<WelcomeRideRequestModalProps> = ({
  ride,
  currentUser,
  rides,
  onClose,
  onSendProposal,
  onOpenAuth,
}) => {
  const userVehicles = getUserVehicles(currentUser);
  const defaultVehicle = userVehicles[0] || currentUser?.vehicle;

  // Driver's scheduled offered rides
  const driverScheduledRides = useMemo(() => {
    if (!currentUser) return [];
    return rides
      .filter((r) => (r.rideType || 'offer') === 'offer' && r.driverId === currentUser.id && r.status === 'agendada' && !isRideInPast(r))
      .map((driverRide) => {
        const destDist = calculateDistanceKm(
          driverRide.destination.lat,
          driverRide.destination.lng,
          ride.destination.lat,
          ride.destination.lng
        );
        const originDist = calculateDistanceKm(
          driverRide.origin.lat,
          driverRide.origin.lng,
          ride.origin.lat,
          ride.origin.lng
        );
        const availableSeats = (driverRide.totalSeats ?? 4) - (driverRide.occupiedSeats ?? 0);
        return {
          ride: driverRide,
          destDist,
          originDist,
          availableSeats,
          isClose: destDist <= 5.0,
        };
      })
      .sort((a, b) => a.destDist - b.destDist);
  }, [rides, currentUser, ride]);

  // Mode: 'existing_ride' (if there are candidate rides) or 'new_ride'
  const hasCompatibleExistingRides = driverScheduledRides.length > 0;
  const [activeMode, setActiveMode] = useState<'existing_ride' | 'new_ride'>(
    hasCompatibleExistingRides ? 'existing_ride' : 'new_ride'
  );

  // Selected existing ride id
  const [selectedExistingRideId, setSelectedExistingRideId] = useState<string>(
    driverScheduledRides[0]?.ride.id || ''
  );

  const selectedExistingRideData = useMemo(() => {
    return driverScheduledRides.find((d) => d.ride.id === selectedExistingRideId);
  }, [driverScheduledRides, selectedExistingRideId]);

  // Form Fields
  const [departureDate, setDepartureDate] = useState(ride.departureDate || new Date().toISOString().split('T')[0]);
  const [departureTime, setDepartureTime] = useState(ride.departureTime || '07:30');
  const [offeredPrice, setOfferedPrice] = useState<number>(ride.price && ride.price > 0 ? ride.price : 6.50);
  const [totalSeats, setTotalSeats] = useState<number>(4);
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState<number>(0);
  const [notes, setNotes] = useState(
    `Olá ${ride.driverName}! Posso acolher seu pedido no trajeto.`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When switching or selecting an existing ride, auto-update the price/date/time preview
  const handleSelectExistingRide = (existingId: string) => {
    setSelectedExistingRideId(existingId);
    const found = driverScheduledRides.find((d) => d.ride.id === existingId);
    if (found) {
      setOfferedPrice(found.ride.price ?? 6.50);
      setDepartureDate(found.ride.departureDate);
      setDepartureTime(found.ride.departureTime);
      setNotes(`Olá ${ride.driverName}! Tenho a viagem '${found.ride.description || found.ride.destination.address}' no mesmo trajeto e posso te acolher.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth?.('login');
      return;
    }

    if (!canJoinRide(ride)) {
      alert('Este pedido de carona pertence ao passado ou já foi concluído/cancelado.');
      return;
    }

    setIsSubmitting(true);
    const chosenVehicle = userVehicles[selectedVehicleIndex] || defaultVehicle;

    if (activeMode === 'existing_ride' && selectedExistingRideData) {
      const exRide = selectedExistingRideData.ride;
      onSendProposal(ride.id, {
        mode: 'existing_ride',
        existingRideId: exRide.id,
        existingRideTitle: exRide.description || `${exRide.origin.address.split(',')[0]} ➔ ${exRide.destination.address.split(',')[0]}`,
        destinationDistanceKm: selectedExistingRideData.destDist,
        offeredPrice: Number(offeredPrice) || exRide.price || 6.50,
        departureTime: exRide.departureTime,
        departureDate: exRide.departureDate,
        vehicle: exRide.vehicle,
        notes: notes.trim(),
        meetingPoint: ride.origin,
      });
    } else {
      onSendProposal(ride.id, {
        mode: 'new_ride',
        offeredPrice: Number(offeredPrice) || 6.50,
        departureTime,
        departureDate,
        totalSeats,
        vehicle: chosenVehicle,
        notes: notes.trim(),
        meetingPoint: ride.origin,
      });
    }

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div 
      id="welcome-ride-request-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white p-5 sm:p-6 relative">
          <button
            id="close-welcome-request-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Acolhimento de Pedido de Carona</span>
          </div>

          <h2 className="text-xl font-display font-bold text-white">
            Acolher Pedido de {ride.driverName}
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Vincule a uma viagem sua com trajeto próximo ou crie uma nova viagem sob medida para este pedido.
          </p>
        </div>

        {/* Passenger & Requested Route Summary */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <img 
                src={ride.driverAvatar} 
                alt={ride.driverName} 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500" 
              />
              <div>
                <div className="text-[11px] font-semibold text-slate-500">Solicitante da Carona</div>
                <div className="text-sm font-bold text-slate-900">{ride.driverName}</div>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              {ride.targetGroupName || 'Comunidade'}
            </span>
          </div>

          <div className="space-y-1.5 pt-3 mt-2 border-t border-slate-200/80 text-xs">
            <div className="flex items-start space-x-2 text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Embarque desejado:</strong> {ride.origin.address}</span>
            </div>
            <div className="flex items-start space-x-2 text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span><strong>Destino desejado:</strong> {ride.destination.address}</span>
            </div>
            <div className="flex items-center space-x-4 text-[11px] text-slate-500 pt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {ride.departureDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Horário pretendido: {ride.departureTime}
              </span>
            </div>
            {ride.requesterNote && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 text-amber-900 text-[11px] mt-1 italic">
                "{ride.requesterNote}"
              </div>
            )}
          </div>
        </div>

        {/* Tab Selection: Choose Existing Ride vs Create New Ride */}
        <div className="px-5 sm:px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
            <button
              id="tab-existing-ride-option"
              type="button"
              onClick={() => setActiveMode('existing_ride')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeMode === 'existing_ride'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Route className="w-4 h-4" />
              <span>Minha Viagem Existente</span>
              {driverScheduledRides.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeMode === 'existing_ride' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {driverScheduledRides.length}
                </span>
              )}
            </button>

            <button
              id="tab-new-ride-option"
              type="button"
              onClick={() => setActiveMode('new_ride')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeMode === 'new_ride'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Nova Viagem</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* TAB 1: Existing Ride Selection */}
          {activeMode === 'existing_ride' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-indigo-600" />
                  Selecione sua viagem agendada:
                </span>
                <span className="text-[10px] text-slate-500">
                  Ordenado por proximidade de destino
                </span>
              </div>

              {driverScheduledRides.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {driverScheduledRides.map(({ ride: exRide, destDist, originDist, availableSeats, isClose }) => {
                    const isSelected = selectedExistingRideId === exRide.id;
                    return (
                      <div
                        key={exRide.id}
                        onClick={() => handleSelectExistingRide(exRide.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">
                                {exRide.description || `${exRide.origin.address.split(',')[0]} ➔ ${exRide.destination.address.split(',')[0]}`}
                              </span>
                              {isClose ? (
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  🎯 Destino a {destDist.toFixed(1)} km
                                </span>
                              ) : (
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                  Destino a {destDist.toFixed(1)} km
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-600 flex items-center space-x-3 flex-wrap">
                              <span className="flex items-center gap-1 font-medium">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {exRide.departureDate} às {exRide.departureTime}
                              </span>
                              <span className="flex items-center gap-1 text-indigo-700 font-bold">
                                <Users className="w-3 h-3" />
                                {availableSeats} vaga(s) livre(s)
                              </span>
                              <span className="font-bold text-slate-900">
                                R$ {(exRide.price ?? 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 pt-0.5">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                  <p className="text-xs font-bold text-amber-950">
                    Você não possui viagens agendadas no momento.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Você pode criar uma nova viagem agora mesmo com base neste pedido!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveMode('new_ride')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Criar Nova Viagem para Este Pedido
                  </button>
                </div>
              )}

              {/* Price adjustment for existing ride */}
              {selectedExistingRideData && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Valor do Rateio para este Passageiro (R$)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                        R$
                      </div>
                      <input
                        id="existing-ride-price-input"
                        type="number"
                        step="0.50"
                        min="0"
                        required
                        value={offeredPrice}
                        onChange={(e) => setOfferedPrice(parseFloat(e.target.value) || 0)}
                        className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex flex-col justify-center">
                    <span className="text-slate-500 text-[10px]">Data & Horário da Viagem</span>
                    <span className="font-bold text-slate-900 text-xs">
                      📅 {selectedExistingRideData.ride.departureDate} às {selectedExistingRideData.ride.departureTime}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Create New Ride Based on Request */}
          {activeMode === 'new_ride' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Uma nova viagem de carona será criada na sua conta com base nos pontos de embarque e destino solicitados por <strong>{ride.driverName}</strong>.
                </p>
              </div>

              {/* Form Inputs: Price, Date, Time, Seats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Offered Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Valor do Rateio (R$)</span>
                    <span className="text-[10px] text-emerald-600 font-medium">Por Vaga</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                      R$
                    </div>
                    <input
                      id="new-ride-price-input"
                      type="number"
                      step="0.50"
                      min="0"
                      required
                      value={offeredPrice}
                      onChange={(e) => setOfferedPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* Departure Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Horário de Saída</span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <input
                    id="new-ride-time-input"
                    type="time"
                    required
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>

                {/* Departure Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Data da Viagem</span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <input
                    id="new-ride-date-input"
                    type="date"
                    required
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>

                {/* Total Seats */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Vagas Disponíveis</span>
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <select
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  >
                    <option value={1}>1 Vaga</option>
                    <option value={2}>2 Vagas</option>
                    <option value={3}>3 Vagas</option>
                    <option value={4}>4 Vagas</option>
                    <option value={5}>5 Vagas</option>
                  </select>
                </div>
              </div>

              {/* Vehicle Selection */}
              {userVehicles.length > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                    <Car className="w-3.5 h-3.5 text-slate-500" />
                    <span>Seu Veículo</span>
                  </label>
                  <select
                    value={selectedVehicleIndex}
                    onChange={(e) => setSelectedVehicleIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  >
                    {userVehicles.map((v, i) => (
                      <option key={i} value={i}>
                        🚗 {v.model} - {v.color} (Placa: {v.plate})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-slate-100 p-2.5 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-400" />
                  <span>Você utilizará seu veículo cadastrado no perfil.</span>
                </div>
              )}
            </div>
          )}

          {/* Message / Meeting Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Mensagem & Ponto de Encontro para o Solicitante</span>
            </label>
            <textarea
              id="welcome-request-notes-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Posso te pegar na esquina da Vital Brasil às 07:45!"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-200">
            <button
              id="cancel-welcome-request-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="submit-welcome-request-btn"
              type="submit"
              disabled={isSubmitting || (activeMode === 'existing_ride' && !selectedExistingRideId)}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer active:scale-98 ${
                activeMode === 'existing_ride'
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {activeMode === 'existing_ride'
                  ? 'Vincular e Enviar Proposta'
                  : 'Criar Viagem e Enviar Proposta'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
