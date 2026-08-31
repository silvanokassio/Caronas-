import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  Navigation,
  MapPin,
  Clock,
  Car,
  Phone,
  MessageCircle,
  Share2,
  CheckCircle2,
  ShieldCheck,
  LocateFixed,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Check,
  Radio,
  Copy
} from 'lucide-react';
import { Ride, User, TrackingPoint, PassengerParticipant } from '../types';
import { calculateOptimizedRoute } from '../lib/routeOptimization';
import { subscribeToTracking } from '../lib/firebase';
import { calculateDistanceKm } from '../lib/geo';

interface PassengerLiveTrackingModalProps {
  ride: Ride | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const PassengerLiveTrackingModal: React.FC<PassengerLiveTrackingModalProps> = ({
  ride,
  isOpen,
  onClose,
  currentUser,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const passengerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [livePoint, setLivePoint] = useState<TrackingPoint | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [quickMessageSent, setQuickMessageSent] = useState<string | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  // Identify the current passenger participant info
  const currentPassenger = ride?.acceptedPassengers?.find((p) => p.userId === currentUser?.id);
  const passengerMeetingPoint = currentPassenger?.meetingPoint || currentUser?.ponto_encontro_default || ride?.origin;

  // Calculate route plan
  const routePlan = ride ? calculateOptimizedRoute(ride) : null;

  // Real-time Firestore subscription to driver's tracking subcollection
  useEffect(() => {
    if (!isOpen || !ride?.id) return;

    const unsubscribe = subscribeToTracking(ride.id, (point) => {
      if (point) {
        setLivePoint(point);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, ride?.id]);

  // Setup Leaflet map
  useEffect(() => {
    if (!isOpen || !ride || !mapContainerRef.current) return;

    // Destroy prior map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const plan = calculateOptimizedRoute(ride);
    const latLngPoints: [number, number][] = plan.stops.map((s) => [s.location.lat, s.location.lng]);

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // High quality OpenStreetMap layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Plot Stops Markers
    plan.stops.forEach((stop, idx) => {
      const isMyPickup = stop.passenger?.userId === currentUser?.id;
      let iconColor = '#10b981'; // Green for origin
      let badgeLabel = 'A';
      let popupTitle = '📍 Saída do Motorista';

      if (stop.type === 'passenger_pickup') {
        iconColor = isMyPickup ? '#ec4899' : '#6366f1'; // Hot pink if my pickup, indigo for other
        badgeLabel = isMyPickup ? '★' : `${idx}`;
        popupTitle = isMyPickup ? '🌟 Seu Ponto de Embarque' : `🙋 Embarque: ${stop.passenger?.userName || 'Passageiro'}`;
      } else if (stop.type === 'destination') {
        iconColor = '#ef4444';
        badgeLabel = '🏁';
        popupTitle = '🏁 Destino Final';
      }

      const customIcon = L.divIcon({
        className: 'custom-passenger-stop-marker',
        html: `
          <div style="
            background-color: ${iconColor};
            color: #ffffff;
            width: ${isMyPickup ? '36px' : '30px'};
            height: ${isMyPickup ? '36px' : '30px'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: ${isMyPickup ? '14px' : '12px'};
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px ${isMyPickup ? 'rgba(236, 72, 153, 0.5)' : 'rgba(0, 0, 0, 0.3)'};
            cursor: pointer;
            ${isMyPickup ? 'animation: pulse 2s infinite;' : ''}
          ">
            ${badgeLabel}
          </div>
        `,
        iconSize: isMyPickup ? [36, 36] : [30, 30],
        iconAnchor: isMyPickup ? [18, 18] : [15, 15],
      });

      const marker = L.marker([stop.location.lat, stop.location.lng], { icon: customIcon }).addTo(map);
      if (isMyPickup) {
        passengerMarkerRef.current = marker;
      }

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 4px;">
          <strong style="color: ${iconColor}; display: block; margin-bottom: 2px;">${popupTitle}</strong>
          <p style="margin: 0; color: #334155; font-size: 11px;">${stop.subtitle}</p>
        </div>
      `);
    });

    // Draw route polyline
    const polyline = L.polyline(latLngPoints, {
      color: '#4f46e5',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    routePolylineRef.current = polyline;

    // Outer glow for route
    L.polyline(latLngPoints, {
      color: '#818cf8',
      weight: 9,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Driver Car Marker with Live Beacon
    const driverStartLat = livePoint?.latitude || ride.origin.lat;
    const driverStartLng = livePoint?.longitude || ride.origin.lng;

    const carIcon = L.divIcon({
      className: 'custom-driver-live-car',
      html: `
        <div style="
          position: relative;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background-color: #38bdf8;
            opacity: 0.4;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            background-color: #0f172a;
            color: #ffffff;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            border: 2.5px solid #38bdf8;
            box-shadow: 0 4px 14px rgba(56, 189, 248, 0.6);
            z-index: 10;
          ">
            🚗
          </div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });

    const driverMarker = L.marker([driverStartLat, driverStartLng], { icon: carIcon }).addTo(map);
    driverMarkerRef.current = driverMarker;

    // Initial bounds fit
    const bounds = L.latLngBounds(latLngPoints);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, ride]);

  // Update driver marker smoothly when livePoint changes
  useEffect(() => {
    if (!livePoint || !driverMarkerRef.current) return;

    const newLatLng: L.LatLngTuple = [livePoint.latitude, livePoint.longitude];
    driverMarkerRef.current.setLatLng(newLatLng);

    // If map is active, gently pan if car goes out of bounds
    if (mapInstanceRef.current) {
      const bounds = mapInstanceRef.current.getBounds();
      if (!bounds.contains(newLatLng)) {
        mapInstanceRef.current.panTo(newLatLng);
      }
    }
  }, [livePoint]);

  if (!isOpen || !ride) return null;

  // Calculate live distance & ETA from driver to passenger pickup
  const driverCurrentLat = livePoint?.latitude || ride.origin.lat;
  const driverCurrentLng = livePoint?.longitude || ride.origin.lng;
  const passengerLat = passengerMeetingPoint?.lat || ride.origin.lat;
  const passengerLng = passengerMeetingPoint?.lng || ride.origin.lng;

  const distanceToPassengerKm = calculateDistanceKm(
    driverCurrentLat,
    driverCurrentLng,
    passengerLat,
    passengerLng
  );

  const estimatedMinutesToPickup = livePoint?.etaMinutes !== undefined
    ? livePoint.etaMinutes
    : Math.max(1, Math.round(distanceToPassengerKm * 2.2));

  // Determine stage status
  let stageTitle = 'Motorista a Caminho';
  let stageSubtitle = `Chegando ao seu ponto em aprox. ${estimatedMinutesToPickup} min`;
  let stageColor = 'emerald';

  if (distanceToPassengerKm <= 0.3) {
    stageTitle = 'Motorista Chegando no Ponto!';
    stageSubtitle = 'O veículo está a menos de 300 metros. Prepare-se na calçada!';
    stageColor = 'amber';
  } else if (ride.status === 'concluida') {
    stageTitle = 'Viagem Concluída';
    stageSubtitle = 'Você chegou ao seu destino com sucesso.';
    stageColor = 'indigo';
  }

  const handleCenterMap = () => {
    if (!mapInstanceRef.current || !routePlan) return;
    const latLngPoints: [number, number][] = routePlan.stops.map((s) => [s.location.lat, s.location.lng]);
    const bounds = L.latLngBounds(latLngPoints);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  const handleFocusDriver = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([driverCurrentLat, driverCurrentLng], 16, { animate: true });
  };

  const handleFocusMyPickup = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([passengerLat, passengerLng], 16, { animate: true });
  };

  const handleShareTracking = () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Carona em Tempo Real com ${ride.driverName}`,
        text: `Estou acompanhando a carona de ${ride.driverName} (${ride.driverVehicle?.model || 'Veículo'} - ${ride.driverVehicle?.plate || 'BRA-2026'}).`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleSendQuickMessage = (msg: string) => {
    setQuickMessageSent(msg);
    setTimeout(() => setQuickMessageSent(null), 4000);
  };

  return (
    <div
      id="passenger-live-tracking-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-hidden"
    >
      <div className="bg-slate-900 border-0 sm:border sm:border-slate-800 rounded-none sm:rounded-3xl w-full max-w-4xl h-full sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <header className="px-3 py-2.5 sm:px-4 sm:py-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  Acompanhamento ao Vivo
                </h2>
                <span className="text-[10px] font-semibold bg-indigo-900/80 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-700/60 hidden xs:inline">
                  Streaming GPS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                Motorista: <strong className="text-slate-200">{ride.driverName}</strong> • {ride.driverVehicle?.model || 'Veículo'} ({ride.driverVehicle?.plate || 'BRA-2026'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleShareTracking}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-700"
              title="Compartilhar rota ao vivo"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
              <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Live Status HUD Bar */}
        <div className="px-3.5 py-2.5 bg-slate-800/80 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className={`w-3 h-3 rounded-full ${distanceToPassengerKm <= 0.3 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                {stageTitle}
              </span>
              <p className="text-[11px] text-slate-300">
                {stageSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-900/90 border border-slate-700 px-2.5 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400 text-[10px]">ETA:</span>
              <span className="font-bold text-white">{estimatedMinutesToPickup} min</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-700 px-2.5 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400 text-[10px]">Distância:</span>
              <span className="font-bold text-white">{distanceToPassengerKm.toFixed(1)} km</span>
            </div>
          </div>
        </div>

        {/* Map Viewport Area (High focus) */}
        <div className="relative flex-1 min-h-[260px] bg-slate-950 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Map Actions */}
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
            <button
              onClick={handleFocusDriver}
              className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
              title="Focar no Carro"
            >
              <span>🚗</span>
              <span className="hidden sm:inline">Ver Motorista</span>
            </button>

            <button
              onClick={handleFocusMyPickup}
              className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
              title="Focar no Meu Ponto de Embarque"
            >
              <span className="text-pink-400">★</span>
              <span className="hidden sm:inline">Meu Ponto</span>
            </button>

            <button
              onClick={handleCenterMap}
              className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
              title="Ver Rota Completa"
            >
              <LocateFixed className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Ajustar Mapa</span>
            </button>
          </div>
        </div>

        {/* Bottom Drawer / Info & Communications Panel */}
        <div className="bg-slate-900 border-t border-slate-800 shrink-0 max-h-[45vh] overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {/* Quick Notice message alert if sent */}
          {quickMessageSent && (
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Aviso enviado ao motorista: <strong>"{quickMessageSent}"</strong></span>
            </div>
          )}

          {/* Driver & Vehicle Details Card */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <img
                src={ride.driverAvatar}
                alt={ride.driverName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-400 shrink-0"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">{ride.driverName}</span>
                  <span className="text-[11px] text-amber-400 font-bold">★ 4.9</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono mt-0.5">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  <span>{ride.driverVehicle?.model || 'Veículo Cadastrado'}</span>
                  {ride.driverVehicle?.color && <span>({ride.driverVehicle.color})</span>}
                  <span className="bg-slate-900 text-indigo-300 px-1.5 py-0.2 rounded font-bold border border-slate-700">
                    {ride.driverVehicle?.plate || 'BRA-2026'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions with Driver */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleSendQuickMessage('Já estou no ponto de encontro aguardando!')}
                className="px-3 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Estou no Ponto</span>
              </button>

              <button
                onClick={() => handleSendQuickMessage('Chegando em 2 minutos ao local de embarque!')}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>Chegando em 2 min</span>
              </button>
            </div>
          </div>

          {/* Pickup & Destination Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl flex items-start space-x-2">
              <MapPin className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Seu Ponto de Embarque:</span>
                <span className="text-white font-medium leading-snug">{passengerMeetingPoint?.address || ride.origin.address}</span>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-xl flex items-start space-x-2">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Destino Final:</span>
                <span className="text-white font-medium leading-snug">{ride.destination.address}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
