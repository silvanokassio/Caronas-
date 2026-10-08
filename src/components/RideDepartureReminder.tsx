import React, { useEffect, useRef } from 'react';
import { Ride, User } from '../types';
import { getRideDateTime } from '../lib/dateUtils';

interface RideDepartureReminderProps {
  rides: Ride[];
  currentUser: User | null;
  onReminder: (title: string, body: string) => void;
}

const NOTIFIED_STORAGE_KEY = 'caronaflow_notified_15m_rides';

/**
 * Componente de monitoramento que verifica a cada 15 segundos se alguma carona agendada
 * da qual o usuário atual participa (como motorista ou passageiro aceito) está a ~15 minutos da partida.
 * Quando o gatilho é atingido, aciona:
 * 1) A notificação flutuante na tela (toast)
 * 2) A Web Notification API do navegador (HTML5 Web Notifications)
 */
export const RideDepartureReminder: React.FC<RideDepartureReminderProps> = ({
  rides,
  currentUser,
  onReminder,
}) => {
  // Guarda IDs já notificados em memória e no sessionStorage para não repetir
  const notifiedRidesRef = useRef<Set<string>>(new Set());

  // Inicializa o cache de notificações já disparadas nesta sessão
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(NOTIFIED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => notifiedRidesRef.current.add(id));
        }
      }
    } catch (_) {}
  }, []);

  const markRideAsNotified = (rideId: string) => {
    notifiedRidesRef.current.add(rideId);
    try {
      sessionStorage.setItem(
        NOTIFIED_STORAGE_KEY,
        JSON.stringify(Array.from(notifiedRidesRef.current))
      );
    } catch (_) {}
  };

  useEffect(() => {
    if (!currentUser || !rides || rides.length === 0) return;

    const checkUpcomingRides = () => {
      const nowMs = Date.now();

      // Filtrar caronas agendadas ou em andamento em que o usuário seja motorista ou passageiro
      const userRelevantRides = rides.filter((r) => {
        if (!r || r.status === 'cancelada' || r.status === 'concluida') return false;
        
        const isDriver = r.driverId === currentUser.id;
        const isAcceptedPassenger = Array.isArray(r.acceptedPassengers) && 
          r.acceptedPassengers.some((p) => p.userId === currentUser.id);

        return isDriver || isAcceptedPassenger;
      });

      for (const ride of userRelevantRides) {
        if (!ride.id || notifiedRidesRef.current.has(ride.id)) continue;

        const rideDate = getRideDateTime(ride.departureDate, ride.departureTime);
        if (!rideDate) continue;

        const departureMs = rideDate.getTime();
        const diffMinutes = (departureMs - nowMs) / (1000 * 60);

        // Dispara quando faltar entre 0 e 15 minutos para a partida (janela de alerta pré-embarque)
        // Margem de segurança: de 0.1 min até 15.5 minutos
        if (diffMinutes > 0 && diffMinutes <= 15.5) {
          const isDriver = ride.driverId === currentUser.id;
          const roundedMinutes = Math.max(1, Math.round(diffMinutes));

          const originName = ride.origin?.name || ride.origin?.address?.split(',')[0] || 'Origem';
          const destName = ride.destinationAlias || ride.destination?.alias || ride.destination?.name || ride.destination?.address?.split(',')[0] || 'Destino';

          const title = isDriver
            ? `⏰ Partida em ~${roundedMinutes} min: Sua Viagem`
            : `⏰ Atenção! Sua Carona sai em ~${roundedMinutes} min`;

          const body = isDriver
            ? `Sua carona para ${destName} está programada para sair às ${ride.departureTime}. Seus passageiros estão a postos!`
            : `Motorista ${ride.driverName} sairá às ${ride.departureTime} rumo a ${destName}. Dirija-se ao ponto de encontro!`;

          // Disparar Web Notification API do navegador
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: `ride-15min-${ride.id}`,
              });
            } catch (_) {}
          }

          // Disparar toast flutuante no App
          onReminder(title, body);

          // Marcar como notificado
          markRideAsNotified(ride.id);
        }
      }
    };

    // Executar verificação imediata
    checkUpcomingRides();

    // E a cada 20 segundos
    const interval = setInterval(checkUpcomingRides, 20000);

    return () => clearInterval(interval);
  }, [rides, currentUser, onReminder]);

  return null;
};
