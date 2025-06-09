import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import L from 'leaflet';
import { cranesToGeoJson, RADIUS_NM_TO_METERS } from '../services/faaService';

// Create custom crane icon
const craneIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2088/2088708.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// Create star icon for selected address (purple)
const starIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2107/2107957.png',
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
`;

const MapView = ({ location, radius, cranes }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geojsonLayerRef = useRef(null);
  const circleLayerRef = useRef(null);
  const addressMarkerRef = useRef(null);

  // Initialize the map
  useEffect(() => {
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([location.lat, location.lng], 11);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
      // Add or update star marker for the selected address
      if (addressMarkerRef.current) {
        mapInstanceRef.current.removeLayer(addressMarkerRef.current);
      }
      
      addressMarkerRef.current = L.marker([location.lat, location.lng], { 
        icon: starIcon,
        zIndexOffset: 1000 // Ensure the star is on top of other markers
      }).addTo(mapInstanceRef.current);
      
      // Add popup with address information
      addressMarkerRef.current.bindPopup(`
        <strong>Selected Address</strong><br/>
        ${location.address || 'Current location'}
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
          return L.marker(latlng, { icon: craneIcon });
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`
            <strong>${props.structureType}</strong><br/>
            ID: ${props.id}<br/>
            Height: ${props.height} ${props.heightUnit}<br/>
            Status: ${props.status}<br/>
            Dates: ${props.startDate} - ${props.endDate}<br/>
            Sponsor: ${props.sponsor}
          `);
        }
      }).addTo(mapInstanceRef.current);
      
      // Make sure the address marker is on top after adding crane markers
      if (addressMarkerRef.current && typeof addressMarkerRef.current.bringToFront === 'function') {
        addressMarkerRef.current.bringToFront();
      }
      
      // Only fit bounds when cranes data first loads, not on every update
      if (cranes.length > 0 && circleLayerRef.current) {
        const bounds = circleLayerRef.current.getBounds();
        if (geojsonLayerRef.current.getBounds().isValid()) {
          bounds.extend(geojsonLayerRef.current.getBounds());
        }
        mapInstanceRef.current.fitBounds(bounds);
      }
    }
  }, [cranes]);

  return <MapContainer ref={mapRef} />;
};

export default MapView;