// Mock data for crane locations around Tolleson, AZ
const MOCK_CRANE_DATA = [
  {
    id: "2023-WSW-1234-OE",
    structureType: "Crane",
    latitude: 33.4476,
    longitude: -112.2562,
    height: 190,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-15",
    endDate: "2025-08-15",
    sponsor: "ABC Construction Co.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1235-OE",
    structureType: "Crane",
    latitude: 33.4506,
    longitude: -112.2682,
    height: 210,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-01",
    endDate: "2025-07-30",
    sponsor: "XYZ Builders Inc.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1236-OE",
    structureType: "Crane",
    latitude: 33.4356,
    longitude: -112.2492,
    height: 175,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-01",
    endDate: "2025-09-15",
    sponsor: "Phoenix Development LLC",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1237-OE",
    structureType: "Crane",
    latitude: 33.4556,
    longitude: -112.2392,
    height: 185,
    heightUnit: "ft AGL",
    status: "Pending",
    startDate: "2025-06-15",
    endDate: "2025-10-30",
    sponsor: "Desert Construction Inc.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1238-OE",
    structureType: "Crane",
    latitude: 33.4656,
    longitude: -112.2792,
    height: 195,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-03-15",
    endDate: "2025-08-01",
    sponsor: "Southwest Builders Group",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1239-OE",
    structureType: "Crane",
    latitude: 33.4386,
    longitude: -112.2462,
    height: 160,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-01",
    endDate: "2025-08-30",
    sponsor: "Valley Builders LLC",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1240-OE",
    structureType: "Crane",
    latitude: 33.4526,
    longitude: -112.2532,
    height: 205,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-15",
    endDate: "2025-07-15",
    sponsor: "Metro Construction Group",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1241-OE",
    structureType: "Crane",
    latitude: 33.4406,
    longitude: -112.2612,
    height: 180,
    heightUnit: "ft AGL",
    status: "Pending",
    startDate: "2025-06-01",
    endDate: "2025-09-01",
    sponsor: "Desert Crane Services",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1242-OE",
    structureType: "Crane",
    latitude: 33.4496,
    longitude: -112.2402,
    height: 215,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-03-01",
    endDate: "2025-08-15",
    sponsor: "Arizona Building Co.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1243-OE",
    structureType: "Crane",
    latitude: 33.4536,
    longitude: -112.2712,
    height: 170,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-15",
    endDate: "2025-09-30",
    sponsor: "Western Crane Rentals",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1244-OE",
    structureType: "Crane",
    latitude: 33.4436,
    longitude: -112.2482,
    height: 200,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-01",
    endDate: "2025-08-01",
    sponsor: "Southwestern Development Inc.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1245-OE",
    structureType: "Crane",
    latitude: 33.4576,
    longitude: -112.2432,
    height: 185,
    heightUnit: "ft AGL",
    status: "Pending",
    startDate: "2025-06-15",
    endDate: "2025-10-15",
    sponsor: "Maricopa Construction LLC",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1246-OE",
    structureType: "Crane",
    latitude: 33.4626,
    longitude: -112.2572,
    height: 195,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-03-15",
    endDate: "2025-07-30",
    sponsor: "Phoenix Metro Builders",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1247-OE",
    structureType: "Crane",
    latitude: 33.4676,
    longitude: -112.2512,
    height: 175,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-01",
    endDate: "2025-09-15",
    sponsor: "Arizona Urban Development",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1248-OE",
    structureType: "Crane",
    latitude: 33.4416,
    longitude: -112.2642,
    height: 210,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-15",
    endDate: "2025-08-15",
    sponsor: "Grand Avenue Construction",
    city: "Tolleson",
    state: "AZ"
  }
];

// Convert nautical miles to meters for Leaflet
const nauticalMilesToMeters = (nm) => {
  return nm * 1852;
};

// Function to calculate if a point is within a radius
const isPointWithinRadius = (center, point, radiusNM) => {
  // Convert to radians
  const lat1 = center.lat * Math.PI / 180;
  const lon1 = center.lng * Math.PI / 180;
  const lat2 = point.latitude * Math.PI / 180;
  const lon2 = point.longitude * Math.PI / 180;
  
  // Haversine formula
  const dlon = lon2 - lon1;
  const dlat = lat2 - lat1;
  const a = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceNM = 3440.065 * c; // Earth radius in nautical miles * c
  
  return distanceNM <= radiusNM;
};

// Function to simulate fetching crane data
const fetchCraneData = (location, radiusNM) => {
  return new Promise((resolve) => {
    // Simulate API call delay
    setTimeout(() => {
      // Filter the mock data based on radius
      const filteredData = MOCK_CRANE_DATA.filter(crane => 
        isPointWithinRadius(location, crane, radiusNM)
      );
      
      resolve(filteredData);
    }, 500);
  });
};

// Create custom crane icon
const craneIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2088/2088708.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Create star icon for selected address
const starIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/929/929495.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Default location (Tolleson, AZ)
  const defaultLocation = {
    lat: 33.4456,
    lng: -112.2592,
    address: "10601 W Van Buren St, Tolleson, AZ 85353"
  };
  
  // Default radius (10 nautical miles)
  const defaultRadius = 10;
  
  // Initialize map
  const map = L.map('map').setView([defaultLocation.lat, defaultLocation.lng], 11);
  
  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Initialize layers
  let circleLayer = null;
  let addressMarker = null;
  let markersLayer = L.layerGroup().addTo(map);
  
  // Initialize table
  const tableBody = document.getElementById('table-body');
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // Handle form submission
  document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const address = document.getElementById('address-input').value;
    const radius = parseInt(document.getElementById('radius-input').value);
    
    // In a real app, we would geocode the address here
    // For now, we'll use the default location
    const location = defaultLocation;
    
    // Show loading indicator
    loadingIndicator.style.display = 'flex';
    tableBody.innerHTML = '';
    
    // Fetch crane data
    try {
      const cranes = await fetchCraneData(location, radius);
      
      // Update map
      updateMap(location, radius, cranes);
      
      // Update table
      updateTable(cranes);
    } catch (error) {
      console.error('Error fetching crane data:', error);
      alert('Failed to fetch crane data. Please try again.');
    } finally {
      // Hide loading indicator
      loadingIndicator.style.display = 'none';
    }
  });
  
  // Function to update the map
  const updateMap = (location, radius, cranes) => {
    // Clear previous markers
    markersLayer.clearLayers();
    
    // Remove previous circle
    if (circleLayer) {
      map.removeLayer(circleLayer);
    }
    
    // Remove previous address marker
    if (addressMarker) {
      map.removeLayer(addressMarker);
    }
    
    // Add circle for radius
    circleLayer = L.circle([location.lat, location.lng], {
      color: 'blue',
      fillColor: '#30f',
      fillOpacity: 0.1,
      radius: nauticalMilesToMeters(radius)
    }).addTo(map);
    
    // Add star marker for the selected address
    addressMarker = L.marker([location.lat, location.lng], { 
      icon: starIcon,
      zIndexOffset: 1000 // Ensure the star is on top of other markers
    }).addTo(map);
    
    // Add popup with address information
    addressMarker.bindPopup(`
      <strong>Selected Address</strong><br/>
      ${location.address || 'Current location'}
    `);
    
    // Add markers for cranes
    cranes.forEach(crane => {
      const marker = L.marker([crane.latitude, crane.longitude], { icon: craneIcon });
      
      // Add popup
      marker.bindPopup(`
        <strong>${crane.structureType}</strong><br/>
        ID: ${crane.id}<br/>
        Height: ${crane.height} ${crane.heightUnit}<br/>
        Status: ${crane.status}<br/>
        Dates: ${crane.startDate} - ${crane.endDate}<br/>
        Sponsor: ${crane.sponsor}
      `);
      
      markersLayer.addLayer(marker);
    });
    
    // Make sure the address marker is on top if available
    if (addressMarker && typeof addressMarker.bringToFront === 'function') {
      addressMarker.bringToFront();
    }
    
    // Fit bounds
    const bounds = circleLayer.getBounds();
    if (markersLayer.getLayers().length > 0) {
      const markerBounds = L.latLngBounds(markersLayer.getLayers().map(layer => layer.getLatLng()));
      if (markerBounds.isValid()) {
        bounds.extend(markerBounds);
      }
    }
    map.fitBounds(bounds);
  };
  
  // Function to update the table
  const updateTable = (cranes) => {
    // Clear previous table rows
    tableBody.innerHTML = '';
    
    if (cranes.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="7" style="text-align: center; padding: 20px;">
          No construction cranes found in this area
        </td>
      `;
      tableBody.appendChild(emptyRow);
      return;
    }
    
    // Add rows for each crane
    cranes.forEach(crane => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${crane.id}</td>
        <td>${crane.structureType}</td>
        <td>${crane.height} ${crane.heightUnit}</td>
        <td>${crane.status}</td>
        <td>${crane.startDate}</td>
        <td>${crane.endDate}</td>
        <td>${crane.sponsor}</td>
      `;
      tableBody.appendChild(row);
    });
  };
  
  // Initialize table sorting
  document.querySelectorAll('th').forEach((header, index) => {
    header.addEventListener('click', () => {
      const rows = Array.from(tableBody.querySelectorAll('tr'));
      
      // Skip if there are no rows or only the "no cranes" message
      if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td').colSpan)) {
        return;
      }
      
      // Sort direction
      const currentDirection = header.getAttribute('data-sort') || 'asc';
      const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
      
      // Reset all headers
      document.querySelectorAll('th').forEach(th => {
        th.removeAttribute('data-sort');
        th.textContent = th.textContent.replace(' ▲', '').replace(' ▼', '');
      });
      
      // Set new sort direction
      header.setAttribute('data-sort', newDirection);
      header.textContent += newDirection === 'asc' ? ' ▲' : ' ▼';
      
      // Sort rows
      rows.sort((a, b) => {
        const aValue = a.cells[index].textContent;
        const bValue = b.cells[index].textContent;
        
        return newDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });
      
      // Re-append rows in new order
      rows.forEach(row => tableBody.appendChild(row));
    });
  });
  
  // Initial search
  document.getElementById('search-form').dispatchEvent(new Event('submit'));
});