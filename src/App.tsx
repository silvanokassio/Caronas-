import React, { useState, useEffect } from 'react';
import { 
  INITIAL_COMMUNITIES,
  INITIAL_USERS, 
  INITIAL_GROUPS, 
  INITIAL_RIDES, 
  INITIAL_LEDGER, 
  INITIAL_NOTIFICATIONS 
} from './data/initialData';
import { User, Group, Community, Ride, LedgerTransaction, PushNotification, PendingRequest, Routine, GeoLocation, RideProposal, PassengerParticipant, Vehicle, getUserVehicles, isSuperUser } from './types';
import { sendEmailConfirmation } from './lib/emailClient';
import { Header } from './components/Header';
import { RidesView } from './components/RidesView';
import { GroupsView } from './components/GroupsView';
import { GamificationView } from './components/GamificationView';
import { GeminiVertexOptimizer } from './components/GeminiVertexOptimizer';
import { ArchitectureBlueprintView } from './components/ArchitectureBlueprintView';
import { UserProfileModal } from './components/UserProfileModal';
import { UserAreaView } from './components/UserAreaView';
import { AuthScreen } from './components/AuthScreen';
import { 
  initializeFirebaseData, 
  subscribeToUsers, 
  subscribeToGroups, 
  subscribeToCommunities,
  subscribeToRides, 
  subscribeToTransactions,
  createFirestoreRide,
  updateFirestoreRide,
  deleteFirestoreRide,
  createFirestoreGroup,
  updateFirestoreGroup,
  deleteFirestoreGroup,
  joinFirestoreGroup,
  requestJoinFirestoreGroup,
  approveGroupJoinRequest,
  rejectGroupJoinRequest,
  inviteUserToGroup,
  acceptGroupInvitation,
  rejectGroupInvitation,
  saveFirestoreRoutine,
  addFirestoreTransaction,
  updateFirestoreUserProfile,
  logoutAppUser,
  createFirestoreNotification,
  subscribeToNotifications,
  requestSettlementFromPassenger,
  confirmSettlementByDriver,
  rejectSettlementByDriver,
  directSettlementByDriver
} from './lib/firebase';
import { Bell, CheckCircle, X, Car, Cloud, Database } from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USERS[0]); // Default to Carlos Mendes, allows switching or guest
  const [communities, setCommunities] = useState<Community[]>(INITIAL_COMMUNITIES);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [rides, setRides] = useState<Ride[]>(INITIAL_RIDES);
  const [ledger, setLedger] = useState<LedgerTransaction[]>(INITIAL_LEDGER);
  const [notifications, setNotifications] = useState<PushNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<'rides' | 'routines' | 'groups' | 'gamification' | 'ai_routes' | 'architecture' | 'user_area'>('rides');
  const [selectedGroupForRide, setSelectedGroupForRide] = useState<Group | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  // Active Toast for FCM simulation
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);

  const triggerToast = (title: string, body: string) => {
    setActiveToast({ title, body });
    setTimeout(() => {
      setActiveToast((prev) => (prev?.title === title ? null : prev));
    }, 4500);
  };

  // Firebase Real-time Subscriptions & Initialization
  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubRides: (() => void) | undefined;
    let unsubTxs: (() => void) | undefined;

    async function init() {
      try {
        await initializeFirebaseData();
        setIsFirebaseConnected(true);

        unsubUsers = subscribeToUsers((firestoreUsers) => {
          if (firestoreUsers && firestoreUsers.length > 0) {
            const legacyMockIds = new Set([
              'usr-carlos-mot',
              'usr-beatriz-pass',
              'usr-gabriela-mot',
              'usr-lucas-pass',
              'usr-zemaps-pass',
              'usr-mariana-mot',
              'usr-diego-mot',
            ]);
            const userMap = new Map<string, User>();
            firestoreUsers
              .filter((u) => !legacyMockIds.has(u.id))
              .forEach((u) => userMap.set(u.id, u));
            
            const uniqueUsers = Array.from(userMap.values());
            if (uniqueUsers.length > 0) {
              setUsers(uniqueUsers);
              // Sync current user reference
              setCurrentUser((prev) => {
                if (!prev) return uniqueUsers[0] || null;
                const updated = uniqueUsers.find((u) => u.id === prev.id);
                return updated || prev || uniqueUsers[0];
              });
            }
          }
        });

        unsubGroups = subscribeToGroups((firestoreGroups) => {
          if (firestoreGroups) {
            const groupMap = new Map<string, Group>();
            firestoreGroups.forEach((g) => groupMap.set(g.id, g));
            setGroups(Array.from(groupMap.values()));
          }
        });

        subscribeToCommunities((firestoreComms) => {
          if (firestoreComms) {
            const commMap = new Map<string, Community>();
            firestoreComms.forEach((c) => commMap.set(c.id, c));
            setCommunities(Array.from(commMap.values()));
          }
        });

        unsubRides = subscribeToRides((firestoreRides) => {
          if (firestoreRides) {
            const rideMap = new Map<string, Ride>();
            firestoreRides.forEach((r) => rideMap.set(r.id, r));
            const uniqueRides = Array.from(rideMap.values());
            // Sort active / newest first
            const sorted = uniqueRides.sort((a, b) => 
              new Date(`${b.departureDate}T${b.departureTime}`).getTime() - 
              new Date(`${a.departureDate}T${a.departureTime}`).getTime()
            );
            setRides(sorted);
          }
        });

        unsubTxs = subscribeToTransactions((firestoreTxs) => {
          if (firestoreTxs) {
            const txMap = new Map<string, LedgerTransaction>();
            firestoreTxs.forEach((t) => txMap.set(t.id, t));
            setLedger(Array.from(txMap.values()));
          }
        });
      } catch (err) {
        console.error('Firebase setup listener error:', err);
      }
    }

    init();

    // Request Web Push Notification permission if supported
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (_) {}
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubGroups) unsubGroups();
      if (unsubRides) unsubRides();
      if (unsubTxs) unsubTxs();
    };
  }, []);

  // Real-time Push Notifications subscription from Firestore for current user
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToNotifications(currentUser.id, (firestoreNotifs) => {
      if (firestoreNotifs && firestoreNotifs.length > 0) {
        setNotifications((prev) => {
          const map = new Map<string, PushNotification>();
          firestoreNotifs.forEach((n) => map.set(n.id, n));
          prev.forEach((n) => {
            if (!map.has(n.id)) map.set(n.id, n);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  // Notification helper
  const addNotification = (title: string, body: string, type: any, rideId?: string) => {
    const newNtf: PushNotification = {
      id: `ntf-${Date.now()}`,
      userId: currentUser.id,
      title,
      body,
      type,
      rideId,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNtf, ...prev]);
    triggerToast(title, body);
  };

  // Create Ride (Writes to Firestore)
  const handleCreateRide = async (ridePayload: Partial<Ride>) => {
    const isOffer = (ridePayload.rideType || 'offer') === 'offer';
    
    // Construct new ride without undefined properties
    // Avulsas: Sem vínculo de grupo, obrigatoriamente públicas
    const isAvulsa = !ridePayload.targetGroupId;
    const visibility = isAvulsa ? 'public' : (ridePayload.visibility || 'group');

    const newRide: Omit<Ride, 'id'> = {
      rideType: ridePayload.rideType || 'offer',
      driverId: currentUser.id,
      driverName: currentUser.name,
      driverAvatar: currentUser.avatar,
      origin: ridePayload.origin!,
      destination: ridePayload.destination!,
      departureDate: ridePayload.departureDate || new Date().toISOString().split('T')[0],
      departureTime: ridePayload.departureTime || '07:30',
      price: isOffer ? (Number(ridePayload.price) || 0) : 0,
      totalSeats: Number(ridePayload.totalSeats) || (isOffer ? 3 : 1),
      occupiedSeats: 0,
      visibility,
      authorGroupIds: currentUser.groups || [],
      status: 'agendada',
      distanceKm: ridePayload.distanceKm || 8.4,
      estimatedDurationMin: ridePayload.estimatedDurationMin || 22,
      fuelCostEstimated: ridePayload.fuelCostEstimated || 7.20,
      estimatedCarbonSavingKg: ridePayload.estimatedCarbonSavingKg || 3.4,
      acceptedPassengers: [],
      pendingRequests: [],
      waypointsOrder: ridePayload.waypointsOrder || [],
      ...(ridePayload.description ? { description: ridePayload.description } : {}),
      ...(ridePayload.notes ? { notes: ridePayload.notes } : {}),
      ...(ridePayload.driverVehicle 
        ? { driverVehicle: ridePayload.driverVehicle } 
        : (currentUser.vehicle 
            ? { driverVehicle: currentUser.vehicle } 
            : (isOffer ? { driverVehicle: { model: 'Veículo Cadastrado', plate: 'BRA-2026', color: 'Prata' } } : {}))),
      ...(ridePayload.targetGroupId ? { targetGroupId: ridePayload.targetGroupId } : {}),
      ...(ridePayload.targetGroupName ? { targetGroupName: ridePayload.targetGroupName } : {}),
      ...(ridePayload.requesterNote ? { requesterNote: ridePayload.requesterNote } : {}),
    };

    try {
      const rideId = await createFirestoreRide(newRide);
      // Safe optimistic local state update
      setRides((prev) => {
        if (prev.some((r) => r.id === rideId)) return prev;
        return [{ id: rideId, ...newRide }, ...prev];
      });

      const notifTitle = newRide.rideType === 'request' ? '🙋‍♂️ Pedido de Carona Publicado!' : '🚗 Carona Publicada no Firestore!';
      const notifBody = newRide.rideType === 'request' 
        ? `Seu pedido para ${newRide.destination.address} (${newRide.departureTime}) está visível para motoristas próximos.`
        : `Sua oferta para ${newRide.destination.address} (${newRide.departureTime}) foi salva na nuvem.`;

      addNotification(
        notifTitle,
        notifBody,
        'NEW_RIDE_GROUP',
        rideId
      );

      // Disparar e-mail de confirmação (Padrão GEA)
      if (newRide.rideType === 'offer' && currentUser.email) {
        sendEmailConfirmation({
          type: 'RIDE_CREATED',
          recipientEmail: currentUser.email,
          recipientName: currentUser.name,
          rideId,
          rideData: {
            originAddress: newRide.origin.address,
            destinationAddress: newRide.destination.address,
            departureDate: newRide.departureDate,
            departureTime: newRide.departureTime,
            price: newRide.price,
            totalSeats: newRide.totalSeats,
            vehicleModel: newRide.driverVehicle?.model,
            vehiclePlate: newRide.driverVehicle?.plate,
            groupName: newRide.targetGroupName,
            notes: newRide.notes,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }
    } catch (err) {
      console.error('Error creating ride in Firestore:', err);
    }
  };

  // Join Ride (Auto-acceptance vs Pending Request)
  const handleJoinRide = async (rideId: string, isAutoAccepted: boolean) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    // Verificar limite de vagas
    if (targetRide.occupiedSeats >= targetRide.totalSeats) {
      alert('Vagas Esgotadas: Todas as vagas desta carona já foram preenchidas.');
      return;
    }

    // Regra de Governança: Caronas vinculadas a grupo exigem que o usuário seja membro aprovado do grupo
    if (targetRide.targetGroupId) {
      const targetGroup = groups.find((g) => g.id === targetRide.targetGroupId);
      const isMember = targetGroup?.memberIds?.includes(currentUser.id) || isSuperUser(currentUser);
      if (!isMember) {
        alert(
          `Acesso Restrito ao Grupo: Esta carona pertence ao grupo exclusivo "${targetRide.targetGroupName || targetGroup?.name}".\n\nApenas membros aprovados podem confirmar a reserva de vaga. Solicite sua adesão ao grupo na aba "Grupos & Comunidades".`
        );
        return;
      }
    }

    if (isAutoAccepted) {
      // Requisito 1.B: Se pertence ao grupo -> Aceite Imediato Automático!
      const newPassenger = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        institutionName: currentUser.institutionName,
        meetingPoint: currentUser.ponto_encontro_default,
        joinedAt: new Date().toISOString(),
        autoAccepted: true,
      };

      const updatedAccepted = [...targetRide.acceptedPassengers, newPassenger];
      const updatedOccupied = targetRide.occupiedSeats + 1;

      try {
        await updateFirestoreRide(rideId, {
          acceptedPassengers: updatedAccepted,
          occupiedSeats: updatedOccupied,
        });

        // Optimistic UI update
        setRides((prev) =>
          prev.map((r) => (r.id === rideId ? { ...r, acceptedPassengers: updatedAccepted, occupiedSeats: updatedOccupied } : r))
        );

        addNotification(
          '✅ Aceite Automático Confirmado!',
          `Por pertencer ao grupo, sua vaga na carona foi confirmada imediatamente no Firestore.`,
          'RIDE_ACCEPTED',
          rideId
        );

        // Disparar e-mail de confirmação para o passageiro
        if (currentUser.email) {
          sendEmailConfirmation({
            type: 'REQUEST_ACCEPTED',
            recipientEmail: currentUser.email,
            recipientName: currentUser.name,
            rideId,
            rideData: {
              driverName: targetRide.driverName,
              originAddress: targetRide.origin.address,
              destinationAddress: targetRide.destination.address,
              meetingPointAddress: currentUser.ponto_encontro_default.address,
              departureDate: targetRide.departureDate,
              departureTime: targetRide.departureTime,
              price: targetRide.price,
              vehicleModel: targetRide.driverVehicle?.model,
              vehiclePlate: targetRide.driverVehicle?.plate,
            },
          }).catch((e) => console.warn('Email dispatch warning:', e));
        }

        // Disparar aviso ao motorista
        const driverUser = users.find((u) => u.id === targetRide.driverId);
        if (driverUser?.email) {
          sendEmailConfirmation({
            type: 'NEW_PASSENGER_REQUEST',
            recipientEmail: driverUser.email,
            recipientName: driverUser.name,
            rideId,
            rideData: {
              passengerName: currentUser.name,
              originAddress: targetRide.origin.address,
              destinationAddress: targetRide.destination.address,
              meetingPointAddress: currentUser.ponto_encontro_default.address,
              departureDate: targetRide.departureDate,
              departureTime: targetRide.departureTime,
              availableSeats: Math.max(0, targetRide.totalSeats - updatedOccupied),
            },
          }).catch((e) => console.warn('Email dispatch warning:', e));
        }
      } catch (err) {
        console.error('Error joining ride:', err);
      }
    } else {
      // Requisito 1.B: Se carona pública e não pertence ao grupo -> Entra em fila de aprovação
      const newRequest: PendingRequest = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        institutionName: currentUser.institutionName,
        meetingPoint: currentUser.ponto_encontro_default,
        requestedAt: new Date().toISOString(),
        distanceFromRouteMeters: 380,
      };

      const updatedPending = [...targetRide.pendingRequests, newRequest];

      try {
        await updateFirestoreRide(rideId, {
          pendingRequests: updatedPending,
        });

        setRides((prev) =>
          prev.map((r) => (r.id === rideId ? { ...r, pendingRequests: updatedPending } : r))
        );

        addNotification(
          '⏳ Solicitação Enviada para o Motorista',
          `Sua solicitação com o ponto de encontro "${currentUser.ponto_encontro_default.name || currentUser.ponto_encontro_default.address}" foi enviada para avaliação.`,
          'NEW_REQUEST',
          rideId
        );

        // Disparar e-mail de solicitação enviada para o passageiro
        if (currentUser.email) {
          sendEmailConfirmation({
            type: 'RIDE_REQUEST_SENT',
            recipientEmail: currentUser.email,
            recipientName: currentUser.name,
            rideId,
            rideData: {
              driverName: targetRide.driverName,
              originAddress: targetRide.origin.address,
              destinationAddress: targetRide.destination.address,
              meetingPointAddress: currentUser.ponto_encontro_default.address,
              departureDate: targetRide.departureDate,
              departureTime: targetRide.departureTime,
              price: targetRide.price,
            },
          }).catch((e) => console.warn('Email dispatch warning:', e));
        }

        // Disparar e-mail de novo passageiro para o motorista
        const driverUser = users.find((u) => u.id === targetRide.driverId);
        if (driverUser?.email) {
          sendEmailConfirmation({
            type: 'NEW_PASSENGER_REQUEST',
            recipientEmail: driverUser.email,
            recipientName: driverUser.name,
            rideId,
            rideData: {
              passengerName: currentUser.name,
              originAddress: targetRide.origin.address,
              destinationAddress: targetRide.destination.address,
              meetingPointAddress: currentUser.ponto_encontro_default.address,
              departureDate: targetRide.departureDate,
              departureTime: targetRide.departureTime,
              availableSeats: Math.max(0, targetRide.totalSeats - targetRide.occupiedSeats),
            },
          }).catch((e) => console.warn('Email dispatch warning:', e));
        }
      } catch (err) {
        console.error('Error sending ride request:', err);
      }
    }
  };

  // Driver accepts request
  const handleAcceptRequest = async (rideId: string, request: PendingRequest) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    const newPassenger = {
      userId: request.userId,
      userName: request.userName,
      userAvatar: request.userAvatar,
      institutionName: request.institutionName,
      meetingPoint: request.meetingPoint,
      joinedAt: new Date().toISOString(),
      autoAccepted: false,
    };

    const updatedAccepted = [...targetRide.acceptedPassengers, newPassenger];
    const updatedPending = targetRide.pendingRequests.filter((r) => r.userId !== request.userId);
    const updatedOccupied = targetRide.occupiedSeats + 1;

    try {
      await updateFirestoreRide(rideId, {
        acceptedPassengers: updatedAccepted,
        pendingRequests: updatedPending,
        occupiedSeats: updatedOccupied,
      });

      setRides((prev) =>
        prev.map((r) => (r.id === rideId ? { ...r, acceptedPassengers: updatedAccepted, pendingRequests: updatedPending, occupiedSeats: updatedOccupied } : r))
      );

      addNotification(
        '🙋 Solicitação de Passageiro Aceita!',
        `Você confirmou o embarque de ${request.userName} no ponto "${request.meetingPoint.address}".`,
        'RIDE_ACCEPTED',
        rideId
      );

      // Disparar e-mail de confirmação de vaga aprovada para o passageiro
      const passengerUser = users.find((u) => u.id === request.userId);
      const passengerEmail = passengerUser?.email;
      if (passengerEmail) {
        sendEmailConfirmation({
          type: 'REQUEST_ACCEPTED',
          recipientEmail: passengerEmail,
          recipientName: request.userName,
          rideId,
          rideData: {
            driverName: targetRide.driverName,
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            meetingPointAddress: request.meetingPoint.address,
            departureDate: targetRide.departureDate,
            departureTime: targetRide.departureTime,
            price: targetRide.price,
            vehicleModel: targetRide.driverVehicle?.model,
            vehiclePlate: targetRide.driverVehicle?.plate,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  // Driver rejects request
  const handleRejectRequest = async (rideId: string, userId: string) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    const updatedPending = targetRide.pendingRequests.filter((r) => r.userId !== userId);

    try {
      await updateFirestoreRide(rideId, {
        pendingRequests: updatedPending,
      });

      setRides((prev) =>
        prev.map((r) => (r.id === rideId ? { ...r, pendingRequests: updatedPending } : r))
      );

      // Disparar e-mail informando o passageiro
      const passengerUser = users.find((u) => u.id === userId);
      if (passengerUser?.email) {
        sendEmailConfirmation({
          type: 'REQUEST_REJECTED',
          recipientEmail: passengerUser.email,
          recipientName: passengerUser.name,
          rideId,
          rideData: {
            driverName: targetRide.driverName,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  // Motorista acolhe pedido de carona e envia proposta de aprovação ao solicitante
  const handleSendProposalForRequest = async (
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
  ) => {
    if (!currentUser) return;
    const targetRide = rides.find((r) => r.id === requestRideId);
    if (!targetRide) return;

    const userVehicles = getUserVehicles(currentUser);
    const driverVehicle = proposalData.vehicle || userVehicles[0] || currentUser.vehicle;

    let linkedRideId = proposalData.existingRideId;

    // Se o motorista escolheu criar uma nova viagem sob medida para este pedido
    if (proposalData.mode === 'new_ride') {
      const newRideId = `ride-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const createdRide: Ride = {
        id: newRideId,
        rideType: 'offer',
        driverId: currentUser.id,
        driverName: currentUser.name,
        driverAvatar: currentUser.avatar,
        driverVehicle,
        origin: targetRide.origin,
        destination: targetRide.destination,
        departureDate: proposalData.departureDate,
        departureTime: proposalData.departureTime,
        price: proposalData.offeredPrice,
        totalSeats: proposalData.totalSeats || 4,
        occupiedSeats: 0,
        acceptedPassengers: [],
        pendingRequests: [],
        status: 'agendada',
        visibility: targetRide.visibility || 'public',
        targetGroupId: targetRide.targetGroupId,
        targetGroupName: targetRide.targetGroupName,
        distanceKm: targetRide.distanceKm || 8.5,
        estimatedDurationMin: targetRide.estimatedDurationMin || 22,
        fuelCostEstimated: targetRide.fuelCostEstimated || 7.2,
        estimatedCarbonSavingKg: targetRide.estimatedCarbonSavingKg || 1.8,
        createdAt: new Date().toISOString(),
        description: `Carona ${targetRide.origin.address.split(',')[0]} ➔ ${targetRide.destination.address.split(',')[0]}`,
        notes: proposalData.notes,
        waypointsOrder: [
          { lat: targetRide.origin.lat, lng: targetRide.origin.lng, label: `Embarque: ${targetRide.origin.address.split(',')[0]}`, type: 'origin', orderIndex: 0 },
          { lat: targetRide.destination.lat, lng: targetRide.destination.lng, label: `Destino: ${targetRide.destination.address.split(',')[0]}`, type: 'destination', orderIndex: 1 },
        ],
      };

      try {
        await createFirestoreRide(createdRide);
        setRides((prev) => [createdRide, ...prev]);
        linkedRideId = newRideId;
      } catch (err) {
        console.error('Error creating new ride for proposal:', err);
      }
    }

    const newProposal: RideProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      driverId: currentUser.id,
      driverName: currentUser.name,
      driverAvatar: currentUser.avatar,
      driverRating: currentUser.rating ?? 5.0,
      driverVehicle,
      offeredPrice: proposalData.offeredPrice,
      departureTime: proposalData.departureTime,
      departureDate: proposalData.departureDate,
      notes: proposalData.notes,
      meetingPoint: proposalData.meetingPoint || targetRide.origin,
      status: 'pending',
      createdAt: new Date().toISOString(),
      fulfilledRideId: linkedRideId,
      mode: proposalData.mode,
      existingRideTitle: proposalData.existingRideTitle,
      destinationDistanceKm: proposalData.destinationDistanceKm,
    };

    const updatedProposals = [...(targetRide.proposals || []), newProposal];

    try {
      await updateFirestoreRide(requestRideId, {
        proposals: updatedProposals,
      });

      setRides((prev) =>
        prev.map((r) => (r.id === requestRideId ? { ...r, proposals: updatedProposals } : r))
      );

      const modeDesc = proposalData.mode === 'existing_ride' ? 'vinculada à sua viagem existente' : 'com uma nova viagem criada';
      triggerToast(
        'Proposta Enviada com Sucesso!',
        `Uma proposta de acolhimento (R$ ${proposalData.offeredPrice.toFixed(2)}, ${modeDesc}) foi enviada para ${targetRide.driverName}. O solicitante fará parte da carona assim que aprovar.`
      );

      addNotification(
        '🚗 Proposta de Acolhimento Enviada!',
        `Você propôs acolher o pedido de ${targetRide.driverName} por R$ ${proposalData.offeredPrice.toFixed(2)} (${modeDesc}). Aguardando aprovação do passageiro.`,
        'PROPOSAL_RECEIVED',
        requestRideId
      );

      // Disparar e-mail informando o solicitante sobre a proposta de acolhimento
      const requesterUser = users.find((u) => u.id === targetRide.driverId);
      if (requesterUser?.email) {
        sendEmailConfirmation({
          type: 'PROPOSAL_OFFERED',
          recipientEmail: requesterUser.email,
          recipientName: requesterUser.name,
          rideId: requestRideId,
          rideData: {
            driverName: currentUser.name,
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            departureTime: proposalData.departureTime,
            price: proposalData.offeredPrice,
            vehicleModel: driverVehicle?.model,
            vehiclePlate: driverVehicle?.plate,
            notes: proposalData.notes,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }
    } catch (err) {
      console.error('Error sending proposal for request:', err);
    }
  };

  // Solicitante (passageiro) aprova a proposta de acolhimento do motorista e passa a fazer parte da carona
  const handleAcceptProposal = async (requestRideId: string, proposalId: string) => {
    if (!currentUser) return;
    const targetRide = rides.find((r) => r.id === requestRideId);
    if (!targetRide) return;

    const proposal = targetRide.proposals?.find((p) => p.id === proposalId);
    if (!proposal) return;

    const updatedProposals = (targetRide.proposals || []).map((p) =>
      p.id === proposalId ? { ...p, status: 'accepted' as const } : p
    );

    // O solicitante agora faz parte oficial da carona com o valor da oferta cobrado pelo motorista
    const agreedDriverPrice = typeof proposal.offeredPrice === 'number' ? proposal.offeredPrice : (targetRide.price || 6.50);
    const newPassenger: PassengerParticipant = {
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      meetingPoint: proposal.meetingPoint || targetRide.origin,
      joinedAt: new Date().toISOString(),
      autoAccepted: false,
      institutionName: currentUser.institutionName,
      agreedPrice: agreedDriverPrice,
    };

    const updatedAccepted = [...(targetRide.acceptedPassengers || []).filter((p) => p.userId !== currentUser.id), newPassenger];

    try {
      // Se a proposta foi vinculada a uma viagem do motorista (existente ou recém criada), adiciona o passageiro nela
      if (proposal.fulfilledRideId) {
        const driverRide = rides.find((r) => r.id === proposal.fulfilledRideId);
        if (driverRide) {
          const updatedDriverPassengers = [
            ...(driverRide.acceptedPassengers || []).filter((p) => p.userId !== currentUser.id),
            newPassenger,
          ];
          const newOccupied = Math.min(driverRide.totalSeats ?? 4, (driverRide.occupiedSeats || 0) + 1);

          await updateFirestoreRide(driverRide.id, {
            acceptedPassengers: updatedDriverPassengers,
            occupiedSeats: newOccupied,
          });

          setRides((prev) =>
            prev.map((r) =>
              r.id === driverRide.id
                ? {
                    ...r,
                    acceptedPassengers: updatedDriverPassengers,
                    occupiedSeats: newOccupied,
                  }
                : r
            )
          );
        }
      }

      await updateFirestoreRide(requestRideId, {
        proposals: updatedProposals,
        price: proposal.offeredPrice,
        acceptedPassengers: updatedAccepted,
        occupiedSeats: Math.max(1, (targetRide.occupiedSeats || 0) + 1),
      });

      setRides((prev) =>
        prev.map((r) =>
          r.id === requestRideId
            ? {
                ...r,
                proposals: updatedProposals,
                price: proposal.offeredPrice,
                acceptedPassengers: updatedAccepted,
                occupiedSeats: Math.max(1, (r.occupiedSeats || 0) + 1),
              }
            : r
        )
      );

      triggerToast(
        'Acolhimento Aprovado!',
        `Você aprovou a proposta de ${proposal.driverName} por R$ ${proposal.offeredPrice.toFixed(2)}. Você agora faz parte oficial da carona!`
      );

      addNotification(
        '🎉 Acolhimento Aprovado & Carona Confirmada!',
        `Você aprovou a proposta de ${proposal.driverName} (R$ ${proposal.offeredPrice.toFixed(2)} - ${proposal.departureTime}). Embarque: ${proposal.meetingPoint?.address || targetRide.origin.address}.`,
        'PROPOSAL_ACCEPTED',
        requestRideId
      );

      // Disparar e-mail para o motorista informando o acolhimento aprovado
      const driverUser = users.find((u) => u.id === proposal.driverId);
      if (driverUser?.email) {
        sendEmailConfirmation({
          type: 'PROPOSAL_ACCEPTED',
          recipientEmail: driverUser.email,
          recipientName: driverUser.name,
          rideId: requestRideId,
          rideData: {
            passengerName: currentUser.name,
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            departureTime: proposal.departureTime,
            price: proposal.offeredPrice,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }

      // Disparar confirmação para o passageiro
      if (currentUser.email) {
        sendEmailConfirmation({
          type: 'REQUEST_ACCEPTED',
          recipientEmail: currentUser.email,
          recipientName: currentUser.name,
          rideId: requestRideId,
          rideData: {
            driverName: proposal.driverName,
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            meetingPointAddress: proposal.meetingPoint?.address || targetRide.origin.address,
            departureDate: proposal.departureDate,
            departureTime: proposal.departureTime,
            price: proposal.offeredPrice,
            vehicleModel: proposal.driverVehicle?.model,
            vehiclePlate: proposal.driverVehicle?.plate,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }
    } catch (err) {
      console.error('Error accepting proposal:', err);
    }
  };

  // Solicitante recusa a proposta de acolhimento
  const handleRejectProposal = async (requestRideId: string, proposalId: string) => {
    const targetRide = rides.find((r) => r.id === requestRideId);
    if (!targetRide) return;

    const updatedProposals = (targetRide.proposals || []).map((p) =>
      p.id === proposalId ? { ...p, status: 'rejected' as const } : p
    );

    try {
      await updateFirestoreRide(requestRideId, {
        proposals: updatedProposals,
      });

      setRides((prev) =>
        prev.map((r) => (r.id === requestRideId ? { ...r, proposals: updatedProposals } : r))
      );

      triggerToast('Proposta Declinada', 'A proposta foi recusada. Seu pedido permanece ativo para outros motoristas.');
    } catch (err) {
      console.error('Error rejecting proposal:', err);
    }
  };

  // Start Ride
  const handleStartRide = async (rideId: string) => {
    const startedAt = new Date().toISOString();
    const targetRide = rides.find((r) => r.id === rideId);
    try {
      await updateFirestoreRide(rideId, {
        status: 'em_andamento',
        startedAt,
      });

      setRides((prev) =>
        prev.map((ride) => (ride.id === rideId ? { ...ride, status: 'em_andamento', startedAt } : ride))
      );

      addNotification(
        '🚀 Percurso Iniciado!',
        'O streaming de geolocalização em tempo real via Firestore Subcollection foi ativado para os passageiros.',
        'DRIVER_STARTED',
        rideId
      );

      // Disparar notificação Push Firestore para cada passageiro aceito
      if (targetRide && targetRide.acceptedPassengers) {
        for (const p of targetRide.acceptedPassengers) {
          createFirestoreNotification({
            userId: p.userId,
            title: '🚗 Motorista a Caminho!',
            body: `${targetRide.driverName} iniciou o percurso no ${targetRide.driverVehicle?.model || 'veículo'} (${targetRide.driverVehicle?.plate || 'BRA-2026'}). Acompanhe o trajeto em tempo real!`,
            type: 'DRIVER_STARTED',
            rideId,
            timestamp: new Date().toISOString(),
            read: false,
          }).catch((e) => console.warn('Firestore notification write warning:', e));
        }
      }

      // Disparar Web Push Notification via HTML5 API se permitido
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && targetRide) {
        try {
          new Notification('🚗 Percurso Iniciado!', {
            body: `A viagem com destino a ${targetRide.destination.address} começou. Acompanhe em tempo real!`,
            icon: targetRide.driverAvatar,
          });
        } catch (_) {}
      }

      // Disparar e-mail para todos os passageiros com confirmação de início
      if (targetRide) {
        for (const p of targetRide.acceptedPassengers || []) {
          const passengerUser = users.find((u) => u.id === p.userId);
          if (passengerUser?.email) {
            sendEmailConfirmation({
              type: 'RIDE_STARTED',
              recipientEmail: passengerUser.email,
              recipientName: passengerUser.name,
              rideId,
              rideData: {
                driverName: targetRide.driverName,
                originAddress: targetRide.origin.address,
                destinationAddress: targetRide.destination.address,
                vehicleModel: targetRide.driverVehicle?.model,
                vehiclePlate: targetRide.driverVehicle?.plate,
              },
            }).catch((e) => console.warn('Email dispatch warning:', e));
          }
        }
      }
    } catch (err) {
      console.error('Error starting ride:', err);
    }
  };

  // Complete Ride (Writes transactions directly to Firestore Ledger & recalculates balances)
  const handleCompleteRide = async (rideId: string) => {
    const ride = rides.find((r) => r.id === rideId);
    if (!ride || ride.status === 'concluida') return;

    const completedAt = new Date().toISOString();

    try {
      // 1. Update ride status in Firestore
      await updateFirestoreRide(rideId, {
        status: 'concluida',
        completedAt,
      });

      // 2. Add ledger transaction for driver (+1 point and +R$ rateio baseados no valor do motorista aceito)
      const totalDriverCreditBRL = ride.acceptedPassengers && ride.acceptedPassengers.length > 0
        ? ride.acceptedPassengers.reduce((sum, p) => sum + (typeof p.agreedPrice === 'number' ? p.agreedPrice : (ride.price || 6.50)), 0)
        : (ride.price || 6.50);

      const driverTx: Omit<LedgerTransaction, 'id'> = {
        userId: ride.driverId,
        rideId: ride.id,
        amount: 1,
        valueBRL: totalDriverCreditBRL,
        type: 'OFFERED_RIDE',
        category: 'OFFER',
        counterpartName: ride.acceptedPassengers.map((p) => p.userName).join(', ') || 'Passageiros da Rede',
        paymentMethod: 'Compensação Automática Ledger',
        status: 'COMPLETED',
        description: `Crédito de Carona: ${ride.origin.name || ride.origin.address.split(',')[0]} ➔ ${ride.destination.name || ride.destination.address.split(',')[0]} (${ride.acceptedPassengers.length} passageiro(s))`,
        timestamp: completedAt,
      };

      await addFirestoreTransaction(driverTx);

      // 3. Add ledger transactions for passengers (-1 each and -R$ rateio definido pelo motorista aceito)
      for (const p of ride.acceptedPassengers) {
        const passengerPrice = typeof p.agreedPrice === 'number' ? p.agreedPrice : (ride.price || 6.50);
        const passengerTx: Omit<LedgerTransaction, 'id'> = {
          userId: p.userId,
          rideId: ride.id,
          amount: -1,
          valueBRL: -passengerPrice,
          type: 'RECEIVED_RIDE',
          category: 'RIDE',
          counterpartName: `${ride.driverName} (Motorista)`,
          paymentMethod: 'Débito Automático Conta Caronas Bank',
          status: 'COMPLETED',
          description: `Débito de Embarque: Embarcou com ${ride.driverName} (Tarifa do Motorista: R$ ${passengerPrice.toFixed(2)})`,
          timestamp: completedAt,
        };
        await addFirestoreTransaction(passengerTx);
      }

      addNotification(
        '🎉 Carona Concluída no Firestore!',
        `Saldo gravado no Ledger Imutável: Motorista (+1 ponto), Passageiros (-1 ponto cada).`,
        'RIDE_COMPLETED',
        rideId
      );

      // Disparar e-mail de recibo e conclusão para o motorista
      const driverUser = users.find((u) => u.id === ride.driverId);
      if (driverUser?.email) {
        sendEmailConfirmation({
          type: 'RIDE_COMPLETED',
          recipientEmail: driverUser.email,
          recipientName: driverUser.name,
          rideId,
          rideData: {
            originAddress: ride.origin.address,
            destinationAddress: ride.destination.address,
            price: totalDriverCreditBRL,
            carbonSavingKg: ride.estimatedCarbonSavingKg || 3.4,
          },
        }).catch((e) => console.warn('Email dispatch warning:', e));
      }

      // Disparar e-mail de recibo para cada passageiro
      for (const p of ride.acceptedPassengers) {
        const passengerUser = users.find((u) => u.id === p.userId);
        if (passengerUser?.email) {
          sendEmailConfirmation({
            type: 'RIDE_COMPLETED',
            recipientEmail: passengerUser.email,
            recipientName: passengerUser.name,
            rideId,
            rideData: {
              driverName: ride.driverName,
              originAddress: ride.origin.address,
              destinationAddress: ride.destination.address,
              price: ride.price || 6.50,
              carbonSavingKg: (ride.estimatedCarbonSavingKg || 3.4) / Math.max(1, ride.acceptedPassengers.length),
            },
          }).catch((e) => console.warn('Email dispatch warning:', e));
        }
      }
    } catch (err) {
      console.error('Error completing ride in Firestore:', err);
    }
  };

  // Group actions with Firestore
  const handleJoinGroup = async (groupId: string) => {
    try {
      await joinFirestoreGroup(groupId, currentUser.id);

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, memberIds: [...g.memberIds, currentUser.id], memberCount: (g.memberCount || g.memberIds.length) + 1 } : g
        )
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, groups: [...u.groups, groupId] } : u))
      );
      setCurrentUser((prev) => ({ ...prev, groups: [...prev.groups, groupId] }));

      addNotification(
        '👥 Novo Grupo Sincronizado no Firestore!',
        'Você agora tem direito a Aceite Automático nas caronas deste grupo.',
        'NEW_RIDE_GROUP'
      );
    } catch (err) {
      console.error('Error joining group:', err);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    const updatedMemberIds = groups.find((g) => g.id === groupId)?.memberIds.filter((id) => id !== currentUser.id) || [];
    const updatedUserGroups = currentUser.groups.filter((id) => id !== groupId);

    try {
      await updateFirestoreUserProfile(currentUser.id, { groups: updatedUserGroups });

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, memberIds: updatedMemberIds, memberCount: Math.max(0, (g.memberCount || g.memberIds.length) - 1) }
            : g
        )
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, groups: updatedUserGroups } : u))
      );
      setCurrentUser((prev) => ({ ...prev, groups: updatedUserGroups }));
    } catch (err) {
      console.error('Error leaving group:', err);
    }
  };

  const handleCreateGroup = async (groupPayload: Partial<Group>) => {
    if (!currentUser) {
      triggerToast('Atenção', 'Faça login para criar um grupo.');
      return;
    }

    const defaultDest = groupPayload.defaultDestination || {
      address: 'Av. Prof. Luciano Gualberto, 380 - Butantã, São Paulo - SP',
      lat: -23.5574,
      lng: -46.7314,
      name: 'Destino Principal'
    };

    const newGroup: Omit<Group, 'id'> = {
      name: groupPayload.name || 'Nova Comunidade',
      category: groupPayload.category || 'academic',
      domainRestricted: groupPayload.domainRestricted,
      description: groupPayload.description || '',
      icon: groupPayload.icon || 'Users',
      creatorId: currentUser.id,
      adminIds: [currentUser.id],
      defaultDestination: defaultDest,
      defaultPrice: groupPayload.defaultPrice !== undefined ? Number(groupPayload.defaultPrice) : 6.50,
      defaultDepartureTime: groupPayload.defaultDepartureTime || '07:30',
      pendingJoinRequests: [],
      pendingInvitations: [],
      memberIds: [currentUser.id],
      memberCount: 1,
      createdAt: new Date().toISOString(),
    };

    try {
      const groupId = await createFirestoreGroup(newGroup);
      const updatedUserGroups = [...currentUser.groups, groupId];
      await updateFirestoreUserProfile(currentUser.id, { groups: updatedUserGroups });

      setGroups((prev) => {
        if (prev.some((g) => g.id === groupId)) return prev;
        return [{ id: groupId, ...newGroup }, ...prev];
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, groups: updatedUserGroups } : u))
      );
      setCurrentUser((prev) => ({ ...prev, groups: updatedUserGroups }));

      addNotification('🏛️ Grupo Criado com Gestão Ativa!', `O grupo "${newGroup.name}" foi criado. Você é o administrador responsável.`, 'NEW_RIDE_GROUP');
    } catch (err) {
      console.error('Error creating group:', err);
    }
  };

  const handleUpdateGroup = async (groupId: string, updates: Partial<Group>) => {
    if (!currentUser) {
      triggerToast('Atenção', 'Faça login para editar as informações do grupo.');
      return;
    }

    try {
      await updateFirestoreGroup(groupId, updates);

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
      );

      triggerToast('Grupo Atualizado com Sucesso!', 'As alterações nas configurações e destino padrão do grupo foram salvas.');
      addNotification('✏️ Grupo Atualizado', `As configurações do grupo foram atualizadas pelo gestor.`, 'SYSTEM_ANNOUNCEMENT');
    } catch (err) {
      console.error('Error updating group:', err);
      triggerToast('Erro', 'Não foi possível atualizar o grupo no momento.');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!currentUser) {
      triggerToast('Atenção', 'Faça login para excluir o grupo.');
      return;
    }

    const targetGroup = groups.find((g) => g.id === groupId);
    try {
      await deleteFirestoreGroup(groupId);

      setGroups((prev) => prev.filter((g) => g.id !== groupId));

      // Remove group from all local users
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          groups: (u.groups || []).filter((id) => id !== groupId),
        }))
      );

      if (currentUser.groups.includes(groupId)) {
        setCurrentUser((prev) =>
          prev ? { ...prev, groups: prev.groups.filter((id) => id !== groupId) } : null
        );
      }

      triggerToast('Grupo Excluído', `O grupo "${targetGroup?.name || groupId}" foi excluído com sucesso.`);
    } catch (err) {
      console.error('Error deleting group:', err);
      triggerToast('Erro', 'Não foi possível excluir o grupo.');
    }
  };

  // Group Governance: Request to Join
  const handleRequestJoinGroup = async (groupId: string) => {
    if (!currentUser) {
      triggerToast('Atenção', 'Faça login para solicitar entrada no grupo.');
      return;
    }

    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    try {
      await requestJoinFirestoreGroup(groupId, currentUser);

      // Optimistic update
      const newReq = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        userEmail: currentUser.email,
        requestedAt: new Date().toISOString(),
        status: 'pending' as const,
      };

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, pendingJoinRequests: [...(g.pendingJoinRequests || []).filter((r) => r.userId !== currentUser.id), newReq] }
            : g
        )
      );

      triggerToast('Solicitação Enviada!', `Seu pedido para entrar em "${targetGroup.name}" foi enviado ao gestor.`);
    } catch (err) {
      console.error('Error requesting to join group:', err);
    }
  };

  // Group Governance: Admin Approves Join Request
  const handleApproveJoinRequest = async (groupId: string, targetUserId: string) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetGroup) return;

    try {
      await approveGroupJoinRequest(groupId, targetUserId);

      // Optimistic update
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const updatedRequests = (g.pendingJoinRequests || []).filter((r) => r.userId !== targetUserId);
          const updatedMembers = Array.from(new Set([...g.memberIds, targetUserId]));
          return {
            ...g,
            pendingJoinRequests: updatedRequests,
            memberIds: updatedMembers,
            memberCount: updatedMembers.length,
          };
        })
      );

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== targetUserId) return u;
          return { ...u, groups: Array.from(new Set([...u.groups, groupId])) };
        })
      );

      if (currentUser?.id === targetUserId) {
        setCurrentUser((prev) => prev ? { ...prev, groups: Array.from(new Set([...prev.groups, groupId])) } : null);
      }

      triggerToast('Membro Aprovado!', `${targetUser?.name || 'O usuário'} agora é membro oficial do grupo "${targetGroup.name}".`);
    } catch (err) {
      console.error('Error approving join request:', err);
    }
  };

  // Group Governance: Admin Rejects Join Request
  const handleRejectJoinRequest = async (groupId: string, targetUserId: string) => {
    try {
      await rejectGroupJoinRequest(groupId, targetUserId);

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, pendingJoinRequests: (g.pendingJoinRequests || []).filter((r) => r.userId !== targetUserId) }
            : g
        )
      );

      triggerToast('Solicitação Recusada', 'A solicitação de entrada foi recusada.');
    } catch (err) {
      console.error('Error rejecting join request:', err);
    }
  };

  // Group Governance: Admin Invites User
  const handleInviteUser = async (groupId: string, targetUserId: string) => {
    if (!currentUser) return;
    const targetGroup = groups.find((g) => g.id === groupId);
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetGroup || !targetUser) return;

    try {
      await inviteUserToGroup(groupId, targetUser, currentUser);

      const newInv = {
        userId: targetUser.id,
        userName: targetUser.name,
        userAvatar: targetUser.avatar,
        invitedByUserId: currentUser.id,
        invitedByUserName: currentUser.name,
        invitedAt: new Date().toISOString(),
        status: 'pending' as const,
      };

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, pendingInvitations: [...(g.pendingInvitations || []).filter((i) => i.userId !== targetUserId), newInv] }
            : g
        )
      );

      triggerToast('Convite Enviado!', `Convite para ${targetUser.name} participar de "${targetGroup.name}" enviado. Aguardando aprovação do usuário.`);
    } catch (err) {
      console.error('Error inviting user to group:', err);
    }
  };

  // Group Governance: User Accepts Invitation
  const handleAcceptInvitation = async (groupId: string) => {
    if (!currentUser) return;
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    try {
      await acceptGroupInvitation(groupId, currentUser.id);

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const updatedInvites = (g.pendingInvitations || []).filter((i) => i.userId !== currentUser.id);
          const updatedMembers = Array.from(new Set([...g.memberIds, currentUser.id]));
          return {
            ...g,
            pendingInvitations: updatedInvites,
            memberIds: updatedMembers,
            memberCount: updatedMembers.length,
          };
        })
      );

      const updatedUserGroups = Array.from(new Set([...currentUser.groups, groupId]));
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, groups: updatedUserGroups } : u))
      );
      setCurrentUser((prev) => prev ? { ...prev, groups: updatedUserGroups } : null);

      triggerToast('Convite Aceito!', `Você agora faz parte do grupo "${targetGroup.name}".`);
    } catch (err) {
      console.error('Error accepting invitation:', err);
    }
  };

  // Group Governance: User Rejects Invitation
  const handleRejectInvitation = async (groupId: string) => {
    if (!currentUser) return;
    try {
      await rejectGroupInvitation(groupId, currentUser.id);

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, pendingInvitations: (g.pendingInvitations || []).filter((i) => i.userId !== currentUser.id) }
            : g
        )
      );

      triggerToast('Convite Declinado', 'Você recusou o convite do grupo.');
    } catch (err) {
      console.error('Error rejecting invitation:', err);
    }
  };

  // Group Trip Inheritance: Create Ride from Group Parameters
  const handleCreateRideFromGroup = (group: Group) => {
    setSelectedGroupForRide(group);
    setActiveTab('rides');
    triggerToast(
      'Viagem Herdada do Grupo!',
      `Destino (${group.defaultDestination?.name || group.defaultDestination?.address}), valor (R$ ${group.defaultPrice?.toFixed(2) || '6,50'}) e horário (${group.defaultDepartureTime || '07:30'}) herdados de "${group.name}".`
    );
  };

  // One-Click Ride Creation from Weekly Grid inheriting group & driver profile defaults
  const handleQuickCreateRideFromGrid = async (dayDateStr: string, group: Group) => {
    if (!currentUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    const userVehicles = getUserVehicles(currentUser);
    const primaryVehicle = userVehicles.find((v) => v.isPrimary) || userVehicles[0] || currentUser.vehicle;
    const totalSeats = primaryVehicle?.availableSeats || 4;

    const originLocation = currentUser.residentialAddress?.lat && currentUser.residentialAddress?.lng
      ? currentUser.residentialAddress
      : currentUser.ponto_encontro_default?.lat && currentUser.ponto_encontro_default?.lng
      ? currentUser.ponto_encontro_default
      : {
          address: 'Ponto Padrão do Motorista',
          lat: -23.5505,
          lng: -46.6333,
          name: 'Ponto Residencial',
        };

    const destLocation = group.defaultDestination && group.defaultDestination.lat && group.defaultDestination.lng
      ? group.defaultDestination
      : {
          address: 'Destino do Grupo',
          lat: -23.559,
          lng: -46.645,
          name: group.name,
        };

    const newRideData: Partial<Ride> = {
      rideType: 'offer',
      driverId: currentUser.id,
      driverName: currentUser.name,
      driverAvatar: currentUser.avatar,
      driverVehicle: primaryVehicle,
      origin: originLocation,
      destination: destLocation,
      departureDate: dayDateStr,
      departureTime: group.defaultDepartureTime || '07:30',
      price: typeof group.defaultPrice === 'number' ? group.defaultPrice : 6.5,
      totalSeats: totalSeats,
      occupiedSeats: 0,
      acceptedPassengers: [],
      pendingRequests: [],
      status: 'agendada',
      visibility: 'group',
      targetGroupId: group.id,
      targetGroupName: group.name,
      description: `Carona ${group.name} (${originLocation.address.split(',')[0]} ➔ ${destLocation.address.split(',')[0]})`,
      notes: `Carona gerada em 1 clique para o grupo ${group.name}. Para ajustes finos de rota ou horário, clique em 'Editar Viagem'.`,
    };

    try {
      await handleCreateRide(newRideData);
      triggerToast(
        '⚡ Viagem Criada em 1 Clique!',
        `Viagem para ${dayDateStr} criada com sucesso herdando as configurações de "${group.name}".`
      );
    } catch (err) {
      console.error('Error quick creating ride:', err);
      triggerToast('Erro', 'Não foi possível criar a carona rápida.');
    }
  };

  // Navigate to edit ride in RidesView
  const handleNavigateToRideEdit = (ride: Ride) => {
    setActiveTab('rides');
    triggerToast(
      'Edição de Viagem',
      `Acesse a viagem de ${ride.departureDate} na lista de caronas para editar detalhes.`
    );
  };

  // Cancel whole ride (by driver)
  const handleCancelRide = async (rideId: string) => {
    try {
      await deleteFirestoreRide(rideId);
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      triggerToast('Carona Cancelada', 'A carona foi removida do sistema com sucesso.');
    } catch (err) {
      console.error('Error canceling ride:', err);
      triggerToast('Erro', 'Não foi possível cancelar a carona.');
    }
  };

  // Cancel reservation (by passenger)
  const handleCancelReservation = async (rideId: string, userId: string) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    const updatedPassengers = (targetRide.acceptedPassengers || []).filter((p) => p.userId !== userId);
    const updatedOccupied = Math.max(0, updatedPassengers.length);

    try {
      await updateFirestoreRide(rideId, {
        acceptedPassengers: updatedPassengers,
        occupiedSeats: updatedOccupied,
      });

      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? { ...r, acceptedPassengers: updatedPassengers, occupiedSeats: updatedOccupied }
            : r
        )
      );

      triggerToast('Vaga Liberada', 'Sua reserva na carona foi desmarcada com sucesso.');
    } catch (err) {
      console.error('Error canceling passenger reservation:', err);
      triggerToast('Erro', 'Não foi possível cancelar a reserva.');
    }
  };

  // Handle Transfer PIX / Rateio between users
  const handleTransferPix = async (
    fromUser: User,
    toUser: User,
    amountBRL: number,
    description: string
  ) => {
    const timestamp = new Date().toISOString();

    const fromTx: Omit<LedgerTransaction, 'id'> = {
      userId: fromUser.id,
      rideId: 'pix-transfer',
      amount: 0,
      valueBRL: -amountBRL,
      type: 'PIX_TRANSFER',
      category: 'PIX',
      counterpartName: `${toUser.name} (Beneficiário)`,
      paymentMethod: 'Transferência Instantânea PIX',
      status: 'COMPLETED',
      description: `PIX Enviado: ${description} (Para: ${toUser.name})`,
      timestamp,
    };

    const toTx: Omit<LedgerTransaction, 'id'> = {
      userId: toUser.id,
      rideId: 'pix-transfer',
      amount: 0,
      valueBRL: amountBRL,
      type: 'PIX_TRANSFER',
      category: 'PIX',
      counterpartName: `${fromUser.name} (Pagador)`,
      paymentMethod: 'Transferência Instantânea PIX',
      status: 'COMPLETED',
      description: `PIX Recebido: ${description} (De: ${fromUser.name})`,
      timestamp,
    };

    try {
      await addFirestoreTransaction(fromTx);
      await addFirestoreTransaction(toTx);

      addNotification(
        '💸 Transferência PIX Gravada no Firestore!',
        `R$ ${amountBRL.toFixed(2)} transferidos com sucesso para a conta de ${toUser.name}.`,
        'RIDE_ACCEPTED'
      );
    } catch (err) {
      console.error('Error transferring PIX in Firestore:', err);
    }
  };

  // Metodologia de Quitação de Saldos (Motorista x Passageiros)
  // 1. Passageiro informa quitação ao motorista
  const handleRequestSettlement = async (passengerUser: User, driverUser: User, amount: number, notes?: string) => {
    try {
      const txId = await requestSettlementFromPassenger(passengerUser, driverUser, amount, notes);
      
      const now = new Date().toISOString();
      const settlementId = `stl-${Date.now()}`;
      const newTx: LedgerTransaction = {
        id: txId || `tx-${Date.now()}`,
        userId: passengerUser.id,
        rideId: `settlement-${settlementId}`,
        settlementId,
        amount: 0,
        valueBRL: Math.abs(amount),
        type: 'SETTLEMENT',
        category: 'PIX',
        counterpartId: driverUser.id,
        counterpartName: `${driverUser.name} (Motorista)`,
        paymentMethod: 'PIX / Quitação Informada',
        status: 'PENDING_CONFIRMATION',
        initiatedBy: 'passenger',
        passengerId: passengerUser.id,
        driverId: driverUser.id,
        description: notes
          ? `Quitação informada pelo passageiro: ${notes} (Aguardando confirmação de ${driverUser.name})`
          : `Quitação informada pelo passageiro (Aguardando confirmação de ${driverUser.name})`,
        timestamp: now,
      };

      setLedger((prev) => [newTx, ...prev]);

      triggerToast(
        'Quitação Informada!',
        `Quitação de R$ ${amount.toFixed(2)} informada. Seu saldo foi zerado e ${driverUser.name} foi notificado para validar.`
      );
    } catch (err) {
      console.error('Error requesting settlement:', err);
      triggerToast('Erro', 'Não foi possível registrar a quitação.');
    }
  };

  // 2. Motorista confirma quitação pendente informada por passageiro
  const handleConfirmSettlement = async (pendingTx: LedgerTransaction) => {
    const driverUser = users.find((u) => u.id === (pendingTx.driverId || pendingTx.counterpartId)) || currentUser;
    const passengerUser = users.find((u) => u.id === (pendingTx.passengerId || pendingTx.userId));
    if (!driverUser || !passengerUser) return;

    try {
      await confirmSettlementByDriver(pendingTx, driverUser, passengerUser);

      setLedger((prev) =>
        prev.map((t) =>
          t.id === pendingTx.id || (t.settlementId && t.settlementId === pendingTx.settlementId)
            ? {
                ...t,
                status: 'COMPLETED',
                description: `Quitação confirmada por ${driverUser.name}: Rateio liquidado com sucesso.`,
              }
            : t
        )
      );

      triggerToast(
        'Quitação Confirmada!',
        `Você confirmou o recebimento de R$ ${(pendingTx.valueBRL || 0).toFixed(2)} de ${passengerUser.name}.`
      );
    } catch (err) {
      console.error('Error confirming settlement:', err);
      triggerToast('Erro', 'Não foi possível confirmar a quitação.');
    }
  };

  // 3. Motorista recusa / contesta quitação
  const handleRejectSettlement = async (pendingTx: LedgerTransaction, reason?: string) => {
    const driverUser = users.find((u) => u.id === (pendingTx.driverId || pendingTx.counterpartId)) || currentUser;
    const passengerUser = users.find((u) => u.id === (pendingTx.passengerId || pendingTx.userId));
    if (!driverUser || !passengerUser) return;

    try {
      await rejectSettlementByDriver(pendingTx, driverUser, passengerUser, reason);

      setLedger((prev) =>
        prev.map((t) =>
          t.id === pendingTx.id || (t.settlementId && t.settlementId === pendingTx.settlementId)
            ? {
                ...t,
                status: 'SETTLED',
                valueBRL: 0,
                description: `Quitação contestada por ${driverUser.name}${reason ? `: ${reason}` : ''}`,
              }
            : t
        )
      );

      triggerToast('Quitação Não Reconhecida', `O passageiro ${passengerUser.name} foi avisado e o débito reaberto.`);
    } catch (err) {
      console.error('Error rejecting settlement:', err);
    }
  };

  // 4. Motorista dá quitação direta (ajuste automático para ambos)
  const handleDirectSettlementByDriver = async (driverUser: User, passengerUser: User, amount: number, notes?: string) => {
    try {
      await directSettlementByDriver(driverUser, passengerUser, amount, notes);

      const now = new Date().toISOString();
      const settlementId = `stl-${Date.now()}`;
      const passengerTx: LedgerTransaction = {
        id: `tx-${Date.now()}-1`,
        userId: passengerUser.id,
        rideId: `settlement-${settlementId}`,
        settlementId,
        amount: 0,
        valueBRL: Math.abs(amount),
        type: 'SETTLEMENT',
        category: 'PIX',
        counterpartId: driverUser.id,
        counterpartName: `${driverUser.name} (Motorista)`,
        paymentMethod: 'Quitação Direta pelo Motorista',
        status: 'COMPLETED',
        initiatedBy: 'driver',
        passengerId: passengerUser.id,
        driverId: driverUser.id,
        description: notes
          ? `Quitação registrada pelo motorista ${driverUser.name}: ${notes}`
          : `Quitação de rateio registrada pelo motorista ${driverUser.name}`,
        timestamp: now,
      };

      setLedger((prev) => [passengerTx, ...prev]);

      triggerToast(
        'Quitação Registrada!',
        `Você deu quitação de R$ ${amount.toFixed(2)} para ${passengerUser.name}. O saldo foi ajustado automaticamente.`
      );
    } catch (err) {
      console.error('Error in direct settlement:', err);
      triggerToast('Erro', 'Não foi possível registrar a quitação direta.');
    }
  };

  // Update routine in Firestore
  const handleUpdateRoutine = async (updatedRoutine: Routine, updatedMeetingPoint: GeoLocation) => {
    const updatedUser: User = {
      ...currentUser,
      routine: updatedRoutine,
      ponto_encontro_default: updatedMeetingPoint,
    };

    try {
      await saveFirestoreRoutine(currentUser.id, updatedRoutine);
      await updateFirestoreUserProfile(currentUser.id, {
        routine: updatedRoutine,
        ponto_encontro_default: updatedMeetingPoint,
      });

      setCurrentUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

      addNotification(
        '💾 Rotina Salva no Cloud Firestore!',
        'Seus horários e ponto de encontro padrão foram sincronizados na nuvem.',
        'NEW_RIDE_GROUP'
      );
    } catch (err) {
      console.error('Error updating routine:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Global Navigation Header */}
      <Header
        currentUser={currentUser}
        allUsers={users}
        onSelectUser={(u) => setCurrentUser(u)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode || 'login');
          setIsAuthModalOpen(true);
        }}
        onLogout={async () => {
          await logoutAppUser();
          setCurrentUser(null);
          setActiveTab('rides');
          triggerToast('Sessão Encerrada', 'Você saiu da sua conta. Áreas protegidas foram bloqueadas.');
        }}
        isFirebaseConnected={isFirebaseConnected}
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
        notifications={notifications}
        onMarkNotificationsRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
        onClearNotifications={() => {
          setNotifications([]);
          triggerToast('Notificações Limpas', 'Todas as notificações foram removidas.');
        }}
        onDeleteNotification={(id) => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'rides' && (
          <RidesView
            currentUser={currentUser}
            rides={rides}
            groups={groups}
            onCreateRide={handleCreateRide}
            onJoinRide={handleJoinRide}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
            onSendProposalForRequest={handleSendProposalForRequest}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
            onStartRide={handleStartRide}
            onCompleteRide={handleCompleteRide}
            initialGroupForRide={selectedGroupForRide}
            onClearInitialGroupForRide={() => setSelectedGroupForRide(null)}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'login');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {activeTab === 'routines' && (
          <UserAreaView
            currentUser={currentUser}
            allUsers={users}
            onUserUpdated={(updated) => {
              setCurrentUser(updated);
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
              triggerToast('Rotina e Preferências Atualizadas', 'Rotina fixa e ponto de encontro salvos com sucesso.');
            }}
            onUserDeleted={() => {
              setCurrentUser(null);
              triggerToast('Conta Excluída', 'Sua conta e dados associados foram excluídos do Firestore.');
            }}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'login');
              setIsAuthModalOpen(true);
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onUpdateRoutine={handleUpdateRoutine}
            initialSection="routines"
          />
        )}

        {activeTab === 'groups' && (
          <GroupsView
            currentUser={currentUser}
            groups={groups}
            allUsers={users}
            communities={communities}
            rides={rides}
            onJoinGroup={handleJoinGroup}
            onRequestJoinGroup={handleRequestJoinGroup}
            onApproveJoinRequest={handleApproveJoinRequest}
            onRejectJoinRequest={handleRejectJoinRequest}
            onInviteUser={handleInviteUser}
            onAcceptInvitation={handleAcceptInvitation}
            onRejectInvitation={handleRejectInvitation}
            onLeaveGroup={handleLeaveGroup}
            onCreateGroup={handleCreateGroup}
            onUpdateGroup={handleUpdateGroup}
            onDeleteGroup={handleDeleteGroup}
            onCreateRideFromGroup={handleCreateRideFromGroup}
            onQuickCreateRide={handleQuickCreateRideFromGrid}
            onQuickBookSeat={(rideId) => handleJoinRide(rideId, true)}
            onQuickCancelSeat={handleCancelReservation}
            onCancelRide={handleCancelRide}
            onNavigateToRideEdit={handleNavigateToRideEdit}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'login');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {activeTab === 'gamification' && (
          <GamificationView
            currentUser={currentUser}
            allUsers={users}
            ledger={ledger}
            rides={rides}
            onSelectUser={(u) => setCurrentUser(u)}
            onAddTransaction={handleTransferPix}
            onRequestSettlement={handleRequestSettlement}
            onConfirmSettlement={handleConfirmSettlement}
            onRejectSettlement={handleRejectSettlement}
            onDirectSettlementByDriver={handleDirectSettlementByDriver}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'login');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {activeTab === 'ai_routes' && (
          <GeminiVertexOptimizer
            currentUser={currentUser}
            allUsers={users}
            groups={groups}
            onTriggerPushNotification={(title, body, type) => addNotification(title, body, type)}
          />
        )}

        {activeTab === 'user_area' && (
          <UserAreaView
            currentUser={currentUser}
            allUsers={users}
            onUserUpdated={(updated) => {
              setCurrentUser(updated);
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
              triggerToast('Perfil & Preferências Atualizados', 'Dados cadastrais e preferências salvos com sucesso.');
            }}
            onUserDeleted={() => {
              setCurrentUser(null);
              triggerToast('Conta Excluída', 'Sua conta e dados associados foram excluídos do Firestore.');
            }}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'login');
              setIsAuthModalOpen(true);
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onUpdateRoutine={handleUpdateRoutine}
            initialSection="identity"
          />
        )}

        {activeTab === 'architecture' && isSuperUser(currentUser) && (
          <ArchitectureBlueprintView />
        )}
      </main>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => {
          setCurrentUser(updated);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        }}
        onUserDeleted={() => {
          setCurrentUser(null);
          triggerToast('Conta Excluída', 'Sua conta e dados associados foram excluídos do Firestore.');
        }}
      />

      {/* Login and Registration Screen (GEA Logic) */}
      <AuthScreen
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        allUsers={users}
        onAuthSuccess={(authenticatedUser) => {
          setCurrentUser(authenticatedUser);
          setUsers((prev) => {
            if (prev.some((u) => u.id === authenticatedUser.id)) {
              return prev.map((u) => (u.id === authenticatedUser.id ? authenticatedUser : u));
            }
            return [authenticatedUser, ...prev];
          });
          setIsAuthModalOpen(false);
          triggerToast(
            `Bem-vindo(a), ${authenticatedUser.name}!`,
            `Autenticação confirmada via Firebase & Firestore. Perfil: ${authenticatedUser.rolePreference === 'driver' ? 'Motorista' : 'Passageiro'}.`
          );
        }}
      />

      {/* Real-time Floating FCM Push Toast */}
      {activeToast && (
        <div 
          id="fcm-toast-notification"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 sm:max-w-md bg-white border border-indigo-200 rounded-2xl p-4 shadow-xl text-slate-900 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ring-4 ring-indigo-500/10"
        >
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1 flex-1 text-xs min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 truncate">{activeToast.title}</span>
              <span className="text-[10px] text-indigo-600 font-mono font-semibold shrink-0">FCM Push</span>
            </div>
            <p className="text-slate-600 leading-relaxed break-words">{activeToast.body}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Firestore Conectado
          </span>
          <span className="hidden sm:inline">•</span>
          <span>Google Cloud Run</span>
          <span className="hidden sm:inline">•</span>
          <span>Vertex AI Gemini 3.7</span>
        </div>
        <p>
          Caronas - Conectando pessoas • Plataforma de Caronas Corporativas & Acadêmicas
        </p>
      </footer>
    </div>
  );
}
