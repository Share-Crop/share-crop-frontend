import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Paper, IconButton, Chip, Tooltip, Button } from '@mui/material';
import { Map as MapboxMap, Marker, NavigationControl, FullscreenControl } from 'react-map-gl';
import { LocationOn, Close, Agriculture, Tune, FilterList } from '@mui/icons-material';
import { DARK_MAP_STYLE } from '../../utils/mapConfig';
import { getProductIcon } from '../../utils/productIcons';
import { buildCoincidentMarkerPositionMap, getProductLngLat } from '../../utils/spreadCoincidentMapMarkers';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || 'pk.eyJ1Ijoic2hhcmVjcm9wIiwiYSI6ImNsdHh4eHh4eDAwMDEya249eHh4eHh4eHgifQ.demo';

const PublicMapView = ({ fields = [], isAuthenticated, user, onLoginRequired }) => {
  const [viewState, setViewState] = useState({
    longitude: 12.5674,
    latitude: 41.8719,
    zoom: 2,
  });
  const [selectedField, setSelectedField] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    shippingOption: '',
  });

  // Filter fields based on selected filters
  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      if (filters.category && field.category !== filters.category) return false;
      if (filters.shippingOption) {
        const shipping = (field.shipping_option || '').toLowerCase();
        if (filters.shippingOption === 'Delivery' && !shipping.includes('delivery')) return false;
        if (filters.shippingOption === 'Pickup' && !shipping.includes('pickup')) return false;
      }
      return true;
    });
  }, [fields, filters]);

  const publicFieldMarkerLngLatById = useMemo(
    () =>
      buildCoincidentMarkerPositionMap(
        filteredFields,
        getProductLngLat,
        (f, i) => (f.id != null && f.id !== '' ? String(f.id) : `idx-${i}`),
        { zoom: viewState.zoom }
      ),
    [filteredFields, viewState.zoom]
  );

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(fields.map(f => f.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [fields]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getHarvestText = (field) => {
    const dates = field.harvest_dates || [];
    if (!dates.length) return 'Not specified';
    if (dates.length === 1) {
      return formatDate(dates[0].date || dates[0]);
    }
    return `${formatDate(dates[0].date || dates[0])} (+${dates.length - 1} more)`;
  };

  const handleFieldClick = (field, displayLngLat) => {
    setSelectedField(field);
    const ll = displayLngLat || (field.coordinates && field.coordinates.length === 2 ? field.coordinates : null);
    if (ll && ll.length === 2) {
      setViewState(prev => ({
        ...prev,
        longitude: ll[0],
        latitude: ll[1],
        zoom: 8,
      }));
    }
  };

  const handleClosePopup = () => {
    setSelectedField(null);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Map */}
      <MapboxMap
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle={DARK_MAP_STYLE}
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="top-right" />
        <FullscreenControl position="top-right" />

        {/* Field Markers */}
        {filteredFields.map((field, fIdx) => {
          if (!field.coordinates || field.coordinates.length !== 2) return null;

          const posKey = field.id != null && field.id !== '' ? String(field.id) : `idx-${fIdx}`;
          const spread = publicFieldMarkerLngLatById.get(posKey);
          const mlng = spread ? spread[0] : field.coordinates[0];
          const mlat = spread ? spread[1] : field.coordinates[1];

          const isSelected = selectedField?.id === field.id;
          const icon = getProductIcon(field.subcategory || field.category);

          return (
            <Marker
              key={field.id}
              longitude={mlng}
              latitude={mlat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleFieldClick(field, [mlng, mlat]);
              }}
            >
              <Box
                sx={{
                  width: isSelected ? 50 : 40,
                  height: isSelected ? 50 : 40,
                  borderRadius: '50%',
                  backgroundColor: isSelected ? '#4CAF50' : '#fff',
                  border: `3px solid ${isSelected ? '#fff' : '#4CAF50'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                  '&:hover': {
                    transform: 'scale(1.15)',
                    backgroundColor: '#4CAF50',
                    '& img': { filter: 'brightness(0) invert(1)' },
                  },
                }}
              >
                {typeof icon === 'string' && icon.startsWith('/') ? (
                  <img
                    src={icon}
                    alt=""
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                  />
                ) : (
                  <Typography sx={{ fontSize: 20 }}>
                    {typeof icon === 'string' ? icon : '🌱'}
                  </Typography>
                )}
              </Box>
            </Marker>
          );
        })}
      </MapboxMap>

      {/* Filter Panel */}
      <Paper
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          p: 1.5,
          borderRadius: 2,
          zIndex: 10,
          minWidth: 200,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FilterList sx={{ fontSize: 18, color: '#4CAF50' }} />
          <Typography variant="body2" fontWeight={600}>
            Filters
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <select
            value={filters.category}
            onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              fontSize: 13,
              backgroundColor: '#fff',
            }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          <select
            value={filters.shippingOption}
            onChange={(e) => setFilters(f => ({ ...f, shippingOption: e.target.value }))}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              fontSize: 13,
              backgroundColor: '#fff',
            }}
          >
            <option value="">All Shipping</option>
            <option value="Delivery">Delivery</option>
            <option value="Pickup">Pickup</option>
          </select>
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {filteredFields.length} of {fields.length} fields
        </Typography>
      </Paper>

      {/* Selected Field Popup */}
      {selectedField && (
        <Paper
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '90%', md: 450 },
            maxHeight: '70vh',
            overflow: 'auto',
            borderRadius: 3,
            zIndex: 100,
            p: 3,
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={selectedField.image || getProductIcon(selectedField.subcategory || selectedField.category)}
                  alt={selectedField.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {selectedField.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedField.category}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={handleClosePopup}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Location */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LocationOn sx={{ fontSize: 16, color: '#666' }} />
            <Typography variant="body2" color="text.secondary">
              {selectedField.location || 'Location not specified'}
            </Typography>
          </Box>

          {/* Info Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
            <Box sx={{ p: 1.5, bgcolor: '#f8f8f8', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Area</Typography>
              <Typography variant="body2" fontWeight={600}>
                {selectedField.total_area_m2 || selectedField.area_m2 || selectedField.field_size || 'N/A'} m²
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: '#fff8e1', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Production</Typography>
              <Typography variant="body2" fontWeight={600}>
                {selectedField.total_production || 0} Kg
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: '#f3e5f5', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Price/m²</Typography>
              <Typography variant="body2" fontWeight={600} color="success.main">
                ${parseFloat(selectedField.price_per_m2 || 0).toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Shipping</Typography>
              <Typography variant="body2" fontWeight={600}>
                {selectedField.shipping_option || 'N/A'}
              </Typography>
            </Box>
          </Box>

          {/* Harvest Date */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Harvest Date
            </Typography>
            <Chip
              icon={<Agriculture sx={{ fontSize: 14 }} />}
              label={getHarvestText(selectedField)}
              size="small"
              sx={{ bgcolor: '#fff3e0', color: '#e65100' }}
            />
          </Box>

          {/* Farmer */}
          {selectedField.farmer_name && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Farmer</Typography>
              <Typography variant="body2" fontWeight={500}>
                {selectedField.farmer_name}
              </Typography>
            </Box>
          )}

          {/* CTA Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isAuthenticated ? (
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  // Navigate to purchase flow
                  window.location.href = `/${user?.user_type || 'buyer'}`;
                }}
                sx={{
                  backgroundColor: '#4CAF50',
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#388E3C' },
                }}
              >
                View & Purchase
              </Button>
            ) : (
              <Button
                variant="contained"
                fullWidth
                onClick={onLoginRequired}
                sx={{
                  backgroundColor: '#4CAF50',
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#388E3C' },
                }}
              >
                Sign In to Purchase
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {/* No fields message */}
      {fields.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            p: 4,
            bgcolor: 'rgba(255,255,255,0.95)',
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" color="text.secondary" mb={1}>
            No fields available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Check back later for new field listings
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PublicMapView;
