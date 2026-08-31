import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import {
  getCurrentGPSPosition,
  reverseGeocode,
  searchAddressGeocode,
  SP_PRESETS,
  GeocodedPlace,
} from '../lib/geo';

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

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
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
  mode = 'create',
  onSelectLocation,
  onConfirm,
  onConfirmLocation,
}) => {
  const isViewOnly = mode === 'viewOnly';
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [currentLat, setCurrentLat] = useState<number>(initialLat || -23.5592);
  const [currentLng, setCurrentLng] = useState<number>(initialLng || -46.7314);
  const [addressInput, setAddressInput] = useState<string>(initialAddress);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Search query & autocomplete suggestions
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodedPlace[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Initialize or update Leaflet map when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const startLat = initialLat && !isNaN(initialLat) ? initialLat : -23.5592;
    const startLng = initialLng && !isNaN(initialLng) ? initialLng : -46.7314;
    setCurrentLat(startLat);
    setCurrentLng(startLng);
    setAddressInput(initialAddress || '');
    setGpsError(null);

    let resizeObserver: ResizeObserver | null = null;

    // Timeout to ensure DOM container is rendered
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add draggable marker (disabled if viewOnly)
      const marker = L.marker([startLat, startLng], {
        icon: customIcon,
        draggable: !isViewOnly,
      }).addTo(map);

      markerRef.current = marker;
      mapInstanceRef.current = map;

      // Ensure proper sizing
      map.invalidateSize();

      // Listen to resize
      if (mapContainerRef.current && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      if (!isViewOnly) {
        // Handle marker drag
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          handlePositionChange(pos.lat, pos.lng);
        });

        // Handle map click
        map.on('click', async (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          handlePositionChange(lat, lng);
        });
      }

      // If initial address is empty, resolve it
      if (!initialAddress) {
        handlePositionChange(startLat, startLng);
      }
    }, 150);

    return () => {
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

  const handlePositionChange = async (lat: number, lng: number) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
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

  const moveToCoordinates = (lat: number, lng: number, address?: string) => {
    if (isViewOnly) return;
    setCurrentLat(lat);
    setCurrentLng(lng);
    if (address) setAddressInput(address);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
      markerRef.current.setLatLng([lat, lng]);
    }

    if (!address) {
      handlePositionChange(lat, lng);
    }
  };

  // Get current device GPS location
  const handleGetGPS = async () => {
    if (isViewOnly) return;
    setIsLocatingGPS(true);
    setGpsError(null);

    try {
      const coords = await getCurrentGPSPosition();
      moveToCoordinates(coords.lat, coords.lng);
    } catch (err: any) {
      setGpsError(err?.message || 'Não foi possível acessar a localização GPS.');
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
        // Move to first result automatically
        const first = results[0];
        moveToCoordinates(first.lat, first.lng, first.address);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

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
              <p className="text-[11px] text-slate-500">Toque no mapa ou arraste o pino até o local desejado</p>
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

        {/* Search and GPS Actions Bar */}
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

            <button
              type="button"
              onClick={handleGetGPS}
              disabled={isLocatingGPS}
              className="px-3 py-2.5 sm:py-2 min-h-[42px] sm:min-h-auto bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
              title="Obter coordenadas do GPS do dispositivo"
            >
              {isLocatingGPS ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Navigation className="w-4 h-4 text-emerald-600" />
              )}
              <span className="hidden xs:inline">Meu GPS</span>
            </button>
          </div>

          {/* Quick preset suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-slate-600 scrollbar-none">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-0.5">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Atalhos:
            </span>
            {SP_PRESETS.slice(0, 4).map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => moveToCoordinates(preset.lat, preset.lng, preset.address)}
                className="px-2.5 py-1 min-h-[28px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg text-slate-700 whitespace-nowrap transition text-[11px] font-medium flex items-center cursor-pointer"
              >
                {preset.name.split('(')[0].trim()}
              </button>
            ))}
          </div>

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
              onChange={(e) => setAddressInput(e.target.value)}
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
