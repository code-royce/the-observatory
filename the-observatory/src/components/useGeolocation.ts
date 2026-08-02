import { useState, useEffect } from 'react';

// Hook's return state
interface GeolocationState {
  loaded: boolean;
  coordinates: {
    lat: number | string;
    lng: number | string;
  };
  locationError: {
    code: number;
    message: string;
  } | null;
}

// The mount request is tight on purpose; a retry the user asked for is worth
// waiting longer on, since a cold GPS fix rarely lands in five seconds.
const MOUNT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0,
};

const RETRY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const UNSUPPORTED = {
  code: 0,
  message: "Geolocation is not supported by your browser. Please enter your location instead",
};

/**
 * Tracks the visitor's coordinates.
 *
 * Asks once on mount, and exposes `requestLocation` so a denied or timed-out
 * prompt can be retried without reloading the page. Coordinates are also
 * settable by hand, because plenty of people would rather type them than hand
 * over their location.
 *
 * Returns:
 *     The current coordinates and error, plus `requestLocation` to ask again,
 *     `setCoordinates` to edit them, and `locating` while a request is open.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<GeolocationState>({
    loaded: false,
    coordinates: { lat: "", lng: "" },
    locationError: null,
  });
  const [locating, setLocating] = useState(false);

  const onSuccess = (position: GeolocationPosition) => {
    setLocating(false);
    setLocation({
      loaded: true,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      locationError: null,
    });
  };

  const onError = (
    error: GeolocationPositionError | { code: number; message: string }
  ) => {
    setLocating(false);
    setLocation((prev) => ({
      loaded: true,
      // A failed retry shouldn't wipe coordinates that already worked.
      coordinates: prev.coordinates,
      locationError: {
        code: error.code,
        message: error.message,
      },
    }));
  };

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      onError(UNSUPPORTED);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(onSuccess, onError, RETRY_OPTIONS);
  };

  // Lets a visitor type coordinates instead of sharing their location. Merges
  // so setting one box doesn't blank the other.
  const setCoordinates = (
    next: { lat?: number | string; lng?: number | string }
  ) => {
    setLocation((prev) => ({
      ...prev,
      coordinates: { ...prev.coordinates, ...next },
      locationError: null,
    }));
  };

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      onError(UNSUPPORTED);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(onSuccess, onError, MOUNT_OPTIONS);
  }, []);

  return { ...location, locating, requestLocation, setCoordinates };
}

/**
 * Turns a geolocation failure into something worth showing a user.
 *
 * A denied prompt is the common case and the only one with a fix the user can
 * act on, so it gets its own sentence pointing at the address bar.
 *
 * Args:
 *     error: The error the hook reported, if any.
 *
 * Returns:
 *     A message to display, or null when nothing went wrong.
 */
export function locationErrorMessage(
  error: { code: number; message: string } | null
): string | null {
  if (!error) return null;
  // GeolocationPositionError.PERMISSION_DENIED
  if (error.code === 1) {
    return 'Location is blocked for this site. Allow it from the icon at the '
      + 'left of the address bar, or type coordinates instead.';
  }
  return `Could not get your location: ${error.message}`;
}
