import React, { useState } from 'react';
import { X, User as UserIcon, Car, MapPin, CreditCard, Sparkles, Check, Home, Shield, Phone, Navigation, Loader2, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { User, GeoLocation, Vehicle, getUserVehicles } from '../types';
import { updateFirestoreUserProfile, deleteMyAccount } from '../lib/firebase';
import { LocationPickerModal } from './LocationPickerModal';
import { getCurrentGPSPosition, reverseGeocode } from '../lib/geo';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserUpdated: (updated: User) => void;
  onUserDeleted?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onUserDeleted,
}) => {
  if (!isOpen || !currentUser) return null;

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone || '');
  
  // Residential address & meeting point settings
  const [resAddress, setResAddress] = useState(
    currentUser.residentialAddress?.address || currentUser.ponto_encontro_default?.address || 'Rua Fradique Coutinho, 1200 - Pinheiros, São Paulo - SP'
  );
  const [resLat, setResLat] = useState<number>(
    currentUser.residentialAddress?.lat || -23.5539
  );
  const [resLng, setResLng] = useState<number>(
    currentUser.residentialAddress?.lng || -46.6896
  );

  const [useResAsMeeting, setUseResAsMeeting] = useState<boolean>(
    currentUser.useResidentialAsMeetingPoint ?? false
  );
  const [customMeetingAddress, setCustomMeetingAddress] = useState(
    currentUser.ponto_encontro_default?.address || 'Metrô Butantã - Saída Av. Vital Brasil'
  );
  const [customMeetingLat, setCustomMeetingLat] = useState<number>(
    currentUser.ponto_encontro_default?.lat || -23.5719
  );
  const [customMeetingLng, setCustomMeetingLng] = useState<number>(
    currentUser.ponto_encontro_default?.lng || -46.7082
  );
  const [customMeetingName, setCustomMeetingName] = useState(
    currentUser.ponto_encontro_default?.name || 'Estação Butantã (Linha 4-Amarela)'
  );

  // Map Location Picker State
  const [mapPickerTarget, setMapPickerTarget] = useState<'residential' | 'meeting' | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  // Multiple Vehicles List state
  const initialVehicles = getUserVehicles(currentUser);
  const [hasVehicle, setHasVehicle] = useState(initialVehicles.length > 0);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>(
    initialVehicles.length > 0 
      ? initialVehicles 
      : [{ id: `veh-${Date.now()}`, model: '', plate: '', color: '', year: '2023', category: 'suv', availableSeats: 4, isPrimary: true }]
  );
  const [selectedPrimaryIndex, setSelectedPrimaryIndex] = useState<number>(
    Math.max(0, initialVehicles.findIndex(v => v.isPrimary))
  );

  // PIX & Financial
  const [pixKey, setPixKey] = useState(currentUser.pixKey || '');
  const [agency, setAgency] = useState(currentUser.agency || '0001');
  const [accountNumber, setAccountNumber] = useState(currentUser.accountNumber || '');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Account Deletion States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR') {
      setErrorMsg('Por favor, digite EXCLUIR para confirmar a exclusão definitiva.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      setErrorMsg(null);
      await deleteMyAccount(currentUser);
      setShowDeleteConfirm(false);
      onClose();
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (err: any) {
      console.error('Erro ao excluir conta:', err);
      setErrorMsg(err?.message || 'Falha ao excluir a conta. Tente novamente.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleQuickGPS = async (target: 'residential' | 'meeting') => {
    setIsLocatingGPS(true);
    setErrorMsg(null);
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
      setErrorMsg(err?.message || 'Não foi possível capturar o sinal GPS.');
    } finally {
      setIsLocatingGPS(false);
    }
  };

  const handleAddVehicle = () => {
    const newVeh: Vehicle = {
      id: `veh-${Date.now()}`,
      model: '',
      plate: '',
      color: '',
      year: '2024',
      category: 'suv',
      availableSeats: 4,
      isPrimary: vehiclesList.length === 0,
    };
    setVehiclesList([...vehiclesList, newVeh]);
  };

  const handleUpdateVehicle = (index: number, field: keyof Vehicle, value: any) => {
    const updated = [...vehiclesList];
    updated[index] = { ...updated[index], [field]: value };
    setVehiclesList(updated);
  };

  const handleRemoveVehicle = (index: number) => {
    const filtered = vehiclesList.filter((_, i) => i !== index);
    setVehiclesList(filtered);
    if (selectedPrimaryIndex >= filtered.length) {
      setSelectedPrimaryIndex(Math.max(0, filtered.length - 1));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

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

      const validVehicles = hasVehicle 
        ? vehiclesList
            .filter((v) => v.model.trim().length > 0)
            .map((v, idx) => ({
              ...v,
              model: v.model.trim(),
              plate: (v.plate || '').trim().toUpperCase() || 'BRA2026',
              color: (v.color || '').trim() || 'Prata',
              isPrimary: idx === selectedPrimaryIndex,
            }))
        : [];

      const primaryVehicle = validVehicles.find((v) => v.isPrimary) || validVehicles[0];

      const updatedUser: User = {
        ...currentUser,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        rolePreference: 'both',
        residentialAddress: residentialLocation,
        useResidentialAsMeetingPoint: useResAsMeeting,
        ponto_encontro_default: defaultMeetingPoint,
        pixKey: pixKey.trim(),
        agency: agency.trim(),
        accountNumber: accountNumber.trim(),
        vehicle: primaryVehicle,
        vehicles: validVehicles,
      };

      // Write directly to Cloud Firestore
      await updateFirestoreUserProfile(currentUser.id, updatedUser);
      onUserUpdated(updatedUser);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error saving user profile to Firestore:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">Meu Perfil do Usuário</h3>
              <p className="text-xs text-slate-500">Dados pessoais, endereço residencial e preferências de embarque</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 text-xs">
          {/* Dados Pessoais */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <UserIcon className="w-3.5 h-3.5" />
              1. Identificação Pessoal
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Completo:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">E-mail Principal:</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-indigo-600" />
                Telefone / WhatsApp (para contato nas caronas):
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: (11) 98765-4321"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Endereço Residencial e Ponto de Encontro */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Home className="w-4 h-4 text-indigo-600" />
                2. Endereço Residencial & Ponto de Encontro
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <label className="block text-slate-700 font-semibold">Endereço Residencial:</label>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleQuickGPS('residential')}
                    disabled={isLocatingGPS}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 rounded-md transition cursor-pointer border border-emerald-200"
                    title="Preencher com GPS atual"
                  >
                    {isLocatingGPS ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                    <span>GPS Atual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPickerTarget('residential')}
                    className="text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-0.5 px-2 py-0.5 bg-white hover:bg-indigo-50 rounded-md transition cursor-pointer border border-indigo-200"
                    title="Selecionar localização no mapa"
                  >
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    <span>Apontar no Mapa</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={resAddress}
                  onChange={(e) => setResAddress(e.target.value)}
                  placeholder="Ex: Rua Fradique Coutinho, 1200 - Pinheiros, São Paulo - SP"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 pr-10 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => setMapPickerTarget('residential')}
                  className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition"
                  title="Apontar no Mapa"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Checkbox: Usar residencial como ponto de encontro */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useResAsMeeting}
                  onChange={(e) => setUseResAsMeeting(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-900 text-xs">
                    Incluir meu endereço residencial como ponto de encontro padrão
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Se marcado, as caronas utilizarão sua casa como ponto inicial de embarque.
                  </p>
                </div>
              </label>
            </div>

            {/* Ponto de encontro alternativo caso o usuário não queira divulgar o residencial */}
            {!useResAsMeeting && (
              <div className="space-y-2 pt-1 border-t border-slate-200/60">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-semibold text-[11px] text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Ponto de Encontro / Embarque Público Preferencial:
                  </span>
                  <div className="flex items-center space-x-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleQuickGPS('meeting')}
                      disabled={isLocatingGPS}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 rounded-md transition cursor-pointer border border-emerald-200"
                    >
                      {isLocatingGPS ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                      <span>GPS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapPickerTarget('meeting')}
                      className="text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-0.5 px-2 py-0.5 bg-white hover:bg-indigo-50 rounded-md transition cursor-pointer border border-indigo-200"
                    >
                      <MapPin className="w-3 h-3 text-indigo-600" />
                      <span>Mapa</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-600 text-[10px] mb-1">Nome do Ponto:</label>
                    <input
                      type="text"
                      value={customMeetingName}
                      onChange={(e) => setCustomMeetingName(e.target.value)}
                      placeholder="Ex: Metrô Butantã - Saída Vital Brasil"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-[10px] mb-1">Endereço de Embarque:</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customMeetingAddress}
                        onChange={(e) => setCustomMeetingAddress(e.target.value)}
                        placeholder="Ex: Av. Vital Brasil, 500"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 pr-8 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setMapPickerTarget('meeting')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-indigo-600"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dados do Veículo / Garagem com Múltiplos Veículos */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-indigo-600" />
                3. Meus Veículos (Garagem / Para Oferecer Caronas)
              </span>
              <label className="flex items-center space-x-2 text-xs font-semibold text-indigo-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasVehicle}
                  onChange={(e) => setHasVehicle(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Tenho veículo(s)</span>
              </label>
            </div>

            {hasVehicle && (
              <div className="space-y-3 pt-1">
                <p className="text-[11px] text-slate-500">
                  Cadastre um ou mais veículos para alternar facilmente ao publicar ofertas de carona.
                </p>

                <div className="space-y-3">
                  {vehiclesList.map((v, idx) => (
                    <div key={v.id || idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                          <input
                            type="radio"
                            name="primaryVehicleProfile"
                            checked={selectedPrimaryIndex === idx}
                            onChange={() => setSelectedPrimaryIndex(idx)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Veículo #{idx + 1} {selectedPrimaryIndex === idx && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono font-normal">(Principal / Padrão)</span>}</span>
                        </label>
                        {vehiclesList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVehicle(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                            title="Remover veículo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-slate-600 text-[10px] mb-1 font-semibold">Modelo:</label>
                          <input
                            type="text"
                            value={v.model}
                            onChange={(e) => handleUpdateVehicle(idx, 'model', e.target.value)}
                            placeholder="Ex: T-Cross 1.0 TSI"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 text-[10px] mb-1 font-semibold">Placa (Mercosul):</label>
                          <input
                            type="text"
                            value={v.plate}
                            onChange={(e) => handleUpdateVehicle(idx, 'plate', e.target.value.toUpperCase())}
                            placeholder="Ex: BRA2E19"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono uppercase text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 text-[10px] mb-1 font-semibold">Cor:</label>
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) => handleUpdateVehicle(idx, 'color', e.target.value)}
                            placeholder="Ex: Cinza Platinum"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddVehicle}
                  className="w-full py-2 px-3 text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Outro Veículo</span>
                </button>
              </div>
            )}
          </div>

          {/* Dados Financeiros / PIX */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              4. Dados Financeiros para Rateio Solidário
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Chave PIX (para rateio de combustível):</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: seu-email@dominio.com, CPF ou telefone"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Conta Corrente / Agência:</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Ex: 48291-0"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Zona de Perigo / Exclusão de Conta */}
          <div className="pt-4 border-t border-rose-100 bg-rose-50/40 -mx-6 px-6 pb-2 rounded-b-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Zona de Perigo & Privacidade
                </h5>
                <p className="text-[11px] text-rose-600/90 mt-0.5">
                  Exclui definitivamente seu perfil, veículos, rotinas cadastradas e histórico do Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmationText('');
                  setShowDeleteConfirm(true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Conta</span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm flex items-center space-x-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {successMsg ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Salvo no Firestore!</span>
                </>
              ) : (
                <span>{saving ? 'Gravando no Firestore...' : 'Salvar Alterações'}</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal for Account Deletion */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Excluir Conta Permanentemente?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta ação é <strong>irreversível</strong>. Todos os seus dados, preferências de carona, rotinas fixas, veículos e chave PIX cadastrada no Firestore serão apagados imediatamente.
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Para confirmar a exclusão, digite <span className="text-rose-600 font-mono font-black">EXCLUIR</span> no campo abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-center font-bold text-slate-900 uppercase focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 font-semibold text-center">{errorMsg}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setErrorMsg(null);
                }}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR' || isDeletingAccount}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeletingAccount ? (
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

      {/* Interactive Map Location Picker */}
      <LocationPickerModal
        isOpen={mapPickerTarget !== null}
        onClose={() => setMapPickerTarget(null)}
        title={
          mapPickerTarget === 'residential'
            ? 'Apontar Endereço Residencial no Mapa'
            : 'Apontar Ponto de Encontro / Embarque no Mapa'
        }
        initialAddress={
          mapPickerTarget === 'residential' ? resAddress : customMeetingAddress
        }
        initialLat={
          mapPickerTarget === 'residential' ? resLat : customMeetingLat
        }
        initialLng={
          mapPickerTarget === 'residential' ? resLng : customMeetingLng
        }
        onSelectLocation={(selected) => {
          if (mapPickerTarget === 'residential') {
            setResAddress(selected.address);
            setResLat(selected.lat);
            setResLng(selected.lng);
          } else {
            setCustomMeetingAddress(selected.address);
            setCustomMeetingLat(selected.lat);
            setCustomMeetingLng(selected.lng);
            if (!customMeetingName || customMeetingName === 'Ponto de Encontro Preferencial') {
              setCustomMeetingName(selected.name || 'Ponto de Embarque');
            }
          }
        }}
      />
    </div>
  );
};
