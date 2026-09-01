import React, { useState } from 'react';
import { 
  Car, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User as UserIcon, 
  Phone, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  ArrowRight, 
  X,
  AlertCircle,
  KeyRound,
  Home,
  Navigation,
  Loader2,
  Search
} from 'lucide-react';
import { User, GeoLocation } from '../types';
import { loginWithEmail, registerWithFullProfile, loginWithGoogleAuth } from '../lib/firebase';
import { LocationPickerModal } from './LocationPickerModal';
import { getCurrentGPSPosition, reverseGeocode } from '../lib/geo';

interface AuthScreenProps {
  isOpen: boolean;
  onClose?: () => void;
  allUsers: User[];
  onAuthSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isOpen,
  onClose,
  allUsers,
  onAuthSuccess,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  // Residential address & Meeting point
  const [regResidentialAddress, setRegResidentialAddress] = useState('');
  const [regResidentialLat, setRegResidentialLat] = useState<number>(-23.5539);
  const [regResidentialLng, setRegResidentialLng] = useState<number>(-46.6896);

  const [useResAsMeetingPoint, setUseResAsMeetingPoint] = useState(true);
  const [customMeetingAddress, setCustomMeetingAddress] = useState('');
  const [customMeetingLat, setCustomMeetingLat] = useState<number>(-23.5714);
  const [customMeetingLng, setCustomMeetingLng] = useState<number>(-46.7082);
  const [customMeetingName, setCustomMeetingName] = useState('');

  // Map Picker Modal State
  const [mapPickerTarget, setMapPickerTarget] = useState<'registerResidential' | 'registerMeeting' | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  // Vehicle (Optional)
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleSeats, setVehicleSeats] = useState(3);

  // PIX & Terms
  const [pixKey, setPixKey] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [registerError, setRegisterError] = useState('');

  const handleQuickGPS = async (target: 'residential' | 'meeting') => {
    setIsLocatingGPS(true);
    try {
      const coords = await getCurrentGPSPosition();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);
      if (target === 'residential') {
        setRegResidentialAddress(resolvedAddress);
        setRegResidentialLat(coords.lat);
        setRegResidentialLng(coords.lng);
      } else {
        setCustomMeetingAddress(resolvedAddress);
        setCustomMeetingLat(coords.lat);
        setCustomMeetingLng(coords.lng);
      }
    } catch (err: any) {
      alert(err?.message || 'Não foi possível capturar o sinal GPS.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      if (!loginEmail.trim()) {
        setLoginError('Por favor, informe seu e-mail.');
        setLoading(false);
        return;
      }

      if (!loginPassword.trim()) {
        setLoginError('Por favor, informe sua senha de acesso.');
        setLoading(false);
        return;
      }

      // Check against Firestore / Auth with credentials
      const matchedUser = await loginWithEmail(loginEmail, loginPassword);
      if (matchedUser) {
        onAuthSuccess(matchedUser);
        if (onClose) onClose();
      } else {
        setLoginError('Usuário não encontrado. Verifique seu e-mail ou faça seu cadastro.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Erro ao realizar login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setLoading(true);

    try {
      if (!regName.trim() || !regEmail.trim()) {
        setRegisterError('Preencha seu nome e e-mail.');
        setLoading(false);
        return;
      }

      if (!regResidentialAddress.trim()) {
        setRegisterError('Por favor, informe seu endereço residencial.');
        setLoading(false);
        return;
      }

      if (regPassword && regPassword.length < 6) {
        setRegisterError('A senha deve ter no mínimo 6 caracteres.');
        setLoading(false);
        return;
      }

      if (regPassword && regPassword !== regConfirmPassword) {
        setRegisterError('As senhas digitadas não coincidem.');
        setLoading(false);
        return;
      }

      if (!agreeTerms) {
        setRegisterError('Você precisa aceitar as diretrizes de convivência e segurança da rede de caronas.');
        setLoading(false);
        return;
      }

      const residentialLocation: GeoLocation = {
        lat: regResidentialLat || -23.5539,
        lng: regResidentialLng || -46.6896,
        address: regResidentialAddress.trim(),
        name: 'Residência',
      };

      const defaultMeeting: GeoLocation = useResAsMeetingPoint
        ? residentialLocation
        : {
            lat: customMeetingLat || -23.5714,
            lng: customMeetingLng || -46.7082,
            name: customMeetingName || 'Ponto de Embarque',
            address: customMeetingAddress || regResidentialAddress.trim(),
          };

      const newUserPayload: Omit<User, 'id'> & { password?: string } = {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        rolePreference: 'both',
        residentialAddress: residentialLocation,
        useResidentialAsMeetingPoint: useResAsMeetingPoint,
        ponto_encontro_default: defaultMeeting,
        saldo_caronas: 0,
        groups: ['grp-poli-usp', 'grp-google-campus'],
        rating: 5.0,
        totalRidesOffered: 0,
        totalRidesTaken: 0,
        pixKey: pixKey.trim() || regEmail.trim(),
        password: regPassword || 'senha123',
        vehicle: hasVehicle && vehicleModel ? {
          model: vehicleModel.trim(),
          plate: vehiclePlate.trim().toUpperCase() || 'ABC-1234',
          color: vehicleColor.trim() || 'Prata',
        } : undefined,
      };

      const createdUser = await registerWithFullProfile(newUserPayload);
      onAuthSuccess(createdUser);
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      setRegisterError(err.message || 'Erro ao realizar cadastro no Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const gUser = await loginWithGoogleAuth(['grp-poli-usp', 'grp-google-campus']);
      if (gUser) {
        onAuthSuccess(gUser);
        if (onClose) onClose();
      }
    } catch (err: any) {
      console.error('Google auth error:', err);
      setLoginError('Não foi possível conectar com o Google no momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Acesso à Rede Solidária
            </span>
            <span className="text-xs text-slate-500 font-mono">Firebase Auth</span>
          </div>

          <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900 tracking-tight">
            {mode === 'login' ? 'Entrar na sua Conta' : 'Criar Perfil na Rede de Caronas'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {mode === 'login'
              ? 'Acesse com seu e-mail para sincronizar viagens, saldos de caronas e notificações.'
              : 'Cadastre seus dados pessoais e endereço residencial para oferecer ou solicitar caronas com total liberdade.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLoginError('');
            }}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Já possuo conta (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setRegisterError('');
            }}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Criar Novo Perfil
          </button>
        </div>

        {/* GOOGLE SSO BUTTON */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-2xl shadow-xs flex items-center justify-center space-x-2.5 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar com Google Auth</span>
          </button>

          <div className="flex items-center my-3">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="px-3 text-[11px] text-slate-400 uppercase font-medium tracking-wider">ou com e-mail</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>
        </div>

        {/* LOGIN MODE */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-sm sm:text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-800 font-bold mb-1.5">E-mail Cadastrado:</label>
              <div className="relative">
                <Mail className="w-5 h-5 sm:w-4 sm:h-4 text-slate-400 absolute left-3.5 top-3.5 sm:top-3" />
                <input
                  type="email"
                  required
                  placeholder="Ex: seu-nome@dominio.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-11 pr-4 py-3.5 sm:py-2.5 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-800 font-bold mb-1.5">Senha de Acesso:</label>
              <div className="relative">
                <Lock className="w-5 h-5 sm:w-4 sm:h-4 text-slate-400 absolute left-3.5 top-3.5 sm:top-3" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="Sua senha secreta"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-11 pr-11 py-3.5 sm:py-2.5 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-3.5 sm:top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showLoginPassword ? <EyeOff className="w-5 h-5 sm:w-4 sm:h-4" /> : <Eye className="w-5 h-5 sm:w-4 sm:h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 sm:py-3.5 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition active:scale-[0.99] cursor-pointer disabled:opacity-50 text-base sm:text-xs"
            >
              <span>{loading ? 'Validando Acesso...' : 'Entrar no Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Guest / Unauthenticated exploration button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span>Continuar como Visitante (Pesquisar Caronas Oferecidas)</span>
              </button>
            </div>
          </form>
        ) : (
          /* REGISTER MODE */
          <form onSubmit={handleRegisterSubmit} className="space-y-5 text-sm sm:text-xs">
            {registerError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{registerError}</span>
              </div>
            )}

            {/* Seção 1: Identificação */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <UserIcon className="w-3.5 h-3.5" />
                1. Identificação Pessoal
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1.5">Nome Completo:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Mendes"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1.5">E-mail Principal:</label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: carlos@email.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  Telefone / WhatsApp (para contato nas viagens):
                </label>
                <input
                  type="text"
                  placeholder="Ex: (11) 98765-4321"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1.5">Criar Senha:</label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1.5">Confirmar Senha:</label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Endereço Residencial e Ponto de Encontro */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 flex-wrap gap-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  2. Endereço Residencial & Ponto de Encontro
                </h4>
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickGPS('residential')}
                    disabled={isLocatingGPS}
                    className="text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer border border-emerald-200"
                    title="Preencher com GPS atual"
                  >
                    {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                    <span>Meu GPS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('registerResidential')}
                    className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-3 py-1.5 min-h-[36px] bg-white hover:bg-indigo-50 rounded-lg transition cursor-pointer border border-indigo-200 shadow-2xs"
                    title="Apontar no Mapa"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1.5">Endereço Residencial:</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rua Fradique Coutinho, 1200 - Pinheiros, São Paulo - SP"
                    value={regResidentialAddress}
                    onChange={(e) => setRegResidentialAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 pr-12 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('registerResidential')}
                    className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                  >
                    <MapPin className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              {/* Checkbox: Usar residencial como ponto de encontro */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useResAsMeetingPoint}
                    onChange={(e) => setUseResAsMeetingPoint(e.target.checked)}
                    className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-sm sm:text-xs">
                      Usar meu endereço residencial como ponto de encontro padrão
                    </span>
                    <p className="text-xs sm:text-[11px] text-slate-500">
                      As caronas utilizarão sua localização residencial como origem padrão para embarques.
                    </p>
                  </div>
                </label>
              </div>

              {/* Ponto de encontro alternativo se não desejar usar residencial */}
              {!useResAsMeetingPoint && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200/60">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-xs sm:text-[11px] text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Ponto de Encontro Alternativo Preferencial:
                    </span>
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleQuickGPS('meeting')}
                        disabled={isLocatingGPS}
                        className="text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer border border-emerald-200"
                      >
                        {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                        <span>GPS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapPickerTarget('registerMeeting')}
                        className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-white hover:bg-indigo-50 rounded-lg transition cursor-pointer border border-indigo-200"
                      >
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Mapa</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 text-xs sm:text-[10px] font-bold mb-1">Nome do Ponto:</label>
                      <input
                        type="text"
                        placeholder="Ex: Metrô Butantã - Saída Vital Brasil"
                        value={customMeetingName}
                        onChange={(e) => setCustomMeetingName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 sm:py-2 text-base sm:text-xs text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-xs sm:text-[10px] font-bold mb-1">Endereço de Embarque:</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ex: Av. Vital Brasil, 500"
                          value={customMeetingAddress}
                          onChange={(e) => setCustomMeetingAddress(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 sm:py-2 pr-10 text-base sm:text-xs text-slate-900 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setMapPickerTarget('registerMeeting')}
                          className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Seção 3: Veículo e Dados Financeiros */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                3. Veículo (Opcional) & Chave PIX
              </h4>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm sm:text-xs text-slate-900 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-indigo-600" />
                    Possui veículo próprio para oferecer caronas?
                  </span>
                  <label className="flex items-center space-x-2 text-sm sm:text-xs font-bold text-indigo-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasVehicle}
                      onChange={(e) => setHasVehicle(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                    />
                    <span>Tenho veículo</span>
                  </label>
                </div>

                {hasVehicle && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-700 text-xs sm:text-[11px] font-bold mb-1">Modelo do Carro:</label>
                      <input
                        type="text"
                        placeholder="Ex: T-Cross 1.0 TSI"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 sm:py-2 text-base sm:text-xs text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-xs sm:text-[11px] font-bold mb-1">Placa (Mercosul):</label>
                      <input
                        type="text"
                        placeholder="Ex: BRA2E19"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 sm:py-2 text-base sm:text-xs text-slate-900 font-mono uppercase font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-xs sm:text-[11px] font-bold mb-1">Cor do Veículo:</label>
                      <input
                        type="text"
                        placeholder="Ex: Cinza Platinum"
                        value={vehicleColor}
                        onChange={(e) => setVehicleColor(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 sm:py-2 text-base sm:text-xs text-slate-900 font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  Chave PIX (para Rateios Transparentes):
                </label>
                <input
                  type="text"
                  placeholder="Ex: seu-email@dominio.com, CPF ou telefone"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 sm:py-2 text-base sm:text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>
            </div>

            {/* Termos */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start space-x-2.5">
              <input
                type="checkbox"
                id="terms-check"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
              />
              <label htmlFor="terms-check" className="text-xs sm:text-[11px] text-slate-600 leading-relaxed cursor-pointer font-medium">
                Concordo com os Termos de Uso e Código de Convivência Solidária da rede. Autorizo a gravação dos dados na base em nuvem Firestore.
              </label>
            </div>

            {/* Submit Cadastro */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 sm:py-3.5 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition active:scale-[0.99] cursor-pointer disabled:opacity-50 text-base sm:text-xs"
            >
              <span>{loading ? 'Cadastrando no Firestore...' : 'Concluir Cadastro & Conectar'}</span>
              <Check className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Interactive Map Location Picker */}
      <LocationPickerModal
        isOpen={mapPickerTarget !== null}
        onClose={() => setMapPickerTarget(null)}
        title={
          mapPickerTarget === 'registerResidential'
            ? 'Apontar Endereço Residencial no Mapa'
            : 'Apontar Ponto de Encontro Alternativo no Mapa'
        }
        initialAddress={
          mapPickerTarget === 'registerResidential' ? regResidentialAddress : customMeetingAddress
        }
        initialLat={
          mapPickerTarget === 'registerResidential' ? regResidentialLat : customMeetingLat
        }
        initialLng={
          mapPickerTarget === 'registerResidential' ? regResidentialLng : customMeetingLng
        }
        onSelectLocation={(selected) => {
          if (mapPickerTarget === 'registerResidential') {
            setRegResidentialAddress(selected.address);
            setRegResidentialLat(selected.lat);
            setRegResidentialLng(selected.lng);
          } else {
            setCustomMeetingAddress(selected.address);
            setCustomMeetingLat(selected.lat);
            setCustomMeetingLng(selected.lng);
            if (!customMeetingName) {
              setCustomMeetingName(selected.name || 'Ponto de Embarque');
            }
          }
        }}
      />
    </div>
  );
};
