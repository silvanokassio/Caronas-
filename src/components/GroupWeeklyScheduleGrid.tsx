import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Car, 
  UserCheck, 
  Plus, 
  Check, 
  Clock, 
  DollarSign, 
  Sparkles, 
  AlertCircle, 
  ShieldCheck, 
  X, 
  Lock,
  Users,
  UserX
} from 'lucide-react';
import { Group, Ride, User, isSuperUser, isUserMemberOfGroup, PassengerParticipant } from '../types';
import { canJoinRide, canLeaveRide } from '../lib/dateUtils';
import { RemovePassengerModal } from './RemovePassengerModal';

interface GroupWeeklyScheduleGridProps {
  group: Group;
  currentUser: User | null;
  allUsers: User[];
  rides: Ride[];
  onQuickCreateRide: (dayDateStr: string, group: Group) => void;
  onQuickBookSeat: (rideId: string) => void;
  onQuickCancelSeat: (rideId: string, userId: string) => void;
  onRemovePassenger?: (rideId: string, passengerUserId: string, justification: string) => Promise<void> | void;
  onCancelRide?: (rideId: string, reason?: string) => void;
  onNavigateToRideEdit?: (ride: Ride) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const GroupWeeklyScheduleGrid: React.FC<GroupWeeklyScheduleGridProps> = ({
  group,
  currentUser,
  allUsers,
  rides,
  onQuickCreateRide,
  onQuickBookSeat,
  onQuickCancelSeat,
  onRemovePassenger,
  onCancelRide,
  onNavigateToRideEdit,
  onOpenAuth,
}) => {
  // Offset in weeks from today: 0 = current week, 1 = next week, etc.
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // State for passenger removal modal
  const [passengerToRemove, setPassengerToRemove] = useState<{
    ride: Ride;
    passenger: PassengerParticipant;
  } | null>(null);

  const isMember = useMemo(() => {
    return isUserMemberOfGroup(group, currentUser, allUsers);
  }, [currentUser, group, allUsers]);

  const isDriverEligible = useMemo(() => {
    if (!currentUser) return false;
    // User can drive if role is not strictly passenger
    return currentUser.rolePreference !== 'passenger';
  }, [currentUser]);

  // Calculate Monday-Friday dates for the current active week
  // A partir de sábado (6) ou domingo (0), a exibição inicial padrão (weekOffset = 0) passa a ser a próxima semana útil
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    
    // Se hoje é sábado (6) ou domingo (0), avançar a base para a próxima segunda-feira
    const distanceToMonday =
      currentDayOfWeek === 6 ? 2 : currentDayOfWeek === 0 ? 1 : 1 - currentDayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + weekOffset * 7);

    const days = [
      { key: 'Seg', name: 'Segunda', offsetDays: 0 },
      { key: 'Ter', name: 'Terça', offsetDays: 1 },
      { key: 'Qua', name: 'Quarta', offsetDays: 2 },
      { key: 'Qui', name: 'Quinta', offsetDays: 3 },
      { key: 'Sex', name: 'Sexta', offsetDays: 4 },
    ];

    const todayDate = new Date();
    const todayY = todayDate.getFullYear();
    const todayM = String(todayDate.getMonth() + 1).padStart(2, '0');
    const todayD = String(todayDate.getDate()).padStart(2, '0');
    const todayStr = `${todayY}-${todayM}-${todayD}`;

    return days.map((d) => {
      const dateObj = new Date(monday);
      dateObj.setDate(monday.getDate() + d.offsetDays);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const formattedDate = `${day}/${month}/${year}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;

      return {
        ...d,
        dateStr,
        formattedDate,
        dateObj,
        isPast,
        isToday,
      };
    });
  }, [weekOffset]);

  // Find rides tied to this group for each day of the week
  const groupRidesByDate = useMemo(() => {
    const map: Record<string, Ride> = {};
    rides.forEach((r) => {
      if (r.targetGroupId === group.id && r.status !== 'cancelada' && r.departureDate) {
        // match exact date string YYYY-MM-DD
        map[r.departureDate] = r;
      }
    });
    return map;
  }, [rides, group.id]);

  // Max seats to show in the passenger rows (standard 4 passenger slots)
  const maxPassengerSlots = 4;

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4 overflow-hidden">
      {/* Header with Title and Week Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
              <span>Grade Semanal do Grupo</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                1-Clique
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              Crie viagens instantâneas ou reserve sua vaga com apenas 1 clique
            </p>
          </div>
        </div>

        {/* Week navigation controls */}
        <div className="flex items-center space-x-1.5 self-start sm:self-auto bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            title="Semana Anterior"
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
            {weekOffset === 0 ? 'Semana Atual' : weekOffset === 1 ? 'Próxima Semana' : `Semana (${weekOffset > 0 ? `+${weekOffset}` : weekOffset})`}
          </span>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            title="Próxima Semana"
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notice if user is not a member */}
      {!isMember && (
        <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center space-x-2.5 text-xs text-amber-800">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Visualização de Grupo:</strong> Apenas membros aprovados podem reservar vagas ou criar viagens na grade semanal.
          </span>
        </div>
      )}

      {/* Responsive Weekly Grid Table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="min-w-full border-collapse bg-white rounded-xl overflow-hidden shadow-2xs border border-slate-200">
            {/* Table Header: Weekdays & Dates */}
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200">
                <th className="py-3 px-3.5 text-left font-bold text-slate-700 text-xs w-36 bg-slate-100 sticky left-0 z-10">
                  Função / Assento
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.dateStr}
                    className={`py-3 px-3 text-center text-xs font-bold transition ${
                      day.isToday ? 'bg-indigo-50/80 text-indigo-900' : 'text-slate-800'
                    }`}
                  >
                    <div className="capitalize">{day.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 font-normal mt-0.5">
                      {day.formattedDate}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body: Driver Row + Passenger Rows */}
            <tbody className="divide-y divide-slate-100 text-xs">
              {/* Row 1: Motorista */}
              <tr className="bg-slate-50/40 hover:bg-slate-50/80 transition">
                <td className="py-3 px-3.5 font-bold text-slate-900 bg-slate-50/80 sticky left-0 z-10 flex items-center space-x-1.5">
                  <Car className="w-4 h-4 text-indigo-600" />
                  <span>Motorista</span>
                </td>
                {weekDays.map((day) => {
                  const ride = groupRidesByDate[day.dateStr];
                  const isUserDriver = currentUser && ride?.driverId === currentUser.id;

                  return (
                    <td
                      key={`driver-${day.dateStr}`}
                      className={`py-3 px-2 text-center align-middle border-l border-slate-100 ${
                        day.isToday ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      {ride ? (
                        <div className="flex flex-col items-center space-y-1">
                          <div className={`flex items-center space-x-1.5 border rounded-xl px-2.5 py-1.5 shadow-2xs max-w-full truncate ${
                            ride.status === 'concluida' 
                              ? 'bg-slate-100 border-slate-300 text-slate-600' 
                              : 'bg-indigo-50 border-indigo-200/80 text-indigo-950'
                          }`}>
                            <span className="font-bold truncate max-w-[100px] sm:max-w-[120px]">
                              {ride.driverName}
                            </span>
                            {isUserDriver && (
                              <span className="text-[9px] bg-indigo-600 text-white font-bold px-1 rounded">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                            <span className="flex items-center space-x-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{ride.departureTime}</span>
                            </span>
                            <span className="font-semibold text-emerald-700">
                              R$ {ride.price.toFixed(2)}
                            </span>
                          </div>
                          {ride.status === 'concluida' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">
                              Viagem Concluída
                            </span>
                          )}
                          {isUserDriver && !day.isPast && canLeaveRide(ride) && (
                            <div className="flex items-center space-x-2 pt-0.5 text-[10px]">
                              {onNavigateToRideEdit && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToRideEdit(ride)}
                                  className="text-indigo-600 hover:text-indigo-800 font-semibold underline hover:bg-indigo-50 px-1.5 py-0.5 rounded transition cursor-pointer"
                                  title="Acessar e editar detalhes desta viagem"
                                >
                                  Editar Viagem
                                </button>
                              )}
                              {onCancelRide && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const passengerCount = (ride.acceptedPassengers || []).length;
                                    const confirmMsg = passengerCount > 0
                                      ? `Tem certeza que deseja cancelar esta carona do grupo? ${passengerCount} passageiro(s) confirmados receberão notificação push e e-mail imediatamente.`
                                      : 'Tem certeza que deseja cancelar esta carona do grupo?';
                                    if (confirm(confirmMsg)) {
                                      const reason = passengerCount > 0 ? (prompt('Motivo do cancelamento (opcional, será enviado por push e e-mail aos passageiros):') || '') : '';
                                      onCancelRide(ride.id, reason.trim() || undefined);
                                    }
                                  }}
                                  className="text-rose-600 hover:text-rose-700 underline px-1 py-0.5 hover:bg-rose-50 rounded transition cursor-pointer"
                                  title="Cancelar viagem e avisar passageiros"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          {day.isPast ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1.5 bg-slate-100 text-slate-400 font-semibold text-xs rounded-xl border border-slate-200 cursor-not-allowed whitespace-nowrap flex items-center space-x-1 opacity-70"
                              title="Data no passado. Não é permitido criar novas viagens retroativas."
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Criar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentUser) {
                                  onOpenAuth?.('login');
                                } else {
                                  onQuickCreateRide(day.dateStr, group);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1 transition active:scale-95 cursor-pointer whitespace-nowrap"
                              title={`Criar viagem para ${day.name} (${day.formattedDate}) em 1 clique`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Criar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Rows 2 to 5: Passageiro 1, Passageiro 2, Passageiro 3, Passageiro 4 */}
              {Array.from({ length: maxPassengerSlots }).map((_, slotIdx) => {
                const passengerNum = slotIdx + 1;

                return (
                  <tr key={`passenger-row-${passengerNum}`} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3.5 font-medium text-slate-700 bg-white sticky left-0 z-10 flex items-center space-x-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Passageiro {passengerNum}</span>
                    </td>
                    {weekDays.map((day) => {
                      const ride = groupRidesByDate[day.dateStr];
                      const passenger = ride?.acceptedPassengers?.[slotIdx];
                      const isCurrentUserPassenger = currentUser && passenger?.userId === currentUser.id;
                      const isCurrentUserDriver = currentUser && ride?.driverId === currentUser.id;
                      const userAlreadyBooked = currentUser && ride?.acceptedPassengers?.some((p) => p.userId === currentUser.id);
                      const isPastOrConcluded = day.isPast || (ride ? !canJoinRide(ride) : false);
                      const isSeatAvailable = !!ride && slotIdx < ride.totalSeats && !passenger && !isPastOrConcluded;

                      return (
                        <td
                          key={`pass-${passengerNum}-${day.dateStr}`}
                          className={`py-2.5 px-2 text-center align-middle border-l border-slate-100 transition ${
                            day.isToday ? 'bg-indigo-50/10' : ''
                          } ${
                            isSeatAvailable && currentUser && !isCurrentUserDriver && !userAlreadyBooked
                              ? 'hover:bg-indigo-50/40 cursor-pointer'
                              : ''
                          }`}
                          onClick={() => {
                            if (isSeatAvailable && currentUser && !isCurrentUserDriver && !userAlreadyBooked) {
                              onQuickBookSeat(ride.id);
                            }
                          }}
                        >
                          {!ride ? (
                            /* Se NÃO houver motorista/viagem criada no dia: não exibe botão, apenas traço */
                            <span className="text-slate-300 text-xs select-none">—</span>
                          ) : passenger ? (
                            /* Se assento ocupado por passageiro */
                            <div className="flex items-center justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
                              <span className="font-semibold text-slate-800 bg-slate-100 border border-slate-200/80 px-2 py-1 rounded-lg text-xs truncate max-w-[110px]">
                                {passenger.userName}
                              </span>
                              {isCurrentUserPassenger && !day.isPast && canLeaveRide(ride) && (
                                <button
                                  type="button"
                                  onClick={() => onQuickCancelSeat(ride.id, passenger.userId)}
                                  title="Liberar minha vaga"
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {isCurrentUserDriver && !day.isPast && canLeaveRide(ride) && onRemovePassenger && (
                                <button
                                  type="button"
                                  onClick={() => setPassengerToRemove({ ride, passenger })}
                                  title={`Excluir passageiro(a) ${passenger.userName} da viagem com justificativa por push e e-mail`}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                                >
                                  <UserX className="w-3 h-3 text-rose-500" />
                                </button>
                              )}
                            </div>
                          ) : isSeatAvailable ? (
                            /* Se vaga livre na carona existente */
                            <div className="flex justify-center">
                              {currentUser && !isCurrentUserDriver && !userAlreadyBooked ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onQuickBookSeat(ride.id);
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 font-bold text-[11px] rounded-lg transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center space-x-1 shadow-2xs"
                                  title={`Reservar vaga na carona de ${ride.driverName} (${day.name} ${day.formattedDate}) em 1 clique`}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>+ Reservar</span>
                                </button>
                              ) : !currentUser ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenAuth?.('login');
                                  }}
                                  className="px-2 py-1 text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md font-semibold transition cursor-pointer"
                                >
                                  + Entrar
                                </button>
                              ) : isCurrentUserDriver ? (
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded">
                                  Vaga Livre
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Vaga Livre
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs select-none">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend & Help Footer */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span><strong>+ Criar:</strong> Gera a carona do dia com destino e preferências padrão</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span><strong>+ Reservar:</strong> Confirmação imediata para membros aprovados</span>
          </span>
        </div>
        <div className="text-slate-400">
          Destino Padrão: {group.defaultDestination?.name || group.defaultDestination?.address}
        </div>
      </div>

      {/* Modal de Exclusão de Passageiro da Vaga (com Justificativa por Push e E-mail) */}
      <RemovePassengerModal
        isOpen={Boolean(passengerToRemove)}
        onClose={() => setPassengerToRemove(null)}
        ride={passengerToRemove?.ride || null}
        passenger={passengerToRemove?.passenger || null}
        passengerUser={
          passengerToRemove?.passenger && allUsers
            ? allUsers.find((u) => u.id === passengerToRemove.passenger.userId)
            : null
        }
        onConfirmRemove={async (rideId, passengerUserId, justification) => {
          if (onRemovePassenger) {
            await onRemovePassenger(rideId, passengerUserId, justification);
          }
        }}
      />
    </div>
  );
};
