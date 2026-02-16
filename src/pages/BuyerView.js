import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation, useSearchParams } from 'react-router-dom';
import {
  Box,
} from '@mui/material';
import EnhancedFarmMap from '../components/Map/EnhancedFarmMap';
import EnhancedHeader from '../components/Layout/EnhancedHeader';
import NotificationSystem from '../components/Notification/NotificationSystem';
import useNotifications from '../hooks/useNotifications';
import RentedFields from './RentedFields';
import Orders from './Orders';
import Transaction from './Transaction';
import BuyCoins from './BuyCoins';
import RedeemCoins from './RedeemCoins';
import RedemptionHistory from './RedemptionHistory';
import PayoutMethods from './PayoutMethods';
import Profile from './Profile';
import Messages from './Messages';
import ChangeCurrency from './ChangeCurrency';
import Settings from './Settings';
import Notifications from './Notifications';
import Complaints from './Complaints';
import { useAuth } from '../contexts/AuthContext';
import fieldsService from '../services/fields';
import farmsService from '../services/farms';
import coinService from '../services/coinService';
// import productsService from '../services/products'; // Removed - using fields directly

const BuyerView = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  // const [products, setProducts] = useState([]); // Removed - using fields directly
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const headerRef = useRef(null);
  const {
    notifications,
    backendNotifications,
    addNotification,
    removeNotification,
    markNotificationAsRead,
    fetchBackendNotifications
  } = useNotifications();
  const isMapPage = location.pathname === '/buyer' || location.pathname === '/buyer/';
  const isMessagesPage = location.pathname === '/buyer/messages';
  const isCurrencyPage = location.pathname === '/buyer/currency';
  const isSettingsPage = location.pathname === '/buyer/settings';

  // No need to force role - use actual logged-in user

  // Initialize user coins when user is available
  useEffect(() => {
    if (currentUser && currentUser.id) {
      loadAllFieldsFromStorage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when currentUser is set
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && currentUser.id) {
      coinService.initializeUserCoins(currentUser.id);
    }
  }, [currentUser]);

  const loadAllFieldsFromStorage = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    try {
      const [farmsResponse, fieldsResponse] = await Promise.all([
        farmsService.getAll(),
        fieldsService.getAllForMap(),
      ]);
      setFarms(farmsResponse.data || []);

      // Map database field names to frontend expected names
      const mappedFields = (fieldsResponse.data || [])
        .filter(field => field && field.id) // Only include fields with valid id
        .map(field => ({
          ...field,
          harvestDates: field.harvest_dates, // Map harvest_dates to harvestDates
          pricePerM2: field.price_per_m2, // Map price_per_m2 to pricePerM2
          fieldSize: field.field_size, // Map field_size to fieldSize
          productionRate: field.production_rate, // Map production_rate to productionRate
        }));
      setFields(mappedFields);
    } catch (err) {
      console.error('Error loading buyer data:', err);
    } finally {
    }
  }, [currentUser]);

  useEffect(() => {
    loadAllFieldsFromStorage();
  }, [loadAllFieldsFromStorage]);

  // Handle field_id from URL params to zoom to field
  useEffect(() => {
    const fieldId = searchParams.get('field_id');
    if (fieldId && mapRef.current) {
      // Find the field in the loaded fields
      const field = fields.find(f => String(f.id) === String(fieldId));
      if (field) {
        const coordinates = field.coordinates ||
          (field.longitude && field.latitude
            ? [field.longitude, field.latitude]
            : null);
        if (coordinates) {
          // Small delay to ensure map is ready
          const timer = setTimeout(() => {
            if (mapRef.current && mapRef.current.zoomToFarm) {
              // Convert field to farm format expected by zoomToFarm
              const farmData = {
                ...field,
                coordinates
              };
              mapRef.current.zoomToFarm(farmData, true);
              // Clear the URL parameter after zooming
              setSearchParams({});
            }
          }, 500);
          return () => clearTimeout(timer);
        }
      } else if (fieldId) {
        // Field not found in loaded fields, try fetching it
        fieldsService.getById(fieldId)
          .then(response => {
            const fetchedField = response.data;
            if (fetchedField && mapRef.current && mapRef.current.zoomToFarm) {
              const coordinates = fetchedField.coordinates ||
                (fetchedField.longitude && fetchedField.latitude
                  ? [fetchedField.longitude, fetchedField.latitude]
                  : null);
              if (coordinates) {
                const farmData = {
                  ...fetchedField,
                  coordinates
                };
                mapRef.current.zoomToFarm(farmData, true);
                setSearchParams({});
              }
            }
          })
          .catch(err => {
            console.error('Failed to fetch field:', err);
          });
      }
    }
  }, [searchParams, fields, setSearchParams]);



  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  const handleFarmSelect = (farm) => {
    if (mapRef.current && mapRef.current.zoomToFarm) {
      mapRef.current.zoomToFarm(farm);
    }
  };

  const handleFarmsLoad = useCallback((loadedData) => {
    // Check if the loaded data contains field properties (indicating it's fields data)
    if (loadedData && loadedData.length > 0) {
      const firstItem = loadedData[0];
      // If it has field-specific properties, treat it as fields data
      if (firstItem.harvest_dates || firstItem.harvestDates || firstItem.price_per_m2 || firstItem.pricePerM2) {
        // Map database field names to frontend expected names if needed
        const mappedFields = loadedData.map(field => ({
          ...field,
          harvestDates: field.harvestDates || field.harvest_dates,
          pricePerM2: field.pricePerM2 || field.price_per_m2,
          fieldSize: field.fieldSize || field.field_size,
          productionRate: field.productionRate || field.production_rate,
        }));
        setFields(mappedFields);
      } else {
        // Otherwise, treat it as farms data
        setFarms(loadedData);
      }
    }
  }, []);

  const handleCoinRefresh = () => {
    if (headerRef.current && headerRef.current.refreshCoins) {
      headerRef.current.refreshCoins();
    }
  };

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <EnhancedHeader
        ref={headerRef}
        onSearchChange={handleSearchChange}
        fields={fields}
        onFarmSelect={handleFarmSelect}
        userType="buyer"
        user={currentUser}
        onLogout={logout}
        backendNotifications={backendNotifications}
        onMarkNotificationAsRead={markNotificationAsRead}
        onRefreshNotifications={fetchBackendNotifications}
      />

      <Box sx={{
        flexGrow: 1,
        mt: 'var(--app-header-height)',
        height: 'calc(100vh - var(--app-header-height))',
        overflow: (isMapPage || isMessagesPage) ? 'hidden' : 'auto', // No scroll for map, messages, scroll for other pages
        position: 'relative',
        zIndex: 0,
        isolation: 'isolate'
      }}>
        <Routes>
          <Route path="/" element={
            <EnhancedFarmMap
              ref={mapRef}
              onProductSelect={handleFarmSelect}
              userType="buyer"
              searchQuery={searchQuery}
              onFarmsLoad={handleFarmsLoad}
              onNotification={addNotification}
              onNotificationRefresh={fetchBackendNotifications}
              onCoinRefresh={handleCoinRefresh}
              farms={farms}
              fields={fields}
            />
          } />
          <Route path="/rented-fields" element={<RentedFields />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route path="/buy-coins" element={<BuyCoins />} />
          <Route path="/redeem-coins" element={<RedeemCoins />} />
          <Route path="/redemption-history" element={<RedemptionHistory />} />
          <Route path="/payout-methods" element={<PayoutMethods />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/currency" element={<ChangeCurrency />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/complaints" element={<Complaints />} />
        </Routes>
      </Box>

      {/* Notification System */}
      <NotificationSystem
        notifications={notifications}
        onRemove={removeNotification}
      />
    </Box>
  );
};

export default BuyerView;
