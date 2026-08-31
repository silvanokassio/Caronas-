import React, { useState } from 'react';
import { 
  Repeat, 
  MapPin, 
  Clock, 
  Calendar, 
  Car, 
  Check, 
  Save, 
  Sparkles, 
  Navigation, 
  Shield, 
  ArrowRight,
  Loader2
} from 'lucide-react';
import { User, Routine, GeoLocation } from '../types';
import { LocationPickerModal } from './LocationPickerModal';
import { getCurrentGPSPosition, reverseGeocode } from '../lib/geo';

interface RoutineManagerProps {
  currentUser: User | null;
  onUpdateRoutine: (updatedRoutine: Routine, updatedMeetingPoint: GeoLocation) => void;
  onQuickPublish: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

const PRESET_MEETING_POINTS: GeoLocation[] = [
  { lat: -23.5719, lng: -46.7082, address: 'Metrô Butantã - Linha 4-Amarela (Saída Av. Vital Brasil)', name: 'Estação Metrô Butantã' },
  { lat: -23.5670, lng: -46.7022, address: 'Av. Rebouças, 3970 - Shopping Eldorado (Ponto de Ônibus)', name: 'Ponto Shopping Eldorado' },
  { lat: -23.5732, lng: -46.7128, address: 'Portaria 1 USP - Rua Alvarenga (Ponto de Encontro)', name: 'Portaria 1 USP Butantã' },
  { lat: -23.5855, lng: -46.6811, address: 'Av. Brigadeiro Faria Lima, 3477 (Em frente ao Edifício Pátio Victor Malzoni)', name: 'Faria Lima 3477' },
  { lat: -23.5614, lng: -46.6565, address: 'Av. Paulista, 900 (Próximo Metrô Trianon-Masp)', name: 'Av. Paulista / Metrô Trianon' },
];

export const RoutineManager: React.FC<RoutineManagerProps> = ({
  currentUser,
  onUpdateRoutine,
  onQuickPublish,
  onOpenAuth,
}) => {
  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
          <Repeat className="w-7 h-7" />
        </div>
        <h3 className="font-display font-bold text-slate-900 text-lg">Gerenciador de Rotinas Fixas</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Para configurar seus trajetos habituais, horários e pontos de encontro automáticos, entre na sua conta ou cadastre-se.
        </p>
        <button
          onClick={() => onOpenAuth?.('login')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
        >
          Entrar ou Cadastrar
        </button>
      </div>
    );
  }

  const [title, setTitle] = useState(currentUser.routine?.title || 'Minha Rotina Principal');
  const [originAddress, setOriginAddress] = useState(currentUser.routine?.origin?.address || '');
  const [originLat, setOriginLat] = useState(currentUser.routine?.origin?.lat || -23.5539);
  const [originLng, setOriginLng] = useState(currentUser.routine?.origin?.lng || -46.6896);

  const [destAddress, setDestAddress] = useState(currentUser.routine?.destination?.address || '');
  const [destLat, setDestLat] = useState(currentUser.routine?.destination?.lat || -23.5574);
  const [destLng, setDestLng] = useState(currentUser.routine?.destination?.lng || -46.7314);

  const [departureTime, setDepartureTime] = useState(currentUser.routine?.departureTime || '07:30');
  const [defaultSeats, setDefaultSeats] = useState(currentUser.routine?.defaultSeats || 3);
  const [defaultPrice, setDefaultPrice] = useState(currentUser.routine?.defaultPrice || 6.50);
  const [selectedDays, setSelectedDays] = useState<string[]>(currentUser.routine?.daysOfWeek || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);

  // Ponto de Encontro Padrão
  const [meetingPoint, setMeetingPoint] = useState<GeoLocation>(
    currentUser.ponto_encontro_default || PRESET_MEETING_POINTS[0]
  );

  // Map Picker State
  const [mapPickerTarget, setMapPickerTarget] = useState<'routineOrigin' | 'routineDest' | 'routineMeeting' | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleQuickGPS = async (target: 'origin' | 'dest' | 'meeting') => {
    setIsLocatingGPS(true);
    try {
      const coords = await getCurrentGPSPosition();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);
      if (target === 'origin') {
        setOriginAddress(resolvedAddress);
        setOriginLat(coords.lat);
        setOriginLng(coords.lng);
      } else if (target === 'dest') {
        setDestAddress(resolvedAddress);
        setDestLat(coords.lat);
        setDestLng(coords.lng);
      } else {
        setMeetingPoint({
          lat: coords.lat,
          lng: coords.lng,
          address: resolvedAddress,
          name: 'Ponto Localizado via GPS',
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Não foi possível capturar o sinal GPS.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  const daysOfWeekList = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedRoutine: Routine = {
      id: currentUser.routine?.id || `rtn-${Date.now()}`,
      title,
      origin: {
        address: originAddress,
        lat: originLat,
        lng: originLng,
      },
      destination: {
        address: destAddress,
        lat: destLat,
        lng: destLng,
      },
      departureTime,
      daysOfWeek: selectedDays,
      defaultSeats: Number(defaultSeats),
      defaultPrice: Number(defaultPrice),
    };

    onUpdateRoutine(updatedRoutine, meetingPoint);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900">Cadastro Prévio de Rotinas & Ponto de Encontro</h2>
            <p className="text-xs text-slate-500">
              Automatize suas ofertas de carona e facilite o matching inteligente com colegas de campus ou empresa.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Rotina Habitual */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
          <h3 className="text-base sm:text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Configuração da Rotina Periódica
          </h3>

          <div className="space-y-4 text-sm sm:text-xs">
            <div>
              <label className="block text-slate-800 font-bold mb-1.5">Título da Rotina:</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Pinheiros ➔ USP Poli (Manhã)"
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 sm:py-2.5 text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="block text-slate-800 font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Endereço Habitual de Origem:
                  </label>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickGPS('origin')}
                      disabled={isLocatingGPS}
                      className="text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer border border-emerald-200"
                    >
                      {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                      <span>GPS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('routineOrigin')}
                      className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Mapa</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={originAddress}
                    onChange={(e) => setOriginAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 sm:py-2.5 pr-11 text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('routineOrigin')}
                    className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                  >
                    <MapPin className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="block text-slate-800 font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    Endereço Habitual de Destino:
                  </label>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('routineDest')}
                      className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Mapa</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={destAddress}
                    onChange={(e) => setDestAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 sm:py-2.5 pr-11 text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('routineDest')}
                    className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                  >
                    <MapPin className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-800 font-bold mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  Horário de Saída:
                </label>
                <input
                  type="time"
                  required
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 sm:py-2.5 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1.5">Vagas Padrão:</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  required
                  value={defaultSeats}
                  onChange={(e) => setDefaultSeats(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 sm:py-2.5 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1.5">Preço Sugerido (R$):</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 sm:py-2.5 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono font-medium"
                />
              </div>
            </div>

            {/* Days of week */}
            <div>
              <label className="block text-slate-800 font-bold mb-2">Dias da Semana Recorrentes:</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeekList.map((day) => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2.5 sm:py-2 min-h-[40px] sm:min-h-auto rounded-xl text-sm sm:text-xs font-bold transition active:scale-95 cursor-pointer ${
                        isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Ponto de Encontro Padrão (Requisito 1.D) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base sm:text-lg font-display font-bold text-slate-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-amber-600" />
              Ponto de Encontro Padrão (Embarque Rápido)
            </h3>
            <span className="text-xs text-amber-700 font-mono bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-bold">
              Requisito 1.D (Geolocalização)
            </span>
          </div>

          <p className="text-sm sm:text-xs text-slate-600 leading-relaxed">
            Quando você solicita uma carona pública ou entra em uma rota, o Motorista visualiza este ponto exato no mapa para decidir o aceite e otimizar o itinerário.
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <label className="block text-slate-800 text-sm sm:text-xs font-bold">Ponto de Encontro Selecionado:</label>
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickGPS('meeting')}
                    disabled={isLocatingGPS}
                    className="text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer border border-emerald-200"
                  >
                    {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                    <span>Meu GPS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('routineMeeting')}
                    className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-white hover:bg-indigo-50 rounded-lg transition cursor-pointer border border-indigo-200 shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-6 h-6 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
                  <div className="text-sm sm:text-xs">
                    <p className="font-bold text-slate-900">{meetingPoint.name || 'Ponto Personalizado'}</p>
                    <p className="text-slate-600 text-xs sm:text-[11px] mt-0.5">{meetingPoint.address}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-slate-500 hidden sm:block">
                    ({meetingPoint.lat.toFixed(4)}, {meetingPoint.lng.toFixed(4)})
                  </span>
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('routineMeeting')}
                    className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                    title="Editar no Mapa"
                  >
                    <MapPin className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Presets Hub */}
            <div className="space-y-2">
              <span className="text-xs sm:text-[11px] text-slate-700 font-bold">Escolha um Ponto Rápido (Hubs Acadêmicos e Corporativos):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_MEETING_POINTS.map((preset, idx) => {
                  const isCur = meetingPoint.address === preset.address;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMeetingPoint(preset)}
                      className={`text-left p-3.5 sm:p-3 min-h-[48px] rounded-xl border text-xs transition active:scale-95 flex items-start space-x-3 cursor-pointer ${
                        isCur ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <MapPin className="w-5 h-5 sm:w-4 sm:h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-900 text-xs sm:text-xs">{preset.name}</p>
                        <p className="text-[11px] sm:text-[10px] text-slate-500 leading-tight mt-0.5">{preset.address}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm gap-3">
          <div>
            {savedSuccess && (
              <span className="text-sm sm:text-xs text-emerald-800 flex items-center gap-1.5 font-bold bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                <Check className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-600" />
                Rotina e Ponto de Encontro salvos no perfil com sucesso!
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onQuickPublish}
              className="px-4 py-3.5 sm:py-2.5 min-h-[48px] sm:min-h-auto bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm sm:text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
            >
              <span>Gerar Oferta Instantânea</span>
              <ArrowRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>

            <button
              type="submit"
              className="px-6 py-3.5 sm:py-2.5 min-h-[48px] sm:min-h-auto bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-xs font-bold rounded-xl shadow-sm flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </form>

      {/* Interactive Map Location Picker */}
      <LocationPickerModal
        isOpen={mapPickerTarget !== null}
        onClose={() => setMapPickerTarget(null)}
        title={
          mapPickerTarget === 'routineOrigin'
            ? 'Apontar Endereço Habitual de Origem no Mapa'
            : mapPickerTarget === 'routineDest'
            ? 'Apontar Endereço Habitual de Destino no Mapa'
            : 'Apontar Ponto de Encontro Padrão no Mapa'
        }
        initialAddress={
          mapPickerTarget === 'routineOrigin'
            ? originAddress
            : mapPickerTarget === 'routineDest'
            ? destAddress
            : meetingPoint.address
        }
        initialLat={
          mapPickerTarget === 'routineOrigin'
            ? originLat
            : mapPickerTarget === 'routineDest'
            ? destLat
            : meetingPoint.lat
        }
        initialLng={
          mapPickerTarget === 'routineOrigin'
            ? originLng
            : mapPickerTarget === 'routineDest'
            ? destLng
            : meetingPoint.lng
        }
        onSelectLocation={(selected) => {
          if (mapPickerTarget === 'routineOrigin') {
            setOriginAddress(selected.address);
            setOriginLat(selected.lat);
            setOriginLng(selected.lng);
          } else if (mapPickerTarget === 'routineDest') {
            setDestAddress(selected.address);
            setDestLat(selected.lat);
            setDestLng(selected.lng);
          } else {
            setMeetingPoint({
              address: selected.address,
              lat: selected.lat,
              lng: selected.lng,
              name: selected.name || 'Ponto Personalizado',
            });
          }
        }}
      />
    </div>
  );
};
