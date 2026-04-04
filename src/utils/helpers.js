// Utility functions for the application
export const helpers = {
  // Format currency
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  },

  // Format large numbers
  formatNumber: (number) => {
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M';
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    return number.toString();
  },

  // Calculate distance between two points (Haversine formula)
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  },

  // Generate random color based on string
  stringToColor: (string) => {
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  },

  // Get initials from name
  getInitials: (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  },

  // Debounce function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Validate email
  validateEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // Format date
  formatDate: (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  },

  /** Today-or-future harvest rows, sorted ascending (used by map + purchase UI). */
  getFutureHarvestDates: (harvestDates) => {
    if (!Array.isArray(harvestDates) || harvestDates.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizeRow = (entry) => {
      if (entry == null) return null;
      if (typeof entry === 'string') {
        const d = entry.trim();
        return d ? { date: d, label: undefined } : null;
      }
      if (typeof entry === 'object' && entry.date != null) {
        const d = String(entry.date).trim();
        if (!d) return null;
        return { date: d, label: entry.label };
      }
      return null;
    };
    const out = [];
    for (const entry of harvestDates) {
      const row = normalizeRow(entry);
      if (!row) continue;
      const hDate = new Date(row.date);
      if (Number.isNaN(hDate.getTime())) continue;
      hDate.setHours(0, 0, 0, 0);
      if (hDate.getTime() >= today.getTime()) {
        out.push(row);
      }
    }
    out.sort((a, b) => new Date(a.date) - new Date(b.date));
    return out;
  },

  hasFutureHarvestDate: (harvestDates) => {
    return helpers.getFutureHarvestDates(harvestDates).length > 0;
  },

  // Get time ago string
  getTimeAgo: (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return helpers.formatDate(dateString);
  },

  // Capitalize first letter
  capitalize: (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },

  // Truncate text
  truncate: (text, length) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  },
};

export default helpers;