import api from './api';

export const orderService = {
  // Create a new order
  createOrder: (orderData) => api.post('/api/orders', orderData),
  
  getAllOrders: (params) => api.get('/api/orders', { params }),

  // Get orders for buyer
  getBuyerOrders: () => api.get('/api/orders/my-orders'),
  
  // Get orders for buyer with field details
  getBuyerOrdersWithFields: (buyerId) => api.get(`/api/orders/buyer/${buyerId}`),
  
  // Get orders for farmer (legacy query param)
  getFarmerOrders: (farmerId) => api.get(`/api/orders/farmer-orders?farmerId=${farmerId}`),
  // Get orders for farmer with full field/buyer details (same shape as buyer endpoint)
  getFarmerOrdersWithFields: (farmerId) => api.get(`/api/orders/farmer/${farmerId}`),
  
  // Update order status (e.g. declared_harvest when setting completed)
  updateOrderStatus: (id, status, extra = {}) => api.put(`/api/orders/${id}/status`, { status, ...extra }),
  
  // Get specific order details
  getOrder: (id) => api.get(`/api/orders/${id}`),

  /** Buyer: list own refund requests (optional; buyer order rows also expose pending request id). */
  getMyRefundRequests: () => api.get('/api/orders/refund-requests/mine'),

  /** Farmer: pending refund requests on this farmer's fields */
  getIncomingRefundRequests: () => api.get('/api/orders/refund-requests/incoming'),

  /** Buyer asks farmer to refund (no direct cancel/delete). */
  createRefundRequest: (orderId, payload = {}) =>
    api.post(`/api/orders/${orderId}/refund-requests`, payload),

  /** Farmer approves or rejects a refund request (`action`: approve | reject). */
  resolveRefundRequest: (requestId, payload) =>
    api.patch(`/api/orders/refund-requests/${requestId}`, payload),

  /** @deprecated Orders cannot be deleted via API; use createRefundRequest. */
  cancelOrder: () =>
    Promise.reject(new Error('Order cancellation was removed; use request refund instead.')),
};
