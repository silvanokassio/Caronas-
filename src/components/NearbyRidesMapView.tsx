import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Car,
  MapPin,
  LocateFixed,
  Users,
  Clock,
  Navigation,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Globe,
  Layers,
  Info,
  Check,
  Compass
} from 'lucide-react';
import { Ride, User, Group } from '../types';
import { isRideInPast, canJoinRide } from '../lib/dateUtils';

interface NearbyRidesMapViewProps {
  rides: (Ride & { distanceFromUser: number })[];
  userLocation: {
    lat: number;
    lng: number;
    label: string;
    source: 'gps' | 'residential';
  };
  currentUser: User | null;
  groups: Group[];
  maxRadiusKm: number;
  onJoinRide: (rideId: string, autoAccept: boolean) => void;
  onOfferForRequest: (ride: Ride) => void;
  onSelectTracking: (rideId: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const NearbyRidesMapView: React.FC<NearbyRidesMapViewProps> = ({
  rides,
  userLocation,
  currentUser,
  groups,
  maxRadiusKm,
  onJoinRide,
  onOfferForRequest,
  onSelectTracking,
  onOpenAuth,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  const uniqueRides = useMemo(() => {
    const seen = new Set<string>();
    return rides.filter((r) => {
      if (!r || !r.id || seen.has(r.id)) return false;
      if (isRideInPast(r)) return false;
      seen.add(r.id);
      return true;
    });
  }, [rides]);

  const [selectedRideId, setSelectedRideId] = useState<string | null>(
    uniqueRides.length > 0 ? uniqueRides[0].id : null
  );

  const selectedRide = uniqueRides.find((r) => r.id === selectedRideId) || (uniqueRides.length > 0 ? uniqueRides[0] : null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialLat = userLocation.lat || -23.5592;
    const initialLng = userLocation.lng || -46.7314;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: false,
    });

    // Add Zoom control in top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Center map on user location when userLocation changes
  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && userLocation.lat && userLocation.lng) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    }
  };

  // Update Markers, Catchment Circle & Route Polyline when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous markers & overlays
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const markersGroup = markersLayerRef.current || L.layerGroup().addTo(map);

    // 1. Add User Reference Location Marker (Blue Pulsing Pin)
    const userIconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 bg-indigo-500 rounded-full animate-ping opacity-40"></div>
        <div class="relative w-8 h-8 bg-indigo-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
    `;

    const userDivIcon = L.divIcon({
      className: 'user-marker-icon',
      html: userIconHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userDivIcon })
      .bindPopup(`
        <div class="p-2 text-xs font-sans">
          <strong class="text-indigo-900 block font-bold">📍 Sua Localização (${userLocation.source === 'gps' ? 'GPS Atual' : 'Residência'})</strong>
          <span class="text-slate-600">${userLocation.label}</span>
        </div>
      `);
    markersGroup.addLayer(userMarker);

    // 2. Draw Catchment Radius Circle if maxRadiusKm is set
    if (maxRadiusKm > 0) {
      const radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: maxRadiusKm * 1000,
        color: '#4f46e5',
        fillColor: '#6366f1',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '4, 6',
      }).addTo(map);
      radiusCircleRef.current = radiusCircle;
    }

    // 3. Add Ride & Request Departure Pins (Local de Partida de quem Oferece ou Pede)
    uniqueRides.forEach((ride) => {
      const isOffer = (ride.rideType || 'offer') === 'offer';
      const isSelected = selectedRideId === ride.id;

      // Color scheme: Emerald for Offers, Indigo for Requests
      const bgClass = isOffer ? 'bg-emerald-600' : 'bg-indigo-600';
      const badgeText = isOffer ? 'Oferece' : 'Pede';
      const priceOrType = isOffer ? `R$ ${(ride.price ?? 0).toFixed(2)}` : 'A definir na oferta';
      const ringClass = isSelected ? 'ring-4 ring-amber-400 scale-110 shadow-lg' : 'ring-2 ring-white hover:scale-105 shadow-md';

      const pinHtml = `
        <div class="group cursor-pointer transition-all duration-200 ${ringClass} ${bgClass} text-white px-2.5 py-1 rounded-full flex items-center space-x-1.5 border border-white font-sans">
          <img src="${ride.driverAvatar}" alt="${ride.driverName}" class="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/80" />
          <div class="flex flex-col text-left leading-none">
            <span class="text-[9px] uppercase font-bold tracking-wider opacity-90">${badgeText}</span>
            <span class="text-[11px] font-extrabold font-mono leading-tight whitespace-nowrap">${isOffer ? `R$${(ride.price ?? 0).toFixed(0)}` : 'Acolher'}</span>
          </div>
        </div>
      `;

      const customDivIcon = L.divIcon({
        className: 'custom-ride-departure-pin',
        html: pinHtml,
        iconSize: [85, 32],
        iconAnchor: [42, 16],
      });

      const marker = L.marker([ride.origin.lat, ride.origin.lng], {
        icon: customDivIcon,
        title: `Partida de ${ride.driverName}: ${ride.origin.address}`,
      });

      // Rich popup showing departure and ride details directly when clicking the icon
      const popupHtml = `
        <div class="font-sans p-1 max-w-[260px] text-slate-800">
          <div class="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <img src="${ride.driverAvatar}" class="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200" />
            <div class="truncate">
              <div class="text-xs font-bold text-slate-900 truncate">${ride.driverName}</div>
              <span class="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded ${
                isOffer ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
              }">
                ${isOffer ? '🚗 Oferece Carona' : '🙋‍♂️ Pede Carona'}
              </span>
            </div>
          </div>

          <div class="py-2 space-y-1.5 text-[11px]">
            <div>
              <span class="text-slate-400 font-bold block text-[9px] uppercase">📍 Ponto de Partida</span>
              <p class="font-semibold text-slate-900 leading-tight">${ride.origin.address}</p>
              <span class="text-[10px] text-indigo-600 font-medium font-mono">A ${(ride.distanceFromUser ?? 0).toFixed(1)} km de você</span>
            </div>

            <div>
              <span class="text-slate-400 font-bold block text-[9px] uppercase">🏁 Destino</span>
              <p class="font-medium text-slate-700 leading-tight">${ride.destinationAlias || ride.destination.alias || ride.destination.name || ride.destination.address}</p>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
              <div>
                <span class="text-slate-400 block text-[9px]">Horário</span>
                <span class="font-bold text-slate-900">${ride.departureTime}</span>
              </div>
              <div class="text-right">
                <span class="text-slate-400 block text-[9px]">${isOffer ? 'Valor / Vaga' : 'Tipo'}</span>
                <span class="font-bold font-mono ${isOffer ? 'text-emerald-700' : 'text-indigo-700'}">${priceOrType}</span>
              </div>
            </div>
          </div>

          <div class="pt-1">
            <button id="btn-popup-select-${ride.id}" class="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs text-center">
              Ver Detalhes e Ações
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'custom-leaflet-popup',
        closeButton: true,
        autoPan: true,
      });

      marker.on('click', () => {
        setSelectedRideId(ride.id);
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-popup-select-${ride.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedRideId(ride.id);
            const detailElement = document.getElementById('selected-ride-detail-card');
            if (detailElement) {
              detailElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          };
        }
      });

      markersGroup.addLayer(marker);
    });

    // 4. Draw Selected Route & Destination Marker
    if (selectedRide) {
      // Line from origin to destination
      const polyline = L.polyline(
        [
          [selectedRide.origin.lat, selectedRide.origin.lng],
          [selectedRide.destination.lat, selectedRide.destination.lng],
        ],
        {
          color: (selectedRide.rideType || 'offer') === 'offer' ? '#059669' : '#4f46e5',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 8',
        }
      ).addTo(map);
      routeLayerRef.current = polyline;

      // Add Destination Pin
      const destHtml = `
        <div class="w-6 h-6 bg-rose-600 border-2 border-white rounded-full shadow-md flex items-center justify-center text-white text-[10px] font-bold">
          🏁
        </div>
      `;
      const destDivIcon = L.divIcon({
        className: 'dest-pin',
        html: destHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const destMarker = L.marker([selectedRide.destination.lat, selectedRide.destination.lng], {
        icon: destDivIcon,
      }).bindPopup(`
        <div class="p-1 text-xs">
          <strong class="text-rose-900 block font-bold">Destino:</strong>
          <span class="font-semibold block">${selectedRide.destinationAlias || selectedRide.destination.alias || selectedRide.destination.name || selectedRide.destination.address}</span>
          ${(selectedRide.destinationAlias || selectedRide.destination.alias || selectedRide.destination.name) ? `<span class="text-[10px] text-slate-500 block">${selectedRide.destination.address}</span>` : ''}
        </div>
      `);
      markersGroup.addLayer(destMarker);
    }
  }, [rides, selectedRideId, userLocation, maxRadiusKm]);

  // When selectedRide changes, smoothly pan map
  useEffect(() => {
    if (selectedRide && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([selectedRide.origin.lat, selectedRide.origin.lng], {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedRideId]);

  return (
    <div className="space-y-4">
      {/* Map Card Container */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs relative">
        {/* Top Floating Map Controls */}
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 flex-wrap max-w-[85%]">
          {/* Quick Counter Badge */}
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center space-x-2 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-slate-800">
              {rides.length} {rides.length === 1 ? 'caso no raio' : 'casos no raio'}
            </span>
          </div>

          {/* Legend Chips */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-sm border border-slate-200/80 text-[11px] font-medium text-slate-700">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Ofertas
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span> Pedidos
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 border border-white inline-block"></span> Sua Posição
            </span>
          </div>
        </div>

        {/* Center on Me Action Button */}
        <button
          onClick={handleCenterOnUser}
          className="absolute top-4 right-14 z-[1000] bg-white/95 backdrop-blur-md hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-2xl shadow-sm border border-slate-200/80 text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
          title="Centralizar na minha localização"
        >
          <LocateFixed className="w-4 h-4 text-indigo-600" />
          <span className="hidden md:inline">Centralizar em Mim</span>
        </button>

        {/* Leaflet Map Stage */}
        <div
          ref={mapContainerRef}
          className="w-full h-[380px] sm:h-[460px] bg-slate-100 z-10"
        />

        {/* Floating Quick Bar for Cases Selection */}
        {uniqueRides.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 overflow-x-auto flex items-center space-x-2.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap pl-1">
              Selecione no mapa:
            </span>
            {uniqueRides.map((ride) => {
              const isOffer = (ride.rideType || 'offer') === 'offer';
              const isSelected = selectedRideId === ride.id;

              return (
                <button
                  key={ride.id}
                  onClick={() => setSelectedRideId(ride.id)}
                  className={`px-3 py-2 rounded-2xl border text-xs font-medium shrink-0 flex items-center space-x-2 transition cursor-pointer active:scale-95 ${
                    isSelected
                      ? isOffer
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={ride.driverAvatar}
                    alt={ride.driverName}
                    className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-white"
                  />
                  <span className="font-bold truncate max-w-[100px]">{ride.driverName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {(ride.distanceFromUser ?? 0).toFixed(1)} km
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Ride Detail Card (Interactive inspection on map view) */}
      {selectedRide && (
        <div
          id="selected-ride-detail-card"
          className="bg-white border-2 border-indigo-500/40 ring-4 ring-indigo-500/10 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 transition scroll-mt-20"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            {/* User Details */}
            <div className="flex items-center space-x-3.5">
              <img
                src={selectedRide.driverAvatar}
                alt={selectedRide.driverName}
                className="w-13 h-13 rounded-full object-cover ring-2 ring-indigo-100 shrink-0"
              />
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 text-base">{selectedRide.driverName}</h4>
                  {(selectedRide.rideType || 'offer') === 'offer' ? (
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
                      🚗 Oferece Carona
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg">
                      🙋‍♂️ Pede Carona
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {(selectedRide.rideType || 'offer') === 'offer'
                    ? selectedRide.driverVehicle?.model || 'Veículo Registrado'
                    : 'Passageiro Solicitante'}
                </p>
              </div>
            </div>

            {/* Proximity & Cost */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5">
              <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                (selectedRide.distanceFromUser ?? 0) <= 3
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : (selectedRide.distanceFromUser ?? 0) <= 7
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                <LocateFixed className="w-3.5 h-3.5" />
                <span>A {(selectedRide.distanceFromUser ?? 0).toFixed(1)} km de você</span>
              </span>

              {(selectedRide.rideType || 'offer') === 'offer' ? (
                <div className="text-base font-bold text-slate-900 font-mono">
                  R$ {(selectedRide.price ?? 0).toFixed(2)} <span className="text-xs text-slate-500 font-sans">/ vaga</span>
                </div>
              ) : (
                <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  A definir pela oferta
                </span>
              )}
            </div>
          </div>

          {/* Route path points */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-500 font-semibold block text-[11px]">
                  Local de Partida de {(selectedRide.rideType || 'offer') === 'offer' ? 'quem Oferece' : 'quem Pede'}:
                </span>
                <p className="text-slate-900 font-bold">{selectedRide.origin.address}</p>
              </div>
            </div>

            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-slate-500 font-semibold block text-[11px]">Destino Final da Viagem:</span>
                <p className="text-slate-900 font-bold break-words">
                  {selectedRide.destinationAlias || selectedRide.destination.alias || selectedRide.destination.name || selectedRide.destination.address}
                </p>
                {(selectedRide.destinationAlias || selectedRide.destination.alias || selectedRide.destination.name) && (
                  <span className="text-[11px] text-slate-500 block truncate" title={selectedRide.destination.address}>
                    {selectedRide.destination.address}
                  </span>
                )}
              </div>
            </div>

            {selectedRide.requesterNote && (
              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 italic">
                "{selectedRide.requesterNote}"
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 font-mono text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Data</span>
                {selectedRide.departureDate}
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Horário</span>
                <span className="font-bold text-slate-900">{selectedRide.departureTime}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                  {(selectedRide.rideType || 'offer') === 'offer' ? 'Vagas Livres' : 'Vagas Pedidas'}
                </span>
                <span className="font-bold text-slate-900">
                  {(selectedRide.rideType || 'offer') === 'offer'
                    ? `${selectedRide.totalSeats - selectedRide.occupiedSeats} livres`
                    : `${selectedRide.totalSeats} vaga`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Visibilidade</span>
                <span className="truncate block font-sans font-medium text-slate-800">
                  {selectedRide.visibility === 'public' ? 'Pública' : 'Grupos em Comum'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <button
              onClick={() => onSelectTracking(selectedRide.id)}
              className="min-h-[44px] py-2 px-3.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 rounded-xl flex items-center justify-center sm:justify-start space-x-1.5 transition cursor-pointer"
            >
              <Navigation className="w-4 h-4 text-indigo-600" />
              <span>Ver Trajeto em Tempo Real no GPS</span>
            </button>

            {!currentUser ? (
              <button
                onClick={() => onOpenAuth?.('login')}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>🔒 Entrar para Aderir à Carona</span>
              </button>
            ) : selectedRide.driverId === currentUser.id ? (
              <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-600 text-xs font-bold rounded-xl flex items-center justify-center">
                Sua Publicação
              </span>
            ) : (selectedRide.rideType || 'offer') === 'offer' ? (
              <div>
                {selectedRide.acceptedPassengers.some((p) => p.userId === currentUser.id) ? (
                  <span className="px-4 py-2 min-h-[44px] bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-emerald-200">
                    <Check className="w-4 h-4" /> Vaga Confirmada
                  </span>
                ) : selectedRide.pendingRequests.some((p) => p.userId === currentUser.id) ? (
                  <span className="px-4 py-2 min-h-[44px] bg-amber-50 text-amber-800 text-xs font-bold rounded-xl flex items-center justify-center border border-amber-200">
                    Solicitação Enviada
                  </span>
                ) : selectedRide.occupiedSeats >= selectedRide.totalSeats ? (
                  <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-500 text-xs font-medium rounded-xl flex items-center justify-center">
                    Vagas Esgotadas
                  </span>
                ) : !canJoinRide(selectedRide) ? (
                  <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-500 text-xs font-medium rounded-xl flex items-center justify-center">
                    {selectedRide.status === 'concluida' ? 'Viagem Concluída' : 'Viagem Encerrada (Data Passada)'}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      if (!canJoinRide(selectedRide)) {
                        alert('Esta carona pertence ao passado ou já foi concluída.');
                        return;
                      }
                      const isGroupMember =
                        selectedRide.visibility === 'group' &&
                        selectedRide.targetGroupId &&
                        currentUser.groups.includes(selectedRide.targetGroupId);
                      onJoinRide(selectedRide.id, !!isGroupMember);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Solicitar Vaga nesta Carona</span>
                  </button>
                )}
              </div>
            ) : !canJoinRide(selectedRide) ? (
              <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-500 text-xs font-medium rounded-xl flex items-center justify-center">
                {selectedRide.status === 'concluida' ? 'Pedido Concluído' : 'Pedido Encerrado (Data Passada)'}
              </span>
            ) : (
              <button
                onClick={() => {
                  if (!canJoinRide(selectedRide)) {
                    alert('Este pedido de carona pertence ao passado ou já foi concluído.');
                    return;
                  }
                  onOfferForRequest(selectedRide);
                }}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Car className="w-4 h-4" />
                <span>Acolher Pedido de Carona</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
