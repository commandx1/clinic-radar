import { GEOHASH_PRECISION } from "@/lib/constants";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

// Standart geohash encode algoritması (bkz. docs/02-business-rules.md Bölüm C,
// docs/03-database.md region_category_cache.geo_cell). businesses.geo_cell ile
// aynı fonksiyon kullanılır — SQL'de ayrı bir implementasyon yazılmaz (drift riski).
export function encodeGeohash(lat: number, lng: number, precision: number = GEOHASH_PRECISION): string {
  const latRange: [number, number] = [-90, 90];
  const lngRange: [number, number] = [-180, 180];
  let isEven = true;
  let bit = 0;
  let ch = 0;
  let geohash = "";

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        lngRange[0] = mid;
      } else {
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}
