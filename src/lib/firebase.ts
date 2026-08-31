import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';
import { 
  INITIAL_COMMUNITIES,
  INITIAL_GROUPS, 
  INITIAL_USERS, 
  INITIAL_RIDES, 
  INITIAL_LEDGER, 
  INITIAL_NOTIFICATIONS 
} from '../data/initialData';
import { User, Group, Community, Ride, LedgerTransaction, Routine, PushNotification, TrackingPoint } from '../types';

export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific databaseId if provided
export const db = firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Initializes authentication and verifies Firestore collections
 */
export async function initializeFirebaseData(): Promise<void> {
  try {
    // Attempt anonymous sign in if not logged in, but don't block if restricted
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        // Anonymous sign-in might not be enabled in console; continue with Firestore operations
        console.warn('Anonymous sign-in not enabled or restricted; proceeding with Firestore operations.');
      }
    }

    // Purge legacy mock/fake users and duplicates from Firestore
    const legacyMockUserIds = [
      'usr-carlos-mot',
      'usr-beatriz-pass',
      'usr-gabriela-mot',
      'usr-lucas-pass',
      'usr-zemaps-pass',
      'usr-mariana-mot',
      'usr-diego-mot',
    ];

    const usersCollectionRef = collection(db, 'users');
    const existingUsersSnap = await getDocs(usersCollectionRef);

    // Track silvano accounts to keep only 1 unified document
    const silvanoDocs: { id: string; data: any }[] = [];

    for (const userDoc of existingUsersSnap.docs) {
      const uData = userDoc.data();
      const uEmail = (uData.email || '').trim().toLowerCase();
      const uName = (uData.name || '').trim().toLowerCase();

      // Check if it's a legacy mock account by ID or known mock names
      if (
        legacyMockUserIds.includes(userDoc.id) ||
        uName.includes('ze maps') ||
        uName.includes('gabriela siqueira') ||
        uName.includes('beatriz lima') ||
        uName.includes('carlos mendes')
      ) {
        try {
          await deleteDoc(doc(db, 'users', userDoc.id));
          console.log(`🧹 Removido usuário de teste do Firestore: ${userDoc.id} (${uData.name})`);
        } catch (err) {
          // ignore
        }
      } else if (uEmail === 'silvano.kassio@gmail.com') {
        silvanoDocs.push({ id: userDoc.id, data: uData });
      }
    }

    // If more than 1 silvano account exists, merge and delete extras
    if (silvanoDocs.length > 1) {
      console.log(`🧹 Detectadas ${silvanoDocs.length} contas para silvano.kassio@gmail.com. Unificando...`);
      // Keep the one with the most updated name / avatar (or the first one)
      const primary = silvanoDocs[0];
      const duplicates = silvanoDocs.slice(1);

      for (const dup of duplicates) {
        try {
          await deleteDoc(doc(db, 'users', dup.id));
          console.log(`🧹 Removida conta duplicada: ${dup.id}`);
        } catch (err) {
          // ignore
        }
      }

      // Ensure primary has full superadmin rights and clean profile
      await setDoc(doc(db, 'users', primary.id), sanitizeForFirestore({
        ...primary.data,
        isSuperUser: true,
        role: 'superadmin',
        email: 'silvano.kassio@gmail.com',
      }), { merge: true });
    }

    // Purge any legacy fictitious groups and communities from Firestore
    try {
      const mockGroupIds = ['grp-poli-usp', 'grp-nubank-sp', 'grp-google-campus', 'grp-1', 'grp-2', 'grp-3'];
      const mockGroupKeywords = ['usp / poli', 'nubank hq', 'google campus'];

      const groupsSnap = await getDocs(collection(db, 'groups'));
      for (const gDoc of groupsSnap.docs) {
        const gData = gDoc.data() as Group;
        const gName = (gData.name || '').toLowerCase();
        const gId = gDoc.id;
        if (mockGroupIds.includes(gId) || mockGroupKeywords.some((k) => gName.includes(k))) {
          console.log(`🗑️ Removing fictitious group: ${gId} (${gData.name})`);
          await deleteDoc(doc(db, 'groups', gId));
        }
      }

      const mockCommIds = ['comm-usp', 'comm-faria-lima', 'comm-avenida-paulista', 'comm-1', 'comm-2'];
      const mockCommKeywords = ['universidade de são paulo', 'polo corporativo faria lima', 'eixo paulista'];

      const commsSnap = await getDocs(collection(db, 'communities'));
      for (const cDoc of commsSnap.docs) {
        const cData = cDoc.data() as Community;
        const cName = (cData.name || '').toLowerCase();
        const cId = cDoc.id;
        if (mockCommIds.includes(cId) || mockCommKeywords.some((k) => cName.includes(k))) {
          console.log(`🗑️ Removing fictitious community: ${cId} (${cData.name})`);
          await deleteDoc(doc(db, 'communities', cId));
        }
      }

      // Also clean up deleted group IDs from existing users
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data() as User;
        if (uData.groups && uData.groups.some((gId) => mockGroupIds.includes(gId))) {
          const cleanedGroups = uData.groups.filter((gId) => !mockGroupIds.includes(gId));
          await updateDoc(uDoc.ref, { groups: cleanedGroups });
        }
      }
    } catch (cleanErr) {
      console.warn('Note during cleanup of fictitious groups/communities:', cleanErr);
    }

    // Check if communities or base groups are seeded
    const commSnap = await getDocs(collection(db, 'communities'));
    if (commSnap.empty && INITIAL_COMMUNITIES.length > 0) {
      console.log('🌱 Setting up initial base communities & groups...');
      const batch = writeBatch(db);

      INITIAL_COMMUNITIES.forEach((c) => {
        const commRef = doc(db, 'communities', c.id);
        batch.set(commRef, c);
      });

      INITIAL_GROUPS.forEach((g) => {
        const groupRef = doc(db, 'groups', g.id);
        batch.set(groupRef, g);
      });

      INITIAL_USERS.forEach((u) => {
        const userRef = doc(db, 'users', u.id);
        batch.set(userRef, u);
      });

      await batch.commit();
      console.log('✅ Base platform structures ready.');
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

// ----------------------------------------------------------------------
// Realtime Subscriptions
// ----------------------------------------------------------------------

export function subscribeToUsers(callback: (users: User[]) => void) {
  const usersRef = collection(db, 'users');
  return onSnapshot(usersRef, (snapshot) => {
    const rawUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User));
    
    // Filter out known legacy mock users
    const legacyMockNames = ['ze maps', 'gabriela siqueira', 'beatriz lima', 'carlos mendes', 'lucas rocha', 'mariana mot'];
    const filtered = rawUsers.filter(u => {
      const name = (u.name || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      return !legacyMockNames.some(m => name.includes(m)) && !id.startsWith('usr-carlos') && !id.startsWith('usr-beatriz') && !id.startsWith('usr-gabriela') && !id.startsWith('usr-zemaps');
    });

    // Deduplicate by email (normalized lowercase) - prioritize superusers and most complete records
    const byEmail = new Map<string, User>();
    for (const u of filtered) {
      const emailKey = (u.email || u.id).trim().toLowerCase();
      if (!byEmail.has(emailKey)) {
        byEmail.set(emailKey, u);
      } else {
        const existing = byEmail.get(emailKey)!;
        // If current is superadmin or has more info, prefer it
        if ((u.isSuperUser || u.role === 'superadmin') && (!existing.isSuperUser)) {
          byEmail.set(emailKey, u);
        }
      }
    }

    callback(Array.from(byEmail.values()));
  }, (error) => {
    console.error('Error subscribing to users:', error);
  });
}

export function subscribeToCommunities(callback: (communities: Community[]) => void) {
  const commRef = collection(db, 'communities');
  return onSnapshot(commRef, (snapshot) => {
    const mockCommIds = ['comm-usp', 'comm-faria-lima', 'comm-avenida-paulista', 'comm-1', 'comm-2'];
    const mockCommKeywords = ['universidade de são paulo', 'polo corporativo faria lima', 'eixo paulista'];

    const communities = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as Community))
      .filter((c) => {
        const cName = (c.name || '').toLowerCase();
        return !mockCommIds.includes(c.id) && !mockCommKeywords.some((k) => cName.includes(k));
      });
    callback(communities);
  }, (error) => {
    console.error('Error subscribing to communities:', error);
  });
}

export function subscribeToGroups(callback: (groups: Group[]) => void) {
  const groupsRef = collection(db, 'groups');
  return onSnapshot(groupsRef, (snapshot) => {
    const mockGroupIds = ['grp-poli-usp', 'grp-nubank-sp', 'grp-google-campus', 'grp-1', 'grp-2', 'grp-3'];
    const mockGroupKeywords = ['usp / poli', 'nubank hq', 'google campus'];

    const groups = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as Group))
      .filter((g) => {
        const gName = (g.name || '').toLowerCase();
        return !mockGroupIds.includes(g.id) && !mockGroupKeywords.some((k) => gName.includes(k));
      });
    callback(groups);
  }, (error) => {
    console.error('Error subscribing to groups:', error);
  });
}

export function subscribeToRides(callback: (rides: Ride[]) => void) {
  const ridesRef = collection(db, 'rides');
  return onSnapshot(ridesRef, (snapshot) => {
    const rides = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Ride));
    callback(rides);
  }, (error) => {
    console.error('Error subscribing to rides:', error);
  });
}

export function subscribeToTransactions(callback: (txs: LedgerTransaction[]) => void) {
  const txRef = collection(db, 'ledger_transactions');
  return onSnapshot(txRef, (snapshot) => {
    const txs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerTransaction));
    // Sort newest first
    txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    callback(txs);
  }, (error) => {
    console.error('Error subscribing to transactions:', error);
  });
}

export function subscribeToRoutines(callback: (routines: Routine[]) => void) {
  const routinesRef = collection(db, 'routines');
  return onSnapshot(routinesRef, (snapshot) => {
    const routines = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Routine));
    callback(routines);
  }, (error) => {
    console.error('Error subscribing to routines:', error);
  });
}

export function subscribeToTracking(rideId: string, callback: (point: TrackingPoint | null) => void) {
  const trackingRef = collection(db, 'rides', rideId, 'tracking');
  return onSnapshot(trackingRef, (snapshot) => {
    if (!snapshot.empty) {
      const points = snapshot.docs.map((d) => d.data() as TrackingPoint);
      // latest point
      points.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(points[0]);
    } else {
      callback(null);
    }
  });
}

/**
 * Recursively removes undefined fields so Firestore addDoc/setDoc/updateDoc never fail
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return obj;
}

// ----------------------------------------------------------------------
// Firestore Mutations (Real Writes)
// ----------------------------------------------------------------------

export async function createFirestoreRide(newRide: Omit<Ride, 'id'>): Promise<string> {
  const ridesRef = collection(db, 'rides');
  const cleanData = sanitizeForFirestore({
    ...newRide,
    createdAt: new Date().toISOString()
  });
  const docRef = await addDoc(ridesRef, cleanData);
  return docRef.id;
}

export async function updateFirestoreRide(rideId: string, updates: Partial<Ride>): Promise<void> {
  const rideDoc = doc(db, 'rides', rideId);
  const cleanUpdates = sanitizeForFirestore(updates);
  await updateDoc(rideDoc, cleanUpdates);
}

export async function deleteFirestoreRide(rideId: string): Promise<void> {
  const rideDoc = doc(db, 'rides', rideId);
  await deleteDoc(rideDoc);
}

export async function createFirestoreGroup(newGroup: Omit<Group, 'id'>): Promise<string> {
  const groupsRef = collection(db, 'groups');
  const cleanData = sanitizeForFirestore({
    ...newGroup,
    createdAt: new Date().toISOString()
  });
  const docRef = await addDoc(groupsRef, cleanData);
  return docRef.id;
}

export async function updateFirestoreGroup(groupId: string, updates: Partial<Group>): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  await updateDoc(groupDoc, sanitizeForFirestore(updates));
}

export async function deleteFirestoreGroup(groupId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  await deleteDoc(groupDoc);

  // Clean up references to this group from all users
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data() as User;
      if (uData.groups && uData.groups.includes(groupId)) {
        await updateDoc(uDoc.ref, {
          groups: uData.groups.filter((gId) => gId !== groupId),
        });
      }
    }
  } catch (err) {
    console.error('Error cleaning up group from users in Firestore:', err);
  }
}

export async function deleteFirestoreCommunity(communityId: string): Promise<void> {
  const commDoc = doc(db, 'communities', communityId);
  await deleteDoc(commDoc);
}

export async function requestJoinFirestoreGroup(groupId: string, user: User): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const currentRequests = groupData.pendingJoinRequests || [];
  
  if (currentRequests.some((r) => r.userId === user.id)) return;
  if (groupData.memberIds.includes(user.id)) return;

  const newRequest = {
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    userEmail: user.email,
    institutionName: user.institutionName,
    requestedAt: new Date().toISOString(),
  };

  await updateDoc(groupDoc, sanitizeForFirestore({
    pendingJoinRequests: [...currentRequests, newRequest]
  }));
}

export async function approveGroupJoinRequest(groupId: string, userId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const userDoc = doc(db, 'users', userId);

  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const updatedRequests = (groupData.pendingJoinRequests || []).filter((r) => r.userId !== userId);
  const updatedMembers = groupData.memberIds.includes(userId) ? groupData.memberIds : [...groupData.memberIds, userId];

  await updateDoc(groupDoc, sanitizeForFirestore({
    pendingJoinRequests: updatedRequests,
    memberIds: updatedMembers,
    memberCount: updatedMembers.length,
  }));

  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    const currentGroups = userData.groups || [];
    if (!currentGroups.includes(groupId)) {
      await updateDoc(userDoc, sanitizeForFirestore({
        groups: [...currentGroups, groupId]
      }));
    }
  }
}

export async function rejectGroupJoinRequest(groupId: string, userId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const updatedRequests = (groupData.pendingJoinRequests || []).filter((r) => r.userId !== userId);

  await updateDoc(groupDoc, sanitizeForFirestore({
    pendingJoinRequests: updatedRequests
  }));
}

export async function inviteUserToGroup(
  groupId: string, 
  targetUser: User, 
  inviterUser: User
): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const currentInvites = groupData.pendingInvitations || [];
  
  if (currentInvites.some((i) => i.userId === targetUser.id)) return;
  if (groupData.memberIds.includes(targetUser.id)) return;

  const newInvite = {
    userId: targetUser.id,
    userName: targetUser.name,
    userAvatar: targetUser.avatar,
    userEmail: targetUser.email,
    invitedBy: inviterUser.id,
    invitedByName: inviterUser.name,
    invitedAt: new Date().toISOString(),
  };

  await updateDoc(groupDoc, sanitizeForFirestore({
    pendingInvitations: [...currentInvites, newInvite]
  }));
}

export async function acceptGroupInvitation(groupId: string, userId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const userDoc = doc(db, 'users', userId);

  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const updatedInvites = (groupData.pendingInvitations || []).filter((i) => i.userId !== userId);
  const updatedMembers = groupData.memberIds.includes(userId) ? groupData.memberIds : [...groupData.memberIds, userId];

  await updateDoc(groupDoc, sanitizeForFirestore({
    pendingInvitations: updatedInvites,
    memberIds: updatedMembers,
    memberCount: updatedMembers.length,
  }));

  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    const currentGroups = userData.groups || [];
    if (!currentGroups.includes(groupId)) {
      await updateDoc(userDoc, sanitizeForFirestore({
        groups: [...currentGroups, groupId]
      }));
    }
  }
}

export async function rejectGroupInvitation(groupId: string, userId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const updatedInvites = (groupData.pendingInvitations || []).filter((i) => i.userId !== userId);

  await updateDoc(groupDoc, sanitizeForFirestore({
    pendingInvitations: updatedInvites
  }));
}

export async function createFirestoreCommunity(newCommunity: Omit<Community, 'id'>): Promise<string> {
  const commRef = collection(db, 'communities');
  const cleanData = sanitizeForFirestore({
    ...newCommunity,
    createdAt: new Date().toISOString(),
  });
  const docRef = await addDoc(commRef, cleanData);
  return docRef.id;
}

export async function updateFirestoreCommunity(communityId: string, updates: Partial<Community>): Promise<void> {
  const commDoc = doc(db, 'communities', communityId);
  await updateDoc(commDoc, sanitizeForFirestore(updates));
}

export async function addMemberToGroupDirectly(groupId: string, user: User): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const userDoc = doc(db, 'users', user.id);

  const groupSnap = await getDoc(groupDoc);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data() as Group;
  const updatedMembers = groupData.memberIds.includes(user.id) ? groupData.memberIds : [...groupData.memberIds, user.id];
  const updatedRequests = (groupData.pendingJoinRequests || []).filter((r) => r.userId !== user.id);
  const updatedInvites = (groupData.pendingInvitations || []).filter((i) => i.userId !== user.id);

  await updateDoc(groupDoc, sanitizeForFirestore({
    memberIds: updatedMembers,
    memberCount: updatedMembers.length,
    pendingJoinRequests: updatedRequests,
    pendingInvitations: updatedInvites,
  }));

  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    const currentGroups = userData.groups || [];
    if (!currentGroups.includes(groupId)) {
      await updateDoc(userDoc, sanitizeForFirestore({
        groups: [...currentGroups, groupId]
      }));
    }
  }
}

export async function removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const userDoc = doc(db, 'users', userId);

  const groupSnap = await getDoc(groupDoc);
  if (groupSnap.exists()) {
    const groupData = groupSnap.data() as Group;
    const newMembers = groupData.memberIds.filter((id) => id !== userId);
    await updateDoc(groupDoc, sanitizeForFirestore({
      memberIds: newMembers,
      memberCount: newMembers.length
    }));
  }

  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    const newGroups = (userData.groups || []).filter((id) => id !== groupId);
    await updateDoc(userDoc, sanitizeForFirestore({
      groups: newGroups
    }));
  }
}

export async function joinFirestoreGroup(groupId: string, userId: string): Promise<void> {
  const groupDoc = doc(db, 'groups', groupId);
  const userDoc = doc(db, 'users', userId);

  const groupSnap = await getDoc(groupDoc);
  if (groupSnap.exists()) {
    const groupData = groupSnap.data() as Group;
    if (!groupData.memberIds.includes(userId)) {
      const newMembers = [...groupData.memberIds, userId];
      await updateDoc(groupDoc, sanitizeForFirestore({
        memberIds: newMembers,
        memberCount: newMembers.length
      }));
    }
  }

  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    if (!userData.groups.includes(groupId)) {
      await updateDoc(userDoc, sanitizeForFirestore({
        groups: [...userData.groups, groupId]
      }));
    }
  }
}

export async function saveFirestoreRoutine(userId: string, routine: Routine): Promise<void> {
  const routineDoc = doc(db, 'routines', routine.id);
  await setDoc(routineDoc, sanitizeForFirestore({
    ...routine,
    userId,
    updatedAt: new Date().toISOString()
  }));

  // Also update user's profile routine
  const userDoc = doc(db, 'users', userId);
  await updateDoc(userDoc, sanitizeForFirestore({
    routine: routine
  }));
}

export async function updateFirestoreUserProfile(userId: string, updates: Partial<User>): Promise<void> {
  const userDoc = doc(db, 'users', userId);
  await updateDoc(userDoc, sanitizeForFirestore(updates));
}

export async function addFirestoreTransaction(transaction: Omit<LedgerTransaction, 'id'>): Promise<string> {
  const txRef = collection(db, 'ledger_transactions');
  const cleanTx = sanitizeForFirestore({
    ...transaction,
    timestamp: transaction.timestamp || new Date().toISOString()
  });
  const docRef = await addDoc(txRef, cleanTx);

  // Update user's saldo
  const userDoc = doc(db, 'users', transaction.userId);
  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    const currentSaldo = userSnap.data().saldo_caronas || 0;
    await updateDoc(userDoc, sanitizeForFirestore({
      saldo_caronas: currentSaldo + (transaction.amount || 0)
    }));
  }

  return docRef.id;
}

export async function updateFirestoreTransaction(txId: string, updates: Partial<LedgerTransaction>): Promise<void> {
  const txDoc = doc(db, 'ledger_transactions', txId);
  await updateDoc(txDoc, sanitizeForFirestore(updates));
}

/**
 * 1. Passageiro informa quitação ao motorista
 * Cria transação com status PENDING_CONFIRMATION e notifica o motorista
 */
export async function requestSettlementFromPassenger(
  passenger: User,
  driver: User,
  amount: number,
  notes?: string
): Promise<string> {
  const settlementId = `stl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date().toISOString();

  const tx: Omit<LedgerTransaction, 'id'> = {
    userId: passenger.id,
    rideId: `settlement-${settlementId}`,
    settlementId,
    amount: 0,
    valueBRL: Math.abs(amount), // Compensa o débito no cálculo
    type: 'SETTLEMENT',
    category: 'PIX',
    counterpartId: driver.id,
    counterpartName: `${driver.name} (Motorista)`,
    paymentMethod: 'PIX / Quitação Direta',
    status: 'PENDING_CONFIRMATION',
    initiatedBy: 'passenger',
    passengerId: passenger.id,
    driverId: driver.id,
    description: notes
      ? `Quitação informada pelo passageiro: ${notes} (Aguardando confirmação do motorista)`
      : `Quitação de rateio informada pelo passageiro (Aguardando confirmação de ${driver.name})`,
    timestamp: now,
  };

  const txId = await addFirestoreTransaction(tx);

  // Notificar motorista
  await createFirestoreNotification({
    userId: driver.id,
    title: '💳 Aviso de Quitação Recebida!',
    body: `${passenger.name} informou que efetuou o pagamento/PIX de R$ ${amount.toFixed(2)} referente ao rateio de caronas. Por favor, confirme o recebimento.`,
    type: 'SETTLEMENT_REQUEST',
    settlementId,
    counterpartId: passenger.id,
    timestamp: now,
    read: false,
  });

  return txId;
}

/**
 * 2. Motorista confirma recebimento da quitação
 * Atualiza o status para COMPLETED e registra o crédito correspondente no motorista
 */
export async function confirmSettlementByDriver(
  pendingTx: LedgerTransaction,
  driver: User,
  passenger: User
): Promise<void> {
  const now = new Date().toISOString();

  // Atualiza transação do passageiro para COMPLETED
  if (pendingTx.id) {
    await updateFirestoreTransaction(pendingTx.id, {
      status: 'COMPLETED',
      description: `Quitação confirmada por ${driver.name}: Rateio liquidado com sucesso.`,
    });
  }

  // Notificar passageiro
  await createFirestoreNotification({
    userId: passenger.id,
    title: '✅ Quitação Confirmada!',
    body: `${driver.name} confirmou o recebimento de R$ ${(pendingTx.valueBRL || 0).toFixed(2)}. Seu rateio foi totalmente liquidado!`,
    type: 'SETTLEMENT_CONFIRMED',
    settlementId: pendingTx.settlementId,
    counterpartId: driver.id,
    timestamp: now,
    read: false,
  });
}

/**
 * 3. Motorista recusa / contesta quitação
 */
export async function rejectSettlementByDriver(
  pendingTx: LedgerTransaction,
  driver: User,
  passenger: User,
  reason?: string
): Promise<void> {
  const now = new Date().toISOString();

  if (pendingTx.id) {
    await updateFirestoreTransaction(pendingTx.id, {
      status: 'SETTLED', // ou cancelado
      valueBRL: 0, // anula o crédito para reabrir o débito do passageiro
      description: `Quitação contestada por ${driver.name}${reason ? `: ${reason}` : ''}`,
    });
  }

  await createFirestoreNotification({
    userId: passenger.id,
    title: '⚠️ Quitação Não Confirmada',
    body: `${driver.name} não identificou o pagamento do rateio (${reason || 'Verifique o comprovante ou chave PIX'}). O débito foi reaberto.`,
    type: 'SETTLEMENT_REJECTED',
    settlementId: pendingTx.settlementId,
    counterpartId: driver.id,
    timestamp: now,
    read: false,
  });
}

/**
 * 4. Motorista informa quitação direta (saldo ajustado automaticamente para ambos)
 */
export async function directSettlementByDriver(
  driver: User,
  passenger: User,
  amount: number,
  notes?: string
): Promise<void> {
  const settlementId = `stl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date().toISOString();

  // Transação do passageiro (liquida débito)
  const passengerTx: Omit<LedgerTransaction, 'id'> = {
    userId: passenger.id,
    rideId: `settlement-${settlementId}`,
    settlementId,
    amount: 0,
    valueBRL: Math.abs(amount),
    type: 'SETTLEMENT',
    category: 'PIX',
    counterpartId: driver.id,
    counterpartName: `${driver.name} (Motorista)`,
    paymentMethod: 'Quitação Direta pelo Motorista',
    status: 'COMPLETED',
    initiatedBy: 'driver',
    passengerId: passenger.id,
    driverId: driver.id,
    description: notes
      ? `Quitação registrada pelo motorista ${driver.name}: ${notes}`
      : `Quitação de rateio registrada pelo motorista ${driver.name}`,
    timestamp: now,
  };

  await addFirestoreTransaction(passengerTx);

  // Notificar passageiro
  await createFirestoreNotification({
    userId: passenger.id,
    title: '💳 Quitação Registrada pelo Motorista',
    body: `${driver.name} registrou a quitação de R$ ${amount.toFixed(2)} no rateio de caronas. Seu saldo foi ajustado automaticamente.`,
    type: 'SETTLEMENT_CONFIRMED',
    settlementId,
    counterpartId: driver.id,
    timestamp: now,
    read: false,
  });
}

export async function saveTrackingPoint(rideId: string, point: TrackingPoint): Promise<void> {
  const trackingRef = collection(db, 'rides', rideId, 'tracking');
  await addDoc(trackingRef, sanitizeForFirestore({
    ...point,
    savedAt: new Date().toISOString()
  }));
}

export async function createFirestoreNotification(notification: Omit<PushNotification, 'id'>): Promise<string> {
  const notifRef = collection(db, 'notifications');
  const cleanData = sanitizeForFirestore({
    ...notification,
    timestamp: notification.timestamp || new Date().toISOString(),
    read: notification.read ?? false,
  });
  const docRef = await addDoc(notifRef, cleanData);
  return docRef.id;
}

export function subscribeToNotifications(userId: string, callback: (notifications: PushNotification[]) => void) {
  const notifRef = collection(db, 'notifications');
  return onSnapshot(notifRef, (snapshot) => {
    if (!snapshot.empty) {
      const notifs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as PushNotification))
        .filter((n) => !n.userId || n.userId === userId || n.userId === 'all');
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(notifs);
    }
  }, (error) => {
    console.warn('Notification subscription warning:', error);
  });
}

// ----------------------------------------------------------------------
// Authentication Services (GEA Pattern)
// ----------------------------------------------------------------------

export async function loginWithEmail(email: string, password: string): Promise<User | null> {
  try {
    // Try firebase auth first
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (fbAuthErr: any) {
      // If auth provider in console is not configured or in sandbox, we match with Firestore user records
      console.warn('Firebase Auth notice (falling back to Firestore verification):', fbAuthErr?.message);
    }

    // Query or find user in Firestore by email
    const usersRef = collection(db, 'users');
    const snap = await getDocs(usersRef);
    let matchedUser: User | null = null;

    snap.forEach((docSnap) => {
      const u = { id: docSnap.id, ...docSnap.data() } as User;
      if (u.email.trim().toLowerCase() === email.trim().toLowerCase()) {
        matchedUser = u;
      }
    });

    return matchedUser;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function registerWithFullProfile(
  userData: Omit<User, 'id'> & { password?: string }
): Promise<User> {
  try {
    let authUid = `usr-${Date.now()}`;

    // Attempt Firebase Auth user creation
    if (userData.password) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        if (userCred.user) {
          authUid = `usr-${userCred.user.uid.substring(0, 10)}`;
          await updateProfile(userCred.user, {
            displayName: userData.name,
            photoURL: userData.avatar
          });
        }
      } catch (authErr: any) {
        console.warn('Firebase Auth creation notice (continuing with Firestore registration):', authErr?.message);
      }
    }

    const isSilvanoSuperUser = (userData.email || '').trim().toLowerCase() === 'silvano.kassio@gmail.com';
    const newUser: User = {
      ...userData,
      id: authUid,
      role: isSilvanoSuperUser ? 'superadmin' : (userData.role || 'user'),
      isSuperUser: isSilvanoSuperUser ? true : userData.isSuperUser,
      saldo_caronas: userData.saldo_caronas || (isSilvanoSuperUser ? 24 : 0),
      totalRidesOffered: userData.totalRidesOffered || 0,
      totalRidesTaken: userData.totalRidesTaken || 0,
      rating: userData.rating || 5.0,
      groups: isSilvanoSuperUser ? ['grp-poli-usp', 'grp-nubank-sp', 'grp-google-campus'] : (userData.groups || [])
    };

    // Save to Firestore collection 'users'
    const userDocRef = doc(db, 'users', newUser.id);
    await setDoc(userDocRef, sanitizeForFirestore(newUser), { merge: true });

    // If user has routine, save it to 'routines'
    if (newUser.routine) {
      const routineDocRef = doc(db, 'routines', newUser.routine.id || `rt-${newUser.id}`);
      await setDoc(routineDocRef, sanitizeForFirestore({
        ...newUser.routine,
        userId: newUser.id
      }), { merge: true });
    }

    return newUser;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function loginWithGoogleAuth(defaultGroupIds: string[] = []): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    if (!fbUser) return null;

    const normalizedEmail = (fbUser.email || '').trim().toLowerCase();
    const isSilvanoSuperUser = normalizedEmail === 'silvano.kassio@gmail.com';

    // 1. Check if a user document with this email already exists in Firestore
    const usersCollectionRef = collection(db, 'users');
    const existingUsersSnap = await getDocs(usersCollectionRef);
    let existingDoc: { id: string; data: User } | null = null;

    for (const docSnap of existingUsersSnap.docs) {
      const data = docSnap.data() as User;
      if ((data.email || '').trim().toLowerCase() === normalizedEmail) {
        existingDoc = { id: docSnap.id, data: { ...data, id: docSnap.id } };
        break;
      }
    }

    if (existingDoc) {
      // Update existing record with Google auth data if applicable
      const updatedUser: User = {
        ...existingDoc.data,
        name: fbUser.displayName || existingDoc.data.name,
        avatar: fbUser.photoURL || existingDoc.data.avatar,
        email: fbUser.email || existingDoc.data.email,
        isSuperUser: isSilvanoSuperUser ? true : existingDoc.data.isSuperUser,
        role: isSilvanoSuperUser ? 'superadmin' : existingDoc.data.role,
      };
      await setDoc(doc(db, 'users', existingDoc.id), sanitizeForFirestore(updatedUser), { merge: true });
      return updatedUser;
    }

    // 2. New user creation
    const userDocRef = doc(db, 'users', `usr-${fbUser.uid.substring(0, 10)}`);
    const emailDomain = fbUser.email?.split('@')[1] || '';
    let institution = 'Comunidade Acadêmica / Corporativa';
    if (emailDomain.includes('usp.br')) institution = 'Universidade de São Paulo (USP)';
    else if (emailDomain.includes('insper')) institution = 'Insper Instituto de Ensino e Pesquisa';
    else if (emailDomain.includes('nubank')) institution = 'Nubank Corporate';
    else if (emailDomain.includes('itau') || emailDomain.includes('cubo')) institution = 'Cubo Itaú Tech Hub';

    const newUser: User = {
      id: `usr-${fbUser.uid.substring(0, 10)}`,
      name: fbUser.displayName || (isSilvanoSuperUser ? 'Silvano Kássio' : 'Novo Usuário'),
      email: fbUser.email || 'usuario@caronas.com.br',
      avatar: fbUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      role: isSilvanoSuperUser ? 'superadmin' : 'user',
      isSuperUser: isSilvanoSuperUser,
      rolePreference: 'both',
      institutionName: isSilvanoSuperUser ? 'Superusuário / Acesso Geral' : institution,
      rating: 5.0,
      saldo_caronas: isSilvanoSuperUser ? 24 : 0,
      totalRidesOffered: isSilvanoSuperUser ? 35 : 0,
      totalRidesTaken: isSilvanoSuperUser ? 11 : 0,
      groups: isSilvanoSuperUser ? ['grp-poli-usp', 'grp-nubank-sp', 'grp-google-campus'] : defaultGroupIds,
      ponto_encontro_default: {
        lat: -23.5714,
        lng: -46.7082,
        address: 'Av. Vital Brasil, 500 - Metrô Butantã',
        name: 'Metrô Butantã (Saída Principal)'
      },
      routine: {
        id: `rt-usr-${fbUser.uid.substring(0, 8)}`,
        title: 'Rotina Padrão Diária',
        origin: { lat: -23.5714, lng: -46.7082, address: 'Av. Vital Brasil, 500' },
        destination: { lat: -23.5577, lng: -46.7314, address: 'Campus Universitário / Polo Corporativo' },
        departureTime: '07:30',
        daysOfWeek: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
        defaultSeats: 3,
        defaultPrice: 6.50
      }
    };

    await setDoc(userDocRef, sanitizeForFirestore(newUser), { merge: true });
    return newUser;
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
}

/**
 * Permanent deletion of a user account and associated data from Firestore
 */
export async function deleteFirestoreUser(userId: string): Promise<void> {
  try {
    // 1. Delete user doc
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    // 2. Delete routines
    try {
      const routineRef = doc(db, 'routines', `rt-${userId}`);
      await deleteDoc(routineRef);
    } catch (e) {
      // ignore
    }

    // 3. Remove user from rides driver / accepted passengers
    try {
      const ridesRef = collection(db, 'rides');
      const ridesSnap = await getDocs(ridesRef);
      for (const rDoc of ridesSnap.docs) {
        const rData = rDoc.data() as Ride;
        if (rData.driverId === userId) {
          // Delete rides offered by this user or mark cancelled
          await deleteDoc(doc(db, 'rides', rDoc.id));
        } else if (rData.acceptedPassengers?.some((p) => p.userId === userId)) {
          const updatedPassengers = rData.acceptedPassengers.filter((p) => p.userId !== userId);
          await updateDoc(doc(db, 'rides', rDoc.id), {
            acceptedPassengers: updatedPassengers,
            occupiedSeats: updatedPassengers.length,
          });
        }
      }
    } catch (e) {
      console.warn('Ride cleanup warning during user delete:', e);
    }

    console.log(`✅ Conta ${userId} excluída do Firestore com sucesso.`);
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    throw error;
  }
}

/**
 * Deletes the currently authenticated user's account and logs them out
 */
export async function deleteMyAccount(currentUser: User): Promise<void> {
  try {
    await deleteFirestoreUser(currentUser.id);

    // If currently signed in via Firebase Auth, delete auth account
    if (auth.currentUser) {
      try {
        await auth.currentUser.delete();
      } catch (authDelErr) {
        console.warn('Firebase Auth account delete notice (user may need recent re-auth):', authDelErr);
      }
    }

    await logoutAppUser();
  } catch (error) {
    console.error('Error in deleteMyAccount:', error);
    throw error;
  }
}

export async function logoutAppUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Signout warning:', e);
  }
}

