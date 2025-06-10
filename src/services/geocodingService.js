// US-based geocoding service using multiple fallback options
// Starting with a simpler approach to avoid CORS issues

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

// Geocode an address within the United States
export const geocodeAddress = async (address) => {
  if (!address || address.trim().length === 0) {
    throw new Error('Address is required');
  }

  // First, try to match against predefined locations
  const normalizedAddress = address.toLowerCase().trim();
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
    return {
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
  }

  // If no predefined match, try the external geocoding service
  // Apply rate limiting
  await rateLimit();

  try {
    // Build query parameters
    const params = new URLSearchParams({
      q: address.trim(),
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

    // Return the best result
    const bestResult = usResults[0];
    
    return {
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