import { useState, useEffect } from 'react';

// Hook's return state
interface GeolocationState {
  loaded: boolean;
  coordinates: {
    lat: number | string;
    lng: number | string;
  };
  error: {
    code: number;
    message: string;
  } | null;
}

export function useGeolocation() {
  const [location, setLocation] = useState<GeolocationState>({
    loaded: false,
    coordinates: { lat: "", lng: "" },
    error: null,
  });

  const onSuccess = (position: GeolocationPosition) => {
    setLocation({
      loaded: true,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      error: null,
    });
  };

  const onError = (error: GeolocationPositionError | { code: number; message: string }) => {
    setLocation({
      loaded: true,
      coordinates: { lat: "", lng: "" },
      error: {
        code: error.code,
        message: error.message,
      },
    });
  };

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      onError({
        code: 0,
        message: "Geolocation is not supported by your browser. Please enter your location instead",
      });
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  }, []);

  return location;
}
