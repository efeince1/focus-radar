const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const PLACE_TYPES = {
  library: { query: 'library', matches: ['library'] },
  cafe: { query: 'cafe', matches: ['cafe'] },
  coworking: { query: 'coworking space', matches: ['coworking_space', 'coworking'] },
};

export class ApiError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (res.status === 429) throw new ApiError('Too many requests. Please wait a few seconds and try again.');
    if (!res.ok) throw new ApiError(`Server error (${res.status}).`);
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') throw new ApiError('The request timed out. Please try again.', { cause: err });
    throw new ApiError('Network error. Check your connection.', { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

// Şehir adı -> koordinat
export async function geocodeCity(query) {
  const q = query?.trim();
  if (!q) throw new ApiError('Please enter a city or neighborhood.');

  const params = new URLSearchParams({ q, format: 'json', limit: '1', 'accept-language': 'en' });
  const results = await request(`${NOMINATIM_URL}?${params}`);

  const [first] = results;
  if (!first) throw new ApiError(`Could not find "${q}". Try another name.`);

  return {
    name: first.display_name.split(',').slice(0, 2).join(',').trim(),
    lat: Number(first.lat),
    lon: Number(first.lon),
  };
}

// İki koordinat arası mesafe (km) - Haversine
export function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Merkez + yarıçap (metre) -> arama kutusu
function boundingBox({ lat, lon }, radius) {
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  return { left: lon - dLon, top: lat + dLat, right: lon + dLon, bottom: lat - dLat };
}

// Tek bir tür için arama, sonucu temiz nesnelere çevir
async function searchType(kind, origin, radius) {
  const { query, matches } = PLACE_TYPES[kind];
  const { left, top, right, bottom } = boundingBox(origin, radius);

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '40',
    bounded: '1',
    viewbox: [left, top, right, bottom].join(','),
    addressdetails: '1',
    extratags: '1',
    'accept-language': 'en',
  });

  const results = await request(`${NOMINATIM_URL}?${params}`);

  return results
    .filter(({ type }) => matches.includes(type))
    .map(({ osm_type, osm_id, lat, lon, name, display_name, address, extratags }) => {
  const addr = address ?? {};
  const tags = extratags ?? {};
  const placeLat = Number(lat);
      const placeLon = Number(lon);
      const street = [addr.road, addr.house_number].filter(Boolean).join(' ');

      return {
        id: `${osm_type}/${osm_id}`,
        name: name || display_name.split(',')[0],
        type: kind,
        lat: placeLat,
        lon: placeLon,
        address: street || addr.suburb || addr.neighbourhood || null,
        hours: tags.opening_hours ?? null,
        website: tags.website ?? tags['contact:website'] ?? null,
        distanceKm: distanceKm(origin.lat, origin.lon, placeLat, placeLon),
        osmUrl: `https://www.openstreetmap.org/${osm_type}/${osm_id}`,
      };
    });
}

// Koordinat çevresindeki mekanlar (kütüphane, kafe, coworking)
export async function fetchWorkspaces(origin, radius = 2000) {
  const all = [];
  for (const kind of Object.keys(PLACE_TYPES)) {
    await sleep(1100); // Nominatim kuralı: saniyede en fazla 1 istek
    all.push(...(await searchType(kind, origin, radius)));
  }
  // Aynı mekan iki aramada gelebilir, id'ye göre tekilleştir
  return [...new Map(all.map((place) => [place.id, place])).values()];
}