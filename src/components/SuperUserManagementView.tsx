import React, { useState, useMemo } from 'react';
import { 
  Crown, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Edit3, 
  Trash2, 
  Plus, 
  Car, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpDown, 
  Download, 
  RefreshCw, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  Sparkles, 
  Star, 
  Layers, 
  X, 
  Save, 
  Check, 
  FileText, 
  CreditCard,
  Key,
  ChevronRight,
  ExternalLink,
  Info,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { User, Group, Vehicle, isSuperUser, GeoLocation } from '../types';
import { 
  updateFirestoreUserProfile, 
  deleteFirestoreUser, 
  createFirestoreUserByAdmin,
  purgeOrphanGroupsFromFirestore,
  addFirestoreTransaction
} from '../lib/firebase';
import { searchAddressGeocode, GeocodedPlace } from '../lib/geo';

interface SuperUserManagementViewProps {
  currentUser: User | null;
  allUsers: User[];
  groups: Group[];
  onUsersUpdated?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const SuperUserManagementView: React.FC<SuperUserManagementViewProps> = ({
  currentUser,
  allUsers,
  groups,
  onUsersUpdated,
  onNavigateToTab
}) => {
  // Search and Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'admin' | 'driver' | 'passenger' | 'both'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'with_vehicle' | 'without_vehicle' | 'with_routine' | 'positive_balance' | 'negative_balance'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'created_desc' | 'balance_desc' | 'rides_offered_desc' | 'rides_taken_desc' | 'rating_desc'>('name_asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [balanceUser, setBalanceUser] = useState<User | null>(null);
  const [balanceAdjustment, setBalanceAdjustment] = useState<number>(0);
  const [balanceAdjustmentNotes, setBalanceAdjustmentNotes] = useState('');
  const [isPurgingOrphanGroups, setIsPurgingOrphanGroups] = useState(false);
  const [orphanPurgeResult, setOrphanPurgeResult] = useState<{ deletedCount: number; deletedGroups: { id: string; name: string; reason: string }[] } | null>(null);
  const [showOrphanModal, setShowOrphanModal] = useState(false);

  // Address Geocode Search State for Edit Modal
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodedPlace[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Success Notification Toast within view
  const [toastMessage, setToastMessage] = useState<{ title: string; text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (title: string, text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ title, text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Identify Orphan Groups (groups where no members or creators exist in allUsers)
  const orphanGroups = useMemo(() => {
    const userIds = new Set(allUsers.map((u) => u.id));
    return groups.filter((g) => {
      const members = g.memberIds || [];
      const hasActiveMembers = members.some((id) => userIds.has(id));
      const hasActiveCreator = g.creatorId ? userIds.has(g.creatorId) : false;
      return !hasActiveMembers && !hasActiveCreator;
    });
  }, [groups, allUsers]);

  // Analytics KPIs
  const stats = useMemo(() => {
    const total = allUsers.length;
    const superAdmins = allUsers.filter((u) => isSuperUser(u)).length;
    const admins = allUsers.filter((u) => u.role === 'admin').length;
    const verified = allUsers.filter((u) => u.emailVerified).length;
    const drivers = allUsers.filter((u) => u.role === 'driver' || u.rolePreference === 'driver' || u.rolePreference === 'both' || (u.vehicles && u.vehicles.length > 0)).length;
    const passengers = allUsers.filter((u) => u.role === 'passenger' || u.rolePreference === 'passenger' || u.rolePreference === 'both').length;
    const withVehicles = allUsers.filter((u) => (u.vehicles && u.vehicles.length > 0) || (u.vehicle && u.vehicle.model)).length;
    const totalBalance = allUsers.reduce((acc, u) => acc + (u.saldo_caronas || 0), 0);
    const withRoutine = allUsers.filter((u) => u.routine && u.routine.departureTime).length;

    return {
      total,
      superAdmins,
      admins,
      verified,
      verifiedPct: total > 0 ? Math.round((verified / total) * 100) : 0,
      drivers,
      passengers,
      withVehicles,
      totalBalance,
      withRoutine,
      orphanGroupsCount: orphanGroups.length,
    };
  }, [allUsers, orphanGroups]);

  // Filtered and Sorted Users List
  const filteredUsers = useMemo(() => {
    let list = [...allUsers];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((u) => {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        const cpf = (u.cpf || '').toLowerCase();
        const institution = (u.institutionName || '').toLowerCase();
        const vehiclePlate = u.vehicles?.map((v) => v.plate.toLowerCase()).join(' ') || (u.vehicle?.plate || '').toLowerCase();
        const id = (u.id || '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          cpf.includes(q) ||
          institution.includes(q) ||
          vehiclePlate.includes(q) ||
          id.includes(q)
        );
      });
    }

    // 2. Role Filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'superadmin') {
        list = list.filter((u) => isSuperUser(u));
      } else if (roleFilter === 'admin') {
        list = list.filter((u) => u.role === 'admin');
      } else if (roleFilter === 'driver') {
        list = list.filter((u) => u.role === 'driver' || u.rolePreference === 'driver');
      } else if (roleFilter === 'passenger') {
        list = list.filter((u) => u.role === 'passenger' || u.rolePreference === 'passenger');
      } else if (roleFilter === 'both') {
        list = list.filter((u) => u.rolePreference === 'both');
      }
    }

    // 3. Verified Filter
    if (verifiedFilter === 'verified') {
      list = list.filter((u) => u.emailVerified);
    } else if (verifiedFilter === 'unverified') {
      list = list.filter((u) => !u.emailVerified);
    }

    // 4. Asset Filter
    if (assetFilter === 'with_vehicle') {
      list = list.filter((u) => (u.vehicles && u.vehicles.length > 0) || (u.vehicle && u.vehicle.model));
    } else if (assetFilter === 'without_vehicle') {
      list = list.filter((u) => (!u.vehicles || u.vehicles.length === 0) && (!u.vehicle || !u.vehicle.model));
    } else if (assetFilter === 'with_routine') {
      list = list.filter((u) => u.routine && u.routine.departureTime);
    } else if (assetFilter === 'positive_balance') {
      list = list.filter((u) => (u.saldo_caronas || 0) > 0);
    } else if (assetFilter === 'negative_balance') {
      list = list.filter((u) => (u.saldo_caronas || 0) < 0);
    }

    // 5. Sorting
    list.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'created_desc') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      } else if (sortBy === 'balance_desc') {
        return (b.saldo_caronas || 0) - (a.saldo_caronas || 0);
      } else if (sortBy === 'rides_offered_desc') {
        return (b.totalRidesOffered || 0) - (a.totalRidesOffered || 0);
      } else if (sortBy === 'rides_taken_desc') {
        return (b.totalRidesTaken || 0) - (a.totalRidesTaken || 0);
      } else if (sortBy === 'rating_desc') {
        return (b.rating || 0) - (a.rating || 0);
      }
      return 0;
    });

    return list;
  }, [allUsers, searchQuery, roleFilter, verifiedFilter, assetFilter, sortBy]);

  // Handler: 1-click Toggle SuperAdmin/Admin
  const handleToggleSuperAdmin = async (targetUser: User) => {
    const isCurrentlySuper = isSuperUser(targetUser);
    const newIsSuper = !isCurrentlySuper;
    const newRole = newIsSuper ? 'superadmin' : 'user';

    try {
      await updateFirestoreUserProfile(targetUser.id, {
        isSuperUser: newIsSuper,
        role: newRole,
      });
      showToast(
        'Permissão Atualizada!',
        `${targetUser.name} agora é ${newIsSuper ? 'Superadministrador' : 'Usuário Padrão'}.`
      );
      onUsersUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar privilégios', String(err), 'error');
    }
  };

  // Handler: 1-click Toggle Email Verification
  const handleToggleEmailVerified = async (targetUser: User) => {
    const newVerified = !targetUser.emailVerified;
    try {
      await updateFirestoreUserProfile(targetUser.id, {
        emailVerified: newVerified,
      });
      showToast(
        'Validação de E-mail Atualizada',
        `O e-mail de ${targetUser.name} foi marcado como ${newVerified ? 'Verificado (Válido)' : 'Não Verificado'}.`
      );
      onUsersUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar validação', String(err), 'error');
    }
  };

  // Handler: Quick Balance Adjustment
  const handleApplyBalanceAdjustment = async () => {
    if (!balanceUser) return;
    try {
      const newSaldo = (balanceUser.saldo_caronas || 0) + balanceAdjustment;
      await updateFirestoreUserProfile(balanceUser.id, {
        saldo_caronas: newSaldo,
      });

      // Register ledger transaction
      if (balanceAdjustment !== 0) {
        await addFirestoreTransaction({
          userId: balanceUser.id,
          rideId: `admin-adj-${Date.now()}`,
          amount: balanceAdjustment,
          valueBRL: Math.abs(balanceAdjustment * 6.5),
          type: balanceAdjustment > 0 ? 'BONUS_RECIPROCITY' : 'SETTLEMENT',
          category: balanceAdjustment > 0 ? 'BONUS' : 'REFUND',
          status: 'COMPLETED',
          description: balanceAdjustmentNotes || `Ajuste manual efetuado pelo Superadministrador (${balanceAdjustment > 0 ? '+' : ''}${balanceAdjustment} pontos / R$ ${(balanceAdjustment * 6.5).toFixed(2)})`,
          counterpartName: 'Superadministrador (Ajuste do Sistema)',
          timestamp: new Date().toISOString(),
        });
      }

      showToast(
        'Saldo Ajustado!',
        `Novo saldo de ${balanceUser.name}: ${newSaldo} pontos (R$ ${(newSaldo * 6.5 + 39).toFixed(2)}).`
      );
      setBalanceUser(null);
      setBalanceAdjustment(0);
      setBalanceAdjustmentNotes('');
      onUsersUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao ajustar saldo', String(err), 'error');
    }
  };

  // Handler: Delete User Account
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      showToast('Confirmação inválida', 'Digite EXCLUIR para confirmar.', 'error');
      return;
    }

    try {
      await deleteFirestoreUser(userToDelete.id);
      showToast(
        'Usuário Excluído com Sucesso',
        `A conta de ${userToDelete.name} (${userToDelete.email}) foi removida permanentemente do Firestore.`
      );
      setUserToDelete(null);
      setDeleteConfirmText('');
      onUsersUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir usuário', String(err), 'error');
    }
  };

  // Handler: Purge Orphan Groups
  const handlePurgeOrphanGroups = async () => {
    setIsPurgingOrphanGroups(true);
    try {
      const result = await purgeOrphanGroupsFromFirestore();
      setOrphanPurgeResult(result);
      setShowOrphanModal(true);
      showToast(
        'Varredura Concluída!',
        `${result.deletedCount} grupo(s) órfão(s) sem usuários associados foram excluídos do Firestore.`
      );
      onUsersUpdated?.();
    } catch (err) {
      console.error(err);
      showToast('Erro na limpeza de grupos', String(err), 'error');
    } finally {
      setIsPurgingOrphanGroups(false);
    }
  };

  // Handler: Export Users (CSV)
  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'E-mail', 'Telefone', 'CPF', 'Instituicao', 'Papel', 'SuperAdmin', 'EmailVerificado', 'SaldoPontos', 'SaldoReais', 'Rating', 'CaronasOfertadas', 'CaronasPegas', 'GruposAssociados', 'DataCriacao'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${(u.phone || '').replace(/"/g, '""')}"`,
      `"${(u.cpf || '').replace(/"/g, '""')}"`,
      `"${(u.institutionName || '').replace(/"/g, '""')}"`,
      u.role || 'user',
      isSuperUser(u) ? 'SIM' : 'NAO',
      u.emailVerified ? 'SIM' : 'NAO',
      u.saldo_caronas || 0,
      ((u.saldo_caronas || 0) * 6.5 + 39).toFixed(2),
      u.rating || 5.0,
      u.totalRidesOffered || 0,
      u.totalRidesTaken || 0,
      `"${(u.groups || []).join('; ')}"`,
      u.createdAt || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `usuarios_caronas_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exportação Concluída', 'O relatório CSV dos usuários foi gerado e baixado.');
  };

  // Address Autocomplete for Edit Modal
  const handleSearchAddress = async (val: string) => {
    setAddressSearchQuery(val);
    if (!val || val.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const results = await searchAddressGeocode(val);
      setAddressSuggestions(results);
    } catch (e) {
      console.warn('Geocoding error:', e);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in">
      {/* Toast Feedback */}
      {toastMessage && (
        <div 
          className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-xl border flex items-start space-x-3 transition-all duration-300 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-900 text-white border-emerald-700' 
              : toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-indigo-900 text-white border-indigo-700'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          {toastMessage.type === 'info' && <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <h4 className="text-xs font-bold">{toastMessage.title}</h4>
            <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{toastMessage.text}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/70 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                Painel do Superusuário
              </span>
              <span className="text-xs text-slate-400 font-mono">Gestão de Usuários & Limpeza de Grupos</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
              Administração de Cadastros & Integridade da Base
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Gerencie todos os perfis cadastrados no Google Cloud Firestore, edite papéis, aprove e valide e-mails, audite saldos e elimine grupos órfãos sem usuários vinculados.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsNewUserModalOpen(true)}
              id="btn-admin-new-user"
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Usuário</span>
            </button>

            <button
              onClick={handlePurgeOrphanGroups}
              disabled={isPurgingOrphanGroups}
              id="btn-admin-purge-orphan-groups"
              className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition border border-rose-500/50 shadow-sm cursor-pointer disabled:opacity-50"
              title="Exclui do Firestore todos os grupos que não possuem usuários associados"
            >
              {isPurgingOrphanGroups ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Excluir Grupos Órfãos ({stats.orphanGroupsCount})</span>
            </button>

            <button
              onClick={handleExportCSV}
              id="btn-admin-export-csv"
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Analytics KPIs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Total Usuários</span>
              <Users className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-xl font-black text-white mt-1">{stats.total}</p>
            <p className="text-[10px] text-emerald-400 font-mono mt-0.5">Base Firestore</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>E-mails Válidos</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xl font-black text-emerald-400 mt-1">{stats.verifiedPct}%</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{stats.verified} de {stats.total} contas</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Motoristas</span>
              <Car className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <p className="text-xl font-black text-sky-400 mt-1">{stats.drivers}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{stats.withVehicles} com veículo</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Passageiros</span>
              <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-xl font-black text-purple-400 mt-1">{stats.passengers}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{stats.withRoutine} com rotina</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>SuperAdmins</span>
              <Crown className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xl font-black text-amber-400 mt-1">{stats.superAdmins}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Privilégio total</p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Grupos Órfãos</span>
              <Layers className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className={`text-xl font-black mt-1 ${stats.orphanGroupsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {stats.orphanGroupsCount}
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              {stats.orphanGroupsCount === 0 ? 'Base limpa ✅' : 'Sem usuários ⚠️'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-superadmin-user-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nome, E-mail, CPF, Telefone, Instituição, Placa ou ID..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1.5 shrink-0 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tabela
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cards
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {/* Role Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Papel / Permissão
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
            >
              <option value="all">Todos os Papéis ({allUsers.length})</option>
              <option value="superadmin">👑 SuperAdmin ({stats.superAdmins})</option>
              <option value="admin">🛡️ Administrador ({stats.admins})</option>
              <option value="driver">🚗 Motorista ({stats.drivers})</option>
              <option value="passenger">🎒 Passageiro ({stats.passengers})</option>
              <option value="both">🔄 Ambos (Motorista + Passageiro)</option>
            </select>
          </div>

          {/* Verification Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Status E-mail
            </label>
            <select
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
            >
              <option value="all">Todos os Status</option>
              <option value="verified">✅ E-mail Verificado ({stats.verified})</option>
              <option value="unverified">⚠️ Pendente de Validação ({stats.total - stats.verified})</option>
            </select>
          </div>

          {/* Asset Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Ativos / Rotina
            </label>
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
            >
              <option value="all">Todos os Vínculos</option>
              <option value="with_vehicle">🚗 Com Veículo Cadastrado ({stats.withVehicles})</option>
              <option value="without_vehicle">Sem Veículo</option>
              <option value="with_routine">⏱️ Com Rotina Diária ({stats.withRoutine})</option>
              <option value="positive_balance">💰 Saldo Positivo (+)</option>
              <option value="negative_balance">🔻 Saldo Devedor (-)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-hidden"
            >
              <option value="name_asc">Nome (A-Z)</option>
              <option value="created_desc">Mais Recentes</option>
              <option value="balance_desc">Maior Saldo (R$)</option>
              <option value="rides_offered_desc">Mais Caronas Ofertadas</option>
              <option value="rides_taken_desc">Mais Caronas Pegas</option>
              <option value="rating_desc">Melhor Avaliação (⭐)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orphan Groups Notice Banner if any detected */}
      {orphanGroups.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold">
                Atenção: {orphanGroups.length} Grupo(s) Órfão(s) Detectados no Firestore
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Existem grupos cujos membros e criadores não constam no cadastro ativo de usuários. Você pode eliminá-los com 1 clique.
              </p>
            </div>
          </div>
          <button
            onClick={handlePurgeOrphanGroups}
            disabled={isPurgingOrphanGroups}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Grupos Órfãos Agora</span>
          </button>
        </div>
      )}

      {/* Users Count and List View */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>Mostrando <strong className="text-slate-900">{filteredUsers.length}</strong> de {allUsers.length} usuários cadastrados</span>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setVerifiedFilter('all');
                setAssetFilter('all');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">Nenhum usuário encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Não encontramos nenhum registro correspondente aos filtros e termo de busca informados.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setVerifiedFilter('all');
                setAssetFilter('all');
              }}
              className="px-3.5 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition cursor-pointer"
            >
              Restaurar Lista Completa
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* Detailed Table Mode */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Contato & Doc</th>
                    <th className="py-3 px-4">Papel & Status</th>
                    <th className="py-3 px-4">Veículo</th>
                    <th className="py-3 px-4">Saldo / Avaliação</th>
                    <th className="py-3 px-4">Grupos</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const isUserSuper = isSuperUser(user);
                    const vehicle = user.vehicles?.[0] || user.vehicle;
                    const balance = user.saldo_caronas || 0;
                    const balanceReais = balance * 6.5 + 39;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* User Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                              alt={user.name}
                              className="w-10 h-10 rounded-2xl object-cover ring-1 ring-slate-200 shrink-0"
                            />
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900 text-xs">{user.name}</span>
                                {isUserSuper && (
                                  <span className="p-0.5 bg-amber-100 text-amber-800 rounded-sm text-[9px] font-bold border border-amber-300" title="Superadministrador">
                                    <Crown className="w-2.5 h-2.5 inline text-amber-600" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {user.id}</p>
                              <p className="text-[10px] text-slate-500 font-medium truncate max-w-[160px]">{user.institutionName || 'Não informada'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contact & Document */}
                        <td className="py-3.5 px-4 font-medium">
                          <p className="text-slate-800 font-mono text-[11px]">{user.email}</p>
                          <p className="text-slate-500 text-[10px] font-mono">{user.phone || 'Sem telefone'}</p>
                          {user.cpf && <p className="text-slate-400 text-[9px] font-mono">CPF: {user.cpf}</p>}
                        </td>

                        {/* Role & Status */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isUserSuper 
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                  : user.role === 'admin' 
                                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                  : user.role === 'driver' || user.rolePreference === 'driver'
                                  ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                  : 'bg-purple-100 text-purple-900 border border-purple-200'
                              }`}>
                                {isUserSuper ? 'SuperAdmin' : user.role === 'admin' ? 'Admin' : user.rolePreference === 'both' ? 'Motorista & Passageiro' : user.rolePreference === 'driver' ? 'Motorista' : 'Passageiro'}
                              </span>
                            </div>
                            <div>
                              {user.emailVerified ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  E-mail Verificado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                                  <AlertCircle className="w-3 h-3 text-amber-500" />
                                  Validação Pendente
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Vehicle */}
                        <td className="py-3.5 px-4">
                          {vehicle && vehicle.model ? (
                            <div className="space-y-0.5">
                              <p className="text-slate-900 font-bold text-[11px] flex items-center gap-1">
                                <Car className="w-3 h-3 text-indigo-600" />
                                <span>{vehicle.model}</span>
                              </p>
                              <p className="text-slate-500 text-[10px] font-mono">
                                Placa: <strong className="text-slate-700">{vehicle.plate}</strong> ({vehicle.color})
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sem veículo</span>
                          )}
                        </td>

                        {/* Saldo & Stats */}
                        <td className="py-3.5 px-4">
                          <div>
                            <p className={`font-bold font-mono text-xs ${balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {balance >= 0 ? `+ R$ ${balanceReais.toFixed(2)}` : `- R$ ${Math.abs(balance * 6.5).toFixed(2)}`}
                              <span className="text-[10px] text-slate-400 font-normal ml-1">({balance} pts)</span>
                            </p>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                              <span className="flex items-center text-amber-600 font-bold">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                                {user.rating || 5.0}
                              </span>
                              <span>•</span>
                              <span>{user.totalRidesOffered || 0} ofertadas</span>
                              <span>•</span>
                              <span>{user.totalRidesTaken || 0} pegas</span>
                            </div>
                          </div>
                        </td>

                        {/* Groups */}
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {user.groups?.length || 0} grupo(s)
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Quick Balance Button */}
                            <button
                              onClick={() => {
                                setBalanceUser(user);
                                setBalanceAdjustment(0);
                                setBalanceAdjustmentNotes('');
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Ajustar Saldo"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>

                            {/* Quick Verify Email */}
                            <button
                              onClick={() => handleToggleEmailVerified(user)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                user.emailVerified 
                                  ? 'text-emerald-600 hover:bg-emerald-50' 
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={user.emailVerified ? 'Marcar e-mail como não verificado' : 'Aprovar/Validar e-mail manualmente'}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>

                            {/* Quick SuperAdmin Toggle */}
                            <button
                              onClick={() => handleToggleSuperAdmin(user)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isUserSuper 
                                  ? 'text-amber-600 hover:bg-amber-50' 
                                  : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                              }`}
                              title={isUserSuper ? 'Revogar SuperAdmin' : 'Promover a SuperAdmin'}
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Profile */}
                            <button
                              onClick={() => {
                                setEditingUser({ ...user });
                                setAddressSearchQuery(user.ponto_encontro_default?.address || '');
                              }}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Editar Cadastro Completo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User */}
                            <button
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteConfirmText('');
                              }}
                              className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition cursor-pointer"
                              title="Excluir Usuário do Firestore"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => {
              const isUserSuper = isSuperUser(user);
              const vehicle = user.vehicles?.[0] || user.vehicle;
              const balance = user.saldo_caronas || 0;
              const balanceReais = balance * 6.5 + 39;

              return (
                <div key={user.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <img
                        src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                        alt={user.name}
                        className="w-12 h-12 rounded-2xl object-cover ring-1 ring-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {isUserSuper && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
                        <p className="text-[10px] text-slate-400 font-mono">ID: {user.id}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isUserSuper 
                        ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                        : user.role === 'admin' 
                        ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {isUserSuper ? 'SuperAdmin' : user.role === 'admin' ? 'Admin' : user.role || 'user'}
                    </span>
                  </div>

                  {/* Card Details */}
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Validação:</span>
                      {user.emailVerified ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verificado
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold flex items-center gap-1 text-[11px]">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> Pendente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Saldo em Conta:</span>
                      <span className={`font-bold font-mono ${balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {balance >= 0 ? `+ R$ ${balanceReais.toFixed(2)}` : `- R$ ${Math.abs(balance * 6.5).toFixed(2)}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Veículo Principal:</span>
                      <span className="font-medium text-slate-800 text-[11px] truncate max-w-[140px]">
                        {vehicle && vehicle.model ? `${vehicle.model} (${vehicle.plate})` : 'Nenhum'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Avaliação / Caronas:</span>
                      <span className="text-slate-700 text-[11px]">
                        ⭐ {user.rating || 5.0} • {user.totalRidesOffered || 0} ofertadas
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleToggleSuperAdmin(user)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                          isUserSuper ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Crown className="w-3 h-3" />
                        <span>{isUserSuper ? 'SuperAdmin' : 'Promover'}</span>
                      </button>

                      <button
                        onClick={() => handleToggleEmailVerified(user)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                          user.emailVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{user.emailVerified ? 'Validado' : 'Validar'}</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setEditingUser({ ...user });
                          setAddressSearchQuery(user.ponto_encontro_default?.address || '');
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Editar Cadastro"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteConfirmText('');
                        }}
                        className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition cursor-pointer"
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT USER FULL PROFILE                                           */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <img
                  src={editingUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                  alt={editingUser.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Editar Cadastro do Usuário</h3>
                  <p className="text-xs text-slate-500 font-mono">ID Firestore: {editingUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Sections */}
            <div className="space-y-4 text-xs">
              {/* Personal Data */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  1. Dados Pessoais & Identificação
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={editingUser.name || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">E-mail Cadastrado</label>
                    <input
                      type="email"
                      value={editingUser.email || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">CPF</label>
                    <input
                      type="text"
                      value={editingUser.cpf || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Instituição / Empresa Vinculada</label>
                    <input
                      type="text"
                      value={editingUser.institutionName || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, institutionName: e.target.value })}
                      placeholder="Ex: Universidade de São Paulo (USP), Nubank, Cubo Itaú..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Roles and Security */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  2. Papel, Permissões & Status de Validação
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Papel no Sistema</label>
                    <select
                      value={editingUser.role || 'user'}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-700"
                    >
                      <option value="user">Usuário Padrão</option>
                      <option value="driver">Motorista</option>
                      <option value="passenger">Passageiro</option>
                      <option value="admin">Administrador</option>
                      <option value="superadmin">Superadministrador (Acesso Total)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Preferência de Uso</label>
                    <select
                      value={editingUser.rolePreference || 'both'}
                      onChange={(e) => setEditingUser({ ...editingUser, rolePreference: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-700"
                    >
                      <option value="both">Ambos (Ofereço e Pego Caronas)</option>
                      <option value="driver">Exclusivamente Motorista</option>
                      <option value="passenger">Exclusivamente Passageiro</option>
                    </select>
                  </div>

                  {/* SuperUser Checkbox */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="edit-is-superuser-chk"
                      checked={editingUser.isSuperUser || false}
                      onChange={(e) => setEditingUser({ ...editingUser, isSuperUser: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500"
                    />
                    <label htmlFor="edit-is-superuser-chk" className="text-xs font-bold text-amber-900 cursor-pointer">
                      Privilégio de Superusuário (SuperAdmin Bypass)
                    </label>
                  </div>

                  {/* Email Verified Checkbox */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="edit-email-verified-chk"
                      checked={editingUser.emailVerified || false}
                      onChange={(e) => setEditingUser({ ...editingUser, emailVerified: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                    />
                    <label htmlFor="edit-email-verified-chk" className="text-xs font-bold text-emerald-900 cursor-pointer">
                      E-mail Oficial Verificado (LGPD / Segurança)
                    </label>
                  </div>
                </div>
              </div>

              {/* Financial & Balances */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  3. Balanço Financeiro & Pontuação
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Saldo em Pontos (Caronas)</label>
                    <input
                      type="number"
                      value={editingUser.saldo_caronas ?? 0}
                      onChange={(e) => setEditingUser({ ...editingUser, saldo_caronas: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Equivalente em R$ (Base)</label>
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-700">
                      R$ {(((editingUser.saldo_caronas || 0) * 6.5) + 39).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Avaliação / Estrelas (0 a 5)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="5.0"
                      value={editingUser.rating ?? 5.0}
                      onChange={(e) => setEditingUser({ ...editingUser, rating: parseFloat(e.target.value) || 5.0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Group Associations */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  4. Grupos & Comunidades Associados ({editingUser.groups?.length || 0})
                </h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl max-h-40 overflow-y-auto space-y-2">
                  {groups.map((group) => {
                    const isMember = editingUser.groups?.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer border ${
                          isMember ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isMember}
                            onChange={(e) => {
                              const current = editingUser.groups || [];
                              if (e.target.checked) {
                                setEditingUser({ ...editingUser, groups: [...current, group.id] });
                              } else {
                                setEditingUser({ ...editingUser, groups: current.filter((g) => g !== group.id) });
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                          />
                          <span>{group.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{group.memberIds?.length || 0} membros</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-save-superadmin-user-edit"
                onClick={async () => {
                  try {
                    await updateFirestoreUserProfile(editingUser.id, editingUser);
                    showToast('Cadastro Salvo!', `As alterações no perfil de ${editingUser.name} foram gravadas no Firestore.`);
                    setEditingUser(null);
                    onUsersUpdated?.();
                  } catch (err) {
                    console.error(err);
                    showToast('Erro ao salvar', String(err), 'error');
                  }
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações no Firestore</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE NEW USER BY ADMIN                                         */}
      {/* ========================================================================= */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Cadastrar Novo Usuário</h3>
                  <p className="text-xs text-slate-500">Criação direta com credenciais e papel provisionados</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
                const institution = (form.elements.namedItem('institution') as HTMLInputElement).value;
                const role = (form.elements.namedItem('role') as HTMLSelectElement).value as any;
                const isSuper = (form.elements.namedItem('isSuper') as HTMLInputElement).checked;
                const verified = (form.elements.namedItem('verified') as HTMLInputElement).checked;

                try {
                  const created = await createFirestoreUserByAdmin({
                    name,
                    email,
                    phone,
                    institutionName: institution || 'Comunidade Corporativa / Acadêmica',
                    avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
                    role,
                    isSuperUser: isSuper,
                    emailVerified: verified,
                    saldo_caronas: isSuper ? 24 : 0,
                    rating: 5.0,
                    totalRidesOffered: 0,
                    totalRidesTaken: 0,
                    groups: groups.map((g) => g.id).slice(0, 2),
                    ponto_encontro_default: {
                      lat: -23.5714,
                      lng: -46.7082,
                      address: 'Ponto Central Metrô Butantã',
                      name: 'Metrô Butantã',
                    },
                  });

                  showToast('Usuário Criado com Sucesso!', `${created.name} (${created.email}) foi cadastrado no Firestore.`);
                  setIsNewUserModalOpen(false);
                  onUsersUpdated?.();
                } catch (err) {
                  console.error(err);
                  showToast('Erro ao criar usuário', String(err), 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ex: João da Silva"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">E-mail Corporativo / Acadêmico *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="joao.silva@empresa.com.br"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Telefone</label>
                  <input
                    type="text"
                    name="phone"
                    placeholder="(11) 98888-7777"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Papel</label>
                  <select
                    name="role"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-700"
                  >
                    <option value="user">Usuário Padrão</option>
                    <option value="driver">Motorista</option>
                    <option value="passenger">Passageiro</option>
                    <option value="admin">Administrador</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Instituição / Empresa</label>
                <input
                  type="text"
                  name="institution"
                  placeholder="Ex: USP, Nubank, Itaú..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2">
                  <input type="checkbox" name="verified" defaultChecked id="new-u-verified" className="w-4 h-4 text-indigo-600 rounded-md" />
                  <label htmlFor="new-u-verified" className="text-xs font-bold text-slate-700 cursor-pointer">E-mail Verificado</label>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center space-x-2">
                  <input type="checkbox" name="isSuper" id="new-u-super" className="w-4 h-4 text-amber-600 rounded-md" />
                  <label htmlFor="new-u-super" className="text-xs font-bold text-amber-900 cursor-pointer">Superusuário</label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK BALANCE ADJUSTMENT                                         */}
      {/* ========================================================================= */}
      {balanceUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ajuste de Saldo de Caronas</h3>
                  <p className="text-xs text-slate-500">{balanceUser.name}</p>
                </div>
              </div>
              <button onClick={() => setBalanceUser(null)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo Atual:</span>
                <span className="font-bold font-mono text-slate-900">
                  {balanceUser.saldo_caronas || 0} pontos (R$ {(((balanceUser.saldo_caronas || 0) * 6.5) + 39).toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Novo Saldo Previsto:</span>
                <span className="font-bold font-mono text-indigo-600">
                  {(balanceUser.saldo_caronas || 0) + balanceAdjustment} pontos (R$ {((((balanceUser.saldo_caronas || 0) + balanceAdjustment) * 6.5) + 39).toFixed(2)})
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Crédito (+) ou Débito (-) em Pontos
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setBalanceAdjustment((prev) => prev - 5)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 cursor-pointer"
                  >
                    -5 pts
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAdjustment((prev) => prev - 1)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 cursor-pointer"
                  >
                    -1 pt
                  </button>
                  <input
                    type="number"
                    value={balanceAdjustment}
                    onChange={(e) => setBalanceAdjustment(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setBalanceAdjustment((prev) => prev + 1)}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 cursor-pointer"
                  >
                    +1 pt
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceAdjustment((prev) => prev + 5)}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 cursor-pointer"
                  >
                    +5 pts
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Motivo / Observação do Ajuste</label>
                <input
                  type="text"
                  value={balanceAdjustmentNotes}
                  onChange={(e) => setBalanceAdjustmentNotes(e.target.value)}
                  placeholder="Ex: Bonificação promocional, estorno de carona..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => setBalanceUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyBalanceAdjustment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE USER PERMANENTLY                                          */}
      {/* ========================================================================= */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Conta Permanentemente</h3>
                <p className="text-xs text-rose-600 font-semibold">Esta ação é irreversível no Firestore</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-slate-700 space-y-2">
              <p>
                Você está prestes a excluir a conta de <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.email}).
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                <li>Perfil completo e rotinas serão apagados.</li>
                <li>Todas as caronas criadas pelo usuário serão canceladas.</li>
                <li>Reservas em outras caronas serão desfeitas.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Digite a palavra <span className="font-mono text-rose-600 font-black">EXCLUIR</span> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 text-xs border border-rose-300 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono font-bold uppercase"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ORPHAN GROUPS PURGE REPORT                                       */}
      {/* ========================================================================= */}
      {showOrphanModal && orphanPurgeResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Relatório de Limpeza de Grupos Órfãos</h3>
                  <p className="text-xs text-slate-500">Expurgo executado no Google Cloud Firestore</p>
                </div>
              </div>
              <button onClick={() => setShowOrphanModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <p className="font-bold text-slate-900">
                {orphanPurgeResult.deletedCount > 0 
                  ? `Foram removidos ${orphanPurgeResult.deletedCount} grupo(s) sem usuários associados:` 
                  : 'Nenhum grupo órfão encontrado. A base de grupos já está 100% íntegra!'}
              </p>

              {orphanPurgeResult.deletedGroups.length > 0 && (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 pt-1">
                  {orphanPurgeResult.deletedGroups.map((g) => (
                    <div key={g.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{g.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {g.id}</p>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-semibold">
                        {g.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowOrphanModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
