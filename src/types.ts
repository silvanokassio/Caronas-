export interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
  name?: string;
  alias?: string; // Apelido ou nome do destino (ex: faculdade ou empresa)
}

export interface Routine {
  id: string;
  title: string;
  origin: GeoLocation;
  destination: GeoLocation;
  departureTime: string;
  daysOfWeek: string[];
  defaultSeats: number;
  defaultPrice: number;
  targetGroupId?: string;
}

export interface Vehicle {
  id?: string;
  model: string;
  plate: string;
  color: string;
  year?: string;
  category?: 'hatch' | 'sedan' | 'suv' | 'electric' | 'pickup';
  availableSeats?: number;
  isPrimary?: boolean;
}

export const SUPERUSER_EMAIL = 'silvano.kassio@gmail.com';

export interface UserPreferences {
  // Conforto & Convivência no veículo
  allowMusic?: boolean;
  musicStyle?: string;
  allowPets?: boolean;
  allowSmoking?: boolean;
  airConditioning?: boolean;
  conversationStyle?: 'talkative' | 'quiet' | 'flexible';
  womenOnlyRides?: boolean;
  luggageSize?: 'small' | 'medium' | 'large';
  punctualityToleranceMinutes?: number;

  // Notificações & Alertas
  notifyNewRidesInGroups?: boolean;
  notifyRideAccepted?: boolean;
  notifyDriverDeparted?: boolean;
  notifyAIOptimizations?: boolean;

  // Mobilidade & Rotas
  maxDetourDistanceMeters?: number;
  preferFastestRoute?: boolean;
  preferEcoRoute?: boolean;

  // Privacidade & Perfil
  profileVisibility?: 'public' | 'groups_only' | 'verified_only';
  showPhoneToPassengers?: boolean;
  showExactAddress?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role?: 'user' | 'driver' | 'passenger' | 'admin' | 'superadmin';
  isSuperUser?: boolean;
  rolePreference?: 'both' | 'driver' | 'passenger' | 'member';
  cpf?: string;
  residentialAddress?: GeoLocation;
  useResidentialAsMeetingPoint?: boolean;
  ponto_encontro_default: GeoLocation;
  saldo_caronas: number;
  routine?: Routine;
  groups: string[];
  vehicle?: Vehicle;
  vehicles?: Vehicle[];
  rating: number;
  totalRidesOffered: number;
  totalRidesTaken: number;
  institutionName?: string;
  pixKey?: string;
  pixKeyType?: 'email' | 'phone' | 'cpf' | 'random';
  phone?: string;
  bio?: string;
  agency?: string;
  accountNumber?: string;
  bankName?: string;
  gender?: 'female' | 'male' | 'other' | 'prefer_not_say';
  preferences?: UserPreferences;
  emailVerified?: boolean;
  emailVerificationSentAt?: string;
  interfaceMode?: AppInterfaceMode;
  createdAt?: string;
}

export type AppInterfaceMode = 'light' | 'advanced';

export function isSuperUser(user?: User | null): boolean {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  if (email === SUPERUSER_EMAIL.toLowerCase()) return true;
  if (user.role === 'superadmin') return true;
  if (user.isSuperUser === true) return true;
  return false;
}

export function getUserVehicles(user?: User | null): Vehicle[] {
  if (!user) return [];
  if (user.vehicles && user.vehicles.length > 0) {
    return user.vehicles;
  }
  if (user.vehicle && user.vehicle.model) {
    return [user.vehicle];
  }
  return [];
}

export function getGroupDestinationAlias(group?: Partial<Group> | null): string {
  if (!group) return 'Destino';
  if (group.destinationAlias && group.destinationAlias.trim()) {
    return group.destinationAlias.trim();
  }
  if (group.defaultDestination?.alias && group.defaultDestination.alias.trim()) {
    return group.defaultDestination.alias.trim();
  }
  // Se o name for diferente do endereço completo, usá-lo como apelido
  if (
    group.defaultDestination?.name && 
    group.defaultDestination.name.trim() && 
    group.defaultDestination.name.trim() !== group.defaultDestination.address?.trim()
  ) {
    return group.defaultDestination.name.trim();
  }
  // Se o nome do grupo estiver no formato "Origem - Destino" (ex: "Indaiatuba - Elektro")
  if (group.name && group.name.includes(' - ')) {
    const parts = group.name.split(' - ');
    if (parts.length >= 2 && parts[1].trim()) {
      return parts[1].trim();
    }
  }
  // Se houver nome de comunidade/empresa associada
  if (group.communityName && group.communityName.trim()) {
    return group.communityName.trim();
  }
  return group.defaultDestination?.name || group.defaultDestination?.address || 'Polo / Campus Central';
}

export function isUserMemberOfGroup(
  group?: Partial<Group> | null,
  user?: User | null,
  allUsersList: User[] = []
): boolean {
  if (!user || !group) return false;
  if (isSuperUser(user)) return true;

  // Build a set of all known identifiers for this user (ID, email, and matching allUsers IDs)
  const userIdentifiers = new Set<string>();
  if (user.id) userIdentifiers.add(user.id);
  if (user.email) {
    const norm = user.email.trim().toLowerCase();
    userIdentifiers.add(norm);
    userIdentifiers.add(user.email.trim());
    allUsersList.forEach((u) => {
      if (u.email && u.email.trim().toLowerCase() === norm) {
        if (u.id) userIdentifiers.add(u.id);
        if (Array.isArray(u.groups) && group.id && u.groups.includes(group.id)) {
          userIdentifiers.add('IN_USER_GROUPS');
        }
      }
    });
  }

  // 1. Direct user groups membership array
  if (group.id && Array.isArray(user.groups) && user.groups.includes(group.id)) {
    return true;
  }
  if (userIdentifiers.has('IN_USER_GROUPS')) {
    return true;
  }

  // 2. Creator check
  if (group.creatorId && userIdentifiers.has(group.creatorId)) {
    return true;
  }
  if (group.creatorEmail && user.email && group.creatorEmail.trim().toLowerCase() === user.email.trim().toLowerCase()) {
    return true;
  }

  // 3. Admin check
  if (Array.isArray(group.adminIds) && group.adminIds.some((aId) => userIdentifiers.has(aId) || (user.email && aId.trim().toLowerCase() === user.email.trim().toLowerCase()))) {
    return true;
  }

  // 4. MemberIds check
  if (Array.isArray(group.memberIds)) {
    return group.memberIds.some((mId) => {
      if (!mId) return false;
      if (userIdentifiers.has(mId)) return true;
      if (user.email && mId.trim().toLowerCase() === user.email.trim().toLowerCase()) return true;
      return false;
    });
  }

  return false;
}

export function isUserGroupManager(
  group?: Partial<Group> | null,
  user?: User | null,
  allUsersList: User[] = []
): boolean {
  if (!user || !group) return false;
  if (isSuperUser(user)) return true;

  const userIds = new Set<string>();
  if (user.id) userIds.add(user.id);
  if (user.email) {
    const norm = user.email.trim().toLowerCase();
    userIds.add(norm);
    userIds.add(user.email.trim());
    allUsersList.forEach((u) => {
      if (u.email && u.email.trim().toLowerCase() === norm && u.id) {
        userIds.add(u.id);
      }
    });
  }

  if (group.creatorId && userIds.has(group.creatorId)) return true;
  if (group.creatorEmail && user.email && group.creatorEmail.trim().toLowerCase() === user.email.trim().toLowerCase()) return true;
  if (Array.isArray(group.adminIds) && group.adminIds.some((aId) => userIds.has(aId) || (user.email && aId.trim().toLowerCase() === user.email.trim().toLowerCase()))) return true;

  return false;
}

export function isUserPendingJoinGroup(
  group?: Partial<Group> | null,
  user?: User | null,
  allUsersList: User[] = []
): boolean {
  if (!user || !group) return false;
  const userIds = new Set<string>();
  if (user.id) userIds.add(user.id);
  if (user.email) {
    const norm = user.email.trim().toLowerCase();
    userIds.add(norm);
    allUsersList.forEach((u) => {
      if (u.email && u.email.trim().toLowerCase() === norm && u.id) {
        userIds.add(u.id);
      }
    });
  }
  return (group.pendingJoinRequests || []).some((r) =>
    userIds.has(r.userId) ||
    (user.email && r.userEmail && r.userEmail.trim().toLowerCase() === user.email.trim().toLowerCase())
  );
}

export function isUserInvitedToGroup(
  group?: Partial<Group> | null,
  user?: User | null,
  allUsersList: User[] = []
): boolean {
  if (!user || !group) return false;
  const userIds = new Set<string>();
  if (user.id) userIds.add(user.id);
  if (user.email) {
    const norm = user.email.trim().toLowerCase();
    userIds.add(norm);
    allUsersList.forEach((u) => {
      if (u.email && u.email.trim().toLowerCase() === norm && u.id) {
        userIds.add(u.id);
      }
    });
  }
  return (group.pendingInvitations || []).some((inv) =>
    userIds.has(inv.userId) ||
    (user.email && inv.userEmail && inv.userEmail.trim().toLowerCase() === user.email.trim().toLowerCase())
  );
}


export interface GroupJoinRequest {
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  institutionName?: string;
  requestedAt: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface GroupInvitation {
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  invitedBy: string;
  invitedByName: string;
  invitedAt: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  category: 'academic' | 'corporate' | 'neighborhood' | 'ecosystem' | 'other';
  icon?: string;
  coverImage?: string;
  creatorId?: string;
  creatorName?: string;
  memberIds?: string[];
  memberCount?: number;
  groupsCount?: number;
  isVerified?: boolean;
  createdAt?: string;
}

export interface Group {
  id: string;
  name: string;
  category: 'corporate' | 'academic' | 'community';
  domainRestricted?: string;
  communityId?: string;
  communityName?: string;
  visibility?: 'public' | 'private'; // 'public' = Qualquer um vê e solicita adesão | 'private' = Oculto, só membros veem e criador adiciona participantes
  recurringDays?: string[]; // Ex: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
  memberIds: string[];
  memberCount?: number;
  blockedMemberIds?: string[]; // Membros que continuam no grupo mas têm adesão automática bloqueada às viagens do grupo
  description: string;
  icon: string;
  createdAt: string;
  // Gestão e Criador
  creatorId?: string;
  creatorName?: string;
  creatorEmail?: string;
  adminIds?: string[];
  // Dados Padrão de Viagem
  defaultDestination: GeoLocation;
  destinationAlias?: string;
  defaultPrice: number;
  defaultDepartureTime: string;
  defaultReturnTime?: string; // Horário típico de retorno
  // Filas de Gestão
  pendingJoinRequests?: GroupJoinRequest[];
  pendingInvitations?: GroupInvitation[];
}

export type TripSegmentType = 'ida_e_volta' | 'somente_ida' | 'somente_volta';

export interface SegmentChangeRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  requestedSegmentType: TripSegmentType;
  currentSegmentType: TripSegmentType;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PassengerParticipant {
  userId: string;
  userName: string;
  userAvatar: string;
  meetingPoint: GeoLocation;
  joinedAt: string;
  autoAccepted: boolean;
  institutionName?: string;
  agreedPrice?: number;
  segmentType?: TripSegmentType; // Trecho escolhido pelo passageiro (padrão: ida_e_volta)
  segmentChangePending?: TripSegmentType; // Novo trecho solicitado aguardando aprovação do motorista
}

export interface PendingRequest {
  userId: string;
  userName: string;
  userAvatar: string;
  meetingPoint: GeoLocation;
  requestedAt: string;
  institutionName?: string;
  distanceFromRouteMeters?: number;
  requestedSegmentType?: TripSegmentType;
}

export interface Waypoint {
  lat: number;
  lng: number;
  label: string;
  type: 'origin' | 'pickup' | 'destination';
  passengerName?: string;
  orderIndex: number;
}

export interface RideProposal {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  driverRating: number;
  driverVehicle?: Vehicle;
  offeredPrice: number;
  departureTime: string;
  departureDate: string;
  notes?: string;
  meetingPoint?: GeoLocation;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  fulfilledRideId?: string;
  mode?: 'existing_ride' | 'new_ride';
  existingRideTitle?: string;
  destinationDistanceKm?: number;
}

export interface Ride {
  id: string;
  rideType?: 'offer' | 'request'; // 'offer' = Carona Oferecida (Motorista) | 'request' = Pedido de Carona (Passageiro)
  description?: string; // Descrição da carona (primeiro campo da oferta)
  notes?: string; // Observação em geral (campo final)
  driverId: string;
  driverName: string;
  driverAvatar: string;
  driverVehicle?: Vehicle;
  origin: GeoLocation;
  destination: GeoLocation;
  destinationAlias?: string; // Nome da empresa ou faculdade exibido no campo destino dos cards
  departureTime: string; // ISO date string or HH:MM
  departureDate: string; // YYYY-MM-DD
  returnTime?: string; // Horário de retorno (opcional ou padrão da viagem)
  segmentType?: TripSegmentType; // Padrão: 'ida_e_volta', ou 'somente_ida', 'somente_volta'
  segmentChangeRequests?: SegmentChangeRequest[]; // Solicitações de alteração de trecho feitas por passageiros aguardando aprovação do motorista
  price: number;
  totalSeats: number;
  occupiedSeats: number;
  acceptedPassengers: PassengerParticipant[];
  pendingRequests: PendingRequest[];
  proposals?: RideProposal[];
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  visibility: 'public' | 'group';
  targetGroupId?: string;
  targetGroupName?: string;
  authorGroupIds?: string[];
  distanceKm: number;
  estimatedDurationMin: number;
  fuelCostEstimated: number;
  estimatedCarbonSavingKg: number;
  waypointsOrder: Waypoint[];
  startedAt?: string;
  completedAt?: string;
  requesterNote?: string;
  createdAt?: string;
}

export interface TrackingPoint {
  rideId: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  heading: number;
  progressPercent: number;
  nextStopLabel: string;
  etaMinutes: number;
  timestamp: string;
  currentStepIndex: number;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  rideId: string;
  amount: number; // +1 or -1 (viagens)
  valueBRL?: number; // Valor financeiro em R$ (ex: +19.50 ou -6.50)
  type: 'OFFERED_RIDE' | 'RECEIVED_RIDE' | 'BONUS_RECIPROCITY' | 'PIX_TRANSFER' | 'SETTLEMENT';
  category?: 'OFFER' | 'RIDE' | 'BONUS' | 'PIX' | 'REFUND';
  counterpartName?: string;
  counterpartId?: string;
  paymentMethod?: string;
  status?: 'COMPLETED' | 'PENDING' | 'SETTLED' | 'PENDING_CONFIRMATION' | 'REJECTED';
  initiatedBy?: 'passenger' | 'driver' | 'system';
  passengerId?: string;
  driverId?: string;
  settlementId?: string;
  description: string;
  timestamp: string;
}

export interface BilateralRideItem {
  id: string;
  rideId?: string;
  description: string;
  date: string;
  value: number;
  origin?: string;
  destination?: string;
}

export interface BilateralNettingRecord {
  user: User;
  driverRides: BilateralRideItem[];
  totalCreditsAsDriver: number;
  passengerRides: BilateralRideItem[];
  totalDebitsAsPassenger: number;
  pixPaidToUser: number;
  pixReceivedFromUser: number;
  pixTransactions: LedgerTransaction[];
  netDifference: number; // (+) to receive, (-) to pay, (0) settled
  absDifference: number;
  status: 'to_receive' | 'to_pay' | 'settled';
  hasMutualRides: boolean;
  hasPendingSettlement: boolean;
  pendingTx?: LedgerTransaction;
}

export interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'NEW_RIDE_GROUP' | 'DRIVER_STARTED' | 'RIDE_ACCEPTED' | 'RIDE_COMPLETED' | 'NEW_REQUEST' | 'PROPOSAL_RECEIVED' | 'PROPOSAL_ACCEPTED' | 'PROPOSAL_REJECTED' | 'SETTLEMENT_REQUEST' | 'SETTLEMENT_CONFIRMED' | 'SETTLEMENT_REJECTED' | 'SYSTEM_ANNOUNCEMENT' | 'RIDE_CANCELLED' | 'PASSENGER_REMOVED' | 'EMAIL_DELIVERY_FAILED';
  timestamp: string;
  read: boolean;
  rideId?: string;
  settlementId?: string;
  counterpartId?: string;
  failedEmail?: string;
  failureReason?: string;
}

export interface GeminiRoutineSuggestion {
  title: string;
  description: string;
  suggestedGroupId?: string;
  suggestedGroupName?: string;
  driverId: string;
  passengerIds: string[];
  commonOriginZone: string;
  commonDestinationZone: string;
  estimatedWeeklySavingsBRL: number;
  estimatedMonthlyCo2Kg: number;
  matchScore: number;
  reasoning: string;
}

export interface SecurityRuleTestScenario {
  id: string;
  name: string;
  description: string;
  actor: { userId: string; email: string; groups: string[] };
  resource: 'rides' | 'groups' | 'tracking' | 'users';
  action: 'read' | 'create' | 'update' | 'delete';
  targetDoc: Record<string, any>;
  expectedResult: 'ALLOW' | 'DENY';
  ruleMatched: string;
  explanation: string;
}
