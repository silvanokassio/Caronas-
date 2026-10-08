import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Navigation,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Compass,
  Home,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  getCurrentGPSPosition,
  reverseGeocode,
  searchAddressGeocode,
  resolveUserAddress,
  ResolvedUserLocation,
  SP_PRESETS,
  GeocodedPlace,
} from '../lib/geo';
import { User } from '../types';

// Fix Leaflet marker icon asset paths for bundlers
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  initialLocation?: { lat?: number; lng?: number; address?: string };
  userAddress?: string;
  userLocation?: { lat?: number; lng?: number; address?: string };
  currentUser?: User | null;
  mode?: 'create' | 'edit' | 'viewOnly' | string;
  onSelectLocation?: (selected: { address: string; lat: number; lng: number; name?: string }) => void;
  onConfirm?: (selected: { address: string; lat: number; lng: number; name?: string }) => void;
  onConfirmLocation?: (lat: number, lng: number, address: string, name?: string) => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  title = 'Apontar Localização no Mapa',
  initialAddress = '',
  initialLat = -23.5592,
  initialLng = -46.7314,
  initialLocation,
  userAddress = '',
  userLocation,
  currentUser = null,
  mode = 'create',
  onSelectLocation,
  onConfirm,
  onConfirmLocation,
}) => {
  const isViewOnly = mode === 'viewOnly';
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Determine user registered address fallback
  const userAddrFallback = useMemo<ResolvedUserLocation | null>(() => {
    const resolved = resolveUserAddress(currentUser);
    if (resolved) return resolved;
    if (
      userLocation?.lat &&
      userLocation?.lng &&
      !isNaN(userLocation.lat) &&
      !isNaN(userLocation.lng) &&
      userLocation.lat !== 0
    ) {
      return {
        lat: userLocation.lat,
        lng: userLocation.lng,
        address: userLocation.address || userAddress || 'Endereço Cadastrado',
        label: 'Endereço do Usuário',
        source: 'profile',
      };
    }
    return null;
  }, [currentUser, userLocation, userAddress]);

  const resolvedStartLat =
    initialLocation?.lat && !isNaN(initialLocation.lat)
      ? initialLocation.lat
      : initialLat && !isNaN(initialLat)
      ? initialLat
      : userAddrFallback?.lat || -23.5592;

  const resolvedStartLng =
    initialLocation?.lng && !isNaN(initialLocation.lng)
      ? initialLocation.lng
      : initialLng && !isNaN(initialLng)
      ? initialLng
      : userAddrFallback?.lng || -46.7314;

  const resolvedStartAddr =
    initialLocation?.address || initialAddress || userAddrFallback?.address || '';

  const [currentLat, setCurrentLat] = useState<number>(resolvedStartLat);
  const [currentLng, setCurrentLng] = useState<number>(resolvedStartLng);
  const [addressInput, setAddressInput] = useState<string>(resolvedStartAddr);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'user_address' | 'initial' | 'custom'>('user_address');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Search query & autocomplete suggestions
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Move map & marker programmatically
  const moveToCoordinates = (
    lat: number,
    lng: number,
    address?: string,
    source: 'gps' | 'user_address' | 'initial' | 'custom' = 'custom'
  ) => {
    if (isViewOnly) return;
    setCurrentLat(lat);
    setCurrentLng(lng);
    setLocationSource(source);

    if (address) {
      setAddressInput(address);
    } else {
      handlePositionChange(lat, lng, source);
    }

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
      markerRef.current.setLatLng([lat, lng]);
    }
  };

  // Reverse geocoding position change
  const handlePositionChange = async (
    lat: number,
    lng: number,
    source: 'gps' | 'user_address' | 'initial' | 'custom' = 'custom'
  ) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    setLocationSource(source);
    setIsReverseGeocoding(true);
    setGpsError(null);

    try {
      const resolvedAddress = await reverseGeocode(lat, lng);
      setAddressInput(resolvedAddress);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Manual GPS trigger
  const handleGetGPS = async () => {
    if (isViewOnly) return;
    setIsLocatingGPS(true);
    setGpsError(null);

    try {
      const coords = await getCurrentGPSPosition(6000);
      moveToCoordinates(coords.lat, coords.lng, undefined, 'gps');
      setStatusMessage('📍 Posição atual do usuário obtida via GPS');
    } catch (err: any) {
      setGpsError(err?.message || 'Não foi possível acessar a localização GPS.');
      if (userAddrFallback) {
        moveToCoordinates(userAddrFallback.lat, userAddrFallback.lng, userAddrFallback.address, 'user_address');
        setStatusMessage(`🏠 GPS indisponível. Posicionado no seu ${userAddrFallback.label}`);
      }
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Search geocode handling
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly || !searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchAddressGeocode(searchQuery);
      setSearchResults(results);
      if (results.length > 0) {
        const first = results[0];
        moveToCoordinates(first.lat, first.lng, first.address, 'custom');
        setStatusMessage(`Resultado encontrado: ${first.name}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Initialize Leaflet map and handle GPS or User Address positioning
  useEffect(() => {
    if (!isOpen) return;

    // View-Only mode: stick strictly to the requested initial location
    if (isViewOnly) {
      const startLat =
        initialLocation?.lat && !isNaN(initialLocation.lat)
          ? initialLocation.lat
          : initialLat && !isNaN(initialLat)
          ? initialLat
          : -23.5592;
      const startLng =
        initialLocation?.lng && !isNaN(initialLocation.lng)
          ? initialLocation.lng
          : initialLng && !isNaN(initialLng)
          ? initialLng
          : -46.7314;
      const startAddr = initialLocation?.address || initialAddress || '';

      setCurrentLat(startLat);
      setCurrentLng(startLng);
      setAddressInput(startAddr);
      setLocationSource('initial');
      return;
    }

    // Pointing mode: Start initially close to user's address if known, or initial point
    const userFallback = userAddrFallback;
    const initialHasSpecificCoord =
      initialLocation?.lat &&
      initialLocation?.lng &&
      (Math.abs(initialLocation.lat - -23.5592) > 0.0001 || Math.abs(initialLocation.lng - -46.7314) > 0.0001);

    let startLat = -23.5592;
    let startLng = -46.7314;
    let startAddr = '';

    if (userFallback) {
      startLat = userFallback.lat;
      startLng = userFallback.lng;
      startAddr = userFallback.address;
      setLocationSource('user_address');
      setStatusMessage(`Posicionado próximo ao seu ${userFallback.label}`);
    } else if (initialHasSpecificCoord) {
      startLat = initialLocation!.lat!;
      startLng = initialLocation!.lng!;
      startAddr = initialLocation!.address || initialAddress || '';
      setLocationSource('initial');
    } else if (initialAddress && initialAddress.trim().length > 0) {
      startLat = initialLat && !isNaN(initialLat) ? initialLat : -23.5592;
      startLng = initialLng && !isNaN(initialLng) ? initialLng : -46.7314;
      startAddr = initialAddress;
      setLocationSource('initial');
    }

    setCurrentLat(startLat);
    setCurrentLng(startLng);
    setAddressInput(startAddr);
    setGpsError(null);
  }, [isOpen, isViewOnly, userAddrFallback]);

  // Leaflet Map Container setup and Automatic GPS Attempt
  useEffect(() => {
    if (!isOpen) return;

    let resizeObserver: ResizeObserver | null = null;
    let isCancelled = false;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initial center: user address if available, else start coords
      const initLat = userAddrFallback ? userAddrFallback.lat : currentLat;
      const initLng = userAddrFallback ? userAddrFallback.lng : currentLng;

      const map = L.map(mapContainerRef.current, {
        center: [initLat, initLng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initLat, initLng], {
        icon: customIcon,
        draggable: !isViewOnly,
      }).addTo(map);

      markerRef.current = marker;
      mapInstanceRef.current = map;

      map.invalidateSize();

      if (mapContainerRef.current && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      if (!isViewOnly) {
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          handlePositionChange(pos.lat, pos.lng, 'custom');
          setStatusMessage(null);
        });

        map.on('click', async (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          handlePositionChange(lat, lng, 'custom');
          setStatusMessage(null);
        });

        // =================================================================
        // USER REQUIREMENT:
        // "Sempre que abrir mapa para apontamento de endereço mostrar a posição
        //  atual do usuário se os dados de GPS estiverem disponíveis ou mostrar
        //  posicionamento próximo do endereço do usuário"
        // =================================================================
        setIsLocatingGPS(true);
        setStatusMessage('📡 Obtendo localização atual via GPS...');

        getCurrentGPSPosition(5000)
          .then(async (coords) => {
            if (isCancelled) return;
            // GPS Available! Automatically center map and marker at user's current GPS position
            setCurrentLat(coords.lat);
            setCurrentLng(coords.lng);
            setLocationSource('gps');
            setStatusMessage('📍 Posição atual do usuário (GPS detectado com sucesso)');
            setGpsError(null);

            if (mapInstanceRef.current && markerRef.current) {
              mapInstanceRef.current.setView([coords.lat, coords.lng], 16, { animate: true });
              markerRef.current.setLatLng([coords.lat, coords.lng]);
            }

            // Reverse geocode to get current street address
            setIsReverseGeocoding(true);
            try {
              const geocodedAddr = await reverseGeocode(coords.lat, coords.lng);
              if (!isCancelled) {
                setAddressInput(geocodedAddr);
              }
            } catch (e) {
              if (!isCancelled) {
                setAddressInput(`Minha Localização GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
              }
            } finally {
              if (!isCancelled) {
                setIsReverseGeocoding(false);
                setIsLocatingGPS(false);
              }
            }
          })
          .catch(async () => {
            if (isCancelled) return;
            // GPS NOT available -> Fallback to positioning near the user's address!
            setIsLocatingGPS(false);

            if (userAddrFallback) {
              setCurrentLat(userAddrFallback.lat);
              setCurrentLng(userAddrFallback.lng);
              setAddressInput(userAddrFallback.address);
              setLocationSource('user_address');
              setStatusMessage(`🏠 Posicionado próximo ao seu ${userAddrFallback.label} (GPS indisponível)`);

              if (mapInstanceRef.current && markerRef.current) {
                mapInstanceRef.current.setView([userAddrFallback.lat, userAddrFallback.lng], 15, { animate: true });
                markerRef.current.setLatLng([userAddrFallback.lat, userAddrFallback.lng]);
              }
            } else if (userAddress || initialAddress) {
              // Try geocoding user address string if coordinates were not yet cached
              const targetAddr = userAddress || initialAddress;
              try {
                const results = await searchAddressGeocode(targetAddr);
                if (results.length > 0 && !isCancelled) {
                  const first = results[0];
                  setCurrentLat(first.lat);
                  setCurrentLng(first.lng);
                  setAddressInput(first.address);
                  setLocationSource('user_address');
                  setStatusMessage(`🏠 Posicionado próximo ao endereço do usuário (${first.name})`);

                  if (mapInstanceRef.current && markerRef.current) {
                    mapInstanceRef.current.setView([first.lat, first.lng], 15, { animate: true });
                    markerRef.current.setLatLng([first.lat, first.lng]);
                  }
                }
              } catch (e) {
                // Keep default center
              }
            }
          });
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, isViewOnly]);

  const handleConfirm = () => {
    const finalAddress =
      addressInput.trim() || `Localização (${currentLat.toFixed(4)}, ${currentLng.toFixed(4)})`;
    const finalLat = Number(currentLat.toFixed(6));
    const finalLng = Number(currentLng.toFixed(6));
    const finalName = finalAddress.split(',')[0].trim();

    const selectedData = {
      address: finalAddress,
      lat: finalLat,
      lng: finalLng,
      name: finalName,
    };

    if (typeof onConfirmLocation === 'function') {
      onConfirmLocation(finalLat, finalLng, finalAddress, finalName);
    }
    if (typeof onSelectLocation === 'function') {
      onSelectLocation(selectedData);
    }
    if (typeof onConfirm === 'function') {
      onConfirm(selectedData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[94dvh] sm:h-[88vh] max-h-[96dvh]">
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-500">
                {isViewOnly ? 'Visualizando endereço fixo no mapa' : 'GPS em tempo real ou toque no mapa para posicionar'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search, Status and Fast Action Bar */}
        <div className="p-2.5 sm:p-3 bg-white border-b border-slate-100 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar rua, bairro, número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-20 py-2.5 sm:py-2 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 sm:top-2.5" />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Buscar</span>}
              </button>
            </form>

            {!isViewOnly && (
              <button
                type="button"
                onClick={handleGetGPS}
                disabled={isLocatingGPS}
                className={`px-3 py-2.5 sm:py-2 min-h-[42px] sm:min-h-auto text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer ${
                  locationSource === 'gps'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
                title="Obter coordenadas do GPS do dispositivo"
              >
                {isLocatingGPS ? (
                  <Loader2 className="w-4 h-4 animate-spin text-inherit" />
                ) : (
                  <Navigation className="w-4 h-4 text-inherit" />
                )}
                <span className="hidden xs:inline">{isLocatingGPS ? 'Localizando...' : 'Meu GPS'}</span>
              </button>
            )}
          </div>

          {/* Quick positioning shortcut pills (GPS, Home, Initial, Presets) */}
          {!isViewOnly && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-slate-600 scrollbar-none">
              {/* GPS button shortcut */}
              <button
                type="button"
                onClick={handleGetGPS}
                className={`px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-medium flex items-center gap-1 transition shrink-0 cursor-pointer ${
                  locationSource === 'gps'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                    : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 border border-slate-200'
                }`}
              >
                <Navigation className="w-3 h-3 text-emerald-600" />
                <span>GPS Atual</span>
              </button>

              {/* User Registered Address button shortcut */}
              {userAddrFallback && (
                <button
                  type="button"
                  onClick={() =>
                    moveToCoordinates(
                      userAddrFallback.lat,
                      userAddrFallback.lng,
                      userAddrFallback.address,
                      'user_address'
                    )
                  }
                  className={`px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-medium flex items-center gap-1 transition shrink-0 cursor-pointer ${
                    locationSource === 'user_address'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold'
                      : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 border border-slate-200'
                  }`}
                  title={userAddrFallback.address}
                >
                  <Home className="w-3 h-3 text-indigo-600" />
                  <span>Meu Endereço</span>
                </button>
              )}

              {/* Previous / Initial point shortcut if available */}
              {initialAddress &&
                initialAddress !== addressInput &&
                initialAddress !== userAddrFallback?.address && (
                  <button
                    type="button"
                    onClick={() =>
                      moveToCoordinates(resolvedStartLat, resolvedStartLng, resolvedStartAddr, 'initial')
                    }
                    className="px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-medium flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition shrink-0 cursor-pointer"
                    title={`Restaurar: ${initialAddress}`}
                  >
                    <RotateCcw className="w-3 h-3 text-amber-600" />
                    <span>Ponto Anterior</span>
                  </button>
                )}

              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-0.5 ml-1">
                <Sparkles className="w-3 h-3 text-indigo-500" /> SP:
              </span>
              {SP_PRESETS.slice(0, 3).map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => moveToCoordinates(preset.lat, preset.lng, preset.address, 'custom')}
                  className="px-2.5 py-1 min-h-[28px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg text-slate-700 whitespace-nowrap transition text-[11px] font-medium flex items-center cursor-pointer shrink-0"
                >
                  {preset.name.split('(')[0].trim()}
                </button>
              ))}
            </div>
          )}

          {/* Real-time status badge */}
          {statusMessage && (
            <div
              className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition ${
                locationSource === 'gps'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : locationSource === 'user_address'
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                  : 'bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center space-x-1.5 truncate">
                {locationSource === 'gps' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : locationSource === 'user_address' ? (
                  <Home className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span className="font-medium truncate">{statusMessage}</span>
              </div>
              {isLocatingGPS && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 shrink-0 ml-2" />}
            </div>
          )}

          {gpsError && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{gpsError}</span>
            </div>
          )}
        </div>

        {/* Leaflet Interactive Map Canvas */}
        <div className="relative flex-1 min-h-[140px] sm:min-h-[240px] w-full bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* Center pinpoint coordinates pill */}
          <div className="absolute top-2.5 right-2.5 z-10 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-700 shadow-xs flex items-center space-x-1 pointer-events-none">
            <Compass className="w-3 h-3 text-indigo-600" />
            <span>
              {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
            </span>
          </div>

          {/* Map floating prompt */}
          {!isViewOnly && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-slate-900/80 backdrop-blur text-white text-[11px] font-medium px-3 py-1 rounded-full shadow-lg pointer-events-none">
              Arraste o pino ou clique no mapa para ajustar
            </div>
          )}
        </div>

        {/* Selected Address Preview & Confirmation Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 shrink-0 shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ponto {isViewOnly ? 'Registrado' : 'Selecionado'}:</span>
                {isReverseGeocoding && <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
              </span>
            </div>
            <input
              type="text"
              readOnly={isViewOnly}
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setLocationSource('custom');
              }}
              placeholder="Digite ou ajuste o endereço/referência..."
              className={`w-full px-3.5 py-2 sm:py-2 text-base sm:text-xs border rounded-xl font-medium text-slate-900 ${
                isViewOnly
                  ? 'bg-slate-100 border-slate-200 cursor-default'
                  : 'bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            {isViewOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full px-5 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] bg-slate-800 hover:bg-slate-900 text-white text-sm sm:text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-2 active:scale-95 cursor-pointer"
              >
                <span>Fechar Visualização</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 sm:w-auto px-4 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-map-location"
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 sm:w-auto px-5 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Localização</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
