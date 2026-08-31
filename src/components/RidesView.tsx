import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search,
  Car, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Radio, 
  Play, 
  Navigation, 
  Sparkles,
  Home,
  Check,
  Loader2,
  Filter,
  ArrowRight,
  HandMetal,
  LocateFixed,
  Route,
  UserCheck,
  Send,
  Globe,
  Map,
  List,
  Calendar,
  CalendarDays,
  History,
  X,
  CheckCheck
} from 'lucide-react';
import { Ride, User, Group, PendingRequest, isSuperUser, Vehicle, getUserVehicles, GeoLocation } from '../types';
import { LiveRideMap } from './LiveRideMap';
import { NearbyRidesMapView } from './NearbyRidesMapView';
import { LocationPickerModal } from './LocationPickerModal';
import { RideRouteModal } from './RideRouteModal';
import { WelcomeRideRequestModal } from './WelcomeRideRequestModal';
import { DriverNavigationModal } from './DriverNavigationModal';
import { PassengerLiveTrackingModal } from './PassengerLiveTrackingModal';
import { getCurrentGPSPosition, reverseGeocode, calculateDistanceKm } from '../lib/geo';
import { 
  getRideDateTime, 
  isRideInPast, 
  formatRideFriendlyDate, 
  matchesDateTimeFilter, 
  getRelativeDateStr, 
  getUpcomingTimeStr,
  DateTimeFilterOptions 
} from '../lib/dateUtils';
import confetti from 'canvas-confetti';
import { Crown, Lock, LogIn } from 'lucide-react';

interface RidesViewProps {
  currentUser: User | null;
  rides: Ride[];
  groups: Group[];
  onCreateRide: (newRide: Partial<Ride>) => void;
  onJoinRide: (rideId: string, autoAccept: boolean) => void;
  onAcceptRequest: (rideId: string, request: PendingRequest) => void;
  onRejectRequest: (rideId: string, userId: string) => void;
  onSendProposalForRequest?: (
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
  onAcceptProposal?: (requestRideId: string, proposalId: string) => void;
  onRejectProposal?: (requestRideId: string, proposalId: string) => void;
  onStartRide: (rideId: string) => void;
  onCompleteRide: (rideId: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  initialGroupForRide?: Group | null;
  onClearInitialGroupForRide?: () => void;
}

interface UserLocationRef {
  lat: number;
  lng: number;
  label: string;
  source: 'gps' | 'residential' | 'default';
}

export const RidesView: React.FC<RidesViewProps> = ({
  currentUser,
  rides,
  groups,
  onCreateRide,
  onJoinRide,
  onAcceptRequest,
  onRejectRequest,
  onSendProposalForRequest,
  onAcceptProposal,
  onRejectProposal,
  onStartRide,
  onCompleteRide,
  onOpenAuth,
  initialGroupForRide,
  onClearInitialGroupForRide,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'offer' | 'request' | 'search'>('offer');
  const isSuper = isSuperUser(currentUser);
  
  // Tracking Ride ID
  const [activeTrackingRideId, setActiveTrackingRideId] = useState<string | null>(
    rides.find((r) => r.status === 'em_andamento')?.id || rides[0]?.id || null
  );

  // Selected ride for interactive route modal
  const [selectedRideForRouteModal, setSelectedRideForRouteModal] = useState<Ride | null>(null);

  // Selected ride for driver navigation & multi-stop routing modal
  const [selectedRideForNavigationModal, setSelectedRideForNavigationModal] = useState<Ride | null>(null);

  // Selected ride for passenger live tracking GPS modal
  const [selectedRideForPassengerTrackingModal, setSelectedRideForPassengerTrackingModal] = useState<Ride | null>(null);

  // Selected ride for driver to welcome a request with a proposal
  const [selectedRideForWelcomeModal, setSelectedRideForWelcomeModal] = useState<Ride | null>(null);

  // Active in-progress ride where current user is an accepted passenger
  const activePassengerLiveRide = useMemo(() => {
    if (!currentUser) return null;
    return rides.find(
      (r) =>
        r.status === 'em_andamento' &&
        r.driverId !== currentUser.id &&
        r.acceptedPassengers?.some((p) => p.userId === currentUser.id)
    );
  }, [rides, currentUser]);

  const handleStartRideWithNavigation = (ride: Ride) => {
    onStartRide(ride.id);
    setSelectedRideForNavigationModal({ ...ride, status: 'em_andamento' });
    setActiveTrackingRideId(ride.id);
  };

  // User Reference Location (Starts with Residential, upgrades to GPS)
  const defaultResidential = useMemo<UserLocationRef>(() => {
    if (currentUser?.residentialAddress?.lat && currentUser?.residentialAddress?.lng) {
      return {
        lat: currentUser.residentialAddress.lat,
        lng: currentUser.residentialAddress.lng,
        label: currentUser.residentialAddress.address || 'Endereço Residencial',
        source: 'residential',
      };
    }
    if (currentUser?.ponto_encontro_default?.lat && currentUser?.ponto_encontro_default?.lng) {
      return {
        lat: currentUser.ponto_encontro_default.lat,
        lng: currentUser.ponto_encontro_default.lng,
        label: currentUser.ponto_encontro_default.address || 'Ponto de Encontro Padrão',
        source: 'residential',
      };
    }
    return {
      lat: -23.5539,
      lng: -46.6896,
      label: 'Pinheiros, São Paulo - SP',
      source: 'default',
    };
  }, [currentUser]);

  const [userLocation, setUserLocation] = useState<UserLocationRef>(defaultResidential);
  const [isLocatingGPS, setIsLocatingGPS] = useState<boolean>(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);

  // Main Tabs: Minhas Caronas vs Buscar Caronas da Comunidade
  const [activeMainTab, setActiveMainTab] = useState<'my_rides' | 'search_rides'>(
    !currentUser ? 'search_rides' : 'my_rides'
  );

  // Search & Exploration Filters (Default to offers for guest)
  const [searchViewMode, setSearchViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'offer' | 'request'>(!currentUser ? 'offer' : 'all');
  const [searchGroupId, setSearchGroupId] = useState<string>('all');
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(0); // 0 = Sem limite
  const [seatsFilter, setSeatsFilter] = useState<number>(1);
  const [dateFilterMode, setDateFilterMode] = useState<'all_future' | 'today' | 'tomorrow' | 'this_week' | 'custom'>('all_future');
  const [customDate, setCustomDate] = useState<string>('');
  const [timeFilterMode, setTimeFilterMode] = useState<'all' | 'from_now' | 'morning' | 'afternoon' | 'night' | 'custom'>('all');
  const [customTime, setCustomTime] = useState<string>('');
  const [showPastRides, setShowPastRides] = useState<boolean>(false);
  const [myRidesFilterTab, setMyRidesFilterTab] = useState<'all' | 'upcoming' | 'history'>('upcoming');

  // User vehicles list
  const userVehicles = getUserVehicles(currentUser);
  const primaryVehicle = userVehicles.find((v) => v.isPrimary) || userVehicles[0];

  // Groups available for linking a ride
  const availableGroupsForUser = useMemo(() => {
    if (!currentUser) return [];
    if (isSuper) return groups;
    return groups.filter(
      (g) =>
        g.creatorId === currentUser.id ||
        g.adminIds?.includes(currentUser.id) ||
        g.memberIds?.includes(currentUser.id) ||
        currentUser.groups?.includes(g.id)
    );
  }, [groups, currentUser, isSuper]);

  // Modal Link Mode: 'avulsa' (sem vínculo de grupo, pública) ou 'group' (com vínculo de grupo)
  const [modalLinkMode, setModalLinkMode] = useState<'avulsa' | 'group'>('avulsa');

  // Unified Form State (for Creating Rides or Requests)
  const [formData, setFormData] = useState({
    rideType: 'offer' as 'offer' | 'request',
    description: '',
    notes: '',
    selectedVehicleId: primaryVehicle?.id || primaryVehicle?.plate || '',
    originAddress: currentUser?.residentialAddress?.address || currentUser?.ponto_encontro_default?.address || 'Rua Fradique Coutinho, 1200 - Pinheiros',
    originLat: currentUser?.residentialAddress?.lat || currentUser?.ponto_encontro_default?.lat || -23.5539,
    originLng: currentUser?.residentialAddress?.lng || currentUser?.ponto_encontro_default?.lng || -46.6896,
    destAddress: currentUser?.routine?.destination?.address || 'Av. Prof. Luciano Gualberto, 380 - Butantã (USP)',
    destLat: currentUser?.routine?.destination?.lat || -23.5574,
    destLng: currentUser?.routine?.destination?.lng || -46.7314,
    departureDate: getRelativeDateStr(0),
    departureTime: getUpcomingTimeStr(1),
    totalSeats: primaryVehicle?.availableSeats || 3,
    requestSeats: 1,
    price: 6.50,
    visibility: 'public' as 'public' | 'group',
    targetGroupId: undefined as string | undefined,
    targetGroupName: undefined as string | undefined,
    requesterNote: '',
  });

  // Keep vehicle in sync with currentUser
  useEffect(() => {
    if (currentUser) {
      const vList = getUserVehicles(currentUser);
      const prim = vList.find((v) => v.isPrimary) || vList[0];
      if (prim) {
        setFormData((prev) => ({
          ...prev,
          selectedVehicleId: prev.selectedVehicleId || prim.id || prim.plate || '',
          totalSeats: prev.totalSeats || prim.availableSeats || 3,
        }));
      }
    }
  }, [currentUser]);

  // Watch for initialGroupForRide to trigger pre-filled inherited ride creation
  useEffect(() => {
    if (initialGroupForRide) {
      setModalLinkMode('group');
      const originAddr = currentUser?.residentialAddress?.address || currentUser?.ponto_encontro_default?.address || formData.originAddress;
      const originLat = currentUser?.residentialAddress?.lat || currentUser?.ponto_encontro_default?.lat || formData.originLat;
      const originLng = currentUser?.residentialAddress?.lng || currentUser?.ponto_encontro_default?.lng || formData.originLng;

      setFormData((prev) => ({
        ...prev,
        rideType: 'offer',
        destAddress: initialGroupForRide.defaultDestination?.address || prev.destAddress,
        destLat: initialGroupForRide.defaultDestination?.lat || prev.destLat,
        destLng: initialGroupForRide.defaultDestination?.lng || prev.destLng,
        price: initialGroupForRide.defaultPrice ?? prev.price,
        departureTime: initialGroupForRide.defaultDepartureTime || prev.departureTime,
        visibility: 'group',
        targetGroupId: initialGroupForRide.id,
        targetGroupName: initialGroupForRide.name,
        originAddress: originAddr,
        originLat: originLat,
        originLng: originLng,
      }));
      setShowModal(true);
    }
  }, [initialGroupForRide, currentUser]);

  // Map Picker State
  const [mapPickerTarget, setMapPickerTarget] = useState<'formOrigin' | 'formDest' | 'searchFilter' | null>(null);

  // Initial Attempt to get GPS on component mount
  useEffect(() => {
    let isMounted = true;
    const fetchInitialGPS = async () => {
      setIsLocatingGPS(true);
      try {
        const coords = await getCurrentGPSPosition();
        if (isMounted) {
          const addr = await reverseGeocode(coords.lat, coords.lng);
          setUserLocation({
            lat: coords.lat,
            lng: coords.lng,
            label: addr,
            source: 'gps',
          });
          setGpsStatusMessage('GPS Ativo: Localização atual capturada');
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('GPS initial detection fallback to residential:', err);
          setUserLocation(defaultResidential);
          setGpsStatusMessage('GPS indisponível: Usando seu endereço residencial cadastrado');
        }
      } finally {
        if (isMounted) {
          setIsLocatingGPS(false);
        }
      }
    };

    fetchInitialGPS();

    return () => {
      isMounted = false;
    };
  }, [defaultResidential]);

  // Trigger GPS explicitly on demand
  const handleRequestGPS = async () => {
    setIsLocatingGPS(true);
    setGpsStatusMessage('Localizando via GPS...');
    try {
      const coords = await getCurrentGPSPosition();
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setUserLocation({
        lat: coords.lat,
        lng: coords.lng,
        label: addr,
        source: 'gps',
      });
      setGpsStatusMessage('Localização GPS atualizada com sucesso!');
    } catch (err: any) {
      alert(err?.message || 'Não foi possível obter a posição GPS. Mantendo localização cadastrada.');
      setUserLocation(defaultResidential);
      setGpsStatusMessage('Usando seu endereço residencial cadastrado');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  const handleUseResidential = () => {
    setUserLocation(defaultResidential);
    setGpsStatusMessage('Usando seu endereço residencial cadastrado');
  };

  // Quick address helpers for form
  const handleSetFormOriginGPS = async () => {
    setIsLocatingGPS(true);
    try {
      const coords = await getCurrentGPSPosition();
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setFormData((prev) => ({
        ...prev,
        originAddress: addr,
        originLat: coords.lat,
        originLng: coords.lng,
      }));
    } catch (err: any) {
      alert(err?.message || 'Não foi possível capturar o GPS para a origem.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  const handleSetFormOriginResidential = () => {
    const addr = currentUser?.residentialAddress?.address || currentUser?.ponto_encontro_default?.address || 'Rua Fradique Coutinho, 1200 - Pinheiros';
    const lat = currentUser?.residentialAddress?.lat || currentUser?.ponto_encontro_default?.lat || -23.5539;
    const lng = currentUser?.residentialAddress?.lng || currentUser?.ponto_encontro_default?.lng || -46.6896;

    setFormData((prev) => ({
      ...prev,
      originAddress: addr,
      originLat: lat,
      originLng: lng,
    }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      alert('Você precisa estar logado para publicar uma carona ou pedido.');
      onOpenAuth?.('login');
      return;
    }

    // Past date and time verification
    const selectedRideDateTime = getRideDateTime(formData.departureDate, formData.departureTime);
    if (selectedRideDateTime && selectedRideDateTime.getTime() < Date.now()) {
      alert('Aviso de validação: A data e horário de partida não podem estar no passado. Por favor selecione uma data e horário futuro.');
      return;
    }

    const isOffer = formData.rideType === 'offer';

    // Regra de Governança para Caronas Vinculadas a Grupo:
    // Quem cria a viagem vinculada a grupo precisa ser motorista
    if (modalLinkMode === 'group' && isOffer && currentUser.rolePreference === 'passenger') {
      alert('Regra de Governança: Para oferecer viagens vinculadas a grupos, você precisa estar habilitado como motorista no seu perfil (veja na aba "Área do Usuário & Preferências").');
      return;
    }

    if (modalLinkMode === 'group' && !formData.targetGroupId) {
      alert('Por favor, selecione um grupo para vincular a carona.');
      return;
    }

    const allUserVehicles = getUserVehicles(currentUser);
    const selectedVeh = isOffer
      ? (allUserVehicles.find(
          (v) => (v.id && v.id === formData.selectedVehicleId) || v.plate === formData.selectedVehicleId
        ) || allUserVehicles[0] || currentUser.vehicle)
      : undefined;

    const isAvulsa = modalLinkMode === 'avulsa';
    const effectiveVisibility = isAvulsa ? 'public' : formData.visibility;
    const effectiveTargetGroupId = isAvulsa ? undefined : formData.targetGroupId;
    const effectiveTargetGroupName = isAvulsa ? undefined : formData.targetGroupName;

    onCreateRide({
      rideType: formData.rideType,
      description: isOffer ? (formData.description.trim() || undefined) : undefined,
      notes: isOffer ? (formData.notes.trim() || undefined) : undefined,
      driverVehicle: selectedVeh,
      origin: {
        address: formData.originAddress,
        lat: formData.originLat,
        lng: formData.originLng,
      },
      destination: {
        address: formData.destAddress,
        lat: formData.destLat,
        lng: formData.destLng,
      },
      departureDate: formData.departureDate,
      departureTime: formData.departureTime,
      totalSeats: isOffer ? Number(formData.totalSeats) : Number(formData.requestSeats || 1),
      price: isOffer ? Number(formData.price) : 0,
      visibility: effectiveVisibility,
      targetGroupId: effectiveTargetGroupId,
      targetGroupName: effectiveTargetGroupName,
      authorGroupIds: currentUser.groups || [],
      distanceKm: 8.5,
      estimatedDurationMin: 22,
      fuelCostEstimated: 7.20,
      estimatedCarbonSavingKg: 3.2,
      requesterNote: formData.rideType === 'request' ? formData.requesterNote : undefined,
      waypointsOrder: [
        { lat: formData.originLat, lng: formData.originLng, label: 'Origem', type: 'origin', orderIndex: 0 },
        { lat: formData.destLat, lng: formData.destLng, label: 'Destino Final', type: 'destination', orderIndex: 1 },
      ],
    });

    setShowModal(false);
    onClearInitialGroupForRide?.();
  };

  const handleOfferForRequest = (ride: Ride) => {
    if (!currentUser) {
      onOpenAuth?.('login');
      return;
    }
    setSelectedRideForWelcomeModal(ride);
  };

  const handleCompleteWithCelebration = (rideId: string) => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    onCompleteRide(rideId);
  };

  // 1. Minhas Caronas: Apenas caronas oferecidas ou solicitadas do usuário logado (Vazio para visitante)
  const myRides = useMemo(() => {
    if (!currentUser) return [];
    const seen = new Set<string>();
    return rides
      .filter((ride) => {
        if (!ride || !ride.id || seen.has(ride.id)) return false;
        const isDriver = ride.driverId === currentUser.id;
        const isAcceptedPassenger = ride.acceptedPassengers?.some((p) => p.userId === currentUser.id);
        const isPendingPassenger = ride.pendingRequests?.some((p) => p.userId === currentUser.id);
        const match = isDriver || isAcceptedPassenger || isPendingPassenger;
        if (match) {
          seen.add(ride.id);
          return true;
        }
        return false;
      })
      .filter((ride) => {
        if (myRidesFilterTab === 'upcoming') {
          return !isRideInPast(ride) || ride.status === 'em_andamento';
        }
        if (myRidesFilterTab === 'history') {
          return isRideInPast(ride) && ride.status !== 'em_andamento';
        }
        return true;
      })
      .sort((a, b) => {
        // Caronas em andamento têm prioridade máxima
        if (a.status === 'em_andamento' && b.status !== 'em_andamento') return -1;
        if (b.status === 'em_andamento' && a.status !== 'em_andamento') return 1;

        const dtA = getRideDateTime(a.departureDate, a.departureTime)?.getTime() || 0;
        const dtB = getRideDateTime(b.departureDate, b.departureTime)?.getTime() || 0;

        if (myRidesFilterTab === 'history') {
          return dtB - dtA; // Mais recentes primeiro no histórico
        }
        return dtA - dtB; // Próximas caronas em ordem cronológica ascendente
      });
  }, [rides, currentUser?.id, myRidesFilterTab]);

  // 2. Comunidade / Busca: Todas as caronas e pedidos ordenados por data/hora e proximidade da localização de referência
  const communityRidesWithDistance = useMemo(() => {
    const seen = new Set<string>();
    return rides
      .filter((ride) => {
        if (!ride || !ride.id || seen.has(ride.id)) return false;
        seen.add(ride.id);
        return true;
      })
      .map((ride) => {
        // Distance in km from user's active reference point to the ride origin
        const distanceKm = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          ride.origin.lat,
          ride.origin.lng
        );
        return {
          ...ride,
          distanceFromUser: distanceKm,
        };
      })
      .filter((ride) => {
        // Date & Time verification (Considers day, time and status - filters out past rides by default)
        const matchesTime = matchesDateTimeFilter(ride, {
          dateMode: dateFilterMode,
          customDate: customDate,
          timeMode: timeFilterMode,
          customTime: customTime,
          allowPast: showPastRides,
        });

        if (!matchesTime) {
          return false;
        }

        // Guest access (unauthenticated): ONLY offered rides and ONLY when actively searched
        if (!currentUser) {
          const hasActiveSearch = searchQuery.trim().length > 0 || searchGroupId !== 'all';
          if (!hasActiveSearch) {
            return false; // Não exibir caronas ativamente quando houver um acesso não logado
          }
          const currentRideType = ride.rideType || 'offer';
          if (currentRideType !== 'offer') {
            return false; // Acessos não logados podem pesquisar apenas por caronas oferecidas
          }
        }

        // Exclude current user's own rides/requests from search exploration (they appear in "Minhas Caronas e Viagens")
        // Exception: Superuser can see all rides for monitoring
        if (currentUser && !isSuper && ride.driverId === currentUser.id) {
          return false;
        }

        // Visibility check:
        // Superuser has total access to all groups
        if (ride.visibility === 'group' && !isSuper) {
          if (!currentUser) {
            // Unauthenticated guest can browse public rides or open campus offers
            return true;
          }
          const isDriver = ride.driverId === currentUser.id;
          const isAccepted = ride.acceptedPassengers?.some((p) => p.userId === currentUser.id);
          const isPending = ride.pendingRequests?.some((p) => p.userId === currentUser.id);
          
          if (!isDriver && !isAccepted && !isPending) {
            const authorGroups = ride.authorGroupIds && ride.authorGroupIds.length > 0
              ? ride.authorGroupIds
              : (ride.targetGroupId ? [ride.targetGroupId] : []);
              
            const hasCommonGroup = authorGroups.some((grpId) => (currentUser.groups || []).includes(grpId));
            if (!hasCommonGroup) {
              return false; // User does not share any group in common with the creator
            }
          }
        }

        // Filter by Type (All, Offers, Requests)
        const currentRideType = ride.rideType || 'offer';
        if (searchType !== 'all' && currentRideType !== searchType) {
          return false;
        }

        // Filter by Seats (if offer)
        if (currentRideType === 'offer') {
          const availableSeats = ride.totalSeats - ride.occupiedSeats;
          if (availableSeats < seatsFilter) return false;
        }

        // Filter by Group in Search
        if (searchGroupId !== 'all') {
          const authorGroups = ride.authorGroupIds && ride.authorGroupIds.length > 0
            ? ride.authorGroupIds
            : (ride.targetGroupId ? [ride.targetGroupId] : []);
          
          const inGroup = authorGroups.includes(searchGroupId) || ride.targetGroupId === searchGroupId;
          if (!inGroup) {
            return false;
          }
        }

        // Filter by Radius
        if (maxRadiusKm > 0 && ride.distanceFromUser > maxRadiusKm) {
          return false;
        }

        // Filter by Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesOrigin = (ride.origin.address || '').toLowerCase().includes(q);
          const matchesDest = (ride.destination.address || '').toLowerCase().includes(q);
          const matchesDriver = (ride.driverName || '').toLowerCase().includes(q);
          const matchesNote = (ride.requesterNote || '').toLowerCase().includes(q);
          if (!matchesOrigin && !matchesDest && !matchesDriver && !matchesNote) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort primarily by departure date/time ascending (soonest departures first)
        const dtA = getRideDateTime(a.departureDate, a.departureTime)?.getTime() || 0;
        const dtB = getRideDateTime(b.departureDate, b.departureTime)?.getTime() || 0;
        if (dtA !== dtB) return dtA - dtB;
        // Secondary sort by proximity
        return a.distanceFromUser - b.distanceFromUser;
      });
  }, [rides, currentUser, isSuper, userLocation, searchType, searchGroupId, maxRadiusKm, seatsFilter, dateFilterMode, customDate, timeFilterMode, customTime, showPastRides, searchQuery]);

  const activeRideForMap = rides.find((r) => r.id === activeTrackingRideId) || rides[0];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Minhas Viagens e Ações Rápidas */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Rede de Mobilidade Compartilhada
            </span>
            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Sincronização em Tempo Real
            </span>
            {isSuper && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                Superusuário (Acesso Total)
              </span>
            )}
            {!currentUser && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-emerald-700" />
                Modo Visitante (Acesso Público)
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">
            {currentUser ? `Olá, ${currentUser.name.split(' ')[0]}!` : 'Bem-vindo ao Caronas!'}
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            {currentUser
              ? isSuper
                ? 'Painel Superusuário: Você possui acesso total para visualizar todas as viagens, aprovar solicitações e gerenciar a mobilidade corporativa.'
                : 'Gerencie suas viagens ativas ou explore caronas e pedidos de mobilidade de colegas da sua rede.'
              : 'Navegue pelas ofertas de caronas disponíveis na comunidade. Para visualizar contatos telefônicos, chaves PIX ou aderir a uma carona, realize o login.'}
          </p>
        </div>

        {/* Dual Actions: Oferecer Carona ou Fazer Pedido */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
          {!currentUser ? (
            <button
              id="btn-guest-login-cta"
              onClick={() => onOpenAuth?.('login')}
              className="px-5 py-3.5 sm:py-2.5 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>Entrar / Cadastrar para Participar</span>
            </button>
          ) : (
            <>
              <button
                id="btn-open-request-modal"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, rideType: 'request' }));
                  setModalMode('request');
                  setShowModal(true);
                }}
                className="px-4 py-3.5 sm:py-2.5 min-h-[48px] bg-white hover:bg-slate-50 border border-indigo-300 text-indigo-700 font-bold text-sm sm:text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
              >
                <HandMetal className="w-4 h-4 text-indigo-600" />
                <span>Pedir Carona</span>
              </button>

              <button
                id="btn-open-offer-modal"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, rideType: 'offer' }));
                  setModalMode('offer');
                  setShowModal(true);
                }}
                className="px-5 py-3.5 sm:py-2.5 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Oferecer Carona</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ABAS PRINCIPAIS: 1. MINHAS CARONAS & VIAGENS / 2. BUSCAR CARONAS OFERECIDAS OU PEDIDAS */}
      <div className="flex items-center p-1.5 bg-slate-100/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-2xs gap-1.5">
        {currentUser && (
          <button
            id="tab-btn-my-rides"
            onClick={() => setActiveMainTab('my_rides')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeMainTab === 'my_rides'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Car className={`w-4 h-4 ${activeMainTab === 'my_rides' ? 'text-indigo-600' : 'text-slate-500'}`} />
            <span>Minhas Caronas & Viagens</span>
            <span className={`px-2 py-0.5 text-[11px] font-mono rounded-full font-bold ${
              activeMainTab === 'my_rides' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {myRides.length}
            </span>
            {activePassengerLiveRide && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-0.5" title="Viagem ao vivo em andamento"></span>
            )}
          </button>
        )}

        <button
          id="tab-btn-search-rides"
          onClick={() => setActiveMainTab('search_rides')}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMainTab === 'search_rides' || !currentUser
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Search className={`w-4 h-4 ${activeMainTab === 'search_rides' || !currentUser ? 'text-indigo-600' : 'text-slate-500'}`} />
          <span>Buscar Caronas Oferecidas ou Pedidas</span>
          <span className={`px-2 py-0.5 text-[11px] font-mono rounded-full font-bold ${
            activeMainTab === 'search_rides' || !currentUser ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
          }`}>
            {communityRidesWithDistance.length}
          </span>
        </button>
      </div>

      {/* ABA 1: MINHAS CARONAS & VIAGENS (Apenas do usuário logado) */}
      {currentUser && activeMainTab === 'my_rides' && (
        <section id="my-rides-section" className="space-y-4 animate-in fade-in duration-200">
        {/* Active In-Progress Live Ride Alert Banner for Passenger */}
        {activePassengerLiveRide && (
          <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 rounded-3xl p-5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in border border-white/20">
            <div className="flex items-start sm:items-center space-x-3.5 w-full sm:w-auto">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shrink-0 flex items-center justify-center ring-2 ring-white/30">
                <Radio className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider bg-white/25 px-2.5 py-0.5 rounded-full">
                    GPS Ao Vivo Ativo
                  </span>
                  <span className="text-xs text-white/90">
                    Motorista: <strong className="text-white">{activePassengerLiveRide.driverName}</strong>
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">
                  Seu motorista iniciou o trajeto! Acompanhe a rota e localização em tempo real no mapa.
                </p>
              </div>
            </div>
            <button
              id={`btn-banner-live-track-${activePassengerLiveRide.id}`}
              onClick={() => setSelectedRideForPassengerTrackingModal(activePassengerLiveRide)}
              className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-white text-indigo-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center space-x-2"
            >
              <Navigation className="w-4 h-4 text-indigo-600" />
              <span>Acompanhar ao Vivo</span>
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900">
                Minhas Caronas & Viagens
              </h3>
              <p className="text-xs text-slate-500">
                Exibindo inicialmente as próximas caronas por ordem cronológica
              </p>
            </div>
          </div>
          
          {/* Sub-tabs: Próximas (Default) / Todas / Histórico */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
            <button
              onClick={() => setMyRidesFilterTab('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                myRidesFilterTab === 'upcoming'
                  ? 'bg-white text-emerald-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Próximas</span>
            </button>
            <button
              onClick={() => setMyRidesFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                myRidesFilterTab === 'all'
                  ? 'bg-white text-indigo-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setMyRidesFilterTab('history')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                myRidesFilterTab === 'history'
                  ? 'bg-white text-slate-800 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3 h-3" />
              <span>Histórico</span>
            </button>
          </div>
        </div>

        {myRides.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <Route className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-base">
                {myRidesFilterTab === 'upcoming'
                  ? 'Você não possui próximas caronas agendadas'
                  : myRidesFilterTab === 'history'
                  ? 'Nenhum histórico de caronas anteriores'
                  : 'Você não possui caronas ativas no momento'}
              </h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Ofereça vagas nos dias em que for dirigir ou busque por caronas e pedidos disponíveis na comunidade.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, rideType: 'offer' }));
                  setModalMode('offer');
                  setShowModal(true);
                }}
                className="px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Oferecer Carona</span>
              </button>
              <button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, rideType: 'request' }));
                  setModalMode('request');
                  setShowModal(true);
                }}
                className="px-4 py-2.5 min-h-[44px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                <HandMetal className="w-4 h-4 text-indigo-600" />
                <span>Pedir Carona</span>
              </button>
              <button
                onClick={() => setActiveMainTab('search_rides')}
                className="px-4 py-2.5 min-h-[44px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                <Search className="w-4 h-4 text-indigo-600" />
                <span>Buscar Caronas na Comunidade</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {myRides.map((ride) => {
              const isDriver = ride.driverId === currentUser.id;
              const isRequest = ride.rideType === 'request';
              const isAccepted = ride.acceptedPassengers.some((p) => p.userId === currentUser.id);
              const isPending = ride.pendingRequests.some((p) => p.userId === currentUser.id);

              return (
                <div
                  key={ride.id}
                  className={`bg-white border rounded-3xl p-5 shadow-xs space-y-4 transition ${
                    activeTrackingRideId === ride.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={ride.driverAvatar}
                        alt={ride.driverName}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                      />
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base sm:text-sm">{ride.driverName}</span>
                          {isDriver && (
                            <span className="px-2.5 py-0.5 text-xs sm:text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                              {isRequest ? 'Seu Pedido de Carona' : 'Você é o Motorista'}
                            </span>
                          )}
                          {!isDriver && isAccepted && (
                            <span className="px-2.5 py-0.5 text-xs sm:text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                              <Check className="w-3 h-3" /> Vaga Garantida
                            </span>
                          )}
                          {!isDriver && isPending && (
                            <span className="px-2.5 py-0.5 text-xs sm:text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                              Aguardando Aprovação
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                          {isRequest ? (
                            <span>Solicitação de Passageiro</span>
                          ) : (
                            <>
                              <Car className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>{ride.driverVehicle?.model || 'Veículo Registrado'}</span>
                              {ride.driverVehicle?.color && <span>• {ride.driverVehicle.color}</span>}
                              {ride.driverVehicle?.plate && (
                                <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  {ride.driverVehicle.plate}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5">
                      {ride.targetGroupId ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Users className="w-3.5 h-3.5" />
                          <span>Grupo: {ride.targetGroupName || 'Grupo Fechado'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Carona Avulsa (Pública)</span>
                        </span>
                      )}

                      {isRequest ? (
                        <div className="text-right">
                          {ride.price && ride.price > 0 ? (
                            <div className="text-sm font-bold text-emerald-700 font-mono">
                              R$ {ride.price.toFixed(2)} <span className="text-[10px] font-sans font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">Acolhida</span>
                            </div>
                          ) : ride.proposals && ride.proposals.length > 0 ? (
                            <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 inline-block animate-pulse">
                              {ride.proposals.filter(p => p.status === 'pending').length || ride.proposals.length} proposta(s)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                              Aguardando Oferta
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-slate-900 font-mono">
                          R$ {(ride.price ?? 0).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ride Description Headline (if provided) */}
                  {ride.description && (
                    <div className="px-3.5 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center space-x-2 text-xs font-bold text-indigo-900">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{ride.description}</span>
                    </div>
                  )}

                  {/* Route & Schedule */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-sm sm:text-xs">
                    <div className="flex items-start space-x-2.5">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-500 font-medium text-xs">Origem:</span>
                        <p className="text-slate-900 font-semibold leading-snug">{ride.origin.address}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2.5">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-500 font-medium text-xs">Destino:</span>
                        <p className="text-slate-900 font-semibold leading-snug">{ride.destination.address}</p>
                      </div>
                    </div>

                    {ride.requesterNote && (
                      <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-900 italic">
                        "{ride.requesterNote}"
                      </div>
                    )}

                    {ride.notes && (
                      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700">
                        <span className="font-bold text-slate-900 block text-[11px] mb-0.5">Observações da Carona:</span>
                        <span>"{ride.notes}"</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 font-mono text-xs text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          <span>Data</span>
                        </span>
                        <span className="font-sans font-semibold text-slate-900 block truncate" title={ride.departureDate}>
                          {formatRideFriendlyDate(ride.departureDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>Horário</span>
                        </span>
                        <span className="font-bold text-slate-900">{ride.departureTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Vagas</span>
                        <span className="font-bold text-slate-900">
                          {ride.occupiedSeats}/{ride.totalSeats}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Status</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-sans font-bold inline-block ${
                          ride.status === 'em_andamento'
                            ? 'bg-amber-100 text-amber-800'
                            : ride.status === 'concluida' || isRideInPast(ride)
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {ride.status === 'em_andamento' ? 'Em Viagem' : (ride.status === 'concluida' || isRideInPast(ride)) ? 'Encerrada' : 'Agendada'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Driver Pending Requests for Offers */}
                  {!isRequest && isDriver && ride.pendingRequests.length > 0 && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-2.5">
                      <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Solicitações de Embarque ({ride.pendingRequests.length}):</span>
                      </div>
                      <div className="space-y-2">
                        {ride.pendingRequests.map((req, idx) => (
                          <div
                            key={`${req.userId}-${idx}`}
                            className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center space-x-2.5">
                              <img src={req.userAvatar} alt={req.userName} className="w-8 h-8 rounded-full object-cover" />
                              <div>
                                <p className="text-xs font-bold text-slate-900">{req.userName}</p>
                                <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                  {req.meetingPoint.address}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                onClick={() => onAcceptRequest(ride.id, req)}
                                className="px-3.5 py-1.5 min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                Aceitar
                              </button>
                              <button
                                onClick={() => onRejectRequest(ride.id, req.userId)}
                                className="px-3 py-1.5 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                Recusar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ride Request Welcome Proposals (Propostas de Acolhimento do Motorista) */}
                  {isRequest && ride.proposals && ride.proposals.length > 0 && (
                    <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-indigo-950 font-bold text-xs">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>Propostas de Acolhimento Recebidas ({ride.proposals.length}):</span>
                        </div>
                        <span className="text-[10px] font-semibold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                          Aprovação Necessária
                        </span>
                      </div>

                      <p className="text-[11px] text-indigo-900 leading-relaxed">
                        Motoristas se ofereceram para acolher seu pedido. O valor não é gratuito e corresponde à oferta do motorista. Aprove a proposta desejada para oficializar seu embarque.
                      </p>

                      <div className="space-y-2.5">
                        {ride.proposals.map((proposal) => {
                          const isAccepted = proposal.status === 'accepted';
                          const isRejected = proposal.status === 'rejected';
                          const isPending = !proposal.status || proposal.status === 'pending';

                          return (
                            <div
                              key={proposal.id}
                              className={`p-3.5 rounded-xl border transition-all ${
                                isAccepted
                                  ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-400/30'
                                  : isRejected
                                  ? 'bg-slate-100/80 border-slate-200 opacity-60'
                                  : 'bg-white border-indigo-200 shadow-xs'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex items-start space-x-3">
                                  <img
                                    src={proposal.driverAvatar}
                                    alt={proposal.driverName}
                                    className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-400 shrink-0"
                                  />
                                  <div>
                                    <div className="flex items-center space-x-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-slate-900">{proposal.driverName}</span>
                                      <span className="text-[10px] text-amber-600 font-bold">★ {proposal.driverRating?.toFixed(1) || '5.0'}</span>
                                      {isAccepted && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Proposta Aprovada (Confirmada)
                                        </span>
                                      )}
                                      {isRejected && (
                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md">
                                          Recusada
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <Car className="w-3 h-3 text-slate-500" />
                                      <span>{proposal.driverVehicle?.model || 'Veículo do Motorista'}</span>
                                      {proposal.driverVehicle?.plate && (
                                        <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                                          {proposal.driverVehicle.plate}
                                        </span>
                                      )}
                                      {proposal.mode === 'existing_ride' && (
                                        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-md">
                                          🛣️ Trajeto Próximo ({proposal.destinationDistanceKm !== undefined ? `${proposal.destinationDistanceKm.toFixed(1)} km` : 'Compatível'})
                                        </span>
                                      )}
                                      {proposal.mode === 'new_ride' && (
                                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-md">
                                          ✨ Nova Viagem Criada
                                        </span>
                                      )}
                                    </div>
                                    {proposal.existingRideTitle && (
                                      <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
                                        Carona: {proposal.existingRideTitle}
                                      </div>
                                    )}
                                    {proposal.notes && (
                                      <p className="text-[11px] text-slate-700 mt-1 italic bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                                        "{proposal.notes}"
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Price & Actions */}
                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                                  <div className="text-left sm:text-right">
                                    <div className="text-sm font-bold font-mono text-emerald-700">
                                      R$ {proposal.offeredPrice.toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1 sm:justify-end">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{proposal.departureTime}</span>
                                    </div>
                                  </div>

                                  {isPending && (
                                    <div className="flex items-center space-x-1.5">
                                      <button
                                        id={`btn-accept-proposal-${proposal.id}`}
                                        onClick={() => onAcceptProposal?.(ride.id, proposal.id)}
                                        className="px-3.5 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer flex items-center space-x-1 shadow-xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Aprovar & Entrar na Carona</span>
                                      </button>
                                      <button
                                        id={`btn-reject-proposal-${proposal.id}`}
                                        onClick={() => onRejectProposal?.(ride.id, proposal.id)}
                                        className="px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer"
                                        title="Recusar proposta"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Accepted Passengers */}
                  {ride.acceptedPassengers.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Passageiros Confirmados:
                      </span>
                      <div className="flex items-center space-x-2 overflow-x-auto py-1">
                        {ride.acceptedPassengers.map((p, idx) => (
                          <div
                            key={`${p.userId}-${idx}`}
                            className="flex items-center space-x-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs text-slate-800 shrink-0 font-medium"
                          >
                            <img src={p.userAvatar} alt={p.userName} className="w-4 h-4 rounded-full object-cover" />
                            <span>{p.userName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <button
                      onClick={() => {
                        if (isDriver && ride.status === 'em_andamento') {
                          setSelectedRideForNavigationModal(ride);
                        } else {
                          setSelectedRideForRouteModal(ride);
                        }
                        setActiveTrackingRideId(ride.id);
                      }}
                      className="min-h-[44px] py-2 px-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 rounded-xl flex items-center justify-center sm:justify-start space-x-1.5 transition cursor-pointer"
                    >
                      <Navigation className="w-4 h-4 text-indigo-600" />
                      <span>{isDriver && ride.status === 'em_andamento' ? 'Navegação GPS Ativa' : 'Ver no Mapa GPS'}</span>
                    </button>

                    {isDriver ? (
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        {ride.status === 'agendada' && (
                          <button
                            id={`btn-start-ride-${ride.id}`}
                            onClick={() => handleStartRideWithNavigation(ride)}
                            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
                          >
                            <Play className="w-4 h-4" />
                            <span>Iniciar Viagem & Navegação</span>
                          </button>
                        )}
                        {ride.status === 'em_andamento' && (
                          <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <button
                              id={`btn-open-nav-${ride.id}`}
                              onClick={() => setSelectedRideForNavigationModal(ride)}
                              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer ring-2 ring-emerald-500/30"
                            >
                              <Navigation className="w-4 h-4 animate-pulse" />
                              <span>Abrir GPS</span>
                            </button>
                            <button
                              onClick={() => handleCompleteWithCelebration(ride.id)}
                              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Concluir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full sm:w-auto">
                        {isAccepted ? (
                          ride.status === 'em_andamento' ? (
                            <button
                              id={`btn-live-track-card-${ride.id}`}
                              onClick={() => setSelectedRideForPassengerTrackingModal(ride)}
                              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer ring-2 ring-pink-400/30 animate-pulse"
                            >
                              <Radio className="w-4 h-4 animate-ping" />
                              <span>Acompanhar Trajeto (GPS)</span>
                            </button>
                          ) : (
                            <span className="w-full sm:w-auto min-h-[44px] text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span>Vaga Confirmada</span>
                            </span>
                          )
                        ) : (
                          <span className="w-full sm:w-auto min-h-[44px] text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-xl font-semibold flex items-center justify-center space-x-1.5">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span>Aguardando Aprovação</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* ABA 2: ÁREA DE BUSCA & VISUALIZAÇÃO DE CARONAS E PEDIDOS DA COMUNIDADE */}
      {(activeMainTab === 'search_rides' || !currentUser) && (
        <section id="search-community-section" className="space-y-5 pt-2 animate-in fade-in duration-200">
        {/* Header & Location Reference Status */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900">
                  Buscar Caronas Oferecidas ou Pedidas
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Explore ofertas de vagas e pedidos de carona na rede ordenados por data e proximidade
              </p>
            </div>

            {/* Location Reference Controller (GPS vs Residential) */}
            <div className="flex items-center gap-2 flex-wrap bg-slate-50 border border-slate-200 p-2 rounded-2xl">
              <div className="flex items-center space-x-1.5 px-2">
                {userLocation.source === 'gps' ? (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                ) : (
                  <Home className="w-4 h-4 text-indigo-600" />
                )}
                <span className="text-xs font-bold text-slate-800">
                  {userLocation.source === 'gps' ? 'GPS Atual' : 'Residência'}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleRequestGPS}
                  disabled={isLocatingGPS}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center space-x-1 min-h-[36px] ${
                    userLocation.source === 'gps'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Capturar sinal do GPS do dispositivo"
                >
                  {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                  <span>Usar GPS</span>
                </button>

                <button
                  onClick={handleUseResidential}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center space-x-1 min-h-[36px] ${
                    userLocation.source === 'residential'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Usar endereço cadastrado em seu perfil"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Residência</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reference address notification label */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50/80 px-3.5 py-2.5 rounded-xl border border-slate-100 font-medium">
            <span className="truncate max-w-[85%]">
              📍 Ponto de Referência: <span className="font-bold text-slate-800">{userLocation.label}</span>
            </span>
            {gpsStatusMessage && (
              <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                {gpsStatusMessage}
              </span>
            )}
          </div>

          {/* Search Inputs & Filter Grid */}
          <div className="space-y-3 pt-2">
            {/* Search query input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por bairro, endereço, destino (ex: Butantã, Poli USP, Faria Lima)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 pl-11 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-xs px-2 py-1 bg-slate-200 rounded-md"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              {/* Type Filter */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tipo:</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Todas as Publicações</option>
                  <option value="offer">🚗 Ofertas de Carona</option>
                  <option value="request">🙋‍♂️ Pedidos de Carona</option>
                </select>
              </div>

              {/* Date Filter Mode */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Data da Viagem:</span>
                </label>
                <select
                  value={dateFilterMode}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setDateFilterMode(val);
                    if (val === 'custom' && !customDate) {
                      setCustomDate(getRelativeDateStr(0));
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all_future">Todas Futuras</option>
                  <option value="today">📅 Somente Hoje</option>
                  <option value="tomorrow">☀️ Somente Amanhã</option>
                  <option value="this_week">🗓️ Próximos 7 Dias</option>
                  <option value="custom">🎯 Escolher Data...</option>
                </select>
              </div>

              {/* Time Range Filter Mode */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Horário / Turno:</span>
                </label>
                <select
                  value={timeFilterMode}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setTimeFilterMode(val);
                    if (val === 'custom' && !customTime) {
                      setCustomTime(getUpcomingTimeStr(0));
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Qualquer Horário</option>
                  <option value="from_now">⏰ A Partir de Agora</option>
                  <option value="morning">🌅 Manhã (05h - 12h)</option>
                  <option value="afternoon">🌆 Tarde (12h - 18h)</option>
                  <option value="night">🌙 Noite (18h+)</option>
                  <option value="custom">🎯 A partir de...</option>
                </select>
              </div>

              {/* Radius Filter */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Raio Máximo:</label>
                <select
                  value={maxRadiusKm}
                  onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={0}>Sem limite de raio</option>
                  <option value={3}>Até 3 km</option>
                  <option value={5}>Até 5 km</option>
                  <option value={10}>Até 10 km</option>
                  <option value={20}>Até 20 km</option>
                </select>
              </div>

              {/* Group Filter */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Grupo / Comunidade:</label>
                <select
                  value={searchGroupId}
                  onChange={(e) => setSearchGroupId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Todos os Grupos / Públicas</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Minimum Seats Filter */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Vagas Mínimas:</label>
                <select
                  value={seatsFilter}
                  onChange={(e) => setSeatsFilter(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={1}>1 Vaga Livre</option>
                  <option value={2}>2 Vagas Livres</option>
                  <option value={3}>3 Vagas Livres</option>
                </select>
              </div>
            </div>

            {/* Custom Date / Time inputs when 'custom' is active */}
            {(dateFilterMode === 'custom' || timeFilterMode === 'custom') && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
                <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filtro de Data e Horário Específico:</span>
                </span>
                
                {dateFilterMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <label className="text-indigo-900 font-medium">Dia:</label>
                    <input
                      type="date"
                      min={getRelativeDateStr(0)}
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="bg-white border border-indigo-300 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {timeFilterMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <label className="text-indigo-900 font-medium">A partir das:</label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="bg-white border border-indigo-300 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Quick Filters / Preset Chips & Past rides toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold text-[11px] mr-1">Atalhos de Horário:</span>
                <button
                  type="button"
                  onClick={() => {
                    setDateFilterMode('all_future');
                    setTimeFilterMode('all');
                    setShowPastRides(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    dateFilterMode === 'all_future' && timeFilterMode === 'all'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ⚡ Todas as Futuras
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateFilterMode('today');
                    setTimeFilterMode('from_now');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    dateFilterMode === 'today' && timeFilterMode === 'from_now'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  📅 Próximas Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateFilterMode('tomorrow');
                    setTimeFilterMode('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    dateFilterMode === 'tomorrow'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ☀️ Saídas Amanhã
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilterMode('morning')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    timeFilterMode === 'morning'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🌅 Manhã (05h-12h)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilterMode('afternoon')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    timeFilterMode === 'afternoon'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🌆 Tarde (12h-18h)
                </button>

                {(dateFilterMode !== 'all_future' || timeFilterMode !== 'all' || showPastRides) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterMode('all_future');
                      setTimeFilterMode('all');
                      setCustomDate('');
                      setCustomTime('');
                      setShowPastRides(false);
                    }}
                    className="px-2.5 py-1 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpar Filtros Temporais</span>
                  </button>
                )}
              </div>

              {/* Toggle to include past rides if user explicitly wants history search */}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer hover:text-slate-900 select-none">
                <input
                  type="checkbox"
                  checked={showPastRides}
                  onChange={(e) => setShowPastRides(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span>Incluir caronas com horário já passado</span>
              </label>
            </div>
          </div>
        </div>

        {/* Results Counter, Ordering & View Mode Switcher (List vs Map) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 p-2.5 sm:p-3 rounded-2xl border border-slate-200">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900 text-sm sm:text-base">
              Resultados Próximos ({communityRidesWithDistance.length})
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              • Ordenados por proximidade da origem
            </span>
          </div>

          {/* List vs Map Switcher */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
            <button
              onClick={() => setSearchViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                searchViewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>

            <button
              onClick={() => setSearchViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                searchViewMode === 'map'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Visão de Mapa</span>
            </button>
          </div>
        </div>

        {communityRidesWithDistance.length === 0 ? (
          !currentUser && !searchQuery.trim() && searchGroupId === 'all' ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <h4 className="font-display font-bold text-slate-900 text-xl">
                  Pesquise Caronas por Origem ou Destino
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Para garantir a segurança e privacidade da comunidade, as caronas não são listadas abertamente sem pesquisa. Digite o local de embarque, faculdade, empresa ou endereço desejado acima.
                </p>
              </div>

              {/* Popular quick-search hubs */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Sugestões de Polos e Destinos Populares:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
                  {[
                    'USP Butantã',
                    'Av. Paulista',
                    'Faria Lima',
                    'Berrini',
                    'Alphaville',
                    'Mackenzie',
                    'Insper',
                    'Centro / Sé',
                    'Santo Amaro',
                  ].map((hub) => (
                    <button
                      key={hub}
                      type="button"
                      onClick={() => setSearchQuery(hub)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer active:scale-95"
                    >
                      📍 {hub}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('login')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Fazer Login na Conta</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('register')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Criar Cadastro Gratuito
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-900 text-base">Nenhuma carona encontrada para sua pesquisa</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tente buscar por termos mais amplos (ex: nome do bairro ou universidade), ampliar a distância ou alterar o horário.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchType('all');
                  setSearchGroupId('all');
                  setMaxRadiusKm(0);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Limpar Pesquisa
              </button>
            </div>
          )
        ) : searchViewMode === 'map' ? (
          <NearbyRidesMapView
            rides={communityRidesWithDistance}
            userLocation={userLocation}
            currentUser={currentUser}
            groups={groups}
            maxRadiusKm={maxRadiusKm}
            onJoinRide={onJoinRide}
            onOfferForRequest={handleOfferForRequest}
            onOpenAuth={onOpenAuth}
            onSelectTracking={(rideId) => {
              setActiveTrackingRideId(rideId);
              const foundRide = rides.find((r) => r.id === rideId);
              if (foundRide) {
                setSelectedRideForRouteModal(foundRide);
              }
              const trackElem = document.getElementById('tracking-section');
              if (trackElem) {
                trackElem.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {communityRidesWithDistance.map((ride) => {
              const isOffer = (ride.rideType || 'offer') === 'offer';
              const isDriver = currentUser ? ride.driverId === currentUser.id : false;
              const isGroupMember = currentUser ? (ride.visibility === 'group' && ride.targetGroupId && currentUser.groups.includes(ride.targetGroupId)) : false;
              const isAccepted = currentUser ? ride.acceptedPassengers.some((p) => p.userId === currentUser.id) : false;
              const isPending = currentUser ? ride.pendingRequests.some((p) => p.userId === currentUser.id) : false;
              const isFull = ride.occupiedSeats >= ride.totalSeats;

              const isRidePast = isRideInPast(ride);

              return (
                <div
                  key={ride.id}
                  className={`bg-white border rounded-3xl p-5 shadow-xs space-y-4 transition ${
                    activeTrackingRideId === ride.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
                  } ${isRidePast ? 'opacity-75 bg-slate-50/50' : ''}`}
                >
                  {/* Card Header: Driver/Requester, Proximity Badge & Type */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={ride.driverAvatar}
                        alt={ride.driverName}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                      />
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base sm:text-sm">{ride.driverName}</span>
                          {isOffer ? (
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                              🚗 Oferta de Carona
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                              🙋‍♂️ Pedido de Carona
                            </span>
                          )}
                          {isSuper && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md flex items-center gap-0.5">
                              <Crown className="w-3 h-3 text-amber-600" />
                              Superusuário
                            </span>
                          )}
                          {isRidePast && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded-md">
                              ⏰ Partida Passada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          {isOffer ? (ride.driverVehicle?.model || 'Veículo Registrado') : 'Passageiro Solicitante'}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5">
                      {/* Proximity Badge (Distance from user) */}
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        (ride.distanceFromUser ?? 0) <= 3
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : (ride.distanceFromUser ?? 0) <= 7
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        <LocateFixed className="w-3.5 h-3.5" />
                        <span>A {(ride.distanceFromUser ?? 0).toFixed(1)} km de você</span>
                      </span>

                      {isOffer ? (
                        <div className="text-sm font-bold text-slate-900 font-mono">
                          R$ {(ride.price ?? 0).toFixed(2)} / vaga
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                          {ride.price && ride.price > 0
                            ? `R$ ${ride.price.toFixed(2)}`
                            : ride.proposals && ride.proposals.length > 0
                            ? `${ride.proposals.length} proposta(s)`
                            : 'A definir na oferta'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Route details */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-sm sm:text-xs">
                    <div className="flex items-start space-x-2.5">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-500 font-medium text-xs">Origem (Embarque):</span>
                        <p className="text-slate-900 font-semibold leading-snug">{ride.origin.address}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2.5">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-500 font-medium text-xs">Destino Final:</span>
                        <p className="text-slate-900 font-semibold leading-snug">{ride.destination.address}</p>
                      </div>
                    </div>

                    {ride.requesterNote && (
                      <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 italic">
                        "{ride.requesterNote}"
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 font-mono text-xs text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          <span>Data</span>
                        </span>
                        <span className="font-sans font-semibold text-slate-900 block truncate" title={ride.departureDate}>
                          {formatRideFriendlyDate(ride.departureDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>Horário</span>
                        </span>
                        <span className="font-bold text-slate-900">{ride.departureTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                          {isOffer ? 'Vagas Livres' : 'Vagas Pedidas'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {isOffer ? `${ride.totalSeats - ride.occupiedSeats} livres` : `${ride.totalSeats} vaga`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Modalidade</span>
                        <span className="truncate block font-sans font-medium text-slate-800">
                          {ride.targetGroupId ? `Grupo: ${ride.targetGroupName || 'Fechado'}` : 'Carona Avulsa'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Community Cards */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <button
                      onClick={() => {
                        setSelectedRideForRouteModal(ride);
                        setActiveTrackingRideId(ride.id);
                      }}
                      className="min-h-[44px] py-2 px-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 rounded-xl flex items-center justify-center sm:justify-start space-x-1.5 transition cursor-pointer"
                    >
                      <Navigation className="w-4 h-4 text-indigo-600" />
                      <span>Ver Trajeto no Mapa</span>
                    </button>

                    {isRidePast ? (
                      <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-500 text-xs font-medium rounded-xl flex items-center justify-center">
                        Horário de Saída já Ocorrido
                      </span>
                    ) : !currentUser ? (
                      <button
                        id={`btn-community-join-${ride.id}`}
                        onClick={() => onOpenAuth?.('login')}
                        className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-300" />
                        <span>🔒 Entrar para Aderir à Carona</span>
                      </button>
                    ) : isDriver ? (
                      <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-600 text-xs font-bold rounded-xl flex items-center justify-center">
                        Sua Publicação
                      </span>
                    ) : isOffer ? (
                      <div>
                        {isAccepted ? (
                          <span className="px-4 py-2 min-h-[44px] bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-emerald-200">
                            <Check className="w-4 h-4" /> Vaga Confirmada
                          </span>
                        ) : isPending ? (
                          <span className="px-4 py-2 min-h-[44px] bg-amber-50 text-amber-800 text-xs font-bold rounded-xl flex items-center justify-center border border-amber-200">
                            Solicitação Enviada
                          </span>
                        ) : isFull ? (
                          <span className="px-4 py-2 min-h-[44px] bg-slate-100 text-slate-500 text-xs font-medium rounded-xl flex items-center justify-center">
                            Vagas Esgotadas
                          </span>
                        ) : ride.targetGroupId && !isGroupMember && !isSuper ? (
                          <button
                            id={`btn-community-join-${ride.id}`}
                            onClick={() => alert(`Acesso Restrito: Esta carona está vinculada exclusivamente ao grupo "${ride.targetGroupName || 'Grupo Fechado'}". Apenas membros aprovados do grupo podem reservar vagas. Solicite sua adesão ao grupo na aba "Grupos & Comunidades".`)}
                            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5 border border-slate-300"
                            title="Apenas membros do grupo podem reservar vagas"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Restrito ao Grupo ({ride.targetGroupName || 'Membros'})</span>
                          </button>
                        ) : (
                          <button
                            id={`btn-community-join-${ride.id}`}
                            onClick={() => onJoinRide(ride.id, isGroupMember)}
                            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                          >
                            {ride.targetGroupId ? (
                              <>
                                <Sparkles className="w-4 h-4 text-amber-300" />
                                <span>Confirmar Vaga (Membro)</span>
                              </>
                            ) : (
                              <>
                                <Users className="w-4 h-4" />
                                <span>Reservar Vaga (Avulsa)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        id={`btn-community-welcome-${ride.id}`}
                        onClick={() => handleOfferForRequest(ride)}
                        className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Acolher Pedido de Carona</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* SEÇÃO 3: RASTREAMENTO GPS & MAPA DINÂMICO (quando houver carona em foco) */}
      {activeRideForMap && (
        <section id="tracking-section" className="space-y-3 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h3 className="text-base font-display font-bold text-slate-900">
                Rastreamento GPS & Mapa de Rota Interativa
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Carona em Foco: {activeRideForMap.driverName} ({activeRideForMap.departureTime})
            </span>
          </div>

          <LiveRideMap
            ride={activeRideForMap}
            isDriver={currentUser ? activeRideForMap.driverId === currentUser.id : false}
            isAcceptedPassenger={currentUser ? activeRideForMap.acceptedPassengers.some((p) => p.userId === currentUser.id) : false}
            onCompleteRide={() => handleCompleteWithCelebration(activeRideForMap.id)}
          />
        </section>
      )}

      {/* MODAL: OFERECER CARONA OU FAZER PEDIDO DE CARONA */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl ${formData.rideType === 'offer' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {formData.rideType === 'offer' ? <Car className="w-5 h-5" /> : <HandMetal className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base">
                    {formData.rideType === 'offer' ? 'Publicar Oferta de Carona' : 'Publicar Pedido de Carona'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formData.rideType === 'offer' ? 'Disponibilize vagas e compartilhe os custos' : 'Encontre motoristas disponíveis no seu trajeto'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  onClearInitialGroupForRide?.();
                }}
                className="text-slate-400 hover:text-slate-600 text-sm p-2 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Banner de Viagem Herdada do Grupo */}
            {formData.targetGroupName && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-indigo-900 animate-in fade-in">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <span className="font-bold block">✨ Viagem Herdada do Grupo: {formData.targetGroupName}</span>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    O <strong>destino padrão</strong>, <strong>valor sugerido</strong> (R$ {(formData.price ?? 6.5).toFixed(2)}) e <strong>horário</strong> ({formData.departureTime}) foram preenchidos automaticamente a partir do grupo. Ajuste apenas o seu local de partida como motorista.
                  </p>
                </div>
              </div>
            )}

            {/* Type Switch Tabs */}
            <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, rideType: 'offer' })}
                className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm sm:text-xs flex items-center justify-center space-x-2 transition cursor-pointer ${
                  formData.rideType === 'offer'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Car className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Oferecer Vagas (Motorista)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, rideType: 'request' })}
                className={`flex-1 py-3 min-h-[48px] rounded-xl font-bold text-sm sm:text-xs flex items-center justify-center space-x-2 transition cursor-pointer ${
                  formData.rideType === 'request'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HandMetal className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pedir Carona (Passageiro)</span>
              </button>
            </div>

            {/* Modalidade do Vínculo: Carona Avulsa vs Grupo */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-slate-800 font-bold text-sm sm:text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Modalidade do Vínculo da Carona:</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Governança</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalLinkMode('avulsa');
                    setFormData((prev) => ({
                      ...prev,
                      targetGroupId: undefined,
                      targetGroupName: undefined,
                      visibility: 'public',
                    }));
                  }}
                  className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition active:scale-95 cursor-pointer ${
                    modalLinkMode === 'avulsa'
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Globe className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-slate-900">Carona Avulsa (Pública)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Sem vínculo com grupo. Aberta publicamente para toda a comunidade.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalLinkMode('group');
                    const firstGrp = availableGroupsForUser[0];
                    if (firstGrp) {
                      setFormData((prev) => ({
                        ...prev,
                        targetGroupId: firstGrp.id,
                        targetGroupName: firstGrp.name,
                        destAddress: firstGrp.defaultDestination?.address || prev.destAddress,
                        destLat: firstGrp.defaultDestination?.lat || prev.destLat,
                        destLng: firstGrp.defaultDestination?.lng || prev.destLng,
                        price: firstGrp.defaultPrice ?? prev.price,
                        departureTime: firstGrp.defaultDepartureTime || prev.departureTime,
                        visibility: 'group',
                      }));
                    }
                  }}
                  className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition active:scale-95 cursor-pointer ${
                    modalLinkMode === 'group'
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-slate-900">Vinculada a Grupo</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Apenas membros aprovados do grupo podem reservar vagas diretamente.
                    </p>
                  </div>
                </button>
              </div>

              {modalLinkMode === 'group' && (
                <div className="pt-2 border-t border-slate-200/60 space-y-2 animate-in fade-in">
                  <label className="block text-slate-700 font-semibold text-xs">
                    Selecione o Grupo de Carona:
                  </label>
                  {availableGroupsForUser.length > 0 ? (
                    <select
                      value={formData.targetGroupId || ''}
                      onChange={(e) => {
                        const grpId = e.target.value;
                        const found = availableGroupsForUser.find((g) => g.id === grpId);
                        if (found) {
                          setFormData((prev) => ({
                            ...prev,
                            targetGroupId: found.id,
                            targetGroupName: found.name,
                            destAddress: found.defaultDestination?.address || prev.destAddress,
                            destLat: found.defaultDestination?.lat || prev.destLat,
                            destLng: found.defaultDestination?.lng || prev.destLng,
                            price: found.defaultPrice ?? prev.price,
                            departureTime: found.defaultDepartureTime || prev.departureTime,
                          }));
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {availableGroupsForUser.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} {g.communityName ? `(Comunidade: ${g.communityName})` : ''} • {g.visibility === 'private' ? '🔒 Privado' : '🌐 Público'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      Você ainda não participa de nenhum grupo. Crie um grupo ou solicite adesão na aba <strong>Grupos & Comunidades</strong>.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm sm:text-xs">
              {/* CAMPO 1: DESCRIÇÃO DA CARONA (Primeiro Campo) */}
              <div>
                <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">
                  {formData.rideType === 'offer' ? 'Descrição da Carona / Título do Trajeto:' : 'Descrição do Pedido:'}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={
                    formData.rideType === 'offer'
                      ? 'Ex: Carona diária para o campus Butantã / USP (Portão 3)'
                      : 'Ex: Preciso de carona para a aula das 08h no Bloco B'
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Identifique rapidamente a rota ou objetivo para os outros membros.
                </p>
              </div>

              {/* SELEÇÃO DO VEÍCULO (Apenas para Oferta de Carona) */}
              {formData.rideType === 'offer' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-800 font-bold text-sm sm:text-xs flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-indigo-600" />
                      <span>Selecionar Veículo para esta Carona:</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {userVehicles.length} {userVehicles.length === 1 ? 'veículo cadastrado' : 'veículos cadastrados'}
                    </span>
                  </div>

                  {userVehicles.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={formData.selectedVehicleId}
                        onChange={(e) => {
                          const vId = e.target.value;
                          const chosen = userVehicles.find((v) => v.id === vId || v.plate === vId);
                          setFormData({
                            ...formData,
                            selectedVehicleId: vId,
                            totalSeats: chosen?.availableSeats || formData.totalSeats,
                          });
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {userVehicles.map((v, i) => (
                          <option key={v.id || v.plate || i} value={v.id || v.plate}>
                            {v.model} - {v.color || 'Cor não inf.'} ({v.plate}) • {v.availableSeats || 4} vagas
                            {v.isPrimary ? ' ★ Principal' : ''}
                          </option>
                        ))}
                      </select>

                      {/* Display selected vehicle badge */}
                      {(() => {
                        const currentChosen =
                          userVehicles.find(
                            (v) => v.id === formData.selectedVehicleId || v.plate === formData.selectedVehicleId
                          ) || userVehicles[0];
                        if (!currentChosen) return null;
                        return (
                          <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-[11px] text-slate-700">
                            <span className="font-semibold text-slate-900">{currentChosen.model}</span>
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {currentChosen.plate}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      <p className="font-semibold">Nenhum veículo cadastrado no seu perfil.</p>
                      <p className="text-[11px] mt-0.5 text-amber-700">
                        Você pode cadastrar e gerenciar múltiplos veículos na aba <strong>Minha Área & Perfil</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Origem */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                  <label className="block text-slate-800 font-bold text-sm sm:text-xs">
                    Origem do Trajeto (Embarque):
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSetFormOriginResidential}
                      className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer text-xs"
                      title="Usar endereço cadastrado"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Meu Ponto</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSetFormOriginGPS}
                      disabled={isLocatingGPS}
                      className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer text-xs"
                      title="Capturar GPS do celular/computador"
                    >
                      {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                      <span>GPS Atual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('formOrigin')}
                      className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200 text-xs"
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
                    value={formData.originAddress}
                    onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                    placeholder="Ex: Rua Fradique Coutinho, 1200 - Pinheiros"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-12 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('formOrigin')}
                    className="absolute right-2 top-2 bottom-2 px-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center justify-center"
                    title="Selecionar no mapa interativo"
                  >
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </button>
                </div>
              </div>

              {/* Destino */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                  <label className="block text-slate-800 font-bold text-sm sm:text-xs">
                    Destino Final:
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('formDest')}
                      className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200 text-xs"
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
                    value={formData.destAddress}
                    onChange={(e) => setFormData({ ...formData, destAddress: e.target.value })}
                    placeholder="Ex: Av. Prof. Luciano Gualberto, 380 - Butantã (USP Poli)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-12 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('formDest')}
                    className="absolute right-2 top-2 bottom-2 px-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition flex items-center justify-center"
                  >
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </button>
                </div>
              </div>

              {/* Data e Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">Data da Viagem:</label>
                  <input
                    type="date"
                    required
                    min={getRelativeDateStr(0)}
                    value={formData.departureDate}
                    onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">Horário de Saída:</label>
                  <input
                    type="time"
                    required
                    value={formData.departureTime}
                    onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* Vagas e Preço */}
              {formData.rideType === 'offer' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">
                      Vagas Disponíveis no Carro:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      required
                      value={formData.totalSeats}
                      onChange={(e) => setFormData({ ...formData, totalSeats: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">
                      Valor do Rateio (R$ / vaga):
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">
                    Quantidade de Vagas Pedidas:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    required
                    value={formData.requestSeats}
                    onChange={(e) => setFormData({ ...formData, requestSeats: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono font-bold text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    No pedido de carona não é informado valor nem grupo destino.
                  </p>
                </div>
              )}

              {/* Observações em Geral (Final do Formulário para Oferta de Carona) */}
              {formData.rideType === 'offer' && (
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">
                    Observações em Geral (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ex: Ar-condicionado ligado, porta-malas livre para mochilas, tolerância máxima de 5 minutos no ponto de encontro."
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Informações complementares sobre bagagens, ar-condicionado, paradas, etc.
                  </p>
                </div>
              )}

              {/* Request Note (if rideType === 'request') */}
              {formData.rideType === 'request' && (
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-sm sm:text-xs">
                    Mensagem / Ponto de Referência para os Motoristas (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={formData.requesterNote}
                    onChange={(e) => setFormData({ ...formData, requesterNote: e.target.value })}
                    placeholder="Ex: Posso encontrar na estação de metrô ou ponto de ônibus mais próximo!"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                  />
                </div>
              )}

              {/* Visibility and Policy */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-slate-800 font-bold text-sm sm:text-xs">Visibilidade e Privacidade:</label>
                {modalLinkMode === 'avulsa' ? (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center space-x-3 text-xs text-emerald-900">
                    <Globe className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm sm:text-xs">Pública (Carona Avulsa)</p>
                      <p className="text-xs text-emerald-700">
                        Caronas avulsas são 100% públicas e visíveis para qualquer usuário da comunidade em busca de trajetos.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, visibility: 'group' })}
                      className={`p-3.5 rounded-xl border text-left flex items-center space-x-3 transition active:scale-95 cursor-pointer ${
                        formData.visibility === 'group'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Users className="w-5 h-5 text-indigo-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-900 text-sm sm:text-xs">Exclusiva do Grupo</p>
                        <p className="text-xs text-slate-500">Visível e reservável apenas por membros do grupo</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, visibility: 'public' })}
                      className={`p-3.5 rounded-xl border text-left flex items-center space-x-3 transition active:scale-95 cursor-pointer ${
                        formData.visibility === 'public'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Globe className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-900 text-sm sm:text-xs">Pública no Feed</p>
                        <p className="text-xs text-slate-500">Vinculada ao grupo, mas visível para toda a comunidade</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition active:scale-95 cursor-pointer text-sm sm:text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`w-full sm:w-auto px-6 py-3.5 min-h-[48px] text-white font-bold rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center space-x-2 text-sm sm:text-xs ${
                    formData.rideType === 'offer'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {formData.rideType === 'offer' ? (
                    <>
                      <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span>Publicar Oferta de Carona</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span>Publicar Pedido de Carona</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Map Location Picker Modal */}
      <LocationPickerModal
        isOpen={mapPickerTarget !== null}
        onClose={() => setMapPickerTarget(null)}
        title={
          mapPickerTarget === 'formOrigin'
            ? 'Apontar Local de Origem / Embarque'
            : mapPickerTarget === 'formDest'
            ? 'Apontar Destino Final da Viagem'
            : 'Apontar Localização no Mapa'
        }
        initialAddress={
          mapPickerTarget === 'formOrigin' ? formData.originAddress : formData.destAddress
        }
        initialLat={
          mapPickerTarget === 'formOrigin' ? formData.originLat : formData.destLat
        }
        initialLng={
          mapPickerTarget === 'formOrigin' ? formData.originLng : formData.destLng
        }
        onSelectLocation={(selected) => {
          if (mapPickerTarget === 'formOrigin') {
            setFormData((prev) => ({
              ...prev,
              originAddress: selected.address,
              originLat: selected.lat,
              originLng: selected.lng,
            }));
          } else if (mapPickerTarget === 'formDest') {
            setFormData((prev) => ({
              ...prev,
              destAddress: selected.address,
              destLat: selected.lat,
              destLng: selected.lng,
            }));
          }
        }}
      />

      {/* Interactive Ride Route Modal */}
      <RideRouteModal
        isOpen={selectedRideForRouteModal !== null}
        ride={selectedRideForRouteModal}
        onClose={() => setSelectedRideForRouteModal(null)}
        currentUser={currentUser}
        onJoinRide={onJoinRide}
        onOfferForRequest={handleOfferForRequest}
        onOpenAuth={onOpenAuth}
      />

      {/* Welcome Ride Request Proposal Modal */}
      {selectedRideForWelcomeModal && (
        <WelcomeRideRequestModal
          ride={selectedRideForWelcomeModal}
          currentUser={currentUser}
          rides={rides}
          onClose={() => setSelectedRideForWelcomeModal(null)}
          onSendProposal={(rideId, proposalData) => {
            onSendProposalForRequest?.(rideId, proposalData);
            setSelectedRideForWelcomeModal(null);
          }}
          onOpenAuth={onOpenAuth}
        />
      )}

      {/* Driver Live Navigation & Smart Multi-Stop Routing Modal */}
      <DriverNavigationModal
        isOpen={selectedRideForNavigationModal !== null}
        ride={selectedRideForNavigationModal}
        onClose={() => setSelectedRideForNavigationModal(null)}
        currentUser={currentUser}
        onCompleteRide={(rideId) => {
          handleCompleteWithCelebration(rideId);
          setSelectedRideForNavigationModal(null);
        }}
      />

      {/* Passenger Live Tracking & Real-Time Driver Location GPS Modal */}
      <PassengerLiveTrackingModal
        isOpen={selectedRideForPassengerTrackingModal !== null}
        ride={selectedRideForPassengerTrackingModal}
        currentUser={currentUser}
        onClose={() => setSelectedRideForPassengerTrackingModal(null)}
      />
    </div>
  );
};
