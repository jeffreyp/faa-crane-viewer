import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import MapView from './components/MapView';
import TableView from './components/TableView';
import SearchBar from './components/SearchBar';
import { fetchCraneData } from './services/faaService';

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
  const [location, setLocation] = useState({
    lat: 33.4456, // Tolleson, AZ default location
    lng: -112.2592,
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
      const data = await fetchCraneData(location, radius);
      setCranes(data);
    } catch (err) {
      setError(`Failed to fetch crane data: ${err.message || 'Unknown error'}`);
      console.error('Error fetching data:', err);
      // Fall back to empty data array rather than crashing
      setCranes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (address, radius) => {
    // In a real app, we would geocode the address here
    // For now, we'll keep using the same location but update the radius
    setRadius(radius);
    searchCranes(location, radius);
  };

  return (
    <AppContainer>
      <Header>
        <Title>FAA Construction Crane Viewer</Title>
        <SearchBar 
          defaultAddress={location.address} 
          defaultRadius={radius} 
          onSearch={handleSearch} 
          loading={loading}
        />
      </Header>
      {error && <div style={{ color: 'red', padding: '0.5rem' }}>{error}</div>}
      <ViewsContainer>
        <MapView location={location} radius={radius} cranes={cranes} />
        <TableView cranes={cranes} loading={loading} />
      </ViewsContainer>
    </AppContainer>
  );
};

export default App;