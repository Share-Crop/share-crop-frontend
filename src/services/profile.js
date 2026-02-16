import api from './api';

export const profileService = {
  // Get current user profile
  getProfile: () => api.get('/api/auth/me'),

  // Update profile (name, email)
  updateProfile: (data) => api.put('/api/auth/profile', data),

  // Change password
  changePassword: (data) => api.put('/api/auth/password', data),

  // Update profile image
  updateProfileImage: (userId, imageUrl) => api.patch(`/api/users/${userId}/profile-image`, { profile_image_url: imageUrl }),

  // Get preferred currency
  getPreferredCurrency: (userId) => api.get(`/api/users/${userId}/preferred-currency`),

  // Update preferred currency
  updatePreferredCurrency: (userId, currency) => api.patch(`/api/users/${userId}/preferred-currency`, { preferred_currency: currency }),
};

export default profileService;

