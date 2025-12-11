import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import L from 'leaflet';
import { cranesToGeoJson, RADIUS_NM_TO_METERS } from '../services/faaService';
import { sanitizeText } from '../utils/sanitize';

// Create custom crane icon (for DOF and Part77 data)
const craneIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149059.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Create NOTAM icon (orange warning icon for temporary obstructions)
const notamIcon = L.divIcon({
  className: 'notam-marker',
  html: `
    <div class="notam-marker-inner">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 20h20L12 2z" fill="#FF8C00" stroke="#FF6600" stroke-width="2"/>
        <path d="M12 9v4M12 17h.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Create star icon for selected address (red)
const starIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1828/1828614.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

const MapContainer = styled.div`
  flex: 1;
  min-height: 400px;
  border-right: 1px solid #ccc;

  @media (max-width: 768px) {
    border-right: none;
    border-bottom: 1px solid #ccc;
  }

  /* NOTAM marker pulse animation */
  .notam-marker {
    background: transparent;
    border: none;
  }

  .notam-marker-inner {
    position: relative;
    animation: notam-pulse 2s ease-in-out infinite;
  }

  @keyframes notam-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.85;
    }
  }

  /* Add a subtle glow effect to NOTAM markers */
  .notam-marker-inner svg {
    filter: drop-shadow(0 0 3px rgba(255, 140, 0, 0.6));
  }
`;

const MapView = ({ location, radius, cranes, selectedCraneId, onCraneSelect }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geojsonLayerRef = useRef(null);
  const circleLayerRef = useRef(null);
  const addressMarkerRef = useRef(null);

  // Initialize the map
  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([location.lat, location.lng], 11);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);
      
      mapInstanceRef.current = map;
      
      // Handle resize events
      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // Clean up resize listener on unmount
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update the map when location changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Update map view to center on new location
      mapInstanceRef.current.setView([location.lat, location.lng], mapInstanceRef.current.getZoom());
      
      // Add or update star marker for the selected address
      if (addressMarkerRef.current) {
        mapInstanceRef.current.removeLayer(addressMarkerRef.current);
      }
      
      addressMarkerRef.current = L.marker([location.lat, location.lng], { 
        icon: starIcon,
        zIndexOffset: 1000 // Ensure the star is on top of other markers
      }).addTo(mapInstanceRef.current);
      
      // Add popup with address information (sanitized to prevent XSS)
      const sanitizedAddress = sanitizeText(location.address || 'Current location');
      addressMarkerRef.current.bindPopup(`
        <strong>Selected Address</strong><br/>
        ${sanitizedAddress}
      `);
    }
  }, [location]);

  // Update radius circle when radius changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Update or create radius circle
      if (circleLayerRef.current) {
        mapInstanceRef.current.removeLayer(circleLayerRef.current);
      }
      
      circleLayerRef.current = L.circle([location.lat, location.lng], {
        color: 'blue',
        fillColor: '#30f',
        fillOpacity: 0.1,
        radius: RADIUS_NM_TO_METERS(radius)
      }).addTo(mapInstanceRef.current);
    }
  }, [location, radius]);

  // Update the crane markers when the data changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Remove previous GeoJSON layer if it exists
      if (geojsonLayerRef.current) {
        mapInstanceRef.current.removeLayer(geojsonLayerRef.current);
      }
      
      // Convert cranes array to GeoJSON
      const geojson = cranesToGeoJson(cranes);
      
      // Add new GeoJSON layer
      geojsonLayerRef.current = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
          // Use different icons based on data source
          const dataSource = feature.properties.dataSource;
          const icon = dataSource === 'NOTAM' ? notamIcon : craneIcon;
          return L.marker(latlng, { icon: icon });
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;

          // Sanitize all data from CSV to prevent XSS attacks
          const sanitized = {
            structureType: sanitizeText(props.structureType || ''),
            dataSource: sanitizeText(props.dataSource || 'Unknown'),
            id: sanitizeText(props.id || ''),
            height: sanitizeText(String(props.height || '')),
            heightUnit: sanitizeText(props.heightUnit || ''),
            status: sanitizeText(props.status || ''),
            startDate: sanitizeText(props.startDate || 'N/A'),
            endDate: sanitizeText(props.endDate || 'N/A'),
            sponsor: sanitizeText(props.sponsor || '')
          };

          // Create different popup content based on data source
          const isNOTAM = props.dataSource === 'NOTAM';

          const sourceBadgeStyle = isNOTAM
            ? 'background-color: #FF8C00; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; font-weight: bold;'
            : props.dataSource === 'DOF'
            ? 'background-color: #4A90E2; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; font-weight: bold;'
            : 'background-color: #50C878; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; font-weight: bold;';

          let popupContent = `
            <div style="min-width: 200px;">
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 1.1rem;">${sanitized.structureType}</strong>
                <span style="${sourceBadgeStyle}; margin-left: 8px;">${sanitized.dataSource}</span>
              </div>
          `;

          if (isNOTAM) {
            // NOTAM-specific popup with emphasis on temporary nature
            popupContent += `
              <div style="background-color: #FFF3E0; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <strong style="color: #FF8C00;">⚠️ Temporary Obstruction</strong>
              </div>
              <strong>NOTAM ID:</strong> ${sanitized.id}<br/>
              <strong>Height:</strong> ${sanitized.height} ${sanitized.heightUnit}<br/>
              <strong>Status:</strong> ${sanitized.status}<br/>
              <div style="background-color: #E3F2FD; padding: 6px; border-radius: 4px; margin-top: 6px;">
                <strong>Active Period:</strong><br/>
                ${sanitized.startDate} to ${sanitized.endDate}
              </div>
            `;
          } else {
            // DOF/Part77 popup - standard format
            popupContent += `
              <strong>ID:</strong> ${sanitized.id}<br/>
              <strong>Height:</strong> ${sanitized.height} ${sanitized.heightUnit}<br/>
              <strong>Status:</strong> ${sanitized.status}<br/>
              <strong>Dates:</strong> ${sanitized.startDate} - ${sanitized.endDate}<br/>
              <strong>Sponsor:</strong> ${sanitized.sponsor}
            `;
          }

          popupContent += `</div>`;

          layer.bindPopup(popupContent);

          // Store reference to the layer for highlighting
          layer.craneId = props.uniqueId;

          // Add click handler to select crane
          layer.on('click', () => {
            if (onCraneSelect) {
              onCraneSelect(props.uniqueId);
            }
          });
        }
      }).addTo(mapInstanceRef.current);
      
      // Make sure the address marker is on top after adding crane markers
      if (addressMarkerRef.current && typeof addressMarkerRef.current.bringToFront === 'function') {
        addressMarkerRef.current.bringToFront();
      }
      
      // Only fit bounds when cranes data first loads, not on every update
      // Center on the search location to keep the star fixed
      if (cranes.length > 0 && circleLayerRef.current) {
        mapInstanceRef.current.fitBounds(circleLayerRef.current.getBounds());
      }
    }
  }, [cranes]);

  // Handle selected crane highlighting
  useEffect(() => {
    if (mapInstanceRef.current && geojsonLayerRef.current && selectedCraneId) {
      // Find and open the popup for the selected crane
      geojsonLayerRef.current.eachLayer((layer) => {
        if (layer.craneId === selectedCraneId) {
          layer.openPopup();
        }
      });
    }
  }, [selectedCraneId]);

  return <MapContainer ref={mapRef} />;
};

export default MapView;