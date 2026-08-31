import React, { useEffect, useState, useRef } from 'react';
import { Play, Square, Navigation, MapPin, Gauge, Clock, ShieldCheck, CheckCircle2, Car } from 'lucide-react';
import { Ride, TrackingPoint } from '../types';
import { saveTrackingPoint } from '../lib/firebase';

interface LiveRideMapProps {
  ride: Ride;
  isDriver: boolean;
  isAcceptedPassenger: boolean;
  onUpdateTracking?: (point: TrackingPoint) => void;
  onCompleteRide?: () => void;
}

export const LiveRideMap: React.FC<LiveRideMapProps> = ({
  ride,
  isDriver,
  isAcceptedPassenger,
  onUpdateTracking,
  onCompleteRide,
}) => {
  const [isPlaying, setIsPlaying] = useState(ride.status === 'em_andamento');
  const [progress, setProgress] = useState(ride.status === 'concluida' ? 100 : (ride.status === 'em_andamento' ? 35 : 0));
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Define route polyline points (relative coordinates 0-100 for responsive SVG canvas)
  const routePoints = [
    { x: 15, y: 75, label: 'Origem: Pinheiros (Carlos)', type: 'origin' },
    { x: 38, y: 55, label: 'Embarque 1: Metrô Butantã', type: 'pickup', passenger: 'Lucas N.' },
    { x: 58, y: 40, label: 'Embarque 2: Shopping Eldorado', type: 'pickup', passenger: 'Beatriz L.' },
    { x: 85, y: 22, label: 'Destino: USP Poli-Civil', type: 'destination' },
  ];

  // Calculate current vehicle interpolated position on SVG path
  const getPositionOnPath = (pct: number) => {
    const totalSegments = routePoints.length - 1;
    const segmentLength = 100 / totalSegments;
    const segIndex = Math.min(Math.floor(pct / segmentLength), totalSegments - 1);
    const subPct = (pct - segIndex * segmentLength) / segmentLength;

    const p1 = routePoints[segIndex];
    const p2 = routePoints[segIndex + 1];

    const currentX = p1.x + (p2.x - p1.x) * subPct;
    const currentY = p1.y + (p2.y - p1.y) * subPct;

    // Heading calculation in degrees
    const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angleDeg = (angleRad * 180) / Math.PI;

    return {
      x: currentX,
      y: currentY,
      heading: angleDeg,
      nextStop: p2.label,
      currentSegmentIndex: segIndex,
    };
  };

  const currentPos = getPositionOnPath(progress);

  // Simulation animation loop
  useEffect(() => {
    if (!isPlaying || ride.status === 'concluida') return;

    const step = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = (time - lastTimeRef.current) / 1000;
        setProgress((prev) => {
          const next = prev + delta * 3.2 * speedMultiplier; // ~30 seconds for full trip at 1x
          if (next >= 100) {
            setIsPlaying(false);
            if (onCompleteRide) onCompleteRide();
            return 100;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
    };
  }, [isPlaying, speedMultiplier, ride.status, onCompleteRide]);

  // Sync tracking point with parent/backend & Firestore
  useEffect(() => {
    if (isPlaying) {
      const lat = ride.origin.lat + (ride.destination.lat - ride.origin.lat) * (progress / 100);
      const lng = ride.origin.lng + (ride.destination.lng - ride.origin.lng) * (progress / 100);
      const remainingMinutes = Math.max(1, Math.round(ride.estimatedDurationMin * (1 - progress / 100)));

      const point: TrackingPoint = {
        rideId: ride.id,
        latitude: Number(lat.toFixed(5)),
        longitude: Number(lng.toFixed(5)),
        speedKmH: progress < 100 ? 38 + Math.sin(progress) * 8 : 0,
        heading: Math.round(currentPos.heading),
        progressPercent: Math.round(progress),
        nextStopLabel: currentPos.nextStop,
        etaMinutes: remainingMinutes,
        timestamp: new Date().toISOString(),
        currentStepIndex: currentPos.currentSegmentIndex,
      };

      if (onUpdateTracking) {
        onUpdateTracking(point);
      }

      // Periodically persist to Firestore tracking subcollection
      if (Math.round(progress) % 15 === 0) {
        saveTrackingPoint(ride.id, point).catch((e) => console.log('Firestore tracking sync note:', e));
      }
    }
  }, [progress, isPlaying]);

  const canViewTracking = isDriver || isAcceptedPassenger;

  if (!canViewTracking) {
    return (
      <div id="tracking-security-locked" className="p-6 bg-white border border-slate-200 rounded-2xl text-center text-slate-700 space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h4 className="font-display font-bold text-slate-900 text-lg">Visualização GPS Restrita (Firestore Security Rules)</h4>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Por diretriz de privacidade e segurança, as coordenadas de geolocalização em tempo real só são transmitidas para o <strong>Motorista</strong> e <strong>Passageiros Aceitos</strong>.
        </p>
        <span className="inline-block px-3 py-1 bg-slate-100 text-amber-800 font-mono text-xs rounded-lg border border-slate-200">
          match /rides/{'{rideId}'}/tracking/{'{id}'}: allow read if isAcceptedPassenger()
        </span>
      </div>
    );
  }

  return (
    <div id="live-ride-map-container" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm text-slate-800">
      {/* Map Header / Telemetry Bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-emerald-500 animate-ping' : progress === 100 ? 'bg-indigo-500' : 'bg-amber-500'}`} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-900 text-sm">{ride.driverVehicle?.model || 'Veículo em Rota'}</span>
              <span className="text-xs bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono font-medium shadow-2xs">
                {ride.driverVehicle?.plate || 'BRA-2026'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isPlaying ? 'Streaming GPS ativo via Firestore Subcollection' : progress === 100 ? 'Percurso finalizado com sucesso' : 'Aguardando início do trajeto pelo motorista'}
            </p>
          </div>
        </div>

        {/* HUD Stats */}
        <div className="grid grid-cols-3 gap-2 w-full sm:w-auto text-xs font-mono">
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center sm:space-x-1.5 shadow-2xs">
            <div className="flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-500 text-[10px] sm:text-xs">Velocidade:</span>
            </div>
            <span className="font-bold text-slate-900 text-[11px] sm:text-xs">{isPlaying ? '42 km/h' : '0 km/h'}</span>
          </div>
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center sm:space-x-1.5 shadow-2xs">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-slate-500 text-[10px] sm:text-xs">ETA:</span>
            </div>
            <span className="font-bold text-slate-900 text-[11px] sm:text-xs">
              {progress === 100 ? '0 min' : `${Math.max(1, Math.round(ride.estimatedDurationMin * (1 - progress / 100)))} min`}
            </span>
          </div>
          <div className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center sm:space-x-1.5 shadow-2xs">
            <div className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-slate-500 text-[10px] sm:text-xs">Progresso:</span>
            </div>
            <span className="font-bold text-indigo-600 text-[11px] sm:text-xs">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Interactive Vector Map Canvas */}
      <div className="relative w-full h-72 sm:h-80 md:h-96 bg-slate-900 overflow-hidden select-none">
        {/* Map Grid and Urban Road Texture */}
        <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="urban-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.7" />
              <circle cx="20" cy="20" r="1.5" fill="#64748b" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#urban-grid)" />
        </svg>

        {/* Simulated Metro / Avenue Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Background Avenue Lines */}
          <path d="M 0 50 Q 50 70 100 30" fill="none" stroke="#334155" strokeWidth="2.5" strokeDasharray="3,3" />
          <path d="M 20 100 Q 40 40 80 0" fill="none" stroke="#1e293b" strokeWidth="4" />

          {/* Active Carpool Route Path (Google Maps Routes API Path) */}
          <path
            d={`M ${routePoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]"
          />

          {/* Completed Segment Glow */}
          <path
            d={`M ${routePoints[0].x} ${routePoints[0].y} L ${currentPos.x} ${currentPos.y}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Waypoint Nodes */}
          {routePoints.map((pt, idx) => {
            const isReached = (progress / 100) >= (idx / (routePoints.length - 1));
            return (
              <g key={idx} transform={`translate(${pt.x}, ${pt.y})`}>
                <circle
                  r={pt.type === 'origin' || pt.type === 'destination' ? '3.5' : '2.8'}
                  fill={isReached ? '#10b981' : pt.type === 'destination' ? '#f43f5e' : '#f59e0b'}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                {pt.type === 'pickup' && (
                  <circle r="4.5" fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="1,1" className="animate-pulse" />
                )}
              </g>
            );
          })}

          {/* Live Moving Car Marker */}
          <g transform={`translate(${currentPos.x}, ${currentPos.y}) rotate(${currentPos.heading})`}>
            <circle r="4.5" fill="#6366f1" opacity="0.3" className="animate-ping" />
            <circle r="3.2" fill="#4f46e5" stroke="#ffffff" strokeWidth="0.8" />
          </g>
        </svg>

        {/* Real-time Waypoint Overlay Badges */}
        {routePoints.map((pt, idx) => (
          <div
            key={idx}
            style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-8 pointer-events-none whitespace-nowrap hidden sm:block"
          >
            <div className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-900/90 backdrop-blur border border-slate-700 shadow-md flex items-center space-x-1">
              <MapPin className={`w-3 h-3 ${pt.type === 'origin' ? 'text-emerald-400' : pt.type === 'destination' ? 'text-rose-400' : 'text-amber-400'}`} />
              <span className="text-slate-100">{pt.label.split(':')[0]}</span>
              {pt.passenger && <span className="text-amber-300 font-semibold">({pt.passenger})</span>}
            </div>
          </div>
        ))}

        {/* Floating Vehicle Tracking Card */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-2.5 sm:max-w-xs shadow-md flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div className="text-xs min-w-0">
            <p className="text-slate-500 font-mono text-[10px]">Próximo Ponto de Encontro:</p>
            <p className="font-semibold text-slate-900 truncate">{currentPos.nextStop}</p>
          </div>
        </div>
      </div>

      {/* Driver Controls & Passenger View Controls */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {isDriver ? (
            <>
              {!isPlaying && progress < 100 && (
                <button
                  id="btn-start-tracking"
                  onClick={() => setIsPlaying(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{progress > 0 ? 'Continuar Percurso' : 'Iniciar Percurso (Start)'}</span>
                </button>
              )}

              {isPlaying && (
                <button
                  id="btn-pause-tracking"
                  onClick={() => setIsPlaying(false)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition active:scale-95"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Pausar GPS</span>
                </button>
              )}

              {progress > 0 && progress < 100 && (
                <button
                  id="btn-finish-early"
                  onClick={() => {
                    setProgress(100);
                    setIsPlaying(false);
                    if (onCompleteRide) onCompleteRide();
                  }}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-medium rounded-xl border border-slate-200 flex items-center space-x-1 transition active:scale-95 shadow-2xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Chegada ao Destino</span>
                </button>
              )}

              {progress === 100 && (
                <button
                  id="btn-reset-simulation"
                  onClick={() => {
                    setProgress(0);
                    setIsPlaying(false);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs rounded-xl border border-slate-200 transition active:scale-95"
                >
                  Reiniciar Demonstração
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-600 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Modo Passageiro: Acompanhamento em tempo real via snapshot do Firestore</span>
            </div>
          )}
        </div>

        {/* Speed Controls for Simulation */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-600">
          <span>Velocidade Demo:</span>
          {[1, 2, 4].map((mult) => (
            <button
              key={mult}
              onClick={() => setSpeedMultiplier(mult)}
              className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition active:scale-95 ${
                speedMultiplier === mult ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {mult}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
