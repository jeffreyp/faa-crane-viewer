import React, { useState } from 'react';
import styled from 'styled-components';

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 300px;
  margin-right: 1rem;
  
  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 0.5rem;
    min-width: auto;
  }
`;

const RadiusContainer = styled.div`
  display: flex;
  align-items: center;
  margin-right: 1rem;
  
  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
`;

const RadiusLabel = styled.label`
  margin-right: 0.5rem;
  white-space: nowrap;
  color: white;
`;

const RadiusInput = styled.input`
  width: 60px;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: #45a049;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const FilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);

  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
`;

const FilterLabel = styled.label`
  display: flex;
  align-items: center;
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  user-select: none;

  input {
    margin-right: 0.4rem;
    cursor: pointer;
  }
`;

const FilterTitle = styled.span`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin-right: 0.5rem;
`;

const SearchBar = ({ defaultAddress, defaultRadius, onSearch, loading, dataSourceFilters, onFilterChange }) => {
  const [address, setAddress] = useState(defaultAddress);
  const [radius, setRadius] = useState(defaultRadius);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(address, Number(radius));
  };

  const handleFilterToggle = (source) => {
    if (onFilterChange) {
      onFilterChange(source);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <SearchContainer>
        <Input
          type="text"
          placeholder="Enter address (e.g. 10601 W Van Buren St, Tolleson, AZ 85353 or City, State)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <RadiusContainer>
          <RadiusLabel>Radius (NM):</RadiusLabel>
          <RadiusInput
            type="number"
            min="1"
            max="100"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            required
          />
        </RadiusContainer>
        <Button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </SearchContainer>
      {dataSourceFilters && (
        <FilterContainer>
          <FilterTitle>Data Sources:</FilterTitle>
          <FilterLabel>
            <input
              type="checkbox"
              checked={dataSourceFilters.dof}
              onChange={() => handleFilterToggle('dof')}
            />
            DOF
          </FilterLabel>
          <FilterLabel>
            <input
              type="checkbox"
              checked={dataSourceFilters.part77}
              onChange={() => handleFilterToggle('part77')}
            />
            Part 77
          </FilterLabel>
          <FilterLabel>
            <input
              type="checkbox"
              checked={dataSourceFilters.notam}
              onChange={() => handleFilterToggle('notam')}
            />
            NOTAM
          </FilterLabel>
        </FilterContainer>
      )}
    </form>
  );
};

export default SearchBar;