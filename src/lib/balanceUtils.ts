/**
 * Utilitários de Cálculo de Saldos e Compensação Bilateral
 * 
 * Regras de Negócio (Início a partir de HOJE):
 * 1. Cálculos a Partir de Hoje: Dias anteriores e valores simulados são estritamente desconsiderados.
 * 2. Saldo Efetivo (Real / Liquidável): Calculado APENAS a partir de viagens concluídas
 *    a partir de hoje (departureDate >= hoje, status === 'concluida').
 * 3. Valores Previstos: Viagens agendadas a partir de hoje (departureDate >= hoje) que ainda
 *    não foram concluídas ficam em cálculos estritamente separados.
 * 4. Exclusão de Teste & Mocks: Todos os registros mockados/de teste e lançamentos de dias
 *    anteriores são expurgados do saldo e contadores.
 */

import { User, Ride, LedgerTransaction, Group } from '../types';
import { getRideDateTime, getRelativeDateStr, isDateBeforeToday } from './dateUtils';
export { isDateBeforeToday } from './dateUtils';

const LEGACY_MOCK_USER_IDS = [
  'usr-carlos-mot',
  'usr-beatriz-pas',
  'usr-beatriz-pass',
  'usr-gabriela-pas',
  'usr-gabriela-mot',
  'usr-zemaps-drv',
  'usr-zemaps-pass',
  'usr-lucas-drv',
  'usr-lucas-pass',
  'usr-mariana-pas',
  'usr-mariana-mot',
  'usr-diego-mot',
];

const LEGACY_MOCK_NAMES = [
  'ze maps',
  'gabriela siqueira',
  'beatriz lima',
  'carlos mendes',
  'lucas rocha',
  'mariana mot',
];

/**
 * Detecta se uma viagem é originária de dados mockados/de teste
 */
export function isMockRide(ride: Partial<Ride>): boolean {
  if (!ride) return false;
  const id = (ride.id || '').toLowerCase();
  const driverId = (ride.driverId || '').toLowerCase();
  const driverName = (ride.driverName || '').toLowerCase();
  const desc = (ride.requesterNote || '').toLowerCase();

  if (
    id.startsWith('ride-mock') ||
    id.startsWith('mock') ||
    id.startsWith('ride-demo') ||
    id.startsWith('test-') ||
    id.startsWith('demo-')
  ) {
    return true;
  }

  if (LEGACY_MOCK_USER_IDS.includes(driverId)) return true;
  if (LEGACY_MOCK_NAMES.some((name) => driverName.includes(name))) return true;
  if (desc.includes('[mock]') || desc.includes('[teste]')) return true;

  return false;
}

/**
 * Detecta se uma transação do Ledger é mockada ou lançada para teste
 */
export function isMockTransaction(tx: Partial<LedgerTransaction>): boolean {
  if (!tx) return false;
  const id = (tx.id || '').toLowerCase();
  const rideId = (tx.rideId || '').toLowerCase();
  const userId = (tx.userId || '').toLowerCase();
  const driverId = (tx.driverId || '').toLowerCase();
  const passengerId = (tx.passengerId || '').toLowerCase();
  const counterpartId = (tx.counterpartId || '').toLowerCase();
  const counterpartName = (tx.counterpartName || '').toLowerCase();
  const desc = (tx.description || '').toLowerCase();

  if (
    id.startsWith('tx-mock') ||
    id.startsWith('mock') ||
    id.startsWith('test-') ||
    id.startsWith('tx-test')
  ) {
    return true;
  }

  if (
    rideId.startsWith('ride-mock') ||
    rideId.startsWith('mock') ||
    rideId.startsWith('ride-demo')
  ) {
    return true;
  }

  if (
    LEGACY_MOCK_USER_IDS.includes(userId) ||
    LEGACY_MOCK_USER_IDS.includes(driverId) ||
    LEGACY_MOCK_USER_IDS.includes(passengerId) ||
    LEGACY_MOCK_USER_IDS.includes(counterpartId)
  ) {
    return true;
  }

  if (LEGACY_MOCK_NAMES.some((name) => counterpartName.includes(name))) return true;
  if (
    desc.includes('[mock]') ||
    desc.includes('[teste]') ||
    desc.includes('transação de teste') ||
    desc.includes('mock transaction')
  ) {
    return true;
  }

  return false;
}

/**
 * Verifica se uma transação do Ledger foi lançada em data anterior a hoje
 */
export function isTransactionBeforeToday(tx: Partial<LedgerTransaction>): boolean {
  if (!tx || !tx.timestamp) return false;
  const todayStr = getRelativeDateStr(0);
  const trimmed = tx.timestamp.trim();
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const txDate = trimmed.substring(0, 10);
    return txDate < todayStr;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return d.getTime() < startOfToday.getTime();
  }
  return false;
}

/**
 * Determina se a viagem é elegível para o Saldo Efetivo (Real / Liquidável):
 * Critério: A viagem está no status 'concluida' OU está em dias anteriores a hoje
 * (em dias anteriores mesmo que o motorista não tenha marcado a viagem como concluída).
 * - Não pode ser mockada/teste
 * - Não pode ser cancelada
 */
export function isRideEligibleForRealBalance(ride: Partial<Ride>): boolean {
  if (!ride) return false;
  if (isMockRide(ride)) return false;
  if (ride.status === 'cancelada') return false;

  // Viagens em dias anteriores a hoje contam no saldo real mesmo que não marcadas como concluídas
  if (isDateBeforeToday(ride.departureDate, ride.departureTime)) {
    return true;
  }

  // Viagens de hoje ou futuras geram saldo real se já estiverem concluídas
  if (ride.status === 'concluida') {
    return true;
  }

  return false;
}

/**
 * Determina se a viagem é futura ou agendada para hoje (não concluída),
 * cujos valores devem ficar estritamente no cálculo de "Valores Previstos".
 * Desconsidera viagens de dias anteriores (que já contam no saldo real), concluídas, canceladas e mocks.
 */
export function isRideUpcomingForForecast(ride: Partial<Ride>): boolean {
  if (!ride) return false;
  if (isMockRide(ride)) return false;
  if (ride.status === 'cancelada' || ride.status === 'concluida') return false;

  // Viagens de dias anteriores já contam no saldo real, portanto não são mais forecast
  if (isDateBeforeToday(ride.departureDate, ride.departureTime)) {
    return false;
  }

  return true;
}

export interface ForecastRideItem {
  id: string;
  rideId: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  role: 'driver' | 'passenger';
  counterpartId: string;
  counterpartName: string;
  amountBRL: number; // positivo se a receber, negativo se a pagar
  status: string;
}

export interface PeerNettingBalance {
  user: User;
  // Valores Efetivos (Concluídos a partir de hoje)
  realCreditsAsDriver: number;
  realDebitsAsPassenger: number;
  realNetDifference: number;
  realStatus: 'to_receive' | 'to_pay' | 'settled';
  // Valores Previstos (Viagens Futuras / Agendadas a partir de hoje)
  forecastCreditsAsDriver: number;
  forecastDebitsAsPassenger: number;
  forecastNetDifference: number;
  forecastRidesCount: number;
  // Outros
  pendingTx?: LedgerTransaction;
  pendingPassengerSettlementAmount?: number;
  hasRealActivity: boolean;
  hasForecastActivity: boolean;
}

export interface CalculatedBalances {
  // Saldo Efetivo (Real / Liquidável a partir de hoje)
  realNetBalanceBRL: number;
  realTotalReceivables: number;
  realTotalPayables: number;
  // Quitações informadas pelo passageiro aguardando validação do motorista (já consideradas no Saldo Atual)
  pendingPassengerSettlementsBRL: number;
  // Saldo Previsto (Futuro / Agendado a partir de hoje)
  forecastNetBalanceBRL: number;
  forecastTotalReceivables: number;
  forecastTotalPayables: number;
  forecastRides: ForecastRideItem[];
  // Contagem de Viagens Reais do Usuário a partir de hoje
  userRidesCount: number;
  userCompletedRidesCount: number;
  userUpcomingRidesCount: number;
  // Detalhe por colega
  peersList: PeerNettingBalance[];
  // Transações do usuário (filtradas de mock e dias anteriores)
  userTransactions: LedgerTransaction[];
  // Transações de acerto aguardando confirmação do motorista
  pendingSettlementsForDriver: LedgerTransaction[];
  // Coleções limpas
  cleanLedger: LedgerTransaction[];
  cleanRides: Ride[];
}

/**
 * Motor central de cálculo de saldos:
 * Separa com exatidão saldos efetivos de valores previstos, expurga registros mockados
 * e inicia estritamente a partir de hoje desconsiderando dias anteriores.
 */
export function calculateUserBalances(
  currentUser: User | null,
  allUsers: User[] = [],
  rides: Ride[] = [],
  ledger: LedgerTransaction[] = []
): CalculatedBalances {
  if (!currentUser) {
    return {
      realNetBalanceBRL: 0,
      realTotalReceivables: 0,
      realTotalPayables: 0,
      pendingPassengerSettlementsBRL: 0,
      forecastNetBalanceBRL: 0,
      forecastTotalReceivables: 0,
      forecastTotalPayables: 0,
      forecastRides: [],
      userRidesCount: 0,
      userCompletedRidesCount: 0,
      userUpcomingRidesCount: 0,
      peersList: [],
      userTransactions: [],
      pendingSettlementsForDriver: [],
      cleanLedger: [],
      cleanRides: [],
    };
  }

  // 1. Filtragem estrita de registros mockados / de teste
  const cleanLedger = ledger.filter((t) => !isMockTransaction(t));
  const cleanRides = rides.filter((r) => !isMockRide(r));

  // 2. Viagens reais do usuário logado (desconsiderando mocks e canceladas)
  const userRealRides = cleanRides.filter((r) => {
    if (r.status === 'cancelada') return false;
    const isDriver = r.driverId === currentUser.id;
    const isPassenger = r.acceptedPassengers?.some((p) => p.userId === currentUser.id);
    return isDriver || isPassenger;
  });

  const userRealBalanceRides = userRealRides.filter((r) => isRideEligibleForRealBalance(r));
  const userUpcomingRides = userRealRides.filter((r) => isRideUpcomingForForecast(r));

  const userCompletedRidesCount = userRealBalanceRides.length;
  const userUpcomingRidesCount = userUpcomingRides.length;
  const userRidesCount = userRealBalanceRides.length;

  // 3. Transações do usuário logado
  const userTransactions = cleanLedger.filter((t) => {
    if (t.userId === currentUser.id) return true;
    if (t.type === 'OFFERED_RIDE') {
      return t.driverId === currentUser.id;
    }
    if (t.type === 'RECEIVED_RIDE') {
      return t.passengerId === currentUser.id;
    }
    if (t.type === 'SETTLEMENT' || t.type === 'PIX_TRANSFER') {
      return (
        t.counterpartId === currentUser.id ||
        t.driverId === currentUser.id ||
        t.passengerId === currentUser.id
      );
    }
    return false;
  });

  // 4. Quitações pendentes aguardando validação do motorista
  const pendingSettlementsForDriver = cleanLedger.filter(
    (t) =>
      t.status === 'PENDING_CONFIRMATION' &&
      (t.driverId === currentUser.id || t.counterpartId === currentUser.id)
  );

  // 5. Divisão de caronas: Real (Concluída a partir de hoje) vs. Forecast (Futura / Agendada a partir de hoje)
  const realRides = cleanRides.filter((r) => isRideEligibleForRealBalance(r));
  const forecastRidesList = cleanRides.filter((r) => isRideUpcomingForForecast(r));

  // 5. Lista detalhada de viagens futuras com valores previstos para o currentUser
  const forecastRides: ForecastRideItem[] = [];

  forecastRidesList.forEach((r) => {
    const isDriver = r.driverId === currentUser.id;
    const isPassenger = r.acceptedPassengers?.some((p) => p.userId === currentUser.id);

    if (isDriver && r.acceptedPassengers && r.acceptedPassengers.length > 0) {
      r.acceptedPassengers.forEach((p) => {
        const agreedVal = typeof p.agreedPrice === 'number' ? p.agreedPrice : (r.price || 6.50);
        forecastRides.push({
          id: `forecast-${r.id}-${p.userId}`,
          rideId: r.id,
          origin: r.origin.name || r.origin.address.split(',')[0],
          destination: r.destination.name || r.destination.address.split(',')[0],
          departureDate: r.departureDate,
          departureTime: r.departureTime,
          role: 'driver',
          counterpartId: p.userId,
          counterpartName: p.userName || 'Passageiro',
          amountBRL: agreedVal, // positivo a receber
          status: r.status,
        });
      });
    } else if (isPassenger) {
      const myPassenger = r.acceptedPassengers?.find((p) => p.userId === currentUser.id);
      const agreedVal = typeof myPassenger?.agreedPrice === 'number' ? myPassenger.agreedPrice : (r.price || 6.50);
      forecastRides.push({
        id: `forecast-${r.id}-${currentUser.id}`,
        rideId: r.id,
        origin: r.origin.name || r.origin.address.split(',')[0],
        destination: r.destination.name || r.destination.address.split(',')[0],
        departureDate: r.departureDate,
        departureTime: r.departureTime,
        role: 'passenger',
        counterpartId: r.driverId,
        counterpartName: r.driverName || 'Motorista',
        amountBRL: -agreedVal, // negativo a pagar
        status: r.status,
      });
    }
  });

  // 6. Bilateral Netting por colega
  const peersList: PeerNettingBalance[] = allUsers
    .filter((otherUser) => otherUser.id !== currentUser.id && !LEGACY_MOCK_USER_IDS.includes(otherUser.id))
    .map((otherUser) => {
      // --- CÁLCULO REAL (Efetivo / Concluído / Passado) ---
      // Créditos como Motorista (currentUser motorista, otherUser passageiro)
      const driverRidesFromRealList = realRides.filter(
        (r) =>
          r.driverId === currentUser.id &&
          r.acceptedPassengers?.some((p) => p.userId === otherUser.id)
      );

      const driverRidesMap = new Map<string, number>();

      // 1. Obter valor exato acordado para otherUser a partir de realRides
      driverRidesFromRealList.forEach((r) => {
        const pass = r.acceptedPassengers?.find((p) => p.userId === otherUser.id);
        driverRidesMap.set(r.id, pass?.agreedPrice ?? r.price ?? 6.50);
      });

      // 2. Transações do ledger: deve envolver ESTRITAMENTE currentUser como motorista e otherUser como passageiro
      const driverRidesFromLedger = cleanLedger.filter((t) => {
        if (t.type === 'RECEIVED_RIDE') {
          const isOtherPassenger = t.userId === otherUser.id || t.passengerId === otherUser.id;
          const isCurrentDriver =
            t.driverId === currentUser.id ||
            t.counterpartId === currentUser.id ||
            (t.counterpartName && currentUser.name && t.counterpartName.toLowerCase().includes(currentUser.name.toLowerCase()));
          return isOtherPassenger && isCurrentDriver;
        }
        if (t.type === 'OFFERED_RIDE') {
          const isCurrentDriver = t.userId === currentUser.id || t.driverId === currentUser.id;
          const isOtherPassenger =
            t.passengerId === otherUser.id ||
            t.counterpartId === otherUser.id ||
            (t.counterpartName && otherUser.name && t.counterpartName.toLowerCase().includes(otherUser.name.toLowerCase()));
          return isCurrentDriver && isOtherPassenger;
        }
        return false;
      });

      driverRidesFromLedger.forEach((t) => {
        const key = t.rideId || t.id;
        if (!driverRidesMap.has(key)) {
          // Se houver registro da carona, priorizar o valor individual acordado do passageiro
          const foundRide = cleanRides.find((r) => r.id === t.rideId);
          const pass = foundRide?.acceptedPassengers?.find((p) => p.userId === otherUser.id);
          const val = pass?.agreedPrice ?? Math.abs(t.valueBRL ?? (t.amount > 0 ? 6.50 : 6.50));
          driverRidesMap.set(key, val);
        }
      });

      const realCreditsAsDriver = Array.from(driverRidesMap.values()).reduce((sum, v) => sum + v, 0);

      // Débitos como Passageiro (otherUser motorista, currentUser passageiro)
      const passengerRidesFromRealList = realRides.filter(
        (r) =>
          r.driverId === otherUser.id &&
          r.acceptedPassengers?.some((p) => p.userId === currentUser.id)
      );

      const passengerRidesMap = new Map<string, number>();

      passengerRidesFromRealList.forEach((r) => {
        const pass = r.acceptedPassengers?.find((p) => p.userId === currentUser.id);
        passengerRidesMap.set(r.id, pass?.agreedPrice ?? r.price ?? 6.50);
      });

      // Transações do ledger: deve envolver ESTRITAMENTE otherUser como motorista e currentUser como passageiro
      const passengerRidesFromLedger = cleanLedger.filter((t) => {
        if (t.type === 'RECEIVED_RIDE') {
          const isCurrentPassenger = t.userId === currentUser.id || t.passengerId === currentUser.id;
          const isOtherDriver =
            t.driverId === otherUser.id ||
            t.counterpartId === otherUser.id ||
            (t.counterpartName && otherUser.name && t.counterpartName.toLowerCase().includes(otherUser.name.toLowerCase()));
          return isCurrentPassenger && isOtherDriver;
        }
        if (t.type === 'OFFERED_RIDE') {
          const isOtherDriver = t.userId === otherUser.id || t.driverId === otherUser.id;
          const isCurrentPassenger =
            t.passengerId === currentUser.id ||
            t.counterpartId === currentUser.id ||
            (t.counterpartName && currentUser.name && t.counterpartName.toLowerCase().includes(currentUser.name.toLowerCase()));
          return isOtherDriver && isCurrentPassenger;
        }
        return false;
      });

      passengerRidesFromLedger.forEach((t) => {
        const key = t.rideId || t.id;
        if (!passengerRidesMap.has(key)) {
          const foundRide = cleanRides.find((r) => r.id === t.rideId);
          const pass = foundRide?.acceptedPassengers?.find((p) => p.userId === currentUser.id);
          const val = pass?.agreedPrice ?? Math.abs(t.valueBRL ?? 6.50);
          passengerRidesMap.set(key, val);
        }
      });

      const realDebitsAsPassenger = Array.from(passengerRidesMap.values()).reduce((sum, v) => sum + v, 0);

      // Acertos e quitações bilaterais com deduplicação
      const rawPixTransactions = cleanLedger.filter((t) => {
        if (t.type !== 'PIX_TRANSFER' && t.type !== 'SETTLEMENT') return false;
        const isPair =
          (t.userId === currentUser.id &&
            (t.counterpartId === otherUser.id ||
              t.driverId === otherUser.id ||
              t.passengerId === otherUser.id ||
              (t.counterpartName && t.counterpartName.toLowerCase().includes(otherUser.name.toLowerCase())))) ||
          (t.userId === otherUser.id &&
            (t.counterpartId === currentUser.id ||
              t.driverId === currentUser.id ||
              t.passengerId === currentUser.id ||
              (t.counterpartName && t.counterpartName.toLowerCase().includes(currentUser.name.toLowerCase()))));
        return isPair;
      });

      const uniquePixMap = new Map<string, LedgerTransaction>();
      rawPixTransactions.forEach((t) => {
        const key = t.settlementId ? `settlement-${t.settlementId}` : t.id;
        if (!uniquePixMap.has(key)) {
          uniquePixMap.set(key, t);
        }
      });
      const pixTransactions = Array.from(uniquePixMap.values());

      let settlementPaid = 0;
      let settlementReceived = 0;
      let directPixPaid = 0;
      let directPixReceived = 0;
      let pendingPassengerSettlementAmount = 0;

      pixTransactions.forEach((t) => {
        const isCompleted = t.status === 'COMPLETED';
        const isPendingConfirmation = t.status === 'PENDING_CONFIRMATION';

        // Desconsidera transações recusadas (REJECTED), canceladas ou com valor 0
        if (!isCompleted && !isPendingConfirmation) return;
        const val = Math.abs(t.valueBRL ?? 6.50);
        if (val === 0) return;

        if (t.type === 'SETTLEMENT') {
          const isCurrentUserDriver = t.driverId === currentUser.id;
          const isCurrentUserPassenger =
            t.passengerId === currentUser.id || (!t.driverId && t.userId === currentUser.id);

          if (isCurrentUserDriver) {
            // O motorista só contabiliza no saldo após confirmação efetiva
            if (isCompleted) {
              settlementReceived += val;
            }
          } else if (isCurrentUserPassenger) {
            // O passageiro que já realizou o pagamento passa a ter a quitação contabilizada
            // como efetiva no Saldo Atual para melhor experiência do usuário
            settlementPaid += val;
            if (isPendingConfirmation) {
              pendingPassengerSettlementAmount += val;
            }
          } else {
            const isCounterpartDriver = t.counterpartName?.toLowerCase().includes('motorista');
            if (t.userId === currentUser.id) {
              if (isCounterpartDriver) {
                settlementPaid += val;
                if (isPendingConfirmation) {
                  pendingPassengerSettlementAmount += val;
                }
              } else {
                if (isCompleted) settlementReceived += val;
              }
            } else if (t.userId === otherUser.id) {
              if (isCounterpartDriver) {
                if (isCompleted) settlementReceived += val;
              } else {
                settlementPaid += val;
                if (isPendingConfirmation) {
                  pendingPassengerSettlementAmount += val;
                }
              }
            }
          }
        } else if (t.type === 'PIX_TRANSFER') {
          if (!isCompleted) return;
          if (t.userId === currentUser.id) {
            if ((t.valueBRL ?? 0) < 0) directPixPaid += val;
            else directPixReceived += val;
          } else if (t.userId === otherUser.id) {
            if ((t.valueBRL ?? 0) < 0) directPixReceived += val;
            else directPixPaid += val;
          }
        }
      });

      // Compensação Efetiva
      const grossDifference = realCreditsAsDriver - realDebitsAsPassenger;
      let realNetDifference = 0;
      if (grossDifference >= 0) {
        const remaining = Math.max(0, grossDifference - settlementReceived);
        realNetDifference = remaining + (directPixPaid - directPixReceived);
      } else {
        const remaining = Math.max(0, Math.abs(grossDifference) - settlementPaid);
        realNetDifference = -remaining + (directPixPaid - directPixReceived);
      }

      realNetDifference = Math.round(realNetDifference * 100) / 100;
      const realStatus: 'to_receive' | 'to_pay' | 'settled' =
        realNetDifference > 0.05 ? 'to_receive' : realNetDifference < -0.05 ? 'to_pay' : 'settled';

      // --- CÁLCULO PREVISTO (Viagens Futuras / Agendadas) ---
      let forecastCreditsAsDriver = 0;
      let forecastDebitsAsPassenger = 0;
      let forecastRidesCount = 0;

      forecastRidesList.forEach((r) => {
        if (r.driverId === currentUser.id) {
          const pass = r.acceptedPassengers?.find((p) => p.userId === otherUser.id);
          if (pass) {
            forecastCreditsAsDriver += pass.agreedPrice ?? r.price ?? 6.50;
            forecastRidesCount++;
          }
        }
        if (r.driverId === otherUser.id) {
          const pass = r.acceptedPassengers?.find((p) => p.userId === currentUser.id);
          if (pass) {
            forecastDebitsAsPassenger += pass.agreedPrice ?? r.price ?? 6.50;
            forecastRidesCount++;
          }
        }
      });

      const forecastNetDifference =
        Math.round((forecastCreditsAsDriver - forecastDebitsAsPassenger) * 100) / 100;

      const pendingTx = cleanLedger.find(
        (t) =>
          t.status === 'PENDING_CONFIRMATION' &&
          ((t.driverId === currentUser.id &&
            (t.passengerId === otherUser.id || t.counterpartId === otherUser.id)) ||
            (t.driverId === otherUser.id &&
              (t.passengerId === currentUser.id || t.counterpartId === currentUser.id)))
      );

      return {
        user: otherUser,
        realCreditsAsDriver,
        realDebitsAsPassenger,
        realNetDifference,
        realStatus,
        forecastCreditsAsDriver,
        forecastDebitsAsPassenger,
        forecastNetDifference,
        forecastRidesCount,
        pendingTx,
        pendingPassengerSettlementAmount,
        hasRealActivity: realCreditsAsDriver > 0 || realDebitsAsPassenger > 0 || pixTransactions.length > 0,
        hasForecastActivity: forecastRidesCount > 0,
      };
    })
    .sort((a, b) => {
      // Colegas com saldo efetivo em aberto vêm primeiro
      if (a.realStatus !== 'settled' && b.realStatus === 'settled') return -1;
      if (a.realStatus === 'settled' && b.realStatus !== 'settled') return 1;
      return Math.abs(b.realNetDifference) - Math.abs(a.realNetDifference);
    });

  // 7. Totais agregados
  const realNetBalanceBRL = peersList.reduce((sum, p) => sum + p.realNetDifference, 0);

  const realTotalReceivables = peersList
    .filter((p) => p.realStatus === 'to_receive')
    .reduce((sum, p) => sum + p.realNetDifference, 0);

  const realTotalPayables = peersList
    .filter((p) => p.realStatus === 'to_pay')
    .reduce((sum, p) => sum + Math.abs(p.realNetDifference), 0);

  const pendingPassengerSettlementsBRL = peersList.reduce(
    (sum, p) => sum + (p.pendingPassengerSettlementAmount || 0),
    0
  );

  const forecastTotalReceivables = forecastRides
    .filter((f) => f.role === 'driver')
    .reduce((sum, f) => sum + f.amountBRL, 0);

  const forecastTotalPayables = forecastRides
    .filter((f) => f.role === 'passenger')
    .reduce((sum, f) => sum + Math.abs(f.amountBRL), 0);

  const forecastNetBalanceBRL =
    Math.round((forecastTotalReceivables - forecastTotalPayables) * 100) / 100;

  return {
    realNetBalanceBRL: Math.round(realNetBalanceBRL * 100) / 100,
    realTotalReceivables: Math.round(realTotalReceivables * 100) / 100,
    realTotalPayables: Math.round(realTotalPayables * 100) / 100,
    pendingPassengerSettlementsBRL: Math.round(pendingPassengerSettlementsBRL * 100) / 100,
    forecastNetBalanceBRL,
    forecastTotalReceivables: Math.round(forecastTotalReceivables * 100) / 100,
    forecastTotalPayables: Math.round(forecastTotalPayables * 100) / 100,
    forecastRides,
    userRidesCount,
    userCompletedRidesCount,
    userUpcomingRidesCount,
    peersList,
    userTransactions,
    pendingSettlementsForDriver,
    cleanLedger,
    cleanRides,
  };
}

/**
 * Verifica se dois usuários compartilham ao menos um grupo em comum.
 */
export function areUsersInCommonGroup(
  userAId: string,
  userBId: string,
  groups: Group[] = []
): boolean {
  if (!userAId || !userBId || userAId === userBId) return false;
  return groups.some((g) => {
    const isAIn =
      g.memberIds?.includes(userAId) ||
      g.creatorId === userAId ||
      (g as any).admins?.includes?.(userAId);
    const isBIn =
      g.memberIds?.includes(userBId) ||
      g.creatorId === userBId ||
      (g as any).admins?.includes?.(userBId);
    return isAIn && isBIn;
  });
}

/**
 * Verifica se dois usuários constam em alguma viagem juntos tanto no passado quanto no futuro
 * (como motorista/passageiro, co-passageiros ou transações no ledger).
 */
export function haveUsersSharedRideTogether(
  userAId: string,
  userBId: string,
  rides: Ride[] = [],
  ledger: LedgerTransaction[] = []
): boolean {
  if (!userAId || !userBId || userAId === userBId) return false;

  // 1. Viagens cadastradas (passado, presente ou futuro)
  const inRide = rides.some((r) => {
    if (isMockRide(r)) return false;
    const isADriver = r.driverId === userAId;
    const isBDriver = r.driverId === userBId;
    const isAPassenger = r.acceptedPassengers?.some((p) => p.userId === userAId);
    const isBPassenger = r.acceptedPassengers?.some((p) => p.userId === userBId);

    // Motorista + Passageiro
    if ((isADriver && isBPassenger) || (isBDriver && isAPassenger)) return true;

    // Co-passageiros na mesma carona
    if (isAPassenger && isBPassenger) return true;

    // Proposta aceita na carona
    if (
      r.proposals?.some(
        (prop) =>
          prop.status === 'accepted' &&
          ((prop.driverId === userAId && r.driverId === userBId) ||
            (prop.driverId === userBId && r.driverId === userAId))
      )
    ) {
      return true;
    }

    return false;
  });

  if (inRide) return true;

  // 2. Histórico no Ledger de transações (qualquer lançamento envolvendo os dois usuários)
  const inLedger = ledger.some((t) => {
    if (isMockTransaction(t)) return false;
    const isPair =
      (t.userId === userAId &&
        (t.counterpartId === userBId ||
          t.driverId === userBId ||
          t.passengerId === userBId)) ||
      (t.userId === userBId &&
        (t.counterpartId === userAId ||
          t.driverId === userAId ||
          t.passengerId === userAId));
    return isPair;
  });

  return inLedger;
}

/**
 * Critério Estrito de Elegibilidade para Pesquisa de Colegas no Balanço de Saldos:
 * "Em caso de pesquisa exibir somente os usuários que estão em grupos em comum ou que constam em alguma viagem juntos tanto no passado quanto no futuro"
 */
export function isUserEligibleForColleagueSearch(
  currentUserId: string,
  targetUserId: string,
  groups: Group[] = [],
  rides: Ride[] = [],
  ledger: LedgerTransaction[] = []
): boolean {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;

  const inCommonGroup = areUsersInCommonGroup(currentUserId, targetUserId, groups);
  if (inCommonGroup) return true;

  const sharedRide = haveUsersSharedRideTogether(currentUserId, targetUserId, rides, ledger);
  if (sharedRide) return true;

  return false;
}

