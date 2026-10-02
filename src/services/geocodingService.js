// US-based geocoding service using multiple fallback options
// Starting with a simpler approach to avoid CORS issues

import { validateAddress, sanitizeGeocodeResult } from '../utils/sanitize';

// Predefined locations for common US cities and states
const PREDEFINED_LOCATIONS = {
  // Major US cities
  'phoenix, az': { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  'phoenix': { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  'phoenix arizona': { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  'tucson, az': { lat: 32.2217, lng: -110.9265, name: 'Tucson, AZ' },
  'tolleson, az': { lat: 33.4539, lng: -112.2593, name: 'Tolleson, AZ' },
  'tolleson': { lat: 33.4539, lng: -112.2593, name: 'Tolleson, AZ' },
  'los angeles, ca': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
  'san francisco, ca': { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA' },
  'new york, ny': { lat: 40.7128, lng: -74.0060, name: 'New York, NY' },
  'chicago, il': { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
  'houston, tx': { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' },
  'dallas, tx': { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },
  'miami, fl': { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
  'seattle, wa': { lat: 47.6062, lng: -122.3321, name: 'Seattle, WA' },
  'denver, co': { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
  'atlanta, ga': { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
  'las vegas, nv': { lat: 36.1699, lng: -115.1398, name: 'Las Vegas, NV' },
  
  // States (using capital cities)
  'arizona': { lat: 33.4484, lng: -112.0740, name: 'Arizona' },
  'california': { lat: 38.5767, lng: -121.4934, name: 'California' },
  'texas': { lat: 30.2672, lng: -97.7431, name: 'Texas' },
  'florida': { lat: 30.4518, lng: -84.27277, name: 'Florida' },
  'new york': { lat: 42.9538, lng: -75.5268, name: 'New York' },
  'illinois': { lat: 39.7817, lng: -89.6501, name: 'Illinois' },
  'washington': { lat: 47.0379, lng: -120.8407, name: 'Washington' },
  'colorado': { lat: 39.0598, lng: -105.3111, name: 'Colorado' },
  'georgia': { lat: 33.0406, lng: -83.6431, name: 'Georgia' },
  'nevada': { lat: 38.3135, lng: -117.0554, name: 'Nevada' }
};

// Base URL for Nominatim geocoding service (fallback)
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// Rate limiting: Track requests to avoid overwhelming the service
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// Helper function to add delay between requests
const rateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
};

const COORDINATE_PATTERN = /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;

export const formatCoordinates = (latitude, longitude) =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

// Turn coordinates into a display address. Falls back to the coordinates themselves,
// which geocodeAddress accepts, so the result can always be searched again.
export const reverseGeocode = async (latitude, longitude) => {
  await rateLimit();

  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'json',
      addressdetails: '1',
      'accept-language': 'en'
    });
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
      // Don't hold up the initial search if Nominatim is slow
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined
    });
    if (!response.ok) {
      throw new Error(`Reverse geocoding returned ${response.status}`);
    }
    const result = await response.json();
    const address = formatDisplayAddress(sanitizeGeocodeResult({
      latitude,
      longitude,
      displayName: '',
      address: {
        house_number: result.address?.house_number || '',
        road: result.address?.road || '',
        city: result.address?.city || result.address?.town || result.address?.village || '',
        state: result.address?.state || '',
        postcode: result.address?.postcode || ''
      }
    }));
    if (!address) {
      throw new Error('No address found at these coordinates');
    }
    // validateAddress throws on characters it rejects, so the result can be searched again
    return validateAddress(address);
  } catch (error) {
    console.warn('Reverse geocoding failed, using coordinates:', error);
    return formatCoordinates(latitude, longitude);
  }
};

// Geocode an address within the United States
export const geocodeAddress = async (address) => {
  // Validate and sanitize input to prevent XSS
  let validatedAddress;
  try {
    validatedAddress = validateAddress(address);
  } catch (error) {
    throw new Error(`Invalid address: ${error.message}`);
  }

  // Accept raw "lat, lng" coordinates (also the fallback text for the user's location)
  const coordinateMatch = validatedAddress.match(COORDINATE_PATTERN);
  if (coordinateMatch) {
    const latitude = parseFloat(coordinateMatch[1]);
    const longitude = parseFloat(coordinateMatch[2]);
    return sanitizeGeocodeResult({
      latitude,
      longitude,
      displayName: formatCoordinates(latitude, longitude),
      address: {},
      confidence: 1.0
    });
  }

  // Next, try to match against predefined locations
  const normalizedAddress = validatedAddress.toLowerCase().trim();
  let predefinedMatch = PREDEFINED_LOCATIONS[normalizedAddress];
  
  // If no exact match, try partial matching
  if (!predefinedMatch) {
    // First try exact city matches by extracting city names from full addresses
    const addressParts = normalizedAddress.split(',').map(part => part.trim());
    for (const part of addressParts) {
      if (PREDEFINED_LOCATIONS[part]) {
        predefinedMatch = PREDEFINED_LOCATIONS[part];
        break;
      }
    }
    
    // If still no match, try broader partial matching
    if (!predefinedMatch) {
      for (const [key, location] of Object.entries(PREDEFINED_LOCATIONS)) {
        if (normalizedAddress.includes(key) || key.includes(normalizedAddress)) {
          predefinedMatch = location;
          break;
        }
      }
    }
  }
  
  if (predefinedMatch) {
    console.log('Found predefined location match:', predefinedMatch);
    const result = {
      latitude: predefinedMatch.lat,
      longitude: predefinedMatch.lng,
      displayName: predefinedMatch.name,
      address: {
        city: predefinedMatch.name.split(',')[0] || '',
        state: predefinedMatch.name.split(',')[1]?.trim() || '',
        country: 'United States'
      },
      confidence: 1.0
    };
    return sanitizeGeocodeResult(result);
  }

  // If no predefined match, try the external geocoding service
  // Apply rate limiting
  await rateLimit();

  try {
    // Build query parameters
    const params = new URLSearchParams({
      q: validatedAddress,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'us', // Restrict to United States
      'accept-language': 'en'
    });

    const url = `${NOMINATIM_BASE_URL}?${params}`;
    console.log('Geocoding URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FAA-Crane-Viewer/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding service returned ${response.status}: ${response.statusText}`);
    }

    const results = await response.json();
    console.log('Geocoding results:', results);

    if (!results || results.length === 0) {
      const suggestions = Object.keys(PREDEFINED_LOCATIONS).slice(0, 5).join(', ');
      throw new Error(`No results found for "${address}". Try one of these: ${suggestions}`);
    }

    // Filter results to ensure they're in the US and have good accuracy
    const usResults = results.filter(result => {
      const address = result.address || {};
      return address.country_code === 'us' && 
             result.importance > 0.3 && // Basic quality filter
             result.lat && result.lon;
    });

    if (usResults.length === 0) {
      const suggestions = Object.keys(PREDEFINED_LOCATIONS).slice(0, 5).join(', ');
      throw new Error(`No valid US addresses found for "${address}". Try one of these: ${suggestions}`);
    }

    // Return the best result (sanitized to prevent XSS)
    const bestResult = usResults[0];

    const result = {
      latitude: parseFloat(bestResult.lat),
      longitude: parseFloat(bestResult.lon),
      displayName: bestResult.display_name,
      address: {
        house_number: bestResult.address?.house_number || '',
        road: bestResult.address?.road || '',
        city: bestResult.address?.city || bestResult.address?.town || bestResult.address?.village || '',
        state: bestResult.address?.state || '',
        postcode: bestResult.address?.postcode || '',
        country: bestResult.address?.country || 'United States'
      },
      boundingBox: bestResult.boundingbox ? {
        south: parseFloat(bestResult.boundingbox[0]),
        north: parseFloat(bestResult.boundingbox[1]),
        west: parseFloat(bestResult.boundingbox[2]),
        east: parseFloat(bestResult.boundingbox[3])
      } : null,
      confidence: bestResult.importance || 0
    };

    return sanitizeGeocodeResult(result);

  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to geocoding service. Please check your internet connection.');
    }
    
    // Re-throw our custom errors
    if (error.message.includes('No results found') || 
        error.message.includes('No valid US addresses') ||
        error.message.includes('Geocoding service returned')) {
      throw error;
    }
    
    // Generic error for unexpected issues with helpful suggestions
    const suggestions = Object.keys(PREDEFINED_LOCATIONS).slice(0, 5).join(', ');
    throw new Error(`Failed to geocode address. Please try one of these locations: ${suggestions}`);
  }
};

// Photon (https://photon.komoot.io) allows search-as-you-type, which Nominatim's
// usage policy forbids. It's free and needs no API key; keep requests debounced.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const CONTINENTAL_US_BBOX = '-124.848974,24.396308,-66.934570,49.384472';
const SUGGESTION_LAYERS = ['house', 'street', 'locality', 'district', 'city'];
export const MIN_SUGGESTION_QUERY_LENGTH = 3;

const formatSuggestionLabel = ({ name, housenumber, street, city, state, postcode }) => {
  const parts = [];
  if (housenumber && street) {
    parts.push(`${housenumber} ${street}`);
  } else if (street) {
    parts.push(street);
  }
  // name is the place itself (a city, or a named building); skip it when it repeats the city
  if (name && name !== city && !parts.length) {
    parts.push(name);
  }
  if (city) {
    parts.push(city);
  }
  if (state) {
    parts.push(postcode ? `${state} ${postcode}` : state);
  }
  return parts.join(', ');
};

// Address suggestions for a partial query, as [{ label, lat, lng }]. Labels are
// limited to characters validateAddress accepts so they can be searched again
// (accents are dropped). Pass an AbortSignal to cancel a stale request.
export const fetchAddressSuggestions = async (query, signal) => {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SUGGESTION_QUERY_LENGTH) {
    return [];
  }
  const params = new URLSearchParams({ q: trimmed, limit: '5', lang: 'en', bbox: CONTINENTAL_US_BBOX });
  SUGGESTION_LAYERS.forEach(layer => params.append('layer', layer));
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Address suggestions returned ${response.status}`);
  }
  const result = await response.json();
  const seen = new Set();
  return (result.features || []).flatMap(feature => {
    const properties = feature.properties || {};
    const [lng, lat] = feature.geometry?.coordinates || [];
    if (properties.countrycode !== 'US' || !isWithinContinentalUS(lat, lng)) {
      return [];
    }
    const label = formatSuggestionLabel(properties)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    try {
      validateAddress(label);
    } catch (error) {
      return [];
    }
    if (seen.has(label.toLowerCase())) {
      return [];
    }
    seen.add(label.toLowerCase());
    return [{ label, lat, lng }];
  });
};

// Helper function to format an address for display
export const formatDisplayAddress = (geocodeResult) => {
  if (!geocodeResult || !geocodeResult.address) {
    return geocodeResult?.displayName || 'Unknown location';
  }

  const addr = geocodeResult.address;
  const parts = [];

  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  }

  if (addr.city) {
    parts.push(addr.city);
  }

  if (addr.state) {
    parts.push(addr.state);
  }

  if (addr.postcode) {
    parts.push(addr.postcode);
  }

  return parts.length > 0 ? parts.join(', ') : geocodeResult.displayName;
};

// Validate if coordinates are within the continental United States
export const isWithinContinentalUS = (latitude, longitude) => {
  // Approximate bounding box for continental US (corrected bounds)
  const bounds = {
    north: 49.384472,   // Northern border (near Bellingham, WA)
    south: 24.396308,   // Key West, Florida
    east: -66.934570,   // Easternmost point (Maine)
    west: -124.848974   // Westernmost point (Washington coast)
  };

  return latitude >= bounds.south && 
         latitude <= bounds.north && 
         longitude >= bounds.west && 
         longitude <= bounds.east;
};