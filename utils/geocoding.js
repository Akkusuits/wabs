const axios = require('axios');
const logger = require('./logger');

// Reverse geocoding using OpenStreetMap Nominatim
const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1,
        'accept-language': 'en'
      },
      timeout: 5000
    });

    const { address } = response.data;
    
    return {
      street: address.road || '',
      city: address.city || address.town || address.village || '',
      state: address.state || '',
      country: address.country || '',
      postalCode: address.postcode || '',
      formattedAddress: response.data.display_name || ''
    };
  } catch (error) {
    logger.error('Reverse geocoding error:', error);
    return null;
  }
};

// Forward geocoding (address to coordinates)
const forwardGeocode = async (address) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1
      },
      timeout: 5000
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: result.display_name
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Forward geocoding error:', error);
    return null;
  }
};

// Calculate distance between two points in kilometers
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c;
  
  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

module.exports = {
  reverseGeocode,
  forwardGeocode,
  calculateDistance
};
