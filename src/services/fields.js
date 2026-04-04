import api from './api';
import axios from 'axios';

const getBaseUrl = () => {
  if (process.env.REACT_APP_API_BASE_URL) return process.env.REACT_APP_API_BASE_URL;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5050';
  }
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname.replace('frontend', 'backend')}`;
};

const publicApi = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
});

const fieldsService = {
  /** List current user's fields only (for My Fields page). */
  getAll: () => api.get('/api/fields'),
  /** List all fields for map (discovery, browse, buy). */
  getAllForMap: () => api.get('/api/fields/all'),
  /** List fields available for farmer to rent (other owners' fields). Farmer-only. */
  getAvailableToRent: () => api.get('/api/fields/available-to-rent'),
  /** Get public fields - no authentication required */
  getPublicFields: () => publicApi.get('/api/fields/public'),
  getById: (id) => api.get(`/api/fields/${id}`),
  create: (data) => api.post('/api/fields', data),
  update: (id, data) => api.put(`/api/fields/${id}`, data),
  remove: (id) => api.delete(`/api/fields/${id}`),
};

export default fieldsService;
