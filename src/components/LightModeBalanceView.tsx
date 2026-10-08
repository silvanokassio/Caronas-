import React, { useState, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RefreshCw,
  UserCheck,
  QrCode,
  Copy,
  Check,
  X,
  Plus,
  Minus,
  LogIn,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Search,
} from 'lucide-react';
import { User, Ride, LedgerTransaction, Group } from '../types';
import { calculateUserBalances, PeerNettingBalance, ForecastRideItem, isUserEligibleForColleagueSearch } from '../lib/balanceUtils';
import { formatRideFriendlyDate } from '../lib/dateUtils';

export interface LightModeBalanceViewProps {
  currentUser: User | null;
  allUsers?: User[];
  ledger: LedgerTransaction[];
  rides: Ride[];
  groups?: Group[];
  onRequestSettlement?: (passengerUser: User, driverUser: User, amount: number, notes?: string) => Promise<void>;
  onConfirmSettlement?: (pendingTx: LedgerTransaction) => Promise<void>;
  onRejectSettlement?: (pendingTx: LedgerTransaction, reason?: string) => Promise<void>;
  onDirectSettlementByDriver?: (driverUser: User, passengerUser: User, amount: number, notes?: string) => Promise<void>;
  onGoToFullStatement?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const LightModeBalanceView: React.FC<LightModeBalanceViewProps> = ({
  currentUser,
  allUsers = [],
  ledger,
  rides,
  groups = [],
  onRequestSettlement,
  onConfirmSettlement,
  onRejectSettlement,
  onDirectSettlementByDriver,
  onGoToFullStatement,
  onOpenAuth,
}) => {
  const [filterMode, setFilterMode] = useState<'pending' | 'forecast' | 'all' | 'settled'>('pending');
  const [peerSearch, setPeerSearch] = useState('');
  const [copiedPixUserId, setCopiedPixUserId] = useState<string | null>(null);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showForecastDetails, setShowForecastDetails] = useState(false);

  // Settlement Modal State (Clean Minimalist Modal)
  const [settlementModal, setSettlementModal] = useState<{
    isOpen: boolean;
    mode: 'passenger_report' | 'driver_direct';
    targetUser: User | null;
    amount: number;
    notes: string;
  }>({
    isOpen: false,
    mode: 'driver_direct',
    targetUser: null,
    amount: 0,
    notes: '',
  });

  // Rejection modal
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    tx: LedgerTransaction | null;
    reason: string;
  }>({
    isOpen: false,
    tx: null,
    reason: '',
  });

  // Guard: unauthenticated
  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xs">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
          <Wallet className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-display font-bold text-slate-900 text-lg sm:text-xl">
            Acompanhamento de Saldo
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
            Faça login para consultar seus créditos de carona, débitos de rateio e gerenciar acertos financeiros de forma simples.
          </p>
        </div>
        <div className="pt-2 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => onOpenAuth?.('login')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1.5 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Fazer Login</span>
          </button>
        </div>
      </div>
    );
  }

  // Motor Central de Cálculo de Saldos
  // 1. Considera no saldo efetivo APENAS viagens concluídas ou de dias passados sem quitação
  // 2. Separa valores de viagens futuras em cálculo de "Valores Previstos"
  // 3. Exclui estritamente registros e transações mockadas/de teste
  const calculatedBalances = useMemo(() => {
    return calculateUserBalances(currentUser, allUsers, rides, ledger);
  }, [currentUser, allUsers, rides, ledger]);

  const {
    realNetBalanceBRL,
    realTotalReceivables,
    realTotalPayables,
    forecastNetBalanceBRL,
    forecastTotalReceivables,
    forecastTotalPayables,
    forecastRides,
    userRidesCount,
    userCompletedRidesCount,
    userUpcomingRidesCount,
    peersList,
    userTransactions,
    pendingSettlementsForDriver,
  } = calculatedBalances;

  // Filtered peers list
  const filteredPeerList = useMemo(() => {
    const isSearching = peerSearch.trim().length > 0;

    // REGRA 2: EM CASO DE PESQUISA
    // "Em caso de pesquisa exibir somente os usuários que estão em grupos em comum ou que constam em alguma viagem juntos tanto no passado quanto no futuro"
    if (isSearching) {
      const term = peerSearch.toLowerCase().trim();
      return peersList.filter((item) => {
        const isEligible = isUserEligibleForColleagueSearch(
          currentUser?.id || '',
          item.user.id,
          groups,
          rides,
          ledger
        );
        if (!isEligible) return false;

        const matchName = item.user.name.toLowerCase().includes(term);
        const matchEmail = item.user.email?.toLowerCase().includes(term) || false;
        const matchInst = item.user.institutionName?.toLowerCase().includes(term) || false;
        const matchPix = item.user.pixKey?.toLowerCase().includes(term) || false;

        return matchName || matchEmail || matchInst || matchPix;
      });
    }

    // REGRA 1: NA EXIBIÇÃO DOS COLEGAS (SEM PESQUISA)
    // "Formulário de saldos: na exibição dos colegas ocultar quem estiver com valor zero."
    if (filterMode === 'pending') {
      return peersList.filter((item) => (item.realStatus !== 'settled' && Math.abs(item.realNetDifference) >= 0.01) || !!item.pendingTx);
    }
    if (filterMode === 'forecast') {
      return peersList.filter((item) => item.hasForecastActivity);
    }
    if (filterMode === 'settled') {
      return peersList.filter((item) => item.realStatus === 'settled' && item.hasRealActivity);
    }
    // Na exibição geral ('all'), ocultar colegas com saldo zero (< 0.01) sem pendências
    return peersList.filter((item) => 
      (item.realStatus !== 'settled' && Math.abs(item.realNetDifference) >= 0.01) || 
      item.hasForecastActivity ||
      !!item.pendingTx
    );
  }, [peersList, filterMode, peerSearch, currentUser, groups, rides, ledger]);

  // Recent 5 transactions (mocks already filtered out)
  const recentTransactions = useMemo(() => {
    return [...userTransactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [userTransactions]);

  // Handle Quick Settlement Confirm
  const handleQuickConfirm = async (tx: LedgerTransaction) => {
    if (!onConfirmSettlement) return;
    setIsProcessing(true);
    try {
      await onConfirmSettlement(tx);
      setActionSuccessToast('Quitação confirmada com sucesso! Saldo atualizado.');
      setTimeout(() => setActionSuccessToast(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Erro ao confirmar quitação.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Quick Settlement Submit
  const handleExecuteSettlementModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementModal.targetUser) return;
    setIsProcessing(true);
    try {
      if (settlementModal.mode === 'driver_direct') {
        if (onDirectSettlementByDriver) {
          await onDirectSettlementByDriver(
            currentUser,
            settlementModal.targetUser,
            settlementModal.amount,
            settlementModal.notes
          );
          setActionSuccessToast(`Quitação de R$ ${settlementModal.amount.toFixed(2)} concedida a ${settlementModal.targetUser.name}!`);
        }
      } else {
        if (onRequestSettlement) {
          await onRequestSettlement(
            currentUser,
            settlementModal.targetUser,
            settlementModal.amount,
            settlementModal.notes
          );
          setActionSuccessToast(`Quitação informada para ${settlementModal.targetUser.name}. Aguardando validação.`);
        }
      }
      setSettlementModal((prev) => ({ ...prev, isOpen: false }));
      setTimeout(() => setActionSuccessToast(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Erro ao registrar quitação.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyPix = (userId: string, pixKey: string) => {
    navigator.clipboard.writeText(pixKey);
    setCopiedPixUserId(userId);
    setTimeout(() => setCopiedPixUserId(null), 2500);
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Toast Feedback */}
      {actionSuccessToast && (
        <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccessToast}</span>
          </div>
          <button onClick={() => setActionSuccessToast(null)} className="p-1 hover:text-white/80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Main Minimalist Balance Card - Saldo Efetivo (Concluídas & Dias Passados) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Saldo Efetivo Liquidável
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                Concluídas ou Dias Anteriores
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl sm:text-3xl font-display font-extrabold tracking-tight ${
                  realNetBalanceBRL > 0.05
                    ? 'text-emerald-600'
                    : realNetBalanceBRL < -0.05
                    ? 'text-amber-600'
                    : 'text-slate-800'
                }`}
              >
                {realNetBalanceBRL > 0.05
                  ? `+ R$ ${realNetBalanceBRL.toFixed(2)}`
                  : realNetBalanceBRL < -0.05
                  ? `- R$ ${Math.abs(realNetBalanceBRL).toFixed(2)}`
                  : 'R$ 0,00'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  realNetBalanceBRL > 0.05
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : realNetBalanceBRL < -0.05
                    ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {realNetBalanceBRL > 0.05
                  ? 'A Receber'
                  : realNetBalanceBRL < -0.05
                  ? 'A Pagar'
                  : 'Em Dia'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              {realNetBalanceBRL > 0.05
                ? 'Valor acumulado por viagens concluídas ou de dias anteriores que você tem a receber.'
                : realNetBalanceBRL < -0.05
                ? 'Valor de rateio de caronas concluídas ou de dias anteriores pendente de acertar.'
                : 'Não há pendências financeiras abertas com seus colegas. Tudo em dia!'}
            </p>
            {calculatedBalances.pendingPassengerSettlementsBRL > 0 && (
              <p className="text-[10px] text-indigo-700 font-semibold mt-1 bg-indigo-50 border border-indigo-200/60 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-600" />
                <span>Inclui R$ {calculatedBalances.pendingPassengerSettlementsBRL.toFixed(2)} em quitação informada por você (contabilizada no saldo e aguardando validação do motorista)</span>
              </p>
            )}
          </div>

          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Quick Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-2.5 text-center border border-slate-100">
            <span className="text-[10px] text-slate-500 block font-medium">A Receber Efetivo</span>
            <span className="text-xs font-bold text-emerald-600 font-mono">
              R$ {realTotalReceivables.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-2.5 text-center border border-slate-100">
            <span className="text-[10px] text-slate-500 block font-medium">A Pagar Efetivo</span>
            <span className="text-xs font-bold text-amber-700 font-mono">
              R$ {realTotalPayables.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-2.5 text-center border border-slate-100">
            <span className="text-[10px] text-slate-500 block font-medium">Caronas</span>
            <span className="text-xs font-bold text-indigo-700">
              {userRidesCount} {userRidesCount === 1 ? 'viag.' : 'viag.'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Future Scheduled Rides - Forecast Card (Cálculo Separado de Valores Previstos) */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-5 shadow-2xs space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 bg-indigo-950 border border-indigo-700/60 px-2 py-0.5 rounded-md">
                Valores Previstos
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Futuras / Agendadas
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xl sm:text-2xl font-display font-extrabold tracking-tight ${
                  forecastNetBalanceBRL > 0.05
                    ? 'text-emerald-400'
                    : forecastNetBalanceBRL < -0.05
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {forecastNetBalanceBRL > 0.05
                  ? `+ R$ ${forecastNetBalanceBRL.toFixed(2)}`
                  : forecastNetBalanceBRL < -0.05
                  ? `- R$ ${Math.abs(forecastNetBalanceBRL).toFixed(2)}`
                  : 'R$ 0,00'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {forecastRides.length} vaga(s) agendada(s)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Valores calculados em separado para viagens agendadas que ainda não ocorreram. Eles entram no saldo liquidável quando a viagem for concluída ou passar para dias anteriores.
            </p>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-slate-800 text-indigo-400 flex items-center justify-center shrink-0 border border-slate-700/60">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Forecast Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
          <div className="bg-slate-800/70 rounded-2xl p-2.5 text-center border border-slate-700/50">
            <span className="text-[10px] text-slate-400 block font-medium">Previsto a Receber</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              R$ {forecastTotalReceivables.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-800/70 rounded-2xl p-2.5 text-center border border-slate-700/50">
            <span className="text-[10px] text-slate-400 block font-medium">Previsto a Pagar</span>
            <span className="text-xs font-bold text-amber-400 font-mono">
              R$ {forecastTotalPayables.toFixed(2)}
            </span>
          </div>
        </div>

        {forecastRides.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowForecastDetails(!showForecastDetails)}
              className="w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700/60 flex items-center justify-between transition cursor-pointer"
            >
              <span>{showForecastDetails ? 'Ocultar viagens agendadas' : `Ver detalhes das ${forecastRides.length} vaga(s) agendadas`}</span>
              {showForecastDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showForecastDetails && (
              <div className="mt-2.5 space-y-2 max-h-56 overflow-y-auto pr-1">
                {forecastRides.map((fr) => (
                  <div key={fr.id} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate">
                        {fr.origin} ➔ {fr.destination}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{formatRideFriendlyDate(fr.departureDate)} às {fr.departureTime}</span>
                        <span>•</span>
                        <span>{fr.role === 'driver' ? `Passageiro: ${fr.counterpartName}` : `Motorista: ${fr.counterpartName}`}</span>
                      </div>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${fr.amountBRL > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {fr.amountBRL > 0 ? `+ R$ ${fr.amountBRL.toFixed(2)}` : `- R$ ${Math.abs(fr.amountBRL).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Pending Confirmations Alert (if currentUser is Driver with pending passenger settlement reports) */}
      {pendingSettlementsForDriver.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-3xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-xs font-bold text-amber-900">
              Quitações Aguardando Sua Validação ({pendingSettlementsForDriver.length})
            </span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Passageiros informaram pagamento de rateio. Clique em confirmar para dar baixa imediata no saldo.
          </p>

          <div className="space-y-2 pt-1">
            {pendingSettlementsForDriver.map((tx) => {
              const passengerUser = allUsers.find(
                (u) => u.id === (tx.passengerId || tx.userId || tx.counterpartId)
              );
              const name = passengerUser?.name || tx.counterpartName || 'Passageiro';
              const val = Math.abs(tx.valueBRL ?? (tx.amount > 0 ? tx.amount : 6.50));

              return (
                <div
                  key={tx.id}
                  className="bg-white rounded-2xl p-3 border border-amber-200/80 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">{name}</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Informou R$ {val.toFixed(2)} via PIX
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleQuickConfirm(tx)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setRejectModal({ isOpen: true, tx, reason: '' })}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition cursor-pointer"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Colleague Net Balances Section (Quem deve a quem) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm sm:text-base leading-tight">
              Acertos por Colega
            </h4>
            <span className="text-[11px] text-slate-500">
              Compensação bilateral de caronas com seu usuário ({currentUser.name})
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input for Colleagues */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={peerSearch}
                onChange={(e) => setPeerSearch(e.target.value)}
                placeholder="Buscar colega em comum..."
                className="w-full sm:w-48 pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
              {peerSearch && (
                <button
                  type="button"
                  onClick={() => setPeerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Minimalist Filter Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterMode('pending')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterMode === 'pending'
                    ? 'bg-white text-indigo-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Com Saldo
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('forecast')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterMode === 'forecast'
                    ? 'bg-white text-indigo-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Com Previsão
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-indigo-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
            </div>
          </div>
        </div>

        {filteredPeerList.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <UserCheck className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-slate-700">
              {peerSearch ? 'Nenhum colega encontrado' : 'Tudo em dia!'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              {peerSearch
                ? 'A pesquisa exibe apenas usuários que estão em grupos em comum ou que constam em alguma viagem juntos (passado ou futuro).'
                : filterMode === 'pending'
                ? 'Nenhum saldo efetivo pendente de acerto com seus colegas no momento. Colegas com valor zero ficam ocultos.'
                : filterMode === 'forecast'
                ? 'Nenhuma carona futura agendada com colegas no momento.'
                : 'Nenhum lançamento com saldo em aberto no momento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPeerList.map((item) => {
              const absVal = Math.abs(item.realNetDifference);
              const otherUser = item.user;

              return (
                <div
                  key={otherUser.id}
                  className="p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {otherUser.name}
                        </span>
                        {otherUser.department && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-200/60 text-slate-600 rounded font-medium truncate max-w-[100px]">
                            {otherUser.department}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 space-y-0.5">
                        <div>
                          {item.realStatus === 'to_receive' ? (
                            <span className="text-emerald-700 font-bold">
                              Você tem a receber: R$ {absVal.toFixed(2)}
                            </span>
                          ) : item.realStatus === 'to_pay' ? (
                            <span className="text-amber-800 font-bold">
                              Você deve pagar: R$ {absVal.toFixed(2)}
                            </span>
                          ) : item.pendingTx && item.pendingPassengerSettlementAmount ? (
                            <span className="text-indigo-700 font-semibold flex items-center gap-1 flex-wrap">
                              <span>Quitação de R$ {item.pendingPassengerSettlementAmount.toFixed(2)} informada</span>
                              <span className="text-slate-400 font-normal">• Saldo em dia (R$ 0,00)</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">
                              Saldo liquidável quitado (R$ 0,00)
                            </span>
                          )}
                        </div>

                        {item.hasForecastActivity && (
                          <div className="text-[10px] text-indigo-600 font-medium">
                            Previsão futura: {item.forecastNetDifference >= 0 ? '+' : ''} R$ {item.forecastNetDifference.toFixed(2)} ({item.forecastRidesCount} carona(s) agendada(s))
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions according to status */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    {item.pendingTx && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200/80 px-2 py-1 rounded-lg flex items-center gap-1" title="Aguardando confirmação do motorista">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Validação Pendente</span>
                      </span>
                    )}

                    {item.realStatus === 'to_receive' && (
                      <button
                        type="button"
                        onClick={() =>
                          setSettlementModal({
                            isOpen: true,
                            mode: 'driver_direct',
                            targetUser: otherUser,
                            amount: absVal,
                            notes: '',
                          })
                        }
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                        title="Registrar recebimento ou dar baixa no saldo"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Dar Baixa</span>
                      </button>
                    )}

                    {item.realStatus === 'to_pay' && (
                      <button
                        type="button"
                        onClick={() =>
                          setSettlementModal({
                            isOpen: true,
                            mode: 'passenger_report',
                            targetUser: otherUser,
                            amount: absVal,
                            notes: '',
                          })
                        }
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                        title="Informar quitação / pagamento ao motorista"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pagar PIX</span>
                      </button>
                    )}

                    {otherUser.pixKey && item.realStatus === 'to_pay' && (
                      <button
                        type="button"
                        onClick={() => handleCopyPix(otherUser.id, otherUser.pixKey!)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                        title={`Copiar Chave PIX: ${otherUser.pixKey}`}
                      >
                        {copiedPixUserId === otherUser.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
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

      {/* 4. Recent Transactions Minimalist Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display font-bold text-slate-900 text-sm sm:text-base leading-tight">
            Últimos Lançamentos
          </h4>
          <span className="text-[11px] text-slate-400">Extrato simplificado</span>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Nenhum lançamento recente encontrado.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => {
              const isCredit = (tx.valueBRL ?? tx.amount) > 0;
              const val = Math.abs(tx.valueBRL ?? (tx.amount > 0 ? 6.50 : 6.50));
              const isSettlement = tx.type === 'SETTLEMENT' || tx.type === 'PIX_TRANSFER';

              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {tx.description || (isSettlement ? 'Acerto / Quitação' : 'Carona')}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>{new Date(tx.timestamp).toLocaleDateString('pt-BR')}</span>
                      {tx.counterpartName && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{tx.counterpartName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <span
                    className={`font-mono font-bold text-xs shrink-0 ${
                      isSettlement
                        ? 'text-indigo-600'
                        : isCredit
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {isSettlement
                      ? `R$ ${val.toFixed(2)}`
                      : isCredit
                      ? `+ R$ ${val.toFixed(2)}`
                      : `- R$ ${val.toFixed(2)}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Minimalist Footer Action (Link to Advanced Mode Statement) */}
      {onGoToFullStatement && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onGoToFullStatement}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition cursor-pointer py-2 px-3 rounded-xl hover:bg-indigo-50/80"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ver extrato completo com relatórios na Versão Avançada</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MODAL: Quitação Rápida (Dar Baixa ou Informar Pagamento) */}
      {settlementModal.isOpen && settlementModal.targetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                    settlementModal.mode === 'driver_direct'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  {settlementModal.mode === 'driver_direct' ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {settlementModal.mode === 'driver_direct'
                      ? 'Dar Quitação Direta'
                      : 'Informar Quitação / PIX'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Colega: {settlementModal.targetUser.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettlementModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PIX Key hint if paying */}
            {settlementModal.mode === 'passenger_report' && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                <span className="font-bold text-slate-700 block">Chave PIX do Motorista:</span>
                <div className="flex items-center justify-between gap-1 text-slate-600 font-mono text-[11px]">
                  <span>{settlementModal.targetUser.pixKey || settlementModal.targetUser.email || 'Consulte o colega'}</span>
                  {settlementModal.targetUser.pixKey && (
                    <button
                      type="button"
                      onClick={() => handleCopyPix('modal', settlementModal.targetUser!.pixKey!)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-indigo-600 hover:bg-slate-50"
                    >
                      {copiedPixUserId === 'modal' ? 'Copiado!' : 'Copiar'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleExecuteSettlementModal} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Valor a Quitar (R$)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0.50"
                  required
                  value={settlementModal.amount}
                  onChange={(e) =>
                    setSettlementModal((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-indigo-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Acerto via PIX, combustível, etc."
                  value={settlementModal.notes}
                  onChange={(e) =>
                    setSettlementModal((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-indigo-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlementModal((prev) => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || settlementModal.amount <= 0}
                  className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 ${
                    settlementModal.mode === 'driver_direct'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isProcessing
                    ? 'Salvando...'
                    : settlementModal.mode === 'driver_direct'
                    ? 'Confirmar Baixa'
                    : 'Enviar Quitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Contestar Quitação */}
      {rejectModal.isOpen && rejectModal.tx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900">
              Contestar Quitação de Rateio
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja informar que o valor de R$ {(rejectModal.tx.valueBRL ?? 6.50).toFixed(2)} não foi identificado? O débito permanecerá em aberto.
            </p>

            <input
              type="text"
              placeholder="Motivo (opcional): Ex: Não recebi o PIX"
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, tx: null, reason: '' })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={async () => {
                  if (!onRejectSettlement || !rejectModal.tx) return;
                  setIsProcessing(true);
                  try {
                    await onRejectSettlement(rejectModal.tx, rejectModal.reason);
                    setRejectModal({ isOpen: false, tx: null, reason: '' });
                    setActionSuccessToast('Quitação contestada. O débito continua em aberto.');
                  } catch (err: any) {
                    alert(err?.message || 'Erro ao contestar.');
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
