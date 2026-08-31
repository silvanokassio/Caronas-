import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Car, 
  MapPin, 
  CreditCard, 
  Sparkles, 
  Check, 
  Home, 
  Shield, 
  Phone, 
  Navigation, 
  Loader2, 
  Mail, 
  Building2, 
  Crown, 
  FileText, 
  Music, 
  Volume2, 
  Wind, 
  MessageSquare, 
  Dog, 
  Clock, 
  Sliders, 
  Bell, 
  Eye, 
  Lock, 
  Heart, 
  CheckCircle2, 
  AlertCircle,
  Camera,
  Compass,
  ArrowRight,
  LogOut,
  LogIn,
  Repeat,
  Calendar,
  Save,
  Plus,
  Trash2,
  Send,
  KeyRound
} from 'lucide-react';
import { User, GeoLocation, UserPreferences, Vehicle, isSuperUser, getUserVehicles, Routine } from '../types';
import { updateFirestoreUserProfile, saveFirestoreRoutine, deleteMyAccount, deleteFirestoreUser } from '../lib/firebase';
import { LocationPickerModal } from './LocationPickerModal';
import { getCurrentGPSPosition, reverseGeocode } from '../lib/geo';
import { sendEmailConfirmation, checkEmailHealth, requestEmailVerificationCode, verifyEmailCode, checkEmailValidationStatus } from '../lib/emailClient';

export type SectionTab = 'identity' | 'routines' | 'commute' | 'locations' | 'vehicle' | 'financial' | 'privacy' | 'emails';

interface UserAreaViewProps {
  currentUser: User | null;
  allUsers?: User[];
  onUserUpdated: (updated: User) => void;
  onUserDeleted?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onNavigateToTab?: (tab: 'rides' | 'groups' | 'gamification' | 'ai_routes' | 'architecture' | 'user_area') => void;
  onUpdateRoutine?: (updatedRoutine: Routine, updatedMeetingPoint: GeoLocation) => void;
  initialSection?: SectionTab;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
];

const PRESET_MEETING_POINTS: GeoLocation[] = [
  { lat: -23.5719, lng: -46.7082, address: 'Metrô Butantã - Linha 4-Amarela (Saída Av. Vital Brasil)', name: 'Estação Metrô Butantã' },
  { lat: -23.5670, lng: -46.7022, address: 'Av. Rebouças, 3970 - Shopping Eldorado (Ponto de Ônibus)', name: 'Ponto Shopping Eldorado' },
  { lat: -23.5732, lng: -46.7128, address: 'Portaria 1 USP - Rua Alvarenga (Ponto de Encontro)', name: 'Portaria 1 USP Butantã' },
  { lat: -23.5855, lng: -46.6811, address: 'Av. Brigadeiro Faria Lima, 3477 (Em frente ao Edifício Pátio Victor Malzoni)', name: 'Faria Lima 3477' },
  { lat: -23.5614, lng: -46.6565, address: 'Av. Paulista, 900 (Próximo Metrô Trianon-Masp)', name: 'Av. Paulista / Metrô Trianon' },
];

export const UserAreaView: React.FC<UserAreaViewProps> = ({
  currentUser,
  allUsers = [],
  onUserUpdated,
  onUserDeleted,
  onOpenAuth,
  onNavigateToTab,
  onUpdateRoutine,
  initialSection = 'identity',
}) => {
  if (!currentUser) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center space-y-6 animate-in fade-in">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <UserIcon className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h2 className="font-display font-bold text-2xl text-slate-900">Área do Usuário</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Acesse seus dados particulares, personalize suas preferências de convivência no carro, endereços fixos, veículo e chave PIX para repasses de combustível.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onOpenAuth?.('login')}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Fazer Login</span>
          </button>
          <button
            onClick={() => onOpenAuth?.('register')}
            className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl transition active:scale-95 cursor-pointer"
          >
            Criar Cadastro Gratuito
          </button>
        </div>
      </div>
    );
  }

  const isSuper = isSuperUser(currentUser);

  // Active sub-tab
  const [activeSection, setActiveSection] = useState<SectionTab>(initialSection);

  // Form State - Identity & Personal
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [cpf, setCpf] = useState(currentUser.cpf || '');
  const [institutionName, setInstitutionName] = useState(currentUser.institutionName || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || PRESET_AVATARS[0]);
  const [gender, setGender] = useState<'female' | 'male' | 'other' | 'prefer_not_say'>(currentUser.gender || 'prefer_not_say');
  const [rolePreference, setRolePreference] = useState<'both' | 'driver' | 'passenger'>(currentUser.rolePreference || 'both');

  // Form State - Routine & Fixed Commutes (Configurações da Conta)
  const [routineTitle, setRoutineTitle] = useState(currentUser.routine?.title || 'Ida & Retorno Diário');
  const [routineOriginAddress, setRoutineOriginAddress] = useState(
    currentUser.routine?.origin?.address || currentUser.residentialAddress?.address || 'Rua Fradique Coutinho, 1200 - Pinheiros, São Paulo - SP'
  );
  const [routineOriginLat, setRoutineOriginLat] = useState<number>(currentUser.routine?.origin?.lat || currentUser.residentialAddress?.lat || -23.5539);
  const [routineOriginLng, setRoutineOriginLng] = useState<number>(currentUser.routine?.origin?.lng || currentUser.residentialAddress?.lng || -46.6896);

  const [routineDestAddress, setRoutineDestAddress] = useState(
    currentUser.routine?.destination?.address || 'Av. Prof. Luciano Gualberto, 380 - Butantã, São Paulo - SP'
  );
  const [routineDestLat, setRoutineDestLat] = useState<number>(currentUser.routine?.destination?.lat || -23.5574);
  const [routineDestLng, setRoutineDestLng] = useState<number>(currentUser.routine?.destination?.lng || -46.7314);

  const [routineDepartureTime, setRoutineDepartureTime] = useState(currentUser.routine?.departureTime || '07:30');
  const [routineDefaultSeats, setRoutineDefaultSeats] = useState<number>(currentUser.routine?.defaultSeats || 3);
  const [routineDefaultPrice, setRoutineDefaultPrice] = useState<number>(currentUser.routine?.defaultPrice || 6.50);
  const [routineDays, setRoutineDays] = useState<string[]>(
    currentUser.routine?.daysOfWeek || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
  );
  const [routineMeetingPoint, setRoutineMeetingPoint] = useState<GeoLocation>(
    currentUser.ponto_encontro_default || PRESET_MEETING_POINTS[0]
  );
  const [routineSavedSuccess, setRoutineSavedSuccess] = useState(false);

  const daysOfWeekList = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const toggleRoutineDay = (day: string) => {
    if (routineDays.includes(day)) {
      setRoutineDays(routineDays.filter((d) => d !== day));
    } else {
      setRoutineDays([...routineDays, day]);
    }
  };

  // Form State - Commute & Travel Preferences
  const [allowMusic, setAllowMusic] = useState<boolean>(currentUser.preferences?.allowMusic ?? true);
  const [musicStyle, setMusicStyle] = useState<string>(currentUser.preferences?.musicStyle || 'MPB, Pop & Podcasts');
  const [allowPets, setAllowPets] = useState<boolean>(currentUser.preferences?.allowPets ?? false);
  const [airConditioning, setAirConditioning] = useState<boolean>(currentUser.preferences?.airConditioning ?? true);
  const [conversationStyle, setConversationStyle] = useState<'talkative' | 'quiet' | 'flexible'>(currentUser.preferences?.conversationStyle || 'flexible');
  const [womenOnlyRides, setWomenOnlyRides] = useState<boolean>(currentUser.preferences?.womenOnlyRides ?? false);
  const [luggageSize, setLuggageSize] = useState<'small' | 'medium' | 'large'>(currentUser.preferences?.luggageSize || 'medium');
  const [punctualityTolerance, setPunctualityTolerance] = useState<number>(currentUser.preferences?.punctualityToleranceMinutes ?? 5);
  const [maxDetourMeters, setMaxDetourMeters] = useState<number>(currentUser.preferences?.maxDetourDistanceMeters ?? 1000);

  // Form State - Addresses & Meeting Points
  const [resAddress, setResAddress] = useState(
    currentUser.residentialAddress?.address || currentUser.ponto_encontro_default?.address || 'Rua Fradique Coutinho, 1200 - Pinheiros, São Paulo - SP'
  );
  const [resLat, setResLat] = useState<number>(currentUser.residentialAddress?.lat || -23.5539);
  const [resLng, setResLng] = useState<number>(currentUser.residentialAddress?.lng || -46.6896);

  const [useResAsMeeting, setUseResAsMeeting] = useState<boolean>(currentUser.useResidentialAsMeetingPoint ?? false);
  const [customMeetingAddress, setCustomMeetingAddress] = useState(
    currentUser.ponto_encontro_default?.address || 'Metrô Butantã - Saída Av. Vital Brasil'
  );
  const [customMeetingLat, setCustomMeetingLat] = useState<number>(currentUser.ponto_encontro_default?.lat || -23.5719);
  const [customMeetingLng, setCustomMeetingLng] = useState<number>(currentUser.ponto_encontro_default?.lng || -46.7082);
  const [customMeetingName, setCustomMeetingName] = useState(
    currentUser.ponto_encontro_default?.name || 'Estação Butantã (Linha 4-Amarela)'
  );

  // Form State - Vehicle & Driver (Multiple Vehicles Garage)
  const initialVehicles = getUserVehicles(currentUser);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>(
    initialVehicles.length > 0
      ? initialVehicles
      : currentUser.vehicle?.model
      ? [{ ...currentUser.vehicle, id: `veh-${Date.now()}`, isPrimary: true }]
      : []
  );
  const [hasVehicle, setHasVehicle] = useState(
    initialVehicles.length > 0 || !!currentUser.vehicle?.model
  );

  // Form State - Financial & PIX
  const [pixKey, setPixKey] = useState(currentUser.pixKey || '');
  const [pixKeyType, setPixKeyType] = useState<'email' | 'phone' | 'cpf' | 'random'>(currentUser.pixKeyType || 'email');
  const [bankName, setBankName] = useState(currentUser.bankName || 'Nubank / Banco do Brasil');
  const [agency, setAgency] = useState(currentUser.agency || '0001');
  const [accountNumber, setAccountNumber] = useState(currentUser.accountNumber || '');

  // Form State - Privacy & Alerts
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'groups_only' | 'verified_only'>(
    currentUser.preferences?.profileVisibility || 'public'
  );
  const [showPhoneToPassengers, setShowPhoneToPassengers] = useState<boolean>(
    currentUser.preferences?.showPhoneToPassengers ?? true
  );
  const [notifyNewRidesInGroups, setNotifyNewRidesInGroups] = useState<boolean>(
    currentUser.preferences?.notifyNewRidesInGroups ?? true
  );
  const [notifyDriverDeparted, setNotifyDriverDeparted] = useState<boolean>(
    currentUser.preferences?.notifyDriverDeparted ?? true
  );

  // UI state
  const [mapPickerTarget, setMapPickerTarget] = useState<'residential' | 'meeting' | 'routineOrigin' | 'routineDest' | 'routineMeeting' | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Account Deletion & User Management States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingMyAccount, setIsDeletingMyAccount] = useState(false);
  const [targetUserToDelete, setTargetUserToDelete] = useState<User | null>(null);
  const [isDeletingTargetUser, setIsDeletingTargetUser] = useState(false);

  const handleDeleteSelfAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      setErrorMessage('Digite EXCLUIR para confirmar a exclusão da sua conta.');
      return;
    }

    try {
      setIsDeletingMyAccount(true);
      setErrorMessage(null);
      await deleteMyAccount(currentUser);
      setShowDeleteModal(false);
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (err: any) {
      console.error('Erro ao excluir conta:', err);
      setErrorMessage(err?.message || 'Falha ao excluir a conta.');
    } finally {
      setIsDeletingMyAccount(false);
    }
  };

  const handleAdminDeleteUser = async (userToDelete: User) => {
    try {
      setIsDeletingTargetUser(true);
      await deleteFirestoreUser(userToDelete.id);
      setTargetUserToDelete(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao deletar usuário pelo admin:', err);
      setErrorMessage(err?.message || 'Falha ao remover usuário do Firestore.');
    } finally {
      setIsDeletingTargetUser(false);
    }
  };

  // Quick GPS Handler for Routine
  const handleRoutineQuickGPS = async (target: 'origin' | 'dest' | 'meeting') => {
    setIsLocatingGPS(true);
    try {
      const coords = await getCurrentGPSPosition();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);
      if (target === 'origin') {
        setRoutineOriginAddress(resolvedAddress);
        setRoutineOriginLat(coords.lat);
        setRoutineOriginLng(coords.lng);
      } else if (target === 'dest') {
        setRoutineDestAddress(resolvedAddress);
        setRoutineDestLat(coords.lat);
        setRoutineDestLng(coords.lng);
      } else {
        setRoutineMeetingPoint({
          lat: coords.lat,
          lng: coords.lng,
          address: resolvedAddress,
          name: 'Ponto Capturado via GPS',
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Não foi possível capturar o sinal GPS.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  // Dedicated Save Routine Handler
  const handleSaveRoutineOnly = async () => {
    try {
      setSaving(true);
      const updatedRoutine: Routine = {
        id: currentUser.routine?.id || `rtn-${Date.now()}`,
        title: routineTitle.trim() || 'Minha Rotina Principal',
        origin: {
          address: routineOriginAddress.trim() || 'Origem Principal',
          lat: routineOriginLat,
          lng: routineOriginLng,
        },
        destination: {
          address: routineDestAddress.trim() || 'Destino Principal',
          lat: routineDestLat,
          lng: routineDestLng,
        },
        departureTime: routineDepartureTime,
        daysOfWeek: routineDays,
        defaultSeats: Number(routineDefaultSeats) || 3,
        defaultPrice: Number(routineDefaultPrice) || 6.50,
      };

      await saveFirestoreRoutine(currentUser.id, updatedRoutine);
      await updateFirestoreUserProfile(currentUser.id, {
        routine: updatedRoutine,
        ponto_encontro_default: routineMeetingPoint,
      });

      const updatedUser: User = {
        ...currentUser,
        routine: updatedRoutine,
        ponto_encontro_default: routineMeetingPoint,
      };

      onUserUpdated(updatedUser);
      if (onUpdateRoutine) {
        onUpdateRoutine(updatedRoutine, routineMeetingPoint);
      }

      setRoutineSavedSuccess(true);
      setTimeout(() => setRoutineSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving routine in Firestore:', err);
      setErrorMessage(err?.message || 'Erro ao salvar rotina.');
    } finally {
      setSaving(false);
    }
  };

  // Email Notification & SMTP Test State
  const [emailSending, setEmailSending] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; user?: string; host?: string } | null>(null);

  // Email Validation Workflow (Methodology contato@apponline.ia.br)
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(
    Boolean(currentUser.emailVerified || (currentUser.email && currentUser.email.toLowerCase() === 'silvano.kassio@gmail.com'))
  );
  const [verificationInputCode, setVerificationInputCode] = useState<string>('');
  const [isSendingVerificationCode, setIsSendingVerificationCode] = useState<boolean>(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState<boolean>(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [codeSentAt, setCodeSentAt] = useState<string | null>(null);

  // Check validation status against server on mount
  useEffect(() => {
    if (currentUser?.email) {
      checkEmailValidationStatus(currentUser.email).then((res) => {
        if (res.isValidated) {
          setIsEmailVerified(true);
        }
      });
    }
  }, [currentUser?.email]);

  const handleRequestVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      setVerificationFeedback({ type: 'error', text: 'Por favor, informe um endereço de e-mail válido primeiro.' });
      return;
    }

    setIsSendingVerificationCode(true);
    setVerificationFeedback(null);

    try {
      const res = await requestEmailVerificationCode({
        email,
        userName: name || currentUser.name,
      });

      if (res.success) {
        setCodeSentAt(new Date().toLocaleTimeString('pt-BR'));
        setVerificationFeedback({
          type: 'success',
          text: `Código de validação de 6 dígitos enviado para ${email} a partir de contato@apponline.ia.br. Verifique sua caixa de entrada e spam.`,
        });
      } else {
        setVerificationFeedback({
          type: 'error',
          text: res.error || 'Falha ao solicitar código de validação. Verifique a conexão com o servidor.',
        });
      }
    } catch (err: any) {
      setVerificationFeedback({
        type: 'error',
        text: err?.message || 'Erro de comunicação com o servidor de e-mail.',
      });
    } finally {
      setIsSendingVerificationCode(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    if (!verificationInputCode || verificationInputCode.trim().length < 4) {
      setVerificationFeedback({ type: 'error', text: 'Digite o código de 6 dígitos recebido por e-mail.' });
      return;
    }

    setIsSubmittingVerification(true);
    setVerificationFeedback(null);

    try {
      const res = await verifyEmailCode({
        email,
        code: verificationInputCode.trim(),
      });

      if (res.success) {
        setIsEmailVerified(true);
        setVerificationFeedback({
          type: 'success',
          text: '🎉 E-mail validado com sucesso! Seu endereço agora está autorizado a receber e-mails e confirmações automáticas do CaronaFlow.',
        });

        // Persist to user profile
        await updateFirestoreUserProfile(currentUser.id, {
          emailVerified: true,
        });

        onUserUpdated({
          ...currentUser,
          emailVerified: true,
        });
      } else {
        setVerificationFeedback({
          type: 'error',
          text: res.error || 'Código incorreto ou expirado. Tente novamente ou solicite um novo código.',
        });
      }
    } catch (err: any) {
      setVerificationFeedback({
        type: 'error',
        text: err?.message || 'Erro ao validar código.',
      });
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  useEffect(() => {
    checkEmailHealth()
      .then((res) => {
        if (res.smtp) {
          setSmtpStatus(res.smtp);
        }
      })
      .catch(() => {});
  }, []);

  // Re-sync if currentUser prop changes
  useEffect(() => {
    setName(currentUser.name || '');
    setEmail(currentUser.email || '');
    setPhone(currentUser.phone || '');
    setCpf(currentUser.cpf || '');
    setInstitutionName(currentUser.institutionName || '');
    setBio(currentUser.bio || '');
    setAvatar(currentUser.avatar || PRESET_AVATARS[0]);
    setRolePreference(currentUser.rolePreference || 'both');
    setPixKey(currentUser.pixKey || '');
    setAgency(currentUser.agency || '0001');
    setAccountNumber(currentUser.accountNumber || '');
    setBankName(currentUser.bankName || 'Nubank / Banco do Brasil');

    const vList = getUserVehicles(currentUser);
    if (vList.length > 0) {
      setVehiclesList(vList);
      setHasVehicle(true);
    } else if (currentUser.vehicle?.model) {
      setVehiclesList([{ ...currentUser.vehicle, id: `veh-${Date.now()}`, isPrimary: true }]);
      setHasVehicle(true);
    } else {
      setVehiclesList([]);
      setHasVehicle(false);
    }
  }, [currentUser]);

  // GPS Auto-locate
  const handleQuickGPS = async (target: 'residential' | 'meeting') => {
    setIsLocatingGPS(true);
    setErrorMessage(null);
    try {
      const coords = await getCurrentGPSPosition();
      const resolvedAddress = await reverseGeocode(coords.lat, coords.lng);
      if (target === 'residential') {
        setResAddress(resolvedAddress);
        setResLat(coords.lat);
        setResLng(coords.lng);
      } else {
        setCustomMeetingAddress(resolvedAddress);
        setCustomMeetingLat(coords.lat);
        setCustomMeetingLng(coords.lng);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível capturar o sinal GPS do dispositivo.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const residentialLocation: GeoLocation = {
        lat: resLat,
        lng: resLng,
        address: resAddress,
        name: 'Residência',
      };

      const defaultMeetingPoint: GeoLocation = useResAsMeeting
        ? residentialLocation
        : {
            lat: customMeetingLat,
            lng: customMeetingLng,
            address: customMeetingAddress || resAddress,
            name: customMeetingName || 'Ponto de Encontro Preferencial',
          };

      const updatedPreferences: UserPreferences = {
        allowMusic,
        musicStyle,
        allowPets,
        airConditioning,
        conversationStyle,
        womenOnlyRides,
        luggageSize,
        punctualityToleranceMinutes: punctualityTolerance,
        maxDetourDistanceMeters: maxDetourMeters,
        profileVisibility,
        showPhoneToPassengers,
        notifyNewRidesInGroups,
        notifyDriverDeparted,
        notifyRideAccepted: true,
        notifyAIOptimizations: true,
      };

      const cleanVehicles: Vehicle[] = hasVehicle
        ? vehiclesList
            .filter((v) => v.model && v.model.trim().length > 0)
            .map((v, idx) => ({
              id: v.id || `veh-${Date.now()}-${idx}`,
              model: v.model.trim(),
              plate: (v.plate || 'ABC-1234').trim().toUpperCase(),
              color: (v.color || 'Prata').trim(),
              year: (v.year || '2023').trim(),
              category: v.category || 'sedan',
              availableSeats: Number(v.availableSeats) || 4,
              isPrimary: Boolean(v.isPrimary),
            }))
        : [];

      // Ensure at least one vehicle is marked primary if list is not empty
      if (cleanVehicles.length > 0 && !cleanVehicles.some((v) => v.isPrimary)) {
        cleanVehicles[0].isPrimary = true;
      }

      const primaryVehicle = cleanVehicles.find((v) => v.isPrimary) || cleanVehicles[0] || undefined;

      const updatedRoutine: Routine = {
        id: currentUser.routine?.id || `rtn-${Date.now()}`,
        title: routineTitle.trim() || 'Minha Rotina Principal',
        origin: {
          address: routineOriginAddress.trim() || 'Origem Principal',
          lat: routineOriginLat,
          lng: routineOriginLng,
        },
        destination: {
          address: routineDestAddress.trim() || 'Destino Principal',
          lat: routineDestLat,
          lng: routineDestLng,
        },
        departureTime: routineDepartureTime,
        daysOfWeek: routineDays,
        defaultSeats: Number(routineDefaultSeats) || 3,
        defaultPrice: Number(routineDefaultPrice) || 6.50,
      };

      const updatedUser: User = {
        ...currentUser,
        name: name.trim() || currentUser.name,
        email: email.trim() || currentUser.email,
        phone: phone.trim(),
        cpf: cpf.trim(),
        institutionName: institutionName.trim(),
        bio: bio.trim(),
        avatar: avatar.trim(),
        gender,
        rolePreference,
        residentialAddress: residentialLocation,
        useResidentialAsMeetingPoint: useResAsMeeting,
        ponto_encontro_default: defaultMeetingPoint,
        routine: updatedRoutine,
        pixKey: pixKey.trim(),
        pixKeyType,
        bankName: bankName.trim(),
        agency: agency.trim(),
        accountNumber: accountNumber.trim(),
        vehicles: cleanVehicles,
        vehicle: primaryVehicle,
        preferences: updatedPreferences,
      };

      // Persist directly to Firebase Firestore
      await updateFirestoreUserProfile(currentUser.id, updatedUser);
      await saveFirestoreRoutine(currentUser.id, updatedRoutine);
      onUserUpdated(updatedUser);
      if (onUpdateRoutine) {
        onUpdateRoutine(updatedRoutine, defaultMeetingPoint);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } catch (err: any) {
      console.error('Error updating user profile in Firestore:', err);
      setErrorMessage(err?.message || 'Falha ao salvar as alterações no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-150">
      {/* Top Banner / Digital ID Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* User Info & Avatar */}
          <div className="flex items-start sm:items-center space-x-4 sm:space-x-6">
            <div className="relative group">
              <img
                src={avatar}
                alt={name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-indigo-500/40 shadow-md"
              />
              <button
                type="button"
                onClick={() => setActiveSection('identity')}
                className="absolute -bottom-2 -right-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition cursor-pointer"
                title="Alterar avatar"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">
                  {name || 'Nome do Usuário'}
                </h1>
                {isSuper && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                    <Crown className="w-3.5 h-3.5" />
                    Superusuário
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Conta Verificada
                </span>
              </div>

              <p className="text-xs text-indigo-200/80 flex items-center gap-2 flex-wrap">
                <span className="font-mono">{email}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  {institutionName || 'USP / Comunidade'}
                </span>
              </p>

              <div className="flex items-center gap-3 text-xs pt-1">
                <span className="text-amber-400 font-bold flex items-center gap-1 font-mono">
                  ★ {currentUser.rating?.toFixed(1) || '5.0'}
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-300">
                  <strong className="text-white font-mono">{currentUser.totalRidesOffered || 0}</strong> caronas dadas
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-300">
                  <strong className="text-white font-mono">{currentUser.totalRidesTaken || 0}</strong> viagens pegas
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Account Balance */}
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl self-stretch md:self-auto justify-between md:justify-end">
            <div className="text-left pr-4 border-r border-white/10">
              <span className="text-[10px] uppercase font-mono text-indigo-300 block">Saldo na Plataforma</span>
              <p className={`text-lg font-bold font-mono ${currentUser.saldo_caronas >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentUser.saldo_caronas >= 0 ? `+ R$ ${(currentUser.saldo_caronas * 6.50 + 39).toFixed(2)}` : `- R$ ${Math.abs(currentUser.saldo_caronas * 6.50).toFixed(2)}`}
              </p>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentUser.saldo_caronas >= 0 ? `+${currentUser.saldo_caronas}` : currentUser.saldo_caronas} viagens equivalentes
              </span>
            </div>

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('gamification')}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Extrato PIX</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Sub-Navigation + Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side Navigation Cards */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-3xl p-3 shadow-xs space-y-1 sticky top-20">
            <div className="p-3 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                Configurações da Conta
              </h3>
            </div>

            <button
              type="button"
              id="user-nav-identity"
              onClick={() => setActiveSection('identity')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'identity'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <UserIcon className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Cadastro Pessoal</p>
                  <p className={`text-[10px] ${activeSection === 'identity' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Nome, contato, biografia e foto
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              id="user-nav-routines"
              onClick={() => setActiveSection('routines')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'routines'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Repeat className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Rotinas Fixas & Trajetos</p>
                  <p className={`text-[10px] ${activeSection === 'routines' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Horários, percursos habituais e ponto fixo
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              id="user-nav-commute"
              onClick={() => setActiveSection('commute')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'commute'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Sliders className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Preferências de Viagem</p>
                  <p className={`text-[10px] ${activeSection === 'commute' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Música, ar, conversa e pets
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('locations')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'locations'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <MapPin className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Endereços & Ponto Fixo</p>
                  <p className={`text-[10px] ${activeSection === 'locations' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Residência e pontos de encontro
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('vehicle')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'vehicle'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Car className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Meu Veículo & Garagem</p>
                  <p className={`text-[10px] ${activeSection === 'vehicle' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Placa Mercosul, cor e vagas
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('financial')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'financial'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <CreditCard className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Chave PIX & Bancário</p>
                  <p className={`text-[10px] ${activeSection === 'financial' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Recebimento de rateios
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('privacy')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'privacy'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Shield className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">Privacidade & Notificações</p>
                  <p className={`text-[10px] ${activeSection === 'privacy' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Alertas ao vivo e visibilidade
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('emails')}
              className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition cursor-pointer ${
                activeSection === 'emails'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-50 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4" />
                <div>
                  <p className="text-xs leading-tight">E-mails de Confirmação</p>
                  <p className={`text-[10px] ${activeSection === 'emails' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Configurações SMTP & Diagnóstico
                  </p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>

          {/* Quick Info Box */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-3xl p-5 text-slate-700 space-y-2.5">
            <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Sincronização em Nuvem</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Todos os seus dados e preferências são salvos de forma criptografada no Google Cloud Firestore e utilizados pelo motor de IA para sugerir caronas perfeitas.
            </p>
          </div>
        </div>

        {/* Right Side Content Panel */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSaveAll} className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-8">
            
            {/* Feedback Banners */}
            {saveSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-800 text-xs font-semibold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">Alterações salvas com sucesso!</p>
                  <p className="text-[11px] font-normal text-emerald-700">Seu cadastro e preferências foram sincronizados no Firestore.</p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-rose-800 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold">Erro ao salvar dados</p>
                  <p className="text-[11px] font-normal text-rose-700">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* SECTION 1: CADASTRO PESSOAL & IDENTIDADE */}
            {activeSection === 'identity' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-indigo-600" />
                    Cadastro Pessoal & Identidade
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Informações básicas do seu perfil para identificação nas comunidades e caronas.
                  </p>
                </div>

                {/* Avatar Selection */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-700">Escolha seu Avatar de Perfil</label>
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatar(url)}
                        className={`relative rounded-2xl overflow-hidden shrink-0 border-2 transition active:scale-95 cursor-pointer ${
                          avatar === url ? 'border-indigo-600 ring-2 ring-indigo-600/30' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="Avatar option" className="w-12 h-12 object-cover" />
                        {avatar === url && (
                          <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium mb-1">Ou insira a URL de uma foto personalizada:</label>
                    <input
                      type="url"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      placeholder="https://exemplo.com/sua-foto.jpg"
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">E-mail Principal</label>
                      {isEmailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Validado (contato@apponline.ia.br)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveSection('emails')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition cursor-pointer"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Validar E-mail
                        </button>
                      )}
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@dominio.com"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                    />
                  </div>
                </div>

                {/* Phone & CPF */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">WhatsApp / Telefone</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 98765-4321"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">CPF (Para validação de segurança)</label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={cpf}
                        onChange={(e) => setCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Institution & Bio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Empresa / Universidade / Campus</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={institutionName}
                        onChange={(e) => setInstitutionName(e.target.value)}
                        placeholder="Ex: USP - Poli, Nubank HQ, Google Campus"
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Papel Prioritário de Mobilidade</label>
                    <select
                      value={rolePreference}
                      onChange={(e) => setRolePreference(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                    >
                      <option value="both">Flexível (Ofereço e Pego Carona)</option>
                      <option value="driver">Principalmente Motorista (Oferecer)</option>
                      <option value="passenger">Principalmente Passageiro (Pegar)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Apresentação / Mini Biografia</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Conte um pouco sobre sua rotina, curso ou trabalho para os outros membros da comunidade..."
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium resize-none"
                  />
                </div>
              </div>
            )}

            {/* SECTION: ROTINAS FIXAS & TRAJETOS */}
            {activeSection === 'routines' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Repeat className="w-5 h-5 text-indigo-600" />
                      Rotinas Fixas & Trajetos Recorrentes
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Configure seus trajetos habituais, horários, ponto fixo e vagas para sincronização com a IA de Rotas e publicação ágil.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToTab) {
                          onNavigateToTab('rides');
                        }
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition active:scale-95 flex items-center space-x-1.5 cursor-pointer border border-slate-200"
                    >
                      <Car className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Publicar Rápida</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Sub-card 1: Identificação & Horários */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    1. Identificação & Dias Recorrentes
                  </h3>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">Título / Identificação da Rotina</label>
                      <input
                        type="text"
                        value={routineTitle}
                        onChange={(e) => setRoutineTitle(e.target.value)}
                        placeholder="Ex: Pinheiros ➔ USP Poli (Manhã) ou Trajeto Faria Lima"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          Horário Habitual de Saída
                        </label>
                        <input
                          type="time"
                          value={routineDepartureTime}
                          onChange={(e) => setRoutineDepartureTime(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">Vagas Padrão Oferecidas</label>
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={routineDefaultSeats}
                          onChange={(e) => setRoutineDefaultSeats(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">Rateio Sugerido (R$/vaga)</label>
                        <input
                          type="number"
                          step="0.50"
                          min={0}
                          value={routineDefaultPrice}
                          onChange={(e) => setRoutineDefaultPrice(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                        />
                      </div>
                    </div>

                    {/* Days of week */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-700">Dias da Semana Ativos</label>
                        <button
                          type="button"
                          onClick={() => setRoutineDays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex'])}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                        >
                          Segunda a Sexta
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeekList.map((day) => {
                          const isSelected = routineDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleRoutineDay(day)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-card 2: Trajeto Habitual (Origem e Destino) */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    2. Percurso Habitual (Origem & Destino)
                  </h3>

                  <div className="space-y-4">
                    {/* Routine Origin */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          Endereço Habitual de Origem (Partida)
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (resAddress) {
                                setRoutineOriginAddress(resAddress);
                                setRoutineOriginLat(resLat);
                                setRoutineOriginLng(resLng);
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg border border-slate-200 transition cursor-pointer"
                          >
                            Usar Residência
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRoutineQuickGPS('origin')}
                            disabled={isLocatingGPS}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {isLocatingGPS ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                            <span>GPS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapPickerTarget('routineOrigin')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-indigo-600" />
                            <span>Mapa</span>
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={routineOriginAddress}
                          onChange={(e) => setRoutineOriginAddress(e.target.value)}
                          placeholder="Rua, número, bairro e cidade de partida"
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setMapPickerTarget('routineOrigin')}
                          className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Routine Destination */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-600" />
                          Endereço Habitual de Destino (Chegada)
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRoutineQuickGPS('dest')}
                            disabled={isLocatingGPS}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {isLocatingGPS ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                            <span>GPS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapPickerTarget('routineDest')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-indigo-600" />
                            <span>Mapa</span>
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={routineDestAddress}
                          onChange={(e) => setRoutineDestAddress(e.target.value)}
                          placeholder="Campus universitário, prédio corporativo ou endereço de chegada"
                          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setMapPickerTarget('routineDest')}
                          className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-card 3: Ponto de Encontro Padrão & Presets */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-amber-600" />
                      3. Ponto de Encontro Padrão para Embarque Rápido
                    </h3>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      Matching Inteligente
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ponto estratégico de fácil acesso para encontro entre motorista e passageiros sem gerar desvios excessivos no trajeto.
                  </p>

                  <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{routineMeetingPoint.name || 'Ponto de Encontro Configurado'}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{routineMeetingPoint.address}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          Coordenadas: ({routineMeetingPoint.lat.toFixed(4)}, {routineMeetingPoint.lng.toFixed(4)})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRoutineQuickGPS('meeting')}
                        disabled={isLocatingGPS}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isLocatingGPS ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                        <span>Meu GPS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapPickerTarget('routineMeeting')}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Apontar no Mapa</span>
                      </button>
                    </div>
                  </div>

                  {/* Preset Hubs */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-bold text-slate-700">Hubs Acadêmicos e Corporativos Frequentes:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {PRESET_MEETING_POINTS.map((preset, idx) => {
                        const isSelected = routineMeetingPoint.address === preset.address;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setRoutineMeetingPoint(preset)}
                            className={`text-left p-3 rounded-xl border text-xs transition active:scale-95 flex items-start space-x-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 truncate">{preset.name}</p>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">{preset.address}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Routine Dedicated Actions Card */}
                <div className="p-5 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl border border-indigo-800 shadow-md space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Sincronização & Publicação Instantânea
                      </h4>
                      <p className="text-xs text-indigo-200/80">
                        Salve sua rotina com 1 clique para alimentar o motor de inteligência e acelerar ofertas diárias.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveRoutineOnly}
                        disabled={saving}
                        className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar Rotina</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToTab) {
                            onNavigateToTab('rides');
                          }
                        }}
                        className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-2 cursor-pointer"
                      >
                        <Car className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Publicar Carona</span>
                      </button>
                    </div>
                  </div>

                  {routineSavedSuccess && (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center space-x-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Rotina e Ponto de Encontro salvos no Cloud Firestore com sucesso!</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 2: PREFERÊNCIAS DE VIAGEM & CONVIVÊNCIA */}
            {activeSection === 'commute' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-600" />
                    Preferências de Convivência & Viagem
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Defina o clima ideal no trajeto para garantir conforto e compatibilidade mútua.
                  </p>
                </div>

                {/* Music Preferences */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Music className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800">Música no Carro</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowMusic}
                        onChange={(e) => setAllowMusic(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {allowMusic && (
                    <div className="pt-1">
                      <label className="block text-[11px] text-slate-600 font-medium mb-1">Estilo Musical / Podcasts Favoritos:</label>
                      <input
                        type="text"
                        value={musicStyle}
                        onChange={(e) => setMusicStyle(e.target.value)}
                        placeholder="Ex: MPB, Pop Internacional, Rock Clássico, Podcasts de Notícias"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* Conversation & Atmosphere */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                      Estilo de Conversa
                    </label>
                    <select
                      value={conversationStyle}
                      onChange={(e) => setConversationStyle(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium bg-white"
                    >
                      <option value="talkative">Adoro conversar e interagir</option>
                      <option value="quiet">Prefiro silêncio / trajeto tranquilo</option>
                      <option value="flexible">Flexível (conforme o momento)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Tolerância de Espera no Ponto
                    </label>
                    <select
                      value={punctualityTolerance}
                      onChange={(e) => setPunctualityTolerance(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium bg-white"
                    >
                      <option value={0}>Pontualidade estrita (0 min)</option>
                      <option value={5}>Até 5 minutos de tolerância</option>
                      <option value={10}>Até 10 minutos de tolerância</option>
                      <option value={15}>Até 15 minutos (Flexível)</option>
                    </select>
                  </div>
                </div>

                {/* Toggles: Air Conditioning, Pets, Women-only */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Wind className="w-4 h-4 text-cyan-600" />
                      <span className="text-xs font-bold text-slate-800">Ar-Condicionado</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={airConditioning}
                      onChange={(e) => setAirConditioning(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Dog className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-slate-800">Pet Friendly</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowPets}
                      onChange={(e) => setAllowPets(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-4 h-4 text-rose-600" />
                      <span className="text-xs font-bold text-slate-800">Apenas Mulheres</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={womenOnlyRides}
                      onChange={(e) => setWomenOnlyRides(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300"
                    />
                  </div>
                </div>

                {/* Max Detour Distance for Pickups */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Raio Máximo de Desvio para Buscar Passageiros:</span>
                    <span className="font-mono font-bold text-indigo-600">{maxDetourMeters} metros ({(maxDetourMeters / 1000).toFixed(1)} km)</span>
                  </div>
                  <input
                    type="range"
                    min={300}
                    max={4000}
                    step={100}
                    value={maxDetourMeters}
                    onChange={(e) => setMaxDetourMeters(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>300m (Direto na rota)</span>
                    <span>2.000m (Moderado)</span>
                    <span>4.000m (Amplo)</span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: ENDEREÇOS & PONTO FIXO */}
            {activeSection === 'locations' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-600" />
                    Endereço Residencial & Ponto de Encontro
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure sua base de partida e o ponto público ideal para embarque ágil.
                  </p>
                </div>

                {/* Residential Address */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-indigo-600" />
                      Endereço Residencial (Base)
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleQuickGPS('residential')}
                        disabled={isLocatingGPS}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex items-center space-x-1 transition cursor-pointer"
                      >
                        {isLocatingGPS ? <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> : <Navigation className="w-3 h-3 text-indigo-600" />}
                        <span>Capturar GPS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapPickerTarget('residential')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center space-x-1 transition cursor-pointer"
                      >
                        <Compass className="w-3 h-3" />
                        <span>Escolher no Mapa</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={resAddress}
                    onChange={(e) => setResAddress(e.target.value)}
                    placeholder="Rua, número, bairro, cidade - UF"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                  />
                  <p className="text-[10px] text-slate-400 font-mono">
                    Coordenadas: Lat {resLat.toFixed(5)}, Lng {resLng.toFixed(5)}
                  </p>
                </div>

                {/* Meeting point toggle */}
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Usar residência como ponto de encontro?</p>
                      <p className="text-[11px] text-slate-600">
                        Se desmarcado, você poderá cadastrar um ponto público seguro (ex: estação de metrô ou praça).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={useResAsMeeting}
                        onChange={(e) => setUseResAsMeeting(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {!useResAsMeeting && (
                    <div className="space-y-3 pt-2 border-t border-indigo-100/80">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">Nome do Ponto Público</label>
                          <input
                            type="text"
                            value={customMeetingName}
                            onChange={(e) => setCustomMeetingName(e.target.value)}
                            placeholder="Ex: Metrô Butantã (Linha 4)"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">Ações no Mapa</label>
                          <button
                            type="button"
                            onClick={() => setMapPickerTarget('meeting')}
                            className="w-full py-2 px-3 text-xs font-semibold bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Definir Ponto no Mapa</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Endereço do Ponto</label>
                        <input
                          type="text"
                          value={customMeetingAddress}
                          onChange={(e) => setCustomMeetingAddress(e.target.value)}
                          placeholder="Av. Vital Brasil, 500 - Butantã"
                          className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 4: MEU VEÍCULO & GARAGEM */}
            {activeSection === 'vehicle' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Car className="w-5 h-5 text-indigo-600" />
                    Meu Veículo & Garagem
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Cadastre os dados do seu automóvel para habilitar a oferta de caronas na plataforma.
                  </p>
                </div>

                {/* Driver Toggle */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Possuo veículo e quero oferecer caronas</p>
                    <p className="text-[11px] text-slate-600">
                      Habilite para publicar rotas e receber passageiros com rateio financeiro automático.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={hasVehicle}
                      onChange={(e) => setHasVehicle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {hasVehicle && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Veículos Cadastrados na Sua Garagem ({vehiclesList.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Selecione o veículo principal padrão ou adicione outros carros que você utiliza para dar carona.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newVeh: Vehicle = {
                            id: `veh-${Date.now()}`,
                            model: '',
                            plate: '',
                            color: 'Prata',
                            year: '2023',
                            category: 'sedan',
                            availableSeats: 4,
                            isPrimary: vehiclesList.length === 0,
                          };
                          setVehiclesList([...vehiclesList, newVeh]);
                        }}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Adicionar Outro Veículo</span>
                      </button>
                    </div>

                    {vehiclesList.length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                        <p className="text-xs text-slate-600">Nenhum veículo cadastrado ainda.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setVehiclesList([
                              {
                                id: `veh-${Date.now()}`,
                                model: 'Toyota Corolla 2.0',
                                plate: 'BRA2E19',
                                color: 'Prata',
                                year: '2023',
                                category: 'sedan',
                                availableSeats: 4,
                                isPrimary: true,
                              },
                            ]);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                        >
                          Cadastrar Primeiro Veículo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {vehiclesList.map((veh, index) => {
                          const isPrimary = Boolean(veh.isPrimary);
                          return (
                            <div
                              key={veh.id || index}
                              className={`p-4 rounded-2xl border transition space-y-4 ${
                                isPrimary
                                  ? 'bg-indigo-50/40 border-indigo-300 ring-2 ring-indigo-500/20'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                                <div className="flex items-center space-x-2">
                                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900">
                                    {veh.model || `Veículo ${index + 1}`}
                                  </span>
                                  {isPrimary && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
                                      Veículo Principal
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2">
                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVehiclesList(
                                          vehiclesList.map((v, i) => ({
                                            ...v,
                                            isPrimary: i === index,
                                          }))
                                        );
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
                                    >
                                      Definir como Principal
                                    </button>
                                  )}
                                  {vehiclesList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = vehiclesList.filter((_, i) => i !== index);
                                        if (isPrimary && updated.length > 0) {
                                          updated[0].isPrimary = true;
                                        }
                                        setVehiclesList(updated);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="Remover veículo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-bold text-slate-700">Modelo e Versão</label>
                                  <input
                                    type="text"
                                    value={veh.model}
                                    onChange={(e) => {
                                      const updated = [...vehiclesList];
                                      updated[index] = { ...updated[index], model: e.target.value };
                                      setVehiclesList(updated);
                                    }}
                                    placeholder="Ex: Toyota Corolla / Honda Civic"
                                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[11px] font-bold text-slate-700">Cor do Veículo</label>
                                  <input
                                    type="text"
                                    value={veh.color || ''}
                                    onChange={(e) => {
                                      const updated = [...vehiclesList];
                                      updated[index] = { ...updated[index], color: e.target.value };
                                      setVehiclesList(updated);
                                    }}
                                    placeholder="Ex: Prata, Preto, Cinza"
                                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-bold text-slate-700">Placa (Mercosul)</label>
                                  <input
                                    type="text"
                                    value={veh.plate}
                                    onChange={(e) => {
                                      const updated = [...vehiclesList];
                                      updated[index] = { ...updated[index], plate: e.target.value.toUpperCase() };
                                      setVehiclesList(updated);
                                    }}
                                    placeholder="ABC1D23"
                                    maxLength={8}
                                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[11px] font-bold text-slate-700">Ano</label>
                                  <input
                                    type="text"
                                    value={veh.year || '2023'}
                                    onChange={(e) => {
                                      const updated = [...vehiclesList];
                                      updated[index] = { ...updated[index], year: e.target.value };
                                      setVehiclesList(updated);
                                    }}
                                    placeholder="2023"
                                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[11px] font-bold text-slate-700">Vagas Disponíveis</label>
                                  <select
                                    value={veh.availableSeats || 4}
                                    onChange={(e) => {
                                      const updated = [...vehiclesList];
                                      updated[index] = { ...updated[index], availableSeats: Number(e.target.value) };
                                      setVehiclesList(updated);
                                    }}
                                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                                  >
                                    <option value={1}>1 Passageiro</option>
                                    <option value={2}>2 Passageiros</option>
                                    <option value={3}>3 Passageiros</option>
                                    <option value={4}>4 Passageiros (Padrão)</option>
                                    <option value={5}>5 ou mais</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 5: CHAVE PIX & DADOS BANCÁRIOS */}
            {activeSection === 'financial' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    Chave PIX & Dados Bancários para Rateio
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Cadastre sua chave PIX para repasses e compensações financeiras automáticas de combustível.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">Tipo de Chave PIX</label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                    >
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone Celular</option>
                      <option value="cpf">CPF</option>
                      <option value="random">Chave Aleatória (EVP)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700">Chave PIX Cadastrada</label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="seu.pix@exemplo.com ou (11) 98765-4321"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">Banco / Instituição</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Nubank, Itaú, BB"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">Agência Bancária</label>
                    <input
                      type="text"
                      value={agency}
                      onChange={(e) => setAgency(e.target.value)}
                      placeholder="0001"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">Conta Corrente</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="12345-6"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: PRIVACIDADE & NOTIFICAÇÕES */}
            {activeSection === 'privacy' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    Privacidade & Notificações em Tempo Real
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Controle o que os outros membros veem e quando você deseja ser notificado.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Visibilidade do Perfil</p>
                      <p className="text-[11px] text-slate-600">
                        {profileVisibility === 'public' ? 'Visível para todos os membros e grupos da plataforma' : 'Apenas membros dos meus grupos corporativos/acadêmicos'}
                      </p>
                    </div>
                    <select
                      value={profileVisibility}
                      onChange={(e) => setProfileVisibility(e.target.value as any)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    >
                      <option value="public">Público na Comunidade</option>
                      <option value="groups_only">Apenas Meus Grupos</option>
                      <option value="verified_only">Apenas Usuários Verificados</option>
                    </select>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Exibir WhatsApp para Passageiros Confirmados</p>
                      <p className="text-[11px] text-slate-600">
                        Facilita o contato no momento do embarque.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={showPhoneToPassengers}
                      onChange={(e) => setShowPhoneToPassengers(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Alertas de Novas Caronas nos Meus Grupos</p>
                      <p className="text-[11px] text-slate-600">
                        Receba notificações push quando colegas publicarem rotas compatíveis.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyNewRidesInGroups}
                      onChange={(e) => setNotifyNewRidesInGroups(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Alerta de Partida do Motorista (Ao Vivo)</p>
                      <p className="text-[11px] text-slate-600">
                        Aviso instantâneo quando o condutor iniciar o trajeto GPS.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyDriverDeparted}
                      onChange={(e) => setNotifyDriverDeparted(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300"
                    />
                  </div>
                </div>

                {/* SUPERADMIN: GESTÃO E PURGA DE CONTAS EM FIRESTORE */}
                {isSuper && allUsers && allUsers.length > 0 && (
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Painel SuperAdmin: Contas Cadastradas no Firestore ({allUsers.length})
                        </h4>
                      </div>
                      <span className="text-[10px] text-amber-400 font-mono">Gerenciamento Direto</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Você pode visualizar as contas sincronizadas no Firestore e excluir duplicatas ou contas de teste.
                    </p>

                    <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto pr-1">
                      {allUsers.map((u) => (
                        <div key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-xl object-cover ring-1 ring-slate-700 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.id === currentUser.id && <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded-sm">Você</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{u.email} <span className="text-slate-500">({u.id})</span></p>
                            </div>
                          </div>

                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => setTargetUserToDelete(u)}
                              className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600/50 rounded-lg transition cursor-pointer shrink-0"
                              title={`Excluir conta de ${u.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ZONA DE PERIGO: EXCLUSÃO DA PRÓPRIA CONTA */}
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                      Zona de Perigo: Excluir Minha Conta
                    </h4>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    A exclusão da conta é permanente e irreversível. Todos os seus dados cadastrais, rotinas diárias, veículos e chave PIX serão apagados imediatamente do banco de dados Firestore.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmText('');
                        setShowDeleteModal(true);
                      }}
                      className="px-4 py-2 bg-white hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Minha Conta Permanentemente</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Email Notifications & SMTP Diagnostics (Padrão GEA) */}
            {activeSection === 'emails' && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600 font-mono uppercase tracking-wider">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Módulo de E-mails & Validação Oficial</span>
                  </div>
                  <h2 className="font-display font-bold text-lg text-slate-900 mt-1">
                    Validação de E-mail & Notificações Automáticas
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Metodologia de segurança: e-mails automáticos do CaronaFlow são enviados exclusivamente para e-mails validados via <strong>contato@apponline.ia.br</strong>.
                  </p>
                </div>

                {/* EMAIL VALIDATION WORKFLOW CARD */}
                <div className={`p-6 rounded-3xl border transition-all ${
                  isEmailVerified 
                    ? 'bg-emerald-50/60 border-emerald-200' 
                    : 'bg-indigo-50/70 border-indigo-200'
                } space-y-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                        isEmailVerified 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-indigo-600 text-white'
                      }`}>
                        {isEmailVerified ? <CheckCircle2 className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-sm text-slate-900">
                            {isEmailVerified ? 'E-mail Validado com Sucesso' : 'Validação de E-mail Obrigatória'}
                          </h3>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            isEmailVerified 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {isEmailVerified ? '● Autorizado' : '● Validação Pendente'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          {email || 'Nenhum e-mail informado'}
                        </p>
                      </div>
                    </div>

                    {!isEmailVerified && (
                      <button
                        type="button"
                        disabled={isSendingVerificationCode || !email}
                        onClick={handleRequestVerificationCode}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSendingVerificationCode ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando código...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{codeSentAt ? 'Reenviar Código de 6 Dígitos' : 'Solicitar Código de 6 Dígitos'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {isEmailVerified ? (
                    <div className="p-4 bg-white rounded-2xl border border-emerald-200 text-xs text-slate-700 space-y-1.5">
                      <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Seu e-mail está verificado e pronto para receber mensagens automáticas.
                      </p>
                      <p className="text-slate-600">
                        Você receberá notificações automáticas em tempo real sobre confirmação de caronas, solicitações de passageiros, acolhimento de pedidos e trajeto GPS ao vivo enviadas por <strong>contato@apponline.ia.br</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div className="p-4 bg-white rounded-2xl border border-indigo-100 text-xs text-slate-600 space-y-2">
                        <p className="font-semibold text-slate-800">
                          📌 Como funciona a metodologia de validação:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                          <li>Clique em <strong>Solicitar Código</strong> acima para enviarmos um PIN de segurança de 6 dígitos.</li>
                          <li>O e-mail será disparado a partir de <strong>contato@apponline.ia.br</strong> com o código de 15 minutos.</li>
                          <li>Digite o código recebido abaixo e clique em <strong>Confirmar Validação</strong>.</li>
                        </ul>
                      </div>

                      {/* Code Input Box */}
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full sm:flex-1">
                          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 font-mono">
                            Código de 6 Dígitos
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            value={verificationInputCode}
                            onChange={(e) => setVerificationInputCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ex: 849201"
                            className="w-full px-4 py-2.5 text-center text-lg font-mono font-black tracking-widest border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={isSubmittingVerification || verificationInputCode.trim().length < 4}
                          onClick={handleConfirmVerificationCode}
                          className="w-full sm:w-auto mt-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSubmittingVerification ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Validando...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Confirmar Validação</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback Message */}
                  {verificationFeedback && (
                    <div className={`p-3.5 rounded-2xl text-xs flex items-center space-x-2.5 ${
                      verificationFeedback.type === 'success'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : verificationFeedback.type === 'error'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    }`}>
                      {verificationFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-medium">{verificationFeedback.text}</span>
                    </div>
                  )}
                </div>

                {/* SMTP Status Card - Exclusivo para Superusuário */}
                {isSuper && (
                  <div className="p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl border border-indigo-800 shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold">Serviço de Envio SMTP</h4>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40 rounded-md">
                              Painel SuperUser
                            </span>
                          </div>
                          <p className="text-xs text-indigo-200/70 font-mono">
                            {smtpStatus?.configured ? `Conectado: ${smtpStatus.user || 'silvano.kassio@gmail.com'}` : 'Modo Simulação / SMTP em Configuração'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                          smtpStatus?.configured 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {smtpStatus?.configured ? '● SMTP Ativo' : '● Modo Simulado'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">Host SMTP</span>
                        <strong className="text-white font-mono text-xs">{smtpStatus?.host || 'smtp.gmail.com'}</strong>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">Porta</span>
                        <strong className="text-white font-mono text-xs">587 (TLS / STARTTLS)</strong>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">Remetente</span>
                        <strong className="text-white font-mono text-xs">Caronas Universitárias</strong>
                      </div>
                    </div>

                    {/* Test Dispatch Button */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                      <p className="text-[11px] text-indigo-200/80">
                        Destino do teste: <strong className="text-white font-mono">{email || 'Seu e-mail cadastrado'}</strong>
                      </p>
                      <button
                        type="button"
                        disabled={emailSending}
                        onClick={async () => {
                          setEmailSending(true);
                          setEmailSendResult(null);
                          try {
                            const res = await sendEmailConfirmation({
                              type: 'RIDE_CREATED',
                              recipientEmail: email || 'usuario@usp.br',
                              recipientName: name || 'Usuário',
                              rideId: 'teste-smtp',
                              rideData: {
                                originAddress: resAddress || 'Campus Central USP',
                                destinationAddress: 'Av. Paulista, 1000 - Bela Vista',
                                departureDate: new Date().toLocaleDateString('pt-BR'),
                                departureTime: '08:00',
                                price: 6.50,
                                totalSeats: 3,
                                vehicleModel: vehiclesList[0]?.model || 'Veículo Cadastrado',
                                vehiclePlate: vehiclesList[0]?.plate || 'BRA-2026',
                                groupName: 'Docentes & Alunos USP',
                                notes: 'Disparo de validação do serviço de e-mails.',
                              },
                            });
                            if (res.success) {
                              setEmailSendResult({
                                success: true,
                                message: res.simulated
                                  ? 'E-mail de confirmação gerado e simulado com sucesso (Console do Servidor).'
                                  : 'E-mail de teste enviado com sucesso para ' + (email || 'seu endereço') + '!',
                              });
                            } else {
                              setEmailSendResult({
                                success: false,
                                message: res.error || 'Falha ao enviar e-mail de teste.',
                              });
                            }
                          } catch (err: any) {
                            setEmailSendResult({
                              success: false,
                              message: err?.message || 'Erro de conexão com o endpoint de e-mails.',
                            });
                          } finally {
                            setEmailSending(false);
                          }
                        }}
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {emailSending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar E-mail de Teste</span>
                          </>
                        )}
                      </button>
                    </div>

                    {emailSendResult && (
                      <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                        emailSendResult.success 
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' 
                          : 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                      }`}>
                        {emailSendResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                        <span>{emailSendResult.message}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Trigger Matrix */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                    Gatilhos de Confirmação Ativos no Aplicativo
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-indigo-600">
                        <Car className="w-4 h-4" />
                        <h5 className="text-xs font-bold text-slate-900">1. Publicação de Carona</h5>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Envia resumo com trajeto, horário, vagas disponíveis e regras de convivência para o motorista.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-amber-600">
                        <Clock className="w-4 h-4" />
                        <h5 className="text-xs font-bold text-slate-900">2. Solicitação de Vaga</h5>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Notifica o motorista da nova solicitação e confirma para o passageiro que o pedido está em análise.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <h5 className="text-xs font-bold text-slate-900">3. Vaga Aprovada / Aceite</h5>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Dispara para o passageiro os dados completos de embarque, ponto de encontro e placa do veículo.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-purple-600">
                        <Sparkles className="w-4 h-4" />
                        <h5 className="text-xs font-bold text-slate-900">4. Proposta de Acolhimento</h5>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Avisa o passageiro solicitante sobre nova oferta de motorista e confirma aceite para ambas as partes.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-blue-600">
                        <Navigation className="w-4 h-4" />
                        <h5 className="text-xs font-bold text-slate-900">5. Viagem Iniciada</h5>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Alerta os passageiros que o motorista partiu e iniciou o rastreamento por GPS em tempo real.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-emerald-700">
                        <CreditCard className="w-4 h-4" />
                        <h5 className="text-xs font-bold text-slate-900">6. Recibo de Conclusão & CO₂</h5>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Envia extrato com valor de compensação de combustível e kg de carbono poupados pelo trajeto compartilhado.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Form Actions */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Sincronização com Cloud Firestore Ativa</span>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando no Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar Todas as Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Map Picker Modal */}
      {mapPickerTarget && (
        <LocationPickerModal
          isOpen={true}
          title={
            mapPickerTarget === 'residential'
              ? 'Definir Residência no Mapa'
              : mapPickerTarget === 'meeting'
              ? 'Definir Ponto de Encontro no Mapa'
              : mapPickerTarget === 'routineOrigin'
              ? 'Definir Origem da Rotina no Mapa'
              : mapPickerTarget === 'routineDest'
              ? 'Definir Destino da Rotina no Mapa'
              : 'Definir Ponto Fixo da Rotina no Mapa'
          }
          initialLat={
            mapPickerTarget === 'residential'
              ? resLat
              : mapPickerTarget === 'meeting'
              ? customMeetingLat
              : mapPickerTarget === 'routineOrigin'
              ? routineOriginLat
              : mapPickerTarget === 'routineDest'
              ? routineDestLat
              : routineMeetingPoint.lat
          }
          initialLng={
            mapPickerTarget === 'residential'
              ? resLng
              : mapPickerTarget === 'meeting'
              ? customMeetingLng
              : mapPickerTarget === 'routineOrigin'
              ? routineOriginLng
              : mapPickerTarget === 'routineDest'
              ? routineDestLng
              : routineMeetingPoint.lng
          }
          initialAddress={
            mapPickerTarget === 'residential'
              ? resAddress
              : mapPickerTarget === 'meeting'
              ? customMeetingAddress
              : mapPickerTarget === 'routineOrigin'
              ? routineOriginAddress
              : mapPickerTarget === 'routineDest'
              ? routineDestAddress
              : routineMeetingPoint.address
          }
          onClose={() => setMapPickerTarget(null)}
          onSelectLocation={(location) => {
            if (mapPickerTarget === 'residential') {
              setResAddress(location.address);
              setResLat(location.lat);
              setResLng(location.lng);
            } else if (mapPickerTarget === 'meeting') {
              setCustomMeetingAddress(location.address);
              setCustomMeetingLat(location.lat);
              setCustomMeetingLng(location.lng);
            } else if (mapPickerTarget === 'routineOrigin') {
              setRoutineOriginAddress(location.address);
              setRoutineOriginLat(location.lat);
              setRoutineOriginLng(location.lng);
            } else if (mapPickerTarget === 'routineDest') {
              setRoutineDestAddress(location.address);
              setRoutineDestLat(location.lat);
              setRoutineDestLng(location.lng);
            } else if (mapPickerTarget === 'routineMeeting') {
              setRoutineMeetingPoint({
                lat: location.lat,
                lng: location.lng,
                address: location.address,
                name: location.name || 'Ponto de Encontro Selecionado',
              });
            }
            setMapPickerTarget(null);
          }}
          onConfirm={(location) => {
            if (mapPickerTarget === 'residential') {
              setResAddress(location.address);
              setResLat(location.lat);
              setResLng(location.lng);
            } else if (mapPickerTarget === 'meeting') {
              setCustomMeetingAddress(location.address);
              setCustomMeetingLat(location.lat);
              setCustomMeetingLng(location.lng);
            } else if (mapPickerTarget === 'routineOrigin') {
              setRoutineOriginAddress(location.address);
              setRoutineOriginLat(location.lat);
              setRoutineOriginLng(location.lng);
            } else if (mapPickerTarget === 'routineDest') {
              setRoutineDestAddress(location.address);
              setRoutineDestLat(location.lat);
              setRoutineDestLng(location.lng);
            } else if (mapPickerTarget === 'routineMeeting') {
              setRoutineMeetingPoint({
                lat: location.lat,
                lng: location.lng,
                address: location.address,
                name: location.name || 'Ponto de Encontro Selecionado',
              });
            }
            setMapPickerTarget(null);
          }}
        />
      )}

      {/* Confirmation Modal for Self Account Deletion */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Excluir Sua Conta Permanentemente?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta ação é <strong>definitiva e irreversível</strong>. Todas as suas rotinas, viagens ofertadas, veículos e dados pessoais serão excluídos do Google Cloud Firestore.
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Digite <span className="text-rose-600 font-mono font-black">EXCLUIR</span> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-center font-bold text-slate-900 uppercase focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteSelfAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR' || isDeletingMyAccount}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeletingMyAccount ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Admin deleting another User */}
      {targetUserToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Excluir Conta de Usuário?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Você está prestes a remover o usuário <strong>{targetUserToDelete.name}</strong> ({targetUserToDelete.email}) diretamente do banco de dados Firestore.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTargetUserToDelete(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleAdminDeleteUser(targetUserToDelete)}
                disabled={isDeletingTargetUser}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeletingTargetUser ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir do Firestore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
