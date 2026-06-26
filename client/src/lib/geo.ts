/**
 * geo.ts — GolfCartIQ location utilities
 *
 * 1. Browser geolocation → lat/lng
 * 2. Nominatim reverse geocode → city, state, zip
 * 3. Nominatim ZIP forward lookup → lat/lng (covers all US zips, no API key)
 * 4. localStorage persistence for user location
 */

export interface UserLocation {
  city: string;
  state: string;       // 2-letter abbreviation, e.g. "FL"
  zip: string;
  lat: number;
  lng: number;
  source: "gps" | "manual"; // how it was obtained
}

const STORAGE_KEY = "gciq_user_location";

// ─── Persistence ────────────────────────────────────────────────────────────

export function getSavedLocation(): UserLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserLocation;
  } catch {
    return null;
  }
}

export function saveLocation(loc: UserLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // storage unavailable — ignore
  }
}

export function clearLocation(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ─── US State abbreviation map (for Nominatim state names) ──────────────────

const STATE_ABBR: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY",
};

function stateToAbbr(stateName: string): string {
  // Already an abbreviation
  if (stateName.length === 2) return stateName.toUpperCase();
  return STATE_ABBR[stateName.toLowerCase()] ?? stateName.slice(0, 2).toUpperCase();
}

// ─── Nominatim reverse geocode ───────────────────────────────────────────────

export async function reverseGeocode(lat: number, lng: number): Promise<UserLocation | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "GolfCartIQ/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address ?? {};

    const city =
      addr.city || addr.town || addr.village || addr.county || addr.suburb || "";
    const stateRaw = addr.state ?? "";
    const state = stateToAbbr(stateRaw);
    const zip = addr.postcode ?? "";

    if (!city || !state) return null;

    return { city, state, zip, lat, lng, source: "gps" };
  } catch {
    return null;
  }
}

// ─── Nominatim ZIP → lat/lng ─────────────────────────────────────────────────
// Returns null if zip is invalid or not found.
// Nominatim rate limit: 1 req/sec — fine for interactive use.

export async function zipToCoords(zip: string): Promise<{ lat: number; lng: number; city: string; state: string } | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&addressdetails=1&limit=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "GolfCartIQ/1.0" },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!results?.length) return null;

    const r = results[0];
    const addr = r.address ?? {};
    const city = addr.city || addr.town || addr.village || addr.county || "";
    const state = stateToAbbr(addr.state ?? "");
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);

    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng, city, state };
  } catch {
    return null;
  }
}

// ─── Browser geolocation ─────────────────────────────────────────────────────

export async function requestBrowserLocation(): Promise<UserLocation | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const loc = await reverseGeocode(lat, lng);
        if (loc) {
          saveLocation(loc);
          resolve(loc);
        } else {
          resolve(null);
        }
      },
      () => resolve(null),  // denied or error
      { timeout: 8000, maximumAge: 300_000 }
    );
  });
}
