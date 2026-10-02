// Keeps the current search in the query string (?q=<address>&r=<radius>) so
// searches can be bookmarked and shared and the back button moves between them.
// Each history entry also stores the geocoded location, so going back doesn't
// geocode again.

const MIN_RADIUS = 1;
const MAX_RADIUS = 100;
const MAX_ADDRESS_LENGTH = 200;

// Returns { address, radius } from the current URL, or null if there's no
// address. radius is null when it's missing or out of range.
export const readSearchFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const address = (params.get('q') || '').trim().slice(0, MAX_ADDRESS_LENGTH);
  if (!address) {
    return null;
  }
  const radius = Number(params.get('r'));
  const validRadius = Number.isFinite(radius) && radius >= MIN_RADIUS && radius <= MAX_RADIUS;
  return { address, radius: validRadius ? radius : null };
};

// Writes the search to the URL and history. Pass address = null for a search with
// no address (the default location or the user's position), which clears q and r.
// mode is 'push' for a new search or 'replace' to update the current entry.
export const writeSearchToUrl = ({ address, radius, location }, mode = 'push') => {
  const url = new URL(window.location.href);
  url.searchParams.delete('q');
  url.searchParams.delete('r');
  if (address) {
    url.searchParams.set('q', address);
    url.searchParams.set('r', String(radius));
  }
  const state = { address, radius, location };
  // Running the same search again shouldn't add a history entry
  const sameUrl = url.href === window.location.href;
  try {
    if (mode === 'replace' || sameUrl) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }
  } catch (error) {
    console.warn('Could not update the URL:', error);
  }
};
