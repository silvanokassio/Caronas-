import { User, Group, Community, Ride, LedgerTransaction, PushNotification, SecurityRuleTestScenario } from '../types';

export const INITIAL_COMMUNITIES: Community[] = [];

export const INITIAL_GROUPS: Group[] = [];

export const INITIAL_USERS: User[] = [];

export const INITIAL_RIDES: Ride[] = [];

export const INITIAL_LEDGER: LedgerTransaction[] = [];

export const INITIAL_NOTIFICATIONS: PushNotification[] = [];

export const SECURITY_RULES_CODE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Funções Auxiliares de Autenticação e Autorização
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isSuperUser() {
      return isAuthenticated() && 
        (request.auth.token.email == 'silvano.kassio@gmail.com' || request.auth.uid == 'usr-silvano-superadmin');
    }
    
    function isOwner(userId) {
      return isAuthenticated() && (request.auth.uid == userId || isSuperUser());
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isGroupMember(groupId) {
      return isSuperUser() || (isAuthenticated() && groupId in getUserData().groups);
    }
    
    function isRideDriver(rideData) {
      return isSuperUser() || (isAuthenticated() && request.auth.uid == rideData.driverId);
    }
    
    function isAcceptedPassenger(rideData) {
      return isSuperUser() || (isAuthenticated() && 
        request.auth.uid in rideData.acceptedPassengers.map(p => p.userId));
    }

    // ==========================================
    // 1. Coleção: users
    // ==========================================
    match /users/{userId} {
      // Qualquer usuário autenticado ou superusuário pode ler perfis para matching
      allow read: if isAuthenticated() || isSuperUser();
      
      // Criação e edição pelo proprietário ou superusuário
      allow create: if (isOwner(userId) && request.resource.data.saldo_caronas == 0) || isSuperUser();
      
      allow update: if isOwner(userId)
        && (isSuperUser() || request.resource.data.saldo_caronas == resource.data.saldo_caronas);
    }

    // ==========================================
    // 2. Coleção: groups
    // ==========================================
    match /groups/{groupId} {
      allow read: if true; // Leitura pública/autenticada para descoberta de comunidades
      
      allow create: if isAuthenticated() 
        && (isSuperUser() || request.resource.data.memberIds.hasAny([request.auth.uid]));
        
      allow update: if isGroupMember(groupId) || isSuperUser();
    }

    // ==========================================
    // 3. Coleção: rides
    // ==========================================
    match /rides/{rideId} {
      // REQUISITO: Ofertas públicas podem ser pesquisadas por acessos não logados (visitantes).
      // Caronas restritas a grupos exigem autenticação e associação, ou privilégio de superusuário.
      allow read: if isSuperUser() || (
        resource.data.visibility == 'public' ||
        (isAuthenticated() && resource.data.visibility == 'group' && isGroupMember(resource.data.targetGroupId)) ||
        (isAuthenticated() && isRideDriver(resource.data))
      );

      // Apenas motoristas autenticados ou superusuário podem criar caronas
      allow create: if isSuperUser() || (
        isAuthenticated()
        && request.resource.data.driverId == request.auth.uid
        && request.resource.data.departureTime >= request.time
        && request.resource.data.totalSeats > 0
        && request.resource.data.occupiedSeats == 0
      );

      // Motorista/Superusuário atualiza status, ou passageiro autenticado solicita vaga
      allow update: if isSuperUser() || (
        isAuthenticated() && (
          isRideDriver(resource.data) ||
          (
            resource.data.status == 'agendada' &&
            resource.data.occupiedSeats < resource.data.totalSeats &&
            resource.data.departureTime >= request.time
          )
        )
      );

      allow delete: if isSuperUser() || (
        isAuthenticated() && isRideDriver(resource.data) && resource.data.status != 'em_andamento'
      );

      // ==========================================
      // 4. Subcoleção: tracking (Geolocalização em Tempo Real)
      // ==========================================
      match /tracking/{trackingId} {
        allow read: if isSuperUser() || (
          isAuthenticated() && (
            isRideDriver(get(/databases/$(database)/documents/rides/$(rideId)).data) ||
            isAcceptedPassenger(get(/databases/$(database)/documents/rides/$(rideId)).data)
          )
        );

        allow create, update, delete: if isSuperUser() || (
          isAuthenticated() && 
          isRideDriver(get(/databases/$(database)/documents/rides/$(rideId)).data)
        );
      }
    }

    // ==========================================
    // 5. Coleção: ledger_transactions (Gamificação)
    // ==========================================
    match /ledger_transactions/{txId} {
      allow read: if isSuperUser() || (isAuthenticated() && resource.data.userId == request.auth.uid);
      allow write: if isSuperUser(); 
    }
  }
}`;

export const SAMPLE_SECURITY_TESTS: SecurityRuleTestScenario[] = [
  {
    id: 'test-01',
    name: 'Membro do Grupo lendo Carona Restrita',
    description: 'Beatriz (membro do grupo USP / Poli) tenta ler carona privada do grupo.',
    actor: { userId: 'usr-beatriz-pass', email: 'beatriz@usp.br', groups: ['grp-poli-usp'] },
    resource: 'rides',
    action: 'read',
    targetDoc: { visibility: 'group', targetGroupId: 'grp-poli-usp', driverId: 'usr-carlos-mot' },
    expectedResult: 'ALLOW',
    ruleMatched: "resource.data.visibility == 'group' && isGroupMember(resource.data.targetGroupId)",
    explanation: 'Acesso PERMITIDO: Beatriz possui "grp-poli-usp" em seus grupos cadastrados.',
  },
  {
    id: 'test-02',
    name: 'Usuário Externo tentando ler Carona Restrita de Grupo',
    description: 'Lucas (sem o grupo USP) tenta ler carona restrita da Poli.',
    actor: { userId: 'usr-lucas-pass', email: 'lucas@externo.com', groups: [] },
    resource: 'rides',
    action: 'read',
    targetDoc: { visibility: 'group', targetGroupId: 'grp-poli-usp', driverId: 'usr-carlos-mot' },
    expectedResult: 'DENY',
    ruleMatched: "!(isGroupMember(resource.data.targetGroupId))",
    explanation: 'Acesso BLOQUEADO: Usuário não pertence ao grupo restrito da oferta.',
  },
  {
    id: 'test-03',
    name: 'Passageiro Aceito visualizando Tracking GPS',
    description: 'Beatriz (aceita na carona) acessa subcoleção /rides/{id}/tracking.',
    actor: { userId: 'usr-beatriz-pass', email: 'beatriz@usp.br', groups: ['grp-poli-usp'] },
    resource: 'tracking',
    action: 'read',
    targetDoc: { rideDriverId: 'usr-carlos-mot', acceptedPassengerIds: ['usr-beatriz-pass'] },
    expectedResult: 'ALLOW',
    ruleMatched: 'isAcceptedPassenger(get(...).data)',
    explanation: 'Acesso PERMITIDO: Beatriz consta na lista de passageiros aceitos da carona.',
  },
  {
    id: 'test-04',
    name: 'Passageiro NÃO Aceito tentando espionar Tracking GPS',
    description: 'Lucas (solicitação ainda pendente ou não aceito) tenta ver coordenadas ao vivo.',
    actor: { userId: 'usr-lucas-pass', email: 'lucas@externo.com', groups: [] },
    resource: 'tracking',
    action: 'read',
    targetDoc: { rideDriverId: 'usr-carlos-mot', acceptedPassengerIds: ['usr-beatriz-pass'] },
    expectedResult: 'DENY',
    ruleMatched: '!isAcceptedPassenger() && !isRideDriver()',
    explanation: 'Acesso BLOQUEADO: Trava de privacidade impede acesso a coordenadas por não-integrantes.',
  },
  {
    id: 'test-05',
    name: 'Tentativa de burlar vagas em Carona Lotada',
    description: 'Tentativa de ingresso em carona que já atingiu o limite de vagas (occupiedSeats == totalSeats).',
    actor: { userId: 'usr-lucas-pass', email: 'lucas@externo.com', groups: [] },
    resource: 'rides',
    action: 'update',
    targetDoc: { totalSeats: 3, occupiedSeats: 3, status: 'agendada' },
    expectedResult: 'DENY',
    ruleMatched: 'resource.data.occupiedSeats < resource.data.totalSeats',
    explanation: 'Acesso BLOQUEADO: Trava de segurança rejeita atualizações de adesão para caronas lotadas.',
  },
];
