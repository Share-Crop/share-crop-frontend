import api from './api';

export const adminService = {
  getAllUsers: (includeStats = true) => api.get('/api/users', { params: { includeStats } }),
  getUserByIdWithStats: (id) => api.get(`/api/users/${id}/stats`),
  getPendingFarmers: () => api.get('/api/admin/farmers/pending'),
  approveFarmer: (id) => api.post(`/api/admin/farmers/${id}/approve`),
  rejectFarmer: (id, reason) => api.post(`/api/admin/farmers/${id}/reject`, { reason }),
  getFarmerDocuments: (id) => api.get(`/api/admin/farmers/${id}/documents`),
  getProductionConsistency: () => api.get('/api/admin/production/consistency'),
  getComplaints: (params) => api.get('/api/admin/qa/complaints', { params }),
  updateComplaintStatus: (id, status) => api.patch(`/api/admin/qa/complaints/${id}`, { status }),
  updateComplaintRemarks: (id, remarks) => api.patch(`/api/admin/qa/complaints/${id}/remarks`, { remarks }),
  refundComplaint: (id, coins) => api.post(`/api/admin/qa/complaints/${id}/refund`, { coins }),
  getProfitByCategory: (params) => api.get('/api/admin/analytics/profit-by-category', { params }),
  getFarmerPerformance: (params) => api.get('/api/admin/analytics/farmers/performance', { params }),
  getReviewsSummary: (params) => api.get('/api/admin/analytics/reviews/summary', { params }),
  getNewUserRegistrations: (params) => api.get('/api/admin/notifications/users/new', { params }),
  getPendingFarmerApprovals: (params) => api.get('/api/admin/notifications/farmers/pending', { params }),
  getCoinPurchases: (params) => api.get('/api/admin/coins/purchases', { params }),
  getCoinTransactions: (params) => api.get('/api/admin/coins/transactions', { params }),
  getPayments: (params) => api.get('/api/admin/payments', { params }),
  getAuditLogs: (params) => api.get('/api/admin/audit/logs', { params }),
  getNotificationsOverview: (params) => api.get('/api/admin/notifications/overview', { params }),
  // Coin Packages Management
  getPackages: () => api.get('/api/admin/packages'),
  getPackage: (id) => api.get(`/api/admin/packages/${id}`),
  createPackage: (data) => api.post('/api/admin/packages', data),
  updatePackage: (id, data) => api.patch(`/api/admin/packages/${id}`, data),
  deletePackage: (id) => api.delete(`/api/admin/packages/${id}`),
  // Currency Rates Management
  getCurrencyRates: () => api.get('/api/admin/currency-rates'),
  upsertCurrencyRate: (data) => api.post('/api/admin/currency-rates', data),
  updateCurrencyRate: (currency, data) => api.patch(`/api/admin/currency-rates/${currency}`, data),
  setCurrencyRateActive: (currency, isActive) =>
    api.patch(`/api/admin/currency-rates/${currency}/active`, { is_active: isActive }),
  deleteCurrencyRate: (currency) => api.delete(`/api/admin/currency-rates/${currency}`),
};
