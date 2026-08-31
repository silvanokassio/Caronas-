import React, { useState } from 'react';
import { 
  Coins, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Repeat, 
  DollarSign, 
  CreditCard, 
  UserCheck, 
  Users, 
  Download, 
  Search, 
  CheckCircle2, 
  Send, 
  Building2, 
  Sparkles,
  QrCode,
  Calendar,
  Layers,
  Award,
  BadgeAlert,
  HelpCircle,
  ExternalLink,
  Car,
  Scale,
  ShieldCheck,
  ArrowRight,
  Clock,
  AlertTriangle,
  Check,
  X,
  Copy,
  Lock,
  LogIn,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageCircle,
  RefreshCw,
  SlidersHorizontal,
  Info,
  CheckCheck
} from 'lucide-react';
import { User, LedgerTransaction, Ride } from '../types';

interface GamificationViewProps {
  currentUser: User | null;
  allUsers?: User[];
  ledger: LedgerTransaction[];
  rides?: Ride[];
  onSelectUser?: (user: User) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onAddTransaction?: (
    fromUser: User, 
    toUser: User, 
    amountBRL: number, 
    description: string
  ) => void;
  onRequestSettlement?: (
    passengerUser: User, 
    driverUser: User, 
    amount: number, 
    notes?: string
  ) => Promise<void> | void;
  onConfirmSettlement?: (pendingTx: LedgerTransaction) => Promise<void> | void;
  onRejectSettlement?: (pendingTx: LedgerTransaction, reason?: string) => Promise<void> | void;
  onDirectSettlementByDriver?: (
    driverUser: User, 
    passengerUser: User, 
    amount: number, 
    notes?: string
  ) => Promise<void> | void;
}

export interface BilateralNettingRecord {
  user: User;
  driverRides: Array<{
    id: string;
    rideId?: string;
    description: string;
    date: string;
    value: number;
  }>;
  totalCreditsAsDriver: number;

  passengerRides: Array<{
    id: string;
    rideId?: string;
    description: string;
    date: string;
    value: number;
  }>;
  totalDebitsAsPassenger: number;

  pixPaidToUser: number;
  pixReceivedFromUser: number;
  pixTransactions: LedgerTransaction[];

  netDifference: number;
  absDifference: number;

  status: 'to_receive' | 'to_pay' | 'settled';
  hasMutualRides: boolean;

  hasPendingSettlement: boolean;
  pendingTx?: LedgerTransaction;
}

export const GamificationView: React.FC<GamificationViewProps> = ({
  currentUser,
  allUsers = [],
  ledger,
  rides = [],
  onSelectUser,
  onOpenAuth,
  onAddTransaction,
  onRequestSettlement,
  onConfirmSettlement,
  onRejectSettlement,
  onDirectSettlementByDriver,
}) => {
  const [activeTab, setActiveTab] = useState<'statement' | 'balance_drivers_passengers' | 'pix_transfer'>('balance_drivers_passengers');
  const [statementFilter, setStatementFilter] = useState<'all' | 'credits' | 'debits' | 'pix' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Bilateral Netting Filter and Controls
  const [nettingFilter, setNettingFilter] = useState<'all' | 'to_pay' | 'to_receive' | 'settled'>('all');
  const [nettingSearch, setNettingSearch] = useState('');
  const [selectedInspectUserId, setSelectedInspectUserId] = useState<string>('');
  const [expandedExtratoIds, setExpandedExtratoIds] = useState<Record<string, boolean>>({});
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Settlement Modal State
  const [settlementModal, setSettlementModal] = useState<{
    isOpen: boolean;
    mode: 'passenger_request' | 'driver_direct';
    targetUser: User | null;
    amount: number;
    notes: string;
  }>({
    isOpen: false,
    mode: 'passenger_request',
    targetUser: null,
    amount: 6.50,
    notes: '',
  });

  // Reject / Contest Modal State
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    tx: LedgerTransaction | null;
    reason: string;
  }>({
    isOpen: false,
    tx: null,
    reason: '',
  });

  const [copiedPix, setCopiedPix] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PIX Transfer Form State
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>(
    allUsers.find((u) => u.id !== currentUser?.id)?.id || ''
  );
  const [transferAmount, setTransferAmount] = useState<number>(13.00);
  const [transferDescription, setTransferDescription] = useState<string>('Acerto de combustível e rateio de carona');
  const [transferSuccess, setTransferSuccess] = useState<boolean>(false);

  // Guard: If unauthenticated, display protected access explanation and auth prompt
  if (!currentUser) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Saldo & Extrato
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Acesso Protegido & Individual
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Saldo & Extrato de Caronas
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed mt-2">
            Acompanhe com transparência e segurança seus créditos acumulados por viagens ofertadas, débitos por vagas ocupadas e comprovantes de transferências PIX.
          </p>
        </div>

        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-bold text-slate-900 text-xl sm:text-2xl">
              Acesso Restrito ao Saldo & Extrato
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Cada usuário possui acesso <strong>exclusivo aos lançamentos financeiros de sua própria responsabilidade</strong>. Faça login para consultar seu saldo individual, extrato de rateio e quitações.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth?.('login')}
              className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Fazer Login</span>
            </button>
            <button
              onClick={() => onOpenAuth?.('register')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl transition active:scale-95 cursor-pointer"
            >
              Criar Cadastro Gratuito
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active user is strictly currentUser
  const user = currentUser;

  // Transactions strictly belonging to currentUser (or where currentUser is driver/passenger/counterpart)
  const userTransactions = ledger.filter(
    (t) =>
      t.userId === user.id ||
      t.driverId === user.id ||
      t.passengerId === user.id ||
      t.counterpartId === user.id
  );

  // Compute calculated financial totals for currentUser
  const totalCreditsBRL = userTransactions
    .filter((t) => (t.userId === user.id || t.driverId === user.id) && (t.valueBRL ?? (t.amount > 0 ? 6.50 : -6.50)) > 0)
    .reduce((sum, t) => sum + Math.abs(t.valueBRL ?? 6.50), 0);

  const totalDebitsBRL = userTransactions
    .filter((t) => (t.userId === user.id || t.passengerId === user.id) && (t.valueBRL ?? (t.amount > 0 ? 6.50 : -6.50)) < 0)
    .reduce((sum, t) => sum + Math.abs(t.valueBRL ?? 6.50), 0);

  const currentFinancialBalanceBRL = totalCreditsBRL - totalDebitsBRL;

  // Pending settlements awaiting confirmation for currentUser as DRIVER
  const pendingSettlementsForDriver = ledger.filter(
    (t) =>
      t.status === 'PENDING_CONFIRMATION' &&
      (t.driverId === currentUser.id || t.counterpartId === currentUser.id)
  );

  // Filtered transactions for the statement
  const filteredTransactions = userTransactions.filter((tx) => {
    const isCredit = (tx.valueBRL ?? tx.amount) > 0;
    const isDebit = (tx.valueBRL ?? tx.amount) < 0;
    const isPix = tx.type === 'PIX_TRANSFER' || tx.type === 'SETTLEMENT';
    const isPending = tx.status === 'PENDING_CONFIRMATION';

    if (statementFilter === 'credits' && !isCredit) return false;
    if (statementFilter === 'debits' && !isDebit) return false;
    if (statementFilter === 'pix' && !isPix) return false;
    if (statementFilter === 'pending' && !isPending) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDesc = tx.description.toLowerCase().includes(term);
      const matchCounterpart = tx.counterpartName?.toLowerCase().includes(term) || false;
      const matchId = tx.id.toLowerCase().includes(term);
      if (!matchDesc && !matchCounterpart && !matchId) return false;
    }

    return true;
  });

  // Open Settlement Modal helper
  const openSettlementForUser = (target: User, mode: 'passenger_request' | 'driver_direct', suggestedAmount?: number) => {
    setSettlementModal({
      isOpen: true,
      mode,
      targetUser: target,
      amount: suggestedAmount && suggestedAmount > 0 ? suggestedAmount : 6.50,
      notes: '',
    });
  };

  // Submit Settlement Modal
  const handleSubmitSettlementModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !settlementModal.targetUser) return;
    setIsSubmitting(true);

    try {
      if (settlementModal.mode === 'passenger_request') {
        if (onRequestSettlement) {
          await onRequestSettlement(
            currentUser,
            settlementModal.targetUser,
            settlementModal.amount,
            settlementModal.notes
          );
        }
      } else {
        if (onDirectSettlementByDriver) {
          await onDirectSettlementByDriver(
            currentUser,
            settlementModal.targetUser,
            settlementModal.amount,
            settlementModal.notes
          );
        }
      }
      setSettlementModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      alert(err?.message || 'Erro ao processar quitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm pending settlement (as Driver)
  const handleConfirmPending = async (tx: LedgerTransaction) => {
    if (!onConfirmSettlement) return;
    try {
      await onConfirmSettlement(tx);
    } catch (err: any) {
      alert(err?.message || 'Erro ao confirmar quitação.');
    }
  };

  // Confirm rejection / contest of settlement
  const handleConfirmReject = async () => {
    if (!rejectModal.tx || !onRejectSettlement) return;
    try {
      await onRejectSettlement(rejectModal.tx, rejectModal.reason);
      setRejectModal({ isOpen: false, tx: null, reason: '' });
    } catch (err: any) {
      alert(err?.message || 'Erro ao contestar quitação.');
    }
  };

  // Execute PIX Transfer from currentUser to recipient
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = allUsers.find((u) => u.id === transferTargetUserId);
    if (!targetUser || !currentUser || !onAddTransaction) return;

    if (transferAmount <= 0) {
      alert('Informe um valor válido para a transferência.');
      return;
    }

    onAddTransaction(currentUser, targetUser, transferAmount, transferDescription);
    setTransferSuccess(true);
    setTimeout(() => {
      setTransferSuccess(false);
      setActiveTab('statement');
    }, 2000);
  };

  // Copy PIX key to clipboard
  const handleCopyPix = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // Export statement strictly for the current user
  const handleExportCSV = () => {
    const headers = ['ID', 'Data', 'Tipo', 'Descricao', 'Contraparte', 'Valor_BRL', 'Saldo_Pontos', 'Status'];
    const rows = userTransactions.map((tx) => [
      tx.id,
      new Date(tx.timestamp).toLocaleString('pt-BR'),
      tx.type,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${tx.counterpartName || '-'}"`,
      tx.valueBRL ?? (tx.amount > 0 ? 6.50 : -6.50),
      tx.amount,
      tx.status || 'COMPLETED',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `extrato_saldo_${user.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Billing Text with details for WhatsApp
  const handleCopyBillingText = (record: BilateralNettingRecord) => {
    let msg = '';
    if (record.status === 'to_receive') {
      msg = `Olá ${record.user.name.split(' ')[0]}! Tudo bem? 🚗\n` +
        `Fiz o balanço das nossas caronas no CaronaFlow:\n` +
        `• Viagens como Motorista: ${record.driverRides.length}x (R$ ${record.totalCreditsAsDriver.toFixed(2)})\n` +
        `• Viagens como Passageiro: ${record.passengerRides.length}x (R$ ${record.totalDebitsAsPassenger.toFixed(2)})\n` +
        `⚖️ Compensando os valores, a diferença líquida a pagar é de R$ ${record.absDifference.toFixed(2)}.\n` +
        `Minha chave PIX é: ${currentUser.pixKey || currentUser.email}\n` +
        `Muito obrigado pela parceria de caronas!`;
    } else {
      msg = `Olá ${record.user.name.split(' ')[0]}! Tudo bem? 🚗\n` +
        `Conferi nosso balanço no CaronaFlow:\n` +
        `• Viagens com você: ${record.passengerRides.length}x como passageiro / ${record.driverRides.length}x como motorista.\n` +
        `⚖️ A diferença líquida que devo acertar com você é de R$ ${record.absDifference.toFixed(2)}.\n` +
        `Vou realizar o PIX para sua chave: ${record.user.pixKey || record.user.email}. Valeu!`;
    }

    navigator.clipboard.writeText(msg);
    setCopiedNotice(`Mensagem de acerto copiada para a área de transferência!`);
    setTimeout(() => setCopiedNotice(null), 3500);
  };

  // Toggle Extrato accordion for specific user
  const toggleExtrato = (userId: string) => {
    setExpandedExtratoIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // BILATERAL NETTING ENGINE (INDIVIDUALIZAÇÃO E COMPENSAÇÃO RECÍPROCA DE SALDOS)
  const bilateralNettingList: BilateralNettingRecord[] = allUsers
    .filter((otherUser) => otherUser.id !== currentUser.id)
    .map((otherUser) => {
      // 1. Caronas onde currentUser foi MOTORISTA e otherUser foi PASSAGEIRO (Gera CRÉDITO para currentUser)
      // Verifica transações no ledger onde currentUser era motorista e otherUser passageiro
      const driverRidesFromLedger = ledger.filter(
        (t) =>
          ((t.userId === currentUser.id && t.type === 'OFFERED_RIDE') ||
            (t.userId === otherUser.id && t.type === 'RECEIVED_RIDE')) &&
          (t.counterpartId === otherUser.id ||
            t.passengerId === otherUser.id ||
            t.counterpartId === currentUser.id ||
            t.driverId === currentUser.id ||
            (t.counterpartName && t.counterpartName.toLowerCase().includes(otherUser.name.toLowerCase())))
      );

      const driverRidesFromRidesList = rides.filter(
        (r) =>
          r.driverId === currentUser.id &&
          r.acceptedPassengers?.some((p) => p.userId === otherUser.id)
      );

      const driverRidesMap = new Map<string, { id: string; rideId?: string; description: string; date: string; value: number }>();
      driverRidesFromLedger.forEach((t) => {
        const key = t.rideId || t.id;
        if (!driverRidesMap.has(key)) {
          const val = Math.abs(t.valueBRL ?? (t.amount > 0 ? 6.50 : 6.50));
          driverRidesMap.set(key, {
            id: t.id,
            rideId: t.rideId,
            description: t.description || `Carona oferecida para ${otherUser.name}`,
            date: t.timestamp,
            value: val,
          });
        }
      });

      driverRidesFromRidesList.forEach((r) => {
        if (!driverRidesMap.has(r.id)) {
          const pass = r.acceptedPassengers.find((p) => p.userId === otherUser.id);
          const val = pass?.agreedPrice ?? r.price ?? 6.50;
          driverRidesMap.set(r.id, {
            id: `ride-${r.id}-${otherUser.id}`,
            rideId: r.id,
            description: `Carona: ${r.origin.name} ➔ ${r.destination.name} (Passageiro: ${otherUser.name})`,
            date: r.date || new Date().toISOString(),
            value: val,
          });
        }
      });

      const driverRides = Array.from(driverRidesMap.values());
      const totalCreditsAsDriver = driverRides.reduce((sum, r) => sum + r.value, 0);

      // 2. Caronas onde otherUser foi MOTORISTA e currentUser foi PASSAGEIRO (Gera DÉBITO para currentUser)
      // Verifica transações no ledger onde otherUser era motorista e currentUser passageiro
      const passengerRidesFromLedger = ledger.filter(
        (t) =>
          ((t.userId === currentUser.id && t.type === 'RECEIVED_RIDE') ||
            (t.userId === otherUser.id && t.type === 'OFFERED_RIDE')) &&
          (t.counterpartId === otherUser.id ||
            t.driverId === otherUser.id ||
            t.counterpartId === currentUser.id ||
            t.passengerId === currentUser.id ||
            (t.counterpartName && t.counterpartName.toLowerCase().includes(otherUser.name.toLowerCase())))
      );

      const passengerRidesFromRidesList = rides.filter(
        (r) =>
          r.driverId === otherUser.id &&
          r.acceptedPassengers?.some((p) => p.userId === currentUser.id)
      );

      const passengerRidesMap = new Map<string, { id: string; rideId?: string; description: string; date: string; value: number }>();
      passengerRidesFromLedger.forEach((t) => {
        const key = t.rideId || t.id;
        if (!passengerRidesMap.has(key)) {
          const val = Math.abs(t.valueBRL ?? (t.amount < 0 ? 6.50 : 6.50));
          passengerRidesMap.set(key, {
            id: t.id,
            rideId: t.rideId,
            description: t.description || `Carona utilizada com ${otherUser.name}`,
            date: t.timestamp,
            value: val,
          });
        }
      });

      passengerRidesFromRidesList.forEach((r) => {
        if (!passengerRidesMap.has(r.id)) {
          const pass = r.acceptedPassengers.find((p) => p.userId === currentUser.id);
          const val = pass?.agreedPrice ?? r.price ?? 6.50;
          passengerRidesMap.set(r.id, {
            id: `ride-${r.id}-${currentUser.id}`,
            rideId: r.id,
            description: `Carona: ${r.origin.name} ➔ ${r.destination.name} (Motorista: ${otherUser.name})`,
            date: r.date || new Date().toISOString(),
            value: val,
          });
        }
      });

      const passengerRides = Array.from(passengerRidesMap.values());
      const totalDebitsAsPassenger = passengerRides.reduce((sum, r) => sum + r.value, 0);

      // 3. Acertos PIX & Quitações entre currentUser e otherUser
      const pixTransactions = ledger.filter((t) => {
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

      const pixPaidToUser = pixTransactions
        .filter(
          (t) =>
            (t.userId === currentUser.id && (t.valueBRL ?? 0) < 0) ||
            (t.passengerId === currentUser.id && t.status === 'COMPLETED')
        )
        .reduce((sum, t) => sum + Math.abs(t.valueBRL ?? 6.50), 0);

      const pixReceivedFromUser = pixTransactions
        .filter(
          (t) =>
            (t.userId === currentUser.id && (t.valueBRL ?? 0) > 0 && t.status === 'COMPLETED') ||
            (t.driverId === currentUser.id && t.status === 'COMPLETED')
        )
        .reduce((sum, t) => sum + Math.abs(t.valueBRL ?? 6.50), 0);

      // 4. Netting / Compensação Recíproca
      // grossDifference: (+) Você gerou mais créditos como motorista do que consumiu como passageiro
      //                  (-) Você consumiu mais como passageiro do que gerou como motorista
      const grossDifference = totalCreditsAsDriver - totalDebitsAsPassenger;
      const pixNetAdjustment = pixPaidToUser - pixReceivedFromUser;
      const netDifference = Math.round((grossDifference + pixNetAdjustment) * 100) / 100;
      const absDifference = Math.abs(netDifference);

      const status: 'to_receive' | 'to_pay' | 'settled' =
        netDifference > 0.01 ? 'to_receive' : netDifference < -0.01 ? 'to_pay' : 'settled';

      const hasMutualRides = driverRides.length > 0 && passengerRides.length > 0;

      const pendingTx = ledger.find(
        (t) =>
          t.status === 'PENDING_CONFIRMATION' &&
          ((t.driverId === currentUser.id && (t.passengerId === otherUser.id || t.counterpartId === otherUser.id)) ||
            (t.driverId === otherUser.id && (t.passengerId === currentUser.id || t.counterpartId === currentUser.id)))
      );

      return {
        user: otherUser,
        driverRides,
        totalCreditsAsDriver,
        passengerRides,
        totalDebitsAsPassenger,
        pixPaidToUser,
        pixReceivedFromUser,
        pixTransactions,
        netDifference,
        absDifference,
        status,
        hasMutualRides,
        hasPendingSettlement: !!pendingTx,
        pendingTx,
      };
    });

  // Filtered bilateral records (showing all users with interaction or explicitly searched/selected)
  const activeBilateralRecords = bilateralNettingList.filter((rec) => {
    // Has at least one interaction or is explicitly selected in dropdown
    const hasInteraction =
      rec.driverRides.length > 0 ||
      rec.passengerRides.length > 0 ||
      rec.pixTransactions.length > 0 ||
      rec.hasPendingSettlement ||
      rec.user.id === selectedInspectUserId;

    if (!hasInteraction && !selectedInspectUserId) return false;

    // Filter by status tab
    if (nettingFilter === 'to_pay' && rec.status !== 'to_pay') return false;
    if (nettingFilter === 'to_receive' && rec.status !== 'to_receive') return false;
    if (nettingFilter === 'settled' && rec.status !== 'settled') return false;

    // Filter by search term
    if (nettingSearch.trim()) {
      const term = nettingSearch.toLowerCase();
      const matchName = rec.user.name.toLowerCase().includes(term);
      const matchInst = rec.user.institutionName?.toLowerCase().includes(term) || false;
      const matchPix = rec.user.pixKey?.toLowerCase().includes(term) || false;
      if (!matchName && !matchInst && !matchPix) return false;
    }

    return true;
  });

  // Aggregated Netting Metrics
  const totalDifferenceToReceive = bilateralNettingList
    .filter((r) => r.status === 'to_receive')
    .reduce((sum, r) => sum + r.absDifference, 0);

  const totalDifferenceToPay = bilateralNettingList
    .filter((r) => r.status === 'to_pay')
    .reduce((sum, r) => sum + r.absDifference, 0);

  const consolidatedNetBalance = totalDifferenceToReceive - totalDifferenceToPay;

  const mutualPairsCount = bilateralNettingList.filter((r) => r.hasMutualRides).length;

  const countToPay = bilateralNettingList.filter(
    (r) => r.status === 'to_pay' && (r.driverRides.length > 0 || r.passengerRides.length > 0)
  ).length;

  const countToReceive = bilateralNettingList.filter(
    (r) => r.status === 'to_receive' && (r.driverRides.length > 0 || r.passengerRides.length > 0)
  ).length;

  const countSettled = bilateralNettingList.filter(
    (r) => r.status === 'settled' && (r.driverRides.length > 0 || r.passengerRides.length > 0)
  ).length;

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                Controle Financeiro & Encontro de Contas
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Compensação Par-a-Par
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
              Controle Financeiro & Saldos entre Usuários
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Encontro automático de contas par-a-par: quando dois usuários revezam entre motorista e passageiro, o sistema compensa os valores mútuos e apura apenas a <strong>diferença líquida</strong> a pagar ou receber.
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex flex-col sm:flex-row w-full md:w-auto p-1 bg-slate-100 rounded-xl border border-slate-200 self-stretch md:self-center shrink-0 gap-1 sm:gap-0">
            <button
              id="tab-balance-drivers-passengers"
              onClick={() => setActiveTab('balance_drivers_passengers')}
              className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-auto rounded-lg text-sm sm:text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'balance_drivers_passengers'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Scale className="w-4 h-4 text-indigo-600" />
              <span>Saldos por Usuário (1-a-1)</span>
            </button>

            <button
              id="tab-statement-view"
              onClick={() => setActiveTab('statement')}
              className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-auto rounded-lg text-sm sm:text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'statement'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Extrato Consolidado</span>
            </button>

            <button
              id="tab-pix-transfer"
              onClick={() => setActiveTab('pix_transfer')}
              className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-auto rounded-lg text-sm sm:text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'pix_transfer'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Acerto PIX</span>
            </button>
          </div>
        </div>

        {/* Interactive Persona / Active User Switcher Bar */}
        {onSelectUser && allUsers.length > 1 && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 flex-wrap">
                  <span className="text-slate-500 font-medium">Visualizando como:</span>
                  <span className="font-bold text-slate-900">{currentUser.name}</span>
                  <span className="px-2 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                    Conta Ativa
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {currentUser.institutionName || 'Comunidade UniCaronas'} • PIX: {currentUser.pixKey || currentUser.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">Testar Alternância de Usuário:</span>
              {/* Quick switch to José "Zé" da Silva if current user is Silvano, or to Silvano if current user is Zé */}
              {currentUser.id !== 'usr-ze-pass' && allUsers.some(u => u.id === 'usr-ze-pass') && (
                <button
                  type="button"
                  onClick={() => {
                    const ze = allUsers.find(u => u.id === 'usr-ze-pass');
                    if (ze) onSelectUser(ze);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <Users className="w-3.5 h-3.5 text-rose-600" />
                  <span>Ver como Zé (- R$ 10,00)</span>
                </button>
              )}

              {currentUser.id !== 'usr-admin-silvano' && allUsers.some(u => u.id === 'usr-admin-silvano') && (
                <button
                  type="button"
                  onClick={() => {
                    const silvano = allUsers.find(u => u.id === 'usr-admin-silvano');
                    if (silvano) onSelectUser(silvano);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ver como Silvano (+ R$ 10,00)</span>
                </button>
              )}

              <select
                value={currentUser.id}
                onChange={(e) => {
                  const target = allUsers.find(u => u.id === e.target.value);
                  if (target) onSelectUser(target);
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.institutionName || 'Colega'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* BANNER DE NOTIFICAÇÃO: QUITAÇÕES PENDENTES DE CONFIRMAÇÃO DO MOTORISTA COM BOTÕES DIRETOS DE VALIDAÇÃO */}
      {pendingSettlementsForDriver.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-200/80 pb-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs ring-4 ring-amber-200/60">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold text-[10px] uppercase tracking-wider">
                    Ação Necessária do Motorista
                  </span>
                  <span className="text-xs text-amber-900 font-mono font-bold">
                    {pendingSettlementsForDriver.length} quitação(ões) pendente(s)
                  </span>
                </div>
                <h4 className="font-display font-bold text-amber-950 text-lg sm:text-xl">
                  Validação de Quitação de Rateios ({pendingSettlementsForDriver.length})
                </h4>
                <p className="text-xs text-amber-900 leading-relaxed max-w-2xl">
                  Passageiros informaram o pagamento do rateio. <strong>Clique no botão verde "Validar Quitação"</strong> de cada passageiro para confirmar o recebimento e dar baixa automática no saldo.
                </p>
              </div>
            </div>

            {pendingSettlementsForDriver.length > 1 && (
              <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                <button
                  type="button"
                  onClick={async () => {
                    for (const tx of pendingSettlementsForDriver) {
                      await handleConfirmPending(tx);
                    }
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Validar Todas ({pendingSettlementsForDriver.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Direct Pending Transactions Cards with Large Validation Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {pendingSettlementsForDriver.map((tx) => {
              const passenger = allUsers.find((u) => u.id === (tx.passengerId || tx.userId || tx.counterpartId));
              const amountVal = Math.abs(tx.valueBRL ?? (tx.amount > 0 ? tx.amount : 6.50));
              const passengerName = passenger?.name || tx.counterpartName || 'Passageiro';

              return (
                <div
                  key={tx.id}
                  className="bg-white border-2 border-amber-300 rounded-2xl p-4.5 shadow-xs flex flex-col justify-between space-y-3.5 hover:border-amber-400 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      {passenger?.avatar ? (
                        <img
                          src={passenger.avatar}
                          alt={passengerName}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                          {passengerName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="text-sm font-bold text-slate-900 truncate">
                          {passengerName}
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          {passenger?.institutionName || 'Passageiro da Carona'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs uppercase font-bold text-amber-800 block">Valor Informado</span>
                      <span className="text-lg font-mono font-bold text-emerald-600">
                        R$ {amountVal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px] text-amber-800">
                      <span>{new Date(tx.timestamp).toLocaleDateString('pt-BR')} às {new Date(tx.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-bold">{tx.paymentMethod || 'PIX'}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium truncate">
                      {tx.description}
                    </p>
                    {tx.notes && (
                      <p className="text-[11px] text-indigo-800 font-semibold italic">
                        "{tx.notes}"
                      </p>
                    )}
                  </div>

                  {/* PROMINENT VALIDATION ACTION BUTTONS */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      id={`btn-validate-settlement-${tx.id}`}
                      onClick={() => handleConfirmPending(tx)}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ring-2 ring-emerald-500/30"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                      <span>Validar Quitação (Confirmar)</span>
                    </button>
                    <button
                      type="button"
                      id={`btn-reject-settlement-${tx.id}`}
                      onClick={() => setRejectModal({ isOpen: true, tx, reason: '' })}
                      className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Não Recebi</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 1: EXTRATO INDIVIDUAL & SALDO (Default) */}
      {activeTab === 'statement' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Digital Bank Card & Financial Metrics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Digital Card (4 cols) */}
            <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-black text-sm border border-indigo-400/30">
                      CF
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-100 tracking-wider">CARONA FLOW</p>
                      <p className="text-[10px] text-slate-400">Saldo & Extrato Individual</p>
                    </div>
                  </div>
                  <div className="w-9 h-7 bg-amber-400/20 rounded border border-amber-400/40 flex items-center justify-center">
                    <div className="w-6 h-4 border border-amber-400/50 rounded-xs" />
                  </div>
                </div>

                <div className="mt-6 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                    Seu Saldo Atual Disponível
                  </span>
                  <div className="flex items-baseline space-x-2">
                    <span className={`text-3xl font-bold font-mono tracking-tight ${
                      currentFinancialBalanceBRL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {currentFinancialBalanceBRL >= 0 ? `+ R$ ${currentFinancialBalanceBRL.toFixed(2)}` : `- R$ ${Math.abs(currentFinancialBalanceBRL).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      user.saldo_caronas >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {user.saldo_caronas > 0 ? `+${user.saldo_caronas}` : user.saldo_caronas} Viagens Equivalentes
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      ({user.totalRidesOffered} ofertadas / {user.totalRidesTaken} pegas)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-end justify-between text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-mono">Titular da Conta</p>
                  <p className="font-semibold text-slate-200">{user.name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">
                    Ag: {user.agency || '0001'} • C/C: {user.accountNumber || '48291-0'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-mono">Sua Chave PIX</p>
                  <p className="text-[10px] text-slate-300 font-mono truncate max-w-[130px]">
                    {user.pixKey || user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Highlights (8 cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Inflow (Credits from offering rides) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Entradas (+ Créditos)
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-2xl font-bold font-mono text-emerald-600">
                      + R$ {totalCreditsBRL.toFixed(2)}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Rateio arrecadado ao oferecer carona para colegas.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Caronas Oferecidas:</span>
                  <span className="font-bold text-emerald-700">{user.totalRidesOffered} viagens</span>
                </div>
              </div>

              {/* Total Outflow (Debits from riding) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Saídas (- Débitos)
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-2xl font-bold font-mono text-rose-600">
                      - R$ {totalDebitsBRL.toFixed(2)}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Custo de rateio pago aos motoristas por vagas utilizadas.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Caronas Pegas:</span>
                  <span className="font-bold text-rose-700">{user.totalRidesTaken} viagens</span>
                </div>
              </div>

              {/* Total Estimated Savings vs Rideshare/Taxi */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      Economia Estimada
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-2xl font-bold font-mono text-indigo-600">
                      R$ {(((user.totalRidesOffered || 0) + (user.totalRidesTaken || 0)) * 28.50).toFixed(2)}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Economia vs tarifas de aplicativos de transporte individual.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">CO₂ Poupado:</span>
                  <span className="font-bold text-teal-700">{(((user.totalRidesOffered || 0) + (user.totalRidesTaken || 0)) * 3.2).toFixed(1)} kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statement Toolbar with Verified Titular Lock (No cross-account selector) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Extrato Consolidado de Lançamentos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exibindo lançamentos financeiros de responsabilidade exclusiva de <strong>{user.name}</strong> ({user.institutionName})
                </p>
              </div>

              {/* Verified Identity Badge & Export CSV */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
                <div className="flex items-center space-x-2 bg-emerald-50 px-3.5 py-2.5 sm:py-1.5 rounded-xl border border-emerald-200 text-xs min-h-[44px] sm:min-h-auto">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-900 font-bold">
                    Titular: {user.name.split(' ')[0]} (Lançamentos Próprios)
                  </span>
                </div>

                <button
                  id="btn-export-statement-csv"
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-auto rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setStatementFilter('all')}
                  className={`px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-auto rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    statementFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({userTransactions.length})
                </button>

                <button
                  onClick={() => setStatementFilter('credits')}
                  className={`px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-auto rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    statementFilter === 'credits'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Entradas (+ Créditos)</span>
                </button>

                <button
                  onClick={() => setStatementFilter('debits')}
                  className={`px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-auto rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    statementFilter === 'debits'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Saídas (- Débitos)</span>
                </button>

                <button
                  onClick={() => setStatementFilter('pix')}
                  className={`px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-auto rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    statementFilter === 'pix'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>PIX & Quitações</span>
                </button>

                <button
                  onClick={() => setStatementFilter('pending')}
                  className={`px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-auto rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    statementFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pendências ({userTransactions.filter(t => t.status === 'PENDING_CONFIRMATION').length})</span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar no meu extrato..."
                  className="w-full pl-9 pr-4 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Transactions Feed */}
            <div className="space-y-3 pt-2">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <CreditCard className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Nenhum lançamento encontrado</p>
                  <p className="text-xs text-slate-500">
                    Você ainda não possui lançamentos com os filtros selecionados.
                  </p>
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isCredit = (tx.valueBRL ?? tx.amount) > 0;
                  const isPending = tx.status === 'PENDING_CONFIRMATION';
                  const isPix = tx.type === 'PIX_TRANSFER' || tx.type === 'SETTLEMENT';
                  const value = tx.valueBRL ?? (tx.amount > 0 ? 6.50 : -6.50);
                  const isDriverForThisTx = currentUser && (tx.driverId === currentUser.id || tx.counterpartId === currentUser.id);

                  return (
                    <div
                      key={tx.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isPending
                          ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                          : isCredit
                          ? 'bg-white hover:bg-slate-50/80 border-slate-200'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      {/* Left: Icon & Description & Metadata */}
                      <div className="flex items-start space-x-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isPending
                              ? 'bg-amber-100 text-amber-700'
                              : isPix
                              ? 'bg-indigo-50 text-indigo-600'
                              : isCredit
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {isPending ? (
                            <Clock className="w-5 h-5 animate-pulse" />
                          ) : isPix ? (
                            <QrCode className="w-5 h-5" />
                          ) : isCredit ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{tx.description}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              #{tx.id.substring(0, 10)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(tx.timestamp).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(tx.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {tx.counterpartName && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-slate-700">
                                  Contraparte: <strong>{tx.counterpartName}</strong>
                                </span>
                              </>
                            )}
                          </div>

                          {tx.notes && (
                            <p className="text-[11px] text-indigo-700 italic pt-0.5">
                              Nota: "{tx.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Financial Amount & Status Actions */}
                      <div className="flex flex-col sm:items-end justify-between gap-2 pl-13 sm:pl-0 shrink-0">
                        <div className="text-left sm:text-right">
                          <span
                            className={`font-mono font-bold text-base block ${
                              isPending
                                ? 'text-amber-700'
                                : isCredit
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {isCredit ? `+ R$ ${Math.abs(value).toFixed(2)}` : `- R$ ${Math.abs(value).toFixed(2)}`}
                          </span>
                          <div className="flex items-center justify-start sm:justify-end gap-1.5 text-[10px] text-slate-500 font-mono">
                            <span className={isCredit ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                              {tx.amount > 0 ? `+${tx.amount}` : tx.amount} ponto(s)
                            </span>
                            <span>•</span>
                            {isPending ? (
                              <span className="text-amber-800 flex items-center gap-0.5 font-bold">
                                <Clock className="w-3 h-3 text-amber-600" /> Aguardando Confirmação
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-0.5 font-medium">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Liquidado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Confirmation controls if currentUser is driver for this pending settlement */}
                        {isPending && isDriverForThisTx && (
                          <div className="flex items-center gap-2 pt-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmPending(tx)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-sm ring-2 ring-emerald-500/30 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                              <span>Validar Quitação (Confirmar)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectModal({ isOpen: true, tx, reason: '' })}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Não Recebi</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MINHAS QUITAÇÕES & ACERTOS (BILATERAL NETTING & SALDOS INDIVIDUALIZADOS) */}
      {activeTab === 'balance_drivers_passengers' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner & Netting Methodology Notice */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
            {copiedNotice && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold shadow-sm animate-in fade-in slide-in-from-top-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{copiedNotice}</span>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-indigo-600" />
                    Compensação Recíproca & Encontro de Contas
                  </span>
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    Bilateral Netting 1-a-1
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                  Controle Individualizado de Saldos entre Usuários
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
                  Se em uma interação você foi <strong className="text-emerald-700">motorista</strong> e em outra foi <strong className="text-rose-700">passageiro</strong> com o mesmo colega, o sistema cruza os valores automaticamente e apura quem deve pagar a <strong>diferença líquida</strong> ao outro.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-slate-500" />
                  Titular: {currentUser.name}
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setNettingFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    nettingFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Todos os Colegas</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 text-[10px] font-mono">
                    {bilateralNettingList.filter((r) => r.driverRides.length > 0 || r.passengerRides.length > 0 || r.pixTransactions.length > 0).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNettingFilter('to_pay')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    nettingFilter === 'to_pay'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>A Pagar</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                    {countToPay}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNettingFilter('to_receive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    nettingFilter === 'to_receive'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>A Receber</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                    {countToReceive}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNettingFilter('settled')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    nettingFilter === 'settled'
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Compensados (R$ 0,00)</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 text-[10px] font-mono">
                    {countSettled}
                  </span>
                </button>
              </div>

              {/* Search & Inspect Any Member */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nettingSearch}
                    onChange={(e) => setNettingSearch(e.target.value)}
                    placeholder="Buscar colega ou chave PIX..."
                    className="w-full sm:w-56 pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                  {nettingSearch && (
                    <button
                      type="button"
                      onClick={() => setNettingSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Inspect Any Member Dropdown */}
                <select
                  value={selectedInspectUserId}
                  onChange={(e) => setSelectedInspectUserId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                >
                  <option value="">Consultar outro colega...</option>
                  {allUsers
                    .filter((u) => u.id !== currentUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.institutionName || 'Colega'})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* List of Bilateral Netting Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBilateralRecords.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-4 shadow-sm max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Scale className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-slate-900 text-base">
                    Nenhum lançamento encontrado
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                    Não há valores pendentes de acerto com os filtros selecionados. Ao realizar viagens, o saldo a pagar ou receber aparecerá discriminado aqui.
                  </p>
                </div>
                {nettingFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setNettingFilter('all')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Exibir Todos os Colegas
                  </button>
                )}
              </div>
            ) : (
              activeBilateralRecords.map((record) => {
                return (
                  <div
                    key={record.user.id}
                    className={`bg-white border-2 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                      record.status === 'to_pay'
                        ? 'border-rose-200 hover:border-rose-300'
                        : record.status === 'to_receive'
                        ? 'border-emerald-200 hover:border-emerald-300'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Section: User Identity & Net Amount */}
                    <div className="space-y-4">
                      {/* User Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <img
                            src={record.user.avatar}
                            alt={record.user.name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 shrink-0 shadow-2xs"
                          />
                          <div className="min-w-0">
                            <h4 className="font-display font-bold text-slate-900 text-base truncate">
                              {record.user.name}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">
                              {record.user.institutionName || 'Colega de Carona'}
                            </p>
                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span className="truncate">PIX: {record.user.pixKey || record.user.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyPix(record.user.pixKey || record.user.email)}
                                className="text-indigo-600 hover:text-indigo-800 font-sans font-bold underline cursor-pointer shrink-0"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Mutual Rides Mini-Tag */}
                        {record.hasMutualRides && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 flex items-center gap-1">
                            <Repeat className="w-3 h-3 text-indigo-600" />
                            <span>Revezamento</span>
                          </span>
                        )}
                      </div>

                      {/* Main Financial Status Box: Clear Value to Pay or Receive */}
                      {record.status === 'to_pay' && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/90 flex items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                              Você Deve Pagar
                            </span>
                            <p className="text-xs text-rose-900 font-medium pt-0.5 truncate">
                              Diferença líquida a acertar
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xl sm:text-3xl font-display font-bold text-rose-700 block">
                              R$ {record.absDifference.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {record.status === 'to_receive' && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                              Você Deve Receber
                            </span>
                            <p className="text-xs text-emerald-900 font-medium pt-0.5 truncate">
                              {record.user.name.split(' ')[0]} deve pagar a você
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xl sm:text-3xl font-display font-bold text-emerald-700 block">
                              R$ {record.absDifference.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {record.status === 'settled' && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Contas Quitadas
                            </span>
                            <p className="text-xs text-slate-600 font-medium pt-0.5">
                              Nenhum valor pendente
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xl font-display font-bold text-slate-700 block">
                              R$ 0,00
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Pending Confirmation Alert if active */}
                      {record.hasPendingSettlement && record.pendingTx && (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2">
                          <div className="flex items-start space-x-2 text-xs text-amber-900">
                            <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0 animate-spin" />
                            <div>
                              <p className="font-bold">
                                Quitação de R$ {(record.pendingTx.valueBRL || 6.50).toFixed(2)} em validação
                              </p>
                              <p className="text-[11px] text-amber-800">
                                {record.pendingTx.driverId === currentUser.id
                                  ? `${record.user.name} informou o PIX. Confirme o recebimento:`
                                  : `Aguardando ${record.user.name} confirmar seu PIX.`}
                              </p>
                            </div>
                          </div>

                          {record.pendingTx.driverId === currentUser.id && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmPending(record.pendingTx!)}
                                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                                <span>Validar Quitação</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModal({ isOpen: true, tx: record.pendingTx!, reason: '' })}
                                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Não Recebi</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions & Statement Link */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* If Current User must pay */}
                        {record.status === 'to_pay' && (
                          <button
                            type="button"
                            onClick={() => openSettlementForUser(record.user, 'passenger_request', record.absDifference)}
                            className="flex-1 py-2.5 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Pagar PIX (R$ {record.absDifference.toFixed(2)})</span>
                          </button>
                        )}

                        {/* If Other User must pay */}
                        {record.status === 'to_receive' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyBillingText(record)}
                              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>Cobrar no WhatsApp</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openSettlementForUser(record.user, 'driver_direct', record.absDifference)}
                              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                              title="Dar quitação manual direta"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* If Settled */}
                        {record.status === 'settled' && (
                          <button
                            type="button"
                            onClick={() => openSettlementForUser(record.user, 'passenger_request', 6.50)}
                            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                          >
                            Novo Acerto Avulso
                          </button>
                        )}
                      </div>

                      {/* Direct Link to Check Itemized Entries in Extrato */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm(record.user.name);
                          setActiveTab('statement');
                        }}
                        className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer group"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                        <span>Conferir lançamentos no Extrato</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Resumo Consolidado & Saldo Final no Fim da Página */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-indigo-600" />
                    Balanço Consolidado
                  </span>
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    Encontro de Contas Global
                  </span>
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">
                  Saldo Final Consolidado
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  Visão totalizada após a compensação bilateral e encontro recíproco de contas com todos os usuários da comunidade.
                </p>
              </div>

              <div className="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-right shrink-0 self-start md:self-center space-y-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  Resultado Líquido Final
                </span>
                <span
                  className={`text-2xl font-display font-bold block ${
                    consolidatedNetBalance >= 0 ? 'text-indigo-700' : 'text-amber-700'
                  }`}
                >
                  {consolidatedNetBalance >= 0 ? '+' : ''} R$ {consolidatedNetBalance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Aggregated Netting Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    Total a Receber
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                    {countToReceive} colega(s)
                  </span>
                </div>
                <p className="text-2xl font-display font-bold text-emerald-700">
                  + R$ {totalDifferenceToReceive.toFixed(2)}
                </p>
                <p className="text-[11px] text-emerald-800/80">
                  Diferenças líquidas que colegas devem acertar com você
                </p>
              </div>

              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    Total a Pagar
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                    {countToPay} colega(s)
                  </span>
                </div>
                <p className="text-2xl font-display font-bold text-rose-700">
                  - R$ {totalDifferenceToPay.toFixed(2)}
                </p>
                <p className="text-[11px] text-rose-800/80">
                  Diferenças líquidas que você deve pagar via PIX
                </p>
              </div>

              <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-indigo-600" />
                    Balanço Compensado
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                    Líquido
                  </span>
                </div>
                <p
                  className={`text-2xl font-display font-bold ${
                    consolidatedNetBalance >= 0 ? 'text-indigo-700' : 'text-amber-700'
                  }`}
                >
                  {consolidatedNetBalance >= 0 ? '+' : ''} R$ {consolidatedNetBalance.toFixed(2)}
                </p>
                <p className="text-[11px] text-indigo-800/80">
                  Resultado líquido de todas as compensações 1-a-1
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Repeat className="w-4 h-4 text-slate-600" />
                    Caronas Mútuas
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
                    Recíprocas
                  </span>
                </div>
                <p className="text-2xl font-display font-bold text-slate-900">
                  {mutualPairsCount}
                </p>
                <p className="text-[11px] text-slate-500">
                  Colegas onde você foi motorista e também passageiro
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: PIX TRANSFER / ACERTO FINANCEIRO */}
      {activeTab === 'pix_transfer' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-slate-900">
                  Transferência Instantânea PIX / Acerto de Rateio
                </h3>
                <p className="text-xs text-slate-500">
                  Transfira créditos ou faça o acerto de combustível diretamente entre contas da comunidade.
                </p>
              </div>
            </div>

            {transferSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="text-base font-bold text-emerald-900">Transferência Concluída!</h4>
                <p className="text-sm sm:text-xs text-emerald-800">
                  Lançamento de crédito efetuado no extrato do beneficiário e débito na sua conta.
                </p>
              </div>
            ) : (
              <form onSubmit={handleExecuteTransfer} className="space-y-5">
                {/* Beneficiary selector */}
                <div className="space-y-1.5">
                  <label className="text-sm sm:text-xs font-bold text-slate-800">
                    Beneficiário / Colega de Carona:
                  </label>
                  <select
                    id="select-transfer-target"
                    value={transferTargetUserId}
                    onChange={(e) => setTransferTargetUserId(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium cursor-pointer"
                    required
                  >
                    {allUsers
                      .filter((u) => u.id !== currentUser.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — Ag: {u.agency || '0001'} / C/C: {u.accountNumber || '48291-0'} ({u.institutionName})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <label className="text-sm sm:text-xs font-bold text-slate-800">
                    Valor da Transferência (R$):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 sm:top-3 text-slate-400 font-mono text-base font-bold">R$</span>
                    <input
                      id="input-transfer-amount"
                      type="number"
                      step="0.50"
                      min="1.00"
                      max="500.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-14 pr-4 py-3.5 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-xs sm:text-[11px] text-slate-500 font-bold">Valores rápidos:</span>
                    {[6.50, 13.00, 19.50, 26.00].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTransferAmount(val)}
                        className="px-3.5 py-2 sm:px-2.5 sm:py-1 min-h-[38px] sm:min-h-auto rounded-lg bg-slate-100 text-slate-700 text-xs sm:text-[10px] font-mono font-bold hover:bg-slate-200 border border-slate-200 transition active:scale-95 cursor-pointer"
                      >
                        R$ {val.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm sm:text-xs font-bold text-slate-800">
                    Descrição / Motivo do Lançamento:
                  </label>
                  <input
                    id="input-transfer-desc"
                    type="text"
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    placeholder="Ex: Acerto de combustível e rateio de carona"
                    className="w-full px-4 py-3.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-base sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                {/* Submit button */}
                <button
                  id="btn-submit-pix-transfer"
                  type="submit"
                  className="w-full py-3.5 sm:py-3 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm sm:text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirmar e Liquidar no Livro-Razão</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: INFORMAR QUITAÇÃO (PASSAGEIRO) OU DAR QUITAÇÃO DIRETA (MOTORISTA) */}
      {settlementModal.isOpen && settlementModal.targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                  settlementModal.mode === 'passenger_request'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {settlementModal.mode === 'passenger_request' ? (
                    <CreditCard className="w-6 h-6" />
                  ) : (
                    <Check className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900">
                    {settlementModal.mode === 'passenger_request'
                      ? 'Informar Quitação ao Motorista'
                      : 'Dar Quitação Direta ao Passageiro'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {settlementModal.mode === 'passenger_request'
                      ? 'Liquidação de débitos com validação do condutor'
                      : 'Ajuste e quitação imediata no Livro-Razão'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettlementModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Informational Guidance Box */}
            <div className={`p-4 rounded-2xl text-xs space-y-1.5 leading-relaxed ${
              settlementModal.mode === 'passenger_request'
                ? 'bg-indigo-50/80 border border-indigo-200 text-indigo-900'
                : 'bg-emerald-50/80 border border-emerald-200 text-emerald-900'
            }`}>
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {settlementModal.mode === 'passenger_request'
                  ? 'Como funciona a Quitação do Passageiro:'
                  : 'Como funciona a Quitação pelo Motorista:'}
              </p>
              <p>
                {settlementModal.mode === 'passenger_request'
                  ? 'Ao registrar a quitação, o seu saldo devedor é compensado imediatamente. O motorista receberá um aviso com os dados e deverá dar a confirmação. Enquanto pendente, seu extrato exibe o status de validação.'
                  : 'Como motorista credor, ao dar quitação, os saldos de ambos são ajustados automaticamente de forma definitiva no sistema e o passageiro é notificado na hora.'}
              </p>
            </div>

            {/* Target User Info Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-3">
                <img
                  src={settlementModal.targetUser.avatar}
                  alt={settlementModal.targetUser.name}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    {settlementModal.targetUser.name}
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-200 text-slate-700 font-semibold">
                      {settlementModal.targetUser.rolePreference === 'driver' ? 'Motorista' : 'Passageiro'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {settlementModal.targetUser.institutionName || 'Colega de Caronas'}
                  </p>
                </div>
              </div>

              {/* PIX Key Box for Passenger Paying Driver */}
              {settlementModal.mode === 'passenger_request' && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold">
                      Chave PIX do Motorista:
                    </p>
                    <p className="text-xs font-mono font-bold text-slate-900 truncate">
                      {settlementModal.targetUser.pixKey || settlementModal.targetUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPix(settlementModal.targetUser?.pixKey || settlementModal.targetUser?.email || '')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitSettlementModal} className="space-y-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Valor a Quitar (R$):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-mono text-base font-bold">R$</span>
                  <input
                    type="number"
                    step="0.50"
                    min="1.00"
                    max="500.00"
                    value={settlementModal.amount}
                    onChange={(e) => setSettlementModal((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-14 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-bold">Valores rápidos:</span>
                  {[6.50, 13.00, 19.50, 26.00, 32.50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSettlementModal((prev) => ({ ...prev, amount: val }))}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-bold hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                    >
                      R$ {val.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes / Proof info */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  {settlementModal.mode === 'passenger_request'
                    ? 'Observação / Comprovante (opcional):'
                    : 'Observação do Acerto:'}
                </label>
                <input
                  type="text"
                  value={settlementModal.notes}
                  onChange={(e) => setSettlementModal((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={
                    settlementModal.mode === 'passenger_request'
                      ? 'Ex: PIX efetuado pelo Nubank às 15:30'
                      : 'Ex: Acerto em dinheiro / Pago presencialmente'
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettlementModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || settlementModal.amount <= 0}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                    settlementModal.mode === 'passenger_request'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmitting ? (
                    <span>Registrando...</span>
                  ) : settlementModal.mode === 'passenger_request' ? (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Informar Quitação</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Ajustar Saldo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECUSAR / CONTESTAR QUITAÇÃO PENDENTE (MOTORISTA) */}
      {rejectModal.isOpen && rejectModal.tx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-display font-bold text-slate-900">
                  Contestar Quitação de Rateio
                </h3>
                <p className="text-xs text-slate-500">
                  Transação: R$ {(rejectModal.tx.valueBRL ?? Math.abs(rejectModal.tx.amount)).toFixed(2)} de {rejectModal.tx.counterpartName || 'Passageiro'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, tx: null, reason: '' })}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Caso você não tenha identificado o pagamento em sua conta bancária ou o valor esteja incorreto, informe uma breve justificativa para que o passageiro possa verificar.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Motivo da recusa / contestação:
              </label>
              <input
                type="text"
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Ex: Valor não caiu na conta / Chave incorreta"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, tx: null, reason: '' })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Confirmar Recusa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
