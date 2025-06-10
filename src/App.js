import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import MapView from './components/MapView';
import TableView from './components/TableView';
import SearchBar from './components/SearchBar';
import { fetchCraneData } from './services/faaService';
import { geocodeAddress, formatDisplayAddress, isWithinContinentalUS } from './services/geocodingService';

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
  const [location, setLocation] = useState({
    lat: 33.448037, // Southeast corner of S 107th Ave and W Van Buren St
    lng: -112.285957,
    address: "10601 W Van Buren St, Tolleson, AZ 85353"
  });
  const [radius, setRadius] = useState(10); // 10 nautical miles

  useEffect(() => {
    searchCranes(location, radius);
  }, []);

  const searchCranes = async (location, radius) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchCraneData(location, radius);
      setCranes(result.data);
      
      // Display warning if mock data was used
      if (result.usedMockData) {
        setError(`Warning: Using mock data. Could not load CSV: ${result.error}`);
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

  const handleSearch = async (address, radius) => {
    console.log('Search initiated:', { address, radius });
    setLoading(true);
    setError(null);
    
    try {
      // Geocode the address
      console.log('Geocoding address:', address);
      const geocodeResult = await geocodeAddress(address);
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
      
      // Search for cranes at the new location
      await searchCranes(newLocation, radius);
      
    } catch (err) {
      setError(`Geocoding failed: ${err.message}`);
      console.error('Geocoding error:', err);
      setLoading(false);
    }
  };

  return (
    <AppContainer>
      <Header>
        <Title>FAA Construction Crane Viewer</Title>
        <SearchBar 
          defaultAddress="10601 W Van Buren St, Tolleson, AZ 85353"
          defaultRadius={radius} 
          onSearch={handleSearch} 
          loading={loading}
        />
      </Header>
      {error && <div style={{ 
        color: error.startsWith('Warning:') ? 'orange' : 'red', 
        backgroundColor: error.startsWith('Warning:') ? '#FFF8E1' : '#FFEBEE',
        padding: '0.5rem',
        margin: '0',
        borderBottom: '1px solid #DDD'
      }}>{error}</div>}
      <ViewsContainer>
        <MapView location={location} radius={radius} cranes={cranes} selectedCraneId={selectedCraneId} onCraneSelect={setSelectedCraneId} />
        <TableView cranes={cranes} loading={loading} selectedCraneId={selectedCraneId} onCraneSelect={setSelectedCraneId} />
      </ViewsContainer>
    </AppContainer>
  );
};

export default App;