import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X,
  Navigation,
  MapPin,
  Clock,
  Car,
  CheckCircle2,
  Phone,
  MessageCircle,
  ExternalLink,
  LocateFixed,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Leaf,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Compass,
  Bell
} from 'lucide-react';
import { Ride, User, PassengerParticipant } from '../types';
import { calculateOptimizedRoute, RouteStop } from '../lib/routeOptimization';
import { saveTrackingPoint } from '../lib/firebase';

export interface DriverNavigationModalProps {
  ride: Ride | null;
  isOpen?: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onCompleteRide?: (rideId: string) => void;
  onStartRide?: (rideId: string) => void | Promise<void>;
}

export const DriverNavigationModal: React.FC<DriverNavigationModalProps> = ({
  ride,
  isOpen = true,
  onClose,
  currentUser = null,
  onCompleteRide,
  onStartRide,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const itinerarySectionRef = useRef<HTMLDivElement | null>(null);

  // Completed passenger pickups (by userId)
  const [boardedPassengerIds, setBoardedPassengerIds] = useState<string[]>([]);
  const [activeStopIndex, setActiveStopIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [useRealGPS, setUseRealGPS] = useState<boolean>(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(38);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Reset state when a new ride is loaded
  useEffect(() => {
    if (ride) {
      setBoardedPassengerIds([]);
      setActiveStopIndex(0);
      setElapsedSeconds(0);
      setIsSimulating(true);
    }
  }, [ride?.id]);

  // Generate the optimized itinerary plan
  const routePlan = ride ? calculateOptimizedRoute(ride, boardedPassengerIds) : null;

  // Active target stop
  const currentTargetStop = routePlan?.stops.find((s, idx) => idx > 0 && !s.isCompleted) || routePlan?.stops[routePlan.stops.length - 1];

  // Setup Leaflet Map
  useEffect(() => {
    if (!isOpen || !ride || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const plan = calculateOptimizedRoute(ride, boardedPassengerIds);
    const origin = ride.origin;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false, // Cleaner mobile UI, we add custom controls if needed
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // High quality OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    const latLngPoints: [number, number][] = plan.stops.map((s) => [s.location.lat, s.location.lng]);

    // Plot Stops Markers
    plan.stops.forEach((stop, idx) => {
      let iconColor = '#10b981'; // Green for origin
      let badgeLabel = 'A';
      let popupTitle = '📍 Origem (Saída)';

      if (stop.type === 'passenger_pickup') {
        iconColor = stop.isCompleted ? '#64748b' : '#6366f1'; // Indigo or muted slate if picked up
        badgeLabel = `${idx}`;
        popupTitle = `🙋 Embarque: ${stop.passenger?.userName || 'Passageiro'}`;
      } else if (stop.type === 'destination') {
        iconColor = '#ef4444'; // Red for destination
        badgeLabel = '🏁';
        popupTitle = '🏁 Destino Final';
      }

      const customIcon = L.divIcon({
        className: 'custom-driver-marker',
        html: `
          <div style="
            background-color: ${iconColor};
            color: #ffffff;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 12px;
            border: 2.5px solid #ffffff;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
            cursor: pointer;
          ">
            ${stop.isCompleted && stop.type === 'passenger_pickup' ? '✓' : badgeLabel}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
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

    // Draw route polyline
    const polyline = L.polyline(latLngPoints, {
      color: '#4f46e5',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineRef.current = polyline;

    // Outer glow for polyline
    L.polyline(latLngPoints, {
      color: '#818cf8',
      weight: 9,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Car position marker
    const carIcon = L.divIcon({
      className: 'custom-car-marker',
      html: `
        <div style="
          background-color: #0f172a;
          color: #38bdf8;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid #38bdf8;
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.7);
        ">
          🚗
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const carMarker = L.marker([origin.lat, origin.lng], { icon: carIcon }).addTo(map);
    carMarkerRef.current = carMarker;

    // Fit map view
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
  }, [isOpen, ride, boardedPassengerIds]);

  // Real GPS tracking listener
  useEffect(() => {
    if (!useRealGPS || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoordinates(coords);
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          setCurrentSpeed(Math.round(pos.coords.speed * 3.6));
        }

        if (carMarkerRef.current) {
          carMarkerRef.current.setLatLng([coords.lat, coords.lng]);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([coords.lat, coords.lng]);
        }

        // Save tracking to Firestore
        if (ride) {
          saveTrackingPoint(ride.id, {
            rideId: ride.id,
            latitude: coords.lat,
            longitude: coords.lng,
            speedKmH: Math.round(pos.coords.speed ? pos.coords.speed * 3.6 : 35),
            heading: Math.round(pos.coords.heading || 0),
            progressPercent: 50,
            nextStopLabel: currentTargetStop?.subtitle || 'Destino',
            etaMinutes: currentTargetStop?.estimatedMinutesFromPrevious || 10,
            timestamp: new Date().toISOString(),
            currentStepIndex: activeStopIndex,
          }).catch(() => {});
        }
      },
      (err) => {
        console.warn('Real GPS watch error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [useRealGPS, ride, currentTargetStop, activeStopIndex]);

  // Timer counter & Simulation progression along route
  useEffect(() => {
    if (!isOpen || !ride || !routePlan) return;

    if (!isSimulating || useRealGPS) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const nextSec = prev + 1;
        
        // Progress percentage based on trip (e.g. ~45 seconds for a full demo trip)
        const totalDurationSec = Math.max(30, (ride.estimatedDurationMin || 15) * 3);
        const progressPct = Math.min(100, (nextSec / totalDurationSec) * 100);
        
        // Interpolate position along stops
        const stops = routePlan.stops;
        if (stops.length >= 2) {
          const totalSegments = stops.length - 1;
          const segmentIndex = Math.min(Math.floor((progressPct / 100) * totalSegments), totalSegments - 1);
          const segmentProgress = ((progressPct / 100) * totalSegments) - segmentIndex;

          const p1 = stops[segmentIndex].location;
          const p2 = stops[segmentIndex + 1].location;

          const currentLat = p1.lat + (p2.lat - p1.lat) * segmentProgress;
          const currentLng = p1.lng + (p2.lng - p1.lng) * segmentProgress;

          // Update car marker on map
          if (carMarkerRef.current) {
            carMarkerRef.current.setLatLng([currentLat, currentLng]);
          }

          // Auto-mark pickups as boarded if reached
          if (stops[segmentIndex + 1].type === 'passenger_pickup' && stops[segmentIndex + 1].passenger && segmentProgress > 0.85) {
            const passId = stops[segmentIndex + 1].passenger?.userId;
            if (passId && !boardedPassengerIds.includes(passId)) {
              setBoardedPassengerIds((prevIds) => [...prevIds, passId]);
            }
          }

          // Update active stop index
          setActiveStopIndex(segmentIndex + 1);

          // Save tracking point to Firestore subcollection periodically
          if (nextSec % 2 === 0 || nextSec === 1) {
            const remainingMins = Math.max(1, Math.round(ride.estimatedDurationMin * (1 - progressPct / 100)));
            saveTrackingPoint(ride.id, {
              rideId: ride.id,
              latitude: Number(currentLat.toFixed(5)),
              longitude: Number(currentLng.toFixed(5)),
              speedKmH: progressPct < 100 ? 42 : 0,
              heading: 45,
              progressPercent: Math.round(progressPct),
              nextStopLabel: stops[segmentIndex + 1].subtitle || 'Destino',
              etaMinutes: remainingMins,
              timestamp: new Date().toISOString(),
              currentStepIndex: segmentIndex + 1,
            }).catch(() => {});
          }
        }

        return nextSec;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isSimulating, useRealGPS, ride, routePlan, boardedPassengerIds]);

  if (!isOpen || !ride || !routePlan) return null;

  const isDriver = currentUser ? ride.driverId === currentUser.id : true;
  const allPickupsCompleted = routePlan.passengerCount === 0 || boardedPassengerIds.length >= routePlan.passengerCount;

  const handleToggleBoarding = (passengerId: string) => {
    setBoardedPassengerIds((prev) => {
      if (prev.includes(passengerId)) {
        return prev.filter((id) => id !== passengerId);
      } else {
        return [...prev, passengerId];
      }
    });
  };

  const handleCenterMap = () => {
    if (!mapInstanceRef.current || !routePlan) return;
    const latLngPoints: [number, number][] = routePlan.stops.map((s) => [s.location.lat, s.location.lng]);
    const bounds = L.latLngBounds(latLngPoints);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  const scrollToItinerary = () => {
    if (itinerarySectionRef.current) {
      itinerarySectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="driver-navigation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-hidden"
    >
      <div className="bg-slate-900 border-0 sm:border sm:border-slate-800 rounded-none sm:rounded-3xl w-full max-w-5xl h-full sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Compact Mobile-First Header */}
        <header className="px-3 py-2.5 sm:px-4 sm:py-3 bg-slate-900/95 border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  Navegação em Rota
                </h2>
                <span className="text-[11px] text-slate-400 hidden xs:inline">• {ride.driverVehicle?.model || 'Veículo'}</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {ride.destination?.name || ride.destination?.address?.split(',')[0] || 'Destino'}
              </p>
            </div>
          </div>

          {/* Clean HUD Pill Counters */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="bg-slate-800/90 border border-slate-700/80 px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-mono font-medium text-slate-200">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>{formatElapsed(elapsedSeconds)}</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-mono font-medium text-slate-200">
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>{routePlan.totalDistanceKm}km</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-mono font-medium text-slate-200">
              <Users className="w-3 h-3 text-amber-400" />
              <span>{boardedPassengerIds.length}/{routePlan.passengerCount}</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 ml-1"
              title="Fechar Navegação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Banner de Viagem Agendada: Alerta para Iniciar Trajeto e Notificar Passageiros */}
        {ride.status === 'agendada' && onStartRide && (
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border-b border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 z-20">
            <div className="flex items-center space-x-2 text-xs text-emerald-200">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span>
                Esta viagem está <strong>agendada</strong>. Ao iniciar, os passageiros recebem aviso em tempo real por <strong>e-mail</strong> e <strong>notificação push</strong>.
              </span>
            </div>
            <button
              id="btn-start-ride-navigation-banner"
              type="button"
              onClick={async () => {
                if (onStartRide) {
                  await onStartRide(ride.id);
                }
              }}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30 transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Iniciar Viagem Agora</span>
            </button>
          </div>
        )}

        {/* Scrollable Container with Map in High Focus + Route Drawer Below */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-slate-950">
          
          {/* MAP SECTION - High Visual Priority on Mobile */}
          <div className="relative w-full h-[54vh] sm:h-[58vh] lg:h-[62vh] shrink-0 bg-slate-950 flex flex-col">
            
            {/* Minimalist Turn-by-Turn Banner at top of map */}
            {currentTargetStop && (
              <div className="absolute top-2.5 left-2.5 right-2.5 z-400 bg-slate-900/92 backdrop-blur-md border border-indigo-500/40 rounded-xl p-2.5 sm:p-3 shadow-lg flex items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold shadow-sm">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">
                        {currentTargetStop.type === 'passenger_pickup' ? 'Próxima Parada' : 'Destino Final'}
                      </span>
                      {currentTargetStop.passenger && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-medium truncate">
                          {currentTargetStop.passenger.userName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-white truncate">
                      {currentTargetStop.subtitle || currentTargetStop.title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-400 block leading-tight">
                      ~{currentTargetStop.distanceFromPreviousKm} km
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      ~{currentTargetStop.estimatedMinutesFromPrevious} min
                    </span>
                  </div>

                  {currentTargetStop.passenger && (
                    <button
                      onClick={() => handleToggleBoarding(currentTargetStop.passenger!.userId)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 ${
                        currentTargetStop.isCompleted
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{currentTargetStop.isCompleted ? 'A bordo' : 'Embarcar'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Leaflet Map Canvas */}
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Floating Action Controls on Bottom of Map */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-400 flex items-center justify-between gap-2 pointer-events-none">
              
              {/* Center Map & GPS buttons */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={handleCenterMap}
                  className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white text-[11px] font-medium rounded-xl border border-slate-700 shadow-md backdrop-blur-sm flex items-center gap-1.5 transition cursor-pointer"
                  title="Centralizar mapa na rota"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden xs:inline">Centralizar</span>
                </button>

                <button
                  onClick={() => setUseRealGPS((prev) => !prev)}
                  className={`px-2.5 py-1.5 text-[11px] font-medium rounded-xl border shadow-md backdrop-blur-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    useRealGPS
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                  title="Ativar rastreamento GPS real do celular"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>{useRealGPS ? 'GPS Ativo' : 'Usar GPS'}</span>
                </button>
              </div>

              {/* External GPS buttons & Scroll down hint */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <a
                  href={routePlan.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer"
                  title="Abrir no app do Google Maps com paradas"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>

                <a
                  href={routePlan.wazeNextStopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer"
                  title="Navegar com o Waze"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Waze</span>
                </a>

                <button
                  onClick={scrollToItinerary}
                  className="px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-xl border border-slate-700 shadow-md flex items-center gap-1 transition cursor-pointer"
                  title="Ver itinerário e caroneiros"
                >
                  <span>Paradas</span>
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                </button>
              </div>
            </div>
          </div>

          {/* ROUTE ITINERARY & PASSENGER ACTIONS (SCROLLABLE DRAWER) */}
          <div
            ref={itinerarySectionRef}
            className="flex-1 bg-slate-900 border-t border-slate-800 p-3 sm:p-4 md:p-5 flex flex-col space-y-3"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Itinerário Sequencial ({routePlan.stops.length} Paradas)
                </h3>
              </div>
              <span className="text-[11px] font-mono font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded-lg">
                Total ~{routePlan.totalEstimatedMinutes} min
              </span>
            </div>

            {/* List of Stops */}
            <div className="space-y-2.5">
              {routePlan.stops.map((stop, idx) => {
                const isOrigin = stop.type === 'origin';
                const isDest = stop.type === 'destination';
                const isPickup = stop.type === 'passenger_pickup';
                const isCurrentTarget = currentTargetStop?.id === stop.id;

                return (
                  <div
                    key={stop.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrentTarget
                        ? 'bg-indigo-950/70 border-indigo-500/80 ring-1 ring-indigo-500/30 shadow-md'
                        : stop.isCompleted
                        ? 'bg-slate-850/60 border-slate-800 opacity-75'
                        : 'bg-slate-850 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start space-x-2.5 min-w-0">
                        {/* Stop Number Badge */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isOrigin
                              ? 'bg-emerald-500 text-white'
                              : isDest
                              ? 'bg-rose-500 text-white'
                              : stop.isCompleted
                              ? 'bg-slate-600 text-slate-200'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {isOrigin ? 'A' : isDest ? 'B' : stop.isCompleted ? '✓' : idx}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                            <span className="text-xs font-bold text-white truncate">{stop.title}</span>
                            {isOrigin && (
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] rounded font-semibold">
                                Ponto de Saída
                              </span>
                            )}
                            {isDest && (
                              <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 text-[9px] rounded font-semibold">
                                Destino
                              </span>
                            )}
                            {isPickup && stop.isCompleted && (
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-semibold rounded flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> A bordo
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                            {stop.subtitle}
                          </p>

                          {/* Distance & ETA from previous */}
                          {stop.distanceFromPreviousKm > 0 && (
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-1">
                              <span>+{stop.distanceFromPreviousKm} km</span>
                              <span>•</span>
                              <span>~{stop.estimatedMinutesFromPrevious} min de trajeto</span>
                            </div>
                          )}

                          {/* Passenger quick actions */}
                          {isPickup && stop.passenger && (
                            <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center space-x-2">
                                <img
                                  src={stop.passenger.userAvatar}
                                  alt={stop.passenger.userName}
                                  className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-600"
                                />
                                <span className="text-xs font-medium text-slate-200">{stop.passenger.userName}</span>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(
                                    `Olá ${stop.passenger.userName}! Sou ${ride.driverName}, seu motorista na carona compartilhada. Estou a caminho do ponto de encontro "${stop.location.address}".`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 min-h-[32px] bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-[11px] font-semibold rounded-lg border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer"
                                  title="Avisar passageiro pelo WhatsApp"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </a>

                                <button
                                  onClick={() => handleToggleBoarding(stop.passenger!.userId)}
                                  className={`px-3 py-1 min-h-[32px] text-[11px] font-bold rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                                    stop.isCompleted
                                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{stop.isCompleted ? 'Desfazer' : 'Confirmar Embarque'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions & Complete Ride Button */}
            <div className="pt-3 pb-1 space-y-2 mt-auto">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center space-x-1">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Economia de CO₂: <strong className="text-emerald-400 font-mono">{(ride.estimatedCarbonSavingKg || 2.4).toFixed(1)} kg</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>GPS Criptografado</span>
                </div>
              </div>

              <button
                id="btn-complete-ride-navigation"
                onClick={() => {
                  if (onCompleteRide) {
                    onCompleteRide(ride.id);
                  }
                  onClose();
                }}
                className="w-full py-3.5 px-4 min-h-[48px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/60 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Chegamos ao Destino! Concluir Viagem</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

