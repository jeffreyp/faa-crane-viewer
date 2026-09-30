// Recent address searches, kept in localStorage (most recent first).
// Every operation fails soft: if storage is unavailable (private browsing,
// blocked site data, quota errors), reads return [] and writes are no-ops.

const STORAGE_KEY = 'faa-crane-viewer:recent-searches';
export const MAX_RECENT_SEARCHES = 10;

export const loadRecentSearches = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed)
      ? parsed.filter(item => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES)
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

// Moves the address to the front, dropping any case-insensitive duplicate.
export const addRecentSearch = (address) => {
  const trimmed = address.trim();
  if (!trimmed) {
    return loadRecentSearches();
  }
  const others = loadRecentSearches().filter(item => item.toLowerCase() !== trimmed.toLowerCase());
  return saveRecentSearches([trimmed, ...others].slice(0, MAX_RECENT_SEARCHES));
};

export const removeRecentSearch = (address) =>
  saveRecentSearches(loadRecentSearches().filter(item => item !== address));

// An entry matches when it contains every word the user has typed, in any order.
export const filterRecentSearches = (searches, query) => {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return searches.filter(item => {
    const lower = item.toLowerCase();
    return words.every(word => lower.includes(word));
  });
};
