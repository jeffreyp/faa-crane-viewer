import DOMPurify from 'dompurify';

/**
 * Sanitization utilities for XSS protection
 *
 * This module provides functions to sanitize user input and external data
 * before displaying it in the DOM to prevent XSS attacks.
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * @param {string} html - The HTML content to sanitize
 * @param {Object} options - DOMPurify configuration options
 * @returns {string} - Sanitized HTML safe for insertion into DOM
 */
export const sanitizeHTML = (html, options = {}) => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Default configuration: allow safe HTML but strip dangerous elements
  const defaultConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'div', 'span', 'p'],
    ALLOWED_ATTR: ['style'],
    ALLOW_DATA_ATTR: false,
    ...options
  };

  return DOMPurify.sanitize(html, defaultConfig);
};

/**
 * Sanitize plain text by escaping HTML special characters
 * Use this for user input that should be displayed as plain text
 *
 * @param {string} text - The text to sanitize
 * @returns {string} - Escaped text safe for display
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Validate and sanitize address input
 * Allows only alphanumeric characters, spaces, commas, periods, hyphens, and #
 *
 * @param {string} address - The address to validate
 * @returns {string} - Sanitized address
 * @throws {Error} - If address contains invalid characters
 */
export const validateAddress = (address) => {
  if (!address || typeof address !== 'string') {
    throw new Error('Address must be a non-empty string');
  }

  const trimmed = address.trim();

  if (trimmed.length === 0) {
    throw new Error('Address cannot be empty');
  }

  if (trimmed.length > 200) {
    throw new Error('Address is too long (max 200 characters)');
  }

  // Allow alphanumeric, spaces, commas, periods, hyphens, and # for addresses
  const validAddressPattern = /^[a-zA-Z0-9\s,.\-#]+$/;

  if (!validAddressPattern.test(trimmed)) {
    throw new Error('Address contains invalid characters. Only letters, numbers, spaces, commas, periods, hyphens, and # are allowed.');
  }

  return trimmed;
};

/**
 * Sanitize CSV data fields before displaying
 * Escapes HTML in all string fields to prevent XSS from compromised CSV files
 *
 * @param {Object} data - The data object from CSV
 * @returns {Object} - Sanitized data object
 */
export const sanitizeCSVData = (data) => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Sanitize geocoding result data
 *
 * @param {Object} geocodeResult - The geocoding result object
 * @returns {Object} - Sanitized geocoding result
 */
export const sanitizeGeocodeResult = (geocodeResult) => {
  if (!geocodeResult || typeof geocodeResult !== 'object') {
    return null;
  }

  return {
    latitude: geocodeResult.latitude,
    longitude: geocodeResult.longitude,
    displayName: sanitizeText(geocodeResult.displayName || ''),
    address: geocodeResult.address ? {
      house_number: sanitizeText(geocodeResult.address.house_number || ''),
      road: sanitizeText(geocodeResult.address.road || ''),
      city: sanitizeText(geocodeResult.address.city || ''),
      state: sanitizeText(geocodeResult.address.state || ''),
      postcode: sanitizeText(geocodeResult.address.postcode || ''),
      country: sanitizeText(geocodeResult.address.country || '')
    } : {},
    boundingBox: geocodeResult.boundingBox,
    confidence: geocodeResult.confidence
  };
};
