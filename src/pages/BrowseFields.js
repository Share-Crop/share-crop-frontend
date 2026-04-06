import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import EnhancedFarmMap from '../components/Map/EnhancedFarmMap';
import EnhancedHeader from '../components/Layout/EnhancedHeader';
import NotificationSystem from '../components/Notification/NotificationSystem';
import useNotifications from '../hooks/useNotifications';
import fieldsService from '../services/fields';

const BrowseFields = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapFilters, setMapFilters] = useState({ categories: [], subcategories: [] });
  const mapRef = useRef(null);
  const headerRef = useRef(null);

  const {
    notifications,
    addNotification,
    removeNotification,
    backendNotifications,
    markNotificationAsRead,
    fetchBackendNotifications,
  } = useNotifications();

  useEffect(() => {
    loadPublicFields();
  }, []);

  const loadPublicFields = async () => {
    setLoading(true);
    try {
      const response = await fieldsService.getPublicFields();
      const raw = response.data || [];
      const mappedFields = raw
        .filter((field) => field && field.id)
        .map((field) => ({
          ...field,
          harvestDates: field.harvest_dates ?? field.harvestDates,
          pricePerM2: field.price_per_m2 ?? field.pricePerM2,
          fieldSize: field.field_size ?? field.fieldSize,
          productionRate: field.production_rate ?? field.productionRate,
          coordinates:
            field.coordinates ||
            (field.longitude != null && field.latitude != null
              ? [Number(field.longitude), Number(field.latitude)]
              : field.coordinates),
        }));
      setFields(mappedFields);
    } catch (error) {
      console.error('Error loading public fields:', error);
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const handleHeaderFilterApply = useCallback((filters) => {
    setMapFilters({
      categories: Array.isArray(filters?.categories) ? filters.categories : [],
      subcategories: Array.isArray(filters?.subcategories) ? filters.subcategories : [],
    });
  }, []);

  const handleFarmSelect = useCallback((farm) => {
    if (mapRef.current && mapRef.current.zoomToFarm) {
      mapRef.current.zoomToFarm(farm);
    }
  }, []);

  const handleCoinRefresh = useCallback(() => {
    if (headerRef.current && headerRef.current.refreshCoins) {
      headerRef.current.refreshCoins();
    }
  }, []);

  const headerRole = user?.user_type === 'farmer' ? 'farmer' : 'buyer';

  return (
    <Box
      sx={{
        flexGrow: 1,
        height: 'var(--app-viewport-height, 100vh)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <EnhancedHeader
        ref={headerRef}
        publicBrowse={!isAuthenticated}
        onSearchChange={handleSearchChange}
        onFilterApply={handleHeaderFilterApply}
        fields={fields}
        onFarmSelect={handleFarmSelect}
        userType={headerRole}
        user={user}
        onLogout={isAuthenticated ? logout : undefined}
        backendNotifications={backendNotifications}
        onMarkNotificationAsRead={markNotificationAsRead}
        onRefreshNotifications={fetchBackendNotifications}
      />

      <Box
        sx={{
          flexGrow: 1,
          mt: 'var(--app-header-height)',
          height: 'calc(var(--app-viewport-height, 100vh) - var(--app-header-height))',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 0,
          isolation: 'isolate',
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2,
              bgcolor: '#f8fafc',
            }}
          >
            <CircularProgress sx={{ color: '#2e7d32' }} />
            <Typography color="text.secondary">Loading fields…</Typography>
          </Box>
        ) : (
          <EnhancedFarmMap
            ref={mapRef}
            userType="buyer"
            user={user}
            fields={fields}
            farms={[]}
            searchQuery={searchQuery}
            filters={mapFilters}
            minimal={false}
            hideDeliveriesShortcut
            onProductSelect={handleFarmSelect}
            onFarmsLoad={() => {}}
            onNotification={addNotification}
            onNotificationRefresh={fetchBackendNotifications}
            onCoinRefresh={handleCoinRefresh}
          />
        )}
      </Box>

      <NotificationSystem notifications={notifications} onRemove={removeNotification} />
    </Box>
  );
};

export default BrowseFields;
