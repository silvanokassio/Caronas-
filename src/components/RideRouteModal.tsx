import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  MapPin,
  Navigation,
  Clock,
  Calendar,
  Users,
  Car,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Share2,
  Lock,
  HandMetal,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { Ride, User } from '../types';
import { calculateDistanceKm } from '../lib/geo';
import { calculateOptimizedRoute } from '../lib/routeOptimization';

interface RideRouteModalProps {
  ride: Ride | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onJoinRide?: (rideId: string, autoAccept: boolean) => void;
  onOfferForRequest?: (ride: Ride) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const RideRouteModal: React.FC<RideRouteModalProps> = ({
  ride,
  isOpen,
  onClose,
  currentUser,
  onJoinRide,
  onOfferForRequest,
  onOpenAuth,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'route' | 'live'>('route');

  // Format date helper
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Setup Leaflet map when modal opens or ride changes
  useEffect(() => {
    if (!isOpen || !ride || !mapContainerRef.current) return;

    // Destroy existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const plan = calculateOptimizedRoute(ride);
    const latLngPoints: [number, number][] = plan.stops.map((s) => [s.location.lat, s.location.lng]);

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // Tile Layer - High quality OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Plot Stops Markers
    plan.stops.forEach((stop, idx) => {
      let iconColor = '#10b981';
      let badgeLabel = 'A';
      let popupTitle = '📍 Origem (Embarque)';

      if (stop.type === 'passenger_pickup') {
        iconColor = '#6366f1';
        badgeLabel = `${idx}`;
        popupTitle = `🙋 Embarque: ${stop.passenger?.userName || 'Passageiro'}`;
      } else if (stop.type === 'destination') {
        iconColor = '#ef4444';
        badgeLabel = 'B';
        popupTitle = '🏁 Destino Final';
      }

      const customIcon = L.divIcon({
        className: 'custom-route-marker',
        html: `
          <div style="
            background-color: ${iconColor};
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 13px;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            cursor: pointer;
          ">
            ${badgeLabel}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([stop.location.lat, stop.location.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 4px;">
          <strong style="color: ${iconColor}; display: block; margin-bottom: 2px;">${popupTitle}</strong>
          <p style="margin: 0; color: #334155; font-size: 11px;">${stop.subtitle}</p>
          ${stop.distanceFromPreviousKm > 0 ? `<span style="font-size: 10px; color: #64748b; margin-top: 4px; display: block;">+${stop.distanceFromPreviousKm} km (~${stop.estimatedMinutesFromPrevious} min)</span>` : ''}
        </div>
      `);
    });

    // Polyline Route Connecting all Stops
    L.polyline(latLngPoints, {
      color: '#4f46e5',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '1, 0',
    }).addTo(map);

    // Decorative shadow line
    L.polyline(latLngPoints, {
      color: '#818cf8',
      weight: 9,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Fit bounds smoothly to contain all points
    const bounds = L.latLngBounds(latLngPoints);

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15,
    });

    // Invalidate size after modal render animation completes
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 15,
        });
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, ride]);

  if (!isOpen || !ride) return null;

  const isOffer = (ride.rideType || 'offer') === 'offer';
  const isDriver = currentUser ? ride.driverId === currentUser.id : false;
  const isAccepted = currentUser ? ride.acceptedPassengers?.some((p) => p.userId === currentUser.id) : false;
  const isPending = currentUser ? ride.pendingRequests?.some((p) => p.userId === currentUser.id) : false;
  const isGroupMember = currentUser ? (ride.visibility === 'group' && ride.targetGroupId && currentUser.groups.includes(ride.targetGroupId)) : false;
  const isFull = ride.occupiedSeats >= ride.totalSeats;

  // Calculate distance
  const straightDistance = calculateDistanceKm(
    ride.origin?.lat ?? 0,
    ride.origin?.lng ?? 0,
    ride.destination?.lat ?? 0,
    ride.destination?.lng ?? 0
  );
  // Estimate realistic driving distance (typically ~1.25x straight distance)
  const drivingDistance = straightDistance > 0 ? (straightDistance * 1.22).toFixed(1) : '0';

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${ride.origin?.lat ?? 0},${ride.origin?.lng ?? 0}&destination=${ride.destination?.lat ?? 0},${ride.destination?.lng ?? 0}&travelmode=driving`;
  const wazeUrl = `https://waze.com/ul?ll=${ride.destination?.lat ?? 0},${ride.destination?.lng ?? 0}&navigate=yes`;

  const driverRatingVal = (ride as any).driverRating ?? (ride as any).rating ?? 5.0;
  const ridePriceVal = ride.price ?? 0;

  return (
    <div
      id="ride-route-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isOffer ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Trajeto da Carona no Mapa
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${isOffer ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {isOffer ? 'Oferta de Carona' : 'Pedido de Carona'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visualização geoespacial com pontos de embarque, rota e navegação GPS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Driver/Requester Profile Brief */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 gap-3">
            <div className="flex items-center space-x-3">
              <img
                src={ride.driverAvatar}
                alt={ride.driverName}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-white shrink-0 shadow-2xs"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 text-sm">{ride.driverName}</span>
                  <span className="text-xs text-amber-500 font-bold">★ {driverRatingVal.toFixed(1)}</span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                  {isOffer ? (
                    <>
                      <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-medium text-slate-700">{ride.driverVehicle?.model || 'Veículo Registrado'}</span>
                      {ride.driverVehicle?.plate && (
                        <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                          {ride.driverVehicle.plate}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-600">Passageiro Solicitante</span>
                  )}
                </div>
              </div>
            </div>

            {/* Ride Price / Solidarity */}
            <div className="text-left sm:text-right">
              {isOffer ? (
                <>
                  <div className="text-base font-display font-black text-emerald-600">
                    {ridePriceVal === 0 ? 'Gratuito / Solidário' : `R$ ${ridePriceVal.toFixed(2)}`}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {(ride.totalSeats ?? 4) - (ride.occupiedSeats ?? 0)} vagas restantes
                  </span>
                </>
              ) : (
                <>
                  <div className="text-sm font-display font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 inline-block">
                    A definir pela oferta acolhedora
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {ride.proposals && ride.proposals.length > 0 
                      ? `${ride.proposals.length} proposta(s) de acolhimento recebida(s)` 
                      : 'O motorista que acolher definirá o valor de rateio'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Description Headline if provided */}
          {ride.description && (
            <div className="px-3.5 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center space-x-2 text-xs font-bold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{ride.description}</span>
            </div>
          )}

          {/* Map Container */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
            <div
              ref={mapContainerRef}
              className="w-full h-64 sm:h-72 md:h-80 z-0"
            />

            {/* Map Floating Route Legend */}
            <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-2 shadow-md text-[11px] space-y-1 font-medium">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white font-bold text-[9px] flex items-center justify-center">A</span>
                <span className="text-slate-700">Origem (Embarque)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center">B</span>
                <span className="text-slate-700">Destino Final</span>
              </div>
            </div>

            {/* Recenter button */}
            <button
              onClick={() => {
                if (mapInstanceRef.current && ride) {
                  const bounds = L.latLngBounds([
                    [ride.origin.lat, ride.origin.lng],
                    [ride.destination.lat, ride.destination.lng],
                  ]);
                  mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                }
              }}
              className="absolute bottom-3 right-3 z-10 bg-white/90 hover:bg-white text-slate-700 p-2 rounded-xl border border-slate-200 shadow-md transition cursor-pointer flex items-center space-x-1 text-xs font-bold"
              title="Ajustar enquadramento"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Ajustar Zoom</span>
            </button>
          </div>

          {/* Route Details Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            {/* Origin & Destination Steps */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    A
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Local de Partida (Embarque)
                    </span>
                    <p className="text-xs font-semibold text-slate-900 leading-snug break-words">
                      {ride.origin.address}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(ride.origin.address, 'origin')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition shrink-0"
                  title="Copiar endereço de origem"
                >
                  {copiedField === 'origin' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="border-l-2 border-dashed border-indigo-200 ml-2.5 h-4 my-0.5" />

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    B
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                      Destino Final
                    </span>
                    <p className="text-xs font-semibold text-slate-900 leading-snug break-words">
                      {ride.destination.address}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(ride.destination.address, 'dest')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition shrink-0"
                  title="Copiar endereço de destino"
                >
                  {copiedField === 'dest' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Route Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-200 text-xs">
              <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  <span>Data</span>
                </span>
                <span className="font-bold text-slate-900 block truncate">
                  {formatFriendlyDate(ride.departureDate)}
                </span>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  <span>Horário</span>
                </span>
                <span className="font-bold text-slate-900 block">
                  {ride.departureTime}
                </span>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-indigo-500" />
                  <span>Distância</span>
                </span>
                <span className="font-bold text-slate-900 block">
                  ~{drivingDistance} km
                </span>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  <span>Duração Estimada</span>
                </span>
                <span className="font-bold text-slate-900 block">
                  ~{ride.estimatedDurationMin || 25} min
                </span>
              </div>
            </div>

            {/* Notes if available */}
            {ride.notes && (
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-700 border border-slate-200/80">
                <span className="font-bold text-slate-900 block text-[11px] mb-0.5">Observações do Motorista:</span>
                <p className="italic">"{ride.notes}"</p>
              </div>
            )}
          </div>

          {/* External GPS App Openers */}
          <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">
                Navegação Externa com Aplicativos GPS:
              </span>
              <span className="text-[10px] text-indigo-600 font-medium">Rotas em tempo real</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Abrir Rota no Google Maps</span>
              </a>

              <a
                href={wazeUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-600" />
                <span>Navegar com o Waze</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
          >
            Fechar Mapa
          </button>

          {!currentUser ? (
            <button
              onClick={() => {
                onClose();
                onOpenAuth?.('login');
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>Entrar para Solicitar Carona</span>
            </button>
          ) : isDriver ? (
            <span className="text-xs text-slate-500 font-bold">
              Sua publicação ({isOffer ? 'Motorista' : 'Solicitante'})
            </span>
          ) : isOffer ? (
            <div>
              {isAccepted ? (
                <span className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Vaga Confirmada
                </span>
              ) : isPending ? (
                <span className="px-4 py-2 bg-amber-50 text-amber-800 text-xs font-bold rounded-xl border border-amber-200">
                  Solicitação Enviada
                </span>
              ) : isFull ? (
                <span className="px-4 py-2 bg-slate-100 text-slate-500 text-xs font-medium rounded-xl">
                  Vagas Esgotadas
                </span>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    onJoinRide?.(ride.id, isGroupMember);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>{isGroupMember ? 'Entrar na Carona (Grupo)' : 'Solicitar Vaga nesta Rota'}</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOfferForRequest?.(ride);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Car className="w-4 h-4" />
              <span>Acolher Pedido de Carona</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
