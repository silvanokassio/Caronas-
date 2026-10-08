import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, 
  Users, 
  Coins, 
  Sparkles, 
  FileCode2, 
  Bell, 
  Repeat, 
  ChevronDown, 
  Check, 
  Shield, 
  Compass,
  CreditCard,
  Building2,
  UserCheck,
  Edit3,
  Cloud,
  LogIn,
  UserPlus,
  LogOut,
  Crown,
  Search,
  User as UserIcon,
  Trash2,
  X,
  Lock,
  Smartphone,
  AlertTriangle
} from 'lucide-react';
import { User, PushNotification, isSuperUser, AppInterfaceMode } from '../types';
import { PWAInstallModal } from './PWAInstallCard';

interface HeaderProps {
  currentUser: User | null;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  onOpenProfile?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
  onRestoreSuperAdmin?: () => void;
  isSupportActive?: boolean;
  originalAdminUser?: User | null;
  isFirebaseConnected?: boolean;
  interfaceMode?: AppInterfaceMode;
  onToggleInterfaceMode?: (mode: AppInterfaceMode) => void;
  activeTab: 'rides' | 'routines' | 'groups' | 'gamification' | 'ai_routes' | 'architecture' | 'user_area' | 'superuser_management';
  onChangeTab: (tab: 'rides' | 'routines' | 'groups' | 'gamification' | 'ai_routes' | 'architecture' | 'user_area' | 'superuser_management') => void;
  notifications: PushNotification[];
  onMarkNotificationsRead: () => void;
  onClearNotifications?: () => void;
  onDeleteNotification?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  onOpenProfile,
  onOpenAuth,
  onLogout,
  onRestoreSuperAdmin,
  isSupportActive = false,
  originalAdminUser = null,
  isFirebaseConnected = true,
  interfaceMode = 'light',
  onToggleInterfaceMode,
  activeTab,
  onChangeTab,
  notifications,
  onMarkNotificationsRead,
  onClearNotifications,
  onDeleteNotification,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);

  // Monitorar quantidade de notificações para fechar a tela automaticamente quando forem limpas
  useEffect(() => {
    // Quando as mensagens forem limpas ou não houver mensagens, fecha automaticamente a tela/dropdown
    if (showNotificationMenu && notifications.length === 0) {
      setShowNotificationMenu(false);
    }
  }, [notifications.length, showNotificationMenu]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isSuper = isSuperUser(currentUser);

  // Garantir lista 100% deduplicada por e-mail no cabeçalho
  const uniqueUsers = React.useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach((u) => {
      const key = (u.email || u.id).trim().toLowerCase();
      if (!map.has(key) || isSuperUser(u)) {
        map.set(key, u);
      }
    });
    return Array.from(map.values());
  }, [allUsers]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white shadow-xs flex items-center justify-center font-black shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 truncate">
                  Caronas
                </span>
                <span className="text-[10px] font-semibold tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full hidden sm:inline-flex">
                  Conectando pessoas
                </span>
                {isSuper && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full shadow-2xs">
                    <Crown className="w-3 h-3 text-amber-600" />
                    Superusuário
                  </span>
                )}
                {!currentUser && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                    <Search className="w-3 h-3 text-emerald-700" />
                    Visitante
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Caronas Corporativas & Acadêmicas Inteligentes
                </p>
                {isFirebaseConnected && (
                  <span className="hidden lg:inline-flex items-center gap-1 text-[10px] text-emerald-700 font-mono font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Firestore Ativo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* User Profile & Simulators Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Gamification Bank Account Balance Pill (Logged in) */}
            {currentUser && (
              <button
                onClick={() => onChangeTab('gamification')}
                id="header-gamification-pill"
                className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 transition text-xs active:scale-95 cursor-pointer"
              >
                <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[11px]">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <span className="text-slate-500 text-[10px] block leading-none font-mono">Saldo & Extrato</span>
                  <span className={`font-mono font-bold ${currentUser.saldo_caronas > 0 ? 'text-emerald-700' : currentUser.saldo_caronas < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {currentUser.saldo_caronas > 0
                      ? `+ R$ ${(currentUser.saldo_caronas * 6.50).toFixed(2)}`
                      : currentUser.saldo_caronas < 0
                      ? `- R$ ${Math.abs(currentUser.saldo_caronas * 6.50).toFixed(2)}`
                      : 'R$ 0,00'}
                  </span>
                </div>
              </button>
            )}

            {/* FCM Notifications Popover */}
            {currentUser && (
              <div className="relative">
                <button
                  id="btn-notifications-toggle"
                  onClick={() => {
                    if (!showNotificationMenu && notifications.length === 0) {
                      return;
                    }
                    setShowNotificationMenu(!showNotificationMenu);
                    if (!showNotificationMenu) onMarkNotificationsRead();
                  }}
                  className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition active:scale-95 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotificationMenu && (
                  <>
                    {/* Backdrop para fechar ao tocar fora */}
                    <div
                      className="fixed inset-0 z-40 bg-black/5 sm:bg-transparent"
                      onClick={() => setShowNotificationMenu(false)}
                    />
                    <div 
                      id="notifications-dropdown-menu"
                      className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-display font-semibold text-xs text-slate-900">
                            Notificações ({notifications.length})
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {notifications.length > 0 && onClearNotifications && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClearNotifications();
                                setShowNotificationMenu(false);
                              }}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer"
                              title="Limpar todas as notificações"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Limpar tudo</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowNotificationMenu(false)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 mt-1">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center space-y-1">
                            <Bell className="w-6 h-6 text-slate-300 mx-auto" />
                            <p className="text-xs text-slate-500 font-medium">Nenhuma notificação recente.</p>
                            <p className="text-[10px] text-slate-400">Novas viagens e alertas de carona aparecerão aqui.</p>
                          </div>
                        ) : (
                          notifications.map((ntf) => {
                            const isEmailFailure = ntf.type === 'EMAIL_DELIVERY_FAILED';
                            const isCancelled = ntf.type === 'RIDE_CANCELLED';
                            return (
                              <div 
                                key={ntf.id} 
                                className={`py-2.5 px-2.5 rounded-xl space-y-1.5 group relative transition ${
                                  isEmailFailure
                                    ? 'bg-amber-50/90 border border-amber-300'
                                    : isCancelled 
                                    ? 'bg-rose-50/80 border border-rose-200' 
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isEmailFailure && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                                    <span className={`font-bold text-xs ${
                                      isEmailFailure ? 'text-amber-950' : isCancelled ? 'text-rose-900' : 'text-slate-900'
                                    }`}>
                                      {ntf.title}
                                    </span>
                                    {isCancelled && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-200 text-rose-800">
                                        Aviso Urgente
                                      </span>
                                    )}
                                    {isEmailFailure && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                        Falha no E-mail
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1 shrink-0">
                                    <span className="text-[10px] text-slate-400 font-mono">agora</span>
                                    {onDeleteNotification && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteNotification(ntf.id);
                                          if (notifications.length <= 1) {
                                            setShowNotificationMenu(false);
                                          }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer"
                                        title="Remover notificação"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className={`text-xs leading-relaxed pr-2 ${
                                  isEmailFailure ? 'text-amber-900' : isCancelled ? 'text-rose-700' : 'text-slate-600'
                                }`}>
                                  {ntf.body}
                                </p>
                                {isEmailFailure && (
                                  <div className="pt-1 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowNotificationMenu(false);
                                        onChangeTab('user_area');
                                      }}
                                      className="text-[11px] font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                    >
                                      <span>Verificar & Validar E-mail →</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Quick Interface Mode Pill / Switcher */}
            {onToggleInterfaceMode && (
              <button
                type="button"
                id="btn-quick-toggle-interface-mode"
                onClick={() => onToggleInterfaceMode(interfaceMode === 'light' ? 'advanced' : 'light')}
                className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs shrink-0 ${
                  interfaceMode === 'light'
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
                title={interfaceMode === 'light' ? 'Alternar para Modo Avançado' : 'Alternar para Modo Light (Smartphone)'}
              >
                {interfaceMode === 'light' ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="hidden sm:inline">Modo </span>
                    <span>Avançado</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="hidden sm:inline">Modo </span>
                    <span>Light</span>
                  </>
                )}
              </button>
            )}

            {/* Quick Install App / PWA Button - Visível apenas em sm+ para não estourar a barra no mobile */}
            <button
              type="button"
              id="btn-header-install-app"
              onClick={() => setShowPWAModal(true)}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black rounded-xl transition active:scale-95 cursor-pointer shadow-xs shrink-0"
              title="Instalar CaronaFlow no Celular ou Computador"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-950 shrink-0" />
              <span>Instalar App</span>
            </button>

            {/* User Profile & Auth Dropdown */}
            {currentUser ? (
              <div className="relative shrink-0">
                <button
                  id="btn-user-switcher"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center space-x-1 sm:space-x-2 p-1 sm:px-3 sm:py-1.5 rounded-xl border text-slate-800 transition active:scale-95 shadow-2xs cursor-pointer shrink-0 ${
                    isSuper 
                      ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-100/70 ring-2 ring-amber-400/30'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                  title={currentUser.name}
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0"
                  />
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold leading-tight flex items-center gap-1 text-slate-900">
                      {currentUser.name}
                      {isSuper ? (
                        <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.2 rounded font-sans">
                          SUPER
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal text-slate-500 font-mono">
                          ★ {(currentUser.rating ?? 5.0).toFixed(1)}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-indigo-600 font-medium truncate max-w-[120px]">
                      {isSuper ? 'Acesso Total' : (currentUser.ponto_encontro_default?.name || currentUser.residentialAddress?.address?.split(',')[0] || 'São Paulo')}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserMenu && (
                  <div 
                    id="user-switcher-dropdown"
                    className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-xs bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    {/* Edit Profile & User Area Actions */}
                    <div className="p-2 border-b border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            {currentUser.name}
                            {isSuper && <Crown className="w-3 h-3 text-amber-600" />}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[170px]">{currentUser.email}</p>
                        </div>
                        {onOpenProfile && (
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onOpenProfile();
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] rounded-lg border border-slate-200 flex items-center space-x-1 transition active:scale-95 cursor-pointer"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            <span>Editar</span>
                          </button>
                        )}
                      </div>

                      {/* Quick Return to Silvano / Exit Support Mode Button */}
                      {(isSupportActive || (currentUser && (currentUser.email || '').toLowerCase() !== 'silvano.kassio@gmail.com')) && onRestoreSuperAdmin && (
                        <div className="p-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl space-y-1 my-1">
                          <div className="flex items-center justify-between text-amber-900 text-[10px] font-bold">
                            <span className="flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-600" />
                              {isSupportActive ? 'Modo Suporte em Andamento' : 'Perfil em Inspeção / Suporte'}
                            </span>
                            <span className="bg-amber-200/80 text-amber-900 px-1 py-0.2 rounded font-mono text-[9px]">
                              SuperUser
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserMenu(false);
                              onRestoreSuperAdmin();
                            }}
                            className="w-full py-1.5 px-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-lg transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center space-x-1.5 border border-amber-400"
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-950" />
                            <span>Voltar para Minha Conta (Silvano Kassio)</span>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onChangeTab('user_area');
                        }}
                        className="w-full px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Abrir Área do Usuário & Preferências</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowPWAModal(true);
                        }}
                        className="w-full px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Criar Atalho / Instalar App (PWA)</span>
                      </button>

                      {isSuper && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onChangeTab('superuser_management');
                          }}
                          className="w-full px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs border border-amber-400"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-950" />
                          <span>Gestão de Usuários (SuperAdmin)</span>
                        </button>
                      )}
                    </div>

                    {/* Interface Mode Switcher inside User Menu */}
                    {onToggleInterfaceMode && (
                      <div className="p-2 border-b border-slate-100 bg-slate-50/80 rounded-xl my-1.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            Interface do Sistema
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${interfaceMode === 'light' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                            {interfaceMode === 'light' ? '📱 Light (Smartphone)' : '⚡ Avançada'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 rounded-xl">
                          <button
                            type="button"
                            id="btn-menu-mode-light"
                            onClick={() => {
                              onToggleInterfaceMode('light');
                              setShowUserMenu(false);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              interfaceMode === 'light'
                                ? 'bg-white text-emerald-800 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span>📱 Modo Light</span>
                          </button>
                          <button
                            type="button"
                            id="btn-menu-mode-advanced"
                            onClick={() => {
                              onToggleInterfaceMode('advanced');
                              setShowUserMenu(false);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              interfaceMode === 'advanced'
                                ? 'bg-white text-indigo-800 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span>⚡ Avançado</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          {interfaceMode === 'light'
                            ? 'Acesso simplificado para smartphone: procurar e aderir a caronas.'
                            : 'Acesso completo com gestão de rotas, IA Vertex, grupos e relatórios.'}
                        </p>
                      </div>
                    )}

                    {/* Auth Actions in Menu */}
                    <div className="pt-2 space-y-1">
                      {onOpenAuth && (
                        <>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onOpenAuth('login');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 flex items-center space-x-2 transition cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Entrar com Outra Conta</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onOpenAuth('register');
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Cadastrar Novo Perfil</span>
                          </button>
                        </>
                      )}
                      {onLogout && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onLogout();
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sair da Conta (Logout)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Non-logged in guest user trigger */
              <div className="relative">
                <button
                  id="btn-guest-user-menu"
                  onClick={() => onOpenAuth ? onOpenAuth('login') : setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition active:scale-95 shadow-2xs cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar / Cadastrar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Exibidas exclusivamente no Modo Avançado para manter a versão Light clean */}
        {interfaceMode === 'advanced' && (
          <div className="flex items-center space-x-1.5 sm:space-x-1.5 overflow-x-auto py-3 sm:py-2.5 border-t border-slate-100 no-scrollbar text-sm sm:text-xs font-medium">
            <button
              id="tab-rides"
              onClick={() => onChangeTab('rides')}
              className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                activeTab === 'rides' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Car className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>Caronas & Ao Vivo</span>
            </button>

            <button
              id="tab-groups"
              onClick={() => onChangeTab('groups')}
              className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                activeTab === 'groups' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>Grupos & Aceite</span>
            </button>

            <button
              id="tab-gamification"
              onClick={() => onChangeTab('gamification')}
              className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                activeTab === 'gamification' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>Saldo & Extrato</span>
            </button>

            <button
              id="tab-ai-routes"
              onClick={() => onChangeTab('ai_routes')}
              className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                activeTab === 'ai_routes' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>IA Vertex Rotas</span>
            </button>

            <button
              id="tab-user-area"
              onClick={() => {
                if (!currentUser && onOpenAuth) {
                  onOpenAuth('login');
                } else {
                  onChangeTab('user_area');
                }
              }}
              className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                activeTab === 'user_area' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {currentUser ? (
                <UserIcon className="w-4 h-4 sm:w-4 sm:h-4 text-indigo-500" />
              ) : (
                <Lock className="w-4 h-4 sm:w-4 sm:h-4 text-amber-600" />
              )}
              <span>Área do Usuário & Preferências</span>
              {!currentUser && (
                <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded-full">
                  Login
                </span>
              )}
            </button>

            {isSuper && (
              <button
                id="tab-superuser-management"
                onClick={() => onChangeTab('superuser_management')}
                className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                  activeTab === 'superuser_management' 
                    ? 'bg-amber-600 text-white font-bold shadow-2xs' 
                    : 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 font-bold'
                }`}
              >
                <Crown className="w-4 h-4 text-amber-600" />
                <span>Gestão de Usuários (SuperAdmin)</span>
              </button>
            )}

            {isSuper && (
              <button
                id="tab-architecture"
                onClick={() => onChangeTab('architecture')}
                className={`px-4 py-2.5 sm:px-3.5 sm:py-2 min-h-[44px] sm:min-h-auto rounded-xl flex items-center space-x-2 sm:space-x-1.5 whitespace-nowrap transition active:scale-95 cursor-pointer ${
                  activeTab === 'architecture' ? 'bg-slate-900 text-white font-bold shadow-2xs' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 font-medium'
                }`}
              >
                <FileCode2 className="w-4 h-4 text-indigo-600" />
                <span>Arquitetura & Superadmin</span>
              </button>
            )}
          </div>
        )}
      </div>

      <PWAInstallModal 
        isOpen={showPWAModal} 
        onClose={() => setShowPWAModal(false)} 
      />
    </header>
  );
};
