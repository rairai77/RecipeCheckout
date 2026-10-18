export type UserLocation = { lat: number; lng: number; label: string } | { zip: string; label: string };

export const SEATTLE_PRESET: UserLocation = { lat: 47.6205, lng: -122.3212, label: 'Seattle (Capitol Hill)' };

export function isZipLocation(loc: UserLocation): loc is { zip: string; label: string } {
  return 'zip' in loc;
}

/** Stable key so we can tell whether cached stores belong to the current location. */
export function locationKey(loc: UserLocation): string {
  return isZipLocation(loc) ? `zip:${loc.zip}` : `ll:${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
}

/** Strip the label: the shape fetchStores wants. */
export function toStoresQuery(loc: UserLocation): { lat: number; lng: number } | { zip: string } {
  return isZipLocation(loc) ? { zip: loc.zip } : { lat: loc.lat, lng: loc.lng };
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

export class LocationError extends Error {
  constructor(message: string, public reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout') {
    super(message);
  }
}

/** Browser geolocation with friendly errors. Rejects with LocationError. */
export function getBrowserLocation(timeoutMs = 10000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      reject(new LocationError("This browser can't share your location.", 'unsupported'));
      return;
    }
    // Some browsers never call back when the OS has location services off; guard with our own timer.
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new LocationError('Finding your location took too long.', 'timeout'));
    }, timeoutMs + 1500);
    geo.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err.code === 1) reject(new LocationError('Location permission was denied.', 'denied'));
        else if (err.code === 3) reject(new LocationError('Finding your location took too long.', 'timeout'));
        else reject(new LocationError("Your location isn't available (is Location Services on?).", 'unavailable'));
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    );
  });
}
