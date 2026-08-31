import { GeoLocation, Ride, PassengerParticipant } from '../types';
import { calculateDistanceKm } from './geo';

export interface RouteStop {
  id: string;
  order: number;
  type: 'origin' | 'passenger_pickup' | 'destination';
  title: string;
  subtitle: string;
  location: GeoLocation;
  passenger?: PassengerParticipant;
  isCompleted: boolean;
  distanceFromPreviousKm: number;
  estimatedMinutesFromPrevious: number;
  cumulativeDistanceKm: number;
  cumulativeMinutes: number;
  phone?: string;
}

export interface OptimizedRoutePlan {
  stops: RouteStop[];
  totalDistanceKm: number;
  totalEstimatedMinutes: number;
  passengerCount: number;
  googleMapsUrl: string;
  wazeNextStopUrl: string;
}

/**
 * Calculates the optimal ordering of passenger pickups between origin and destination
 * using an exact shortest path permutation (TSP with fixed start & end).
 */
export function calculateOptimizedRoute(ride: Ride, completedPassengerIds: string[] = []): OptimizedRoutePlan {
  const origin = ride.origin;
  const destination = ride.destination;
  const passengers = ride.acceptedPassengers || [];

  if (passengers.length === 0) {
    const dist = calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
    const drivingDist = Math.max(0.5, Number((dist * 1.25).toFixed(1)));
    const estMin = Math.max(5, Math.round((drivingDist / 32) * 60));

    const stops: RouteStop[] = [
      {
        id: 'origin',
        order: 1,
        type: 'origin',
        title: 'Ponto de Partida (Você)',
        subtitle: origin.address,
        location: origin,
        isCompleted: true,
        distanceFromPreviousKm: 0,
        estimatedMinutesFromPrevious: 0,
        cumulativeDistanceKm: 0,
        cumulativeMinutes: 0,
      },
      {
        id: 'destination',
        order: 2,
        type: 'destination',
        title: 'Destino Final',
        subtitle: destination.address,
        location: destination,
        isCompleted: false,
        distanceFromPreviousKm: drivingDist,
        estimatedMinutesFromPrevious: estMin,
        cumulativeDistanceKm: drivingDist,
        cumulativeMinutes: estMin,
      },
    ];

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    const wazeNextStopUrl = `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;

    return {
      stops,
      totalDistanceKm: drivingDist,
      totalEstimatedMinutes: estMin,
      passengerCount: 0,
      googleMapsUrl,
      wazeNextStopUrl,
    };
  }

  // Find best ordering of passengers for minimal detour
  const orderedPassengers = sortPassengersAlongPath(origin, destination, passengers);

  const allPoints: { loc: GeoLocation; type: 'origin' | 'passenger_pickup' | 'destination'; passenger?: PassengerParticipant; id: string; title: string }[] = [
    {
      loc: origin,
      type: 'origin',
      id: 'origin',
      title: 'Ponto de Partida (Motorista)',
    },
    ...orderedPassengers.map((p, idx) => ({
      loc: p.meetingPoint,
      type: 'passenger_pickup' as const,
      passenger: p,
      id: `p-${p.userId}`,
      title: `Embarque ${idx + 1}: ${p.userName}`,
    })),
    {
      loc: destination,
      type: 'destination',
      id: 'destination',
      title: 'Destino Final da Carona',
    },
  ];

  let cumulativeDist = 0;
  let cumulativeMin = 0;

  const stops: RouteStop[] = allPoints.map((pt, idx) => {
    let distFromPrev = 0;
    let minFromPrev = 0;

    if (idx > 0) {
      const prevLoc = allPoints[idx - 1].loc;
      const straight = calculateDistanceKm(prevLoc.lat, prevLoc.lng, pt.loc.lat, pt.loc.lng);
      distFromPrev = Math.max(0.3, Number((straight * 1.25).toFixed(1)));
      minFromPrev = Math.max(2, Math.round((distFromPrev / 28) * 60)); // ~28km/h average urban speed with boarding time
      cumulativeDist = Number((cumulativeDist + distFromPrev).toFixed(1));
      cumulativeMin += minFromPrev;
    }

    const isCompleted = pt.type === 'origin' || (pt.passenger ? completedPassengerIds.includes(pt.passenger.userId) : false);

    return {
      id: pt.id,
      order: idx + 1,
      type: pt.type,
      title: pt.title,
      subtitle: pt.loc.address || (pt.passenger ? `Ponto de Encontro de ${pt.passenger.userName}` : 'Local'),
      location: pt.loc,
      passenger: pt.passenger,
      isCompleted,
      distanceFromPreviousKm: distFromPrev,
      estimatedMinutesFromPrevious: minFromPrev,
      cumulativeDistanceKm: cumulativeDist,
      cumulativeMinutes: cumulativeMin,
    };
  });

  // Next incomplete stop
  const nextIncomplete = stops.find((s) => !s.isCompleted) || stops[stops.length - 1];

  // Waypoints for Google Maps
  const waypointsParam = orderedPassengers
    .map((p) => `${p.meetingPoint.lat},${p.meetingPoint.lng}`)
    .join('|');

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${
    waypointsParam ? `&waypoints=${encodeURIComponent(waypointsParam)}` : ''
  }&travelmode=driving`;

  const wazeNextStopUrl = `https://waze.com/ul?ll=${nextIncomplete.location.lat},${nextIncomplete.location.lng}&navigate=yes`;

  return {
    stops,
    totalDistanceKm: cumulativeDist,
    totalEstimatedMinutes: cumulativeMin,
    passengerCount: passengers.length,
    googleMapsUrl,
    wazeNextStopUrl,
  };
}

/**
 * Orders intermediate passengers to minimize total driving distance
 */
function sortPassengersAlongPath(origin: GeoLocation, destination: GeoLocation, passengers: PassengerParticipant[]): PassengerParticipant[] {
  if (passengers.length <= 1) return passengers;

  // Simple and fast permutation search for N <= 6
  const list = [...passengers];
  const permutations: PassengerParticipant[][] = [];

  function permute(arr: PassengerParticipant[], m: PassengerParticipant[] = []) {
    if (arr.length === 0) {
      permutations.push(m);
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  }

  permute(list);

  let bestRoute = list;
  let minDistance = Infinity;

  for (const perm of permutations) {
    let currentDist = 0;
    let prev = origin;

    for (const p of perm) {
      currentDist += calculateDistanceKm(prev.lat, prev.lng, p.meetingPoint.lat, p.meetingPoint.lng);
      prev = p.meetingPoint;
    }
    currentDist += calculateDistanceKm(prev.lat, prev.lng, destination.lat, destination.lng);

    if (currentDist < minDistance) {
      minDistance = currentDist;
      bestRoute = perm;
    }
  }

  return bestRoute;
}
