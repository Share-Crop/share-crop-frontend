import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

// Debug logging to verify the API base URL

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let authTokenProvider = null;
export const setAuthTokenProvider = (provider) => {
  authTokenProvider = typeof provider === 'function' ? provider : null;
};

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = authTokenProvider ? authTokenProvider() : null;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
