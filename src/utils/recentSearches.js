// Recent address searches, kept in localStorage (most recent first). Each entry
// is { address, radius, location }: radius is null for entries saved before radii
// were stored, and location (the geocoded { lat, lng, address }) is null for
// entries saved before locations were stored.
// Every operation fails soft: if storage is unavailable (private browsing,
// blocked site data, quota errors), reads return [] and writes are no-ops.

const STORAGE_KEY = 'faa-crane-viewer:recent-searches';
export const MAX_RECENT_SEARCHES = 10;

const isValidRadius = (radius) => Number.isFinite(radius) && radius >= 1 && radius <= 100;

const isValidLocation = (location) =>
  location != null &&
  Number.isFinite(location.lat) &&
  Number.isFinite(location.lng) &&
  typeof location.address === 'string';

// Older versions stored plain address strings
const normalizeEntry = (item) => {
  if (typeof item === 'string') {
    return { address: item, radius: null, location: null };
  }
  if (item && typeof item.address === 'string') {
    return {
      address: item.address,
      radius: isValidRadius(item.radius) ? item.radius : null,
      location: isValidLocation(item.location)
        ? { lat: item.location.lat, lng: item.location.lng, address: item.location.address }
        : null
    };
  }
  return null;
};

export const loadRecentSearches = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed)
      ? parsed.map(normalizeEntry).filter(Boolean).slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch (error) {
    return [];
  }
};

const saveRecentSearches = (searches) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch (error) {
    console.warn('Could not save recent searches:', error);
  }
  return searches;
};

// Moves the search to the front, dropping any entry with the same address
// (case-insensitive).
export const addRecentSearch = (address, radius, location = null) => {
  const trimmed = address.trim();
  if (!trimmed) {
    return loadRecentSearches();
  }
  const entry = normalizeEntry({ address: trimmed, radius, location });
  const others = loadRecentSearches().filter(item => item.address.toLowerCase() !== trimmed.toLowerCase());
  return saveRecentSearches([entry, ...others].slice(0, MAX_RECENT_SEARCHES));
};

export const removeRecentSearch = (address) =>
  saveRecentSearches(loadRecentSearches().filter(item => item.address !== address));

// An entry matches when its address contains every word the user has typed, in any order.
export const filterRecentSearches = (searches, query) => {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return searches.filter(item => {
    const lower = item.address.toLowerCase();
    return words.every(word => lower.includes(word));
  });
};
