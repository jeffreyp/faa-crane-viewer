import React, { useState, useEffect } from 'react';
import { filterRecentSearches } from '../utils/recentSearches';
import { fetchAddressSuggestions, MIN_SUGGESTION_QUERY_LENGTH } from '../services/geocodingService';
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

const AddressField = styled.div`
  position: relative;
  flex: 1;
  min-width: 300px;
  margin-right: 1rem;

  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 0.5rem;
    min-width: auto;
  }
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 2.75rem 0.75rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
`;

const LocateButton = styled.button`
  position: absolute;
  top: 50%;
  right: 0.35rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: none;
  border: none;
  border-radius: 4px;
  color: #003366;
  cursor: pointer;

  &:hover {
    background-color: #e8eef5;
  }

  &:disabled {
    color: #aaa;
    cursor: not-allowed;
    background: none;
  }
`;

const RecentList = styled.ul`
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 2000; /* above Leaflet panes and controls */
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  max-height: 20rem;
  overflow-y: auto;
`;

const RecentHeading = styled.li`
  padding: 0.25rem 0.75rem;
  &:not(:first-child) {
    margin-top: 0.25rem;
    border-top: 1px solid #eee;
    padding-top: 0.5rem;
  }
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const RecentItem = styled.li`
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  color: #222;
  cursor: pointer;
  background-color: ${props => (props.$active ? '#e8eef5' : 'transparent')};

  &:hover {
    background-color: #e8eef5;
  }

  span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const RecentRadius = styled.small`
  margin-left: 0.5rem;
  color: #666;
  white-space: nowrap;
`;

const RemoveButton = styled.button`
  margin-left: 0.5rem;
  padding: 0 0.35rem;
  background: none;
  border: none;
  color: #888;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: #c62828;
  }
`;

const LocateIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
  </svg>
);

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

const SearchBar = ({
  defaultAddress,
  defaultRadius,
  filledSearch,
  recentSearches = [],
  onRemoveRecentSearch,
  onSearch,
  onLocate,
  loading,
  dataSourceFilters,
  onFilterChange
}) => {
  const [address, setAddress] = useState(defaultAddress);
  const [radius, setRadius] = useState(defaultRadius);
  const [showRecent, setShowRecent] = useState(false);
  // Show every recent search on focus; filter only once the user starts typing
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Geocoder suggestions for the typed text, as [{ label, lat, lng }]
  const [addressSuggestions, setAddressSuggestions] = useState([]);

  // Fill in the search when the app finds the user's location or goes Back/Forward
  useEffect(() => {
    if (filledSearch) {
      setAddress(filledSearch.address);
      if (filledSearch.radius != null) {
        setRadius(filledSearch.radius);
      }
    }
  }, [filledSearch]);

  // Fetch geocoder suggestions once the user pauses typing
  useEffect(() => {
    if (!showRecent || !filtering || address.trim().length < MIN_SUGGESTION_QUERY_LENGTH) {
      setAddressSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchAddressSuggestions(address, controller.signal)
        .then(setAddressSuggestions)
        .catch(error => {
          if (error.name !== 'AbortError') {
            console.warn('Address suggestions failed:', error);
          }
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, filtering, showRecent]);

  // Recent searches first, then geocoder suggestions that aren't already listed
  const recentMatches = filtering ? filterRecentSearches(recentSearches, address) : recentSearches;
  const recentAddresses = new Set(recentMatches.map(item => item.address.toLowerCase()));
  const options = [
    ...recentMatches.map(item => ({ recent: item, address: item.address })),
    ...(filtering ? addressSuggestions : [])
      .filter(suggestion => !recentAddresses.has(suggestion.label.toLowerCase()))
      .map(suggestion => ({ suggestion, address: suggestion.label }))
  ];
  const dropdownOpen = showRecent && options.length > 0;

  const closeDropdown = () => {
    setShowRecent(false);
    setActiveIndex(-1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    closeDropdown();
    onSearch(address, Number(radius));
  };

  // A recent search restores its radius; a suggestion is already geocoded
  const selectOption = ({ recent, suggestion, address: optionAddress }) => {
    setAddress(optionAddress);
    closeDropdown();
    if (recent) {
      const newRadius = recent.radius ?? radius;
      setRadius(newRadius);
      onSearch(optionAddress, Number(newRadius));
    } else {
      onSearch(optionAddress, Number(radius), { coordinates: { lat: suggestion.lat, lng: suggestion.lng } });
    }
  };

  const handleAddressChange = (e) => {
    setAddress(e.target.value);
    setFiltering(true);
    setShowRecent(true);
    setActiveIndex(-1);
  };

  const handleFocus = () => {
    setFiltering(false);
    setShowRecent(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!dropdownOpen) {
        setShowRecent(true);
        return;
      }
      e.preventDefault();
      // Cycle through the suggestions and back to the typed text (index -1)
      const next = activeIndex + (e.key === 'ArrowDown' ? 1 : -1);
      if (next >= options.length) {
        setActiveIndex(-1);
      } else if (next < -1) {
        setActiveIndex(options.length - 1);
      } else {
        setActiveIndex(next);
      }
    } else if (e.key === 'Enter' && dropdownOpen && activeIndex >= 0) {
      e.preventDefault();
      selectOption(options[activeIndex]);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  };

  const handleLocate = () => {
    closeDropdown();
    onLocate();
  };

  const handleFilterToggle = (source) => {
    if (onFilterChange) {
      onFilterChange(source);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <SearchContainer>
        <AddressField>
          <Input
            type="text"
            placeholder="Enter address (e.g. 10601 W Van Buren St, Tolleson, AZ 85353 or City, State)"
            value={address}
            onChange={handleAddressChange}
            onFocus={handleFocus}
            onBlur={closeDropdown}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            role="combobox"
            aria-label="Address"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-controls="address-options"
            aria-activedescendant={activeIndex >= 0 ? `address-option-${activeIndex}` : undefined}
            required
          />
          {onLocate && (
            <LocateButton
              type="button"
              onClick={handleLocate}
              disabled={loading}
              title="Search near my location"
              aria-label="Search near my location"
            >
              <LocateIcon />
            </LocateButton>
          )}
          {dropdownOpen && (
            // preventDefault on mousedown keeps focus in the input so clicks register before blur
            <RecentList id="address-options" role="listbox" onMouseDown={(e) => e.preventDefault()}>
              {options.map((option, index) => (
                <React.Fragment key={`${option.recent ? 'recent' : 'suggestion'}-${option.address}`}>
                  {index === 0 && option.recent && (
                    <RecentHeading role="presentation">Recent searches</RecentHeading>
                  )}
                  {option.suggestion && (index === 0 || options[index - 1].recent) && (
                    <RecentHeading role="presentation">Suggestions</RecentHeading>
                  )}
                  <RecentItem
                    id={`address-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    $active={index === activeIndex}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span>{option.address}</span>
                    {option.recent?.radius != null && <RecentRadius>{option.recent.radius} NM</RecentRadius>}
                    {option.recent && onRemoveRecentSearch && (
                      <RemoveButton
                        type="button"
                        tabIndex={-1}
                        aria-label={`Remove ${option.address} from recent searches`}
                        title="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecentSearch(option.address);
                          setActiveIndex(-1);
                        }}
                      >
                        ×
                      </RemoveButton>
                    )}
                  </RecentItem>
                </React.Fragment>
              ))}
            </RecentList>
          )}
        </AddressField>
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