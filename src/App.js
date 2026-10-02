import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import MapView from './components/MapView';
import TableView from './components/TableView';
import SearchBar from './components/SearchBar';
import { fetchCraneData } from './services/faaService';
import { NOTAM_DISCLAIMER } from './config';
import { geocodeAddress, formatDisplayAddress, isWithinContinentalUS, reverseGeocode } from './services/geocodingService';
import { getGeolocationPermission, getCurrentPosition } from './utils/geolocation';
import { loadRecentSearches, addRecentSearch, removeRecentSearch } from './utils/recentSearches';
import { readSearchFromUrl, writeSearchToUrl } from './utils/searchUrl';

const DEFAULT_LOCATION = {
  lat: 33.448037, // Southeast corner of S 107th Ave and W Van Buren St
  lng: -112.285957,
  address: "10601 W Van Buren St, Tolleson, AZ 85353"
};

const DEFAULT_RADIUS = 10; // nautical miles

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
`;

const Header = styled.header`
  background-color: #003366;
  color: white;
  padding: 1rem;
  display: flex;
  flex-direction: column;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
`;

const NotamNotice = styled.div`
  background-color: #FFF3E0;
  color: #5D4037;
  font-size: 0.85rem;
  text-align: center;
  padding: 0.4rem 1rem;
  border-bottom: 1px solid #FFE0B2;
`;

const ViewsContainer = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const App = () => {
  const [cranes, setCranes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCraneId, setSelectedCraneId] = useState(null);
  // A search in the URL (?q=&r=) takes priority over geolocation and the default location
  const [urlSearch] = useState(readSearchFromUrl);
  // Without a URL search or the user's location, start at the most recent search
  // (one saved with its location, so it needs no geocoding) before the default location
  const [lastSearch] = useState(() => loadRecentSearches().find(item => item.location) ?? null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [radius, setRadius] = useState(
    urlSearch ? (urlSearch.radius ?? DEFAULT_RADIUS) : (lastSearch?.radius ?? DEFAULT_RADIUS)
  );
  const [dataSourceFilters, setDataSourceFilters] = useState({
    dof: true,
    part77: true,
    notam: true
  });

  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  // Set to { address, radius } to fill in the search box (after geolocation or Back/Forward)
  const [filledSearch, setFilledSearch] = useState(null);
  // Once the user runs a search, a slow geolocation result must not replace it
  const userSearchedRef = useRef(false);

  const searchDefaultLocation = (radius) => {
    setLocation(DEFAULT_LOCATION);
    writeSearchToUrl({ address: null, radius, location: DEFAULT_LOCATION }, 'replace');
    return searchCranes(DEFAULT_LOCATION, radius);
  };

  const searchStartLocation = (radius) => {
    if (!lastSearch) {
      return searchDefaultLocation(radius);
    }
    setLocation(lastSearch.location);
    // Like the default location, keep it out of the URL so a reload still tries geolocation
    writeSearchToUrl({ address: null, radius, location: lastSearch.location }, 'replace');
    return searchCranes(lastSearch.location, radius);
  };

  // Start at the search in the URL if there is one. Otherwise start at the user's
  // location if they allow it, or at the most recent search or the default location.
  useEffect(() => {
    const init = async () => {
      if (urlSearch) {
        handleSearch(urlSearch.address, radius, { fromUrl: true });
        return;
      }
      const permission = await getGeolocationPermission();
      if (permission === 'denied') {
        searchStartLocation(radius);
        return;
      }
      // Show the start location while the browser asks for permission
      if (permission !== 'granted') {
        searchStartLocation(radius);
      }
      const found = await locateUser(false);
      if (!found && permission === 'granted') {
        searchStartLocation(radius);
      }
    };
    init();
  }, []);

  // Back/Forward: rerun the search for that history entry
  useEffect(() => {
    const handlePopState = (event) => {
      userSearchedRef.current = true;
      const state = event.state;
      if (state && state.location) {
        setLocation(state.location);
        setRadius(state.radius);
        setFilledSearch({ address: state.address || state.location.address, radius: state.radius });
        searchCranes(state.location, state.radius);
        return;
      }
      // An entry we didn't create (for example, a hand-edited URL)
      const fromUrl = readSearchFromUrl();
      if (fromUrl) {
        const newRadius = fromUrl.radius ?? DEFAULT_RADIUS;
        setFilledSearch({ address: fromUrl.address, radius: newRadius });
        handleSearch(fromUrl.address, newRadius, { fromUrl: true });
      } else {
        setRadius(DEFAULT_RADIUS);
        setFilledSearch({ address: DEFAULT_LOCATION.address, radius: DEFAULT_RADIUS });
        searchDefaultLocation(DEFAULT_RADIUS);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Search around the user's position. Returns true if a search ran. Errors are
  // shown only when the user asked for their location (not on page load).
  const locateUser = async (userInitiated) => {
    if (userInitiated) {
      userSearchedRef.current = true;
      setLoading(true);
      setError(null);
    }
    try {
      const position = await getCurrentPosition();
      if (!isWithinContinentalUS(position.lat, position.lng)) {
        throw new Error('Your location is outside the continental United States.');
      }
      const address = await reverseGeocode(position.lat, position.lng);
      if (!userInitiated && userSearchedRef.current) {
        return false;
      }
      const newLocation = { ...position, address };
      setLocation(newLocation);
      setFilledSearch({ address });
      // Keep the user's position out of the URL; the history entry still remembers it
      writeSearchToUrl({ address: null, radius, location: newLocation }, userInitiated ? 'push' : 'replace');
      await searchCranes(newLocation, radius);
      return true;
    } catch (err) {
      console.warn('Geolocation failed:', err);
      if (userInitiated) {
        setError(err.message);
        setLoading(false);
      }
      return false;
    }
  };

  const searchCranes = async (location, radius) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchCraneData(location, radius);
      setCranes(result.data);
      
      // Display warning if mock data was used
      if (result.usedMockData) {
        setError(`Warning: Using mock data. Could not load CSV: ${result.error}`);
      } else if (result.staleDataAsOf) {
        setError(`Warning: Couldn't reach the server. Showing cached crane data from ${result.staleDataAsOf.toLocaleString()}.`);
      }
    } catch (err) {
      setError(`Failed to fetch crane data: ${err.message || 'Unknown error'}`);
      console.error('Error fetching data:', err);
      // Fall back to empty data array rather than crashing
      setCranes([]);
    } finally {
      setLoading(false);
    }
  };

  // fromUrl: the search came from the URL (page load or a hand-edited URL), so
  // update the current history entry and leave recent searches alone.
  // coordinates: { lat, lng } for an address that's already geocoded (a picked suggestion).
  const handleSearch = async (address, radius, { fromUrl = false, coordinates = null } = {}) => {
    console.log('Search initiated:', { address, radius });
    userSearchedRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Geocode the address unless it came with coordinates
      const geocodeResult = coordinates
        ? { latitude: coordinates.lat, longitude: coordinates.lng, displayName: address.trim() }
        : await geocodeAddress(address);
      console.log('Geocode result:', geocodeResult);

      // Validate the result is within the continental US
      if (!isWithinContinentalUS(geocodeResult.latitude, geocodeResult.longitude)) {
        throw new Error('Address must be within the continental United States.');
      }

      // Update location with geocoded coordinates
      const newLocation = {
        lat: geocodeResult.latitude,
        lng: geocodeResult.longitude,
        address: formatDisplayAddress(geocodeResult)
      };

      setLocation(newLocation);
      setRadius(radius);
      writeSearchToUrl({ address: address.trim(), radius, location: newLocation }, fromUrl ? 'replace' : 'push');
      if (!fromUrl) {
        setRecentSearches(addRecentSearch(address, radius, newLocation));
      }

      // Search for cranes at the new location
      await searchCranes(newLocation, radius);

    } catch (err) {
      setError(`Geocoding failed: ${err.message}`);
      console.error('Geocoding error:', err);
      setLoading(false);
    }
  };

  const handleFilterToggle = (source) => {
    setDataSourceFilters(prev => ({
      ...prev,
      [source]: !prev[source]
    }));
  };

  // Filter cranes based on data source selections
  const filteredCranes = cranes.filter(crane => {
    const dataSource = crane.dataSource || '';

    // Check if it's a NOTAM
    if (dataSource === 'NOTAM') {
      return dataSourceFilters.notam;
    }

    // Check if it's Part77 (includes region codes like Part77-ASO, Part77-AGL, etc.)
    if (dataSource.startsWith('Part77')) {
      return dataSourceFilters.part77;
    }

    // Check if it's DOF
    if (dataSource === 'DOF') {
      return dataSourceFilters.dof;
    }

    // Default: show if no data source specified (backward compatibility)
    return true;
  });

  return (
    <AppContainer>
      <Header>
        <Title>FAA Construction Crane Viewer</Title>
        <SearchBar
          defaultAddress={urlSearch?.address ?? lastSearch?.address ?? DEFAULT_LOCATION.address}
          defaultRadius={radius}
          filledSearch={filledSearch}
          recentSearches={recentSearches}
          onRemoveRecentSearch={(address) => setRecentSearches(removeRecentSearch(address))}
          onSearch={handleSearch}
          onLocate={() => locateUser(true)}
          loading={loading}
          dataSourceFilters={dataSourceFilters}
          onFilterChange={handleFilterToggle}
        />
      </Header>
      <NotamNotice role="note">{NOTAM_DISCLAIMER}</NotamNotice>
      {error && <div style={{
        color: error.startsWith('Warning:') ? 'orange' : 'red',
        backgroundColor: error.startsWith('Warning:') ? '#FFF8E1' : '#FFEBEE',
        padding: '0.5rem',
        margin: '0',
        borderBottom: '1px solid #DDD'
      }}>{error}</div>}
      <ViewsContainer>
        <MapView location={location} radius={radius} cranes={filteredCranes} selectedCraneId={selectedCraneId} onCraneSelect={setSelectedCraneId} />
        <TableView cranes={filteredCranes} loading={loading} selectedCraneId={selectedCraneId} onCraneSelect={setSelectedCraneId} />
      </ViewsContainer>
    </AppContainer>
  );
};

export default App;