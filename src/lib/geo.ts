export interface GeocodedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  city?: string;
}

export const SP_PRESETS: GeocodedPlace[] = [
  {
    name: 'Metrô Butantã (Linha 4-Amarela)',
    address: 'Av. Vital Brasil, Butantã, São Paulo - SP',
    lat: -23.5719,
    lng: -46.7083,
    neighborhood: 'Butantã',
    city: 'São Paulo',
  },
  {
    name: 'USP - Portão 1 / Praça do Relógio',
    address: 'Av. Prof. Lineu Prestes, Butantã, São Paulo - SP',
    lat: -23.5592,
    lng: -46.7314,
    neighborhood: 'Cidade Universitária',
    city: 'São Paulo',
  },
  {
    name: 'Estação Pinheiros (Metrô / CPTM)',
    address: 'Rua Gilberto Sabino, Pinheiros, São Paulo - SP',
    lat: -23.5663,
    lng: -46.7032,
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
  },
  {
    name: 'Av. Paulista / MASP',
    address: 'Av. Paulista, 1578, Bela Vista, São Paulo - SP',
    lat: -23.5614,
    lng: -46.6559,
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
  },
  {
    name: 'Shopping Eldorado',
    address: 'Av. Rebouças, 3970, Pinheiros, São Paulo - SP',
    lat: -23.5732,
    lng: -46.6967,
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
  },
  {
    name: 'Faria Lima / Berrini',
    address: 'Av. Brigadeiro Faria Lima, 2232, Itaim Bibi, São Paulo - SP',
    lat: -23.5868,
    lng: -46.6823,
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
  },
  {
    name: 'Terminal Barra Funda',
    address: 'Rua Mário de Andrade, Barra Funda, São Paulo - SP',
    lat: -23.5258,
    lng: -46.6669,
    neighborhood: 'Barra Funda',
    city: 'São Paulo',
  },
];

/**
 * Gets the current real-time GPS coordinates of the user device
 */
export async function getCurrentGPSPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let msg = 'Erro ao obter localização GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permissão de GPS negada pelo usuário.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Sinal de GPS indisponível.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tempo limite esgotado ao buscar GPS.';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Reverse geocode a latitude/longitude pair into a human-readable address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
        const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
        const suburb = addr.suburb || addr.neighbourhood || addr.city_district || '';
        const city = addr.city || addr.town || addr.municipality || 'São Paulo';
        const state = addr.state_code || addr.state || 'SP';

        if (road) {
          return `${road}${houseNumber}${suburb ? ` - ${suburb}` : ''}, ${city} - ${state}`;
        }
        return data.display_name.split(',').slice(0, 4).join(', ');
      }
    }
  } catch (err) {
    console.warn('Reverse geocode fallback:', err);
  }

  // Fallback to coordinates format
  return `Localização (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

/**
 * Search places and addresses matching a query
 */
export async function searchAddressGeocode(query: string): Promise<GeocodedPlace[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const encoded = encodeURIComponent(query.trim());
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=6&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const addr = item.address || {};
          const road = addr.road || addr.street || item.name || '';
          const suburb = addr.suburb || addr.neighbourhood || '';
          const city = addr.city || addr.town || addr.municipality || 'São Paulo';
          const state = addr.state || 'SP';

          const formatted = road
            ? `${road}${suburb ? ` - ${suburb}` : ''}, ${city}`
            : item.display_name.split(',').slice(0, 3).join(',');

          return {
            name: item.name || road || formatted.split(',')[0],
            address: formatted,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            neighborhood: suburb,
            city,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Geocoding search failed:', err);
  }

  // Fallback to client-side filtering presets
  return SP_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.address.toLowerCase().includes(query.toLowerCase())
  );
}

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  
  return Math.round(d * 10) / 10; // 1 decimal place (ex: 2.4 km)
}
