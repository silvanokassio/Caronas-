import React, { useState, useMemo, useEffect } from 'react';
import { 
  Car, 
  Search, 
  MapPin, 
  Clock, 
  Calendar, 
  Users, 
  Check, 
  X, 
  ArrowRight, 
  Star, 
  AlertCircle, 
  Sparkles, 
  Filter, 
  Plus, 
  Phone, 
  LogIn, 
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  Shield,
  Building2,
  GraduationCap,
  Globe,
  UserCheck,
  UserPlus,
  List,
  Map,
  Navigation,
  Home,
  Compass,
  Radio,
  Eye,
  Trash2,
  Loader2,
  XCircle,
  ShieldAlert,
  UserX,
  ExternalLink,
  Wallet,
  History,
  ChevronDown,
  ChevronUp,
  Play,
  Bell,
  Zap,
  Repeat,
  ArrowLeftRight,
  BookmarkCheck,
  Coins,
  Pencil
} from 'lucide-react';
import { User, Ride, Group, Community, GeoLocation, getGroupDestinationAlias, PassengerParticipant, LedgerTransaction, isSuperUser, isUserMemberOfGroup, isUserGroupManager as checkIsUserGroupManager, isUserPendingJoinGroup, isUserInvitedToGroup, TripSegmentType } from '../types';
import { getSegmentLabel } from '../lib/segmentUtils';
import { EditRideModal } from './EditRideModal';
import { PassengerEditRideModal } from './PassengerEditRideModal';
import { RemovePassengerModal } from './RemovePassengerModal';
import { LocationPickerModal } from './LocationPickerModal';
import { RideRouteModal } from './RideRouteModal';
import { DriverNavigationModal } from './DriverNavigationModal';
import { PassengerLiveTrackingModal } from './PassengerLiveTrackingModal';
import { NearbyRidesMapView } from './NearbyRidesMapView';
import { GroupWeeklyScheduleGrid } from './GroupWeeklyScheduleGrid';
import { LightModeBalanceView } from './LightModeBalanceView';
import { getCurrentGPSPosition, reverseGeocode, calculateDistanceKm } from '../lib/geo';
import { isRideInPast, isRideUpcomingOrToday, getRideDateTime, getRelativeDateStr, formatRideFriendlyDate, canJoinRide, canLeaveRide } from '../lib/dateUtils';
import { calculateUserBalances } from '../lib/balanceUtils';

interface LightModeViewProps {
  currentUser: User | null;
  allUsers?: User[];
  rides: Ride[];
  groups: Group[];
  communities?: Community[];
  ledger?: LedgerTransaction[];
  onRequestSettlement?: (passengerUser: User, driverUser: User, amount: number, notes?: string) => Promise<void>;
  onConfirmSettlement?: (pendingTx: LedgerTransaction) => Promise<void>;
  onRejectSettlement?: (pendingTx: LedgerTransaction, reason?: string) => Promise<void>;
  onDirectSettlementByDriver?: (driverUser: User, passengerUser: User, amount: number, notes?: string) => Promise<void>;
  onGoToFullStatement?: () => void;
  onJoinRide: (rideId: string, isQuick?: boolean) => void;
  onCancelReservation: (rideId: string, seatId: string) => void;
  onStartRide?: (rideId: string) => Promise<void> | void;
  onCancelRide?: (rideId: string, reason?: string) => Promise<void> | void;
  onRemovePassenger?: (rideId: string, passengerUserId: string, justification: string) => Promise<void> | void;
  onCompleteRide?: (rideId: string) => Promise<void> | void;
  onCreateQuickRide?: (rideData: Partial<Ride>) => void;
  onQuickCreateRide?: (dayDateStr: string, group: Group) => void;
  onQuickBookSeat?: (rideId: string) => void;
  onQuickCancelSeat?: (rideId: string, userId: string) => void;
  onNavigateToRideEdit?: (ride: Ride) => void;
  onUpdateRide?: (rideId: string, updates: Partial<Ride>) => Promise<void> | void;
  onUpdatePassengerParticipation?: (
    rideId: string,
    updates: {
      segmentType: TripSegmentType;
      meetingPoint: GeoLocation;
      passengerNotes?: string;
    }
  ) => Promise<void> | void;
  onJoinGroup?: (groupId: string) => void;
  onRequestJoinGroup?: (groupId: string, reason?: string) => void;
  onApproveJoinRequest?: (groupId: string, targetUserId: string) => void;
  onRejectJoinRequest?: (groupId: string, targetUserId: string) => void;
  onAcceptInvitation?: (groupId: string) => void;
  onRejectInvitation?: (groupId: string) => void;
  onLeaveGroup?: (groupId: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onSwitchToAdvanced: () => void;
  activeNavTab?: string;
  onNavigateNavTab?: (tab: 'rides' | 'routines' | 'groups' | 'gamification' | 'ai_routes' | 'architecture' | 'user_area' | 'superuser_management') => void;
}

export const LightModeView: React.FC<LightModeViewProps> = ({
  currentUser,
  allUsers = [],
  rides,
  groups,
  communities = [],
  ledger = [],
  onRequestSettlement,
  onConfirmSettlement,
  onRejectSettlement,
  onDirectSettlementByDriver,
  onGoToFullStatement,
  onJoinRide,
  onCancelReservation,
  onStartRide,
  onCancelRide,
  onRemovePassenger,
  onCompleteRide,
  onCreateQuickRide,
  onQuickCreateRide,
  onQuickBookSeat,
  onQuickCancelSeat,
  onNavigateToRideEdit,
  onUpdateRide,
  onUpdatePassengerParticipation,
  onJoinGroup,
  onRequestJoinGroup,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onAcceptInvitation,
  onRejectInvitation,
  onLeaveGroup,
  onOpenAuth,
  onSwitchToAdvanced,
  activeNavTab,
  onNavigateNavTab,
}) => {
  // Navigation inside Light Mode: 'my_rides' (Minhas Caronas), 'search' (Buscar Carona), 'groups' (Buscar Grupo), or 'balance' (Saldo)
  // Initial view synced with activeNavTab or default to 'my_rides'
  const [lightTab, setLightTab] = useState<'my_rides' | 'search' | 'groups' | 'balance'>(() => {
    if (activeNavTab === 'groups') return 'groups';
    if (activeNavTab === 'gamification') return 'balance';
    return 'my_rides';
  });

  // Sync internal sub-tab with navigation from Header if activeNavTab changes
  useEffect(() => {
    if (activeNavTab === 'groups') {
      setLightTab('groups');
    } else if (activeNavTab === 'gamification') {
      setLightTab('balance');
    } else if (activeNavTab === 'rides') {
      setLightTab((prev) => (prev === 'groups' || prev === 'balance' ? 'my_rides' : prev));
    }
  }, [activeNavTab]);

  const handleSelectTab = (tab: 'my_rides' | 'search' | 'groups' | 'balance') => {
    setLightTab(tab);
    if (onNavigateNavTab) {
      if (tab === 'groups') {
        onNavigateNavTab('groups');
      } else if (tab === 'balance') {
        onNavigateNavTab('gamification');
      } else {
        onNavigateNavTab('rides');
      }
    }
  };

  // Quick balance indicator and pending settlement notifications
  const pendingSettlementsCount = useMemo(() => {
    if (!currentUser || !ledger) return 0;
    return ledger.filter(
      (t) =>
        t.status === 'PENDING_CONFIRMATION' &&
        (t.driverId === currentUser.id || t.counterpartId === currentUser.id)
    ).length;
  }, [currentUser, ledger]);

  // Motor central de cálculo de saldos (iniciando a partir de hoje e excluindo mocks/dias passados)
  const calculatedBalances = useMemo(() => {
    return calculateUserBalances(currentUser, allUsers, rides, ledger);
  }, [currentUser, allUsers, rides, ledger]);

  const lightNetBalance = calculatedBalances.realNetBalanceBRL;
  const userRidesCount = calculatedBalances.userRidesCount;

  // Passenger removal modal state
  const [passengerToRemove, setPassengerToRemove] = useState<{
    ride: Ride;
    passenger: PassengerParticipant;
  } | null>(null);

  // Rides search and quick filters
  const [rideSearchInput, setRideSearchInput] = useState('');
  const [activeRideSearchQuery, setActiveRideSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'morning' | 'afternoon'>('all');
  const [confirmingRideId, setConfirmingRideId] = useState<string | null>(null);
  const [joiningRideId, setJoiningRideId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Groups search and category filters
  const [groupSearchInput, setGroupSearchInput] = useState('');
  const [activeGroupSearchQuery, setActiveGroupSearchQuery] = useState('');
  const [groupCategoryFilter, setGroupCategoryFilter] = useState<'all' | 'my_groups' | 'corporate' | 'academic' | 'community'>('all');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [expandedWeeklyGridGroupId, setExpandedWeeklyGridGroupId] = useState<string | null>(null);

  // Quick Ride Modal for Smartphone Drivers
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [quickOrigin, setQuickOrigin] = useState(currentUser?.residentialAddress?.address || currentUser?.ponto_encontro_default?.address || 'Metrô Butantã');
  const [quickDestination, setQuickDestination] = useState('Av. Brigadeiro Faria Lima, 3477');
  const [quickTime, setQuickTime] = useState('08:00');
  const [quickDate, setQuickDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quickSeats, setQuickSeats] = useState(3);
  const [quickPrice, setQuickPrice] = useState(6.50);

  // List vs Map View in Search Tab
  const [searchViewMode, setSearchViewMode] = useState<'list' | 'map'>('list');

  // Interactive Modals
  const [editingRide, setEditingRide] = useState<Ride | null>(null);
  const [passengerRideToEdit, setPassengerRideToEdit] = useState<{
    ride: Ride;
    passenger: PassengerParticipant;
  } | null>(null);
  const [selectedRideForRouteModal, setSelectedRideForRouteModal] = useState<Ride | null>(null);
  const [selectedRideForNavigationModal, setSelectedRideForNavigationModal] = useState<Ride | null>(null);
  const [selectedRideForPassengerTrackingModal, setSelectedRideForPassengerTrackingModal] = useState<Ride | null>(null);

  // Driver Ride Cancellation Confirmation
  const [rideToCancel, setRideToCancel] = useState<Ride | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  // Driver Ride Completion Confirmation Modal
  const [rideToComplete, setRideToComplete] = useState<Ride | null>(null);
  const [isCompletingRide, setIsCompletingRide] = useState(false);
  const [showHistoryRides, setShowHistoryRides] = useState(false);

  // Geocoding and Map Picker for Quick Ride
  const [mapPickerTarget, setMapPickerTarget] = useState<'quickOrigin' | 'quickDest' | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [quickOriginGeo, setQuickOriginGeo] = useState<GeoLocation>(() => ({
    address: currentUser?.residentialAddress?.address || currentUser?.ponto_encontro_default?.address || 'Metrô Butantã',
    lat: currentUser?.residentialAddress?.lat || currentUser?.ponto_encontro_default?.lat || -23.5714,
    lng: currentUser?.residentialAddress?.lng || currentUser?.ponto_encontro_default?.lng || -46.7086,
    name: currentUser?.residentialAddress?.name || 'Ponto de Partida',
  }));
  const [quickDestGeo, setQuickDestGeo] = useState<GeoLocation>(() => ({
    address: 'Av. Brigadeiro Faria Lima, 3477',
    lat: -23.5874,
    lng: -46.6821,
    name: 'Destino',
  }));

  // User location for NearbyRidesMapView
  const userLocation = useMemo<{
    lat: number;
    lng: number;
    label: string;
    source: 'gps' | 'residential';
  }>(() => {
    if (currentUser?.residentialAddress?.lat && currentUser?.residentialAddress?.lng) {
      return {
        lat: currentUser.residentialAddress.lat,
        lng: currentUser.residentialAddress.lng,
        label: currentUser.residentialAddress.address || 'Meu Endereço Padrão',
        source: 'residential',
      };
    }
    return {
      lat: -23.5505,
      lng: -46.6333,
      label: 'São Paulo - Centro',
      source: 'gps',
    };
  }, [currentUser]);

  // Set origin to registered default point
  const handleUseMyPoint = () => {
    const myPoint = currentUser?.residentialAddress || currentUser?.ponto_encontro_default;
    if (myPoint) {
      setQuickOrigin(myPoint.address);
      setQuickOriginGeo({
        address: myPoint.address,
        lat: myPoint.lat,
        lng: myPoint.lng,
        name: myPoint.name || myPoint.address.split(',')[0],
      });
      setSuccessToast('Endereço padrão carregado!');
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  // Get current device GPS for origin
  const handleUseCurrentGPS = async () => {
    setIsLocatingGPS(true);
    try {
      const coords = await getCurrentGPSPosition();
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setQuickOrigin(addr);
      setQuickOriginGeo({
        address: addr,
        lat: coords.lat,
        lng: coords.lng,
        name: 'Localização Atual (GPS)',
      });
      setSuccessToast('GPS capturado com sucesso!');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.warn('Erro ao obter GPS:', err);
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Quick Routine Pre-fill for Light Mode
  const lightUserRoutine = currentUser?.routine;
  const lightUserRes = currentUser?.residentialAddress;
  const lightUserMeetingPoint = currentUser?.ponto_encontro_default;

  const lightRoutineOrigin = useMemo<GeoLocation>(() => {
    if (lightUserRoutine?.origin?.address) return lightUserRoutine.origin;
    if (lightUserRes?.address) return { address: lightUserRes.address, lat: lightUserRes.lat, lng: lightUserRes.lng, name: 'Residência' };
    if (lightUserMeetingPoint?.address) return lightUserMeetingPoint;
    return { address: 'Metrô Butantã', lat: -23.5714, lng: -46.7086, name: 'Ponto de Partida' };
  }, [lightUserRoutine, lightUserRes, lightUserMeetingPoint]);

  const lightRoutineDest = useMemo<GeoLocation>(() => {
    if (lightUserRoutine?.destination?.address) return lightUserRoutine.destination;
    return { address: 'Av. Brigadeiro Faria Lima, 3477', lat: -23.5874, lng: -46.6821, name: 'Destino Final' };
  }, [lightUserRoutine]);

  const handleApplyQuickRoutine = (mode: 'outbound' | 'return') => {
    if (mode === 'outbound') {
      setQuickOrigin(lightRoutineOrigin.address);
      setQuickOriginGeo({
        address: lightRoutineOrigin.address,
        lat: lightRoutineOrigin.lat,
        lng: lightRoutineOrigin.lng,
        name: lightRoutineOrigin.name || lightRoutineOrigin.address.split(',')[0],
      });
      setQuickDestination(lightRoutineDest.address);
      setQuickDestGeo({
        address: lightRoutineDest.address,
        lat: lightRoutineDest.lat,
        lng: lightRoutineDest.lng,
        name: lightRoutineDest.name || lightRoutineDest.alias || lightRoutineDest.address.split(',')[0],
      });
      if (lightUserRoutine?.departureTime) {
        setQuickTime(lightUserRoutine.departureTime);
      }
      if (lightUserRoutine?.defaultSeats) {
        setQuickSeats(lightUserRoutine.defaultSeats);
      }
      if (lightUserRoutine?.defaultPrice !== undefined) {
        setQuickPrice(lightUserRoutine.defaultPrice);
      }
      setSuccessToast('⚡ Rotina Fixa (Ida) aplicada!');
      setTimeout(() => setSuccessToast(null), 3000);
    } else {
      // Inverted return
      setQuickOrigin(lightRoutineDest.address);
      setQuickOriginGeo({
        address: lightRoutineDest.address,
        lat: lightRoutineDest.lat,
        lng: lightRoutineDest.lng,
        name: lightRoutineDest.name || lightRoutineDest.alias || lightRoutineDest.address.split(',')[0],
      });
      setQuickDestination(lightRoutineOrigin.address);
      setQuickDestGeo({
        address: lightRoutineOrigin.address,
        lat: lightRoutineOrigin.lat,
        lng: lightRoutineOrigin.lng,
        name: lightRoutineOrigin.name || lightRoutineOrigin.address.split(',')[0],
      });
      setQuickTime('17:30');
      if (lightUserRoutine?.defaultSeats) {
        setQuickSeats(lightUserRoutine.defaultSeats);
      }
      if (lightUserRoutine?.defaultPrice !== undefined) {
        setQuickPrice(lightUserRoutine.defaultPrice);
      }
      setSuccessToast('🔄 Trajeto de Retorno (Volta) aplicado!');
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  // Today and Tomorrow strings in YYYY-MM-DD (local time)
  const todayStr = useMemo(() => getRelativeDateStr(0), []);
  const tomorrowStr = useMemo(() => getRelativeDateStr(1), []);

  // Filter available rides for Search (only active offers in the future)
  const availableRides = useMemo(() => {
    return rides
      .filter((r) => {
        // Only active rides of type offer
        if (r.status === 'cancelada' || r.status === 'concluida') return false;
        if (r.rideType === 'request') return false; // In light mode, focus on rides available to join
        
        // Strict: never return rides in the past considering date and time
        if (isRideInPast(r)) return false;

        return true;
      })
      .filter((r) => {
        // Active Search query or live input matching
        const effectiveQuery = (activeRideSearchQuery || rideSearchInput).toLowerCase().trim();
        if (!effectiveQuery) return true;
        const destName = (r.destinationAlias || r.destination?.alias || r.destination?.name || '').toLowerCase();
        const destAddr = (r.destination?.address || '').toLowerCase();
        const origName = (r.origin?.name || '').toLowerCase();
        const origAddr = (r.origin?.address || '').toLowerCase();
        const driver = (r.driverName || '').toLowerCase();
        const group = (r.targetGroupName || '').toLowerCase();
        return (
          destName.includes(effectiveQuery) ||
          destAddr.includes(effectiveQuery) ||
          origName.includes(effectiveQuery) ||
          origAddr.includes(effectiveQuery) ||
          driver.includes(effectiveQuery) ||
          group.includes(effectiveQuery)
        );
      })
      .filter((r) => {
        // Date / period quick filter
        if (dateFilter === 'all') return true;
        if (dateFilter === 'today') return r.departureDate === todayStr;
        if (dateFilter === 'tomorrow') return r.departureDate === tomorrowStr;
        if (dateFilter === 'morning') {
          const hour = parseInt(r.departureTime?.split(':')[0] || '12', 10);
          return hour < 12;
        }
        if (dateFilter === 'afternoon') {
          const hour = parseInt(r.departureTime?.split(':')[0] || '12', 10);
          return hour >= 12;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort chronologically (closest future ride first)
        const dtA = getRideDateTime(a.departureDate, a.departureTime)?.getTime() || 0;
        const dtB = getRideDateTime(b.departureDate, b.departureTime)?.getTime() || 0;
        return dtA - dtB;
      });
  }, [rides, activeRideSearchQuery, rideSearchInput, dateFilter, todayStr, tomorrowStr]);

  // Execute Ride Search
  const handleExecuteRideSearch = () => {
    setActiveRideSearchQuery(rideSearchInput.trim());
  };

  // Clear Ride Search
  const handleClearRideSearch = () => {
    setRideSearchInput('');
    setActiveRideSearchQuery('');
  };

  // User's own groups (exibição ativa quando não houver busca)
  const myGroups = useMemo(() => {
    if (!currentUser) return [];
    return groups.filter((g) => isUserMemberOfGroup(g, currentUser, allUsers));
  }, [groups, currentUser, allUsers]);

  // Is user searching groups?
  const isSearchingGroups = Boolean(activeGroupSearchQuery || groupSearchInput.trim());

  // Filter groups: When not searching, displays user's own groups. When searching, displays search results across all groups.
  const availableGroups = useMemo(() => {
    if (!isSearchingGroups) {
      // Exibição ativa: ficam os que o usuário pertence
      return myGroups;
    }

    // Quando for feito busca: exibe a lista de resultados
    const effectiveQuery = (activeGroupSearchQuery || groupSearchInput).toLowerCase().trim();
    return groups
      .filter((g) => {
        // Category filter
        if (groupCategoryFilter === 'my_groups') {
          if (!currentUser) return false;
          return isUserMemberOfGroup(g, currentUser, allUsers);
        }
        if (groupCategoryFilter !== 'all') {
          return g.category === groupCategoryFilter;
        }
        return true;
      })
      .filter((g) => {
        if (!effectiveQuery) return true;
        const name = (g.name || '').toLowerCase();
        const desc = (g.description || '').toLowerCase();
        const dest = (g.defaultDestination?.address || g.defaultDestination?.name || '').toLowerCase();
        const destAlias = (getGroupDestinationAlias(g) + ' ' + (g.destinationAlias || '')).toLowerCase();
        const comm = (g.communityName || '').toLowerCase();
        const cat = (g.category || '').toLowerCase();
        return (
          name.includes(effectiveQuery) ||
          desc.includes(effectiveQuery) ||
          dest.includes(effectiveQuery) ||
          destAlias.includes(effectiveQuery) ||
          comm.includes(effectiveQuery) ||
          cat.includes(effectiveQuery)
        );
      })
      .sort((a, b) => {
        // User's groups first, then by member count
        const isMemberA = isUserMemberOfGroup(a, currentUser, allUsers) ? 1 : 0;
        const isMemberB = isUserMemberOfGroup(b, currentUser, allUsers) ? 1 : 0;
        if (isMemberA !== isMemberB) return isMemberB - isMemberA;
        return (b.memberCount || b.memberIds?.length || 0) - (a.memberCount || a.memberIds?.length || 0);
      });
  }, [isSearchingGroups, myGroups, groups, groupCategoryFilter, activeGroupSearchQuery, groupSearchInput, currentUser, allUsers]);

  // Auto-expand single group if user belongs to only 1 group on active display
  useEffect(() => {
    if (!isSearchingGroups && myGroups.length === 1 && !expandedWeeklyGridGroupId) {
      setExpandedWeeklyGridGroupId(myGroups[0].id);
    }
  }, [isSearchingGroups, myGroups, expandedWeeklyGridGroupId]);

  // Execute Group Search
  const handleExecuteGroupSearch = () => {
    setActiveGroupSearchQuery(groupSearchInput.trim());
  };

  // Clear Group Search (returns to user's groups active display)
  const handleClearGroupSearch = () => {
    setGroupSearchInput('');
    setActiveGroupSearchQuery('');
    setGroupCategoryFilter('all');
  };

  // Handle Joining or Requesting to Join a Group in Light Mode (Adesão SEMPRE exige aprovação do dono)
  const handleGroupAction = async (group: Group) => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    setJoiningGroupId(group.id);
    try {
      if (onRequestJoinGroup) {
        await onRequestJoinGroup(group.id, 'Solicitação enviada via Modo Light.');
        setSuccessToast(`Solicitação enviada para o dono do grupo "${group.name}". Aguarde aprovação.`);
      }
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error handling group action:', err);
    } finally {
      setJoiningGroupId(null);
    }
  };

  // Switch to rides search pre-filtered by a group
  const handleViewRidesForGroup = (groupName: string) => {
    setRideSearchInput(groupName);
    setActiveRideSearchQuery(groupName);
    handleSelectTab('search');
    setSuccessToast(`Exibindo caronas do grupo "${groupName}".`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // User's confirmed rides (as passenger or driver)
  // Requisitos: Exibir apenas viagens não concluídas do dia ou futuras, ordenadas cronologicamente
  const myRides = useMemo(() => {
    if (!currentUser) return [];

    return rides
      .filter((r) => {
        if (!r || !r.id) return false;
        const isPassenger = r.acceptedPassengers?.some((p) => p.userId === currentUser.id);
        const isDriver = r.driverId === currentUser.id;
        if (!isPassenger && !isDriver) return false;

        return isRideUpcomingOrToday(r);
      })
      .sort((a, b) => {
        // Viagem em andamento no momento tem prioridade máxima
        if (a.status === 'em_andamento' && b.status !== 'em_andamento') return -1;
        if (b.status === 'em_andamento' && a.status !== 'em_andamento') return 1;

        // Ordenação cronológica ascendente (mais próxima / mais cedo primeiro)
        const dtA = getRideDateTime(a.departureDate, a.departureTime)?.getTime() || 0;
        const dtB = getRideDateTime(b.departureDate, b.departureTime)?.getTime() || 0;
        return dtA - dtB;
      });
  }, [rides, currentUser]);

  // Histórico de viagens anteriores ou concluídas para consulta opcional
  const pastOrCompletedRides = useMemo(() => {
    if (!currentUser) return [];

    return rides
      .filter((r) => {
        if (!r || !r.id) return false;
        const isPassenger = r.acceptedPassengers?.some((p) => p.userId === currentUser.id);
        const isDriver = r.driverId === currentUser.id;
        if (!isPassenger && !isDriver) return false;

        // É concluída ou data/horário já expirou no passado (e não está em andamento)
        return (!isRideUpcomingOrToday(r) || r.status === 'concluida') && r.status !== 'em_andamento' && r.status !== 'cancelada';
      })
      .sort((a, b) => {
        const dtA = getRideDateTime(a.departureDate, a.departureTime)?.getTime() || 0;
        const dtB = getRideDateTime(b.departureDate, b.departureTime)?.getTime() || 0;
        return dtB - dtA; // Histórico: mais recentes primeiro
      });
  }, [rides, currentUser]);

  // Handle Joining a Ride
  const handleJoinClick = async (ride: Ride) => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    if (!canJoinRide(ride)) {
      alert('Esta carona pertence ao passado ou já foi concluída/cancelada. Não é permitido aderir a viagens passadas.');
      return;
    }

    setJoiningRideId(ride.id);
    try {
      await onJoinRide(ride.id, true);
      setConfirmingRideId(null);
      setSuccessToast(`Vaga confirmada com sucesso na carona de ${ride.driverName}!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error joining ride:', err);
    } finally {
      setJoiningRideId(null);
    }
  };

  // Compute available rides with distance from user for Map view and sorting
  const availableRidesWithDistance = useMemo(() => {
    return availableRides.map((ride) => {
      const dist = calculateDistanceKm(
        userLocation.lat,
        userLocation.lng,
        ride.origin?.lat || -23.5505,
        ride.origin?.lng || -46.6333
      );
      return { ...ride, distanceFromUser: Math.round(dist * 10) / 10 };
    });
  }, [availableRides, userLocation]);

  // Handle Quick Create Ride Submit
  const handleQuickCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    const distKm = Math.max(1, Math.round(calculateDistanceKm(quickOriginGeo.lat, quickOriginGeo.lng, quickDestGeo.lat, quickDestGeo.lng) * 10) / 10 || 12);
    const estDuration = Math.round((distKm / 30) * 60) + 5;

    if (onCreateQuickRide) {
      onCreateQuickRide({
        origin: {
          address: quickOrigin,
          name: quickOriginGeo.name || quickOrigin.split(',')[0].trim(),
          lat: quickOriginGeo.lat,
          lng: quickOriginGeo.lng,
        },
        destination: {
          address: quickDestination,
          name: quickDestGeo.name || quickDestination.split(',')[0].trim(),
          alias: quickDestGeo.name || quickDestination.split(',')[0].trim(),
          lat: quickDestGeo.lat,
          lng: quickDestGeo.lng,
        },
        destinationAlias: quickDestGeo.name || quickDestination.split(',')[0].trim(),
        distanceKm: distKm,
        estimatedDurationMin: estDuration,
        departureTime: quickTime,
        departureDate: quickDate,
        totalSeats: quickSeats,
        price: quickPrice,
        rideType: 'offer',
      });
    }

    setShowQuickCreateModal(false);
    setSuccessToast('Sua carona foi publicada com sucesso!');
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20 sm:pb-8">
      {/* Toast Feedback */}
      {successToast && (
        <div className="fixed top-20 inset-x-4 max-w-md mx-auto z-50 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            <p className="text-xs font-bold leading-snug">{successToast}</p>
          </div>
          <button 
            onClick={() => setSuccessToast(null)}
            className="p-1 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Minimalist Top Quick Balance Widget */}
      {currentUser && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block leading-none mb-0.5">
                Saldo Atual
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-xs sm:text-sm font-display font-extrabold ${
                    lightNetBalance > 0.05
                      ? 'text-emerald-600'
                      : lightNetBalance < -0.05
                      ? 'text-amber-600'
                      : 'text-slate-800'
                  }`}
                >
                  {lightNetBalance > 0.05
                    ? `+ R$ ${lightNetBalance.toFixed(2)}`
                    : lightNetBalance < -0.05
                    ? `- R$ ${Math.abs(lightNetBalance).toFixed(2)}`
                    : 'R$ 0,00'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  • {userRidesCount} {userRidesCount === 1 ? 'carona' : 'caronas'}
                </span>
                {Math.abs(calculatedBalances.forecastNetBalanceBRL) > 0.05 && (
                  <span
                    className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/80 px-1.5 py-0.5 rounded-md"
                    title="Valores previstos de viagens agendadas a partir de hoje"
                  >
                    prev. {calculatedBalances.forecastNetBalanceBRL > 0
                      ? `+R$ ${calculatedBalances.forecastNetBalanceBRL.toFixed(2)}`
                      : `-R$ ${Math.abs(calculatedBalances.forecastNetBalanceBRL).toFixed(2)}`}
                  </span>
                )}
                {calculatedBalances.pendingPassengerSettlementsBRL > 0 && (
                  <span
                    className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                    title={`R$ ${calculatedBalances.pendingPassengerSettlementsBRL.toFixed(2)} em quitação informada aguardando validação do motorista`}
                  >
                    <Clock className="w-2.5 h-2.5 text-amber-600" />
                    <span>Quitação pend. validação</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btn-quick-view-balance"
            onClick={() => handleSelectTab('balance')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
              lightTab === 'balance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'
            }`}
          >
            <span>Ver Saldo</span>
            {pendingSettlementsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Four Navigation Tabs for Smartphone with High Readability */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-200/80 p-1.5 rounded-2xl">
        {/* 1. Minhas Caronas (Visualização inicial) */}
        <button
          type="button"
          id="btn-light-tab-my-rides"
          onClick={() => {
            if (!currentUser && onOpenAuth) {
              onOpenAuth('login');
            } else {
              handleSelectTab('my_rides');
            }
          }}
          className={`min-h-[58px] py-2 sm:py-2.5 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer relative active:scale-98 ${
            lightTab === 'my_rides'
              ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <div className="relative inline-flex items-center justify-center">
            <Car className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${lightTab === 'my_rides' ? 'text-indigo-600' : 'text-slate-500'}`} />
            {currentUser && myRides.length > 0 && (
              <span className="absolute -top-1.5 -right-3.5 min-w-[17px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                {myRides.length}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-xs font-bold leading-tight text-center truncate w-full">
            Caronas
          </span>
        </button>

        {/* 2. Buscar Carona */}
        <button
          type="button"
          id="btn-light-tab-search"
          onClick={() => handleSelectTab('search')}
          className={`min-h-[58px] py-2 sm:py-2.5 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-98 ${
            lightTab === 'search'
              ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Search className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${lightTab === 'search' ? 'text-indigo-600' : 'text-slate-500'}`} />
          <span className="text-[10px] sm:text-xs font-bold leading-tight text-center truncate w-full">
            Buscar
          </span>
        </button>

        {/* 3. Grupos */}
        <button
          type="button"
          id="btn-light-tab-groups"
          onClick={() => handleSelectTab('groups')}
          className={`min-h-[58px] py-2 sm:py-2.5 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer active:scale-98 ${
            lightTab === 'groups'
              ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Users className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${lightTab === 'groups' ? 'text-indigo-600' : 'text-slate-500'}`} />
          <span className="text-[10px] sm:text-xs font-bold leading-tight text-center truncate w-full">
            Grupos
          </span>
        </button>

        {/* 4. Saldo (Acompanhamento Simplificado) */}
        <button
          type="button"
          id="btn-light-tab-balance"
          onClick={() => {
            if (!currentUser && onOpenAuth) {
              onOpenAuth('login');
            } else {
              handleSelectTab('balance');
            }
          }}
          className={`min-h-[58px] py-2 sm:py-2.5 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer relative active:scale-98 ${
            lightTab === 'balance'
              ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <div className="relative inline-flex items-center justify-center">
            <Wallet className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${lightTab === 'balance' ? 'text-indigo-600' : 'text-slate-500'}`} />
            {pendingSettlementsCount > 0 && (
              <span className="absolute -top-1.5 -right-3 min-w-[15px] h-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs animate-pulse">
                {pendingSettlementsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-xs font-bold leading-tight text-center truncate w-full">
            Saldo
          </span>
        </button>
      </div>

      {/* TAB 1: PROCURAR CARONA (Search & Join) */}
      {lightTab === 'search' && (
        <div className="space-y-3.5">
          {/* Search Input with Dedicated Buscar Button */}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                id="input-light-search-rides"
                type="text"
                value={rideSearchInput}
                onChange={(e) => {
                  setRideSearchInput(e.target.value);
                  if (!e.target.value) {
                    setActiveRideSearchQuery('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteRideSearch();
                  }
                }}
                placeholder="Para onde você vai? (Ex: Elektro, Faria Lima)..."
                className="w-full h-full bg-white border border-slate-300 rounded-2xl px-4 py-3 pl-11 pr-14 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium shadow-2xs"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              {rideSearchInput && (
                <button
                  type="button"
                  id="btn-light-clear-rides"
                  onClick={handleClearRideSearch}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition font-medium"
                >
                  Limpar
                </button>
              )}
            </div>

            <button
              type="button"
              id="btn-light-execute-rides-search"
              onClick={handleExecuteRideSearch}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-2xs transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer min-h-[44px]"
            >
              <Search className="w-4 h-4" />
              <span>Buscar</span>
            </button>
          </div>

          {/* Active Ride Search Filter Feedback */}
          {activeRideSearchQuery && (
            <div className="flex items-center justify-between bg-indigo-50/90 border border-indigo-100 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-indigo-900 truncate mr-2">
                Filtrando por: <strong className="font-bold">"{activeRideSearchQuery}"</strong> ({availableRides.length} {availableRides.length === 1 ? 'carona encontrada' : 'caronas encontradas'})
              </span>
              <button
                type="button"
                onClick={handleClearRideSearch}
                className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] underline shrink-0 cursor-pointer"
              >
                Limpar busca
              </button>
            </div>
          )}

          {/* Quick Date Filters (Horizontal scroll on mobile) */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                dateFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                dateFilter === 'today'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Hoje</span>
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('tomorrow')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                dateFilter === 'tomorrow'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Amanhã
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('morning')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                dateFilter === 'morning'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              🌅 Manhã
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('afternoon')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                dateFilter === 'afternoon'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              🌆 Tarde / Noite
            </button>
          </div>

          {/* Quick Stats, View Mode (Lista / Mapa) & Quick Create Action */}
          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {availableRides.length} {availableRides.length === 1 ? 'carona' : 'caronas'}
              </span>

              {/* List vs Map Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  id="btn-light-view-list"
                  onClick={() => setSearchViewMode('list')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                    searchViewMode === 'list'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
                <button
                  type="button"
                  id="btn-light-view-map"
                  onClick={() => setSearchViewMode('map')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                    searchViewMode === 'map'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Mapa</span>
                </button>
              </div>
            </div>

            {currentUser && onCreateQuickRide && (
              <button
                type="button"
                onClick={() => setShowQuickCreateModal(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer transition active:scale-95 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl border border-indigo-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Oferecer Carona</span>
              </button>
            )}
          </div>

          {/* Render Map View or Rides List */}
          {searchViewMode === 'map' ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-white p-2">
              <NearbyRidesMapView
                rides={availableRidesWithDistance}
                userLocation={userLocation}
                currentUser={currentUser}
                groups={groups}
                maxRadiusKm={0}
                onJoinRide={(rideId) => {
                  const targetRide = rides.find((r) => r.id === rideId);
                  if (targetRide) handleJoinClick(targetRide);
                }}
                onOfferForRequest={() => {}}
                onSelectTracking={(rideId) => {
                  const targetRide = rides.find((r) => r.id === rideId);
                  if (targetRide) setSelectedRideForRouteModal(targetRide);
                }}
                onOpenAuth={onOpenAuth}
              />
            </div>
          ) : availableRides.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-slate-800 text-base">Nenhuma carona encontrada</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Não há viagens correspondentes aos filtros selecionados. Tente mudar a data ou limpar a busca.
              </p>
              {(activeRideSearchQuery || rideSearchInput || dateFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    handleClearRideSearch();
                    setDateFilter('all');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Ver Todas as Caronas
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {availableRides.map((ride) => {
                const isPassenger = currentUser
                  ? ride.acceptedPassengers?.some((p) => p.userId === currentUser.id)
                  : false;
                const isDriver = currentUser ? ride.driverId === currentUser.id : false;
                const availableSeats = Math.max(0, ride.totalSeats - (ride.acceptedPassengers?.length || ride.occupiedSeats || 0));
                const isFull = availableSeats === 0;
                const isJoiningThis = joiningRideId === ride.id;

                return (
                  <div
                    key={ride.id}
                    className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 shadow-2xs transition space-y-3"
                  >
                    {/* Header: Date & Time Badge + Price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center space-x-1.5 border border-indigo-100">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{ride.departureTime}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {ride.departureDate === todayStr
                            ? 'Hoje'
                            : ride.departureDate === tomorrowStr
                            ? 'Amanhã'
                            : ride.departureDate}
                        </span>
                        {ride.targetGroupName && (
                          <span className="hidden sm:inline-block text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                            {ride.targetGroupName}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-emerald-600">
                          {ride.price > 0 ? `R$ ${ride.price.toFixed(2)}` : 'Grátis'}
                        </span>
                        <span className="text-[10px] text-slate-400 block -mt-0.5">por assento</span>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start space-x-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1"></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Ponto de Partida
                          </span>
                          <p className="font-bold text-slate-800 truncate">
                            {ride.origin?.name || ride.origin?.address || 'Ponto de Encontro'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 mt-1"></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Destino Final
                          </span>
                          <p className="font-bold text-slate-900 truncate">
                            {ride.destinationAlias || ride.destination?.alias || ride.destination?.name || ride.destination?.address || 'Destino'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Driver & Seats Row */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <img
                          src={ride.driverAvatar}
                          alt={ride.driverName}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/20"
                        />
                        <div>
                          <p className="font-bold text-slate-800 leading-tight flex items-center gap-1">
                            {ride.driverName}
                            <span className="text-[11px] font-semibold text-amber-500 flex items-center">
                              ★ 5.0
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {ride.driverVehicle?.model || 'Carro Cadastrado'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold ${isFull ? 'text-rose-600' : 'text-slate-700'}`}>
                          {isFull ? 'Sem vagas' : `${availableSeats} ${availableSeats === 1 ? 'vaga livre' : 'vagas livres'}`}
                        </span>
                        <div className="flex items-center justify-end space-x-0.5 mt-0.5">
                          {Array.from({ length: ride.totalSeats }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < (ride.acceptedPassengers?.length || ride.occupiedSeats || 0)
                                  ? 'bg-slate-300'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Route Preview on Map Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedRideForRouteModal(ride)}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-indigo-700 font-bold text-xs rounded-xl border border-slate-200/90 transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ver Trajeto / Rota no Mapa</span>
                    </button>

                    {/* Primary Touch-Friendly Action Button */}
                    <div className="pt-0.5">
                      {isPassenger ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <span>Você aderiu a esta carona!</span>
                              {(() => {
                                const mySeat = ride.acceptedPassengers?.find((p) => p.userId === currentUser?.id);
                                if (mySeat?.segmentType) {
                                  return (
                                    <span className="block text-[10px] text-emerald-700 font-normal">
                                      Trecho: {getSegmentLabel(mySeat.segmentType)}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {canLeaveRide(ride) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const mySeat = ride.acceptedPassengers?.find((p) => p.userId === currentUser?.id);
                                  if (mySeat) setPassengerRideToEdit({ ride, passenger: mySeat });
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer"
                                title="Editar trecho da viagem (ida e volta, só ida, só volta) e ponto de embarque"
                              >
                                <Pencil className="w-3 h-3 text-indigo-600" />
                                <span>Editar Trecho</span>
                              </button>
                            )}
                            {canLeaveRide(ride) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const mySeat = ride.acceptedPassengers?.find((p) => p.userId === currentUser?.id);
                                  if (mySeat) onCancelReservation(ride.id, mySeat.userId);
                                }}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                              >
                                Cancelar Vaga
                              </button>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {ride.status === 'concluida' ? 'Viagem Concluída' : 'Data Passada'}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : isDriver ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-100 rounded-xl p-2.5 text-indigo-900 font-semibold text-xs">
                            <span className="flex items-center gap-1.5">
                              <Car className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Você é o motorista desta viagem</span>
                            </span>
                            {ride.status === 'agendada' && canLeaveRide(ride) && (
                              <button
                                type="button"
                                id={`btn-search-edit-ride-${ride.id}`}
                                onClick={() => setEditingRide(ride)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-2xs transition active:scale-95 cursor-pointer"
                                title="Editar dados da viagem"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Editar Dados</span>
                              </button>
                            )}
                          </div>
                          {(ride.acceptedPassengers?.length || 0) > 0 && (
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5 text-left">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                <span className="flex items-center gap-1 text-slate-600">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  Passageiros Confirmados ({ride.acceptedPassengers!.length}):
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {ride.acceptedPassengers!.map((p) => (
                                  <div
                                    key={p.userId}
                                    className="flex items-center justify-between bg-white border border-slate-200/70 px-2.5 py-1.5 rounded-lg text-xs"
                                  >
                                    <div className="flex items-center space-x-2 min-w-0">
                                      <img src={p.userAvatar} alt={p.userName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                      <span className="font-semibold text-slate-800 truncate">{p.userName}</span>
                                    </div>
                                    {ride.status === 'agendada' && canLeaveRide(ride) && onRemovePassenger && (
                                      <button
                                        type="button"
                                        onClick={() => setPassengerToRemove({ ride, passenger: p })}
                                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md transition flex items-center space-x-1 cursor-pointer shrink-0"
                                        title="Excluir passageiro da viagem e enviar justificativa por push e e-mail"
                                      >
                                        <UserX className="w-3 h-3 text-rose-500" />
                                        <span>Excluir</span>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : !canJoinRide(ride) ? (
                        <button
                          disabled
                          className="w-full py-3 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed text-center"
                        >
                          {ride.status === 'concluida' ? 'Viagem Concluída' : 'Viagem Encerrada (Data Passada)'}
                        </button>
                      ) : isFull ? (
                        <button
                          disabled
                          className="w-full py-3 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed text-center"
                        >
                          Carona Lotada
                        </button>
                      ) : (
                        <button
                          type="button"
                          id={`btn-join-ride-${ride.id}`}
                          onClick={() => handleJoinClick(ride)}
                          disabled={isJoiningThis}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          {isJoiningThis ? (
                            <span>Confirmando vaga...</span>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Aderir à Carona ({ride.price > 0 ? `R$ ${ride.price.toFixed(2)}` : 'Grátis'})</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUSCAR GRUPOS (Group Search & Join) */}
      {lightTab === 'groups' && (
        <div className="space-y-3.5">
          {/* Search Bar with Dedicated Buscar Button */}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                id="input-light-search-groups"
                type="text"
                value={groupSearchInput}
                onChange={(e) => {
                  setGroupSearchInput(e.target.value);
                  if (!e.target.value) {
                    setActiveGroupSearchQuery('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteGroupSearch();
                  }
                }}
                placeholder="Buscar grupo (Ex: Elektro, USP, Faria Lima)..."
                className="w-full h-full bg-white border border-slate-300 rounded-2xl px-4 py-3 pl-11 pr-14 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium shadow-2xs"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              {groupSearchInput && (
                <button
                  type="button"
                  id="btn-light-clear-groups"
                  onClick={handleClearGroupSearch}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition font-medium"
                >
                  Limpar
                </button>
              )}
            </div>

            <button
              type="button"
              id="btn-light-execute-groups-search"
              onClick={handleExecuteGroupSearch}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-2xs transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer min-h-[44px]"
            >
              <Search className="w-4 h-4" />
              <span>Buscar</span>
            </button>
          </div>

          {/* Active Search Filter Feedback or Active View Header */}
          {isSearchingGroups ? (
            <div className="flex items-center justify-between bg-indigo-50/90 border border-indigo-100 px-3.5 py-2 rounded-xl text-xs">
              <span className="text-indigo-900 truncate mr-2">
                Resultados da busca: <strong className="font-bold">"{activeGroupSearchQuery || groupSearchInput}"</strong> ({availableGroups.length} {availableGroups.length === 1 ? 'grupo encontrado' : 'grupos encontrados'})
              </span>
              <button
                type="button"
                onClick={handleClearGroupSearch}
                className="text-indigo-700 hover:text-indigo-900 font-bold text-xs underline shrink-0 cursor-pointer flex items-center space-x-1"
              >
                <span>← Voltar aos Meus Grupos</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900">
                  Meus Grupos ({availableGroups.length})
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  Exibição Ativa
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Grupos aos quais você pertence
              </span>
            </div>
          )}

          {/* Category Filter Pills (Horizontal Scroll when searching) */}
          {isSearchingGroups && (
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setGroupCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                  groupCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Todos ({groups.length})
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setGroupCategoryFilter('my_groups')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                    groupCategoryFilter === 'my_groups'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>⭐ Meus Grupos</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setGroupCategoryFilter('corporate')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                  groupCategoryFilter === 'corporate'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🏢 Empresas</span>
              </button>

              <button
                type="button"
                onClick={() => setGroupCategoryFilter('academic')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                  groupCategoryFilter === 'academic'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🎓 Acadêmicos</span>
              </button>

              <button
                type="button"
                onClick={() => setGroupCategoryFilter('community')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
                  groupCategoryFilter === 'community'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🏘️ Bairro / Outros</span>
              </button>
            </div>
          )}

          {/* Groups List */}
          {availableGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-slate-800 text-base">
                {isSearchingGroups ? 'Nenhum grupo encontrado' : 'Você ainda não pertence a nenhum grupo'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {isSearchingGroups
                  ? `Não encontramos nenhum grupo correspondente a "${activeGroupSearchQuery || groupSearchInput}".`
                  : 'Pesquise no campo de busca acima pelo nome da sua empresa, faculdade ou condomínio para solicitar sua entrada.'}
              </p>
              {isSearchingGroups ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClearGroupSearch}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center space-x-1.5 active:scale-95"
                  >
                    <span>← Voltar para Meus Grupos</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGroupSearchQuery(' ');
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center space-x-1.5 active:scale-95"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Ver Todos os Grupos Disponíveis</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {availableGroups.map((group) => {
                const isMember = isUserMemberOfGroup(group, currentUser, allUsers);
                const isPending = isUserPendingJoinGroup(group, currentUser, allUsers);
                const hasInvitation = isUserInvitedToGroup(group, currentUser, allUsers);
                const isManager = checkIsUserGroupManager(group, currentUser, allUsers);
                const isJoining = joiningGroupId === group.id;
                const pendingRequests = group.pendingJoinRequests || [];
                const categoryLabel = group.category === 'corporate'
                  ? '🏢 Corporativo'
                  : group.category === 'academic'
                  ? '🎓 Acadêmico'
                  : '🏘️ Comunidade';

                return (
                  <div
                    key={group.id}
                    className={`bg-white border rounded-2xl p-4 shadow-2xs transition space-y-3 ${
                      isMember ? 'border-emerald-200/90' : 'border-slate-200/90 hover:border-indigo-300'
                    }`}
                  >
                    {/* Header: Category & Visibility Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-100/80">
                          {categoryLabel}
                        </span>

                        {group.domainRestricted && (
                          <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-medium text-[10px] border border-blue-100">
                            @{group.domainRestricted}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[10px]">
                          {group.visibility === 'private' ? 'Privado' : 'Público (com moderação)'}
                        </span>

                        {isManager && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                            👑 Dono/Gestor
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 text-slate-600 font-bold text-xs shrink-0">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{group.memberCount || group.memberIds?.length || 1} membros</span>
                      </div>
                    </div>

                    {/* Group Title and Description */}
                    <div>
                      <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* Group Route & Schedule Details */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1.5 text-xs">
                      {(() => {
                        const destAlias = getGroupDestinationAlias(group);
                        const fullAddress = group.defaultDestination?.address;
                        const explicitAlias = group.destinationAlias || group.defaultDestination?.alias || group.defaultDestination?.name;
                        return (
                          <div className="flex items-start space-x-2 text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-500 text-xs">Destino:</span>
                                <span className="font-bold text-slate-900 text-xs truncate">
                                  {destAlias}
                                </span>
                                {explicitAlias && (
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100">
                                    Alias: {explicitAlias}
                                  </span>
                                )}
                              </div>
                              {fullAddress && fullAddress !== destAlias && (
                                <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={fullAddress}>
                                  {fullAddress}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center space-x-4 text-slate-600 text-[11px]">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Saída: <strong>{group.defaultDepartureTime || '07:30'}</strong></span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span>Rateio ref: <strong>{group.defaultPrice ? `R$ ${Number(group.defaultPrice).toFixed(2)}` : 'R$ 6,50'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Pending Requests for Owner */}
                    {isManager && pendingRequests.length > 0 && (
                      <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                          <div className="flex items-center space-x-1.5">
                            <Users className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Solicitações de Entrada ({pendingRequests.length})</span>
                          </div>
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                            Requer sua aprovação
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Como dono/gestor, apenas você pode aprovar a adesão destes usuários:
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {pendingRequests.map((req) => (
                            <div key={req.userId} className="bg-white border border-amber-100 rounded-lg p-2 flex items-center justify-between gap-2 shadow-2xs">
                              <div className="flex items-center space-x-2 min-w-0">
                                <img
                                  src={req.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                  alt={req.userName}
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800 text-xs block truncate">{req.userName}</span>
                                  <span className="text-[10px] text-slate-500 block truncate">{req.userEmail || req.institutionName || 'Solicitou entrada'}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 shrink-0">
                                {onApproveJoinRequest && (
                                  <button
                                    type="button"
                                    onClick={() => onApproveJoinRequest(group.id, req.userId)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Aprovar</span>
                                  </button>
                                )}
                                {onRejectJoinRequest && (
                                  <button
                                    type="button"
                                    onClick={() => onRejectJoinRequest(group.id, req.userId)}
                                    className="p-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 rounded-md text-[11px] font-semibold flex items-center cursor-pointer"
                                    title="Recusar solicitação"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending Invitation from Manager for Current User */}
                    {hasInvitation && !isMember && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-950">
                          <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Você recebeu um convite do gestor deste grupo!</span>
                        </div>
                        <p className="text-[11px] text-purple-700">
                          O dono do grupo autorizou sua entrada diretamente. Deseja participar?
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onAcceptInvitation && onAcceptInvitation(group.id)}
                            className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aceitar Convite</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectInvitation && onRejectInvitation(group.id)}
                            className="py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Recusar</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="pt-1">
                      {isMember ? (
                        <div className="space-y-2">
                          {group.blockedMemberIds?.includes(currentUser?.id || '') ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Membro (Adesão automática pausada pelo gestor)</span>
                              </div>
                              {onLeaveGroup && !isManager && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Deseja realmente sair do grupo "${group.name}"?`)) {
                                      onLeaveGroup(group.id);
                                    }
                                  }}
                                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                                >
                                  Sair
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-xs">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{isManager ? 'Você é o Dono/Gestor deste grupo' : 'Você é membro aprovado deste grupo'}</span>
                              </div>
                              {onLeaveGroup && !isManager && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Deseja realmente sair do grupo "${group.name}"?`)) {
                                      onLeaveGroup(group.id);
                                    }
                                  }}
                                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                                >
                                  Sair
                                </button>
                              )}
                            </div>
                          )}

                          {/* 1-Clique Actions: Grade Semanal 1-Clique e Lista de Caronas */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              id={`btn-light-group-grid-${group.id}`}
                              onClick={() => setExpandedWeeklyGridGroupId(expandedWeeklyGridGroupId === group.id ? null : group.id)}
                              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer active:scale-95 border ${
                                expandedWeeklyGridGroupId === group.id
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title="Abrir grade semanal do grupo com criação e adesão de viagens em 1 clique"
                            >
                              <Calendar className="w-4 h-4 text-amber-300" />
                              <span>{expandedWeeklyGridGroupId === group.id ? 'Ocultar Grade 1-Clique' : '⚡ Grade Semanal (1-Clique)'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleViewRidesForGroup(group.name)}
                              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                            >
                              <Car className="w-3.5 h-3.5" />
                              <span>Ver Caronas na Lista</span>
                            </button>
                          </div>

                          {/* Grade Semanal 1-Clique do Grupo Integrada */}
                          {expandedWeeklyGridGroupId === group.id && (
                            <div className="pt-2 border-t border-slate-100 mt-2">
                              <GroupWeeklyScheduleGrid
                                group={group}
                                currentUser={currentUser}
                                allUsers={allUsers}
                                rides={rides}
                                onQuickCreateRide={(dayDateStr, grp) => {
                                  if (onQuickCreateRide) {
                                    onQuickCreateRide(dayDateStr, grp);
                                  }
                                }}
                                onQuickBookSeat={(rideId) => {
                                  if (onQuickBookSeat) {
                                    onQuickBookSeat(rideId);
                                  } else {
                                    onJoinRide(rideId, true);
                                  }
                                }}
                                onQuickCancelSeat={(rideId, userId) => {
                                  if (onQuickCancelSeat) {
                                    onQuickCancelSeat(rideId, userId);
                                  } else {
                                    onCancelReservation(rideId, userId);
                                  }
                                }}
                                onRemovePassenger={onRemovePassenger}
                                onCancelRide={onCancelRide}
                                onNavigateToRideEdit={(ride) => setEditingRide(ride)}
                                onOpenAuth={onOpenAuth}
                              />
                            </div>
                          )}
                        </div>
                      ) : isPending ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                          <div className="flex items-center space-x-2 font-bold text-amber-900 text-xs">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                            <span>Aguardando Aprovação do Dono do Grupo</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-snug">
                            Sua solicitação de adesão foi enviada com sucesso. O acesso às caronas exclusivas será liberado assim que o dono do grupo aprovar.
                          </p>
                        </div>
                      ) : !hasInvitation ? (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            id={`btn-join-group-${group.id}`}
                            onClick={() => handleGroupAction(group)}
                            disabled={isJoining}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                          >
                            {isJoining ? (
                              <span>Enviando solicitação...</span>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                <span>Solicitar Entrada no Grupo</span>
                              </>
                            )}
                          </button>
                          <p className="text-[11px] text-slate-500 text-center">
                            A adesão requer aprovação prévia do dono do grupo.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Banner: Want to create or manage groups? Switch to Advanced */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800 block">Deseja criar um grupo novo?</span>
              Para criar grupos corporativos ou aprovar solicitações, acesse a versão avançada.
            </div>
            <button
              type="button"
              onClick={onSwitchToAdvanced}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl transition shrink-0 cursor-pointer shadow-2xs"
            >
              Criar no Avançado
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: MINHAS CARONAS (Active and Joined Rides) */}
      {lightTab === 'my_rides' && (
        <div className="space-y-3.5">
          {!currentUser ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Faça login para ver suas caronas
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Entre na sua conta para acompanhar seus assentos reservados e entrar em contato com o motorista.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                Entrar com Minha Conta
              </button>
            </div>
          ) : myRides.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Car className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Você ainda não aderiu a nenhuma carona
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Encontre viagens rápidas na aba de busca e garanta seu assento em 1 toque.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSelectTab('search')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                Procurar Caronas Disponíveis
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Suas Viagens Confirmadas</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                      {myRides.length}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Viagens do dia e futuras em ordem cronológica
                  </p>
                </div>
              </div>

              {myRides.map((ride) => {
                const isDriver = ride.driverId === currentUser.id;
                const mySeat = ride.acceptedPassengers?.find((p) => p.userId === currentUser.id);

                return (
                  <div
                    key={ride.id}
                    className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs space-y-3 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>

                    {/* Status & Timing */}
                    <div className="flex items-center justify-between pl-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          {isDriver ? 'Você é o Motorista' : 'Vaga Confirmada'}
                        </span>
                        {ride.status === 'em_andamento' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 animate-pulse border border-amber-300">
                            Em Andamento
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-800">
                          {formatRideFriendlyDate(ride.departureDate) || (ride.departureDate === todayStr ? 'Hoje' : ride.departureDate === tomorrowStr ? 'Amanhã' : ride.departureDate)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isDriver && ride.status === 'agendada' && canLeaveRide(ride) && (
                          <button
                            type="button"
                            id={`btn-edit-header-${ride.id}`}
                            onClick={() => setEditingRide(ride)}
                            className="px-2.5 py-1 text-slate-700 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-bold flex items-center space-x-1 transition active:scale-95 cursor-pointer shadow-2xs"
                            title="Editar dados da viagem (destino, horários, vagas, notas)"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-600" />
                            <span>Editar</span>
                          </button>
                        )}
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                          {ride.departureTime}
                        </span>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="space-y-1.5 text-xs pl-1">
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1"></div>
                        <p className="font-semibold text-slate-700 truncate">
                          {ride.origin?.name || ride.origin?.address}
                        </p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1"></div>
                        <p className="font-bold text-slate-900 truncate">
                          {ride.destinationAlias || ride.destination?.alias || ride.destination?.name || ride.destination?.address}
                        </p>
                      </div>
                    </div>

                    {/* Driver info & Passenger Action */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between pl-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <img
                          src={ride.driverAvatar}
                          alt={ride.driverName}
                          className="w-7 h-7 rounded-full object-cover ring-2 ring-emerald-500/30"
                        />
                        <div>
                          <p className="font-bold text-slate-800">{ride.driverName}</p>
                          <p className="text-[10px] text-slate-500">
                            {ride.driverVehicle?.model || 'Veículo Cadastrado'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-700">
                          {ride.acceptedPassengers?.length || 0}/{ride.totalSeats} ocupantes
                        </span>
                      </div>
                    </div>

                    {/* Driver: Confirmed Passengers List with Exclude Option */}
                    {isDriver && (ride.acceptedPassengers?.length || 0) > 0 && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="flex items-center gap-1 text-slate-600">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            Passageiros Confirmados ({ride.acceptedPassengers!.length}):
                          </span>
                          {ride.status === 'agendada' && (
                            <span className="text-[10px] text-slate-400">
                              Toque em "Excluir" para justificar
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {ride.acceptedPassengers!.map((p) => (
                            <div
                              key={p.userId}
                              className="flex items-center justify-between bg-white border border-slate-200/70 px-2.5 py-1.5 rounded-lg text-xs"
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <img src={p.userAvatar} alt={p.userName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                                <span className="font-semibold text-slate-800 truncate">{p.userName}</span>
                              </div>
                              {ride.status === 'agendada' && onRemovePassenger && (
                                <button
                                  type="button"
                                  onClick={() => setPassengerToRemove({ ride, passenger: p })}
                                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md transition flex items-center space-x-1 cursor-pointer shrink-0"
                                  title="Excluir passageiro da viagem e enviar justificativa por push e e-mail"
                                >
                                  <UserX className="w-3 h-3 text-rose-500" />
                                  <span>Excluir</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interactive Action Buttons for Active Ride */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      {isDriver ? (
                        <div className="space-y-2">
                          {/* Driver: Start Ride or Navigate */}
                          {ride.status === 'agendada' ? (
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  id={`btn-start-ride-${ride.id}`}
                                  onClick={async () => {
                                    if (onStartRide) {
                                      await onStartRide(ride.id);
                                    }
                                    setSelectedRideForNavigationModal({ ...ride, status: 'em_andamento' });
                                  }}
                                  className="sm:col-span-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/20 transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                                  title="Iniciar viagem agora: dispara notificação push e e-mail para todos os passageiros confirmados"
                                >
                                  <Play className="w-4 h-4 fill-white" />
                                  <span>Iniciar Viagem & Notificar Passageiros</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedRideForRouteModal(ride)}
                                  className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                                  title="Visualizar mapa do trajeto"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Ver Trajeto</span>
                                </button>
                              </div>
                              <div className="flex items-center justify-center space-x-1.5 text-[11px] text-emerald-800 bg-emerald-50/80 py-1 px-2.5 rounded-lg border border-emerald-200/60">
                                <Bell className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Ao iniciar, os passageiros recebem aviso em tempo real por <strong>e-mail</strong> e <strong>notificação push</strong>.</span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedRideForNavigationModal(ride)}
                                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                                title="Abrir painel de navegação GPS interativo com paradas"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping mr-0.5" />
                                <Navigation className="w-4 h-4 text-emerald-100" />
                                <span>Navegar GPS (Ao Vivo)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedRideForRouteModal(ride)}
                                className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                                title="Visualizar mapa do trajeto"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Ver Trajeto</span>
                              </button>
                            </div>
                          )}

                          {/* Quick External GPS Links */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80">
                            <span className="font-semibold text-slate-600 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                              <span>Navegar em App Externo:</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&origin=${ride.origin?.lat || 0},${ride.origin?.lng || 0}&destination=${ride.destination?.lat || 0},${ride.destination?.lng || 0}&travelmode=driving`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-md transition"
                              >
                                Google Maps
                              </a>
                              <a
                                href={`https://waze.com/ul?ll=${ride.destination?.lat || 0},${ride.destination?.lng || 0}&navigate=yes`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold rounded-md transition"
                              >
                                Waze
                              </a>
                            </div>
                          </div>

                          {/* Driver: Edit, Complete or Cancel Ride */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            {ride.status === 'agendada' && canLeaveRide(ride) && (
                              <button
                                type="button"
                                id={`btn-edit-ride-${ride.id}`}
                                onClick={() => setEditingRide(ride)}
                                className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 shadow-2xs"
                                title="Editar dados da viagem (destino, horários, vagas, notas, veículo)"
                              >
                                <Pencil className="w-4 h-4 text-slate-700" />
                                <span>Editar Dados</span>
                              </button>
                            )}

                            {onCompleteRide && (
                              <button
                                type="button"
                                id={`btn-complete-ride-${ride.id}`}
                                onClick={() => setRideToComplete(ride)}
                                className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200/80 transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98 min-w-[140px]"
                                title="Concluir viagem e registrar créditos"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Concluir Viagem</span>
                              </button>
                            )}

                            {onCancelRide && (
                              <button
                                type="button"
                                onClick={() => setRideToCancel(ride)}
                                className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition flex items-center justify-center space-x-1 cursor-pointer"
                                title="Cancelar viagem"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Cancelar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Passenger: Live GPS Tracking & Route */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRideForPassengerTrackingModal(ride)}
                              className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                              title="Acompanhar localização ao vivo do motorista no mapa"
                            >
                              <Radio className="w-4 h-4 text-emerald-300 animate-pulse" />
                              <span>Ao Vivo (GPS)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedRideForRouteModal(ride)}
                              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                              title="Visualizar mapa do trajeto"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Ver Trajeto</span>
                            </button>
                          </div>

                          {/* Quick External GPS Links */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80">
                            <span className="font-semibold text-slate-600 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                              <span>Trajeto em App Externo:</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&origin=${ride.origin?.lat || 0},${ride.origin?.lng || 0}&destination=${ride.destination?.lat || 0},${ride.destination?.lng || 0}&travelmode=driving`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-md transition"
                              >
                                Google Maps
                              </a>
                              <a
                                href={`https://waze.com/ul?ll=${ride.destination?.lat || 0},${ride.destination?.lng || 0}&navigate=yes`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold rounded-md transition"
                              >
                                Waze
                              </a>
                            </div>
                          </div>

                          {/* Passenger: Edit Trip / Leg & Cancel Seat */}
                          {mySeat && canLeaveRide(ride) && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setPassengerRideToEdit({ ride, passenger: mySeat })}
                                className="py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                                title="Editar trecho da viagem (ida e volta, só ida, só volta) e ponto de embarque"
                              >
                                <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Editar Trecho</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onCancelReservation(ride.id, mySeat.userId)}
                                className="py-2 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Cancelar Vaga</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Histórico / Viagens Anteriores (Recolhido por padrão) */}
              {pastOrCompletedRides.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    id="btn-toggle-history-rides"
                    onClick={() => setShowHistoryRides((prev) => !prev)}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-xs font-bold text-slate-600 transition flex items-center justify-between cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center space-x-1.5">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Histórico de Viagens Anteriores</span>
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold">
                        {pastOrCompletedRides.length}
                      </span>
                    </div>
                    {showHistoryRides ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {showHistoryRides && (
                    <div className="mt-2 space-y-2">
                      {pastOrCompletedRides.map((ride) => {
                        const isDriver = ride.driverId === currentUser.id;
                        return (
                          <div
                            key={ride.id}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-2 opacity-90"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                {ride.status === 'concluida' ? 'Concluída' : 'Anterior'}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {formatRideFriendlyDate(ride.departureDate)} às {ride.departureTime}
                              </span>
                            </div>
                            <p className="font-medium text-slate-800 truncate">
                              {ride.origin.name || ride.origin.address.split(',')[0]} ➔ {ride.destination.name || ride.destination.address.split(',')[0]}
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                              <span>{isDriver ? 'Você foi o motorista' : `Motorista: ${ride.driverName}`}</span>
                              <span>{ride.acceptedPassengers?.length || 0} passageiro(s)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SALDO (Acompanhamento Simplificado e Minimalista) */}
      {lightTab === 'balance' && (
        <LightModeBalanceView
          currentUser={currentUser}
          allUsers={allUsers}
          ledger={ledger || []}
          rides={rides}
          groups={groups}
          onRequestSettlement={onRequestSettlement}
          onConfirmSettlement={onConfirmSettlement}
          onRejectSettlement={onRejectSettlement}
          onDirectSettlementByDriver={onDirectSettlementByDriver}
          onGoToFullStatement={onGoToFullStatement}
          onOpenAuth={onOpenAuth}
        />
      )}

      {/* Modal: Oferecer Carona Rápida para Smartphone */}
      {showQuickCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Oferecer Carona Rápida
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Routine Pre-fill Card */}
            <div className="p-3 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-emerald-50/40 border border-indigo-200/90 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Preenchimento Rápido com Rotina Fixa</span>
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                  {lightUserRoutine?.departureTime || '07:30'}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 truncate">
                {lightRoutineOrigin.address.split(',')[0]} ➔ {lightRoutineDest.name || lightRoutineDest.alias || lightRoutineDest.address.split(',')[0]}
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleApplyQuickRoutine('outbound')}
                  className="py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  title="Preencher com trajeto de ida habitual"
                >
                  <Zap className="w-3 h-3 text-amber-300" />
                  <span>Ida Habitual</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickRoutine('return')}
                  className="py-1.5 px-2 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 text-[11px] font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                  title="Inverter trajeto: preencher volta/retorno"
                >
                  <ArrowLeftRight className="w-3 h-3 text-purple-600" />
                  <span>Volta Invertida</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Ponto de Partida
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickOrigin(lightRoutineOrigin.address);
                        setQuickOriginGeo({
                          address: lightRoutineOrigin.address,
                          lat: lightRoutineOrigin.lat,
                          lng: lightRoutineOrigin.lng,
                          name: lightRoutineOrigin.name || lightRoutineOrigin.address.split(',')[0],
                        });
                        setSuccessToast('Origem da rotina carregada!');
                        setTimeout(() => setSuccessToast(null), 3000);
                      }}
                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 flex items-center space-x-1 cursor-pointer"
                      title="Usar endereço de partida da rotina fixa"
                    >
                      <Repeat className="w-2.5 h-2.5" />
                      <span>Da Rotina</span>
                    </button>
                    {(currentUser?.residentialAddress || currentUser?.ponto_encontro_default) && (
                      <button
                        type="button"
                        onClick={handleUseMyPoint}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 flex items-center space-x-1 cursor-pointer"
                        title="Usar meu endereço padrão cadastrado"
                      >
                        <Home className="w-2.5 h-2.5" />
                        <span>Meu Ponto</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isLocatingGPS}
                      onClick={handleUseCurrentGPS}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                      title="Capturar localização atual do smartphone"
                    >
                      {isLocatingGPS ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Compass className="w-2.5 h-2.5" />
                      )}
                      <span>GPS Atual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('quickOrigin')}
                      className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                    >
                      <Map className="w-2.5 h-2.5" />
                      <span>No Mapa</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={quickOrigin}
                  onChange={(e) => {
                    setQuickOrigin(e.target.value);
                    setQuickOriginGeo(prev => ({ ...prev, address: e.target.value, name: e.target.value.split(',')[0] }));
                  }}
                  placeholder="Ex: Metrô Butantã ou seu bairro"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Destino Final
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickDestination(lightRoutineDest.address);
                        setQuickDestGeo({
                          address: lightRoutineDest.address,
                          lat: lightRoutineDest.lat,
                          lng: lightRoutineDest.lng,
                          name: lightRoutineDest.name || lightRoutineDest.alias || lightRoutineDest.address.split(',')[0],
                        });
                        setSuccessToast('Destino da rotina carregado!');
                        setTimeout(() => setSuccessToast(null), 3000);
                      }}
                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 flex items-center space-x-1 cursor-pointer"
                      title="Usar endereço de destino da rotina fixa"
                    >
                      <Repeat className="w-2.5 h-2.5" />
                      <span>Da Rotina</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('quickDest')}
                      className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                    >
                      <Map className="w-2.5 h-2.5" />
                      <span>No Mapa</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={quickDestination}
                  onChange={(e) => {
                    setQuickDestination(e.target.value);
                    setQuickDestGeo(prev => ({ ...prev, address: e.target.value, name: e.target.value.split(',')[0] }));
                  }}
                  placeholder="Ex: Av. Faria Lima, 3477 ou Polo Central"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data de Partida
                  </label>
                  <input
                    type="date"
                    required
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={quickTime}
                    onChange={(e) => setQuickTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Vagas Disponíveis
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={quickSeats}
                    onChange={(e) => setQuickSeats(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Rateio por Assento (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={quickPrice}
                    onChange={(e) => setQuickPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700">
                💡 <strong>Dica:</strong> Para desenhar rotas interativas no mapa, calcular economia de carbono ou usar a IA Vertex de otimização, acesse a <strong>Versão Avançada</strong>.
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  Publicar Carona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Interactive Map Location Picker for Origin or Destination */}
      {mapPickerTarget && (
        <LocationPickerModal
          isOpen={Boolean(mapPickerTarget)}
          title={mapPickerTarget === 'quickOrigin' ? 'Selecionar Ponto de Partida no Mapa' : 'Selecionar Destino no Mapa'}
          initialAddress={mapPickerTarget === 'quickOrigin' ? quickOrigin : quickDestination}
          initialLat={mapPickerTarget === 'quickOrigin' ? quickOriginGeo.lat : quickDestGeo.lat}
          initialLng={mapPickerTarget === 'quickOrigin' ? quickOriginGeo.lng : quickDestGeo.lng}
          initialLocation={
            mapPickerTarget === 'quickOrigin'
              ? { lat: quickOriginGeo.lat, lng: quickOriginGeo.lng, address: quickOrigin }
              : { lat: quickDestGeo.lat, lng: quickDestGeo.lng, address: quickDestination }
          }
          currentUser={currentUser}
          onClose={() => setMapPickerTarget(null)}
          onConfirm={(loc) => {
            if (mapPickerTarget === 'quickOrigin') {
              setQuickOrigin(loc.address);
              setQuickOriginGeo({
                address: loc.address,
                lat: loc.lat,
                lng: loc.lng,
                name: loc.name || loc.address.split(',')[0],
              });
            } else {
              setQuickDestination(loc.address);
              setQuickDestGeo({
                address: loc.address,
                lat: loc.lat,
                lng: loc.lng,
                name: loc.name || loc.address.split(',')[0],
              });
            }
            setMapPickerTarget(null);
            setSuccessToast('Localização confirmada pelo mapa!');
            setTimeout(() => setSuccessToast(null), 3000);
          }}
        />
      )}

      {/* Modal: Visualizar Trajeto no Mapa */}
      {selectedRideForRouteModal && (
        <RideRouteModal
          isOpen={true}
          ride={selectedRideForRouteModal}
          currentUser={currentUser}
          onClose={() => setSelectedRideForRouteModal(null)}
          onJoinRide={onJoinRide}
          onOpenAuth={onOpenAuth}
        />
      )}

      {/* Modal: Navegação GPS do Motorista */}
      {selectedRideForNavigationModal && (
        <DriverNavigationModal
          isOpen={true}
          ride={selectedRideForNavigationModal}
          currentUser={currentUser}
          onClose={() => setSelectedRideForNavigationModal(null)}
          onStartRide={async (rideId) => {
            if (onStartRide) await onStartRide(rideId);
            setSelectedRideForNavigationModal((prev) => (prev ? { ...prev, status: 'em_andamento' } : null));
          }}
          onCompleteRide={async (rideId) => {
            if (onCompleteRide) await onCompleteRide(rideId);
            setSelectedRideForNavigationModal(null);
            setSuccessToast('Carona concluída com sucesso!');
            setTimeout(() => setSuccessToast(null), 3000);
          }}
        />
      )}

      {/* Modal: Acompanhamento ao Vivo do Passageiro */}
      {selectedRideForPassengerTrackingModal && (
        <PassengerLiveTrackingModal
          isOpen={true}
          ride={selectedRideForPassengerTrackingModal}
          currentUser={currentUser}
          passengerLocation={
            currentUser?.residentialAddress
              ? { lat: currentUser.residentialAddress.lat, lng: currentUser.residentialAddress.lng }
              : undefined
          }
          onClose={() => setSelectedRideForPassengerTrackingModal(null)}
        />
      )}

      {/* Modal: Cancelar Carona (Motorista) */}
      {rideToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Cancelar Carona
                </h3>
                <p className="text-xs text-slate-500">
                  Esta ação cancelará a viagem para todos os passageiros confirmados.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Motivo do Cancelamento (opcional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Imprevisto mecânico, alteração de horário de trabalho..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isCanceling}
                onClick={() => {
                  setRideToCancel(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isCanceling}
                onClick={async () => {
                  if (!onCancelRide) return;
                  setIsCanceling(true);
                  try {
                    await onCancelRide(rideToCancel.id, cancelReason);
                    setSuccessToast('Carona cancelada e passageiros notificados.');
                    setTimeout(() => setSuccessToast(null), 3000);
                    setRideToCancel(null);
                    setCancelReason('');
                  } catch (err) {
                    console.error('Erro ao cancelar carona:', err);
                  } finally {
                    setIsCanceling(false);
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCanceling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Cancelamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Concluir Viagem (Motorista) */}
      {rideToComplete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-emerald-600">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Concluir Viagem
                </h3>
                <p className="text-xs text-slate-500">
                  Marcar carona como finalizada e registrar a conclusão no extrato de viagens.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">Trajeto:</span>
                <span className="text-slate-900 font-bold truncate max-w-[200px]">
                  {rideToComplete.origin.name || rideToComplete.origin.address.split(',')[0]} ➔ {rideToComplete.destination.name || rideToComplete.destination.address.split(',')[0]}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">Data / Horário:</span>
                <span className="text-slate-900 font-bold">
                  {formatRideFriendlyDate(rideToComplete.departureDate)} às {rideToComplete.departureTime}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">Passageiros confirmados:</span>
                <span className="text-emerald-700 font-bold">
                  {rideToComplete.acceptedPassengers?.length || 0} pessoa(s)
                </span>
              </div>
              {rideToComplete.acceptedPassengers && rideToComplete.acceptedPassengers.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-1">
                  {rideToComplete.acceptedPassengers.map((p) => (
                    <span key={p.userId} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                      {p.userName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isCompletingRide}
                onClick={() => setRideToComplete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                id="btn-confirm-complete-ride"
                disabled={isCompletingRide}
                onClick={async () => {
                  if (!onCompleteRide || !rideToComplete) return;
                  setIsCompletingRide(true);
                  try {
                    await onCompleteRide(rideToComplete.id);
                    setSuccessToast('Viagem concluída com sucesso! Conclusão registrada no extrato.');
                    setTimeout(() => setSuccessToast(null), 4000);
                    setRideToComplete(null);
                  } catch (err) {
                    console.error('Erro ao concluir viagem:', err);
                  } finally {
                    setIsCompletingRide(false);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCompletingRide ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Concluindo...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Conclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Clean e Minimalista com link para o Modo Avançado */}
      <div className="pt-6 pb-8 text-center">
        <button
          type="button"
          id="btn-switch-to-advanced-bottom"
          onClick={onSwitchToAdvanced}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition cursor-pointer border border-transparent hover:border-indigo-100 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Quer mapa interativo ou rotas com IA? Abrir Versão Avançada</span>
        </button>
      </div>

      {/* Modal de Exclusão de Passageiro pelo Motorista (com Justificativa por Push e E-mail) */}
      <RemovePassengerModal
        isOpen={Boolean(passengerToRemove)}
        onClose={() => setPassengerToRemove(null)}
        ride={passengerToRemove?.ride || null}
        passenger={passengerToRemove?.passenger || null}
        passengerUser={
          passengerToRemove?.passenger && allUsers
            ? allUsers.find((u) => u.id === passengerToRemove.passenger.userId)
            : null
        }
        onConfirmRemove={async (rideId, passengerUserId, justification) => {
          if (onRemovePassenger) {
            await onRemovePassenger(rideId, passengerUserId, justification);
          }
        }}
      />

      {/* Modal de Edição da Viagem (Criador ou Administrador) */}
      {editingRide && (
        <EditRideModal
          ride={editingRide}
          currentUser={currentUser}
          groups={groups}
          isOpen={Boolean(editingRide)}
          onClose={() => setEditingRide(null)}
          onSave={async (rideId, updates) => {
            if (onUpdateRide) {
              await onUpdateRide(rideId, updates);
            }
            setEditingRide(null);
          }}
        />
      )}

      {/* Modal de Edição de Viagem pelo Passageiro (Trecho: Ida e Volta / Só Ida / Só Volta, Ponto de Encontro e Notas) */}
      {passengerRideToEdit && (
        <PassengerEditRideModal
          ride={passengerRideToEdit.ride}
          passenger={passengerRideToEdit.passenger}
          currentUser={currentUser}
          isOpen={Boolean(passengerRideToEdit)}
          onClose={() => setPassengerRideToEdit(null)}
          onSave={async (rideId, updates) => {
            if (onUpdatePassengerParticipation) {
              await onUpdatePassengerParticipation(rideId, updates);
            }
            setPassengerRideToEdit(null);
          }}
        />
      )}
    </div>
  );
};
