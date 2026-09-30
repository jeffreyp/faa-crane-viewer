// Browser geolocation helpers.

// 'granted', 'denied', 'prompt', or 'unknown' when the Permissions API isn't available
// (older Safari), in which case asking for the position may still show a prompt.
export const getGeolocationPermission = async () => {
  if (!navigator.geolocation) {
    return 'denied';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch (error) {
    return 'unknown';
  }
};

export const getCurrentPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Your browser does not support location lookup.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      lat: position.coords.latitude,
      lng: position.coords.longitude
    }),
    (error) => {
      const messages = {
        1: 'Location access was denied. Allow it in your browser settings to search near you.',
        2: 'Your location is unavailable right now.',
        3: 'Timed out finding your location.'
      };
      reject(new Error(messages[error.code] || 'Could not get your location.'));
    },
    // A position up to 10 minutes old is fine for a search center
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
  );
});
