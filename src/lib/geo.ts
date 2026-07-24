export type LatLng = { lat: number; lng: number };

/** المسجد النبوي الشريف — reference point for all distances. */
export const PROPHETS_MOSQUE: LatLng = { lat: 24.4672, lng: 39.6111 };

/** Madinah bounding box as [[west, south], [east, north]] for MapLibre maxBounds. */
export const MADINAH_BOUNDS: [[number, number], [number, number]] = [
  [39.42, 24.28],
  [39.78, 24.62],
];

export const MADINAH_CENTER: LatLng = PROPHETS_MOSQUE;

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** Distance from the Prophet's Mosque, rounded to one decimal. */
export function distanceFromHaramKm(point: LatLng): number {
  return Math.round(haversineKm(point, PROPHETS_MOSQUE) * 10) / 10;
}
