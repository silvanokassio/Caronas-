import React, { useState, useEffect, useRef } from 'react';
import { 
  INITIAL_COMMUNITIES,
  INITIAL_USERS, 
  INITIAL_GROUPS, 
  INITIAL_RIDES, 
  INITIAL_LEDGER, 
  INITIAL_NOTIFICATIONS 
} from './data/initialData';
import { User, Group, Community, Ride, LedgerTransaction, PushNotification, PendingRequest, Routine, GeoLocation, RideProposal, PassengerParticipant, Vehicle, getUserVehicles, isSuperUser, isUserMemberOfGroup, AppInterfaceMode, TripSegmentType, SegmentChangeRequest } from './types';
import { getSegmentLabel, calculateSegmentPrice } from './lib/segmentUtils';
import { canJoinRide, canLeaveRide, getRideDateTime } from './lib/dateUtils';
import { sendEmailConfirmation, sendMonitoredEmailConfirmation, EmailConfirmationRequest } from './lib/emailClient';
import { Header } from './components/Header';
import { RidesView } from './components/RidesView';
import { GroupsView } from './components/GroupsView';
import { GamificationView } from './components/GamificationView';
import { GeminiVertexOptimizer } from './components/GeminiVertexOptimizer';
import { ArchitectureBlueprintView } from './components/ArchitectureBlueprintView';
import { SuperUserManagementView } from './components/SuperUserManagementView';
import { UserProfileModal } from './components/UserProfileModal';
import { UserAreaView, SectionTab } from './components/UserAreaView';
import { AuthScreen } from './components/AuthScreen';
import { LightModeView } from './components/LightModeView';
import { RideDepartureReminder } from './components/RideDepartureReminder';
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
  addMemberToGroupDirectly,
  removeMemberFromGroup,
  toggleBlockMemberInGroup,
  saveFirestoreRoutine,
  addFirestoreTransaction,
  updateFirestoreUserProfile,
  logoutAppUser,
  saveUserSession,
  getSavedUserSession,
  clearUserSession,
  createFirestoreNotification,
  subscribeToNotifications,
  deleteFirestoreNotification,
  clearAllFirestoreNotifications,
  markFirestoreNotificationsAsRead,
  requestSettlementFromPassenger,
  confirmSettlementByDriver,
  rejectSettlementByDriver,
  directSettlementByDriver,
  auth
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Bell, CheckCircle, X, Car, Cloud, Database, AlertCircle, Crown, Sliders, Clock, AlertTriangle } from 'lucide-react';

function sanitizeUserCleanBalance(user: User): User {
  const hasLegacyMock = user.saldo_caronas === 24 || user.saldo_caronas === 25 || user.totalRidesOffered === 35;
  if (hasLegacyMock) {
    if (user.saldo_caronas !== 0 || user.totalRidesOffered !== 0) {
      updateFirestoreUserProfile(user.id, {
        saldo_caronas: 0,
        totalRidesOffered: 0,
        totalRidesTaken: 0,
      }).catch(() => {});
    }
    return {
      ...user,
      saldo_caronas: 0,
      totalRidesOffered: 0,
      totalRidesTaken: 0,
    };
  }
  return user;
}

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  // Restores session immediately if previously logged in (Gestão de Escalas pattern)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [communities, setCommunities] = useState<Community[]>(INITIAL_COMMUNITIES);
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [rides, setRides] = useState<Ride[]>(INITIAL_RIDES);
  const [ledger, setLedger] = useState<LedgerTransaction[]>(INITIAL_LEDGER);
  const [notifications, setNotifications] = useState<PushNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<'rides' | 'routines' | 'groups' | 'gamification' | 'ai_routes' | 'architecture' | 'user_area' | 'superuser_management'>('rides');
  // Interface Mode (Light by default for practical mobile usage, switchable via user menu to Advanced)
  const [interfaceMode, setInterfaceMode] = useState<AppInterfaceMode>(() => {
    const saved = localStorage.getItem('caronaflow_interface_mode');
    if (saved === 'advanced' || saved === 'light') {
      return saved;
    }
    return 'light';
  });
  const [selectedGroupForRide, setSelectedGroupForRide] = useState<Group | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [userAreaSection, setUserAreaSection] = useState<SectionTab>('identity');
  const [dismissedEmailBanner, setDismissedEmailBanner] = useState(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  // SuperUser Support Mode State (Allows impersonating/configuring any user on the platform)
  const SUPPORT_SESSION_STORAGE_KEY = 'caronaflow_active_support_session';
  const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
  const [supportTargetUserId, setSupportTargetUserId] = useState<string | null>(null);

  // References for live ride monitoring and new trip notifications
  const seenRideIdsRef = useRef<Set<string>>(new Set());
  const isInitialRidesLoadRef = useRef<boolean>(true);
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const handleStartSupportSession = (targetUser: User) => {
    const admin = originalAdminUser || (currentUser && isSuperUser(currentUser) ? currentUser : null) || users.find((u) => (u.email || '').toLowerCase() === 'silvano.kassio@gmail.com');
    if (admin) {
      setOriginalAdminUser(admin);
      try {
        const supportPayload = {
          adminId: admin.id,
          adminEmail: admin.email,
          targetUserId: targetUser.id,
          timestamp: Date.now(),
        };
        localStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(supportPayload));
        sessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(supportPayload));
        // Keep the primary user session in localStorage as the ADMIN
        saveUserSession(admin);
      } catch (e) {}
    }
    setCurrentUser(targetUser);
    setSupportTargetUserId(targetUser.id);
    triggerToast(
      'Sessão de Suporte Ativada',
      `Você está navegando e configurando o perfil de ${targetUser.name} como Superusuário.`
    );
  };

  const handleExitSupportSession = () => {
    let admin = originalAdminUser;
    if (!admin) {
      admin = users.find((u) => (u.email || '').toLowerCase() === 'silvano.kassio@gmail.com') || null;
    }
    if (admin) {
      setCurrentUser(admin);
      saveUserSession(admin);
    }
    setOriginalAdminUser(null);
    setSupportTargetUserId(null);
    try {
      localStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
    } catch (e) {}
    triggerToast('Sessão de Suporte Finalizada', 'Retornado com sucesso à conta de Superusuário.');
  };

  const handleRestoreSuperAdmin = () => {
    let admin = originalAdminUser || users.find((u) => (u.email || '').toLowerCase() === 'silvano.kassio@gmail.com') || null;
    if (admin) {
      setCurrentUser(admin);
      saveUserSession(admin);
      setOriginalAdminUser(null);
      setSupportTargetUserId(null);
      try {
        localStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
        sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
      } catch (e) {}
      triggerToast('Conta Restaurada', `Sessão de ${admin.name} (SuperAdmin) reativada.`);
    }
  };

  // Active Toast for system alerts, floating reminders and Web Push notifications
  const [activeToast, setActiveToast] = useState<{ 
    title: string; 
    body: string; 
    isPush?: boolean; 
    tag?: string; 
    iconType?: 'bell' | 'clock' | 'car' | 'check' 
  } | null>(null);

  const sendWebNotification = (title: string, body: string, icon: string = '/icon.png') => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon,
            badge: '/icon.png'
          });
        } catch (_) {}
      } else if (Notification.permission === 'default') {
        try {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              new Notification(title, {
                body,
                icon,
                badge: '/icon.png'
              });
            }
          }).catch(() => {});
        } catch (_) {}
      }
    }
  };

  const triggerToast = (
    title: string, 
    body: string, 
    isPush: boolean = false, 
    options?: { tag?: string; iconType?: 'bell' | 'clock' | 'car' | 'check'; fireWebNotification?: boolean }
  ) => {
    setActiveToast({ 
      title, 
      body, 
      isPush, 
      tag: options?.tag, 
      iconType: options?.iconType || (isPush ? 'bell' : undefined) 
    });

    if (options?.fireWebNotification) {
      sendWebNotification(title, body);
    }

    setTimeout(() => {
      setActiveToast((prev) => (prev?.title === title ? null : prev));
    }, 5500);
  };

  // Firebase Real-time Subscriptions & Initialization
  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;
    let unsubRides: (() => void) | undefined;
    let unsubTxs: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;

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
            setUsers(uniqueUsers);

            // Sync or restore persistent user session (maintained until user asks to log off)
            const savedSession = getSavedUserSession();
            let storedSupportJson: string | null = null;
            try {
              storedSupportJson = localStorage.getItem(SUPPORT_SESSION_STORAGE_KEY) || sessionStorage.getItem(SUPPORT_SESSION_STORAGE_KEY);
            } catch (e) {}

            let supportPayload: { adminId?: string; adminEmail?: string; targetUserId?: string } | null = null;
            if (storedSupportJson) {
              try {
                supportPayload = JSON.parse(storedSupportJson);
              } catch (e) {}
            }

            const silvanoUser = uniqueUsers.find((u) => (u.email || '').toLowerCase() === 'silvano.kassio@gmail.com') || null;
            const thaisseUser = uniqueUsers.find((u) => (u.email || '').toLowerCase() === 'thaissegarbelini@gmail.com') || null;

            let activeAdminUser: User | null = null;
            let activeTargetUser: User | null = null;

            if (supportPayload) {
              activeAdminUser = uniqueUsers.find((u) => u.id === supportPayload?.adminId || (u.email && u.email.toLowerCase() === supportPayload?.adminEmail?.toLowerCase())) || silvanoUser;
              activeTargetUser = uniqueUsers.find((u) => u.id === supportPayload?.targetUserId) || null;
            } else if (savedSession?.email?.toLowerCase() === 'thaissegarbelini@gmail.com' && silvanoUser) {
              // Auto-recovery: If user refreshed while impersonating Thaisse, restore Silvano as admin and keep Thaisse as support target
              activeAdminUser = silvanoUser;
              activeTargetUser = thaisseUser;
              try {
                const autoSupport = { adminId: silvanoUser.id, adminEmail: silvanoUser.email, targetUserId: thaisseUser?.id };
                localStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(autoSupport));
                sessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(autoSupport));
              } catch (e) {}
            }

            if (activeAdminUser) {
              setOriginalAdminUser(activeAdminUser);
            }
            if (activeTargetUser) {
              setSupportTargetUserId(activeTargetUser.id);
            }

            setCurrentUser((prev) => {
              if (prev) {
                // If in support mode, do NOT overwrite the admin user session in localStorage
                if (activeAdminUser) {
                  const targetId = activeTargetUser?.id || prev.id;
                  const updated = uniqueUsers.find((u) => u.id === targetId || (u.email && u.email.toLowerCase() === prev.email?.toLowerCase()));
                  return updated ? sanitizeUserCleanBalance(updated) : sanitizeUserCleanBalance(prev);
                }
                const updated = uniqueUsers.find((u) => u.id === prev.id || (u.email && u.email.toLowerCase() === prev.email.toLowerCase()));
                if (updated) {
                  const cleaned = sanitizeUserCleanBalance(updated);
                  saveUserSession(cleaned);
                  return cleaned;
                }
                return sanitizeUserCleanBalance(prev);
              } else if (activeTargetUser && activeAdminUser) {
                return sanitizeUserCleanBalance(activeTargetUser);
              } else if (savedSession) {
                const matched = uniqueUsers.find(
                  (u) => (savedSession.id && u.id === savedSession.id) ||
                         (savedSession.email && u.email && u.email.toLowerCase() === savedSession.email.toLowerCase())
                );
                if (matched) {
                  const cleaned = sanitizeUserCleanBalance(matched);
                  saveUserSession(cleaned);
                  return cleaned;
                }
              }
              return null;
            });
          } else {
            setUsers([]);
          }
        });

        // Listen to Firebase Auth state
        unsubAuth = onAuthStateChanged(auth, (fbUser) => {
          if (fbUser && fbUser.email) {
            const normalized = fbUser.email.trim().toLowerCase();
            setCurrentUser((prev) => {
              if (prev && prev.email?.trim().toLowerCase() === normalized) {
                const cleaned = sanitizeUserCleanBalance(prev);
                saveUserSession(cleaned);
                return cleaned;
              }
              const found = users.find((u) => u.email?.trim().toLowerCase() === normalized);
              if (found) {
                const cleaned = sanitizeUserCleanBalance(found);
                saveUserSession(cleaned);
                return cleaned;
              }
              return prev ? sanitizeUserCleanBalance(prev) : null;
            });
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

            // Se for a primeira carga de rides, apenas memoriza os IDs para não soar alarme de caronas antigas
            if (isInitialRidesLoadRef.current) {
              uniqueRides.forEach((r) => seenRideIdsRef.current.add(r.id));
              isInitialRidesLoadRef.current = false;
              return;
            }

            // Detecta caronas postadas em tempo real nos grupos do usuário
            const activeUser = currentUserRef.current;
            const userGroupSet = new Set<string>(activeUser?.groups || []);

            uniqueRides.forEach((r) => {
              if (seenRideIdsRef.current.has(r.id)) return;
              seenRideIdsRef.current.add(r.id);

              // Apenas se não foi postada pelo próprio usuário logado
              if (activeUser && r.driverId === activeUser.id) return;

              // Verifica pertinência de grupo (se pertence a um grupo do usuário ou se o usuário é do grupo alvo)
              const matchesGroup = 
                (r.targetGroupId && userGroupSet.has(r.targetGroupId)) ||
                (Array.isArray(r.authorGroupIds) && r.authorGroupIds.some((gid) => userGroupSet.has(gid)));

              if (matchesGroup) {
                const groupName = r.targetGroupName || 'Seu Grupo';
                const originName = r.origin?.name || r.origin?.address?.split(',')[0] || 'Origem';
                const destName = r.destinationAlias || r.destination?.alias || r.destination?.name || r.destination?.address?.split(',')[0] || 'Destino';
                const isOffer = (r.rideType || 'offer') === 'offer';

                const notifTitle = isOffer
                  ? `🚗 Nova Carona no Grupo "${groupName}"!`
                  : `🙋‍♂️ Novo Pedido de Carona no Grupo "${groupName}"!`;

                const notifBody = isOffer
                  ? `${r.driverName} postou viagem de ${originName} para ${destName} (${r.departureDate} às ${r.departureTime}) com ${r.totalSeats} vaga${r.totalSeats > 1 ? 's' : ''} (R$ ${(r.price || 0).toFixed(2)}).`
                  : `${r.driverName} solicitou carona de ${originName} para ${destName} (${r.departureDate} às ${r.departureTime}).`;

                // Dispara mensagem flutuante na tela (toast) e Web Notification API
                triggerToast(notifTitle, notifBody, true, {
                  tag: `new-ride-${r.id}`,
                  iconType: 'car',
                  fireWebNotification: true
                });
              }
            });
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
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Real-time Push Notifications subscription from Firestore for current user
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const isInitialNotifLoadRef = useRef<boolean>(true);

  useEffect(() => {
    if (!currentUser?.id) {
      setNotifications([]);
      seenNotificationIdsRef.current.clear();
      isInitialNotifLoadRef.current = true;
      return;
    }
    const unsub = subscribeToNotifications(currentUser.id, (firestoreNotifs) => {
      const notifs = firestoreNotifs || [];
      setNotifications(notifs);

      // Na primeira carga, registrar IDs existentes para evitar disparo em massa de alertas passados
      if (isInitialNotifLoadRef.current) {
        notifs.forEach((n) => seenNotificationIdsRef.current.add(n.id));
        isInitialNotifLoadRef.current = false;
        return;
      }

      // Notificações recém-chegadas ainda não lidas
      const newlyArrived = notifs.filter((n) => !n.read && !seenNotificationIdsRef.current.has(n.id));
      newlyArrived.forEach((n) => {
        seenNotificationIdsRef.current.add(n.id);
        
        // Disparar toast em destaque na tela do usuário
        triggerToast(n.title, n.body, true);

        // Disparar Web Push Notification via HTML5 Notification API se autorizado pelo navegador
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(n.title, {
              body: n.body,
              icon: '/icon.png',
            });
          } catch (_) {}
        }
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, [currentUser?.id]);

  // Notification helper
  const addNotification = (title: string, body: string, type: any, rideId?: string) => {
    const newNtf: PushNotification = {
      id: `ntf-${Date.now()}`,
      userId: currentUser?.id,
      title,
      body,
      type,
      rideId,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNtf, ...prev]);
    triggerToast(title, body, true);
  };

  // Centralized Monitored Email Dispatcher:
  // Dispatches email and, upon delivery failure or security block (unverified email),
  // automatically alerts the recipient user via Firestore in-app PushNotification & real-time toast
  const dispatchMonitoredEmail = async (
    payload: EmailConfirmationRequest,
    targetUser?: User | null
  ) => {
    const resolvedUser = targetUser || users.find(
      (u) => (payload.recipientUserId && u.id === payload.recipientUserId) || 
             (u.email && payload.recipientEmail && u.email.toLowerCase() === payload.recipientEmail.toLowerCase())
    );

    return sendMonitoredEmailConfirmation({
      payload,
      recipientUser: resolvedUser,
      onDeliveryFailure: async ({ recipientEmail, recipientUserId, actionDescription, reason, rideId }) => {
        const destUserId = recipientUserId || resolvedUser?.id;

        // 1. Record an in-app PushNotification for the recipient in Firestore
        if (destUserId) {
          try {
            await createFirestoreNotification({
              userId: destUserId,
              title: `⚠️ Falha no envio de e-mail de notificação`,
              body: `Não foi possível entregar o aviso de "${actionDescription}" no seu e-mail (${recipientEmail}). ${reason} Acesse seu perfil para regularizar e não perder avisos da viagem.`,
              type: 'EMAIL_DELIVERY_FAILED',
              rideId,
              failedEmail: recipientEmail,
              failureReason: reason,
              timestamp: new Date().toISOString(),
              read: false,
            });
          } catch (notifErr) {
            console.warn('[Email Monitor] Erro ao gravar notificação de falha de e-mail no Firestore:', notifErr);
          }
        }

        // 2. Real-time alert if the recipient is the active logged-in user
        if (
          currentUser && 
          ((destUserId && currentUser.id === destUserId) || 
           (currentUser.email && currentUser.email.toLowerCase() === recipientEmail.toLowerCase()))
        ) {
          triggerToast(
            '⚠️ Alerta de Notificação por E-mail',
            `Não conseguimos entregar a notificação de "${actionDescription}" no seu e-mail (${recipientEmail}). Acesse Meu Perfil > E-mails.`
          );
        }
      },
    });
  };

  // Helper: Notifica os membros dos grupos quando uma viagem for criada (O criador NÃO é notificado)
  const notifyGroupMembersForNewTrip = async (
    createdRide: Ride | Omit<Ride, 'id'>,
    rideId: string
  ): Promise<number> => {
    if (!currentUser) return 0;

    // 1. Identificar grupos aos quais a viagem pertence ou aos quais o usuário pertence
    const targetGroupIds = new Set<string>();
    if (createdRide.targetGroupId) {
      targetGroupIds.add(createdRide.targetGroupId);
    }
    if (createdRide.authorGroupIds && Array.isArray(createdRide.authorGroupIds)) {
      createdRide.authorGroupIds.forEach((gid) => {
        if (gid) targetGroupIds.add(gid);
      });
    }
    if (currentUser.groups && Array.isArray(currentUser.groups)) {
      currentUser.groups.forEach((gid) => {
        if (gid) targetGroupIds.add(gid);
      });
    }

    if (targetGroupIds.size === 0) {
      return 0;
    }

    // 2. Coletar membros de todos os grupos identificados, ESTRITAMENTE EXCLUINDO o criador
    const recipientUserIds = new Set<string>();
    const associatedGroupNames: string[] = [];

    targetGroupIds.forEach((gid) => {
      const grp = groups.find((g) => g.id === gid);
      if (grp) {
        if (grp.name && !associatedGroupNames.includes(grp.name)) {
          associatedGroupNames.push(grp.name);
        }
        if (Array.isArray(grp.memberIds)) {
          grp.memberIds.forEach((mId) => {
            // "O usuário que criou não precisa ser avisado"
            if (mId && mId !== currentUser.id) {
              recipientUserIds.add(mId);
            }
          });
        }
      }
    });

    if (recipientUserIds.size === 0) {
      return 0;
    }

    const primaryGroupName = createdRide.targetGroupName || associatedGroupNames[0] || 'Grupo';
    const isOffer = (createdRide.rideType || 'offer') === 'offer';

    const originName = createdRide.origin?.name || createdRide.origin?.address?.split(',')[0] || 'Origem';
    const destName = createdRide.destinationAlias || createdRide.destination?.alias || createdRide.destination?.name || createdRide.destination?.address?.split(',')[0] || 'Destino';

    const notifTitle = isOffer
      ? `🚗 Nova Viagem no Grupo ${primaryGroupName ? `"${primaryGroupName}"` : ''}`
      : `🙋‍♂️ Novo Pedido de Carona no Grupo ${primaryGroupName ? `"${primaryGroupName}"` : ''}`;

    const notifBody = isOffer
      ? `${currentUser.name} abriu uma nova viagem de ${originName} para ${destName} (${createdRide.departureDate} às ${createdRide.departureTime}) com ${createdRide.totalSeats} vaga${createdRide.totalSeats > 1 ? 's' : ''} (R$ ${(createdRide.price || 0).toFixed(2)}). Toque para ver!`
      : `${currentUser.name} solicitou uma carona de ${originName} para ${destName} (${createdRide.departureDate} às ${createdRide.departureTime}). Confira a rota!`;

    // 3. Persistir notificações para cada membro no Firestore
    const promises = Array.from(recipientUserIds).map(async (memberId) => {
      try {
        await createFirestoreNotification({
          userId: memberId,
          title: notifTitle,
          body: notifBody,
          type: 'NEW_RIDE_GROUP',
          rideId,
          counterpartId: currentUser.id,
          timestamp: new Date().toISOString(),
          read: false,
        });
      } catch (err) {
        console.warn(`[Notification] Falha ao registrar notificação para membro ${memberId}:`, err);
      }

      // 4. Enviar e-mail caso o membro possua e-mail cadastrado
      const memberUser = users.find((u) => u.id === memberId);
      if (memberUser?.email && memberUser.email.includes('@')) {
        if (memberUser.preferences?.notifyNewRidesInGroups !== false) {
          dispatchMonitoredEmail({
            type: 'NEW_RIDE_GROUP',
            recipientEmail: memberUser.email,
            recipientName: memberUser.name,
            recipientUserId: memberUser.id,
            recipientEmailVerified: memberUser.emailVerified,
            rideId,
            rideData: {
              originAddress: createdRide.origin?.address,
              destinationAddress: createdRide.destination?.address,
              departureDate: createdRide.departureDate,
              departureTime: createdRide.departureTime,
              price: createdRide.price,
              totalSeats: createdRide.totalSeats,
              vehicleModel: createdRide.driverVehicle?.model,
              vehiclePlate: createdRide.driverVehicle?.plate,
              driverName: currentUser.name,
              groupName: primaryGroupName,
              notes: createdRide.notes,
            },
          }, memberUser).catch((err) => console.warn('[Email] Falha ao enviar aviso para membro do grupo:', err));
        }
      }
    });

    await Promise.allSettled(promises);
    return recipientUserIds.size;
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
      ...(ridePayload.destinationAlias ? { destinationAlias: ridePayload.destinationAlias } : {}),
      ...(ridePayload.driverVehicle 
        ? { driverVehicle: ridePayload.driverVehicle } 
        : (currentUser.vehicle 
            ? { driverVehicle: currentUser.vehicle } 
            : (isOffer ? { driverVehicle: { model: 'Veículo Cadastrado', plate: 'BRA-2026', color: 'Prata' } } : {}))),
      ...(ridePayload.targetGroupId ? { targetGroupId: ridePayload.targetGroupId } : {}),
      ...(ridePayload.targetGroupName ? { targetGroupName: ridePayload.targetGroupName } : {}),
      ...(ridePayload.requesterNote ? { requesterNote: ridePayload.requesterNote } : {}),
      segmentType: ridePayload.segmentType || 'ida_e_volta',
      ...(ridePayload.returnTime ? { returnTime: ridePayload.returnTime } : {}),
    };

    try {
      const rideId = await createFirestoreRide(newRide);
      // Safe optimistic local state update
      setRides((prev) => {
        if (prev.some((r) => r.id === rideId)) return prev;
        return [{ id: rideId, ...newRide }, ...prev];
      });

      // Avisar aos membros dos grupos quando uma viagem for criada. O usuário que criou não precisa ser avisado.
      const notifiedCount = await notifyGroupMembersForNewTrip(newRide, rideId);

      // Feedback imediato na interface apenas para o usuário criador (sem criar PushNotification para si mesmo)
      triggerToast(
        newRide.rideType === 'request' ? '🙋‍♂️ Pedido Publicado!' : '🚗 Viagem Publicada!',
        notifiedCount > 0
          ? `Sua ${newRide.rideType === 'request' ? 'solicitação' : 'oferta'} foi publicada e ${notifiedCount} membro(s) dos seus grupos foram avisados.`
          : `Sua ${newRide.rideType === 'request' ? 'solicitação' : 'oferta'} para ${newRide.destination.address.split(',')[0]} foi publicada com sucesso.`
      );
    } catch (err) {
      console.error('Error creating ride in Firestore:', err);
    }
  };

  // Update Ride (Writes to Firestore - creator or superuser can modify)
  const handleUpdateRide = async (rideId: string, updates: Partial<Ride>) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    if (!currentUser || (targetRide.driverId !== currentUser.id && !currentUser.isSuperUser)) {
      triggerToast('Acesso Restrito', 'Apenas o criador da viagem pode modificar as informações.');
      return;
    }

    try {
      await updateFirestoreRide(rideId, updates);
      setRides((prev) =>
        prev.map((r) => (r.id === rideId ? { ...r, ...updates } : r))
      );

      const destTitle = updates.destinationAlias || updates.destination?.alias || updates.destination?.name || updates.destination?.address || targetRide.destinationAlias || targetRide.destination.address;
      triggerToast('Viagem Atualizada', `Informações da viagem para "${destTitle}" foram salvas com sucesso.`);
    } catch (err) {
      console.error('Error updating ride in Firestore:', err);
      triggerToast('Erro', 'Não foi possível salvar as alterações da viagem.');
    }
  };

  // Toggle Interface Mode (Light vs Advanced) with persistent saving
  const handleToggleInterfaceMode = async (mode: AppInterfaceMode) => {
    setInterfaceMode(mode);
    localStorage.setItem('caronaflow_interface_mode', mode);
    if (currentUser) {
      const updated = { ...currentUser, interfaceMode: mode };
      setCurrentUser(updated);
      try {
        await updateFirestoreUserProfile(currentUser.id, { interfaceMode: mode });
      } catch (err) {
        console.warn('Could not persist interfaceMode to Firestore profile:', err);
      }
    }
    // When switching to Light Mode: ensure the view switches immediately to light!
    // If the user was on user_area, routines, superuser_management, or architecture,
    // bring them to 'rides' so the Light Mode interface is directly presented.
    if (mode === 'light') {
      if (activeTab === 'user_area' || activeTab === 'superuser_management' || activeTab === 'architecture' || activeTab === 'routines') {
        setActiveTab('rides');
      }
    }
    triggerToast(
      mode === 'light' ? '📱 Modo Light Ativado' : '⚡ Modo Avançado Ativado',
      mode === 'light'
        ? 'Interface leve e prática para buscar e aderir a caronas no celular.'
        : 'Interface completa com IA Vertex, rotas, grupos e extratos.'
    );
  };

  // Quick Ride Creation for Light Mode
  const handleCreateQuickRide = async (rideData: Partial<Ride>) => {
    if (!currentUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    const userVehicles = getUserVehicles(currentUser);
    const driverVehicle = userVehicles[0] || currentUser.vehicle;
    const newRideId = `ride-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const orig = rideData.origin || currentUser.residentialAddress || currentUser.ponto_encontro_default || {
      address: 'Ponto de Partida',
      lat: -23.5714,
      lng: -46.7086,
    };
    const dest = rideData.destination || {
      address: 'Destino',
      lat: -23.5874,
      lng: -46.6821,
    };

    const newRide: Ride = {
      id: newRideId,
      rideType: 'offer',
      driverId: currentUser.id,
      driverName: currentUser.name,
      driverAvatar: currentUser.avatar,
      driverVehicle,
      origin: orig,
      destination: dest,
      departureDate: rideData.departureDate || new Date().toISOString().split('T')[0],
      departureTime: rideData.departureTime || '08:00',
      price: rideData.price || 7.0,
      totalSeats: rideData.totalSeats || 4,
      occupiedSeats: 0,
      acceptedPassengers: [],
      pendingRequests: [],
      status: 'agendada',
      visibility: 'public',
      distanceKm: rideData.distanceKm || 12.0,
      estimatedDurationMin: rideData.estimatedDurationMin || 25,
      fuelCostEstimated: 8.5,
      estimatedCarbonSavingKg: 2.1,
      createdAt: new Date().toISOString(),
      description: `Carona rápida oferecida por ${currentUser.name}`,
      notes: rideData.notes || 'Carona criada via Modo Light rápido',
      waypointsOrder: [
        { lat: orig.lat, lng: orig.lng, label: `Embarque: ${orig.address.split(',')[0]}`, type: 'origin', orderIndex: 0 },
        { lat: dest.lat, lng: dest.lng, label: `Destino: ${dest.address.split(',')[0]}`, type: 'destination', orderIndex: 1 },
      ],
    };

    try {
      const rideId = await createFirestoreRide(newRide);
      setRides((prev) => [newRide, ...prev]);

      // Avisar aos membros dos grupos quando uma viagem for criada. O usuário que criou não precisa ser avisado.
      const notifiedCount = await notifyGroupMembersForNewTrip(newRide, rideId || newRide.id);

      triggerToast(
        '🚗 Carona Criada com Sucesso!',
        notifiedCount > 0
          ? `Sua carona rápida para ${newRide.destination.address.split(',')[0]} foi publicada e ${notifiedCount} membro(s) dos seus grupos foram avisados.`
          : `Sua carona rápida para ${newRide.destination.address.split(',')[0]} foi publicada na nuvem.`
      );
    } catch (err) {
      console.error('Error creating quick ride:', err);
      alert('Erro ao publicar carona rápida. Tente novamente.');
    }
  };

  // Join Ride (Auto-acceptance vs Pending Request with Trip Segment)
  const handleJoinRide = async (rideId: string, isAutoAccepted: boolean, segmentType?: TripSegmentType) => {
    if (!currentUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    // Regra Estrita: Não deve ser permitido aderir a viagens no passado, concluídas ou canceladas
    if (!canJoinRide(targetRide)) {
      alert('Esta carona pertence ao passado ou já foi concluída/cancelada. Não é permitido aderir a viagens passadas.');
      return;
    }

    // Verificar limite de vagas
    if (targetRide.occupiedSeats >= targetRide.totalSeats) {
      alert('Vagas Esgotadas: Todas as vagas desta carona já foram preenchidas.');
      return;
    }

    // Regra de Governança: Caronas vinculadas a grupo exigem que o usuário seja membro aprovado do grupo
    let isMemberBlockedInGroup = false;
    if (targetRide.targetGroupId) {
      const targetGroup = groups.find((g) => g.id === targetRide.targetGroupId);
      const isMember = targetGroup ? isUserMemberOfGroup(targetGroup, currentUser, users) : false;
      if (!isMember) {
        alert(
          `Acesso Restrito ao Grupo: Esta carona pertence ao grupo exclusivo "${targetRide.targetGroupName || targetGroup?.name}".\n\nApenas membros aprovados podem confirmar a reserva de vaga. Solicite sua adesão ao grupo na aba "Grupos & Comunidades".`
        );
        return;
      }

      // Requisito: Bloquear o membro -> continua no grupo mas não tem adesão automática nas viagens postadas pelo grupo
      const isBlocked = targetGroup && (
        (targetGroup.blockedMemberIds || []).includes(currentUser.id) ||
        (currentUser.email && (targetGroup.blockedMemberIds || []).some((b) => b.toLowerCase() === currentUser.email?.toLowerCase()))
      );
      if (isBlocked) {
        isMemberBlockedInGroup = true;
        isAutoAccepted = false;
      }
    }

    const chosenSegment: TripSegmentType = segmentType || targetRide.segmentType || 'ida_e_volta';
    const effectivePrice = calculateSegmentPrice(targetRide.price || 0, chosenSegment, targetRide.segmentType);

    if (isAutoAccepted) {
      // Requisito 1.B: Se pertence ao grupo -> Aceite Imediato Automático!
      const newPassenger: PassengerParticipant = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        institutionName: currentUser.institutionName,
        meetingPoint: currentUser.ponto_encontro_default,
        joinedAt: new Date().toISOString(),
        autoAccepted: true,
        segmentType: chosenSegment,
        agreedPrice: effectivePrice,
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
          `Por pertencer ao grupo, sua vaga (${getSegmentLabel(chosenSegment)} - R$ ${effectivePrice.toFixed(2)}) foi confirmada imediatamente no Firestore.`,
          'RIDE_ACCEPTED',
          rideId
        );

        // Disparar e-mail de confirmação para o passageiro
        if (currentUser.email) {
          dispatchMonitoredEmail({
            type: 'REQUEST_ACCEPTED',
            recipientEmail: currentUser.email,
            recipientName: currentUser.name,
            recipientUserId: currentUser.id,
            recipientEmailVerified: currentUser.emailVerified,
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
          }, currentUser).catch((e) => console.warn('Email dispatch warning:', e));
        }

        // Disparar aviso ao motorista
        const driverUser = users.find((u) => u.id === targetRide.driverId);
        if (driverUser?.email) {
          dispatchMonitoredEmail({
            type: 'NEW_PASSENGER_REQUEST',
            recipientEmail: driverUser.email,
            recipientName: driverUser.name,
            recipientUserId: driverUser.id,
            recipientEmailVerified: driverUser.emailVerified,
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
          }, driverUser).catch((e) => console.warn('Email dispatch warning:', e));
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
        requestedSegmentType: chosenSegment,
      };

      const updatedPending = [...targetRide.pendingRequests, newRequest];

      try {
        await updateFirestoreRide(rideId, {
          pendingRequests: updatedPending,
        });

        setRides((prev) =>
          prev.map((r) => (r.id === rideId ? { ...r, pendingRequests: updatedPending } : r))
        );

        if (isMemberBlockedInGroup) {
          addNotification(
            '⏳ Solicitação Enviada para o Motorista',
            `Sua adesão automática está pausada pelo gestor do grupo "${targetRide.targetGroupName || 'Grupo'}". Sua solicitação (${getSegmentLabel(chosenSegment)}) foi enviada para aprovação do motorista.`,
            'NEW_REQUEST',
            rideId
          );
          triggerToast(
            'Solicitação Enviada (Aprovação Necessária)',
            `Sua adesão automática está pausada neste grupo. O motorista ${targetRide.driverName} avaliará seu pedido para o trecho ${getSegmentLabel(chosenSegment)}.`
          );
        } else {
          addNotification(
            '⏳ Solicitação Enviada para o Motorista',
            `Sua solicitação para o trecho ${getSegmentLabel(chosenSegment)} (R$ ${effectivePrice.toFixed(2)}) com ponto de encontro "${currentUser.ponto_encontro_default.name || currentUser.ponto_encontro_default.address}" foi enviada para avaliação.`,
            'NEW_REQUEST',
            rideId
          );
        }

        // Disparar e-mail de solicitação enviada para o passageiro
        if (currentUser.email) {
          dispatchMonitoredEmail({
            type: 'RIDE_REQUEST_SENT',
            recipientEmail: currentUser.email,
            recipientName: currentUser.name,
            recipientUserId: currentUser.id,
            recipientEmailVerified: currentUser.emailVerified,
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
          }, currentUser).catch((e) => console.warn('Email dispatch warning:', e));
        }

        // Disparar e-mail de novo passageiro para o motorista
        const driverUser = users.find((u) => u.id === targetRide.driverId);
        if (driverUser?.email) {
          dispatchMonitoredEmail({
            type: 'NEW_PASSENGER_REQUEST',
            recipientEmail: driverUser.email,
            recipientName: driverUser.name,
            recipientUserId: driverUser.id,
            recipientEmailVerified: driverUser.emailVerified,
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
          }, driverUser).catch((e) => console.warn('Email dispatch warning:', e));
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

    if (!canJoinRide(targetRide)) {
      alert('Não é possível aprovar solicitações para uma carona que já ocorreu ou está concluída.');
      return;
    }

    const chosenSegment: TripSegmentType = request.requestedSegmentType || targetRide.segmentType || 'ida_e_volta';
    const effectivePrice = calculateSegmentPrice(targetRide.price || 0, chosenSegment, targetRide.segmentType);

    const newPassenger: PassengerParticipant = {
      userId: request.userId,
      userName: request.userName,
      userAvatar: request.userAvatar,
      institutionName: request.institutionName,
      meetingPoint: request.meetingPoint,
      joinedAt: new Date().toISOString(),
      autoAccepted: false,
      segmentType: chosenSegment,
      agreedPrice: effectivePrice,
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
        `Você confirmou o embarque de ${request.userName} no trecho ${getSegmentLabel(chosenSegment)} (R$ ${effectivePrice.toFixed(2)}) no ponto "${request.meetingPoint.address}".`,
        'RIDE_ACCEPTED',
        rideId
      );

      // Disparar e-mail de confirmação de vaga aprovada para o passageiro
      const passengerUser = users.find((u) => u.id === request.userId);
      const passengerEmail = passengerUser?.email;
      if (passengerEmail) {
        dispatchMonitoredEmail({
          type: 'REQUEST_ACCEPTED',
          recipientEmail: passengerEmail,
          recipientName: request.userName,
          recipientUserId: passengerUser?.id || request.userId,
          recipientEmailVerified: passengerUser?.emailVerified,
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
        }, passengerUser).catch((e) => console.warn('Email dispatch warning:', e));
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
        dispatchMonitoredEmail({
          type: 'REQUEST_REJECTED',
          recipientEmail: passengerUser.email,
          recipientName: passengerUser.name,
          recipientUserId: passengerUser.id,
          recipientEmailVerified: passengerUser.emailVerified,
          rideId,
          rideData: {
            driverName: targetRide.driverName,
          },
        }, passengerUser).catch((e) => console.warn('Email dispatch warning:', e));
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  // Passenger requests segment change (e.g. from ida_e_volta to somente_ida)
  const handleRequestSegmentChange = async (rideId: string, requestedSegment: TripSegmentType) => {
    if (!currentUser) return;
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;
    const passenger = targetRide.acceptedPassengers.find((p) => p.userId === currentUser.id);
    if (!passenger) return;

    const currentSegment = passenger.segmentType || targetRide.segmentType || 'ida_e_volta';
    if (currentSegment === requestedSegment) {
      alert('Você já está confirmado neste trecho.');
      return;
    }

    const changeRequest: SegmentChangeRequest = {
      id: `seg_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      requestedSegmentType: requestedSegment,
      currentSegmentType: currentSegment,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    const updatedRequests = [...(targetRide.segmentChangeRequests || []), changeRequest];
    const updatedPassengers = targetRide.acceptedPassengers.map((p) =>
      p.userId === currentUser.id ? { ...p, segmentChangePending: requestedSegment } : p
    );

    try {
      await updateFirestoreRide(rideId, {
        segmentChangeRequests: updatedRequests,
        acceptedPassengers: updatedPassengers,
      });

      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? { ...r, segmentChangeRequests: updatedRequests, acceptedPassengers: updatedPassengers }
            : r
        )
      );

      addNotification(
        '🔄 Alteração de Trecho Solicitada',
        `Seu pedido para mudar para "${getSegmentLabel(requestedSegment)}" foi enviado ao motorista ${targetRide.driverName}.`,
        'SYSTEM',
        rideId
      );
      triggerToast('Solicitação Enviada', `Pedido para alterar trecho para ${getSegmentLabel(requestedSegment)} enviado ao motorista.`);
    } catch (err) {
      console.error('Error requesting segment change:', err);
    }
  };

  // Driver approves or rejects segment change
  const handleRespondSegmentChange = async (rideId: string, requestId: string, approve: boolean) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;
    const req = (targetRide.segmentChangeRequests || []).find((s) => s.id === requestId);
    if (!req) return;

    const updatedRequests = (targetRide.segmentChangeRequests || []).filter((s) => s.id !== requestId);
    let updatedPassengers = targetRide.acceptedPassengers;

    if (approve) {
      const newPrice = calculateSegmentPrice(targetRide.price || 0, req.requestedSegmentType, targetRide.segmentType);
      updatedPassengers = targetRide.acceptedPassengers.map((p) =>
        p.userId === req.userId
          ? {
              ...p,
              segmentType: req.requestedSegmentType,
              segmentChangePending: undefined,
              agreedPrice: newPrice,
            }
          : p
      );
    } else {
      updatedPassengers = targetRide.acceptedPassengers.map((p) =>
        p.userId === req.userId ? { ...p, segmentChangePending: undefined } : p
      );
    }

    try {
      await updateFirestoreRide(rideId, {
        segmentChangeRequests: updatedRequests,
        acceptedPassengers: updatedPassengers,
      });

      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? { ...r, segmentChangeRequests: updatedRequests, acceptedPassengers: updatedPassengers }
            : r
        )
      );

      addNotification(
        approve ? '✅ Alteração de Trecho Aprovada' : '❌ Alteração de Trecho Recusada',
        approve
          ? `Você aprovou o trecho "${getSegmentLabel(req.requestedSegmentType)}" para ${req.userName}.`
          : `Você recusou a alteração de trecho de ${req.userName}.`,
        'SYSTEM',
        rideId
      );
      triggerToast(
        approve ? 'Alteração Aprovada' : 'Alteração Recusada',
        `A solicitação de ${req.userName} foi ${approve ? 'aprovada' : 'recusada'}.`
      );
    } catch (err) {
      console.error('Error responding to segment change:', err);
    }
  };

  // Passageiro edita diretamente sua participação na viagem (opção de trecho: ida e volta / só ida / só volta, ponto de encontro e observações)
  const handleUpdatePassengerParticipation = async (
    rideId: string,
    updates: {
      segmentType: TripSegmentType;
      meetingPoint: GeoLocation;
      passengerNotes?: string;
    }
  ) => {
    if (!currentUser) return;
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    const passengerIndex = (targetRide.acceptedPassengers || []).findIndex((p) => p.userId === currentUser.id);
    if (passengerIndex === -1) {
      triggerToast('Aviso', 'Você não está confirmado como passageiro desta carona.');
      return;
    }

    const currentPassenger = targetRide.acceptedPassengers[passengerIndex];
    const oldSegment = currentPassenger.segmentType || targetRide.segmentType || 'ida_e_volta';
    const newPrice = calculateSegmentPrice(targetRide.price || 0, updates.segmentType, targetRide.segmentType);

    const updatedPassenger: PassengerParticipant = {
      ...currentPassenger,
      segmentType: updates.segmentType,
      agreedPrice: newPrice,
      meetingPoint: updates.meetingPoint,
      passengerNotes: updates.passengerNotes,
      segmentChangePending: undefined,
    };

    const updatedPassengers = [...targetRide.acceptedPassengers];
    updatedPassengers[passengerIndex] = updatedPassenger;

    try {
      await updateFirestoreRide(rideId, {
        acceptedPassengers: updatedPassengers,
      });

      setRides((prev) =>
        prev.map((r) => (r.id === rideId ? { ...r, acceptedPassengers: updatedPassengers } : r))
      );

      // Notificar o motorista sobre a alteração de trecho/dados do passageiro
      if (targetRide.driverId) {
        const legLabel = getSegmentLabel(updates.segmentType);
        const isSegmentChanged = oldSegment !== updates.segmentType;
        const driverMsg = isSegmentChanged
          ? `O passageiro ${currentUser.name} alterou sua participação para o trecho "${legLabel}" (R$ ${newPrice.toFixed(2)}). Ponto de embarque: ${updates.meetingPoint.address || 'Conforme combinado'}.`
          : `O passageiro ${currentUser.name} atualizou as informações de embarque/trecho (${legLabel}). Ponto: ${updates.meetingPoint.address || 'Conforme combinado'}.`;

        await createFirestoreNotification({
          userId: targetRide.driverId,
          title: 'Trecho / Participação Atualizada',
          body: driverMsg,
          type: 'RIDE_ACCEPTED',
          rideId,
          timestamp: new Date().toISOString(),
          read: false,
        });

        // Enviar e-mail monitorado ao motorista
        const driverUser = users.find((u) => u.id === targetRide.driverId);
        if (driverUser?.email) {
          dispatchMonitoredEmail({
            type: 'REQUEST_ACCEPTED',
            recipientEmail: driverUser.email,
            recipientName: targetRide.driverName,
            recipientUserId: targetRide.driverId,
            rideId: targetRide.id,
            rideData: {
              originAddress: targetRide.origin.address,
              destinationAddress: targetRide.destination.address,
              departureDate: targetRide.departureDate,
              departureTime: targetRide.departureTime,
              passengerName: currentUser.name,
              meetingPointAddress: updates.meetingPoint.address,
              notes: `Trecho do passageiro: ${legLabel} (R$ ${newPrice.toFixed(2)}). ${updates.passengerNotes || ''}`,
            },
          });
        }
      }

      // Enviar e-mail de confirmação monitorado ao próprio passageiro
      if (currentUser.email) {
        dispatchMonitoredEmail({
          type: 'REQUEST_ACCEPTED',
          recipientEmail: currentUser.email,
          recipientName: currentUser.name,
          recipientUserId: currentUser.id,
          rideId: targetRide.id,
          rideData: {
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            departureDate: targetRide.departureDate,
            departureTime: targetRide.departureTime,
            driverName: targetRide.driverName,
            vehicleModel: targetRide.driverVehicle?.model,
            vehiclePlate: targetRide.driverVehicle?.plate,
            meetingPointAddress: updates.meetingPoint.address,
            price: newPrice,
            notes: `Trecho selecionado: ${getSegmentLabel(updates.segmentType)}. ${updates.passengerNotes || ''}`,
          },
        });
      }

      addNotification(
        'Viagem Atualizada com Sucesso',
        `Sua participação foi alterada para o trecho "${getSegmentLabel(updates.segmentType)}" (R$ ${newPrice.toFixed(2)}).`,
        'SYSTEM',
        rideId
      );

      triggerToast('Viagem Atualizada', `Trecho alterado com sucesso para ${getSegmentLabel(updates.segmentType)}!`);
    } catch (err: any) {
      console.error('Erro ao atualizar participação da carona:', err);
      triggerToast('Erro', 'Não foi possível salvar as alterações da viagem.');
      throw err;
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

    if (!canJoinRide(targetRide)) {
      triggerToast(
        'Ação Não Permitida',
        'Não é possível enviar propostas para pedidos de carona passados ou concluídos.'
      );
      return;
    }

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
        dispatchMonitoredEmail({
          type: 'PROPOSAL_OFFERED',
          recipientEmail: requesterUser.email,
          recipientName: requesterUser.name,
          recipientUserId: requesterUser.id,
          recipientEmailVerified: requesterUser.emailVerified,
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
        }, requesterUser).catch((e) => console.warn('Email dispatch warning:', e));
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

    if (!canJoinRide(targetRide)) {
      alert('Esta carona pertence ao passado ou já foi concluída/cancelada. Não é possível aderir.');
      return;
    }

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
        dispatchMonitoredEmail({
          type: 'PROPOSAL_ACCEPTED',
          recipientEmail: driverUser.email,
          recipientName: driverUser.name,
          recipientUserId: driverUser.id,
          recipientEmailVerified: driverUser.emailVerified,
          rideId: requestRideId,
          rideData: {
            passengerName: currentUser.name,
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            departureTime: proposal.departureTime,
            price: proposal.offeredPrice,
          },
        }, driverUser).catch((e) => console.warn('Email dispatch warning:', e));
      }

      // Disparar confirmação para o passageiro
      if (currentUser.email) {
        dispatchMonitoredEmail({
          type: 'REQUEST_ACCEPTED',
          recipientEmail: currentUser.email,
          recipientName: currentUser.name,
          recipientUserId: currentUser.id,
          recipientEmailVerified: currentUser.emailVerified,
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
        }, currentUser).catch((e) => console.warn('Email dispatch warning:', e));
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

      const destName = targetRide?.destinationAlias || targetRide?.destination?.alias || targetRide?.destination?.name || targetRide?.destination?.address?.split(',')[0] || 'Destino';
      const vehicleDesc = targetRide?.driverVehicle?.model
        ? `${targetRide.driverVehicle.model}${targetRide.driverVehicle.plate ? ` (${targetRide.driverVehicle.plate})` : ''}`
        : 'veículo cadastrado';

      addNotification(
        '🚀 Viagem Iniciada!',
        `A viagem foi iniciada. Avisos de partida foram enviados por e-mail e notificação push aos passageiros.`,
        'DRIVER_STARTED',
        rideId
      );

      triggerToast(
        'Viagem Iniciada!',
        `Avisos por e-mail e push foram disparados para os passageiros confirmados.`
      );

      // Disparar Web Push Notification local para o motorista se permitido
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && targetRide) {
        try {
          new Notification('🚗 Percurso Iniciado!', {
            body: `Sua viagem com destino a ${destName} começou. Boa viagem!`,
            icon: targetRide.driverAvatar,
          });
        } catch (_) {}
      }

      // Disparar notificação Push Firestore e E-mail para cada passageiro aceito
      if (targetRide) {
        const accepted = targetRide.acceptedPassengers || [];
        for (const p of accepted) {
          const passengerUser = users.find((u) => u.id === p.userId) || users.find((u) => u.name === p.userName);
          const recipientEmail = passengerUser?.email || (p as any).userEmail;
          const recipientName = passengerUser?.name || p.userName || 'Passageiro(a)';

          // 1. Notificação Push Firestore (Entrega em tempo real via snapshot)
          createFirestoreNotification({
            userId: p.userId,
            title: '🚗 Motorista a Caminho!',
            body: `${targetRide.driverName} iniciou a viagem para "${destName}" no ${vehicleDesc}. Acompanhe o trajeto em tempo real no mapa!`,
            type: 'DRIVER_STARTED',
            rideId,
            timestamp: new Date().toISOString(),
            read: false,
          }).catch((e) => console.warn('Firestore notification write warning:', e));

          // 2. Notificação por E-mail Prioritária (Passa livremente pelo email guard com recipientEmailVerified: true)
          if (recipientEmail && recipientEmail.includes('@')) {
            dispatchMonitoredEmail({
              type: 'RIDE_STARTED',
              recipientEmail,
              recipientName,
              recipientUserId: p.userId || passengerUser?.id,
              recipientEmailVerified: true,
              rideId,
              rideData: {
                driverName: targetRide.driverName,
                originAddress: targetRide.origin?.address || 'Origem',
                destinationAddress: targetRide.destination?.address || destName,
                vehicleModel: targetRide.driverVehicle?.model,
                vehiclePlate: targetRide.driverVehicle?.plate,
                departureDate: targetRide.departureDate,
                departureTime: targetRide.departureTime,
              },
            }, passengerUser).catch((e) => console.warn('Email dispatch warning for passenger:', e));
          }
        }
      }
    } catch (err) {
      console.error('Error starting ride:', err);
      triggerToast('Erro', 'Não foi possível iniciar a viagem no Firestore.');
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

      // Optimistic local state update for instant UI feedback
      setRides((prev) =>
        prev.map((r) => (r.id === rideId ? { ...r, status: 'concluida', completedAt } : r))
      );

      // Compute total driver credit for receipts
      const totalDriverCreditBRL = ride.acceptedPassengers && ride.acceptedPassengers.length > 0
        ? ride.acceptedPassengers.reduce((acc, p) => acc + (typeof p.agreedPrice === 'number' ? p.agreedPrice : (ride.price || 6.50)), 0)
        : (ride.price || 6.50);

      // 2. Add ledger transaction(s) for driver (+1 point and +R$ rateio por passageiro individual)
      if (ride.acceptedPassengers && ride.acceptedPassengers.length > 0) {
        for (const p of ride.acceptedPassengers) {
          const passengerPrice = typeof p.agreedPrice === 'number' ? p.agreedPrice : (ride.price || 6.50);
          const driverTx: Omit<LedgerTransaction, 'id'> = {
            userId: ride.driverId,
            driverId: ride.driverId,
            passengerId: p.userId,
            counterpartId: p.userId,
            rideId: ride.id,
            amount: 1,
            valueBRL: passengerPrice,
            type: 'OFFERED_RIDE',
            category: 'OFFER',
            counterpartName: p.userName || 'Passageiro',
            paymentMethod: 'Compensação Automática Ledger',
            status: 'COMPLETED',
            description: `Crédito de Carona: ${ride.origin.name || ride.origin.address.split(',')[0]} ➔ ${ride.destination.name || ride.destination.address.split(',')[0]} • Passageiro(a): ${p.userName || 'Passageiro'} (Tarifa: R$ ${passengerPrice.toFixed(2)})`,
            timestamp: completedAt,
          };
          await addFirestoreTransaction(driverTx);
        }
      } else {
        const fallbackPrice = ride.price || 6.50;
        const driverTx: Omit<LedgerTransaction, 'id'> = {
          userId: ride.driverId,
          driverId: ride.driverId,
          rideId: ride.id,
          amount: 1,
          valueBRL: fallbackPrice,
          type: 'OFFERED_RIDE',
          category: 'OFFER',
          counterpartName: 'Passageiros da Rede',
          paymentMethod: 'Compensação Automática Ledger',
          status: 'COMPLETED',
          description: `Crédito de Carona: ${ride.origin.name || ride.origin.address.split(',')[0]} ➔ ${ride.destination.name || ride.destination.address.split(',')[0]}`,
          timestamp: completedAt,
        };
        await addFirestoreTransaction(driverTx);
      }

      // 3. Add ledger transactions for passengers (-1 each and -R$ rateio definido pelo motorista aceito)
      for (const p of ride.acceptedPassengers) {
        const passengerPrice = typeof p.agreedPrice === 'number' ? p.agreedPrice : (ride.price || 6.50);
        const segLabel = getSegmentLabel(p.segmentType || ride.segmentType);
        const passengerTx: Omit<LedgerTransaction, 'id'> = {
          userId: p.userId,
          passengerId: p.userId,
          driverId: ride.driverId,
          counterpartId: ride.driverId,
          rideId: ride.id,
          amount: -1,
          valueBRL: -passengerPrice,
          type: 'RECEIVED_RIDE',
          category: 'RIDE',
          counterpartName: `${ride.driverName} (Motorista)`,
          paymentMethod: 'Débito Automático Conta Caronas Bank',
          status: 'COMPLETED',
          description: `Débito de Embarque: Embarcou com ${ride.driverName} • Trecho: ${segLabel} (Tarifa: R$ ${passengerPrice.toFixed(2)})`,
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
        dispatchMonitoredEmail({
          type: 'RIDE_COMPLETED',
          recipientEmail: driverUser.email,
          recipientName: driverUser.name,
          recipientUserId: driverUser.id,
          recipientEmailVerified: driverUser.emailVerified,
          rideId,
          rideData: {
            originAddress: ride.origin.address,
            destinationAddress: ride.destination.address,
            price: totalDriverCreditBRL,
            carbonSavingKg: ride.estimatedCarbonSavingKg || 3.4,
          },
        }, driverUser).catch((e) => console.warn('Email dispatch warning:', e));
      }

      // Disparar e-mail de recibo para cada passageiro
      for (const p of ride.acceptedPassengers) {
        const passengerUser = users.find((u) => u.id === p.userId);
        if (passengerUser?.email) {
          dispatchMonitoredEmail({
            type: 'RIDE_COMPLETED',
            recipientEmail: passengerUser.email,
            recipientName: passengerUser.name,
            recipientUserId: passengerUser.id,
            recipientEmailVerified: passengerUser.emailVerified,
            rideId,
            rideData: {
              driverName: ride.driverName,
              originAddress: ride.origin.address,
              destinationAddress: ride.destination.address,
              price: ride.price || 6.50,
              carbonSavingKg: (ride.estimatedCarbonSavingKg || 3.4) / Math.max(1, ride.acceptedPassengers.length),
            },
          }, passengerUser).catch((e) => console.warn('Email dispatch warning:', e));
        }
      }
    } catch (err) {
      console.error('Error completing ride in Firestore:', err);
    }
  };

  // Group actions: A adesão a qualquer grupo SEMPRE exige aprovação do dono/gestor do grupo
  const handleJoinGroup = async (groupId: string) => {
    // Redireciona para o fluxo de solicitação para garantir governança obrigatória do dono
    await handleRequestJoinGroup(groupId);
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

  // Group Governance: Request to Join (Sempre exige aprovação prévia do dono do grupo)
  const handleRequestJoinGroup = async (groupId: string) => {
    if (!currentUser) {
      triggerToast('Atenção', 'Faça login para solicitar entrada no grupo.');
      return;
    }

    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    if (targetGroup.memberIds.includes(currentUser.id)) {
      triggerToast('Informação', `Você já é membro do grupo "${targetGroup.name}".`);
      return;
    }

    const isAlreadyPending = (targetGroup.pendingJoinRequests || []).some((r) => r.userId === currentUser.id);
    if (isAlreadyPending) {
      triggerToast('Solicitação Já Enviada', `Sua solicitação de adesão ao grupo "${targetGroup.name}" já está aguardando aprovação do dono do grupo.`);
      return;
    }

    try {
      await requestJoinFirestoreGroup(groupId, currentUser);

      // Optimistic update
      const newReq = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        userEmail: currentUser.email,
        institutionName: currentUser.institutionName,
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

      // Notificar o dono/gestor do grupo
      if (targetGroup.creatorId && targetGroup.creatorId !== currentUser.id) {
        createFirestoreNotification({
          userId: targetGroup.creatorId,
          title: 'Nova Solicitação de Adesão 👥',
          body: `${currentUser.name} solicitou entrar no seu grupo "${targetGroup.name}". Avalie para aprovar ou recusar.`,
          type: 'NEW_RIDE_GROUP',
          timestamp: new Date().toISOString(),
          read: false,
        }).catch((err) => console.warn('Could not notify group creator:', err));
      }

      triggerToast('Solicitação Enviada!', `Seu pedido para entrar em "${targetGroup.name}" foi enviado ao dono do grupo para aprovação.`);
    } catch (err) {
      console.error('Error requesting to join group:', err);
      triggerToast('Erro', 'Não foi possível enviar a solicitação. Tente novamente.');
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

      // Notificar o usuário aprovado
      createFirestoreNotification({
        userId: targetUserId,
        title: 'Solicitação de Adesão Aprovada! 🎉',
        body: `O dono do grupo "${targetGroup.name}" aprovou sua entrada! Agora você tem acesso às caronas exclusivas do grupo.`,
        type: 'NEW_RIDE_GROUP',
        timestamp: new Date().toISOString(),
        read: false,
      }).catch((err) => console.warn('Could not send approval notification:', err));

      triggerToast('Membro Aprovado!', `${targetUser?.name || 'O usuário'} agora é membro oficial do grupo "${targetGroup.name}".`);
    } catch (err) {
      console.error('Error approving join request:', err);
    }
  };

  // Group Governance: Admin Rejects Join Request
  const handleRejectJoinRequest = async (groupId: string, targetUserId: string) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    try {
      await rejectGroupJoinRequest(groupId, targetUserId);

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, pendingJoinRequests: (g.pendingJoinRequests || []).filter((r) => r.userId !== targetUserId) }
            : g
        )
      );

      if (targetGroup) {
        createFirestoreNotification({
          userId: targetUserId,
          title: 'Solicitação de Adesão Recusada',
          body: `Sua solicitação de entrada no grupo "${targetGroup.name}" foi recusada pelo gestor.`,
          type: 'RIDE_CANCELLED',
          timestamp: new Date().toISOString(),
          read: false,
        }).catch((err) => console.warn('Could not send reject notification:', err));
      }

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

  // Group Governance: Add Member Directly by Manager
  const handleAddMemberDirectly = async (groupId: string, targetUserId: string) => {
    const targetUser = users.find((u) => u.id === targetUserId);
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetUser || !targetGroup) return;

    try {
      await addMemberToGroupDirectly(groupId, targetUser);

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const updatedMembers = Array.from(new Set([...g.memberIds, targetUserId]));
          return {
            ...g,
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

      triggerToast('Participante Adicionado!', `${targetUser.name} agora é membro do grupo "${targetGroup.name}".`);
    } catch (err) {
      console.error('Error adding member directly:', err);
      triggerToast('Erro', 'Não foi possível adicionar o membro diretamente.');
    }
  };

  // Group Governance: Remove Member from Group (Excluir do Grupo)
  // Group Governance: Remove Member from Group (Excluir do Grupo)
  const handleRemoveMember = async (groupId: string, userId: string, userEmail?: string) => {
    const targetUser = users.find(
      (u) =>
        u.id === userId ||
        (userEmail && u.email && u.email.toLowerCase() === userEmail.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === userId.toLowerCase())
    );
    const targetGroup = groups.find((g) => g.id === groupId);

    const idsToRemove = new Set<string>();
    if (userId) {
      idsToRemove.add(userId);
      idsToRemove.add(userId.toLowerCase());
    }
    if (userEmail) {
      idsToRemove.add(userEmail);
      idsToRemove.add(userEmail.toLowerCase());
    }
    if (targetUser) {
      if (targetUser.id) idsToRemove.add(targetUser.id);
      if (targetUser.email) {
        idsToRemove.add(targetUser.email);
        idsToRemove.add(targetUser.email.toLowerCase());
      }
    }

    try {
      await removeMemberFromGroup(groupId, userId, userEmail || targetUser?.email);

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const updatedMembers = (g.memberIds || []).filter(
            (id) => !idsToRemove.has(id) && !idsToRemove.has(id.toLowerCase())
          );
          const updatedBlocked = (g.blockedMemberIds || []).filter(
            (id) => !idsToRemove.has(id) && !idsToRemove.has(id.toLowerCase())
          );
          const updatedAdmins = (g.adminIds || []).filter(
            (id) => !idsToRemove.has(id) && !idsToRemove.has(id.toLowerCase())
          );
          return {
            ...g,
            memberIds: updatedMembers,
            blockedMemberIds: updatedBlocked,
            adminIds: updatedAdmins,
            memberCount: updatedMembers.length,
          };
        })
      );

      setUsers((prev) =>
        prev.map((u) => {
          const isTarget = idsToRemove.has(u.id) || (u.email && idsToRemove.has(u.email.toLowerCase()));
          if (!isTarget) return u;
          return { ...u, groups: (u.groups || []).filter((id) => id !== groupId) };
        })
      );

      if (
        currentUser &&
        (idsToRemove.has(currentUser.id) ||
          (currentUser.email && idsToRemove.has(currentUser.email.toLowerCase())))
      ) {
        setCurrentUser((prev) =>
          prev ? { ...prev, groups: (prev.groups || []).filter((id) => id !== groupId) } : null
        );
      }

      triggerToast(
        'Membro Excluído',
        `${targetUser?.name || 'O participante'} foi excluído do grupo "${targetGroup?.name || ''}".`
      );
    } catch (err) {
      console.error('Error removing member from group:', err);
      triggerToast('Erro', 'Não foi possível excluir o membro do grupo.');
    }
  };

  // Group Governance: Toggle Block Member (Bloquear / Desbloquear adesão automática nas viagens)
  const handleToggleBlockMember = async (groupId: string, userId: string) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    const targetUser = users.find((u) => u.id === userId);
    if (!targetGroup) return;

    const isCurrentlyBlocked = targetGroup.blockedMemberIds?.includes(userId) ?? false;
    const newBlocked = !isCurrentlyBlocked;

    try {
      await toggleBlockMemberInGroup(groupId, userId, newBlocked);

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const currentBlocked = g.blockedMemberIds || [];
          const updatedBlocked = newBlocked
            ? Array.from(new Set([...currentBlocked, userId]))
            : currentBlocked.filter((id) => id !== userId);
          return {
            ...g,
            blockedMemberIds: updatedBlocked,
          };
        })
      );

      triggerToast(
        newBlocked ? 'Membro Bloqueado no Grupo' : 'Adesão Automática Reativada',
        newBlocked
          ? `${targetUser?.name || 'O participante'} continua no grupo, mas não terá adesão automática às viagens postadas pelo grupo (reservas passarão por aprovação manual do motorista).`
          : `Adesão automática restabelecida com sucesso para ${targetUser?.name || 'o participante'}.`
      );
    } catch (err) {
      console.error('Error toggling member block status:', err);
      triggerToast('Erro', 'Não foi possível alterar o status do membro.');
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

  // Cancel whole ride (by driver or admin)
  const handleCancelRide = async (rideId: string, reason?: string) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    if (!canLeaveRide(targetRide)) {
      triggerToast(
        'Ação Não Permitida',
        'Não é permitido cancelar viagens que já foram concluídas ou pertencem a datas passadas.'
      );
      return;
    }

    try {
      // 1. Identificar todos os passageiros vinculados (confirmados e solicitações pendentes)
      const acceptedPassengerIds = (targetRide.acceptedPassengers || []).map((p) => p.userId);
      const pendingPassengerIds = (targetRide.pendingRequests || []).map((p) => p.userId);
      const uniquePassengerIds = Array.from(new Set([...acceptedPassengerIds, ...pendingPassengerIds])).filter(
        (id) => id && id !== currentUser?.id
      );

      console.log(`[Cancelamento de Viagem] Notificando ${uniquePassengerIds.length} passageiro(s) por push e e-mail...`);

      // 2. Disparar notificações Push (Firestore + FCM) e E-mail para cada passageiro
      for (const passengerId of uniquePassengerIds) {
        const passengerUser = users.find((u) => u.id === passengerId);
        const passengerFromRide = (targetRide.acceptedPassengers || []).find((p) => p.userId === passengerId);
        const passengerEmail = passengerUser?.email || passengerFromRide?.userEmail;
        const passengerName = passengerUser?.name || passengerFromRide?.userName || 'Passageiro(a)';

        const notifTitle = '❌ Viagem Cancelada pelo Motorista';
        const notifBody = `A carona para "${targetRide.destination.address}" (${targetRide.departureDate || 'Hoje'} às ${targetRide.departureTime || '--:--'}) foi cancelada pelo motorista ${targetRide.driverName}.${reason ? ` Motivo: "${reason}".` : ''} Sua vaga foi liberada e nenhum rateio foi cobrado.`;

        // a) Push Notification persistida no Firestore para entrega em tempo real
        createFirestoreNotification({
          userId: passengerId,
          title: notifTitle,
          body: notifBody,
          type: 'RIDE_CANCELLED',
          rideId,
          timestamp: new Date().toISOString(),
          read: false,
        }).catch((err) => console.warn('Erro ao registrar notificação Firestore:', err));

        // b) Disparo para o serviço FCM / simulador de Push
        fetch('/api/fcm/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: passengerId,
            title: notifTitle,
            body: notifBody,
            type: 'RIDE_CANCELLED',
            rideId,
          }),
        }).catch((err) => console.warn('Erro ao disparar push FCM:', err));

        // c) Disparo de E-mail oficial via contato@apponline.ia.br com monitoramento e alerta ao passageiro
        if (passengerEmail) {
          dispatchMonitoredEmail({
            type: 'RIDE_CANCELLED',
            recipientEmail: passengerEmail,
            recipientName: passengerName,
            recipientUserId: passengerId,
            recipientEmailVerified: passengerUser?.emailVerified,
            rideId,
            rideData: {
              driverName: targetRide.driverName,
              originAddress: targetRide.origin.address,
              destinationAddress: targetRide.destination.address,
              departureDate: targetRide.departureDate,
              departureTime: targetRide.departureTime,
              price: targetRide.price,
              totalSeats: targetRide.totalSeats,
              vehicleModel: targetRide.driverVehicle?.model,
              vehiclePlate: targetRide.driverVehicle?.plate,
              groupName: targetRide.targetGroupName,
              notes: reason || undefined,
              cancellationReason: reason || undefined,
            },
          }, passengerUser).then((res) => {
            console.log(`[Email Cancelamento] Disparado para ${passengerEmail}:`, res);
          }).catch((err) => {
            console.warn(`[Email Cancelamento] Erro ao enviar para ${passengerEmail}:`, err);
          });
        }
      }

      // d) Web Push Notification nativa caso haja suporte e permissão
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('❌ Viagem Cancelada', {
            body: `A carona para ${targetRide.destination.address} foi cancelada.`,
            icon: targetRide.driverAvatar,
          });
        } catch (_) {}
      }

      // 3. Excluir a carona do Firestore
      await deleteFirestoreRide(rideId);
      setRides((prev) => prev.filter((r) => r.id !== rideId));

      const passengerNotice = uniquePassengerIds.length > 0 
        ? `${uniquePassengerIds.length} passageiro(s) foram notificados por Push e E-mail.` 
        : 'Nenhum passageiro estava vinculado.';

      addNotification(
        'Viagem Cancelada',
        `A viagem para ${targetRide.destination.address} foi cancelada. ${passengerNotice}`,
        'RIDE_CANCELLED',
        rideId
      );

      triggerToast('Carona Cancelada', `A viagem foi cancelada e ${passengerNotice}`);
    } catch (err) {
      console.error('Error canceling ride:', err);
      triggerToast('Erro', 'Não foi possível cancelar a carona.');
    }
  };

  // Cancel reservation (by passenger)
  const handleCancelReservation = async (rideId: string, userId: string) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) return;

    // Regra Estrita: Não deve ser permitido sair de viagens concluídas ou de datas passadas
    if (!canLeaveRide(targetRide)) {
      triggerToast(
        'Ação Não Permitida',
        'Não é permitido sair ou desmarcar vaga de viagens concluídas ou de datas passadas.'
      );
      return;
    }

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

  // Exclude / remove passenger from ride (by driver) with justification sent via push and email
  const handleRemovePassenger = async (
    rideId: string,
    passengerUserId: string,
    justification: string
  ) => {
    const targetRide = rides.find((r) => r.id === rideId);
    if (!targetRide) {
      triggerToast('Erro', 'Viagem não encontrada.');
      return;
    }

    // Regra Estrita: Não deve ser permitido alterar ou remover passageiros de viagens concluídas ou de datas passadas
    if (!canLeaveRide(targetRide)) {
      triggerToast(
        'Ação Não Permitida',
        'Não é permitido alterar ou remover passageiros de viagens concluídas ou de datas passadas.'
      );
      return;
    }

    const trimmedReason = justification.trim();
    if (!trimmedReason) {
      triggerToast('Atenção', 'Por favor, informe uma justificativa para a exclusão do passageiro.');
      return;
    }

    const passengerFromRide = (targetRide.acceptedPassengers || []).find((p) => p.userId === passengerUserId);
    const passengerUser = users.find((u) => u.id === passengerUserId);
    const passengerName = passengerUser?.name || passengerFromRide?.userName || 'Passageiro(a)';
    const passengerEmail = passengerUser?.email || passengerFromRide?.userEmail;

    const updatedPassengers = (targetRide.acceptedPassengers || []).filter((p) => p.userId !== passengerUserId);
    const updatedOccupied = Math.max(0, updatedPassengers.length);

    try {
      // 1. Atualizar o documento da viagem no Firestore
      await updateFirestoreRide(rideId, {
        acceptedPassengers: updatedPassengers,
        occupiedSeats: updatedOccupied,
      });

      // 2. Atualizar estado local das viagens
      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? { ...r, acceptedPassengers: updatedPassengers, occupiedSeats: updatedOccupied }
            : r
        )
      );

      const destAddress = targetRide.destinationAlias || targetRide.destination?.alias || targetRide.destination?.name || targetRide.destination?.address?.split(',')[0] || 'Destino';
      const notifTitle = '⚠️ Vaga Cancelada pelo Motorista';
      const notifBody = `O motorista ${targetRide.driverName} removeu sua vaga da carona para "${destAddress}" (${targetRide.departureDate || 'Hoje'} às ${targetRide.departureTime || '--:--'}). Justificativa: "${trimmedReason}". Sua vaga foi liberada e nenhum rateio foi cobrado.`;

      // 3. Disparar notificação Push persistida no Firestore
      createFirestoreNotification({
        userId: passengerUserId,
        title: notifTitle,
        body: notifBody,
        type: 'PASSENGER_REMOVED',
        rideId,
        timestamp: new Date().toISOString(),
        read: false,
      }).catch((err) => console.warn('[RemovePassenger] Erro ao registrar notificação Firestore:', err));

      // 4. Disparar notificação Push via FCM endpoint
      fetch('/api/fcm/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: passengerUserId,
          title: notifTitle,
          body: notifBody,
          type: 'PASSENGER_REMOVED',
          rideId,
        }),
      }).catch((err) => console.warn('[RemovePassenger] Erro ao disparar push FCM:', err));

      // 5. Disparar E-mail oficial via contato@apponline.ia.br com justificativa e monitoramento
      if (passengerEmail) {
        dispatchMonitoredEmail({
          type: 'PASSENGER_REMOVED',
          recipientEmail: passengerEmail,
          recipientName: passengerName,
          recipientUserId: passengerUserId,
          recipientEmailVerified: passengerUser?.emailVerified,
          rideId,
          cancellationReason: trimmedReason,
          rideData: {
            driverName: targetRide.driverName,
            originAddress: targetRide.origin.address,
            destinationAddress: targetRide.destination.address,
            departureDate: targetRide.departureDate,
            departureTime: targetRide.departureTime,
            price: targetRide.price,
            totalSeats: targetRide.totalSeats,
            vehicleModel: targetRide.driverVehicle?.model,
            vehiclePlate: targetRide.driverVehicle?.plate,
            groupName: targetRide.targetGroupName,
            notes: trimmedReason,
            cancellationReason: trimmedReason,
          },
        }, passengerUser).then((res) => {
          console.log(`[Email Exclusão Passageiro] Disparado para ${passengerEmail}:`, res);
        }).catch((err) => {
          console.warn(`[Email Exclusão Passageiro] Erro ao enviar para ${passengerEmail}:`, err);
        });
      }

      // 6. Web Push Notification nativa caso haja suporte
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('⚠️ Vaga Cancelada pelo Motorista', {
            body: `Você foi removido(a) da carona para ${destAddress}. Motivo: ${trimmedReason}`,
            icon: targetRide.driverAvatar,
          });
        } catch (_) {}
      }

      addNotification(
        'Passageiro Excluído da Viagem',
        `${passengerName} foi removido(a) da carona para "${destAddress}". Notificação push e e-mail com justificativa foram enviados.`,
        'PASSENGER_REMOVED',
        rideId
      );

      triggerToast(
        'Passageiro Excluído com Sucesso',
        `${passengerName} foi removido(a) da viagem. A justificativa foi enviada por Push e E-mail.`
      );
    } catch (err) {
      console.error('Error removing passenger from ride:', err);
      triggerToast('Erro', 'Não foi possível excluir o passageiro da viagem.');
      throw err;
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

      setLedger((prev) => {
        if (prev.some((t) => (txId && t.id === txId) || (t.settlementId && t.settlementId === settlementId))) {
          return prev;
        }
        return [newTx, ...prev];
      });

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
                status: 'REJECTED',
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
      const { txId, settlementId } = await directSettlementByDriver(driverUser, passengerUser, amount, notes);

      const now = new Date().toISOString();
      const passengerTx: LedgerTransaction = {
        id: txId,
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

      setLedger((prev) => {
        if (prev.some((t) => (txId && t.id === txId) || (t.settlementId && t.settlementId === settlementId))) {
          return prev;
        }
        return [passengerTx, ...prev];
      });

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
          setOriginalAdminUser(null);
          try {
            localStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
            sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
          } catch (e) {}
          setActiveTab('rides');
          triggerToast('Sessão Encerrada', 'Você saiu da sua conta. Áreas protegidas foram bloqueadas.');
        }}
        onRestoreSuperAdmin={handleRestoreSuperAdmin}
        isSupportActive={Boolean(originalAdminUser)}
        originalAdminUser={originalAdminUser}
        isFirebaseConnected={isFirebaseConnected}
        interfaceMode={interfaceMode}
        onToggleInterfaceMode={handleToggleInterfaceMode}
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
        notifications={notifications}
        onMarkNotificationsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          if (currentUser?.id) {
            markFirestoreNotificationsAsRead(currentUser.id);
          }
        }}
        onClearNotifications={async () => {
          setNotifications([]);
          if (currentUser?.id) {
            await clearAllFirestoreNotifications(currentUser.id);
          }
        }}
        onDeleteNotification={async (id) => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
          await deleteFirestoreNotification(id);
        }}
      />

      {/* SuperUser Support Active Mode Sticky Bar */}
      {originalAdminUser && currentUser && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2.5 shadow-lg sticky top-0 z-50 border-b border-amber-600/40">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-bold">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-slate-950 text-amber-400 rounded-lg shadow-2xs">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <span className="uppercase tracking-wider text-[10px] text-amber-950 font-black block">
                  Sessão de Suporte ao Usuário Ativa (Superusuário)
                </span>
                <span>
                  Você está prestando suporte e atuando como <strong>{currentUser.name}</strong> ({currentUser.email})
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setSupportTargetUserId(currentUser.id);
                  setUserAreaSection('identity');
                  setActiveTab('user_area');
                }}
                className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl shadow-xs transition text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configurar Perfil</span>
              </button>

              <button
                type="button"
                onClick={handleExitSupportSession}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-300 rounded-xl shadow-xs transition text-xs font-bold flex items-center space-x-1 cursor-pointer border border-amber-500/50"
              >
                <span>Encerrar Suporte e Voltar para {originalAdminUser?.name || 'Silvano'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Delivery Failure Warning Banner - Alerta o usuário destinatário quando o envio de e-mail falhou */}
      {currentUser && notifications.some((n) => n.type === 'EMAIL_DELIVERY_FAILED' && !n.read) && (
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 text-white px-4 py-2.5 shadow-md border-b border-rose-800 animate-in slide-in-from-top">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-black/30 rounded-xl shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-amber-200 block">
                  Aviso de Notificação ao Destinatário
                </span>
                <span>
                  Houve falha ao entregar notificações por e-mail para seu endereço (<strong>{currentUser.email}</strong>). Verifique sua validação de e-mail ou dados de contato para restabelecer o recebimento de alertas de carona.
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => {
                  setUserAreaSection('emails');
                  setActiveTab('user_area');
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-rose-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-95 flex items-center space-x-1"
              >
                <span>Ajustar / Validar E-mail →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Callout Banner (shown when user is logged in, unverified, and hasn't dismissed) */}
      {currentUser && !currentUser.emailVerified && (currentUser.email || '').toLowerCase() !== 'silvano.kassio@gmail.com' && !dismissedEmailBanner && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Validação de E-mail Pendente:</strong> Valide seu endereço (<code className="text-amber-100 font-mono">{currentUser.email}</code>) com o código de 6 dígitos para autorizar o recebimento de e-mails automáticos do CaronaFlow.
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => {
                  setUserAreaSection('emails');
                  setActiveTab('user_area');
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs active:scale-95"
              >
                Validar E-mail Agora →
              </button>
              <button
                onClick={() => setDismissedEmailBanner(true)}
                className="p-1 text-amber-400/70 hover:text-amber-300 transition cursor-pointer"
                title="Dispensar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {interfaceMode === 'light' && activeTab !== 'user_area' && activeTab !== 'superuser_management' && activeTab !== 'architecture' && activeTab !== 'ai_routes' && activeTab !== 'routines' ? (
          <LightModeView
            currentUser={currentUser}
            allUsers={users}
            rides={rides}
            groups={groups}
            communities={communities}
            ledger={ledger}
            activeNavTab={activeTab}
            onNavigateNavTab={(tab) => setActiveTab(tab)}
            onRequestSettlement={handleRequestSettlement}
            onConfirmSettlement={handleConfirmSettlement}
            onRejectSettlement={handleRejectSettlement}
            onDirectSettlementByDriver={handleDirectSettlementByDriver}
            onGoToFullStatement={() => {
              handleToggleInterfaceMode('advanced');
              setActiveTab('gamification');
            }}
            onJoinRide={(rideId, isQuick) => handleJoinRide(rideId, isQuick ?? false)}
            onStartRide={handleStartRide}
            onCancelRide={handleCancelRide}
            onCancelReservation={handleCancelReservation}
            onRemovePassenger={handleRemovePassenger}
            onCompleteRide={handleCompleteRide}
            onCreateQuickRide={handleCreateQuickRide}
            onQuickCreateRide={handleQuickCreateRideFromGrid}
            onQuickBookSeat={(rideId) => handleJoinRide(rideId, true)}
            onQuickCancelSeat={handleCancelReservation}
            onNavigateToRideEdit={handleNavigateToRideEdit}
            onUpdateRide={handleUpdateRide}
            onUpdatePassengerParticipation={handleUpdatePassengerParticipation}
            onJoinGroup={handleJoinGroup}
            onRequestJoinGroup={handleRequestJoinGroup}
            onApproveJoinRequest={handleApproveJoinRequest}
            onRejectJoinRequest={handleRejectJoinRequest}
            onAcceptInvitation={handleAcceptInvitation}
            onRejectInvitation={handleRejectInvitation}
            onLeaveGroup={handleLeaveGroup}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'login');
              setIsAuthModalOpen(true);
            }}
            onSwitchToAdvanced={() => handleToggleInterfaceMode('advanced')}
          />
        ) : (
          <>
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
                onCancelRide={handleCancelRide}
                onCancelReservation={handleCancelReservation}
                onRemovePassenger={handleRemovePassenger}
                onUpdateRide={handleUpdateRide}
                onUpdatePassengerParticipation={handleUpdatePassengerParticipation}
                onRequestSegmentChange={handleRequestSegmentChange}
                onRespondSegmentChange={handleRespondSegmentChange}
                initialGroupForRide={selectedGroupForRide}
                onClearInitialGroupForRide={() => setSelectedGroupForRide(null)}
                allUsers={users}
                onOpenAuth={(mode) => {
                  setAuthModalMode(mode || 'login');
                  setIsAuthModalOpen(true);
                }}
                onNavigateToTab={(tab) => setActiveTab(tab as any)}
              />
            )}

            {activeTab === 'routines' && (
              <UserAreaView
                currentUser={currentUser}
                allUsers={users}
                isSuperAdmin={isSuperUser(currentUser) || Boolean(originalAdminUser)}
                initialTargetUserId={supportTargetUserId || undefined}
                onStartSupportSession={handleStartSupportSession}
                onUserUpdated={(updated) => {
                  if (currentUser && updated.id === currentUser.id) {
                    setCurrentUser(updated);
                  }
                  setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
                  triggerToast('Rotina e Preferências Atualizadas', 'Rotina fixa e ponto de encontro salvos com sucesso.');
                }}
                onUserDeleted={() => {
                  if (originalAdminUser) {
                    handleExitSupportSession();
                  } else {
                    setCurrentUser(null);
                  }
                  triggerToast('Conta Excluída', 'A conta e dados associados foram excluídos do Firestore.');
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
                onRemovePassenger={handleRemovePassenger}
                onCancelRide={handleCancelRide}
                onNavigateToRideEdit={handleNavigateToRideEdit}
                onAddMemberDirectly={handleAddMemberDirectly}
                onRemoveMember={handleRemoveMember}
                onToggleBlockMember={handleToggleBlockMember}
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
                groups={groups}
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
                isSuperAdmin={isSuperUser(currentUser) || Boolean(originalAdminUser)}
                initialTargetUserId={supportTargetUserId || undefined}
                onStartSupportSession={handleStartSupportSession}
                onUserUpdated={(updated) => {
                  if (currentUser && updated.id === currentUser.id) {
                    setCurrentUser(updated);
                  }
                  setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
                  triggerToast('Perfil & Preferências Atualizados', 'Dados cadastrais e preferências salvos com sucesso.');
                }}
                onUserDeleted={() => {
                  if (originalAdminUser) {
                    handleExitSupportSession();
                  } else {
                    setCurrentUser(null);
                  }
                  triggerToast('Conta Excluída', 'A conta e dados associados foram excluídos do Firestore.');
                }}
                onOpenAuth={(mode) => {
                  setAuthModalMode(mode || 'login');
                  setIsAuthModalOpen(true);
                }}
                onNavigateToTab={(tab) => setActiveTab(tab as any)}
                onUpdateRoutine={handleUpdateRoutine}
                initialSection={userAreaSection}
              />
            )}

            {activeTab === 'superuser_management' && (isSuperUser(currentUser) || Boolean(originalAdminUser)) && (
              <SuperUserManagementView
                currentUser={currentUser}
                allUsers={users}
                groups={groups}
                onUsersUpdated={() => {
                  triggerToast('Base Atualizada', 'Dados do Firestore sincronizados.');
                }}
                onNavigateToTab={(tab) => setActiveTab(tab as any)}
                onStartSupportSession={handleStartSupportSession}
                onOpenUserProfile={(targetUser) => {
                  setSupportTargetUserId(targetUser.id);
                  setUserAreaSection('identity');
                  setActiveTab('user_area');
                }}
              />
            )}

            {activeTab === 'architecture' && isSuperUser(currentUser) && (
              <ArchitectureBlueprintView />
            )}
          </>
        )}
      </main>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updated) => {
          setCurrentUser(updated);
          saveUserSession(updated);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        }}
        onUserDeleted={() => {
          clearUserSession();
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
          saveUserSession(authenticatedUser);
          setUsers((prev) => {
            if (prev.some((u) => u.id === authenticatedUser.id)) {
              return prev.map((u) => (u.id === authenticatedUser.id ? authenticatedUser : u));
            }
            return [authenticatedUser, ...prev];
          });
          setIsAuthModalOpen(false);
        }}
      />

      {/* Componente de notificação automática 15 minutos antes da partida */}
      <RideDepartureReminder
        rides={rides}
        currentUser={currentUser}
        onReminder={(title, body) => {
          triggerToast(title, body, true, {
            iconType: 'clock',
            tag: 'departure-reminder-15m',
            fireWebNotification: false // já disparado pelo próprio componente via Notification API
          });
        }}
      />

      {/* Real-time Floating System / Push Toast */}
      {activeToast && (
        <div 
          id="fcm-toast-notification"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 sm:max-w-md bg-white border border-slate-200 rounded-2xl p-4 shadow-xl text-slate-900 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ring-4 ring-slate-500/5"
        >
          <div className={`p-2.5 rounded-xl shrink-0 ${
            activeToast.iconType === 'clock' 
              ? 'bg-amber-50 text-amber-600 border border-amber-200' 
              : activeToast.iconType === 'car'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : activeToast.isPush 
              ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
              : 'bg-slate-100 text-slate-700'
          }`}>
            {activeToast.iconType === 'clock' ? (
              <Clock className="w-5 h-5 animate-pulse" />
            ) : activeToast.iconType === 'car' ? (
              <Car className="w-5 h-5 animate-bounce" />
            ) : (
              <Bell className={`w-5 h-5 ${activeToast.isPush ? 'animate-pulse' : ''}`} />
            )}
          </div>
          <div className="space-y-1 flex-1 text-xs min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 truncate">{activeToast.title}</span>
              {activeToast.iconType === 'clock' ? (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full shrink-0">15 min</span>
              ) : activeToast.iconType === 'car' ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full shrink-0">Grupo</span>
              ) : activeToast.isPush ? (
                <span className="text-[10px] text-indigo-600 font-mono font-semibold shrink-0">Notificação</span>
              ) : null}
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
