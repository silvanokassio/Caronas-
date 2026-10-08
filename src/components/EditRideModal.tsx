import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Pencil,
  MapPin,
  Clock,
  Calendar,
  Car,
  Users,
  Building2,
  Home,
  Navigation,
  Loader2,
  DollarSign,
  AlertCircle,
  Check,
  Save,
  Globe,
  FileText,
  ArrowRight,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { Ride, User, Group, getUserVehicles, isSuperUser, GeoLocation, TripSegmentType } from '../types';
import { reverseGeocode } from '../lib/geo';
import { LocationPickerModal } from './LocationPickerModal';

interface EditRideModalProps {
  ride: Ride;
  currentUser: User | null;
  groups: Group[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (rideId: string, updates: Partial<Ride>) => Promise<void> | void;
}

export const EditRideModal: React.FC<EditRideModalProps> = ({
  ride,
  currentUser,
  groups,
  isOpen,
  onClose,
  onSave,
}) => {
  const isOffer = (ride.rideType || 'offer') === 'offer';
  const isCreator = currentUser && (ride.driverId === currentUser.id || isSuperUser(currentUser));

  // User vehicles
  const userVehicles = useMemo(() => getUserVehicles(currentUser), [currentUser]);

  // Form states
  const [description, setDescription] = useState<string>('');
  const [destAlias, setDestAlias] = useState<string>('');
  const [originAddress, setOriginAddress] = useState<string>('');
  const [originLat, setOriginLat] = useState<number>(-23.5539);
  const [originLng, setOriginLng] = useState<number>(-46.6896);
  const [destAddress, setDestAddress] = useState<string>('');
  const [destLat, setDestLat] = useState<number>(-23.5574);
  const [destLng, setDestLng] = useState<number>(-46.7314);
  const [departureDate, setDepartureDate] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');
  const [price, setPrice] = useState<number>(0);
  const [totalSeats, setTotalSeats] = useState<number>(3);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [requesterNote, setRequesterNote] = useState<string>('');
  const [linkMode, setLinkMode] = useState<'avulsa' | 'group'>('avulsa');
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [targetGroupName, setTargetGroupName] = useState<string>('');
  const [segmentType, setSegmentType] = useState<TripSegmentType>('ida_e_volta');
  const [returnTime, setReturnTime] = useState<string>('17:30');

  // Auxiliary states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState<boolean>(false);
  const [mapPickerTarget, setMapPickerTarget] = useState<'origin' | 'dest' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Available groups for user
  const availableGroups = useMemo(() => {
    if (!currentUser) return [];
    if (isSuperUser(currentUser)) return groups;
    return groups.filter(
      (g) =>
        g.creatorId === currentUser.id ||
        g.adminIds?.includes(currentUser.id) ||
        g.memberIds?.includes(currentUser.id) ||
        currentUser.groups?.includes(g.id)
    );
  }, [groups, currentUser]);

  // Synchronize initial values whenever `ride` or `isOpen` changes
  useEffect(() => {
    if (ride && isOpen) {
      setDescription(ride.description || '');
      // Destination Alias: priority to destinationAlias, then destination.alias, then destination.name
      setDestAlias(ride.destinationAlias || ride.destination?.alias || ride.destination?.name || '');
      setOriginAddress(ride.origin?.address || '');
      setOriginLat(ride.origin?.lat || -23.5539);
      setOriginLng(ride.origin?.lng || -46.6896);
      setDestAddress(ride.destination?.address || '');
      setDestLat(ride.destination?.lat || -23.5574);
      setDestLng(ride.destination?.lng || -46.7314);
      setDepartureDate(ride.departureDate || '');
      setDepartureTime(ride.departureTime || '');
      setPrice(ride.price ?? (isOffer ? 6.5 : 0));
      setTotalSeats(ride.totalSeats || (isOffer ? 3 : 1));
      setSelectedVehicleId(ride.driverVehicle?.id || ride.driverVehicle?.plate || '');
      setNotes(ride.notes || '');
      setRequesterNote(ride.requesterNote || '');
      
      const isGroup = Boolean(ride.targetGroupId);
      setLinkMode(isGroup ? 'group' : 'avulsa');
      setTargetGroupId(ride.targetGroupId || '');
      setTargetGroupName(ride.targetGroupName || '');
      setSegmentType(ride.segmentType || 'ida_e_volta');
      setReturnTime(ride.returnTime || '17:30');
      setErrorMessage('');
    }
  }, [ride, isOpen, isOffer]);

  if (!isOpen) return null;

  // Handler for GPS origin
  const handleSetOriginGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada no seu navegador.');
      return;
    }
    setIsLocatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setOriginLat(lat);
        setOriginLng(lng);
        try {
          const revAddress = await reverseGeocode(lat, lng);
          if (revAddress) {
            setOriginAddress(revAddress);
          } else {
            setOriginAddress(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
          }
        } catch (_) {
          setOriginAddress(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        } finally {
          setIsLocatingGPS(false);
        }
      },
      (err) => {
        setIsLocatingGPS(false);
        console.warn('Geolocation error:', err);
        alert('Não foi possível obter a sua localização GPS atual.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Handler for My Default Point
  const handleSetOriginDefaultPoint = () => {
    if (!currentUser) return;
    const addr = currentUser.residentialAddress || currentUser.ponto_encontro_default;
    if (addr) {
      setOriginAddress(addr.address);
      setOriginLat(addr.lat);
      setOriginLng(addr.lng);
    }
  };

  // Handle Map Pin Select
  const handleSelectMapPoint = (point: GeoLocation) => {
    if (mapPickerTarget === 'origin') {
      setOriginAddress(point.address);
      setOriginLat(point.lat);
      setOriginLng(point.lng);
    } else if (mapPickerTarget === 'dest') {
      setDestAddress(point.address);
      setDestLat(point.lat);
      setDestLng(point.lng);
      // If alias is empty, we could suggest the name if present
      if (!destAlias && point.name) {
        setDestAlias(point.name);
      }
    }
    setMapPickerTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isCreator) {
      setErrorMessage('Apenas o criador desta viagem tem permissão para editá-la.');
      return;
    }

    if (!originAddress.trim()) {
      setErrorMessage('Por favor, informe o endereço de origem.');
      return;
    }

    if (!destAddress.trim()) {
      setErrorMessage('Por favor, informe o endereço de destino.');
      return;
    }

    if (!departureDate) {
      setErrorMessage('Por favor, selecione a data de partida.');
      return;
    }

    if (!departureTime) {
      setErrorMessage('Por favor, selecione o horário de partida.');
      return;
    }

    // Check minimum seats vs already accepted passengers
    const acceptedCount = ride.acceptedPassengers?.length || 0;
    if (isOffer && Number(totalSeats) < acceptedCount) {
      setErrorMessage(
        `Esta carona já possui ${acceptedCount} passageiro(s) confirmado(s). O total de vagas não pode ser inferior a ${acceptedCount}.`
      );
      return;
    }

    setIsSaving(true);

    try {
      // Find selected vehicle if offer
      let chosenVeh = ride.driverVehicle;
      if (isOffer && selectedVehicleId) {
        chosenVeh = userVehicles.find(
          (v) => (v.id && v.id === selectedVehicleId) || v.plate === selectedVehicleId
        ) || chosenVeh;
      }

      const trimmedAlias = destAlias.trim();
      const isAvulsa = linkMode === 'avulsa';

      const updates: Partial<Ride> = {
        description: description.trim() || undefined,
        notes: isOffer ? (notes.trim() || undefined) : undefined,
        requesterNote: !isOffer ? (requesterNote.trim() || undefined) : undefined,
        origin: {
          ...ride.origin,
          address: originAddress.trim(),
          lat: originLat,
          lng: originLng,
        },
        destination: {
          ...ride.destination,
          address: destAddress.trim(),
          lat: destLat,
          lng: destLng,
          alias: trimmedAlias || undefined,
          name: trimmedAlias || undefined,
        },
        destinationAlias: trimmedAlias || undefined,
        departureDate,
        departureTime,
        segmentType,
        returnTime: segmentType === 'ida_e_volta' ? (returnTime || undefined) : undefined,
        price: isOffer ? Number(price) : 0,
        totalSeats: isOffer ? Number(totalSeats) : Number(ride.totalSeats || 1),
        visibility: isAvulsa ? 'public' : 'group',
        targetGroupId: isAvulsa ? undefined : (targetGroupId || undefined),
        targetGroupName: isAvulsa ? undefined : (targetGroupName || undefined),
        driverVehicle: chosenVeh,
        waypointsOrder: [
          { lat: originLat, lng: originLng, label: 'Origem', type: 'origin', orderIndex: 0 },
          { 
            lat: destLat, 
            lng: destLng, 
            label: trimmedAlias || 'Destino Final', 
            type: 'destination', 
            orderIndex: 1 
          },
        ],
      };

      await onSave(ride.id, updates);
      setIsSaving(false);
      onClose();
    } catch (err) {
      console.error('Error saving ride edits:', err);
      setErrorMessage('Ocorreu um erro ao salvar as alterações no Firestore.');
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div 
          className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-ride-title"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 id="edit-ride-title" className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Editar Informações da Viagem</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700">
                    {isOffer ? 'Oferta' : 'Pedido'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modifique o apelido de destino, trajeto, datas e preferências da sua viagem.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Description / Title */}
            <div>
              <label className="block text-slate-800 font-bold mb-1 text-xs sm:text-sm">
                {isOffer ? 'Descrição da Carona / Título do Trajeto:' : 'Descrição do Pedido:'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isOffer
                    ? 'Ex: Carona diária para o campus Butantã / USP (Portão 3)'
                    : 'Ex: Preciso de carona para a aula das 08h no Bloco B'
                }
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
              />
            </div>

            {/* CAMPO DE ALIAS PARA PONTO DE DESTINO (EMPRESA OU FACULDADE) */}
            <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 border border-indigo-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="block text-slate-900 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Alias do Destino (Nome da Empresa ou Faculdade):</span>
                </label>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-md border border-indigo-200">
                  Exibido nos Cards
                </span>
              </div>

              <input
                id="input-edit-dest-alias"
                type="text"
                value={destAlias}
                onChange={(e) => setDestAlias(e.target.value)}
                placeholder="Ex: USP - Poli, Stefanini, Ambev Itaim, Unicamp, FIAP, etc."
                className="w-full bg-white border border-indigo-300/80 rounded-xl px-4 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 font-medium placeholder-slate-400"
              />

              <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-600">
                <p>
                  Esse nome será exibido em destaque no cabeçalho do destino nos cards da viagem.
                </p>
                {currentUser?.institutionName && destAlias !== currentUser.institutionName && (
                  <button
                    type="button"
                    onClick={() => setDestAlias(currentUser.institutionName!)}
                    className="text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                  >
                    Usar minha instituição ({currentUser.institutionName})
                  </button>
                )}
              </div>
            </div>

            {/* Origem (Embarque) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-2">
                <label className="block text-slate-800 font-bold text-xs sm:text-sm">
                  Origem do Trajeto (Ponto de Partida):
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSetOriginDefaultPoint}
                    className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer text-xs"
                    title="Preencher com o endereço padrão cadastrado"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Meu Ponto</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSetOriginGPS}
                    disabled={isLocatingGPS}
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer text-xs"
                    title="Capturar localização atual via GPS"
                  >
                    {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                    <span>GPS Atual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('origin')}
                    className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200 text-xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  placeholder="Ex: Rua Fradique Coutinho, 1200 - Pinheiros"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setMapPickerTarget('origin')}
                  className="absolute right-2 top-2 bottom-2 px-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center justify-center cursor-pointer"
                  title="Selecionar no mapa interativo"
                >
                  <MapPin className="w-4 h-4 text-indigo-600" />
                </button>
              </div>
            </div>

            {/* Endereço de Destino Final */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-2">
                <label className="block text-slate-800 font-bold text-xs sm:text-sm">
                  Endereço Completo do Destino:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('dest')}
                    className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200 text-xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                  placeholder="Ex: Av. Prof. Luciano Gualberto, 380 - Butantã, São Paulo - SP"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setMapPickerTarget('dest')}
                  className="absolute right-2 top-2 bottom-2 px-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center justify-center cursor-pointer"
                  title="Selecionar no mapa interativo"
                >
                  <MapPin className="w-4 h-4 text-indigo-600" />
                </button>
              </div>
            </div>

            {/* Data & Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-800 font-bold mb-1 text-xs sm:text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Data de Partida:</span>
                </label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1 text-xs sm:text-sm flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Horário de Partida:</span>
                </label>
                <input
                  type="time"
                  required
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Segmento da Viagem (Trecho) */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
              <div>
                <label className="block text-slate-800 font-bold mb-1.5 text-xs sm:text-sm">
                  Segmentação da Viagem (Trecho):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSegmentType('ida_e_volta')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      segmentType === 'ida_e_volta'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ida e Volta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentType('somente_ida')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      segmentType === 'somente_ida'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Somente Ida</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentType('somente_volta')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      segmentType === 'somente_volta'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Somente Volta</span>
                  </button>
                </div>
              </div>

              {segmentType === 'ida_e_volta' && (
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-xs flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Horário Previsto de Retorno (Volta):</span>
                  </label>
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full sm:w-1/2 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Passageiros que pegarem apenas um trecho (ida ou volta) pagarão 50% da tarifa.
                  </p>
                </div>
              )}
            </div>

            {/* Vagas & Preço (Se for Oferta) */}
            {isOffer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Vagas Totais Ofertadas:</span>
                    </label>
                    {ride.acceptedPassengers?.length > 0 && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                        {ride.acceptedPassengers.length} confirmada(s)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={Math.max(1, ride.acceptedPassengers?.length || 1)}
                    max={8}
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Mínimo: {Math.max(1, ride.acceptedPassengers?.length || 1)} vagas (reserva atual respeitada).
                  </p>
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-xs sm:text-sm flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Valor por Vaga (R$):</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono font-bold text-xs">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      max="150"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Veículo (Apenas Oferta) */}
            {isOffer && userVehicles.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="block text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-indigo-600" />
                  <span>Veículo Utilizado:</span>
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {userVehicles.map((v, i) => (
                    <option key={v.id || v.plate || i} value={v.id || v.plate}>
                      {v.model} - {v.color || 'Cor não inf.'} ({v.plate}) • {v.availableSeats || 4} vagas
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Observações / Notas */}
            <div>
              <label className="block text-slate-800 font-bold mb-1 text-xs sm:text-sm flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isOffer ? 'Observações Gerais da Carona:' : 'Detalhes do Pedido:'}</span>
              </label>
              <textarea
                rows={2}
                value={isOffer ? notes : requesterNote}
                onChange={(e) => isOffer ? setNotes(e.target.value) : setRequesterNote(e.target.value)}
                placeholder={
                  isOffer
                    ? 'Ex: Saída pontual, porta-malas livre para mochilas pequenas, ar-condicionado ligado.'
                    : 'Ex: Posso aguardar na portaria ou no ponto de ônibus próximo.'
                }
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            {/* Vínculo de Grupo / Visibilidade */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label className="block text-slate-800 font-bold text-xs sm:text-sm">
                Vínculo e Privacidade da Viagem:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLinkMode('avulsa')}
                  className={`p-2.5 rounded-xl border text-left flex items-start space-x-2 transition cursor-pointer ${
                    linkMode === 'avulsa'
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Globe className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-slate-900">Avulsa (Pública)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Visível para qualquer usuário verificado.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLinkMode('group');
                    if (!targetGroupId && availableGroups.length > 0) {
                      setTargetGroupId(availableGroups[0].id);
                      setTargetGroupName(availableGroups[0].name);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left flex items-start space-x-2 transition cursor-pointer ${
                    linkMode === 'group'
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-slate-900">Vinculada a Grupo</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Restrita aos membros do grupo selecionado.</p>
                  </div>
                </button>
              </div>

              {linkMode === 'group' && (
                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <label className="block text-slate-700 font-semibold text-xs">
                    Grupo Selecionado:
                  </label>
                  {availableGroups.length > 0 ? (
                    <select
                      value={targetGroupId}
                      onChange={(e) => {
                        const gId = e.target.value;
                        const grp = availableGroups.find((g) => g.id === gId);
                        setTargetGroupId(gId);
                        if (grp) setTargetGroupName(grp.name);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} {g.communityName ? `(${g.communityName})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Você não participa de nenhum grupo fechado no momento.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-submit-edit-ride"
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Interactive Map Picker Modal */}
      {mapPickerTarget && (
        <LocationPickerModal
          isOpen={true}
          title={mapPickerTarget === 'origin' ? 'Selecionar Ponto de Origem no Mapa' : 'Selecionar Ponto de Destino no Mapa'}
          initialLat={mapPickerTarget === 'origin' ? originLat : destLat}
          initialLng={mapPickerTarget === 'origin' ? originLng : destLng}
          initialAddress={mapPickerTarget === 'origin' ? originAddress : destAddress}
          currentUser={currentUser}
          onClose={() => setMapPickerTarget(null)}
          onSelectLocation={handleSelectMapPoint}
        />
      )}
    </>
  );
};
