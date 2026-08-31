import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  GraduationCap, 
  Building2, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  Globe, 
  UserPlus, 
  ArrowRight,
  Info,
  MapPin,
  Clock,
  DollarSign,
  Car,
  Check,
  X,
  Crown,
  UserCheck,
  Mail,
  Send,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings,
  UserX,
  Search,
  Loader2,
  Navigation,
  Compass,
  ExternalLink,
  Edit3,
  Save,
  Pencil,
  Lock,
  Calendar,
  Layers,
  Building,
  CheckSquare,
  Square,
  LogIn,
  Trash2
} from 'lucide-react';
import { Group, User, Community, Ride, isSuperUser } from '../types';
import { LocationPickerModal } from './LocationPickerModal';
import { searchAddressGeocode, GeocodedPlace } from '../lib/geo';
import { GroupWeeklyScheduleGrid } from './GroupWeeklyScheduleGrid';

const RECURRING_DAYS_OPTIONS = [
  { key: 'Seg', label: 'Segunda', full: 'Segunda-feira' },
  { key: 'Ter', label: 'Terça', full: 'Terça-feira' },
  { key: 'Qua', label: 'Quarta', full: 'Quarta-feira' },
  { key: 'Qui', label: 'Quinta', full: 'Quinta-feira' },
  { key: 'Sex', label: 'Sexta', full: 'Sexta-feira' },
  { key: 'Sáb', label: 'Sábado', full: 'Sábado' },
  { key: 'Dom', label: 'Domingo', full: 'Domingo' },
];

interface GroupsViewProps {
  currentUser: User | null;
  groups: Group[];
  allUsers: User[];
  communities?: Community[];
  rides?: Ride[];
  onJoinGroup?: (groupId: string) => void;
  onRequestJoinGroup: (groupId: string) => void;
  onApproveJoinRequest: (groupId: string, userId: string) => void;
  onRejectJoinRequest: (groupId: string, userId: string) => void;
  onInviteUser: (groupId: string, targetUserId: string) => void;
  onAcceptInvitation: (groupId: string) => void;
  onRejectInvitation: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
  onCreateGroup: (newGroup: Partial<Group>) => void;
  onUpdateGroup?: (groupId: string, updates: Partial<Group>) => void;
  onDeleteGroup?: (groupId: string) => void;
  onCreateRideFromGroup: (group: Group) => void;
  onCreateCommunity?: (newCommunity: Partial<Community>) => Promise<string | void> | void;
  onQuickCreateRide?: (dayDateStr: string, group: Group) => void;
  onQuickBookSeat?: (rideId: string) => void;
  onQuickCancelSeat?: (rideId: string, userId: string) => void;
  onCancelRide?: (rideId: string) => void;
  onNavigateToRideEdit?: (ride: Ride) => void;
  onAddMemberDirectly?: (groupId: string, targetUserId: string) => void;
  onRemoveMember?: (groupId: string, userId: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  currentUser,
  groups,
  allUsers,
  communities = [],
  rides = [],
  onRequestJoinGroup,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onInviteUser,
  onAcceptInvitation,
  onRejectInvitation,
  onLeaveGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateRideFromGroup,
  onCreateCommunity,
  onQuickCreateRide,
  onQuickBookSeat,
  onQuickCancelSeat,
  onCancelRide,
  onNavigateToRideEdit,
  onAddMemberDirectly,
  onRemoveMember,
  onOpenAuth,
}) => {
  const [filterTab, setFilterTab] = useState<'my_and_pending' | 'my_groups' | 'pending' | 'managed' | 'invitations' | 'all'>('my_and_pending');
  const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string>('all');
  const [searchGroupQuery, setSearchGroupQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  const [selectedUserToInvite, setSelectedUserToInvite] = useState<string>('');
  const [selectedUserToAddDirectly, setSelectedUserToAddDirectly] = useState<string>('');
  
  // Track which groups have weekly schedule grid expanded
  const [expandedWeeklyGridGroupId, setExpandedWeeklyGridGroupId] = useState<string | null>(null);

  // Community creation toggle in group modal
  const [isCreatingNewCommunity, setIsCreatingNewCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [newCommunityCategory, setNewCommunityCategory] = useState<'academic' | 'corporate' | 'ecosystem' | 'community'>('academic');

  // Editing Group State (strictly for group creator/manager)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editCategory, setEditCategory] = useState<'academic' | 'corporate' | 'community'>('academic');
  const [editCommunityId, setEditCommunityId] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public');
  const [editRecurringDays, setEditRecurringDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
  const [editDescription, setEditDescription] = useState('');
  const [editDestName, setEditDestName] = useState('');
  const [editDestAddress, setEditDestAddress] = useState('');
  const [editDestLat, setEditDestLat] = useState(-23.5574);
  const [editDestLng, setEditDestLng] = useState(-46.7314);
  const [editDefaultPrice, setEditDefaultPrice] = useState(6.50);
  const [editDefaultDepartureTime, setEditDefaultDepartureTime] = useState('07:30');
  const [isEditGeocoding, setIsEditGeocoding] = useState(false);
  const [editGeocodingFeedback, setEditGeocodingFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [editSuggestedAddresses, setEditSuggestedAddresses] = useState<GeocodedPlace[]>([]);

  // Map Picker & Georeferencing State
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState<'createGroupDest' | 'viewGroupDest' | 'editGroupDest'>('createGroupDest');
  const [previewGroupForMap, setPreviewGroupForMap] = useState<Group | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingFeedback, setGeocodingFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [suggestedAddresses, setSuggestedAddresses] = useState<GeocodedPlace[]>([]);

  // Form State for creating a group
  const [groupName, setGroupName] = useState('');
  const [category, setCategory] = useState<'academic' | 'corporate' | 'community'>('academic');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [recurringDays, setRecurringDays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
  const [description, setDescription] = useState('');
  const [destName, setDestName] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [destLat, setDestLat] = useState(-23.5574);
  const [destLng, setDestLng] = useState(-46.7314);
  const [defaultPrice, setDefaultPrice] = useState(6.50);
  const [defaultDepartureTime, setDefaultDepartureTime] = useState('07:30');

  // Pending invitations for the current user across all groups
  const userPendingInvitations = groups.filter((g) =>
    currentUser ? (g.pendingInvitations || []).some((inv) => inv.userId === currentUser.id) : false
  );

  // Toggle recurring day selection
  const toggleRecurringDay = (dayKey: string, isEdit = false) => {
    if (isEdit) {
      setEditRecurringDays((prev) =>
        prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
      );
    } else {
      setRecurringDays((prev) =>
        prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
      );
    }
  };

  const selectWeekdaysOnly = (isEdit = false) => {
    const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    if (isEdit) setEditRecurringDays(weekdays);
    else setRecurringDays(weekdays);
  };

  const selectAllDays = (isEdit = false) => {
    const all = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    if (isEdit) setEditRecurringDays(all);
    else setRecurringDays(all);
  };

  // Handle geocoding validation via searchAddressGeocode
  const handleValidateAndGeocode = async (addressToSearch?: string) => {
    const query = (addressToSearch || destAddress).trim();
    if (!query) {
      setGeocodingFeedback({ type: 'warning', message: 'Digite um endereço para georreferenciar.' });
      return;
    }

    setIsGeocoding(true);
    setGeocodingFeedback(null);
    setSuggestedAddresses([]);

    try {
      const results = await searchAddressGeocode(query);
      if (results && results.length > 0) {
        const best = results[0];
        setDestLat(Number(best.lat.toFixed(6)));
        setDestLng(Number(best.lng.toFixed(6)));
        setDestAddress(best.address);
        if (!destName) {
          setDestName(best.name || best.address.split(',')[0]);
        }
        setSuggestedAddresses(results.slice(0, 3));
        setGeocodingFeedback({
          type: 'success',
          message: `📍 Localização georreferenciada: (${best.lat.toFixed(4)}, ${best.lng.toFixed(4)})`,
        });
      } else {
        setGeocodingFeedback({
          type: 'warning',
          message: 'Endereço não localizado automaticamente. Você pode apontar o pino diretamente no mapa interativo.',
        });
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setGeocodingFeedback({
        type: 'error',
        message: 'Erro ao validar geolocalização. Use o mapa interativo para marcar o destino.',
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Faça login para criar um grupo.');
      onOpenAuth?.('login');
      return;
    }

    if (!destAddress.trim()) {
      alert('Informe o endereço de destino padrão do grupo.');
      return;
    }

    let finalCommunityId = selectedCommunityId;
    let finalCommunityName = '';

    if (isCreatingNewCommunity && newCommunityName.trim() && onCreateCommunity) {
      const newCommId = `comm-${Date.now()}`;
      await onCreateCommunity({
        id: newCommId,
        name: newCommunityName.trim(),
        description: newCommunityDesc.trim() || 'Comunidade agregadora de grupos de caronas.',
        category: newCommunityCategory,
        icon: newCommunityCategory === 'academic' ? 'GraduationCap' : newCommunityCategory === 'corporate' ? 'Building2' : 'Building',
        memberCount: 1,
        groupsCount: 1,
        isVerified: true,
      });
      finalCommunityId = newCommId;
      finalCommunityName = newCommunityName.trim();
    } else if (finalCommunityId) {
      const comm = communities.find((c) => c.id === finalCommunityId);
      if (comm) finalCommunityName = comm.name;
    }

    onCreateGroup({
      name: groupName.trim(),
      category,
      communityId: finalCommunityId || undefined,
      communityName: finalCommunityName || undefined,
      visibility,
      recurringDays: recurringDays.length > 0 ? recurringDays : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
      description: description.trim(),
      icon: category === 'academic' ? 'GraduationCap' : category === 'corporate' ? 'Building2' : 'Users',
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      adminIds: [currentUser.id],
      defaultDestination: {
        address: destAddress.trim(),
        name: destName.trim() || destAddress.trim(),
        lat: Number(destLat.toFixed(6)),
        lng: Number(destLng.toFixed(6)),
      },
      defaultPrice: Number(defaultPrice) || 6.50,
      defaultDepartureTime: defaultDepartureTime || '07:30',
      memberIds: [currentUser.id],
      memberCount: 1,
    });

    // Reset Form
    setGroupName('');
    setDescription('');
    setSelectedCommunityId('');
    setVisibility('public');
    setRecurringDays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
    setDestName('');
    setDestAddress('');
    setIsCreatingNewCommunity(false);
    setNewCommunityName('');
    setNewCommunityDesc('');
    setShowCreateModal(false);
  };

  const openEditGroupModal = (group: Group) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditCategory(group.category);
    setEditCommunityId(group.communityId || '');
    setEditVisibility(group.visibility || 'public');
    setEditRecurringDays(group.recurringDays || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
    setEditDescription(group.description || '');
    setEditDestName(group.defaultDestination?.name || '');
    setEditDestAddress(group.defaultDestination?.address || '');
    setEditDestLat(group.defaultDestination?.lat || -23.5574);
    setEditDestLng(group.defaultDestination?.lng || -46.7314);
    setEditDefaultPrice(group.defaultPrice ?? 6.50);
    setEditDefaultDepartureTime(group.defaultDepartureTime || '07:30');
    setEditGeocodingFeedback(null);
    setEditSuggestedAddresses([]);
  };

  // Handle geocoding validation for edit modal
  const handleValidateAndGeocodeEdit = async (addressToSearch?: string) => {
    const query = (addressToSearch || editDestAddress).trim();
    if (!query) {
      setEditGeocodingFeedback({ type: 'warning', message: 'Digite um endereço para georreferenciar.' });
      return;
    }

    setIsEditGeocoding(true);
    setEditGeocodingFeedback(null);
    setEditSuggestedAddresses([]);

    try {
      const results = await searchAddressGeocode(query);
      if (results && results.length > 0) {
        const best = results[0];
        setEditDestLat(Number(best.lat.toFixed(6)));
        setEditDestLng(Number(best.lng.toFixed(6)));
        setEditDestAddress(best.address);
        if (!editDestName) {
          setEditDestName(best.name || best.address.split(',')[0]);
        }
        setEditSuggestedAddresses(results.slice(0, 3));
        setEditGeocodingFeedback({
          type: 'success',
          message: `📍 Localização georreferenciada: (${best.lat.toFixed(4)}, ${best.lng.toFixed(4)})`,
        });
      } else {
        setEditGeocodingFeedback({
          type: 'warning',
          message: 'Endereço não localizado automaticamente. Você pode apontar o pino diretamente no mapa interativo.',
        });
      }
    } catch (err) {
      console.error('Error geocoding edit address:', err);
      setEditGeocodingFeedback({
        type: 'error',
        message: 'Erro ao validar geolocalização. Use o mapa interativo para marcar o destino.',
      });
    } finally {
      setIsEditGeocoding(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    if (!isUserGroupManager(editingGroup)) {
      alert('Apenas o gestor/criador do grupo tem permissão para editar as informações.');
      return;
    }

    if (!editDestAddress.trim()) {
      alert('Informe o endereço de destino padrão do grupo.');
      return;
    }

    let finalCommunityName = '';
    if (editCommunityId) {
      const comm = communities.find((c) => c.id === editCommunityId);
      if (comm) finalCommunityName = comm.name;
    }

    const updates: Partial<Group> = {
      name: editGroupName.trim(),
      category: editCategory,
      communityId: editCommunityId || undefined,
      communityName: finalCommunityName || undefined,
      visibility: editVisibility,
      recurringDays: editRecurringDays.length > 0 ? editRecurringDays : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
      description: editDescription.trim(),
      icon: editCategory === 'academic' ? 'GraduationCap' : editCategory === 'corporate' ? 'Building2' : 'Users',
      defaultDestination: {
        address: editDestAddress.trim(),
        name: editDestName.trim() || editDestAddress.trim(),
        lat: Number(editDestLat.toFixed(6)),
        lng: Number(editDestLng.toFixed(6)),
      },
      defaultPrice: Number(editDefaultPrice) || 6.50,
      defaultDepartureTime: editDefaultDepartureTime || '07:30',
    };

    onUpdateGroup?.(editingGroup.id, updates);
    setEditingGroup(null);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'academic':
        return <GraduationCap className="w-5 h-5 text-emerald-600" />;
      case 'corporate':
        return <Building2 className="w-5 h-5 text-indigo-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-600" />;
    }
  };

  const isUserGroupManager = (group: Group): boolean => {
    if (!currentUser) return false;
    if (isSuperUser(currentUser)) return true;
    if (group.creatorId === currentUser.id) return true;
    if (group.adminIds && group.adminIds.includes(currentUser.id)) return true;
    return false;
  };

  // Filter groups according to tab, community, search query, and visibility governance
  const filteredGroups = useMemo(() => {
    // Requisito: Não exibir grupos ativamente quando houver um acesso não logado
    if (!currentUser) {
      const hasActiveSearch = searchGroupQuery.trim().length > 0 || selectedCommunityFilter !== 'all';
      if (!hasActiveSearch) {
        return []; // Acesso deslogado sem pesquisa ativa não exibe grupos
      }
    }

    return groups.filter((g) => {
      // 1. Governance Visibility Rule:
      // If group is private, ONLY show to members, creator, or superuser (hide from guests)
      if (g.visibility === 'private') {
        const isMember = currentUser ? g.memberIds.includes(currentUser.id) : false;
        const isCreator = currentUser ? g.creatorId === currentUser.id : false;
        const isSuper = isSuperUser(currentUser);
        if (!isMember && !isCreator && !isSuper) {
          return false;
        }
      }

      // 2. Filter by Community
      if (selectedCommunityFilter !== 'all') {
        if (g.communityId !== selectedCommunityFilter) {
          return false;
        }
      }

      // 3. Search query filter
      if (searchGroupQuery.trim()) {
        const q = searchGroupQuery.toLowerCase().trim();
        const matchName = g.name.toLowerCase().includes(q);
        const matchDesc = (g.description || '').toLowerCase().includes(q);
        const matchDest = (g.defaultDestination?.address || '').toLowerCase().includes(q) || (g.defaultDestination?.name || '').toLowerCase().includes(q);
        const matchComm = (g.communityName || '').toLowerCase().includes(q);
        const matchCat = (g.category || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchDest && !matchComm && !matchCat) {
          return false;
        }
      }

      // 4. Filter by Tab (for logged in users)
      if (currentUser) {
        if (filterTab === 'my_and_pending') {
          const isMember = g.memberIds.includes(currentUser.id) || g.creatorId === currentUser.id;
          const isPending = (g.pendingJoinRequests || []).some((req) => req.userId === currentUser.id);
          const hasInvite = (g.pendingInvitations || []).some((inv) => inv.userId === currentUser.id);
          const isSuper = isSuperUser(currentUser);
          return isMember || isPending || hasInvite || isSuper;
        }
        if (filterTab === 'managed') {
          return isUserGroupManager(g);
        }
        if (filterTab === 'my_groups') {
          return g.memberIds.includes(currentUser.id) || g.creatorId === currentUser.id;
        }
        if (filterTab === 'pending') {
          return (g.pendingJoinRequests || []).some((req) => req.userId === currentUser.id);
        }
        if (filterTab === 'invitations') {
          return (g.pendingInvitations || []).some((inv) => inv.userId === currentUser.id);
        }
      }

      return true;
    });
  }, [groups, filterTab, selectedCommunityFilter, searchGroupQuery, currentUser]);

  return (
    <div className="space-y-8 pb-12">
      {/* Banner Principal */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-indigo-600" />
              Hierarquia de Comunidades & Grade 1-Clique
            </span>
            <span className="text-xs text-slate-500 font-mono">Governança Público / Privado</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">
            Comunidades, Grupos de Carona & Grade Semanal
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Grupos agregados em <strong>Comunidades</strong> com governança de visibilidade. Na <strong>Grade Semanal (1-Clique)</strong>, motoristas criam caronas instantaneamente e membros confirmam suas vagas com facilidade.
          </p>
        </div>

        <button
          id="btn-open-create-group"
          onClick={() => {
            if (!currentUser) {
              alert('Faça login para criar seu grupo.');
              onOpenAuth?.('login');
              return;
            }
            setShowCreateModal(true);
          }}
          className="w-full sm:w-auto px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-sm flex items-center justify-center space-x-2 transition active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Grupo</span>
        </button>
      </div>

      {/* Banner de Convites Pendentes para o Usuário */}
      {currentUser && userPendingInvitations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-300 rounded-3xl p-5 sm:p-6 shadow-sm animate-in fade-in slide-in-from-top-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-xs">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                    Convite de Entrada Pendente
                  </span>
                  <span className="text-xs text-amber-800 font-semibold">
                    {userPendingInvitations.length} {userPendingInvitations.length === 1 ? 'grupo' : 'grupos'}
                  </span>
                </div>
                <h4 className="font-display font-bold text-slate-900 text-base">
                  Você foi convidado para ingressar em comunidades!
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Os administradores incluíram você nos grupos abaixo. Confirme sua participação para liberar o <strong>Aceite Imediato</strong> nas caronas.
                </p>
              </div>
            </div>

            <button
              onClick={() => setFilterTab('invitations')}
              className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition active:scale-95 flex items-center justify-center space-x-1.5 shrink-0"
            >
              <span>Ver Convites ({userPendingInvitations.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Barra de Filtros: Abas Principais + Seletor de Comunidade Agregadora */}
      <div className="space-y-4">
        {/* Filtro por Comunidade (Hierarquia) */}
        {communities.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs text-slate-700">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold">Agrupamento por Comunidade:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedCommunityFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedCommunityFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas as Comunidades
              </button>

              {communities.map((comm) => (
                <button
                  key={comm.id}
                  onClick={() => setSelectedCommunityFilter(comm.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                    selectedCommunityFilter === comm.id
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span>{comm.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar for Groups */}
        <div className="relative">
          <input
            type="text"
            value={searchGroupQuery}
            onChange={(e) => setSearchGroupQuery(e.target.value)}
            placeholder="Buscar grupos por universidade, empresa, bairro ou destino (ex: USP, Faria Lima, Mackenzie)..."
            className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 pl-11 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
          {searchGroupQuery && (
            <button
              onClick={() => setSearchGroupQuery('')}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-xs px-2 py-1 bg-slate-200 rounded-md cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Tabs de Filtro de Grupos */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs sm:text-sm font-semibold">
          {currentUser ? (
            <>
              <button
                onClick={() => setFilterTab('my_and_pending')}
                className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 ${
                  filterTab === 'my_and_pending'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Grupos que você pertence + grupos com aprovação pendente"
              >
                <Users className="w-4 h-4" />
                <span>
                  Meus Grupos & Aguardando Aprovação (
                  {
                    groups.filter(
                      (g) =>
                        g.memberIds.includes(currentUser.id) ||
                        g.creatorId === currentUser.id ||
                        (g.pendingJoinRequests || []).some((req) => req.userId === currentUser.id)
                    ).length
                  }
                  )
                </span>
              </button>

              <button
                onClick={() => setFilterTab('my_groups')}
                className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 ${
                  filterTab === 'my_groups'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Membro Aprovado ({groups.filter((g) => g.memberIds.includes(currentUser.id)).length})</span>
              </button>

              <button
                onClick={() => setFilterTab('pending')}
                className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 ${
                  filterTab === 'pending'
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>
                  Aguardando Aprovação (
                  {groups.filter((g) => (g.pendingJoinRequests || []).some((r) => r.userId === currentUser.id)).length}
                  )
                </span>
              </button>

              <button
                onClick={() => setFilterTab('managed')}
                className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 ${
                  filterTab === 'managed'
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>Gerenciados por Mim ({groups.filter((g) => isUserGroupManager(g)).length})</span>
              </button>

              <button
                onClick={() => setFilterTab('invitations')}
                className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 relative ${
                  filterTab === 'invitations'
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Convites Recebidos</span>
                {userPendingInvitations.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ml-1">
                    {userPendingInvitations.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setFilterTab('all')}
                className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center space-x-2 ${
                  filterTab === 'all'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Explorar Todos ({groups.length})</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold shadow-xs text-xs flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>Grupos por Pesquisa ({filteredGroups.length})</span>
              </span>
              {searchGroupQuery && (
                <span className="text-xs text-slate-500">
                  Resultados para: <strong>"{searchGroupQuery}"</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid de Grupos */}
      {filteredGroups.length === 0 ? (
        !currentUser && !searchGroupQuery.trim() && selectedCommunityFilter === 'all' ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-lg mx-auto">
              <h4 className="font-display font-bold text-slate-900 text-xl">
                Pesquise Grupos e Comunidades de Carona
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Para preservar a privacidade e governança dos membros universitários e corporativos, os grupos não são exibidos ativamente sem pesquisa. Digite o nome da sua faculdade, empresa ou bairro acima.
              </p>
            </div>

            {/* Quick search chips */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Comunidades & Polos em Destaque:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
                {[
                  'USP',
                  'Mackenzie',
                  'Insper',
                  'Unicamp',
                  'Faria Lima',
                  'Berrini',
                  'Alphaville',
                  'Santo Amaro',
                ].map((hub) => (
                  <button
                    key={hub}
                    type="button"
                    onClick={() => setSearchGroupQuery(hub)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer active:scale-95"
                  >
                    🏢 {hub}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Fazer Login na Conta</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth?.('register')}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Criar Cadastro Gratuito
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-display font-bold text-slate-800 text-base">Nenhum grupo encontrado nesta pesquisa</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {filterTab === 'invitations' 
                ? 'Você não possui convites pendentes no momento.' 
                : filterTab === 'managed' 
                ? 'Você ainda não criou nenhum grupo. Clique em "Criar Novo Grupo" para iniciar sua comunidade.'
                : 'Tente buscar por termos mais amplos ou selecione outra comunidade.'}
            </p>
            {searchGroupQuery && (
              <button
                onClick={() => setSearchGroupQuery('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Limpar Pesquisa
              </button>
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredGroups.map((group) => {
            const isMember = currentUser ? group.memberIds.includes(currentUser.id) : false;
            const isManager = isUserGroupManager(group);
            const members = allUsers.filter((u) => group.memberIds.includes(u.id));
            const hasRequestedJoin = currentUser
              ? (group.pendingJoinRequests || []).some((r) => r.userId === currentUser.id)
              : false;
            const userInvitation = currentUser
              ? (group.pendingInvitations || []).find((i) => i.userId === currentUser.id)
              : null;
            const isManagingThisGroup = managingGroupId === group.id;
            const pendingRequestsCount = (group.pendingJoinRequests || []).length;
            const pendingInvitesCount = (group.pendingInvitations || []).length;
            const isWeeklyGridExpanded = expandedWeeklyGridGroupId === group.id;

            return (
              <div
                key={group.id}
                className={`bg-white border rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-5 transition ${
                  isManager 
                    ? 'border-indigo-200 ring-1 ring-indigo-500/10' 
                    : isMember 
                    ? 'border-emerald-200' 
                    : 'border-slate-200 hover:border-slate-300'
                } ${isWeeklyGridExpanded ? 'lg:col-span-2 xl:col-span-3' : ''}`}
              >
                <div className="space-y-4">
                  {/* Card Top: Category Icon, Community Tag, Visibility Badge, Role Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        {getCategoryIcon(group.category)}
                      </div>
                      {group.communityName && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md flex items-center space-x-1">
                            <Layers className="w-3 h-3 text-indigo-600" />
                            <span>{group.communityName}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* Governance Visibility Badge */}
                      {group.visibility === 'private' ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-purple-600" />
                          <span>Privado</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-blue-600" />
                          <span>Público</span>
                        </span>
                      )}

                      {isManager && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-indigo-600" />
                          <span>Gestor</span>
                        </span>
                      )}

                      {isMember ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Membro</span>
                        </span>
                      ) : userInvitation ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                          <Mail className="w-3 h-3 text-amber-700" />
                          <span>Convite</span>
                        </span>
                      ) : hasRequestedJoin ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Aguardando Aprovação</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Group Info */}
                  <div>
                    <h3 className="font-display font-bold text-slate-900 text-lg">{group.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {group.description || 'Comunidade colaborativa de caronas.'}
                    </p>
                    {group.creatorName && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Criado por: <span className="text-slate-700 font-medium">{group.creatorName}</span>
                      </p>
                    )}
                  </div>

                  {/* Recorrência Semanal Configurada */}
                  {group.recurringDays && group.recurringDays.length > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-semibold">Dias Recorrentes:</span>
                      <div className="flex items-center space-x-1 font-mono text-[11px]">
                        {group.recurringDays.map((d) => (
                          <span key={d} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-800">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default Travel Parameters Box (Obrigatório: Destino, Valor, Horário padrão) */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>Destino Georreferenciado & Herança</span>
                      </span>
                      <span className="text-[10px] text-indigo-600 font-bold font-mono">Padrão do Grupo</span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-start justify-between gap-2 text-slate-700">
                        <div className="flex items-start space-x-2 min-w-0">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">
                              {group.defaultDestination?.name || group.defaultDestination?.address || 'Destino Central'}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {group.defaultDestination?.address}
                            </span>
                            {group.defaultDestination?.lat && group.defaultDestination?.lng && (
                              <div className="flex items-center space-x-1 mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  📍 {group.defaultDestination.lat.toFixed(4)}, {group.defaultDestination.lng.toFixed(4)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {group.defaultDestination && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewGroupForMap(group);
                              setMapPickerTarget('viewGroupDest');
                              setIsMapPickerOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 font-semibold text-[11px] rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-1 shrink-0 transition active:scale-95 cursor-pointer"
                            title="Visualizar localização no mapa interativo"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Ver Mapa</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                        <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center space-x-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans uppercase font-bold">Valor Sugerido</span>
                            <span className="font-bold text-slate-900">R$ {group.defaultPrice?.toFixed(2) || '6.50'}</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans uppercase font-bold">Horário Típico</span>
                            <span className="font-bold text-slate-900">{group.defaultDepartureTime || '07:30'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Members list preview */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Membros Ativos ({group.memberIds.length}):
                      </span>
                      <div className="flex items-center space-x-1.5">
                        {members.slice(0, 4).map((m) => (
                          <img
                            key={m.id}
                            src={m.avatar}
                            alt={m.name}
                            title={`${m.name} (${m.institutionName || 'Membro'})`}
                            className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                          />
                        ))}
                        {group.memberIds.length > 4 && (
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center border border-slate-200">
                            +{group.memberIds.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Toggle Weekly Schedule Grid - apenas para membros ou superuser */}
                      {(isMember || (currentUser && isSuperUser(currentUser))) && (
                        <button
                          type="button"
                          onClick={() => setExpandedWeeklyGridGroupId(isWeeklyGridExpanded ? null : group.id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center space-x-1.5 transition active:scale-95 cursor-pointer ${
                            isWeeklyGridExpanded 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                          }`}
                          title="Abrir a grade semanal de viagens do grupo com criação e reservas em 1-clique"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{isWeeklyGridExpanded ? 'Fechar Grade' : 'Grade Semanal'}</span>
                        </button>
                      )}

                      {isManager && (
                        <>
                          <button
                            type="button"
                            id={`btn-edit-group-${group.id}`}
                            onClick={() => openEditGroupModal(group)}
                            title="Editar informações, comunidade, governança e destino do grupo"
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => setManagingGroupId(isManagingThisGroup ? null : group.id)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 flex items-center space-x-1.5 transition cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Gerenciar</span>
                            {(pendingRequestsCount > 0 || pendingInvitesCount > 0) && (
                              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px]">
                                {pendingRequestsCount + pendingInvitesCount}
                              </span>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Painel de Gestão do Administrador (Solicitações & Convites & Adição Direta em Grupos Privados) */}
                  {isManager && isManagingThisGroup && (
                    <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-4 space-y-4 animate-in fade-in text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
                        <div className="flex items-center space-x-2">
                          <Crown className="w-4 h-4 text-indigo-600" />
                          <h4 className="font-bold text-slate-900">Painel do Gestor do Grupo</h4>
                          {group.visibility === 'private' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-md text-[10px] font-bold">
                              Grupo Privado
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setManagingGroupId(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Adicionar Participante Diretamente (Recurso essencial para grupos privados) */}
                      <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Adicionar Participante Diretamente</span>
                          </span>
                          <span className="text-[10px] text-slate-500">Apenas Gestor</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {group.visibility === 'private'
                            ? 'Em grupos privados, somente você pode incluir participantes diretamente.'
                            : 'Insira um usuário diretamente como membro oficial do grupo.'}
                        </p>
                        <div className="flex gap-2">
                          <select
                            value={selectedUserToAddDirectly}
                            onChange={(e) => setSelectedUserToAddDirectly(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="">Selecione um usuário...</option>
                            {allUsers
                              .filter((u) => !group.memberIds.includes(u.id))
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedUserToAddDirectly}
                            onClick={() => {
                              if (selectedUserToAddDirectly && onAddMemberDirectly) {
                                onAddMemberDirectly(group.id, selectedUserToAddDirectly);
                                setSelectedUserToAddDirectly('');
                              }
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </button>
                        </div>
                      </div>

                      {/* 1. Solicitações de Entrada Pendentes (Grupos Públicos) */}
                      {group.visibility !== 'private' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                              Solicitações de Entrada ({pendingRequestsCount}):
                            </span>
                          </div>

                          {pendingRequestsCount === 0 ? (
                            <p className="text-[11px] text-slate-500 italic bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                              Nenhuma solicitação de entrada aguardando aprovação.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {(group.pendingJoinRequests || []).map((req) => (
                                <div
                                  key={req.userId}
                                  className="bg-white border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <img
                                      src={req.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                      alt={req.userName}
                                      className="w-7 h-7 rounded-full object-cover shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-900 block truncate">{req.userName}</span>
                                      <span className="text-[10px] text-slate-500 block truncate">{req.userEmail}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1 shrink-0">
                                    <button
                                      onClick={() => onApproveJoinRequest(group.id, req.userId)}
                                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                                      title="Aprovar entrada"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onRejectJoinRequest(group.id, req.userId)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                                      title="Recusar entrada"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lista de Membros com Opção de Remover */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                          Gerenciar Membros Atuais:
                        </span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {members.map((m) => {
                            const isCreator = m.id === group.creatorId;
                            return (
                              <div
                                key={m.id}
                                className="bg-white border border-indigo-100 rounded-xl p-2 flex items-center justify-between"
                              >
                                <div className="flex items-center space-x-2">
                                  <img src={m.avatar} alt={m.name} className="w-6 h-6 rounded-full object-cover" />
                                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                                    {m.name} {isCreator && '(Criador)'}
                                  </span>
                                </div>
                                {!isCreator && onRemoveMember && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Remover ${m.name} do grupo?`)) {
                                        onRemoveMember(group.id, m.id);
                                      }
                                    }}
                                    className="text-[10px] text-rose-600 hover:underline p-1"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {onDeleteGroup && (
                        <div className="pt-2 border-t border-indigo-200/60 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem certeza de que deseja excluir o grupo "${group.name}"? Esta ação não pode ser desfeita.`)) {
                                onDeleteGroup(group.id);
                              }
                            }}
                            className="px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir Este Grupo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Componente Modular da Grade Semanal 1-Clique */}
                  {isWeeklyGridExpanded && (
                    <div className="pt-2 animate-in fade-in">
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
                          }
                        }}
                        onQuickCancelSeat={(rideId, userId) => {
                          if (onQuickCancelSeat) {
                            onQuickCancelSeat(rideId, userId);
                          }
                        }}
                        onCancelRide={onCancelRide}
                        onNavigateToRideEdit={onNavigateToRideEdit}
                        onOpenAuth={onOpenAuth}
                      />
                    </div>
                  )}
                </div>

                {/* Card Actions Bottom */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {isMember ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => onCreateRideFromGroup(group)}
                        className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                        title="Publicar viagem com os parâmetros padrão deste grupo"
                      >
                        <Car className="w-4 h-4" />
                        <span>Oferecer Viagem</span>
                      </button>

                      <button
                        onClick={() => setExpandedWeeklyGridGroupId(isWeeklyGridExpanded ? null : group.id)}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <span>{isWeeklyGridExpanded ? 'Ocultar Grade' : 'Grade 1-Clique'}</span>
                      </button>
                    </div>
                  ) : userInvitation ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onAcceptInvitation(group.id)}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Aceitar Convite</span>
                      </button>
                      <button
                        onClick={() => onRejectInvitation(group.id)}
                        className="py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Recusar</span>
                      </button>
                    </div>
                  ) : hasRequestedJoin ? (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-center space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-center space-x-1.5 text-amber-900 font-bold text-xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span>Aguardando Aprovação do Gestor</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-snug">
                        Sua solicitação de adesão está pendente. Apenas informações básicas são exibidas. As opções de adesão e criação de viagens estarão liberadas após a aprovação.
                      </p>
                    </div>
                  ) : group.visibility === 'private' ? (
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-center text-xs text-purple-800 font-medium">
                      Grupo Privado (Adesão apenas por convite do gestor)
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          alert('Faça login para solicitar entrada no grupo.');
                          onOpenAuth?.('login');
                          return;
                        }
                        onRequestJoinGroup(group.id);
                      }}
                      className="w-full py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Solicitar Entrada no Grupo</span>
                    </button>
                  )}

                  {/* Sair do Grupo se já for membro */}
                  {isMember && (
                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja sair do grupo "${group.name}"?`)) {
                          onLeaveGroup(group.id);
                        }
                      }}
                      className="w-full py-2 text-slate-400 hover:text-rose-600 text-[11px] font-semibold transition text-center cursor-pointer"
                    >
                      Sair do Grupo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Criar Grupo com Gestão, Comunidade, Governança e Recorrência Semanal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-lg">Criar Novo Grupo de Carona</h3>
                  <p className="text-xs text-slate-500">Defina a comunidade mãe, governança de acesso e parâmetros padrão</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* 1. SELEÇÃO DA COMUNIDADE MÃE (Hierarquia) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-900 font-bold flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Comunidade Agregadora (Hierarquia)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCommunity(!isCreatingNewCommunity)}
                    className="text-indigo-600 hover:text-indigo-700 font-bold text-[11px] underline cursor-pointer"
                  >
                    {isCreatingNewCommunity ? 'Selecionar Existente' : '+ Criar Nova Comunidade'}
                  </button>
                </div>

                {isCreatingNewCommunity ? (
                  <div className="space-y-2.5 bg-white p-3 rounded-xl border border-indigo-200">
                    <input
                      type="text"
                      required={isCreatingNewCommunity}
                      value={newCommunityName}
                      onChange={(e) => setNewCommunityName(e.target.value)}
                      placeholder="Nome da Nova Comunidade (Ex: Universidade Federal de SP)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                      type="text"
                      value={newCommunityDesc}
                      onChange={(e) => setNewCommunityDesc(e.target.value)}
                      placeholder="Descrição breve da comunidade mãe..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <select
                      value={newCommunityCategory}
                      onChange={(e) => setNewCommunityCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="academic">🎓 Acadêmica</option>
                      <option value="corporate">🏢 Corporativa</option>
                      <option value="ecosystem">🌐 Ecossistema / Polo Regional</option>
                    </select>
                  </div>
                ) : (
                  <select
                    value={selectedCommunityId}
                    onChange={(e) => setSelectedCommunityId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">Sem vínculo com comunidade mãe (Grupo independente)</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category === 'academic' ? 'Acadêmica' : 'Corporativa'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. GOVERNANÇA DE VISIBILIDADE (Público vs Privado) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <label className="block text-slate-900 font-bold">
                  Governança & Visibilidade do Grupo *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition cursor-pointer ${
                      visibility === 'public'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-950 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Globe className={`w-5 h-5 shrink-0 mt-0.5 ${visibility === 'public' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <span className="font-bold text-xs block">🌐 Público</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        Disponível para qualquer usuário buscar e solicitar adesão.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition cursor-pointer ${
                      visibility === 'private'
                        ? 'bg-purple-50/80 border-purple-500 text-purple-950 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Lock className={`w-5 h-5 shrink-0 mt-0.5 ${visibility === 'private' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div>
                      <span className="font-bold text-xs block">🔒 Privado</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        Só aparece para membros. Criador adiciona participantes diretamente.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. RECORRÊNCIA SEMANAL (Substitui os presets rápidos) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-900 font-bold flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Recorrência Semanal da Grade *</span>
                  </label>
                  <div className="flex items-center space-x-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => selectWeekdaysOnly(false)}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      Seg a Sex
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllDays(false)}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {RECURRING_DAYS_OPTIONS.map((day) => {
                    const isSelected = recurringDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleRecurringDay(day.key, false)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{day.key}</span>
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Dias selecionados para gerar e sincronizar a grade semanal simplificada (1-clique).
                </p>
              </div>

              {/* Informações Básicas do Grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Nome do Grupo *</label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: USP / Poli - Engenharia ou Nubank Pinheiros"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Categoria *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer font-medium"
                  >
                    <option value="academic">🎓 Acadêmico (Universidades & Faculdades)</option>
                    <option value="corporate">🏢 Corporativo (Empresas & Hubs de Negócios)</option>
                    <option value="community">🌐 Comunidade Geral & Bairro</option>
                  </select>
                </div>
              </div>

              {/* SEÇÃO OBRIGATÓRIA: DADOS PADRÃO DE VIAGEM COM GEOREFERENCIAMENTO COMPLETO */}
              <div className="bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-display font-bold text-slate-900 text-sm block">
                        Destino Georreferenciado & Herança de Viagem *
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Validação por endereço ou apontamento interativo no mapa
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMapPickerTarget('createGroupDest');
                      setIsMapPickerOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>

                {/* Input de Endereço + Botão de Validação/Geocode */}
                <div className="space-y-1.5">
                  <label className="block text-slate-800 font-bold mb-1">
                    Endereço de Destino Central do Grupo *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        value={destAddress}
                        onChange={(e) => {
                          setDestAddress(e.target.value);
                          if (!destName) setDestName(e.target.value.split(',')[0]);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleValidateAndGeocode();
                          }
                        }}
                        placeholder="Ex: Av. Prof. Luciano Gualberto, 380 - Butantã, São Paulo - SP"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                      {destAddress && (
                        <button
                          type="button"
                          onClick={() => setDestAddress('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleValidateAndGeocode()}
                      disabled={isGeocoding || !destAddress.trim()}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shrink-0"
                    >
                      {isGeocoding ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Validando...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Validar Georreferência</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Feedback de Georreferência */}
                  {geocodingFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 border animate-in fade-in ${
                        geocodingFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : geocodingFeedback.type === 'warning'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {geocodingFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold block">{geocodingFeedback.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPickerTarget('createGroupDest');
                          setIsMapPickerOpen(true);
                        }}
                        className="text-[11px] font-bold underline hover:opacity-80 shrink-0 cursor-pointer"
                      >
                        Ajustar no Mapa
                      </button>
                    </div>
                  )}

                  {/* Sugestões de Endereços Geocodificados */}
                  {suggestedAddresses.length > 1 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Outros resultados compatíveis:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedAddresses.map((place, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setDestAddress(place.address);
                              setDestLat(Number(place.lat.toFixed(6)));
                              setDestLng(Number(place.lng.toFixed(6)));
                              if (!destName) setDestName(place.name || place.address.split(',')[0]);
                              setGeocodingFeedback({
                                type: 'success',
                                message: `📍 Selecionado: (${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})`,
                              });
                            }}
                            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 hover:border-indigo-200 rounded-lg text-[10px] truncate max-w-xs transition cursor-pointer"
                          >
                            📍 {place.address}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Badge de Coordenadas Atuais */}
                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-600">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Coordenadas GPS: <strong>Lat {destLat.toFixed(4)}, Lng {destLng.toFixed(4)}</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMapPickerTarget('createGroupDest');
                        setIsMapPickerOpen(true);
                      }}
                      className="text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      Abrir Mapa Interativo ↗
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-indigo-100">
                  <div>
                    <label className="block text-slate-800 font-bold mb-1">Nome do Ponto / Polo</label>
                    <input
                      type="text"
                      value={destName}
                      onChange={(e) => setDestName(e.target.value)}
                      placeholder="Ex: Campus Butantã ou Sede Nubank"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-800 font-bold mb-1">Valor Sugerido (R$) *</label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        required
                        value={defaultPrice}
                        onChange={(e) => setDefaultPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-800 font-bold mb-1">Horário Típico *</label>
                      <input
                        type="time"
                        required
                        value={defaultDepartureTime}
                        onChange={(e) => setDefaultDepartureTime(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Regras e Descrição do Grupo</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o propósito da comunidade, dias de semana, dicas de embarque..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Grupo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Informações do Grupo */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-lg">Editar Informações do Grupo</h3>
                  <p className="text-xs text-slate-500">Altere comunidade, governança, recorrência e parâmetros herdados</p>
                </div>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* 1. SELEÇÃO DA COMUNIDADE MÃE */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-2">
                <label className="text-slate-900 font-bold flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Comunidade Agregadora</span>
                </label>
                <select
                  value={editCommunityId}
                  onChange={(e) => setEditCommunityId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="">Sem vínculo com comunidade mãe (Grupo independente)</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category === 'academic' ? 'Acadêmica' : 'Corporativa'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. GOVERNANÇA DE VISIBILIDADE (Público vs Privado) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <label className="block text-slate-900 font-bold">
                  Governança & Visibilidade do Grupo *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditVisibility('public')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition cursor-pointer ${
                      editVisibility === 'public'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-950 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Globe className={`w-5 h-5 shrink-0 mt-0.5 ${editVisibility === 'public' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <span className="font-bold text-xs block">🌐 Público</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        Disponível para qualquer usuário buscar e solicitar adesão.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditVisibility('private')}
                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition cursor-pointer ${
                      editVisibility === 'private'
                        ? 'bg-purple-50/80 border-purple-500 text-purple-950 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Lock className={`w-5 h-5 shrink-0 mt-0.5 ${editVisibility === 'private' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div>
                      <span className="font-bold text-xs block">🔒 Privado</span>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        Só aparece para membros. Criador adiciona participantes diretamente.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. RECORRÊNCIA SEMANAL */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-900 font-bold flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Recorrência Semanal da Grade *</span>
                  </label>
                  <div className="flex items-center space-x-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => selectWeekdaysOnly(true)}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      Seg a Sex
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllDays(true)}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {RECURRING_DAYS_OPTIONS.map((day) => {
                    const isSelected = editRecurringDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleRecurringDay(day.key, true)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{day.key}</span>
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Nome do Grupo *</label>
                  <input
                    type="text"
                    required
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    placeholder="Ex: USP Poli - Caronas Diárias"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-800 font-bold mb-1">Categoria *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="academic">🎓 Acadêmico (Universidades & Faculdades)</option>
                    <option value="corporate">🏢 Corporativo (Empresas & Hubs de Negócios)</option>
                    <option value="community">🌐 Comunidade Geral & Bairro</option>
                  </select>
                </div>
              </div>

              {/* SEÇÃO OBRIGATÓRIA: DESTINO GEORREFERENCIADO */}
              <div className="bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-display font-bold text-slate-900 text-sm block">
                        Destino Georreferenciado & Herança de Viagem *
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Validação por endereço ou apontamento interativo no mapa
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMapPickerTarget('editGroupDest');
                      setIsMapPickerOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>

                {/* Input de Endereço + Botão de Validação/Geocode */}
                <div className="space-y-1.5">
                  <label className="block text-slate-800 font-bold mb-1">
                    Endereço de Destino Central do Grupo *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        value={editDestAddress}
                        onChange={(e) => {
                          setEditDestAddress(e.target.value);
                          if (!editDestName) setEditDestName(e.target.value.split(',')[0]);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleValidateAndGeocodeEdit();
                          }
                        }}
                        placeholder="Ex: Av. Paulista, 1106 - Bela Vista, São Paulo - SP"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                      {editDestAddress && (
                        <button
                          type="button"
                          onClick={() => setEditDestAddress('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleValidateAndGeocodeEdit()}
                      disabled={isEditGeocoding || !editDestAddress.trim()}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shrink-0"
                    >
                      {isEditGeocoding ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Validando...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Validar Georreferência</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Feedback de Georreferência */}
                  {editGeocodingFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 border animate-in fade-in ${
                        editGeocodingFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : editGeocodingFeedback.type === 'warning'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {editGeocodingFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold block">{editGeocodingFeedback.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPickerTarget('editGroupDest');
                          setIsMapPickerOpen(true);
                        }}
                        className="text-[11px] font-bold underline hover:opacity-80 shrink-0 cursor-pointer"
                      >
                        Ajustar no Mapa
                      </button>
                    </div>
                  )}

                  {/* Sugestões de Endereços Geocodificados */}
                  {editSuggestedAddresses.length > 1 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Outros resultados compatíveis:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {editSuggestedAddresses.map((place, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setEditDestAddress(place.address);
                              setEditDestLat(Number(place.lat.toFixed(6)));
                              setEditDestLng(Number(place.lng.toFixed(6)));
                              if (!editDestName) setEditDestName(place.name || place.address.split(',')[0]);
                              setEditGeocodingFeedback({
                                type: 'success',
                                message: `📍 Selecionado: (${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})`,
                              });
                            }}
                            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 hover:border-indigo-200 rounded-lg text-[10px] truncate max-w-xs transition cursor-pointer"
                          >
                            📍 {place.address}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Badge de Coordenadas Atuais */}
                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-600">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Coordenadas GPS: <strong>Lat {editDestLat.toFixed(4)}, Lng {editDestLng.toFixed(4)}</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMapPickerTarget('editGroupDest');
                        setIsMapPickerOpen(true);
                      }}
                      className="text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      Abrir Mapa Interativo ↗
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-indigo-100">
                  <div>
                    <label className="block text-slate-800 font-bold mb-1">Nome do Ponto / Polo</label>
                    <input
                      type="text"
                      value={editDestName}
                      onChange={(e) => setEditDestName(e.target.value)}
                      placeholder="Ex: Sede Nubank ou Campus Poli"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-800 font-bold mb-1">Valor Sugerido (R$) *</label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        required
                        value={editDefaultPrice}
                        onChange={(e) => setEditDefaultPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-800 font-bold mb-1">Horário Típico *</label>
                      <input
                        type="time"
                        required
                        value={editDefaultDepartureTime}
                        onChange={(e) => setEditDefaultDepartureTime(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Regras e Descrição do Grupo</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descreva o propósito da comunidade, dias de semana, dicas de embarque..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {onDeleteGroup && editingGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Tem certeza de que deseja excluir permanentemente o grupo "${editingGroup.name}"? Esta ação removerá o grupo e suas configurações.`)) {
                        onDeleteGroup(editingGroup.id);
                        setEditingGroup(null);
                      }
                    }}
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-bold text-xs rounded-xl border border-rose-200 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Excluir Grupo</span>
                  </button>
                )}

                <div className="flex items-center space-x-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Location Picker Modal (Map Selection) */}
      <LocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        mode={
          mapPickerTarget === 'viewGroupDest'
            ? 'viewOnly'
            : mapPickerTarget === 'editGroupDest'
            ? 'edit'
            : 'create'
        }
        title={
          mapPickerTarget === 'viewGroupDest'
            ? `Destino Georreferenciado: ${previewGroupForMap?.name || 'Grupo'}`
            : mapPickerTarget === 'editGroupDest'
            ? 'Ajustar Destino do Grupo no Mapa'
            : 'Selecionar Destino Central do Grupo'
        }
        initialLat={
          mapPickerTarget === 'viewGroupDest'
            ? previewGroupForMap?.defaultDestination?.lat || -23.5574
            : mapPickerTarget === 'editGroupDest'
            ? editDestLat
            : destLat
        }
        initialLng={
          mapPickerTarget === 'viewGroupDest'
            ? previewGroupForMap?.defaultDestination?.lng || -46.7314
            : mapPickerTarget === 'editGroupDest'
            ? editDestLng
            : destLng
        }
        initialAddress={
          mapPickerTarget === 'viewGroupDest'
            ? previewGroupForMap?.defaultDestination?.address || ''
            : mapPickerTarget === 'editGroupDest'
            ? editDestAddress
            : destAddress
        }
        onConfirmLocation={(lat, lng, address, name) => {
          if (mapPickerTarget === 'createGroupDest') {
            setDestLat(Number(lat.toFixed(6)));
            setDestLng(Number(lng.toFixed(6)));
            setDestAddress(address);
            if (!destName) setDestName(name || address.split(',')[0]);
            setGeocodingFeedback({
              type: 'success',
              message: `📍 Localização marcada no mapa: (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            });
          } else if (mapPickerTarget === 'editGroupDest') {
            setEditDestLat(Number(lat.toFixed(6)));
            setEditDestLng(Number(lng.toFixed(6)));
            setEditDestAddress(address);
            if (!editDestName) setEditDestName(name || address.split(',')[0]);
            setEditGeocodingFeedback({
              type: 'success',
              message: `📍 Localização marcada no mapa: (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            });
          }
          setIsMapPickerOpen(false);
        }}
        onSelectLocation={(selected) => {
          if (mapPickerTarget === 'createGroupDest') {
            setDestLat(selected.lat);
            setDestLng(selected.lng);
            setDestAddress(selected.address);
            if (!destName) setDestName(selected.name || selected.address.split(',')[0]);
            setGeocodingFeedback({
              type: 'success',
              message: `📍 Localização marcada no mapa: (${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)})`,
            });
          } else if (mapPickerTarget === 'editGroupDest') {
            setEditDestLat(selected.lat);
            setEditDestLng(selected.lng);
            setEditDestAddress(selected.address);
            if (!editDestName) setEditDestName(selected.name || selected.address.split(',')[0]);
            setEditGeocodingFeedback({
              type: 'success',
              message: `📍 Localização marcada no mapa: (${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)})`,
            });
          }
        }}
      />
    </div>
  );
};
