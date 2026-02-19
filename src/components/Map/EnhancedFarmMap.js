import React, { useState, useEffect, useCallback, forwardRef, useRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Paper, Checkbox, FormControlLabel, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Chip, alpha } from '@mui/material';
import { HomeWork, Cloud, LocalShipping, Close } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import coinService from '../../services/coinService';
import fieldsService from '../../services/fields';
import { mockProductService } from '../../services/mockServices';
import notificationsService from '../../services/notifications';
import api from '../../services/api';

import { mockOrderService } from '../../services/mockServices';
import rentedFieldsService from '../../services/rentedFields';
import CustomScaleBar from './CustomScaleBar';
import ProductSummaryBar from './ProductSummaryBar';
import { Map as MapboxMap, Marker, NavigationControl, FullscreenControl } from 'react-map-gl';

import { cachedReverseGeocode } from '../../utils/geocoding';
import { getProductIcon, productCategories } from '../../utils/productIcons';
import { orderService } from '../../services/orders';
import 'mapbox-gl/dist/mapbox-gl.css';
import { configureGlobeMap, DARK_MAP_STYLE, GLOBAL_VIEW_MAX_ZOOM } from '../../utils/mapConfig';
import GoogleGlobeMap from './GoogleGlobeMap';
import GoogleMap2DWithWeather from './GoogleMap2DWithWeather';
import './FarmMap.css';
import weatherService from '../../services/weather';
import WebcamPopup from '../Common/WebcamPopup';


// Detect mobile screens
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};



const EnhancedFarmMap = forwardRef(({
  onProductSelect,
  userType,
  user,
  purchasedProductIds = [],
  onFieldCreate,
  searchQuery,
  onFarmsLoad,
  onNotification,
  onNotificationRefresh,
  onCoinRefresh,
  farms: externalFarms,
  fields: externalFields,
  onEditField,
  filters: externalFilters,
  height = '100%',
  embedded = false,
  minimal = false
}, ref) => {
  const mapRef = useRef();
  const googleGlobeRef = useRef(null);
  const googleWeatherMapRef = useRef(null);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isMobile = useIsMobile();
  const isMapAnimatingRef = useRef(false);
  const popupFixedRef = useRef({ left: null, top: null, transform: null });

  const [viewState, setViewState] = useState({
    longitude: 12.5674,
    latitude: 41.8719,
    zoom: 1.1,
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [farms, setFarms] = useState([]);
  const [filteredFarms, setFilteredFarms] = useState([]);
  const [purchasedFarms, setPurchasedFarms] = useState(new Set());
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingError, setShippingError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [selectedHarvestDate, setSelectedHarvestDate] = useState(null);
  const [productLocations, setProductLocations] = useState(new Map());
  const [productWeather, setProductWeather] = useState(new Map());
  const [deliveryMode, setDeliveryMode] = useState('existing');
  const [existingDeliveryAddress, setExistingDeliveryAddress] = useState('');
  const [newDeliveryAddress, setNewDeliveryAddress] = useState({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: ''
  });
  const [orderForSomeoneElse, setOrderForSomeoneElse] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [addressError, setAddressError] = useState('');
  const [showAddressOverlay, setShowAddressOverlay] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const addressSearchTimeoutRef = useRef(null);
  const addressOverlayContentRef = useRef(null);
  const addressLine1Ref = useRef(null);
  const [addressSuggestionsPos, setAddressSuggestionsPos] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [userLocationName, setUserLocationName] = useState('');

  const [userCoins, setUserCoins] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [buyNowInProgress, setBuyNowInProgress] = useState(false);
  const buyNowInProgressRef = useRef(false);
  const lastNonEmptyFarmsRef = useRef([]);
  const hasInitialFlyRef = useRef(false);
  const stablePurchasedIdsRef = useRef(new Set());
  const [purchasedProducts, setPurchasedProducts] = useState([]);
  const [bursts, setBursts] = useState([]);
  const summaryBarRef = useRef(null);
  const [iconTargets, setIconTargets] = useState({});
  const [harvestingIds, setHarvestingIds] = useState(new Set());
  const [weatherLayerEnabled, setWeatherLayerEnabled] = useState(false);

  // Define isProductPurchased early to avoid TDZ errors
  const isProductPurchased = useCallback((prod) => {
    if (!prod) return false;
    if (stablePurchasedIdsRef.current.has(prod.id)) return true;
    const occupied = typeof prod.occupied_area === 'string' ? parseFloat(prod.occupied_area) : prod.occupied_area;
    const purchasedArea = typeof prod.purchased_area === 'string' ? parseFloat(prod.purchased_area) : prod.purchased_area;
    const totalArea = typeof prod.total_area === 'string' ? parseFloat(prod.total_area) : prod.total_area;
    const availableArea = typeof prod.available_area === 'string' ? parseFloat(prod.available_area) : prod.available_area;
    const derived = Boolean(
      prod.isPurchased || prod.is_purchased || prod.purchased ||
      (typeof prod.purchase_status === 'string' && prod.purchase_status.toLowerCase() === 'purchased') ||
      (Number.isFinite(occupied) && occupied > 0) ||
      (Number.isFinite(purchasedArea) && purchasedArea > 0) ||
      (Number.isFinite(totalArea) && Number.isFinite(availableArea) && totalArea > 0 && availableArea < totalArea)
    );
    return derived || purchasedFarms.has(prod.id) || purchasedProductIds.includes(prod.id);
  }, [purchasedFarms, purchasedProductIds]);

  // Function to fetch location for a product
  const fetchLocationForProduct = useCallback(async (product) => {
    if (!product) {
      return;
    }

    const productId = product.id;


    // Use functional update to check current state without dependency
    setProductLocations(prev => {
      // Check if we already have the location for this product
      if (prev.has(productId)) {
        return prev; // Return same state if already exists
      }

      // If product already has a valid location field, use it directly
      if (product.location && product.location !== 'Unknown Location' && !product.location.includes(',')) {
        setProductLocations(current => new Map(current.set(productId, product.location)));
        return prev;
      }

      // Only geocode if we don't have a valid location and have coordinates
      if (!product.coordinates) {
        return prev;
      }

      const [longitude, latitude] = product.coordinates;

      // Fetch location asynchronously only if needed
      (async () => {
        try {
          // Fix: Pass latitude first, then longitude to match the geocoding function signature
          const locationName = await cachedReverseGeocode(latitude, longitude);
          setProductLocations(current => new Map(current.set(productId, locationName)));
        } catch (error) {
          console.error('🌍 Failed to fetch location for product:', productId, error);
          // Set fallback location
          const fallbackLocation = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setProductLocations(current => new Map(current.set(productId, fallbackLocation)));
        }
      })();

      return prev;
    });
  }, []);

  // Function to fetch weather for a product
  const fetchWeatherForProduct = useCallback(async (product) => {
    if (!product || !product.coordinates) {
      return;
    }

    const productId = product.id;
    const [longitude, latitude] = product.coordinates;

    // Check if we already have weather data for this product
    if (productWeather.has(productId)) {
      return;
    }

    try {
      const data = await weatherService.getCurrentWeather(latitude, longitude);
      if (data && data.weatherString) {
        setProductWeather(prev => {
          const next = new Map(prev);
          next.set(productId, data);
          return next;
        });

      } else {
        console.warn(`🌤️ No weather data returned for ${productId}. Verify Key in .env and RESTART server.`);
      }
    } catch (error) {
      console.error('🌤️ Failed to fetch weather:', error);
    }
  }, [productWeather]);

  const handleProductClick = useCallback((event, product) => {
    if (event) event.stopPropagation();

    // Use functional update to avoid stale state issues
    setSelectedProduct(prevSelected => {
      // If clicking the same product, close the popup
      if (prevSelected && prevSelected.id === product.id) {
        return null;
      }
      return product;
    });

    setSelectedShipping(null);
    setQuantity(1);
    setInsufficientFunds(false);
    setSelectedHarvestDate(null);
    setPopupTab('details');
    const availBuy = product.available_for_buy !== false && product.available_for_buy !== 'false';
    // Rent disabled for now – only buy
    // const availRent = product.available_for_rent === true || product.available_for_rent === 'true';
    // const hasRentPrice = product.rent_price_per_month != null && product.rent_price_per_month !== '' && !isNaN(parseFloat(product.rent_price_per_month));
    // const hasRentDuration = (product.rent_duration_monthly === true || product.rent_duration_monthly === 'true') || (product.rent_duration_quarterly === true || product.rent_duration_quarterly === 'true') || (product.rent_duration_yearly === true || product.rent_duration_yearly === 'true');
    // const canRent = availRent && hasRentPrice && hasRentDuration;
    setPurchaseMode('buy');
    // if (canRent) { if (product.rent_duration_monthly === true || product.rent_duration_monthly === 'true') setRentDuration('monthly'); else if (product.rent_duration_quarterly === true || product.rent_duration_quarterly === 'true') setRentDuration('quarterly'); else if (product.rent_duration_yearly === true || product.rent_duration_yearly === 'true') setRentDuration('yearly'); }
    const alreadyPurchased = isProductPurchased(product);
    setShowPurchaseUI(!alreadyPurchased);


    if (product.coordinates) {
      const lat = Array.isArray(product.coordinates) ? product.coordinates[1] : product.coordinates?.lat;
      const lng = Array.isArray(product.coordinates) ? product.coordinates[0] : product.coordinates?.lng;
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        if (weatherLayerEnabled && googleWeatherMapRef.current?.flyTo) {
          googleWeatherMapRef.current.flyTo({ center: [lng, lat], zoom: 8 });
        } else if (googleGlobeRef.current?.flyTo) {
          googleGlobeRef.current.flyTo(lat, lng, 7);
        }
        const map = mapRef.current && typeof mapRef.current.getMap === 'function' ? mapRef.current.getMap() : null;
        if (map && !weatherLayerEnabled) {
          isMapAnimatingRef.current = true;
          popupFixedRef.current = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
          setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
          map.flyTo({
            center: product.coordinates,
            zoom: 8,
            duration: 1200,
            essential: true,
            offset: [0, -(isMobile ? 160 : 200)],
            easing: (t) => t * (2 - t)
          });
          map.once('moveend', () => {
            isMapAnimatingRef.current = false;
            setViewState({
              longitude: map.getCenter().lng,
              latitude: map.getCenter().lat,
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch()
            });
            setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
          });
        }
      }
    }

    // Fetch location and weather for the selected product
    fetchLocationForProduct(product);
    fetchWeatherForProduct(product);

    if (onProductSelect) {
      onProductSelect(product);
    }
  }, [onProductSelect, fetchLocationForProduct, fetchWeatherForProduct, isMobile, isProductPurchased, weatherLayerEnabled]);
  const [selectedIcons, setSelectedIcons] = useState(new Set());
  const [showPurchaseUI, setShowPurchaseUI] = useState(true);
  const celebratedHarvestIdsRef = useRef(new Set());
  const burstsLayerRef = useRef(null);
  const [harvestGifs, setHarvestGifs] = useState([]);
  const harvestLayerRef = useRef(null);
  const harvestGifShownRef = useRef(false);
  const [showHarvestGifIds, setShowHarvestGifIds] = useState(new Set());
  const harvestGifSize = 65;
  const [deliveryTodayCards, setDeliveryTodayCards] = useState([]);
  const deliveryFlyLayerRef = useRef(null);
  const [deliveryFlyCards, setDeliveryFlyCards] = useState([]);
  const deliveryAnimatedIdsRef = useRef(new Set());
  const [showDeliveryPanel, setShowDeliveryPanel] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryList, setDeliveryList] = useState([]);
  const [deliveryListLoading, setDeliveryListLoading] = useState(false);
  const [deliveryRoleTab, setDeliveryRoleTab] = useState('buyer'); // 'buyer' | 'farmer'
  const deliveryIconRef = useRef(null);
  const [deliveryPanelLeft, setDeliveryPanelLeft] = useState(54);
  const [fieldOrderStats, setFieldOrderStats] = useState(new Map());
  const [popupTab, setPopupTab] = useState('details');
  const [purchaseMode, setPurchaseMode] = useState('buy'); // 'buy' | 'rent' – rent only for farmers
  const [rentDuration, setRentDuration] = useState('monthly'); // 'monthly' | 'quarterly' | 'yearly' – used when rent is selected
  const [rentInProgress, setRentInProgress] = useState(false);
  const [webcamPopupOpen, setWebcamPopupOpen] = useState(false);
  const [selectedFarmForWebcam, setSelectedFarmForWebcam] = useState(null);
  const popupContentScrollRef = useRef(null);

  // Add state for currency conversion
  const [coinsPerUnit, setCoinsPerUnit] = useState(10); // Default to 10 based on current logic

  // Fetch currency rates on mount
  useEffect(() => {
    let mounted = true;
    const fetchRates = async () => {
      try {
        const data = await coinService.getCurrencyRates();
        if (mounted && data.rates) {
          // Find USD rate or fallback to first rate
          const usdRate = data.rates.find(r => r.currency === 'USD') || data.rates[0];
          if (usdRate && usdRate.coins_per_unit) {
            setCoinsPerUnit(parseFloat(usdRate.coins_per_unit));
          }
        }
      } catch (err) {
        console.error('Failed to load currency rates:', err);
      }
    };
    fetchRates();
    return () => { mounted = false; };
  }, []);

  const extractCityCountry = useCallback((s) => {
    const parts = String(s || '').split(',').map(x => x.trim()).filter(Boolean);
    const city = (parts[0] || '').toLowerCase();
    const country = (parts[parts.length - 1] || '').toLowerCase();
    return { city, country };
  }, []);

  useEffect(() => {
    setShowDeliveryPanel(false);
  }, []);

  const fetchDeliveryList = useCallback(async () => {
    if (!currentUser?.id) return;
    setDeliveryListLoading(true);
    setDeliveryList([]);
    try {
      const res = await api.get('/api/deliveries/my');
      const data = res?.data || {};

      const flattenRoleGroup = (group, roleLabel) => {
        if (!group) return [];
        const { upcoming = [], current = [], past = [] } = group;
        const tag = (items, bucket) =>
          (Array.isArray(items) ? items : []).map((o) => ({ ...o, _bucket: bucket, _role: roleLabel }));
        return [
          ...tag(upcoming, 'upcoming'),
          ...tag(current, 'current'),
          ...tag(past, 'past'),
        ];
      };

      const merged = [
        ...flattenRoleGroup(data.buyer, 'buyer'),
        ...flattenRoleGroup(data.farmer, 'farmer'),
      ];

      const list = merged.map((o) => {
        const notes = String(o.notes || '');
        const addrMatch = notes.match(/(?:Address|Deliver to):\s*(.+?)(?:\s*\||$)/i);
        const deliveryAddress = addrMatch ? addrMatch[1].trim() : '';
        const dateRaw = o.selected_harvest_date || o.created_at;
        const harvestDate = dateRaw || '';
        const productName = o.field_name || o.field?.name || 'Order';
        return {
          id: o.id,
          productName,
          harvestDate,
          status: o.status || 'pending',
          deliveryAddress,
          role: o._role,
          bucket: o._bucket,
          order: o,
        };
      });

      const orderBucket = { upcoming: 0, current: 1, past: 2 };
      list.sort((a, b) => {
        const ba = orderBucket[a.bucket] ?? 1;
        const bb = orderBucket[b.bucket] ?? 1;
        if (ba !== bb) return ba - bb;
        return String(b.harvestDate || '').localeCompare(String(a.harvestDate || ''));
      });

      setDeliveryList(list);
    } catch (err) {
      console.warn('Delivery list fetch failed:', err);
      setDeliveryList([]);
    } finally {
      setDeliveryListLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (showDeliveryModal) fetchDeliveryList();
  }, [showDeliveryModal, fetchDeliveryList]);

  useEffect(() => {
    if (!showDeliveryPanel) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const mapRect = map.getContainer().getBoundingClientRect();
    const iconRect = deliveryIconRef.current?.getBoundingClientRect();
    const cardWidth = isMobile ? 60 : 72;
    const margin = 12;
    let left = 54;
    if (iconRect) left = (iconRect.right - mapRect.left) + margin;
    const maxLeft = Math.max(margin, mapRect.width - cardWidth - margin);
    if (!Number.isFinite(left)) left = 54;
    setDeliveryPanelLeft(Math.max(margin, Math.min(maxLeft, left)));
  }, [showDeliveryPanel, isMobile, viewState]);

  const renderWeatherTabContent = () => {
    if (!selectedProduct) return null;
    const weather = productWeather.get(String(selectedProduct.id));

    // Fallback UI if data is still loading or unavailable
    if (!weather || typeof weather === 'string') {
      return (
        <div style={{ padding: '16px 8px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '20px', marginBottom: '8px', animation: 'popupPulse 1.5s infinite alternate ease-in-out' }}>🌤️</div>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>Fetching weather...</div>
        </div>
      );
    }

    return (
      <div style={{ animation: 'cardSlideIn 0.4s ease-out' }}>
        {/* Compact Weather Summary */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
              alt="weather"
              style={{ width: '40px', height: '40px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
            />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{weather.temperature.toFixed(1)}°C</div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, textTransform: 'capitalize' }}>{weather.description}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Feels Like</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>{weather.feelsLike.toFixed(1)}°C</div>
          </div>
        </div>

        {/* Dense Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Humidity', value: `${weather.humidity}%`, icon: '💧' },
            { label: 'Wind', value: `${weather.windSpeed}m/s`, icon: '💨' },
            { label: 'Pressure', value: `${weather.pressure}hPa`, icon: '⏲️' },
            { label: 'Visibility', value: `${(weather.visibility / 1000).toFixed(1)}km`, icon: '👁️' },
          ].map((item, idx) => (
            <div key={idx} style={{
              background: '#ffffff',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '12px' }}>{item.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPopupTabs = () => (
    <div style={{
      display: 'flex',
      backgroundColor: '#f1f5f9',
      borderRadius: '6px',
      padding: '2px',
      marginBottom: '12px',
      border: '1px solid #e2e8f0'
    }}>
      {['details', 'weather'].map((tab) => (
        <div
          key={tab}
          onClick={() => setPopupTab(tab)}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '6px 0',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '4px',
            color: popupTab === tab ? '#0f172a' : '#64748b',
            backgroundColor: popupTab === tab ? '#ffffff' : 'transparent',
            boxShadow: popupTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {tab}
        </div>
      ))}
    </div>
  );

  const toFiniteNumber = useCallback((v) => {

    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : null;
  }, []);

  const normalizeNameKey = useCallback((s) => {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  }, []);

  const toISODate = useCallback((raw) => {
    if (!raw) return null;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return typeof raw === 'string' ? raw : null;
      return d.toISOString().slice(0, 10);
    } catch {
      return typeof raw === 'string' ? raw : null;
    }
  }, []);

  useEffect(() => {
    const useOrderStats = Boolean(minimal && userType === 'admin');
    if (!useOrderStats) return;

    let cancelled = false;

    const run = async () => {
      const nameToId = new Map(
        (Array.isArray(farms) ? farms : [])
          .filter(f => f?.id != null)
          .map(f => [normalizeNameKey(f.name || f.product_name || f.title), String(f.id)])
          .filter(([k]) => Boolean(k))
      );

      const unwrapList = (data) => {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.orders)) return data.orders;
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.data)) return data.data;
        if (Array.isArray(data?.result)) return data.result;
        return [];
      };

      const tryGet = async (fn) => {
        try {
          const res = await fn();
          const list = unwrapList(res?.data);
          return list;
        } catch {
          return null;
        }
      };

      const tryGetApi = async (path) => {
        return tryGet(() => api.get(path));
      };

      let orders =
        (await tryGetApi('/api/orders')) ??
        (await tryGetApi('/api/admin/orders')) ??
        (await tryGetApi('/api/orders/all')) ??
        (await tryGetApi('/api/orders?scope=all')) ??
        (await tryGet(() => orderService.getBuyerOrders())) ??
        null;

      if (!orders) {
        const rentals =
          (await tryGet(() => rentedFieldsService.getAll())) ??
          null;
        if (rentals) {
          orders = rentals.map((r) => ({
            field_id: r.field_id ?? r.fieldId ?? r.field?.id ?? r.fieldId,
            field_name: r.field_name ?? r.fieldName ?? r.field?.name,
            product_name: r.product_name ?? r.productName ?? r.field?.name,
            name: r.name ?? r.field_name ?? r.field_name ?? r.fieldName,
            quantity: r.quantity ?? r.area_rented ?? r.area ?? r.area_m2 ?? r.rented_area ?? r.rented_m2,
            start_date: r.start_date ?? r.startDate ?? r.created_at ?? r.createdAt,
            end_date: r.end_date ?? r.endDate,
            status: r.status ?? 'active'
          }));
        }
      }

      if (!orders) {
        const res2 = await mockOrderService.getBuyerOrders().catch(() => null);
        orders = unwrapList(res2?.data);
      }
      if (!orders) orders = [];

      const stats = new Map();
      for (const o of orders) {
        const status = String(o?.status || '').toLowerCase();
        if (status === 'cancelled') continue;

        const qty = toFiniteNumber(o?.quantity ?? o?.area_rented ?? o?.area ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const fidRaw = o?.field_id ?? o?.fieldId ?? o?.field?.id ?? o?.field?.field_id;
        const fid = fidRaw != null ? String(fidRaw) : null;
        const nameKey = normalizeNameKey(
          o?.field_name ||
          o?.field?.name ||
          o?.product_name ||
          o?.name ||
          o?.fieldName ||
          o?.productName
        );
        const key = fid || (nameKey ? nameToId.get(nameKey) : null);
        if (!key) continue;

        const prev = stats.get(key) || { rented_area: 0, start_date: null, end_date: null };
        prev.rented_area += qty;

        const start = toISODate(o?.start_date ?? o?.startDate);
        const end = toISODate(o?.end_date ?? o?.endDate);
        const prevStart = prev.start_date;
        const prevEnd = prev.end_date;
        const ts = (d) => {
          if (!d) return null;
          const dd = new Date(d);
          return isNaN(dd.getTime()) ? null : dd.getTime();
        };
        const startTs = ts(start);
        const prevStartTs = ts(prevStart);
        if (start && (prevStartTs == null || (startTs != null && startTs < prevStartTs))) prev.start_date = start;

        const endTs = ts(end);
        const prevEndTs = ts(prevEnd);
        if (end && (prevEndTs == null || (endTs != null && endTs > prevEndTs))) prev.end_date = end;

        stats.set(key, prev);
      }

      if (cancelled) return;
      setFieldOrderStats(stats);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [minimal, userType, farms, normalizeNameKey, toFiniteNumber, toISODate]);
  const canonicalizeCategory = useCallback((raw) => {
    const s = raw ? raw.toString().trim() : '';
    let slug = s.toLowerCase().replace(/[\s_]+/g, '-');
    const compact = slug.replace(/-/g, '');
    const synonyms = {
      greenapple: 'green-apple',
      redapple: 'red-apple',
      lemons: 'lemon',
      tangarine: 'tangerine',
      tangerines: 'tangerine',
      corns: 'corn',
      strawberries: 'strawberry',
      tomatoes: 'tomato',
      eggplants: 'eggplant',
      peaches: 'peach',
      watermelons: 'watermelon'
    };
    const syn = synonyms[compact] || slug;
    const match = productCategories.find(c => c.key === syn || c.name.toLowerCase() === s.toLowerCase());
    const name = match ? match.name : s || syn;
    const key = match ? match.key : syn;
    return { name, key };
  }, []);
  // Resource bar: only user's purchased/rented; values = total yield (kg) so user can avoid buying too much or not enough
  const purchasedSummary = React.useMemo(() => {
    const orders = new Map();
    purchasedProducts.forEach(p => {
      const rawKey = p.subcategory || p.category || p.category_key || p.id;
      const canon = canonicalizeCategory(rawKey);
      const k = canon.key;
      if (!k) return;
      const paRaw = p.purchased_area ?? p.quantity ?? p.area_rented;
      const pa = typeof paRaw === 'string' ? parseFloat(paRaw) : paRaw || 0;
      const fieldId = p.id ?? p.field_id;
      const field = Array.isArray(farms) && fieldId != null
        ? farms.find(f => String(f.id) === String(fieldId))
        : null;
      const rateRaw = field?.production_rate ?? field?.productionRate;
      const rate = typeof rateRaw === 'string' ? parseFloat(rateRaw) : (rateRaw ?? 0);
      const totalAreaRaw = field?.total_area ?? field?.field_size;
      const totalArea = typeof totalAreaRaw === 'string' ? parseFloat(totalAreaRaw) : (totalAreaRaw ?? 0);
      const unit = (field?.production_rate_unit ?? field?.productionRateUnit ?? 'Kg').toString().toLowerCase();
      const isPerM2 = /m\s*2|m²|per\s*m|per\s*unit/.test(unit);
      let userKg = 0;
      if (Number.isFinite(rate) && rate >= 0) {
        if (isPerM2) {
          userKg = Number.isFinite(pa) ? pa * rate : 0;
        } else {
          userKg = (Number.isFinite(totalArea) && totalArea > 0 && Number.isFinite(pa))
            ? (pa / totalArea) * rate
            : 0;
        }
      }
      const prev = orders.get(k) || { id: k, category: canon.name, purchased_area: 0, total_kg: 0 };
      orders.set(k, {
        id: k,
        category: prev.category,
        purchased_area: prev.purchased_area + pa,
        total_kg: prev.total_kg + userKg
      });
    });
    return Array.from(orders.values()).filter(item => {
      const purchasedArea = typeof item.purchased_area === 'string' ? parseFloat(item.purchased_area) : (item.purchased_area || 0);
      return Number.isFinite(purchasedArea) && purchasedArea > 0;
    });
  }, [purchasedProducts, farms, canonicalizeCategory]);
  // const getCenterFromCoords = useCallback((coordinates) => {
  //   if (!coordinates || coordinates.length === 0) return [viewState.longitude, viewState.latitude];
  //   const lngs = coordinates.map(c => c[0]);
  //   const lats = coordinates.map(c => c[1]);
  //   const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  //   const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  //   return [avgLng, avgLat];
  // }, [viewState.longitude, viewState.latitude]);
  // const mergeById = useCallback((a, b) => {
  //   const map = new Map();
  //   [...a, ...b].forEach(item => {
  //     if (item && item.id != null) map.set(item.id, item);
  //   });
  //   return Array.from(map.values());
  // }, []);

  const fetchAddressSuggestions = useCallback(async (query) => {
    const q = (query || '').trim();
    if (!q) { setAddressSuggestions([]); return; }
    // setAddressSearchLoading(true);
    try {
      if (process.env.REACT_APP_MAPBOX_ACCESS_TOKEN) {
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}`);
        const data = await resp.json();
        let results = Array.isArray(data?.features) ? data.features.map(f => ({
          name: f.text,
          formatted_address: f.place_name,
          context: f.context || [],
        })) : [];
        const scopeRaw = selectedProduct?.shipping_scope || selectedProduct?.shippingScope || 'Global';
        const scope = String(scopeRaw || '').toLowerCase();
        if (orderForSomeoneElse && scope !== 'global' && selectedProduct) {
          const locStr = productLocations.get(selectedProduct.id) || selectedProduct.location || '';
          const p = extractCityCountry(locStr);
          if (scope === 'city' && p.city) {
            const cityLower = p.city.toLowerCase();
            results = results.filter(r => {
              const place = (r.context || []).find(c => typeof c.id === 'string' && c.id.startsWith('place'));
              const txt = (place?.text || '').toLowerCase();
              return txt === cityLower;
            });
          } else if (scope === 'country' && p.country) {
            const countryLower = p.country.toLowerCase();
            results = results.filter(r => {
              const country = (r.context || []).find(c => typeof c.id === 'string' && c.id.startsWith('country'));
              const txt = (country?.text || '').toLowerCase();
              return txt === countryLower;
            });
          }
        }
        setAddressSuggestions(results);
      } else {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`, { headers: { 'User-Agent': 'ShareCrop-Frontend/1.0' } });
        const data = await resp.json();
        let results = Array.isArray(data) ? data.map(it => ({
          name: it.display_name?.split(',')[0] || it.display_name || q,
          formatted_address: it.display_name || q,
          address: it.address || {},
        })) : [];
        const scopeRaw = selectedProduct?.shipping_scope || selectedProduct?.shippingScope || 'Global';
        const scope = String(scopeRaw || '').toLowerCase();
        if (orderForSomeoneElse && scope !== 'global' && selectedProduct) {
          const locStr = productLocations.get(selectedProduct.id) || selectedProduct.location || '';
          const p = extractCityCountry(locStr);
          if (scope === 'city' && p.city) {
            const cityLower = p.city.toLowerCase();
            results = results.filter(r => {
              const adr = r.address || {};
              const txt = (adr.city || adr.town || adr.village || '').toLowerCase();
              return txt === cityLower;
            });
          } else if (scope === 'country' && p.country) {
            const countryLower = p.country.toLowerCase();
            results = results.filter(r => {
              const adr = r.address || {};
              const txt = (adr.country || '').toLowerCase();
              return txt === countryLower;
            });
          }
        }
        setAddressSuggestions(results);
      }
    } catch (e) {
      setAddressSuggestions([]);
    } finally {
      // setAddressSearchLoading(false);
    }
  }, [orderForSomeoneElse, selectedProduct, productLocations, extractCityCountry]);

  const applyAddressSelection = useCallback((place) => {
    let city = newDeliveryAddress.city;
    let state = newDeliveryAddress.state;
    let zip = newDeliveryAddress.zip;
    let country = newDeliveryAddress.country;
    if (place.context && Array.isArray(place.context)) {
      const pick = (prefix) => {
        const item = place.context.find(c => typeof c.id === 'string' && c.id.startsWith(prefix));
        return item ? (item.text || '') : '';
      };
      city = pick('place') || city;
      state = pick('region') || state;
      country = pick('country') || country;
      zip = pick('postcode') || zip;
    }
    if (place.address && typeof place.address === 'object') {
      city = place.address.city || place.address.town || place.address.village || city;
      state = place.address.state || state;
      country = place.address.country || country;
      zip = place.address.postcode || zip;
    }
    setNewDeliveryAddress({
      ...newDeliveryAddress,
      line1: place.formatted_address || place.name || newDeliveryAddress.line1,
      city,
      state,
      zip,
      country,
    });
    setAddressSuggestions([]);
    setAddressError('');
  }, [newDeliveryAddress]);

  useEffect(() => {
    if (!showAddressOverlay || addressSuggestions.length === 0) { setAddressSuggestionsPos(null); return; }
    const container = addressOverlayContentRef.current;
    const target = addressLine1Ref.current;
    if (!container || !target) return;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    setAddressSuggestionsPos({
      top: (tRect.bottom - cRect.top) + (isMobile ? 6 : 8),
      left: (tRect.left - cRect.left),
      width: tRect.width,
    });
  }, [addressSuggestions, showAddressOverlay, isMobile]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!showAddressOverlay) return;
      const container = addressOverlayContentRef.current;
      const inputEl = addressLine1Ref.current;
      if (!container || !inputEl) return;
      if (!container.contains(e.target) && !inputEl.contains(e.target)) {
        setAddressSuggestions([]);
        setAddressSuggestionsPos(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddressOverlay]);
  // Helper function to check if an item should be filtered out based on occupied area
  // Only filter out items where we explicitly know occupied area is 0
  // If occupied area is undefined/null, we should still show the item
  const shouldFilterOutByOccupiedArea = useCallback((f) => {
    const occRaw = f.occupied_area ?? f.purchased_area ?? f.area_occupied ?? f.occupied_m2 ?? f.occupied ?? f.area_rented ?? f.rented_area;
    // If no occupied area field exists at all, don't filter it out
    if (occRaw === undefined || occRaw === null) return false;
    const occupied = typeof occRaw === 'string' ? parseFloat(occRaw) : occRaw;
    // Only filter out if we have a valid number that is exactly 0
    return Number.isFinite(occupied) && occupied === 0;
  }, []);

  const normalizeField = useCallback((f) => {
    const co = f.coordinates;
    let lng;
    let lat;
    if (Array.isArray(co) && co.length >= 2) {
      lng = typeof co[0] === 'string' ? parseFloat(co[0]) : co[0];
      lat = typeof co[1] === 'string' ? parseFloat(co[1]) : co[1];
    } else if (co && typeof co === 'object') {
      lng = co.lng ?? co.longitude;
      lat = co.lat ?? co.latitude;
      lng = typeof lng === 'string' ? parseFloat(lng) : lng;
      lat = typeof lat === 'string' ? parseFloat(lat) : lat;
    } else if (typeof co === 'string') {
      const s = co.trim();
      if (s.startsWith('[') || s.startsWith('{')) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            lng = typeof parsed[0] === 'string' ? parseFloat(parsed[0]) : parsed[0];
            lat = typeof parsed[1] === 'string' ? parseFloat(parsed[1]) : parsed[1];
          } else if (parsed && typeof parsed === 'object') {
            lng = parsed.lng ?? parsed.longitude;
            lat = parsed.lat ?? parsed.latitude;
            lng = typeof lng === 'string' ? parseFloat(lng) : lng;
            lat = typeof lat === 'string' ? parseFloat(lat) : lat;
          }
        } catch {
          const parts = s.split(',').map(x => x.trim());
          if (parts.length >= 2) {
            const a = parseFloat(parts[0]);
            const b = parseFloat(parts[1]);
            if (Number.isFinite(a) && Number.isFinite(b)) {
              lat = a;
              lng = b;
            }
          }
        }
      } else {
        const parts = s.split(',').map(x => x.trim());
        if (parts.length >= 2) {
          const a = parseFloat(parts[0]);
          const b = parseFloat(parts[1]);
          if (Number.isFinite(a) && Number.isFinite(b)) {
            lat = a;
            lng = b;
          }
        }
      }
    }
    if ((lng == null || lat == null) && (f.longitude != null && f.latitude != null)) {
      lng = typeof f.longitude === 'string' ? parseFloat(f.longitude) : f.longitude;
      lat = typeof f.latitude === 'string' ? parseFloat(f.latitude) : f.latitude;
    }
    const coords = Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
    const occCandidateRaw = f.occupied_area ?? f.purchased_area ?? f.area_occupied ?? f.occupied_m2 ?? f.occupied ?? f.area_rented ?? f.rented_area;
    const occupied = typeof occCandidateRaw === 'string' ? parseFloat(occCandidateRaw) : occCandidateRaw;
    const purchasedAreaRaw = f.purchased_area ?? f.area_rented ?? f.rented_area;
    const purchasedArea = typeof purchasedAreaRaw === 'string' ? parseFloat(purchasedAreaRaw) : purchasedAreaRaw;
    const areaCandidateRaw = f.total_area ?? f.field_size ?? f.area_m2 ?? f.field_size_area ?? f.area_size;
    const totalArea = typeof areaCandidateRaw === 'string' ? parseFloat(areaCandidateRaw) : areaCandidateRaw;
    const availCandidateRaw = f.available_area ?? f.available_m2 ?? f.area_available;
    const availableArea = typeof availCandidateRaw === 'string' ? parseFloat(availCandidateRaw) : availCandidateRaw;
    const isPurchasedDerived = Boolean(
      f.isPurchased || f.is_purchased || f.purchased ||
      (typeof f.purchase_status === 'string' && f.purchase_status.toLowerCase() === 'purchased') ||
      (Number.isFinite(occupied) && occupied > 0) ||
      (Number.isFinite(purchasedArea) && purchasedArea > 0) ||
      (Number.isFinite(totalArea) && Number.isFinite(availableArea) && totalArea > 0 && availableArea < totalArea)
    );
    return {
      ...f,
      name: f.name ?? f.farm_name ?? f.product_name ?? f.title ?? 'Unnamed Field',
      coordinates: coords ?? f.coordinates,
      total_area: Number.isFinite(totalArea) ? totalArea : f.total_area,
      field_size: Number.isFinite(totalArea) ? totalArea : f.field_size,
      occupied_area: Number.isFinite(occupied) ? occupied : f.occupied_area,
      purchased_area: Number.isFinite(purchasedArea) ? purchasedArea : f.purchased_area,
      available_area: Number.isFinite(availableArea) ? availableArea : f.available_area,
      isPurchased: isPurchasedDerived,
      shipping_scope: f.shipping_scope ?? f.shippingScope ?? 'Global'
    };
  }, []);

  useEffect(() => {
    if (!userPosition && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPosition({ latitude, longitude });
          cachedReverseGeocode(latitude, longitude)
            .then((name) => setUserLocationName(name))
            .catch(() => { });
        },
        () => { }
      );
    }
  }, [userPosition]);

  const isDeliveryAllowed = useCallback((prod) => {
    if (!prod) return false;
    const scopeRaw = prod.shipping_scope || prod.shippingScope || 'Global';
    const scope = String(scopeRaw || '').toLowerCase();
    if (scope === 'global') return true;
    const prodLocStr = productLocations.get(prod.id) || prod.location || '';
    const p = extractCityCountry(prodLocStr);
    if (orderForSomeoneElse) return true;
    const userLocStr = userLocationName || (currentUser?.location || user?.location || '');
    const u = extractCityCountry(userLocStr);
    if (scope === 'country') return Boolean(p.country && u.country && p.country === u.country);
    if (scope === 'city') return Boolean(p.city && u.city && p.city === u.city);
    return false;
  }, [productLocations, orderForSomeoneElse, userLocationName, currentUser, user, extractCityCountry]);

  const triggerBurst = useCallback((product, qty) => {
    if (!mapRef.current || !product?.coordinates) return;
    const map = mapRef.current.getMap();
    const [lng, lat] = product.coordinates;
    const pt = map.project([lng, lat]);
    const mapRect = map.getContainer().getBoundingClientRect();
    const layerRect = burstsLayerRef.current?.getBoundingClientRect() || mapRect;
    const barRect = summaryBarRef.current?.getBoundingClientRect();
    const src = getProductIcon(product?.subcategory || product?.category);
    const targetPos = iconTargets && iconTargets[src] ? iconTargets[src] : null;
    const baseX = mapRect.left + pt.x - layerRect.left;
    const baseY = mapRect.top + pt.y - layerRect.top;
    const targetX = targetPos
      ? (targetPos.x - layerRect.left)
      : (barRect ? ((barRect.left + barRect.width / 2) - layerRect.left) : baseX);
    const targetY = targetPos
      ? (targetPos.y - layerRect.top)
      : (barRect ? ((barRect.top + barRect.height / 2) - layerRect.top) : baseY + 120);
    const durationMs = 3800;
    const intervalMs = 200;
    const total = Math.min(16, Math.max(10, Math.floor(durationMs / intervalMs)));
    setHarvestingIds(prev => {
      const next = new Set(prev);
      next.add(product.id);
      return next;
    });
    setTimeout(() => {
      setHarvestingIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, durationMs);
    const nowBase = Date.now();
    for (let i = 0; i < total; i++) {
      const t = i * intervalMs;
      setTimeout(() => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * 45;
        const popX = baseX + Math.cos(angle) * radius;
        const popY = baseY + Math.sin(angle) * radius;
        const id = `${product.id}-${nowBase}-${i}-${Math.random().toString(36).slice(2)}`;
        const rot = Math.floor(Math.random() * 40) - 20;
        const particle = {
          id,
          src,
          x: baseX,
          y: baseY,
          tx: targetX + (Math.random() * 40 - 20),
          ty: targetY + (Math.random() * 10 - 5),
          px: popX,
          py: popY,
          mx: (baseX + targetX) / 2 + (Math.random() * 40 - 20),
          my: (baseY + targetY) / 2 - (40 + Math.random() * 30),
          rot,
          stage: 'pop',
          expire: Date.now() + 3800
        };
        setBursts(prev => [...prev, particle]);
        setTimeout(() => {
          setBursts(prev => prev.map(p => p.id === id ? { ...p, stage: 'toMid' } : p));
        }, 650);
        setTimeout(() => {
          setBursts(prev => prev.map(p => p.id === id ? { ...p, stage: 'toBar' } : p));
        }, 1500);
        setTimeout(() => {
          setBursts(prev => prev.map(p => p.id === id ? { ...p, stage: 'fall' } : p));
        }, 2300);
        setTimeout(() => {
          setBursts(prev => prev.filter(p => p.id !== id));
        }, 3200);
      }, t);
    }
  }, [iconTargets]);

  // const triggerConfettiBurst = useCallback((product) => {
  //   if (!mapRef.current || !product?.coordinates) return;
  //   const map = mapRef.current.getMap();
  //   const [lng, lat] = product.coordinates;
  //   const pt = map.project([lng, lat]);
  //   const mapRect = map.getContainer().getBoundingClientRect();
  //   const layerRect = burstsLayerRef.current?.getBoundingClientRect() || mapRect;
  //   const src = '/icons/effects/confetti.png';
  //   const durationMs = 3200;
  //   const intervalMs = 180;
  //   const total = Math.min(18, Math.max(12, Math.floor(durationMs / intervalMs)));
  //   const baseX = mapRect.left + pt.x - layerRect.left;
  //   const baseY = mapRect.top + pt.y - layerRect.top;
  //   setHarvestingIds(prev => {
  //     const next = new Set(prev);
  //     next.add(product.id);
  //     return next;
  //   });
  //   setTimeout(() => {
  //     setHarvestingIds(prev => {
  //       const next = new Set(prev);
  //       next.delete(product.id);
  //       return next;
  //     });
  //   }, durationMs);
  //   const nowBase = Date.now();
  //   for (let i = 0; i < total; i++) {
  //     const t = i * intervalMs;
  //     setTimeout(() => {
  //       const angle = Math.random() * Math.PI * 2;
  //       const radius = 50 + Math.random() * 55;
  //       const popX = baseX + Math.cos(angle) * radius;
  //       const popY = baseY + Math.sin(angle) * radius;
  //       const id = `${product.id}-conf-${nowBase}-${i}-${Math.random().toString(36).slice(2)}`;
  //       const rot = Math.floor(Math.random() * 80) - 40;
  //       const particle = {
  //         id,
  //         src,
  //         x: baseX,
  //         y: baseY,
  //         tx: baseX,
  //         ty: baseY + 12,
  //         px: popX,
  //         py: popY,
  //         mx: (baseX + popX) / 2,
  //         my: (baseY + popY) / 2,
  //         rot,
  //         stage: 'pop',
  //         expire: Date.now() + 3000
  //       };
  //       setBursts(prev => [...prev, particle]);
  //       setTimeout(() => {
  //         setBursts(prev => prev.map(p => p.id === id ? { ...p, stage: 'toMid' } : p));
  //       }, 550);
  //       setTimeout(() => {
  //         setBursts(prev => prev.map(p => p.id === id ? { ...p, stage: 'toBar' } : p));
  //       }, 1200);
  //       setTimeout(() => {
  //         setBursts(prev => prev.map(p => p.id === id ? { ...p, stage: 'fall' } : p));
  //       }, 2000);
  //       setTimeout(() => {
  //         setBursts(prev => prev.filter(p => p.id !== id));
  //       }, 2800);
  //     }, t);
  //   }
  // }, []);

  const isHarvestToday = useCallback((f) => {
    const today = new Date();
    const toDate = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
      const s = String(val);
      const parts = s.split(/[-/ ]/);
      if (parts.length >= 3) {
        const tryStr = `${parts[0]} ${parts[1]} ${parts[2]}`;
        const d2 = new Date(tryStr);
        if (!isNaN(d2.getTime())) return d2;
      }
      return null;
    };
    const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const list = Array.isArray(f.harvestDates) ? f.harvestDates : Array.isArray(f.harvest_dates) ? f.harvest_dates : [];
    for (const hd of list) {
      const d = toDate(hd?.date || hd);
      if (sameDay(d, today)) return true;
    }
    const single = f.harvest_date || f.harvestDate;
    const d = toDate(single);
    return sameDay(d, today);
  }, []);

  const refreshHarvestGifOverlays = useCallback(() => {
    if (!mapRef.current) return;
    if (harvestGifShownRef.current) return;
    const map = mapRef.current.getMap();
    const mapRect = map.getContainer().getBoundingClientRect();
    const layerRect = harvestLayerRef.current?.getBoundingClientRect() || mapRect;
    const size = 65;
    const items = farms
      .filter(f => f && f.id && f.coordinates && isHarvestToday(f))
      .map(f => {
        let lng, lat;
        if (Array.isArray(f.coordinates)) {
          lng = f.coordinates[0];
          lat = f.coordinates[1];
        } else if (typeof f.coordinates === 'object') {
          lng = f.coordinates.lng || f.coordinates.longitude;
          lat = f.coordinates.lat || f.coordinates.latitude;
        }
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        const pt = map.project([lng, lat]);
        const x = mapRect.left + pt.x - layerRect.left;
        const y = mapRect.top + pt.y - layerRect.top;
        return { id: f.id, x, y, size, src: '/icons/effects/fric.gif', expire: Date.now() + 7000 };
      })
      .filter(Boolean);
    setHarvestGifs(items);
    // Mark as shown for this page load to avoid repeated overlays
    harvestGifShownRef.current = true;
    items.forEach(item => {
      setTimeout(() => {
        setHarvestGifs(prev => prev.filter(p => p.id !== item.id));
      }, 9200);
    });
  }, [farms, isHarvestToday]);

  // Note: Do not persist across reloads. GIFs should show once per page load.

  // Show harvest GIF once per reload directly at marker positions
  useEffect(() => {
    if (harvestGifShownRef.current) return;
    if (!Array.isArray(farms) || farms.length === 0) return;
    const readyIds = farms.filter(f => f && f.id && isHarvestToday(f)).map(f => f.id);
    if (readyIds.length === 0) return;
    setShowHarvestGifIds(new Set(readyIds));
    harvestGifShownRef.current = true;
    // Clear each after display duration
    readyIds.forEach((id) => {
      setTimeout(() => {
        setShowHarvestGifIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 9200);
    });
  }, [farms, isHarvestToday]);

  // Robust image src resolver for products (supports various shapes)
  const getProductImageSrc = useCallback((product) => {
    try {
      if (!product) {
        return getProductIcon('Fruits');
      }

      // Always use local icon paths based on category/subcategory (like mockFarms.js)
      // Ignore database image data (base64, external URLs) and use local icons instead
      const category = product.subcategory || product.category;
      const iconPath = getProductIcon(category);


      return iconPath;
    } catch (e) {
      console.warn('Failed to resolve product image, using fallback:', e);
      return getProductIcon(product?.subcategory || product?.category || 'Fruits');
    }
  }, []);

  // Alert on mount if API Key is missing (requires server restart)
  useEffect(() => {
    const key = process.env.REACT_APP_OPENWEATHER_API_KEY;
    if (!key) {
      console.error('❌ CRITICAL: REACT_APP_OPENWEATHER_API_KEY is missing! Restart your npm start server.');
    } else {
    }
  }, []);

  // isProductPurchased function moved to top of component

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    zoomToFarm: (farm, autoOpenPopup = true) => {
      if (!farm || !farm.coordinates) return;

      const coordinates = Array.isArray(farm.coordinates) ? farm.coordinates : null;
      if (!coordinates || coordinates.length < 2) return;

      const lng = coordinates[0];
      const lat = coordinates[1];

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // Handle weather map (2D Google with OWM layers) - switch to 2D when weather layers enabled
      if (weatherLayerEnabled && googleWeatherMapRef.current?.flyTo) {
        googleWeatherMapRef.current.flyTo({ center: [lng, lat], zoom: 8 });
      }
      // Handle Google 3D globe (when zoom is low) - zoom to a closer level first
      else if (googleGlobeRef.current?.flyTo) {
        googleGlobeRef.current.flyTo(lat, lng, 7);
      }

      // Handle Mapbox - use requestAnimationFrame to ensure map is ready and preserve marker animations
      requestAnimationFrame(() => {
        const map = mapRef.current && typeof mapRef.current.getMap === 'function' ? mapRef.current.getMap() : null;
        if (map && !weatherLayerEnabled) {
          isMapAnimatingRef.current = true;
          popupFixedRef.current = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
          setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });

          // Use map.flyTo directly without updating viewState immediately to avoid interrupting marker animations
          // The viewState will be updated by the map's onMove handler naturally
          map.flyTo({
            center: coordinates,
            zoom: 15,
            duration: 1200,
            essential: true,
            offset: [0, -(isMobile ? 160 : 200)],
            easing: (t) => t * (2 - t)
          });

          map.once('moveend', () => {
            isMapAnimatingRef.current = false;
            setViewState({
              longitude: map.getCenter().lng,
              latitude: map.getCenter().lat,
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch()
            });
            setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
          });
        } else {
          // Fallback: update viewState if map isn't ready yet
          setViewState(prev => ({
            ...prev,
            longitude: lng,
            latitude: lat,
            zoom: 15
          }));
        }
      });

      if (autoOpenPopup) {
        setPopupTab('details');
        setSelectedProduct(farm);

        fetchLocationForProduct(farm);
        fetchWeatherForProduct(farm);
        popupFixedRef.current = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
        setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
      }
    },
    refreshData: () => {
      setRefreshTrigger(prev => prev + 1);
    }
  }), [fetchLocationForProduct, fetchWeatherForProduct, isMobile, weatherLayerEnabled]); // Removed viewState dependency to prevent unnecessary re-creation



  // Load farms data
  useEffect(() => {

    // Prefer fields over farms for map rendering; only accept datasets with usable coordinates
    if (externalFields && externalFields.length > 0) {
      const normalizedExternal = externalFields.map(normalizeField);
      const hasCoords = normalizedExternal.some(f => Array.isArray(f.coordinates) && Number.isFinite(f.coordinates[0]) && Number.isFinite(f.coordinates[1]));
      if (hasCoords) {
        const filteredExternal = normalizedExternal.filter(f => !shouldFilterOutByOccupiedArea(f));
        setFarms(normalizedExternal);
        setFilteredFarms(filteredExternal);
        setSelectedIcons(new Set());
        normalizedExternal.forEach(f => { if (f.isPurchased) stablePurchasedIdsRef.current.add(f.id); });
      } else {
      }
      // Don't call onFarmsLoad for external fields to prevent circular updates
    } else {
      // Load fields from API only
      const loadFarms = async () => {
        try {
          // Load fields from database API
          let databaseFields = [];
          try {
            const response = await fieldsService.getAllForMap();
            databaseFields = (response.data || []).map(normalizeField);

            // Check specifically for the watermelon field
            const watermelonField = databaseFields.find(f => f.name === 'My Watermelon');
            if (watermelonField) {
            } else {
            }
          } catch (error) {
            console.error('❌ Failed to load fields from database:', error);
            console.error('❌ Error details:', error.response || error.message);
          }

          // Load mock data for demo purposes
          const allFields = databaseFields;

          // Note: Purchase status and rented fields are now managed via API
          // In a full implementation, we would fetch user orders and rented fields from API

          // Set fields directly (purchase status managed via API)
          allFields.forEach(f => { if (f.isPurchased) stablePurchasedIdsRef.current.add(f.id); });
          const filteredFields = allFields.filter(f => !shouldFilterOutByOccupiedArea(f));
          setFarms(allFields);
          setFilteredFarms(filteredFields);

          if (mapRef.current && allFields.length > 0) {
            const validFarms = allFields.filter(farm => farm.coordinates);
            if (validFarms.length > 0) {
              const coordinates = validFarms.map(farm => {
                if (Array.isArray(farm.coordinates)) {
                  return [farm.coordinates[0], farm.coordinates[1]];
                } else if (typeof farm.coordinates === 'object') {
                  return [farm.coordinates.lng || farm.coordinates.longitude, farm.coordinates.lat || farm.coordinates.latitude];
                }
                return null;
              }).filter(coord => coord !== null);

              if (coordinates.length > 0) {
                if (!hasInitialFlyRef.current) {
                  setTimeout(() => {
                    if (mapRef.current) {
                      mapRef.current.flyTo({ center: [12.5674, 41.8719], zoom: 2, duration: 2500, essential: true });
                    }
                  }, 600);
                  hasInitialFlyRef.current = true;
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to load farms:', error);
          // Fallback to mock data on error
          try {
            const response = await mockProductService.getProducts();
            const products = (response.data.products || []).map(normalizeField);
            const filteredProducts = products.filter(f => !shouldFilterOutByOccupiedArea(f));
            setFarms(products);
            setFilteredFarms(filteredProducts);
            if (onFarmsLoad) {
              onFarmsLoad(products);
            }
          } catch (fallbackError) {
            console.error('Failed to load fallback farms:', fallbackError);
          }
        }
      };
      loadFarms();
    }
  }, [onFarmsLoad, externalFarms, externalFields, refreshTrigger, normalizeField, shouldFilterOutByOccupiedArea]); // Refresh when refreshTrigger changes

  useEffect(() => {
    if (farms && farms.length > 0) {
      lastNonEmptyFarmsRef.current = farms;
    }
  }, [farms]);

  // Run only when farms or callback change; do NOT depend on viewState or we re-run on every pan/zoom and can cause update loops
  useEffect(() => {
    if (!mapRef.current) return;
    if (!Array.isArray(farms) || farms.length === 0) return;
    if (typeof refreshHarvestGifOverlays === 'function') {
      refreshHarvestGifOverlays();
    }
  }, [farms, refreshHarvestGifOverlays]);

  // Stable key so we don't re-run when parent passes a new object reference with same content (prevents update loop)
  const externalFiltersKey = JSON.stringify({ c: externalFilters?.categories ?? [], s: externalFilters?.subcategories ?? [] });

  // Filter farms based on search query. Only setState when result actually changed to avoid update loops.
  useEffect(() => {
    if (externalFilters && ((Array.isArray(externalFilters.categories) && externalFilters.categories.length > 0) || (Array.isArray(externalFilters.subcategories) && externalFilters.subcategories.length > 0))) {
      return; // external filters are applied in a separate effect; avoid overriding
    }
    let next;
    if (!searchQuery || searchQuery.trim() === '') {
      if (farms.length === 0 && lastNonEmptyFarmsRef.current.length > 0) {
        next = lastNonEmptyFarmsRef.current.filter(f => !shouldFilterOutByOccupiedArea(f));
      } else {
        next = farms.filter(f => !shouldFilterOutByOccupiedArea(f));
      }
      if (selectedIcons && selectedIcons.size > 0) {
        next = next.filter(f => {
          if (!isProductPurchased(f)) return false;
          const icon = getProductIcon(f.subcategory || f.category);
          return selectedIcons.has(icon);
        });
      }
    } else {
      const searchTerm = searchQuery.toLowerCase();
      next = farms.filter(farm => {
        if (shouldFilterOutByOccupiedArea(farm)) return false;
        return (
          farm.name?.toLowerCase().includes(searchTerm) ||
          farm.category?.toLowerCase().includes(searchTerm) ||
          farm.farmer?.toLowerCase().includes(searchTerm) ||
          farm.description?.toLowerCase().includes(searchTerm) ||
          farm.location?.toLowerCase().includes(searchTerm) ||
          farm.products?.some(product =>
            product.name?.toLowerCase().replace(/-/g, ' ').includes(searchTerm)
          )
        );
      });
      if (selectedIcons && selectedIcons.size > 0) {
        next = next.filter(f => {
          if (!isProductPurchased(f)) return false;
          const icon = getProductIcon(f.subcategory || f.category);
          return selectedIcons.has(icon);
        });
      }
    }
    setFilteredFarms((prev) => {
      if (prev.length !== next.length) return next;
      const same = next.every((f, i) => (f?.id ?? i) === (prev[i]?.id ?? i));
      return same ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- externalFiltersKey not externalFilters to avoid loop.
  }, [searchQuery, farms, selectedIcons, externalFiltersKey, shouldFilterOutByOccupiedArea, isProductPurchased]);

  // Apply header-provided category/subcategory filters. Only setState when result changed. Also applies search query so search + filters work together.
  useEffect(() => {
    if (!externalFilters) return;
    const cats = Array.isArray(externalFilters.categories) ? externalFilters.categories : [];
    const subs = Array.isArray(externalFilters.subcategories) ? externalFilters.subcategories : [];
    let filtered;
    if (cats.length === 0 && subs.length === 0) {
      filtered = farms.filter(f => !shouldFilterOutByOccupiedArea(f));
      if (searchQuery && searchQuery.trim() !== '') {
        const searchTerm = searchQuery.toLowerCase();
        filtered = filtered.filter(farm =>
          farm.name?.toLowerCase().includes(searchTerm) ||
          farm.category?.toLowerCase().includes(searchTerm) ||
          farm.farmer?.toLowerCase().includes(searchTerm) ||
          farm.description?.toLowerCase().includes(searchTerm) ||
          farm.location?.toLowerCase().includes(searchTerm) ||
          farm.products?.some(product =>
            product.name?.toLowerCase().replace(/-/g, ' ').includes(searchTerm)
          )
        );
      }
      if (selectedIcons && selectedIcons.size > 0) {
        filtered = filtered.filter(f => {
          if (!isProductPurchased(f)) return false;
          const icon = getProductIcon(f.subcategory || f.category);
          return selectedIcons.has(icon);
        });
      }
      setFilteredFarms((prev) => {
        if (prev.length !== filtered.length) return filtered;
        const same = filtered.every((f, i) => (f?.id ?? i) === (prev[i]?.id ?? i));
        return same ? prev : filtered;
      });
      return;
    }
    const toKey = (raw) => {
      const s = raw ? raw.toString().trim().toLowerCase() : '';
      const slug = s.replace(/[\s_]+/g, '-');
      const compact = slug.replace(/-/g, '');
      const synonyms = {
        greenapple: 'green-apple',
        redapple: 'red-apple',
        lemons: 'lemon',
        lemon: 'lemon',
        tangarine: 'tangerine',
        tangerines: 'tangerine',
        corns: 'corn',
        corn: 'corn',
        strawberries: 'strawberry',
        strawberry: 'strawberry',
        tomatoes: 'tomato',
        tomato: 'tomato',
        eggplants: 'eggplant',
        eggplant: 'eggplant',
        peaches: 'peach',
        peach: 'peach',
        watermelons: 'watermelon',
        watermelon: 'watermelon',
        mangoes: 'mango',
        mango: 'mango',
        avocados: 'avocado',
        avocado: 'avocado',
        grapes: 'grape',
        grape: 'grape',
        bananas: 'banana',
        banana: 'banana'
      };
      const syn = synonyms[compact] || slug;
      return syn.replace(/-/g, ' ');
    };
    const catKeys = new Set(cats.map(toKey));
    const subKeys = new Set(subs.map(toKey));
    filtered = farms.filter(f => {
      if (shouldFilterOutByOccupiedArea(f)) return false;
      const cat = toKey(f.category);
      const sub = toKey(f.subcategory || f.product_name || f.productName);
      const catMatch = catKeys.size > 0 ? (catKeys.has(cat) || [...catKeys].some(k => cat.includes(k) || sub.includes(k))) : true;
      const subMatch = subKeys.size > 0 ? (subKeys.has(sub) || subKeys.has(cat) || [...subKeys].some(k => sub.includes(k) || cat.includes(k))) : true;
      if (subKeys.size > 0) {
        if (!subMatch) return false; // prioritize subcategory match when subs selected
      } else if (!catMatch) {
        return false;
      }
      if (searchQuery && searchQuery.trim() !== '') {
        const searchTerm = searchQuery.toLowerCase();
        const searchMatch = (
          f.name?.toLowerCase().includes(searchTerm) ||
          f.category?.toLowerCase().includes(searchTerm) ||
          f.farmer?.toLowerCase().includes(searchTerm) ||
          f.description?.toLowerCase().includes(searchTerm) ||
          f.location?.toLowerCase().includes(searchTerm) ||
          f.products?.some(product =>
            product.name?.toLowerCase().replace(/-/g, ' ').includes(searchTerm)
          )
        );
        if (!searchMatch) return false;
      }
      return true;
    });
    // When resource bar filter is on: show only the user's purchased/rented fields of that type
    if (selectedIcons && selectedIcons.size > 0) {
      filtered = filtered.filter(f => {
        if (!isProductPurchased(f)) return false;
        const icon = getProductIcon(f.subcategory || f.category);
        return selectedIcons.has(icon);
      });
    }
    setFilteredFarms((prev) => {
      if (prev.length !== filtered.length) return filtered;
      const same = filtered.every((f, i) => (f?.id ?? i) === (prev[i]?.id ?? i));
      return same ? prev : filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- externalFiltersKey not externalFilters to avoid loop.
  }, [externalFiltersKey, farms, selectedIcons, shouldFilterOutByOccupiedArea, isProductPurchased, searchQuery]);

  // const isPurchased = useCallback((productId) => {
  //   const farm = farms.find(f => f.id === productId);
  //   return (farm && !!farm.isPurchased) || purchasedFarms.has(productId) || purchasedProductIds.includes(productId);
  // }, [farms, purchasedFarms, purchasedProductIds]);

  const getOccupiedArea = useCallback((prod) => {
    const useOrderStats = Boolean(minimal && userType === 'admin');
    if (useOrderStats) {
      const key = String(prod?.id ?? prod?.field_id ?? '');
      const rented = fieldOrderStats.get(key)?.rented_area;
      const rentedNum = typeof rented === 'string' ? parseFloat(rented) : rented;
      if (Number.isFinite(rentedNum)) return Math.max(0, rentedNum);
    }
    const occRaw = typeof prod?.occupied_area === 'string' ? parseFloat(prod.occupied_area) : prod?.occupied_area;
    const totalRaw = typeof (prod?.total_area ?? prod?.field_size) === 'string'
      ? parseFloat(prod?.total_area ?? prod?.field_size)
      : (prod?.total_area ?? prod?.field_size);
    const availRaw = typeof prod?.available_area === 'string' ? parseFloat(prod.available_area) : prod?.available_area;

    let baseOcc = 0;
    if (Number.isFinite(occRaw)) {
      baseOcc = Math.max(0, occRaw);
    } else if (Number.isFinite(totalRaw) && Number.isFinite(availRaw)) {
      baseOcc = Math.max(0, totalRaw - availRaw);
    }
    const byOrder = purchasedProducts.find(p => String(p.id ?? p.field_id) === String(prod.id ?? prod.field_id))?.purchased_area;
    const ordersOcc = typeof byOrder === 'string' ? parseFloat(byOrder) : byOrder;
    const sumOcc = (Number.isFinite(baseOcc) ? baseOcc : 0) + (Number.isFinite(ordersOcc) ? ordersOcc : 0);
    return Math.max(0, sumOcc);
  }, [minimal, userType, fieldOrderStats, purchasedProducts]);

  const getAvailableArea = (prod) => {
    const useOrderStats = Boolean(minimal && userType === 'admin');
    if (useOrderStats) {
      const key = String(prod?.id ?? prod?.field_id ?? '');
      const rented = fieldOrderStats.get(key)?.rented_area;
      const rentedNum = typeof rented === 'string' ? parseFloat(rented) : rented;
      const totalNum = typeof prod?.total_area === 'string' ? parseFloat(prod.total_area) : (prod?.total_area || 0);
      if (Number.isFinite(totalNum) && Number.isFinite(rentedNum)) return Math.max(0, totalNum - rentedNum);
    }
    const total = typeof prod.total_area === 'string' ? parseFloat(prod.total_area) : (prod.total_area || 0);
    const avail = typeof prod.available_area === 'string' ? parseFloat(prod.available_area) : prod.available_area;
    const occ = getOccupiedArea(prod);
    if (Number.isFinite(total) && Number.isFinite(occ)) return Math.max(0, total - occ);
    if (Number.isFinite(avail)) return Math.max(0, avail);
    return 0;
  };

  // const formatArea = (val) => {
  //   const num = typeof val === 'string' ? parseFloat(val) : val;
  //   if (!Number.isFinite(num)) return '0.00';
  //   return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // };

  const formatAreaInt = (val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!Number.isFinite(num)) return '0';
    return Math.round(num).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // const getSelectedHarvestText = (prod) => {
  //   const entry = purchasedProducts.find(p => (p.id ?? p.field_id) === (prod.id ?? prod.field_id));
  //   const label = entry?.selected_harvest_label || prod.selected_harvest_label || (selectedHarvestDate?.label || '');
  //   let rawDate = entry?.selected_harvest_date || prod.selected_harvest_date || (selectedHarvestDate?.date || '');
  //   if (!rawDate) {
  //     const hd = Array.isArray(prod.harvest_dates) ? prod.harvest_dates.find(h => h.selected || h.default || h.isDefault || h.is_selected) || prod.harvest_dates[0] : null;
  //     rawDate = hd?.date || prod.harvest_date || prod.harvestDate || '';
  //   }
  //   const formatDate = (date) => {
  //     if (!date) return '';
  //     if (typeof date === 'string' && /^\d{1,2}\s\w{3}\s\d{4}$/.test(date)) return date;
  //     try {
  //       const d = new Date(date);
  //       if (isNaN(d.getTime())) return date;
  //       const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  //       return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  //     } catch { return date; }
  //   };
  //   const date = formatDate(rawDate);
  //   if (label && date) return `${date} (${label})`;
  //   if (date) return date;
  //   if (label) return label;
  //   return 'Not specified';
  // };

  const getHarvestDateObj = useCallback((prod) => {
    const entry = purchasedProducts.find(p => String(p.id ?? p.field_id) === String(prod.id ?? prod.field_id));
    const list = Array.isArray(entry?.selected_harvests) ? entry.selected_harvests : [];
    const explicit = entry?.selected_harvest_date;
    const pick = (() => {
      if (explicit) return explicit;
      let best = null;
      let bestTs = -Infinity;
      for (const it of list) {
        const raw = it?.date;
        if (!raw) continue;
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          const ts = d.getTime();
          if (ts > bestTs) { bestTs = ts; best = raw; }
        } else {
          const s = String(raw);
          const parts = s.split(/[-/ ]/);
          if (parts.length >= 3) {
            const tryStr = `${parts[0]} ${parts[1]} ${parts[2]}`;
            const d2 = new Date(tryStr);
            if (!isNaN(d2.getTime())) {
              const ts2 = d2.getTime();
              if (ts2 > bestTs) { bestTs = ts2; best = tryStr; }
            }
          }
        }
      }
      return best || null;
    })();
    if (!pick) return null;
    try {
      const dd = new Date(pick);
      if (!isNaN(dd.getTime())) return dd;
    } catch { }
    return null;
  }, [purchasedProducts]);



  const getDaysUntilHarvest = useCallback((prod) => {
    const d = getHarvestDateObj(prod);
    if (!d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffMs = hDay.getTime() - today.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  }, [getHarvestDateObj]);

  const getHarvestProgressInfo = useCallback((prod) => {
    const days = getDaysUntilHarvest(prod);
    if (days === null) return { progress: 0 };
    let progress = 0.25;
    if (days >= 4) progress = 0.25;
    else if (days >= 1 && days <= 3) progress = 0.75;
    else if (days === 0 || (days < 0 && days >= -4)) progress = 1.0;
    else progress = 0.25;
    return { progress };
  }, [getDaysUntilHarvest]);

  const getRingGradientByHarvest = useCallback((prod) => {
    const d = getHarvestDateObj(prod);
    const red = { start: '#F28F8F', end: '#EF4444' };
    const yellow = { start: '#FAD27A', end: '#F59E0B' };
    const green = { start: '#8CC76A', end: '#558403' };
    if (!d) return red;
    const days = getDaysUntilHarvest(prod);
    if (days >= 4) return red;
    if (days >= 1 && days <= 3) return yellow;
    if (days >= 0) return green; // today (>=0 and <1)
    if (days < 0 && days >= -4) return green; // within grace after
    return red; // far future or far past
  }, [getHarvestDateObj, getDaysUntilHarvest]);

  const getPiePath = useCallback((radius, ratio) => {
    const cx = radius;
    const cy = radius;
    const start = -Math.PI / 2;
    const end = start + Math.max(0, Math.min(1, ratio)) * Math.PI * 2;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = ratio > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }, []);

  /** Cache of icon URL -> data URL so Google 3D markers can embed images (avoids load/CORS in iframe). */
  const [iconDataUrlCache, setIconDataUrlCache] = useState({});

  /** Build the same marker SVG as Mapbox for use on Google 3D globe. Circular bar (harvest ring + occupied pie) and pulsing only for purchased/rented, same as Mapbox. */
  const getMarkerSvgForGoogle = useCallback((product, isMobileMarker = false, dataUrlCache = {}) => {
    if (!product?.id) return '';
    const size = isMobileMarker ? 38 : 50;
    const strokeW = isMobileMarker ? 3 : 3;
    const innerR = isMobileMarker ? 13 : 17;
    const imgSize = isMobileMarker ? 18 : 26;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) - (strokeW / 2);
    const purchased = isProductPurchased(product);

    let harvestRingSvg = '';
    let rentPieSvg = '';
    let extraRingSvg = '';
    if (purchased) {
      const { progress } = getHarvestProgressInfo(product);
      const grad = getRingGradientByHarvest(product);
      const occ = getOccupiedArea(product);
      const total = typeof product.total_area === 'string' ? parseFloat(product.total_area) : (product.total_area || 0);
      const occRatio = total > 0 ? Math.max(0, Math.min(1, occ / total)) : 0;
      const circumference = 2 * Math.PI * r;
      const dash = Math.max(0, Math.min(circumference, progress * circumference));
      const path = getPiePath(innerR, occRatio);
      const ringGradId = `g-ring-${String(product.id).replace(/[^a-z0-9_-]/gi, '_')}`;
      const glowId = `g-glow-${String(product.id).replace(/[^a-z0-9_-]/gi, '_')}`;
      const rentGradId = `g-rent-${String(product.id).replace(/[^a-z0-9_-]/gi, '_')}`;
      harvestRingSvg = `<linearGradient id="${ringGradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${grad.start}" stop-opacity="0.95"/><stop offset="100%" stop-color="${grad.end}" stop-opacity="0.95"/></linearGradient><filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="#FFD8A8" flood-opacity="0.45"/></filter><radialGradient id="${rentGradId}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(33,150,243,0.7)"/><stop offset="100%" stop-color="rgba(33,150,243,0.4)"/></radialGradient>`;
      rentPieSvg = `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="rgba(255,255,255,0.30)" stroke-width="${strokeW}" fill="none"/><circle cx="${cx}" cy="${cy}" r="${r}" stroke="url(#${ringGradId})" stroke-width="${strokeW}" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})" filter="url(#${glowId})"/><path d="${path}" fill="url(#${rentGradId})" stroke="rgba(33,150,243,0.85)" stroke-width="1.1" transform="translate(${cx - innerR}, ${cy - innerR})"/>`;
      extraRingSvg = `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>`;
    }

    const clipId = `g-clip-${String(product.id).replace(/[^a-z0-9_-]/gi, '_')}`;
    const urlKey = getProductImageSrc(product);
    let imgSrc = (dataUrlCache && dataUrlCache[urlKey]) || '';
    if (!imgSrc && urlKey && typeof urlKey === 'string') {
      imgSrc = (typeof window !== 'undefined' ? window.location.origin : '') + (urlKey.startsWith('/') ? urlKey : '/' + urlKey);
      imgSrc = encodeURI(imgSrc);
    }
    const imgX = (size - imgSize) / 2;
    const imgY = (size - imgSize) / 2;

    const keyframes = purchased
      ? '<style>@keyframes g-glow-pulse{0%{filter:brightness(1) drop-shadow(0 0 12px rgba(255,255,255,0.9));transform:scale(1)}50%{filter:brightness(1.2) drop-shadow(0 0 20px rgba(255,255,255,1));transform:scale(1.05)}100%{filter:brightness(1) drop-shadow(0 0 12px rgba(255,255,255,0.9));transform:scale(1)}}@keyframes g-heartbeat{0%,50%,100%{transform:scale(1)}25%,75%{transform:scale(1.1)}}</style>'
      : '';

    const imageEl = `<image href="${imgSrc || ''}" xlink:href="${imgSrc || ''}" x="${imgX}" y="${imgY}" width="${imgSize}" height="${imgSize}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
    const imageWithPulse = purchased
      ? `<g style="animation: g-glow-pulse 1.5s ease-in-out infinite, g-heartbeat 2s ease-in-out infinite; transform-origin: 50% 50%;"><image href="${imgSrc || ''}" xlink:href="${imgSrc || ''}" x="${imgX}" y="${imgY}" width="${imgSize}" height="${imgSize}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/></g>`
      : imageEl;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${keyframes}${harvestRingSvg}<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${imgSize / 2}"/></clipPath></defs>${purchased ? rentPieSvg : ''}${imageWithPulse}${extraRingSvg}</svg>`;
  }, [getHarvestProgressInfo, getRingGradientByHarvest, getPiePath, getProductImageSrc, getOccupiedArea, isProductPurchased]);

  // const isHarvestReached = useCallback((prod) => {
  //   const days = getDaysUntilHarvest(prod);
  //   return days !== null && days <= 0;
  // }, [getDaysUntilHarvest]);

  const isHarvestWithinGrace = useCallback((prod, days = 4) => {
    const du = getDaysUntilHarvest(prod);
    return du !== null && du <= 0 && du >= -days;
  }, [getDaysUntilHarvest]);

  // Show fric.gif only when purchased and selectedHarvestDate === today.
  // Auto-hide after 6 seconds. Render above all marker content.
  useEffect(() => {
    if (!Array.isArray(filteredFarms) || filteredFarms.length === 0) return;
    const newlyVisible = [];
    filteredFarms.forEach((prod) => {
      try {
        const purchased = isProductPurchased(prod);
        const du = getDaysUntilHarvest(prod);
        if (purchased && du === 0 && !celebratedHarvestIdsRef.current.has(prod.id)) {
          newlyVisible.push(prod.id);
        }
      } catch { }
    });
    if (newlyVisible.length === 0) return;
    newlyVisible.forEach((pid) => {
      celebratedHarvestIdsRef.current.add(pid);
      setShowHarvestGifIds((prev) => {
        const next = new Set(prev);
        next.add(pid);
        return next;
      });
      setTimeout(() => {
        setShowHarvestGifIds((prev) => {
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });
      }, 6000);
    });
  }, [filteredFarms, isProductPurchased, getDaysUntilHarvest]);

  const OrbitIcon = ({ mode, size, strokeW, iconSize }) => {
    const ref = React.useRef(null);
    React.useEffect(() => {
      let id;
      const r = (size / 2) - (strokeW / 2);
      const start = performance.now();
      const loop = (t) => {
        const elapsed = (t - start) / 1000;
        const angle = (elapsed / 6) * (Math.PI * 2);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (ref.current) {
          ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        }
        id = requestAnimationFrame(loop);
      };
      id = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(id);
    }, [size, strokeW]);
    const src = mode === 'pickup' ? '/icons/products/pickup.png' : '/icons/products/delivery.png';
    return (
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: `${size}px`, height: `${size}px`, transform: 'translate(-50%, -50%)', zIndex: 20, pointerEvents: 'none' }}>
        <img ref={ref} src={src} alt="Shipping Orbit" style={{ position: 'absolute', left: '50%', top: '50%', width: `${iconSize}px`, height: `${iconSize}px`, objectFit: 'contain', transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
      </div>
    );
  };

  const addShippingOrbit = useCallback((productMarker, mode) => {
    const size = isMobile ? 46 : 60;
    const strokeW = isMobile ? 4 : 5;
    const iconSize = isMobile ? 16 : 25;
    return <OrbitIcon mode={mode} size={size} strokeW={strokeW} iconSize={iconSize} />;
  }, [isMobile]);

  const getShippingModes = useCallback((prod) => {
    const entry = purchasedProducts.find(p => (p.id ?? p.field_id) === (prod.id ?? prod.field_id));
    const fromEntry = Array.isArray(entry?.shipping_modes) ? entry.shipping_modes : [];
    const single = entry?.mode_of_shipping || entry?.shipping_method || prod.mode_of_shipping || prod.shipping_method || prod.shipping_option || '';
    const bools = [];
    if (prod.shipping_pickup) bools.push('Pickup');
    if (prod.shipping_delivery) bools.push('Delivery');
    const canon = single
      ? (single.toLowerCase() === 'pickup' ? 'Pickup'
        : (single.toLowerCase() === 'delivery' ? 'Delivery'
          : (single.toLowerCase().includes('both') ? 'Delivery' : single)))
      : null;
    const combined = canon ? [...fromEntry, canon, ...bools] : [...fromEntry, ...bools];
    const set = new Set();
    const uniq = combined.filter(m => { const k = (m || '').toLowerCase(); if (set.has(k)) return false; set.add(k); return true; });
    return uniq;
  }, [purchasedProducts]);

  const getSelectedHarvestList = (prod) => {
    const entry = purchasedProducts.find(p => (p.id ?? p.field_id) === (prod.id ?? prod.field_id));
    const items = Array.isArray(entry?.selected_harvests) ? entry.selected_harvests : [];
    const formatDate = (date) => {
      if (!date) return '';
      if (typeof date === 'string' && /^\d{1,2}\s\w{3}\s\d{4}$/.test(date)) return date;
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      } catch { return date; }
    };
    if (items.length > 0) {
      const seen = new Set();
      const normalized = items.filter(it => {
        const d = (() => {
          if (!it?.date) return '';
          try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { }
          return typeof it.date === 'string' ? it.date : '';
        })();
        const k = `${d}|${(it?.label || '').trim().toLowerCase()}`;
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      return normalized.map(it => {
        const dt = formatDate(it.date);
        if (it.label && dt) return `${dt} (${it.label})`;
        if (dt) return dt;
        if (it.label) return it.label;
        return '';
      }).filter(Boolean);
    }
    const fallLabel = prod.selected_harvest_label || (selectedHarvestDate?.label || '');
    const fallDate = prod.selected_harvest_date || (selectedHarvestDate?.date || '');
    const f = formatDate(fallDate);
    if (fallLabel && f) return [`${f} (${fallLabel})`];
    if (f) return [f];
    if (fallLabel) return [fallLabel];
    const hdArr = prod.harvest_dates || prod.harvestDates;
    if (Array.isArray(hdArr) && hdArr.length > 0) {
      const seen = new Set();
      const out = [];
      for (const it of hdArr) {
        const raw = (it && typeof it === 'object') ? (it.date ?? it.value ?? it.harvest_date) : it;
        const label = (it && typeof it === 'object') ? (it.label ?? it.name ?? '') : '';
        const dt = formatDate(raw);
        const key = `${dt}|${String(label || '').trim().toLowerCase()}`;
        if (!dt) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label ? `${dt} (${label})` : dt);
      }
      if (out.length > 0) return out;
    }
    const single = prod.harvest_date || prod.harvestDate || prod.harvest_start_date || prod.harvestStartDate;
    const singleFmt = formatDate(single);
    if (singleFmt) return [singleFmt];
    return [];
  };

  // Debug user state
  useEffect(() => {
  }, [currentUser]);

  useEffect(() => {
    const addr = (
      currentUser?.address ||
      currentUser?.location ||
      user?.address ||
      user?.location || ''
    );
    setExistingDeliveryAddress(addr || '');
  }, [currentUser, user]);

  // Load user coins when user changes
  useEffect(() => {
    const loadUserCoins = async () => {
      if (currentUser && currentUser.id) {
        try {
          const coins = await coinService.getUserCoins(currentUser.id);
          setUserCoins(coins);
        } catch (error) {
          console.error('Error loading user coins:', error);
          setUserCoins(0);
        }
      } else {
        setUserCoins(0);
      }
    };

    loadUserCoins();
  }, [currentUser]);

  const handleBuyNow = async (product) => {
    if (buyNowInProgressRef.current) return;
    buyNowInProgressRef.current = true;
    setBuyNowInProgress(true);
    try {
      if (!currentUser || !currentUser.id) {
        if (onNotification) {
          onNotification('Please log in to make a purchase.', 'error');
        }
        return;
      }

      if (!selectedShipping) {
        setShippingError(true);
        return;
      }
      if (selectedShipping === 'Delivery') {
        if (!isDeliveryAllowed(product)) {
          if (onNotification) onNotification('Delivery is unavailable at your location.', 'error');
          return;
        }
        setAddressError('');
        if (deliveryMode === 'existing') {
          if (!existingDeliveryAddress || existingDeliveryAddress.trim().length < 5) {
            setAddressError('Please provide a valid saved address or add a new one');
            return;
          }
        } else {
          const { name, line1, city, zip, country } = newDeliveryAddress;
          if (!name || !line1 || !city || !zip || !country) {
            setAddressError('Please fill in required address fields');
            return;
          }
        }
      }
      const availableArea = getAvailableArea(product);
      if (!(availableArea > 0)) {
        if (onNotification) onNotification('No area remaining to purchase for this field.', 'error');
        setInsufficientFunds(false);
        return;
      }
      if (quantity > availableArea) {
        if (onNotification) onNotification(`Only ${availableArea}m² available. Reduce quantity to proceed.`, 'error');
        setInsufficientFunds(false);
        return;
      }

      const totalCostInDollars = (product.price_per_m2 || 0.55) * quantity;
      // Convert dollars to coins: Based on coin packs, ~100 coins = $9.99, so 1 coin ≈ $0.10
      // Formula: dollars * 10 (round up to ensure fair pricing)
      const totalCostInCoins = Math.ceil(totalCostInDollars * 10);

      // Reset insufficient funds error
      setInsufficientFunds(false);

      // Check if user has sufficient coins using coinService
      const currentCoins = await coinService.getUserCoins(currentUser.id);
      if (currentCoins < totalCostInCoins) {
        setInsufficientFunds(true);
        if (onNotification) {
          onNotification(
            `Insufficient coins! You need ${totalCostInCoins} coins but only have ${currentCoins}. Please add more coins to continue.`,
            'error'
          );
        }
        return;
      }

      // Check if user is trying to purchase from their own farm
      if (currentUser && (product.farmer_id === currentUser.id || product.created_by === currentUser.id)) {
        if (onNotification) {
          onNotification('You cannot purchase from your own farm!', 'error');
        }
        return;
      }

      try {
        // Create order data
        const orderData = {
          id: Date.now(),
          fieldId: product.id,
          product_name: product.name,
          name: product.name,
          farmer_name: product.farmer_name || 'Farm Owner',
          farmer_id: product.farmer_id || product.created_by,
          location: product.location || 'Unknown Location',
          area_rented: quantity,
          area: quantity,
          crop_type: product.category || 'Mixed Crops',
          total_cost: totalCostInDollars,
          cost: totalCostInDollars,
          price_per_unit: product.price || 0.55,
          monthly_rent: Math.round(totalCostInDollars / 6), // Assuming 6-month rental
          status: 'confirmed',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 6 months from now
          progress: 0,
          notes: (() => {
            const base = `Purchased via marketplace. Shipping: ${selectedShipping || 'Delivery'}`;
            if (selectedShipping === 'Delivery') {
              const summary = deliveryMode === 'existing'
                ? ` | Deliver to: ${existingDeliveryAddress}`
                : ` | Deliver to: ${newDeliveryAddress.name}, ${newDeliveryAddress.line1}${newDeliveryAddress.line2 ? ' ' + newDeliveryAddress.line2 : ''}, ${newDeliveryAddress.city}, ${newDeliveryAddress.state ? newDeliveryAddress.state + ', ' : ''}${newDeliveryAddress.zip}, ${newDeliveryAddress.country}`;
              return base + summary;
            }
            return base;
          })(),
          shipping_method: selectedShipping || 'Delivery',
          selected_harvest_date: selectedHarvestDate ? selectedHarvestDate.date : null,
          selected_harvest_label: selectedHarvestDate ? selectedHarvestDate.label : null,
          created_at: new Date().toISOString()
        };

        // Note: Removed deprecated storage service calls - using API only

        // Create order via real API
        if (currentUser && currentUser.id) {
          const apiOrderData = {
            buyer_id: currentUser.id,
            field_id: product.id,
            quantity: quantity,
            total_price: totalCostInDollars,
            status: 'pending',
            mode_of_shipping: selectedShipping || 'Delivery',
            selected_harvest_date: selectedHarvestDate ? selectedHarvestDate.date : null,
            selected_harvest_label: selectedHarvestDate ? selectedHarvestDate.label : null
          };
          if (selectedShipping === 'Delivery') {
            apiOrderData.notes = (() => {
              const base = `Shipping: Delivery`;
              const summary = deliveryMode === 'existing'
                ? ` | Address: ${existingDeliveryAddress}`
                : ` | Address: ${newDeliveryAddress.name}, ${newDeliveryAddress.line1}${newDeliveryAddress.line2 ? ' ' + newDeliveryAddress.line2 : ''}, ${newDeliveryAddress.city}, ${newDeliveryAddress.state ? newDeliveryAddress.state + ', ' : ''}${newDeliveryAddress.zip}, ${newDeliveryAddress.country}`;
              return base + summary;
            })();
          }

          let orderId = null;
          try {
            // Create order via API
            const orderResponse = await orderService.createOrder(apiOrderData);
            orderId = orderResponse?.data?.id || orderResponse?.data?.order?.id || null;

            console.log('[Purchase] Order created:', { orderId, orderData: apiOrderData });

            // Update user coins in UI immediately (fetch fresh balance from API)
            const updatedCoins = await coinService.getUserCoins(currentUser.id);
            setUserCoins(updatedCoins);
            if (onCoinRefresh) onCoinRefresh();

            // Create notification for the farmer
            const farmerId = product.farmer_id || product.created_by;
            if (farmerId) {
              const notificationData = {
                user_id: farmerId,
                message: `New order received! ${currentUser.name || 'A buyer'} purchased ${quantity}m² of your field "${product.name}" for $${totalCostInDollars.toFixed(2)}`,
                type: 'success'
              };

              try {
                await notificationsService.create(notificationData);
              } catch (notifError) {
                console.error('Failed to create farmer notification:', notifError);
              }
            }

            // Success notification for buyer
            if (onNotification) {
              onNotification(
                `Purchase successful! ${quantity}m² of ${product.name} purchased for ${totalCostInCoins} coins.`,
                'success'
              );
            }
          } catch (error) {
            console.error('[Purchase] Failed:', error);
            console.error('[Purchase] Error details:', error.response?.data || error.message);

            // If order creation failed but coins were deducted, we need to refund
            // (In production, you might want to implement a refund mechanism)
            if (error.response?.status === 400 && error.response?.data?.error === 'Insufficient coins') {
              if (onNotification) {
                const shortfall = error.response?.data?.shortfall || 0;
                onNotification(
                  `Insufficient coins! You need ${totalCostInCoins} coins. Please add more coins to continue.`,
                  'error'
                );
              }
              setInsufficientFunds(true);
              return;
            }

            // For other errors, show generic message
            if (onNotification) {
              onNotification(
                `Purchase failed: ${error.response?.data?.error || error.message || 'Unknown error'}. Please try again.`,
                'error'
              );
            }

            // Fall back to mock service only if API completely fails
            try {
              await mockOrderService.createOrder(orderData);
            } catch (mockError) {
              console.error('Mock order creation also failed:', mockError);
            }
            return; // Don't proceed with UI updates if order creation failed
          }
        } else {
          // Fall back to mock service if no user
          await mockOrderService.createOrder(orderData);
        }

        // Note: Field purchase status managed via API

        // Update UI state
        setPurchasedFarms(prev => new Set([...prev, product.id]));

        const totalArea = product.total_area || 1;
        const existing = purchasedProducts.find(p => p.id === product.id);
        if (existing) {
          const updated = purchasedProducts.map(p => p.id === product.id ? {
            ...p,
            purchased_area: (p.purchased_area || 0) + quantity,
            selected_harvest_date: selectedHarvestDate ? selectedHarvestDate.date : p.selected_harvest_date,
            selected_harvest_label: selectedHarvestDate ? selectedHarvestDate.label : p.selected_harvest_label,
            selected_harvests: (() => {
              const prev = Array.isArray(p.selected_harvests) ? p.selected_harvests : [];
              const nextItem = selectedHarvestDate ? { date: selectedHarvestDate.date, label: selectedHarvestDate.label } : null;
              const next = nextItem ? [...prev, nextItem] : prev;
              const seen = new Set();
              return next.filter(it => {
                const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })();
                const k = `${d}|${(it?.label || '').trim().toLowerCase()}`;
                if (seen.has(k)) return false; seen.add(k); return true;
              });
            })()
          } : p);
          setPurchasedProducts(updated);
        } else {
          setPurchasedProducts(prev => [...prev, {
            id: product.id,
            name: product.name || product.product_name,
            category: product.subcategory || product.category,
            total_area: totalArea,
            purchased_area: quantity,
            coordinates: product.coordinates,
            selected_harvest_date: selectedHarvestDate ? selectedHarvestDate.date : null,
            selected_harvest_label: selectedHarvestDate ? selectedHarvestDate.label : null,
            selected_harvests: (() => {
              if (!selectedHarvestDate) return [];
              const it = { date: selectedHarvestDate.date, label: selectedHarvestDate.label };
              const d = (() => { try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })();
              const s = new Set();
              return [{ date: d || it.date, label: (it.label || '').trim() }].filter(x => { const kk = `${x.date || ''}|${(x.label || '').trim().toLowerCase()}`; if (s.has(kk)) return false; s.add(kk); return true; });
            })(),
            mode_of_shipping: selectedShipping || 'Delivery'
          }]);
        }
        stablePurchasedIdsRef.current.add(product.id);
        triggerBurst(product, quantity);
        setSelectedProduct(null);
        setQuantity(1);
        setInsufficientFunds(false);
        setSelectedHarvestDate(null);

        const tasks = [];
        tasks.push((async () => {
          try {
            const res = await orderService.getBuyerOrdersWithFields(currentUser.id);
            const orders = Array.isArray(res?.data) ? res.data : (res?.data?.orders || []);
            const byField = new Map();
            for (const o of orders) {
              const fid = o.field_id || o.fieldId || o.field?.id;
              if (!fid) continue;
              const prev = byField.get(fid) || { purchased_area: 0, selected_harvests: [], last_order_selected_date: null, last_order_shipping_mode: null, last_order_created_at: null };
              const qtyRaw = o.quantity ?? o.area_rented ?? o.area ?? 0;
              const qty = typeof qtyRaw === 'string' ? parseFloat(qtyRaw) : qtyRaw;
              const field = o.field || farms.find(f => f.id === fid) || {};
              const name = field.name || o.product_name || o.name;
              const category = field.subcategory || field.category || o.crop_type;
              const total_area = field.total_area || 0;
              const coordinates = field.coordinates;
              const sh = { date: o.selected_harvest_date || null, label: o.selected_harvest_label || null };
              const shs = Array.isArray(prev.selected_harvests) ? prev.selected_harvests : [];
              const added = sh.date || sh.label ? [...shs, sh] : shs;
              const uniq = (() => { const s = new Set(); return added.filter(it => { const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })(); const k = `${d}|${(it?.label || '').trim().toLowerCase()}`; if (s.has(k)) return false; s.add(k); return true; }); })();
              const createdAt = o.created_at || o.createdAt || null;
              const prevTs = prev.last_order_created_at ? new Date(prev.last_order_created_at).getTime() : -Infinity;
              const curTs = createdAt ? new Date(createdAt).getTime() : -Infinity;
              const mRaw = (o.mode_of_shipping || o.shipping_method || '').trim();
              const mCanon = mRaw.toLowerCase() === 'pickup' ? 'Pickup' : (mRaw.toLowerCase() === 'delivery' ? 'Delivery' : (mRaw ? mRaw : null));
              byField.set(fid, {
                id: fid,
                name,
                category,
                total_area,
                purchased_area: (prev.purchased_area || 0) + qty,
                coordinates,
                selected_harvests: uniq,
                delivery_address: (() => { const s = String(o.notes || ''); const m = s.match(/Address:\s*(.*)$/); if (m) return m[1].trim(); const m2 = s.match(/Deliver to:\s*(.*)$/); if (m2) return m2[1].trim(); return ''; })(),
                last_order_selected_date: (curTs >= prevTs) ? (o.selected_harvest_date || null) : prev.last_order_selected_date || null,
                last_order_shipping_mode: (curTs >= prevTs) ? mCanon : prev.last_order_shipping_mode || null,
                last_order_created_at: (curTs >= prevTs) ? createdAt : prev.last_order_created_at || null,
                last_order_purchased: (curTs >= prevTs)
                  ? ((o.purchased === true)
                    || (() => { const q = o.quantity ?? o.area_rented ?? o.area; const v = typeof q === 'string' ? parseFloat(q) : q; return Number.isFinite(v) && v > 0; })()
                    || (() => { const s = String(o.status || '').toLowerCase(); return s === 'active' || s === 'pending'; })())
                  : (prev.last_order_purchased === true)
              });
            }
            const list = Array.from(byField.values());
            setPurchasedProducts(prev => {
              const map = new Map();
              list.forEach(item => map.set(String(item.id ?? item.field_id), { ...item }));
              prev.forEach(p => {
                const key = String(p.id ?? p.field_id);
                const existing = map.get(key);
                if (existing) {
                  const ex = typeof existing.purchased_area === 'string' ? parseFloat(existing.purchased_area) : (existing.purchased_area || 0);
                  const pv = typeof p.purchased_area === 'string' ? parseFloat(p.purchased_area) : (p.purchased_area || 0);
                  existing.purchased_area = Math.max(ex, pv);
                  const shPrev = Array.isArray(existing.selected_harvests) ? existing.selected_harvests : [];
                  const shIncoming = Array.isArray(p.selected_harvests) ? p.selected_harvests : [];
                  const combined = [...shPrev, ...shIncoming];
                  const s = new Set();
                  existing.selected_harvests = combined.filter(it => { const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })(); const k = `${d}|${(it?.label || '').trim().toLowerCase()}`; if (s.has(k)) return false; s.add(k); return true; });
                  const prevTs = p.last_order_created_at ? new Date(p.last_order_created_at).getTime() : -Infinity;
                  const curTs = existing.last_order_created_at ? new Date(existing.last_order_created_at).getTime() : -Infinity;
                  if (prevTs > curTs) {
                    existing.last_order_selected_date = p.last_order_selected_date || existing.last_order_selected_date || null;
                    existing.last_order_shipping_mode = p.last_order_shipping_mode || existing.last_order_shipping_mode || null;
                    existing.last_order_created_at = p.last_order_created_at || existing.last_order_created_at || null;
                    existing.last_order_purchased = (p.last_order_purchased === true) || existing.last_order_purchased === true;
                  }
                } else {
                  map.set(key, { ...p });
                }
              });
              return Array.from(map.values());
            });
            list.forEach(p => stablePurchasedIdsRef.current.add(p.id));
            setRefreshTrigger(prev => prev + 1);
          } catch { }
        })());
        if (onNotificationRefresh) onNotificationRefresh();

        // Update UI to reflect purchase status (using API-based approach)
        // The purchase status is now managed via the database, so we just update the local UI state
        // In a full implementation, we would reload the fields from the API to get updated status

        // If this is a farmer-created field, farm orders and notifications are managed via API above.
        // (Order creation and farmer notification already handled; no hardcoded owner/buyer.)
        if (product.isFarmerCreated) {
          // Notification already sent above for product.farmer_id / product.owner_id
        }

      } catch (error) {
        console.error('Failed to create order:', error);
        if (onNotification) {
          onNotification('Purchase failed. Please try again.', 'error');
        }
        setSelectedProduct(null);
        setInsufficientFunds(false);
        setQuantity(1);
      }
    } finally {
      buyNowInProgressRef.current = false;
      setBuyNowInProgress(false);
    }
  };

  const handleRentNow = async (product) => {
    if (!currentUser || !currentUser.id) {
      if (onNotification) onNotification('Please log in to rent a field.', 'error');
      return;
    }
    const userType = (currentUser.user_type || '').toLowerCase();
    if (userType !== 'farmer') {
      if (onNotification) onNotification('Only farmers can rent fields from here.', 'error');
      return;
    }
    const ownerId = product.farmer_id || product.owner_id || product.created_by;
    if (ownerId && String(ownerId) === String(currentUser.id)) {
      if (onNotification) onNotification('You cannot rent your own field.', 'error');
      return;
    }
    const availableArea = getAvailableArea(product);
    if (!(availableArea > 0)) {
      if (onNotification) onNotification('No area remaining to rent for this field.', 'error');
      return;
    }
    if (quantity > availableArea) {
      if (onNotification) onNotification(`Only ${availableArea}m² available. Reduce quantity to proceed.`, 'error');
      return;
    }
    const rentPricePerMonth = parseFloat(product.rent_price_per_month) || 0;
    if (!(rentPricePerMonth > 0)) {
      if (onNotification) onNotification('This field has no rent price set.', 'error');
      return;
    }
    const months = rentDuration === 'monthly' ? 1 : rentDuration === 'quarterly' ? 3 : 12;
    const totalPrice = rentPricePerMonth * quantity * months;
    const totalCostInCoins = Math.ceil(totalPrice * 10);
    const startDate = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    const endDate = end.toISOString().slice(0, 10);

    const currentCoins = await coinService.getUserCoins(currentUser.id);
    if (currentCoins < totalCostInCoins) {
      setInsufficientFunds(true);
      if (onNotification) {
        onNotification(
          `Insufficient coins! You need ${totalCostInCoins} coins but only have ${currentCoins}. Please add more coins to continue.`,
          'error'
        );
      }
      return;
    }
    setInsufficientFunds(false);

    setRentInProgress(true);
    try {
      await coinService.deductCoins(currentUser.id, totalCostInCoins, {
        reason: `Rent: ${quantity}m² of ${product.name || 'field'} for ${months} month(s)`,
        refType: 'rent',
        refId: null,
      });
      await rentedFieldsService.create({
        field_id: product.id,
        start_date: startDate,
        end_date: endDate,
        price: totalPrice,
        area_rented: quantity,
      });
      if (onNotification) {
        onNotification(`Rented ${quantity}m² of "${product.name || 'field'}" until ${endDate}.`, 'success');
      }
      setSelectedProduct(null);
      setQuantity(1);
      if (onNotificationRefresh) onNotificationRefresh();
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to rent field';
      if (onNotification) onNotification(msg, 'error');
    } finally {
      setRentInProgress(false);
    }
  };

  const handleSummaryProductClick = useCallback((e, product) => {
    e.stopPropagation();
    const icon = product.icon || getProductIcon(product.subcategory || product.category || product.id);
    setSelectedIcons(prev => {
      const next = new Set(prev);
      if (next.has(icon)) {
        next.delete(icon);
      } else {
        next.add(icon);
      }
      return next;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedIcons(new Set());
    setFilteredFarms(farms);
  }, [farms]);

  useEffect(() => {
    const loadPurchasedFromDb = async () => {
      if (!currentUser || !currentUser.id) return;
      try {
        const res = await orderService.getBuyerOrdersWithFields(currentUser.id);
        const orders = Array.isArray(res?.data) ? res.data : (res?.data?.orders || []);
        const byField = new Map();
        for (const o of orders) {
          const fid = o.field_id || o.fieldId || o.field?.id;
          if (!fid) continue;
          const prev = byField.get(fid) || { purchased_area: 0, selected_harvests: [], last_order_selected_date: null, last_order_shipping_mode: null, last_order_created_at: null };
          const qtyRaw2 = o.quantity ?? o.area_rented ?? o.area ?? 0;
          const qty = typeof qtyRaw2 === 'string' ? parseFloat(qtyRaw2) : qtyRaw2;
          const field = o.field || farms.find(f => f.id === fid) || {};
          const name = field.name || o.product_name || o.name;
          const category = field.subcategory || field.category || o.crop_type;
          const total_area = field.total_area || 0;
          const coordinates = field.coordinates;
          const sh2 = { date: o.selected_harvest_date || null, label: o.selected_harvest_label || null };
          const shs2 = Array.isArray(prev.selected_harvests) ? prev.selected_harvests : [];
          const added2 = sh2.date || sh2.label ? [...shs2, sh2] : shs2;
          const uniq2 = (() => { const s = new Set(); return added2.filter(it => { const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })(); const k = `${d}|${(it?.label || '').trim().toLowerCase()}`; if (s.has(k)) return false; s.add(k); return true; }); })();
          const createdAt = o.created_at || o.createdAt || null;
          const prevTs = prev.last_order_created_at ? new Date(prev.last_order_created_at).getTime() : -Infinity;
          const curTs = createdAt ? new Date(createdAt).getTime() : -Infinity;
          const mRaw = (o.mode_of_shipping || o.shipping_method || '').trim();
          const mCanon = mRaw.toLowerCase() === 'pickup' ? 'Pickup' : (mRaw.toLowerCase() === 'delivery' ? 'Delivery' : (mRaw ? mRaw : null));
          byField.set(fid, {
            id: fid,
            name,
            category,
            total_area,
            purchased_area: (prev.purchased_area || 0) + qty,
            coordinates,
            selected_harvests: uniq2,
            shipping_modes: (() => { const pm = Array.isArray(prev.shipping_modes) ? prev.shipping_modes : []; const m = (o.mode_of_shipping || o.shipping_method || '').trim(); const canon = m.toLowerCase() === 'pickup' ? 'Pickup' : (m.toLowerCase() === 'delivery' ? 'Delivery' : (m ? m : null)); const added = canon ? [...pm, canon] : pm; const s = new Set(); return added.filter(x => { const k = (x || '').toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); })(),
            delivery_address: (() => { const s = String(o.notes || ''); const m = s.match(/Address:\s*(.*)$/); if (m) return m[1].trim(); const m2 = s.match(/Deliver to:\s*(.*)$/); if (m2) return m2[1].trim(); return ''; })(),
            last_order_selected_date: (curTs >= prevTs) ? (o.selected_harvest_date || null) : prev.last_order_selected_date || null,
            last_order_shipping_mode: (curTs >= prevTs) ? mCanon : prev.last_order_shipping_mode || null,
            last_order_created_at: (curTs >= prevTs) ? createdAt : prev.last_order_created_at || null,
            last_order_purchased: (curTs >= prevTs)
              ? ((o.purchased === true)
                || (() => { const q = o.quantity ?? o.area_rented ?? o.area; const v = typeof q === 'string' ? parseFloat(q) : q; return Number.isFinite(v) && v > 0; })()
                || (() => { const s = String(o.status || '').toLowerCase(); return s === 'active' || s === 'pending'; })())
              : (prev.last_order_purchased === true)
          });
        }
        const list = Array.from(byField.values());
        setPurchasedProducts(prev => {
          const map = new Map();
          list.forEach(item => map.set(String(item.id ?? item.field_id), { ...item }));
          prev.forEach(p => {
            const key = String(p.id ?? p.field_id);
            const existing = map.get(key);
            if (existing) {
              const ex = typeof existing.purchased_area === 'string' ? parseFloat(existing.purchased_area) : (existing.purchased_area || 0);
              const pv = typeof p.purchased_area === 'string' ? parseFloat(p.purchased_area) : (p.purchased_area || 0);
              existing.purchased_area = Math.max(ex, pv);
              const shPrev2 = Array.isArray(existing.selected_harvests) ? existing.selected_harvests : [];
              const shIncoming2 = Array.isArray(p.selected_harvests) ? p.selected_harvests : [];
              const combined2 = [...shPrev2, ...shIncoming2];
              const s2 = new Set();
              existing.selected_harvests = combined2.filter(it => { const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })(); const k = `${d}|${(it?.label || '').trim().toLowerCase()}`; if (s2.has(k)) return false; s2.add(k); return true; });
              const mPrev = Array.isArray(existing.shipping_modes) ? existing.shipping_modes : [];
              const mIncoming = Array.isArray(p.shipping_modes) ? p.shipping_modes : [];
              const mCombined = [...mPrev, ...mIncoming];
              const ms = new Set();
              existing.shipping_modes = mCombined.filter(x => { const k = (x || '').toLowerCase(); if (ms.has(k)) return false; ms.add(k); return true; });
              const prevTs = p.last_order_created_at ? new Date(p.last_order_created_at).getTime() : -Infinity;
              const curTs = existing.last_order_created_at ? new Date(existing.last_order_created_at).getTime() : -Infinity;
              if (prevTs > curTs) {
                existing.last_order_selected_date = p.last_order_selected_date || existing.last_order_selected_date || null;
                existing.last_order_shipping_mode = p.last_order_shipping_mode || existing.last_order_shipping_mode || null;
                existing.last_order_created_at = p.last_order_created_at || existing.last_order_created_at || null;
                existing.last_order_purchased = (p.last_order_purchased === true) || existing.last_order_purchased === true;
              }
            } else {
              map.set(key, { ...p });
            }
          });
          return Array.from(map.values());
        });
        list.forEach(p => stablePurchasedIdsRef.current.add(p.id));
      } catch (e) {
        try {
          const res2 = await orderService.getBuyerOrders();
          const orders = res2?.data?.orders || [];
          const byField = new Map();
          for (const o of orders) {
            const fid = o.field_id || o.fieldId;
            if (!fid) continue;
            const prev = byField.get(fid) || { purchased_area: 0, selected_harvests: [], last_order_selected_date: null, last_order_shipping_mode: null, last_order_created_at: null };
            const qtyRaw3 = o.quantity ?? o.area_rented ?? o.area ?? 0;
            const qty = typeof qtyRaw3 === 'string' ? parseFloat(qtyRaw3) : qtyRaw3;
            const field = farms.find(f => f.id === fid) || {};
            const name = field.name || o.product_name || o.name;
            const category = field.subcategory || field.category || o.crop_type;
            const total_area = field.total_area || 0;
            const coordinates = field.coordinates;
            const sh3 = { date: o.selected_harvest_date || null, label: o.selected_harvest_label || null };
            const shs3 = Array.isArray(prev.selected_harvests) ? prev.selected_harvests : [];
            const added3 = sh3.date || sh3.label ? [...shs3, sh3] : shs3;
            const uniq3 = (() => { const s = new Set(); return added3.filter(it => { const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })(); const k = `${d}|${(it?.label || '').trim().toLowerCase()}`; if (s.has(k)) return false; s.add(k); return true; }); })();
            const createdAt = o.created_at || o.createdAt || null;
            const prevTs = prev.last_order_created_at ? new Date(prev.last_order_created_at).getTime() : -Infinity;
            const curTs = createdAt ? new Date(createdAt).getTime() : -Infinity;
            const mRaw = (o.mode_of_shipping || o.shipping_method || '').trim();
            const mCanon = mRaw.toLowerCase() === 'pickup' ? 'Pickup' : (mRaw.toLowerCase() === 'delivery' ? 'Delivery' : (mRaw ? mRaw : null));
            byField.set(fid, {
              id: fid,
              name,
              category,
              total_area,
              purchased_area: (prev.purchased_area || 0) + qty,
              coordinates,
              selected_harvests: uniq3,
              shipping_modes: (() => { const pm = Array.isArray(prev.shipping_modes) ? prev.shipping_modes : []; const m = (o.mode_of_shipping || o.shipping_method || '').trim(); const canon = m.toLowerCase() === 'pickup' ? 'Pickup' : (m.toLowerCase() === 'delivery' ? 'Delivery' : (m ? m : null)); const added = canon ? [...pm, canon] : pm; const s = new Set(); return added.filter(x => { const k = (x || '').toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); })(),
              delivery_address: (() => { const s = String(o.notes || ''); const m = s.match(/Address:\s*(.*)$/); if (m) return m[1].trim(); const m2 = s.match(/Deliver to:\s*(.*)$/); if (m2) return m2[1].trim(); return ''; })(),
              last_order_selected_date: (curTs >= prevTs) ? (o.selected_harvest_date || null) : prev.last_order_selected_date || null,
              last_order_shipping_mode: (curTs >= prevTs) ? mCanon : prev.last_order_shipping_mode || null,
              last_order_created_at: (curTs >= prevTs) ? createdAt : prev.last_order_created_at || null,
              last_order_purchased: (curTs >= prevTs)
                ? ((o.purchased === true)
                  || (() => { const q = o.quantity ?? o.area_rented ?? o.area; const v = typeof q === 'string' ? parseFloat(q) : q; return Number.isFinite(v) && v > 0; })()
                  || (() => { const s = String(o.status || '').toLowerCase(); return s === 'active' || s === 'pending'; })())
                : (prev.last_order_purchased === true)
            });
          }
          const list = Array.from(byField.values());
          setPurchasedProducts(prev => {
            const map = new Map();
            list.forEach(item => map.set(String(item.id ?? item.field_id), { ...item }));
            prev.forEach(p => {
              const key = String(p.id ?? p.field_id);
              const existing = map.get(key);
              if (existing) {
                const ex = typeof existing.purchased_area === 'string' ? parseFloat(existing.purchased_area) : (existing.purchased_area || 0);
                const pv = typeof p.purchased_area === 'string' ? parseFloat(p.purchased_area) : (p.purchased_area || 0);
                existing.purchased_area = Math.max(ex, pv);
                const shPrev3 = Array.isArray(existing.selected_harvests) ? existing.selected_harvests : [];
                const shIncoming3 = Array.isArray(p.selected_harvests) ? p.selected_harvests : [];
                const combined3 = [...shPrev3, ...shIncoming3];
                const s3 = new Set();
                existing.selected_harvests = combined3.filter(it => { const d = (() => { if (!it?.date) return ''; try { const nd = new Date(it.date); if (!isNaN(nd.getTime())) return nd.toISOString().split('T')[0]; } catch { } return typeof it.date === 'string' ? it.date : ''; })(); const k = `${d}|${(it?.label || '').trim().toLowerCase()}`; if (s3.has(k)) return false; s3.add(k); return true; });
                const mPrev = Array.isArray(existing.shipping_modes) ? existing.shipping_modes : [];
                const mIncoming = Array.isArray(p.shipping_modes) ? p.shipping_modes : [];
                const mCombined = [...mPrev, ...mIncoming];
                const ms = new Set();
                existing.shipping_modes = mCombined.filter(x => { const k = (x || '').toLowerCase(); if (ms.has(k)) return false; ms.add(k); return true; });
                const prevTs = p.last_order_created_at ? new Date(p.last_order_created_at).getTime() : -Infinity;
                const curTs = existing.last_order_created_at ? new Date(existing.last_order_created_at).getTime() : -Infinity;
                if (prevTs > curTs) {
                  existing.last_order_selected_date = p.last_order_selected_date || existing.last_order_selected_date || null;
                  existing.last_order_shipping_mode = p.last_order_shipping_mode || existing.last_order_shipping_mode || null;
                  existing.last_order_created_at = p.last_order_created_at || existing.last_order_created_at || null;
                  existing.last_order_purchased = (p.last_order_purchased === true) || existing.last_order_purchased === true;
                }
              } else {
                map.set(key, { ...p });
              }
            });
            return Array.from(map.values());
          });
          list.forEach(p => stablePurchasedIdsRef.current.add(p.id));
        } catch { }
      }
    };
    loadPurchasedFromDb();
  }, [currentUser, farms]);

  useEffect(() => {
    if (!Array.isArray(farms) || farms.length === 0) { setDeliveryTodayCards([]); return; }
    const map = mapRef.current?.getMap();
    if (!map) return;
    const mapRect = map.getContainer().getBoundingClientRect();
    const layerRect = deliveryFlyLayerRef.current?.getBoundingClientRect() || mapRect;
    farms.forEach(f => {
      const purchased = isProductPurchased(f);
      if (!purchased) return;
      if (!isHarvestWithinGrace(f, 4)) return;
      const modes = getShippingModes(f).map(m => (m || '').toLowerCase());
      const mode = modes.includes('pickup') ? 'pickup' : (modes.includes('delivery') ? 'delivery' : null);
      if (mode !== 'delivery') return;
      const entry = purchasedProducts.find(p => String(p.id ?? p.field_id) === String(f.id));
      if (!f?.coordinates) return;
      if (deliveryAnimatedIdsRef.current.has(f.id)) return;
      deliveryAnimatedIdsRef.current.add(f.id);
      const [lng, lat] = f.coordinates;
      const startAnimation = () => {
        const pt = map.project([lng, lat]);
        const baseX = mapRect.left + pt.x - layerRect.left;
        const baseY = mapRect.top + pt.y - layerRect.top;
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const cardW = isMobile ? 64 : 76;
        const cardH = isMobile ? 64 : 76;
        const margin = 12;
        const minCenterX = margin + cardW / 2;
        const maxCenterX = layerRect.width - margin - cardW / 2;
        const minCenterY = margin + cardH / 2;
        const maxCenterY = layerRect.height - margin - cardH / 2;
        const baseXc = clamp(baseX, minCenterX, maxCenterX);
        const baseYc = clamp(baseY, minCenterY, maxCenterY);
        let targetX;
        let targetY;
        if (deliveryIconRef.current) {
          const iconRect = deliveryIconRef.current.getBoundingClientRect();
          targetX = (iconRect.left + iconRect.width / 2) - layerRect.left;
          targetY = (iconRect.top + iconRect.height / 2) - layerRect.top + (isMobile ? 10 : 16);
        } else {
          targetX = 12;
          targetY = (isMobile ? 130 : 156);
        }
        targetX = clamp(targetX, minCenterX, maxCenterX);
        targetY = clamp(targetY, minCenterY, maxCenterY);
        const id = `deliv-${f.id}-${Date.now()}`;
        const rentedArea = (() => { const raw = entry?.purchased_area; return typeof raw === 'string' ? parseFloat(raw) : (raw || 0); })();
        setDeliveryFlyCards(prev => [...prev, { id, product: f, rented: rentedArea, total: f.total_area || 0, x: baseXc, y: baseYc, tx: targetX, ty: targetY, stage: 'start' }]);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDeliveryFlyCards(prev => prev.map(c => c.id === id ? { ...c, x: c.tx, y: c.ty, stage: 'fly' } : c));
            setTimeout(() => {
              setDeliveryFlyCards(prev => prev.map(c => c.id === id ? { ...c, stage: 'arrive' } : c));
              setTimeout(() => {
                setDeliveryFlyCards(prev => prev.filter(c => c.id !== id));
                setDeliveryTodayCards(prev => {
                  const name = f.name || 'Field';
                  const category = f.subcategory || f.category;
                  return [...prev, { id: f.id, name, category, product: f }];
                });
              }, 120);
            }, 2400);
          });
        });
      };
      const run = () => setTimeout(startAnimation, 120);
      const moving = (typeof map.isMoving === 'function' && (map.isMoving() || map.isZooming?.())) || isMapAnimatingRef.current;
      if (moving && typeof map.once === 'function') {
        map.once('moveend', () => map.once('idle', run));
      } else if (typeof map.once === 'function') {
        map.once('idle', run);
      } else {
        run();
      }
    });
  }, [farms, purchasedProducts, isHarvestToday, showDeliveryPanel, isProductPurchased, isHarvestWithinGrace, getShippingModes, isMobile]);

  // Update popup position when selected product changes or view moves; avoid jitter during programmatic animation
  useEffect(() => {
    if (selectedProduct) {
      if (isMapAnimatingRef.current) return;
      const fixed = popupFixedRef.current;
      if (fixed?.left != null && fixed?.top != null) {
        setPopupPosition({ left: fixed.left, top: fixed.top, transform: fixed.transform || 'translate(-50%, -50%)' });
      } else {
        popupFixedRef.current = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
        setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
      }
    } else {
      setPopupPosition(null);
      popupFixedRef.current = { left: null, top: null, transform: null };
    }
  }, [selectedProduct, viewState]);

  // Must be before any early return (rules of hooks)
  // Keep Google 3D globe as the only base map (no Mapbox switching).
  const FORCE_GOOGLE_GLOBE_FOR_TESTING = true;
  const showGoogleGlobe = FORCE_GOOGLE_GLOBE_FOR_TESTING || (process.env.REACT_APP_GOOGLE_MAPS_API_KEY && viewState.zoom <= GLOBAL_VIEW_MAX_ZOOM);

  /** Preload product icon images as data URLs when Google globe is shown so marker SVGs can embed them. */
  useEffect(() => {
    if (!showGoogleGlobe || !Array.isArray(filteredFarms) || filteredFarms.length === 0) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const uniqueUrls = [...new Set(filteredFarms.map((f) => getProductImageSrc(f)).filter(Boolean))];
    let cancelled = false;
    uniqueUrls.forEach((urlKey) => {
      const absoluteUrl = urlKey.startsWith('http') ? urlKey : origin + (urlKey.startsWith('/') ? urlKey : '/' + urlKey);
      fetch(absoluteUrl)
        .then((r) => r.blob())
        .then((blob) => {
          if (cancelled) return;
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
        .then((dataUrl) => {
          if (cancelled) return;
          setIconDataUrlCache((prev) => (prev[urlKey] === dataUrl ? prev : { ...prev, [urlKey]: dataUrl }));
        })
        .catch(() => { /* ignore per-icon failure */ });
    });
    return () => { cancelled = true; };
  }, [showGoogleGlobe, filteredFarms, getProductImageSrc]);

  const onGoogleViewChange = useCallback((next) => {
    setViewState((prev) => {
      const zoomDiff = Math.abs((next.zoom ?? prev.zoom) - prev.zoom);
      const centerDiff = Math.hypot(
        (next.longitude ?? prev.longitude) - prev.longitude,
        (next.latitude ?? prev.latitude) - prev.latitude
      );
      if (zoomDiff < 0.1 && centerDiff < 0.005) return prev;
      return { longitude: next.longitude ?? prev.longitude, latitude: next.latitude ?? prev.latitude, zoom: next.zoom ?? prev.zoom };
    });
  }, []);

  // When switching from Google globe to Mapbox (zoom in), resize Mapbox so it paints and markers show
  const prevShowGoogleRef = useRef(showGoogleGlobe);
  useEffect(() => {
    const wasGoogle = prevShowGoogleRef.current;
    prevShowGoogleRef.current = showGoogleGlobe;
    if (wasGoogle && !showGoogleGlobe) {
      const t = setTimeout(() => {
        const map = mapRef.current?.getMap?.();
        if (typeof map?.resize === 'function') map.resize();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [showGoogleGlobe]);

  // Guard: require Mapbox token to render the map
  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  if (!MAPBOX_TOKEN) {
    return (
      <div style={{
        height, width: '100%', position: 'relative', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px'
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '12px 16px',
          borderRadius: '8px', maxWidth: '600px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Mapbox token missing
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
            Set <code>REACT_APP_MAPBOX_ACCESS_TOKEN</code> in your frontend <code>.env</code>, then restart the dev server.
            See Mapbox docs for access tokens.
          </div>
        </div>
      </div>
    );
  }

  if (minimal) {
    const points = (Array.isArray(filteredFarms) && filteredFarms.length > 0 ? filteredFarms : farms)
      .filter(f => Array.isArray(f?.coordinates) && Number.isFinite(f.coordinates[0]) && Number.isFinite(f.coordinates[1]));
    const containerStyle = embedded
      ? { position: 'absolute', inset: 0, zIndex: 1 }
      : { height, width: '100%', position: 'relative', zIndex: 1, isolation: 'isolate' };

    return (
      <div style={{
        ...containerStyle,
        background: 'radial-gradient(ellipse at bottom, #0d1b2a 0%, #000000 100%)',
        overflow: 'hidden'
      }}>
        <div className="stars-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
        <MapboxMap
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          attributionControl={false}
          mapStyle={DARK_MAP_STYLE}
          onLoad={(e) => configureGlobeMap(e.target)}
          style={{ position: 'absolute', inset: 0 }}
          mapboxAccessToken={MAPBOX_TOKEN}
          projection="globe"
          onClick={() => {
            setSelectedProduct(null);
            setPopupPosition(null);
            setInsufficientFunds(false);
          }}
          initialViewState={{
            longitude: 12.5674,
            latitude: 41.8719,
            zoom: 1.5,
          }}
        >
          {points.map((f) => (
            <Marker
              key={f.id ?? `${f.coordinates[0]}-${f.coordinates[1]}-${f.name ?? ''}`}
              longitude={f.coordinates[0]}
              latitude={f.coordinates[1]}
              anchor="center"
            >
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPopupTab('details');
                  setSelectedProduct(f);

                  fetchLocationForProduct(f);
                  fetchWeatherForProduct(f);
                  const coords = f?.coordinates;

                  if (mapRef.current && Array.isArray(coords) && coords.length >= 2) {
                    const map = mapRef.current.getMap?.();
                    const currentZoom = map && typeof map.getZoom === 'function' ? map.getZoom() : viewState.zoom;
                    isMapAnimatingRef.current = true;
                    if (map && typeof map.once === 'function') {
                      map.once('moveend', () => {
                        isMapAnimatingRef.current = false;
                      });
                    } else {
                      setTimeout(() => { isMapAnimatingRef.current = false; }, 650);
                    }
                    mapRef.current.flyTo({ center: [coords[0], coords[1]], zoom: currentZoom, duration: 550, essential: true });
                  }
                  popupFixedRef.current = { left: '50%', top: '50%', transform: 'translate(-50%, calc(-100% - 14px))' };
                  setPopupPosition({ left: '50%', top: '50%', transform: 'translate(-50%, calc(-100% - 14px))' });
                }}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              >
                <img
                  src={getProductIcon(f.subcategory || f.category)}
                  alt={f.subcategory || f.category || 'Crop'}
                  style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'transparent' }}
                />
              </div>
            </Marker>
          ))}
        </MapboxMap>

        {selectedProduct && popupPosition && (
          <div
            key={`popup-${selectedProduct.id ?? 'field'}`}
            style={{
              position: 'absolute',
              left: popupPosition.left,
              top: popupPosition.top,
              transform: popupPosition.transform || 'translate(-50%, -50%)',
              zIndex: 1000,
              transition: 'left 450ms ease, top 450ms ease, transform 450ms ease',
              animation: !popupPosition.transform ? 'cardSlideIn 600ms ease both' : undefined
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: isMobile ? '8px' : '12px',
                padding: '0',
                width: isMobile ? '235px' : '280px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid #e9ecef',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'relative', padding: isMobile ? '6px 12px 0' : '8px 16px 0' }}>
                <div
                  onClick={() => {
                    setSelectedProduct(null);
                    setInsufficientFunds(false);
                  }}
                  style={{
                    cursor: 'pointer',
                    fontSize: isMobile ? '11px' : '13px',
                    color: '#6c757d',
                    width: isMobile ? '18px' : '22px',
                    height: isMobile ? '18px' : '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: '#f0f0f0',
                    position: 'absolute',
                    top: isMobile ? '5px' : '7px',
                    right: isMobile ? '5px' : '7px',
                    fontWeight: 'bold',
                    zIndex: 10
                  }}
                >
                  ✕
                </div>
              </div>

              <div style={{
                padding: isMobile ? '7px 10px 10px' : '8px 12px 12px',
                maxHeight: '75vh',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '7px' : '9px', marginBottom: isMobile ? '8px' : '10px' }}>
                  <div style={{
                    width: isMobile ? '44px' : '52px',
                    height: isMobile ? '44px' : '52px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: isMobile ? '4px' : '6px',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}>
                    <img
                      src={getProductImageSrc(selectedProduct)}
                      alt={selectedProduct.name || 'Product'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.src = getProductIcon(selectedProduct?.subcategory || selectedProduct?.category); }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '11px' : '13px', lineHeight: 1.25 }}>
                      {selectedProduct.name || selectedProduct.product_name || 'Field'}
                    </div>
                    {(selectedProduct.farmName || selectedProduct.farm_name) ? (
                      <div style={{ fontSize: isMobile ? '8px' : '10px', color: '#28a745', marginTop: '2px', fontWeight: 500 }}>
                        🏡 {selectedProduct.farmName || selectedProduct.farm_name}
                      </div>
                    ) : null}
                    <div style={{ fontSize: isMobile ? '8px' : '10px', color: '#6c757d', marginTop: '2px' }}>
                      ({(() => {
                        const ownerId = selectedProduct.farmer_id || selectedProduct.owner_id || selectedProduct.created_by;
                        const isOwner = currentUser?.id && ownerId && String(ownerId) === String(currentUser.id);
                        return isOwner ? (currentUser?.name || 'You') : (selectedProduct.farmer_name || selectedProduct.farmerName || 'Farmer');
                      })()})
                    </div>
                    {(() => {
                      const ownerId = selectedProduct.farmer_id || selectedProduct.owner_id || selectedProduct.created_by;
                      const isOwner = currentUser?.id && ownerId && String(ownerId) === String(currentUser.id);
                      if (!ownerId || isOwner) return null;
                      const messagesPath = userType === 'farmer' ? '/farmer/messages' : '/buyer/messages';
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(null);
                            setPopupPosition(null);
                            navigate(messagesPath, { state: { openWithUserId: ownerId, openWithUserName: selectedProduct.farmer_name || 'Field owner' } });
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px',
                            padding: '5px 8px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '6px',
                            fontSize: '10px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(76,175,80,0.3)'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" /></svg>
                          Chat to owner
                        </button>
                      );
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#64748b"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z" /></svg>
                      </span>
                      <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '9px' : '11px', marginLeft: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {productLocations.get(selectedProduct.id) || selectedProduct.location || 'Unknown location'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: isMobile ? '7px 0' : '9px 0' }} />

                {/* Tabs Header */}
                {renderPopupTabs()}

                {/* Tab Content */}
                {popupTab === 'details' ? (
                  <div style={{ animation: 'cardSlideIn 0.3s ease-out' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '10px' }}>
                      <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '9px' : '11px' }}>
                        Rented: {formatAreaInt(getOccupiedArea(selectedProduct))}m²
                      </div>
                      <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '9px' : '11px' }}>
                        Available: {formatAreaInt(getAvailableArea(selectedProduct))}m²
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 15H5V10h14v9z" /></svg>
                        </span>
                        <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '9px' : '11px' }}>Harvest Dates</div>
                      </div>
                      <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '9px' : '11px', textAlign: 'right', marginLeft: '10px' }}>
                        {(() => {
                          const list = getSelectedHarvestList(selectedProduct);
                          const uniq = Array.from(new Set(list));
                          return uniq.length ? uniq.join(', ') : 'Not specified';
                        })()}
                      </div>
                    </div>
                  </div>
                ) : renderWeatherTabContent()}
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      height, width: '100%', position: 'relative', zIndex: 1, isolation: 'isolate',
      background: 'radial-gradient(ellipse at bottom, #0d1b2a 0%, #000000 100%)',
      overflow: 'hidden'
    }}>
      <div className="stars-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      {/* Map stack: Weather mode = Google 2D with OWM layers; else Google globe + Mapbox */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {/* Weather mode: 2D Google Map with OpenWeatherMap overlays (reliable overlay support) */}
        {weatherLayerEnabled && (
          <GoogleMap2DWithWeather
            ref={googleWeatherMapRef}
            latitude={viewState.latitude}
            longitude={viewState.longitude}
            zoom={viewState.zoom}
            onViewChange={onGoogleViewChange}
            farms={filteredFarms}
            onMarkerClick={(product) => handleProductClick(null, product)}
            getMarkerSvg={getMarkerSvgForGoogle}
            isMobile={isMobile}
            iconDataUrlCache={iconDataUrlCache}
          />
        )}
        {!weatherLayerEnabled && (
        <>
        <GoogleGlobeMap
          ref={googleGlobeRef}
          visible={showGoogleGlobe}
          latitude={viewState.latitude}
          longitude={viewState.longitude}
          zoom={viewState.zoom}
          onViewChange={onGoogleViewChange}
          farms={filteredFarms}
          onMarkerClick={(product) => handleProductClick(null, product)}
          getMarkerSvg={getMarkerSvgForGoogle}
          isMobile={isMobile}
          iconDataUrlCache={iconDataUrlCache}
        />
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: showGoogleGlobe ? 0 : 2,
          visibility: showGoogleGlobe ? 'hidden' : 'visible',
          pointerEvents: showGoogleGlobe ? 'none' : 'auto',
        }}>
          <MapboxMap
            ref={mapRef}
            {...viewState}
            onMove={evt => {
              if (!isMapAnimatingRef.current) {
                setViewState(evt.viewState);
              }
            }}
            attributionControl={false}
            onClick={() => {
              setSelectedProduct(null);
              setPopupPosition(null); // Also clear popup position
              setInsufficientFunds(false);
            }}
            mapStyle={DARK_MAP_STYLE}
            onLoad={(e) => configureGlobeMap(e.target)}
            style={{ width: '100%', height: '100%' }}
            mapboxAccessToken={MAPBOX_TOKEN}
            projection="globe"
            initialViewState={{
              longitude: 12.5674,
              latitude: 41.8719,
              zoom: 1.5,
            }}
          >

            <NavigationControl position="top-right" style={{ marginTop: embedded ? '55px' : (isMobile ? '80px' : '110px'), marginRight: '10px' }} />
            <FullscreenControl position="top-right" style={{ marginTop: embedded ? '10px' : (isMobile ? '30px' : '35px'), marginRight: '10px' }} />

            {/* Current Location Marker with Pulsing Animation */}
            {currentLocation && (
              <Marker
                longitude={currentLocation.longitude}
                latitude={currentLocation.latitude}
                anchor="center"
              >
                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                  {/* Pulsing circles */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(66, 133, 244, 0.3)',
                      animation: 'locationPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(66, 133, 244, 0.4)',
                      animation: 'locationPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.5s',
                    }}
                  />
                  {/* Blue location icon */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#4285F4',
                      border: '3px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      zIndex: 10,
                    }}
                  />
                  {/* Inner dot */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      zIndex: 11,
                    }}
                  />
                </div>
              </Marker>
            )}

            {/* Farm Markers - Geolocation/Home moved to shared overlay above */}
            {(() => {

              return filteredFarms.map((product) => {

                // Handle coordinate format conversion and null checks
                let longitude, latitude;

                if (!product.coordinates) {
                  console.warn('⚠️ Skipping product with no coordinates:', product.name);
                  return null; // Skip rendering if no coordinates
                }

                if (Array.isArray(product.coordinates)) {
                  // Array format: [longitude, latitude]
                  longitude = product.coordinates[0];
                  latitude = product.coordinates[1];
                } else if (typeof product.coordinates === 'object') {
                  // Object format: { lat: ..., lng: ... } or { latitude: ..., longitude: ... }
                  longitude = product.coordinates.lng || product.coordinates.longitude;
                  latitude = product.coordinates.lat || product.coordinates.latitude;
                } else {
                  return null; // Skip if coordinates format is unknown
                }

                // Skip if coordinates are still null/undefined
                if (longitude == null || latitude == null) {
                  return null;
                }


                return (
                  <Marker
                    key={product.id}
                    longitude={longitude}
                    latitude={latitude}
                    anchor="center"
                  >
                    <div style={{ position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={(e) => handleProductClick(e, product)} >
                      {(isProductPurchased(product) && showHarvestGifIds.has(product.id)) && (
                        <img
                          src={'/icons/effects/fric.gif'}
                          alt="Harvest celebration effect"
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: `${harvestGifSize}px`,
                            height: `${harvestGifSize}px`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 9999,
                            willChange: 'transform',
                          }}
                        />
                      )}
                      {isProductPurchased(product) && (() => {
                        const size = isMobile ? 46 : 60;
                        const strokeW = isMobile ? 4 : 5;
                        const innerR = isMobile ? 18 : 22;
                        const { progress } = getHarvestProgressInfo(product);
                        const grad = getRingGradientByHarvest(product);
                        const occ = getOccupiedArea(product);
                        const total = typeof product.total_area === 'string' ? parseFloat(product.total_area) : (product.total_area || 0);
                        const occRatio = total > 0 ? Math.max(0, Math.min(1, occ / total)) : 0;
                        const r = (size / 2) - (strokeW / 2);
                        const circumference = 2 * Math.PI * r;
                        const dash = Math.max(0, Math.min(circumference, progress * circumference));
                        const path = getPiePath(innerR, occRatio);
                        const cx = size / 2;
                        const cy = size / 2;
                        const ringGradId = `ringGrad-${product.id}`;
                        const glowId = `ringGlow-${product.id}`;
                        const rentGradId = `rentGrad-${product.id}`;

                        return (
                          <svg
                            width={size}
                            height={size}
                            style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1 }}
                          >
                            <defs>
                              <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={grad.start} stopOpacity="0.95" />
                                <stop offset="100%" stopColor={grad.end} stopOpacity="0.95" />
                              </linearGradient>
                              <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#FFD8A8" floodOpacity="0.45" />
                              </filter>
                              <radialGradient id={rentGradId} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="rgba(33,150,243,0.7)" />
                                <stop offset="100%" stopColor="rgba(33,150,243,0.4)" />
                              </radialGradient>
                            </defs>
                            <circle cx={cx} cy={cy} r={r} stroke={'rgba(255,255,255,0.30)'} strokeWidth={strokeW} fill="none" />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              stroke={`url(#${ringGradId})`}
                              strokeWidth={strokeW}
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={`${dash} ${circumference}`}
                              strokeDashoffset={0}
                              transform={`rotate(-90 ${cx} ${cy})`}
                              filter={`url(#${glowId})`}
                            />
                            <path d={path} fill={`url(#${rentGradId})`} stroke={'rgba(33,150,243,0.85)'} strokeWidth={1.1} transform={`translate(${cx - innerR}, ${cy - innerR})`} />
                          </svg>
                        );
                      })()}
                      {(isProductPurchased(product) && isHarvestWithinGrace(product, 4)) && (() => {
                        const modes = getShippingModes(product).map(m => (m || '').toLowerCase());
                        const mode = modes.includes('pickup') ? 'pickup' : (modes.includes('delivery') ? 'delivery' : null);
                        return mode ? addShippingOrbit(product, mode) : null;
                      })()}
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name || product.productName || 'Product'}
                        onError={(e) => {
                          // Debug: image failed, fallback to product icon
                          // eslint-disable-next-line no-console
                          console.warn('[Marker Image Error] Fallback to icon:', product.id, product.name, product.image);
                          const fallback = getProductIcon(product.subcategory || product.category);
                          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                        style={{
                          width: isMobile ? '20px' : '30px',
                          height: isMobile ? '20px' : '30px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          display: 'block',
                          position: 'relative',
                          zIndex: 5,
                          border: product.isFarmerCreated ? '3px solid #4CAF50' : 'none',
                          filter: isProductPurchased(product)
                            ? 'brightness(1) drop-shadow(0 0 12px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.7))'
                            : product.isFarmerCreated
                              ? 'brightness(1.1) drop-shadow(0 0 8px rgba(76, 175, 80, 0.6)) drop-shadow(0 0 16px rgba(76, 175, 80, 0.4))'
                              : 'none',
                          backgroundColor: 'transparent',
                          padding: '0',
                          transition: 'all 0.3s ease',
                          transformOrigin: 'center bottom',

                          animation: isProductPurchased(product)
                            ? 'glow-pulse-white 1.5s infinite, heartbeat 2s infinite'
                            : product.isFarmerCreated
                              ? 'glow-farmer-created 3s infinite'
                              : 'none',
                          ...(harvestingIds.has(product.id) ? { animation: 'harvest-bounce 700ms ease-in-out infinite' } : {})
                        }}
                      />
                      {/* Farmer Created Badge */}
                      {product.isFarmerCreated && (
                        <div style={{
                          position: 'absolute',
                          top: isMobile ? '-5px' : '-8px',
                          right: isMobile ? '-5px' : '-8px',
                          width: isMobile ? '12px' : '16px',
                          height: isMobile ? '12px' : '16px',
                          backgroundColor: '#4CAF50',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: isMobile ? '8px' : '10px',
                          color: 'white',
                          fontWeight: 'bold',
                          border: '2px solid white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          zIndex: 10
                        }}>
                          F
                        </div>
                      )}
                    </div>
                  </Marker>
                );
              }).filter(Boolean);
            })()}


          </MapboxMap>
        </div>
        </>
        )}
      </div>

      {/* Map controls (Geolocation, Home) - only relevant for 2D weather map */}
      {weatherLayerEnabled && (
        <div
          style={{
            position: 'absolute',
            top: embedded ? (isMobile ? '110px' : '120px') : (isMobile ? '220px' : '265px'),
            right: '10px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setCurrentLocation({ latitude, longitude });
                    if (googleWeatherMapRef.current) {
                      googleWeatherMapRef.current.flyTo({ center: [longitude, latitude], zoom: 10 });
                    }
                  },
                  () => {
                    setCurrentLocation(null);
                    if (googleWeatherMapRef.current) {
                      googleWeatherMapRef.current.flyTo({ center: [15, 45], zoom: 2 });
                    }
                  }
                );
              }
            }}
            style={{
              background: '#fff',
              border: '2px solid rgba(0,0,0,.1)',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
              boxShadow: '0 0 0 2px rgba(0,0,0,.1)',
              width: '29px',
              height: '29px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Center on my location"
          >
            📍
          </button>
          <button
            onClick={() => {
              setSelectedProduct(null);
              setPopupPosition(null);
              setInsufficientFunds(false);
              if (googleWeatherMapRef.current) {
                googleWeatherMapRef.current.flyTo({ center: [15, 45], zoom: 2 });
              }
            }}
            style={{
              background: '#fff',
              border: '2px solid rgba(0,0,0,.1)',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
              boxShadow: '0 0 0 2px rgba(0,0,0,.1)',
              width: '29px',
              height: '29px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Reset view"
          >
            🏠
          </button>
        </div>
      )}

      {/* Small label so users know they're in weather mode and how to exit */}
      {weatherLayerEnabled && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(148,163,184,0.7)',
            color: 'rgba(226,232,240,0.95)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <Cloud sx={{ fontSize: 16 }} />
          <span>Weather view – click the cloud icon to return</span>
        </Box>
      )}

      {/* Top-left controls: weather + delivery – same circle UI as header notification/message icons */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Tooltip title={weatherLayerEnabled ? 'Exit weather view (back to 3D globe)' : 'Weather view (2D map with overlays)'}>
          <IconButton
            onClick={() => setWeatherLayerEnabled((prev) => !prev)}
            sx={(theme) => ({
              backgroundColor: weatherLayerEnabled ? alpha(theme.palette.info.main, 0.25) : alpha(theme.palette.common.white, 0.12),
              color: weatherLayerEnabled ? theme.palette.info.main : theme.palette.common.white,
              border: `1px solid ${weatherLayerEnabled ? alpha(theme.palette.info.main, 0.4) : alpha(theme.palette.common.white, 0.25)}`,
              '&:hover': {
                backgroundColor: weatherLayerEnabled ? alpha(theme.palette.info.main, 0.35) : alpha(theme.palette.common.white, 0.2),
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease-in-out',
              '& .MuiSvgIcon-root': { fontSize: isMobile ? 20 : 24 },
            })}
          >
            <Cloud />
          </IconButton>
        </Tooltip>
        <Tooltip title="Deliveries">
          <IconButton
            ref={deliveryIconRef}
            onClick={() => setShowDeliveryModal(true)}
            sx={(theme) => ({
              backgroundColor: alpha(theme.palette.warning.main, 0.2),
              color: theme.palette.warning.main,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
              '&:hover': {
                backgroundColor: alpha(theme.palette.warning.main, 0.3),
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease-in-out',
              '& .MuiSvgIcon-root': { fontSize: isMobile ? 20 : 24 },
            })}
          >
            <LocalShipping />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Delivery modal – center screen, list of user's delivery orders or "No deliveries" */}
      <Dialog open={showDeliveryModal} onClose={() => setShowDeliveryModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShipping color="primary" /> Deliveries
          </Box>
          <IconButton size="small" onClick={() => setShowDeliveryModal(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deliveryListLoading ? (
            <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>Loading…</Box>
          ) : deliveryList.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
              <LocalShipping sx={{ fontSize: 48, opacity: 0.4, mb: 1 }} />
              <Typography>No deliveries</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>You have no delivery orders at the moment.</Typography>
            </Box>
          ) : (
            <>
              {(() => {
                const buyerCount = deliveryList.filter((d) => d.role === 'buyer').length;
                const farmerCount = deliveryList.filter((d) => d.role === 'farmer').length;
                const hasBuyer = buyerCount > 0;
                const hasFarmer = farmerCount > 0;
                const effectiveRole =
                  deliveryRoleTab && ((deliveryRoleTab === 'buyer' && hasBuyer) || (deliveryRoleTab === 'farmer' && hasFarmer))
                    ? deliveryRoleTab
                    : hasBuyer
                      ? 'buyer'
                      : 'farmer';

                const filtered = deliveryList.filter((d) => d.role === effectiveRole);
                const bucketOrder = ['current', 'upcoming', 'past'];
                const bucketLabels = {
                  current: 'Delivering now',
                  upcoming: 'Upcoming deliveries',
                  past: 'Past deliveries',
                };
                const bucketHelp = {
                  current: 'Deliveries that should be happening today or very soon.',
                  upcoming: 'Confirmed deliveries scheduled for future dates.',
                  past: 'Deliveries that are already completed or cancelled.',
                };

                const statusColor = (status) => {
                  const value = String(status || '').toLowerCase();
                  if (value === 'completed') return 'success';
                  if (value === 'active' || value === 'pending') return 'info';
                  if (value === 'cancelled') return 'default';
                  return 'default';
                };

                return (
                  <>
                    {(hasBuyer || hasFarmer) && (
                      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          View:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {hasBuyer && (
                            <Chip
                              size="small"
                              color={effectiveRole === 'buyer' ? 'primary' : 'default'}
                              variant={effectiveRole === 'buyer' ? 'filled' : 'outlined'}
                              label={`Incoming (${buyerCount})`}
                              onClick={() => setDeliveryRoleTab('buyer')}
                              sx={{ borderRadius: 999 }}
                            />
                          )}
                          {hasFarmer && (
                            <Chip
                              size="small"
                              color={effectiveRole === 'farmer' ? 'primary' : 'default'}
                              variant={effectiveRole === 'farmer' ? 'filled' : 'outlined'}
                              label={`Outgoing (${farmerCount})`}
                              onClick={() => setDeliveryRoleTab('farmer')}
                              sx={{ borderRadius: 999 }}
                            />
                          )}
                        </Box>
                      </Box>
                    )}

                    {bucketOrder.map((bucketKey) => {
                      const items = filtered.filter((d) => d.bucket === bucketKey);
                      if (!items.length) return null;

                      return (
                        <Box key={bucketKey} sx={{ mt: bucketKey === 'current' ? 0 : 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor:
                                    bucketKey === 'current'
                                      ? 'success.main'
                                      : bucketKey === 'upcoming'
                                        ? 'info.main'
                                        : 'grey.500',
                                }}
                              />
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {bucketLabels[bucketKey]} ({items.length})
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                            {bucketHelp[bucketKey]}
                          </Typography>

                          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                            {items.map((d) => {
                              const o = d.order || {};
                              const isBuyer = d.role === 'buyer';
                              const counterpartyName = isBuyer ? o.farmer_name || 'Seller' : o.buyer_name || 'Customer';
                              const counterpartyLabel = isBuyer ? 'From' : 'To';
                              const location = o.location || d.deliveryAddress || '';
                              const quantity = o.quantity;
                              const totalPrice = o.total_price;
                              const mode = o.mode_of_shipping || 'delivery';
                              const crop = o.crop_type || o.field_name;
                              const dateRaw = o.selected_harvest_date || o.created_at || d.harvestDate;
                              const label = o.selected_harvest_label;

                              let dateDisplay = '';
                              if (dateRaw) {
                                try {
                                  const parsed = new Date(dateRaw);
                                  // eslint-disable-next-line no-restricted-globals
                                  if (!isNaN(parsed)) {
                                    dateDisplay = parsed.toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    });
                                  } else {
                                    dateDisplay = String(dateRaw);
                                  }
                                } catch {
                                  dateDisplay = String(dateRaw);
                                }
                              }

                              const imageSrc = o.image_url;

                              return (
                                <Box
                                  component="li"
                                  key={d.id}
                                  sx={{
                                    py: 1.5,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    display: 'flex',
                                    gap: 1.5,
                                  }}
                                >
                                  {imageSrc && (
                                    <Box
                                      sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        bgcolor: 'grey.100',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <img
                                        src={imageSrc}
                                        alt={d.productName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    </Box>
                                  )}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {d.productName}
                                      </Typography>
                                      <Chip
                                        size="small"
                                        label={d.status}
                                        color={statusColor(d.status)}
                                        variant="outlined"
                                        sx={{ textTransform: 'capitalize' }}
                                      />
                                    </Box>

                                    <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {crop && (
                                        <Typography variant="caption" color="text.secondary">
                                          {crop}
                                        </Typography>
                                      )}
                                      {typeof quantity !== 'undefined' && (
                                        <Typography variant="caption" color="text.secondary">
                                          Qty: {quantity}
                                        </Typography>
                                      )}
                                      {typeof totalPrice !== 'undefined' && (
                                        <Typography variant="caption" color="text.secondary">
                                          Total: {totalPrice} coins
                                        </Typography>
                                      )}
                                      {mode && (
                                        <Typography variant="caption" color="text.secondary">
                                          Mode: {String(mode).toLowerCase()}
                                        </Typography>
                                      )}
                                    </Box>

                                    {(dateDisplay || label) && (
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {dateDisplay}
                                        {label ? ` • ${label}` : ''}
                                      </Typography>
                                    )}

                                    {location && (
                                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                                        {location}
                                      </Typography>
                                    )}

                                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', fontWeight: 500 }}>
                                      {counterpartyLabel}: {counterpartyName}
                                    </Typography>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Box sx={{ flexGrow: 1 }} />
          <button
            type="button"
            onClick={() => setShowDeliveryModal(false)}
            style={{
              borderRadius: 6,
              border: '1px solid rgba(148,163,184,0.6)',
              padding: '6px 14px',
              fontSize: 13,
              cursor: 'pointer',
              background: '#f8fafc',
            }}
          >
            Close
          </button>
        </DialogActions>
      </Dialog>

      {/* Custom Scale Bar - Mapbox only; Google Maps 2D has different API */}
      <CustomScaleBar map={!weatherLayerEnabled ? mapRef.current?.getMap() : null} />

      <div ref={harvestLayerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1050 }}>
        {harvestGifs.map(g => (
          <img
            key={`harvest-gif-${g.id}`}
            src={g.src}
            alt="Harvest animation"
            style={{
              position: 'absolute',
              width: `${g.size}px`,
              height: `${g.size}px`,
              left: g.x,
              top: g.y,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}
      </div>

      {showDeliveryPanel && deliveryTodayCards.length > 0 && (
        <div style={{ position: 'absolute', top: isMobile ? '120px' : '140px', left: `${deliveryPanelLeft}px`, zIndex: 1100, display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '10px' }}>
          {deliveryTodayCards.slice(0, 5).map(item => (
            <div key={`delivery-card-${item.id}`} style={{ width: isMobile ? '60px' : '72px', borderRadius: isMobile ? '10px' : '12px', background: 'linear-gradient(135deg, #ffffff 0%, #fff7e6 100%)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #ffe0b2', overflow: 'hidden', animation: 'cardGlow 2800ms ease-in-out infinite' }}>
              <div style={{ width: '100%', height: isMobile ? '26px' : '30px', backgroundColor: '#fff0d9' }}>
                <img src={getProductImageSrc(item.product)} alt={item.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = getProductIcon(item.category); }} />
              </div>
              <div style={{ padding: isMobile ? '5px' : '6px' }}>
                <div style={{ fontWeight: 700, color: '#7c4d00', fontSize: isMobile ? '9px' : '10px' }}>{item.name}</div>
                <div style={{ marginTop: isMobile ? '2px' : '3px', fontWeight: 600, color: '#0f766e', fontSize: isMobile ? '8px' : '9px' }}>Ready for delivery</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={burstsLayerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}>
        {bursts.map(p => (
          <img
            key={p.id}
            src={p.src}
            alt="Purchase celebration effect"
            style={{
              position: 'absolute',
              width: isMobile ? '32px' : '46px',
              height: isMobile ? '32px' : '46px',
              left: p.x,
              top: p.y,
              transform: p.stage === 'pop'
                ? `translate(${p.px - p.x}px, ${p.py - p.y}px) scale(1.6) rotate(${p.rot || 0}deg)`
                : p.stage === 'toMid'
                  ? `translate(${p.mx - p.x}px, ${p.my - p.y}px) scale(1.15) rotate(${(p.rot || 0) / 2}deg)`
                  : p.stage === 'toBar'
                    ? `translate(${p.tx - p.x}px, ${p.ty - p.y}px) scale(0.82) rotate(${(p.rot || 0) / 3}deg)`
                    : `translate(${p.tx - p.x}px, ${p.ty - p.y + 10}px) scale(0.62) rotate(0deg)`,
              opacity: p.stage === 'pop' ? 1 : p.stage === 'toMid' ? 0.95 : p.stage === 'toBar' ? 0.88 : 0.7,
              transition: p.stage === 'pop'
                ? 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 650ms ease'
                : p.stage === 'toMid'
                  ? 'transform 850ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 850ms ease'
                  : p.stage === 'toBar'
                    ? 'transform 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 900ms ease'
                    : 'transform 600ms ease-out, opacity 600ms ease-out'
            }}
          />
        ))}
      </div>

      <div ref={deliveryFlyLayerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1101 }}>
        {deliveryFlyCards.map(c => (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              transform: c.stage === 'arrive' ? 'translate(-50%, -50%) scale(0.6)' : 'translate(-50%, -50%)',
              transition: 'left 2400ms cubic-bezier(0.22, 1, 0.36, 1), top 2400ms cubic-bezier(0.22, 1, 0.36, 1), transform 120ms ease',
              animation: c.stage === 'fly' ? 'flipTravelY 900ms ease-in-out' : undefined,
              width: isMobile ? 64 : 76,
              borderRadius: isMobile ? 8 : 10,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              border: '1px solid #ffe0b2',
              background: 'linear-gradient(135deg, #ffffff 0%, #fff7e6 100%)'
            }}
          >
            <div style={{ width: '100%', height: isMobile ? 28 : 32 }}>
              <img src={getProductImageSrc(c.product)} alt={c.product.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = getProductIcon(c.product.subcategory || c.product.category); }} />
            </div>
            <div style={{ padding: isMobile ? '3px' : '5px' }}>
              <div style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: 700, color: '#7c4d00' }}>{c.product.name || 'Field'}</div>
              {Number.isFinite(c.rented) && c.rented > 0 && (
                <div style={{ marginTop: isMobile ? '1px' : '2px', fontSize: isMobile ? '8px' : '9px', color: '#6c757d', fontWeight: 600 }}>
                  Your rented: {formatAreaInt(c.rented)}m²
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Product Summary Bar */}
      <ProductSummaryBar
        purchasedProducts={purchasedSummary}
        onProductClick={handleSummaryProductClick}
        summaryRef={summaryBarRef}
        onIconPositionsUpdate={setIconTargets}
        activeKeys={selectedIcons}
        onResetFilters={handleResetFilters}
      />

      {/* Custom Popup */}
      {selectedProduct && popupPosition && (
        <div
          key={`popup-${selectedProduct.id}`}
          style={{
            position: 'absolute',
            left: popupPosition.left,
            top: popupPosition.top,
            transform: popupPosition.transform || 'translate(-50%, -50%)',
            zIndex: 1000,
            transition: 'left 450ms ease, top 450ms ease, transform 450ms ease',
            animation: !popupPosition.transform ? 'cardSlideIn 600ms ease both' : undefined
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: isMobile ? '8px' : '12px',
              padding: '0',
              width: isMobile ? '280px' : '340px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid #e9ecef',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Header with close button and webcam icon */}
            <div style={{ position: 'relative', padding: isMobile ? '6px 12px 0' : '8px 16px 0' }}>
              <div
                onClick={() => {
                  setSelectedProduct(null);
                  setInsufficientFunds(false);
                }}
                style={{
                  cursor: 'pointer',
                  fontSize: isMobile ? '12px' : '14px',
                  color: '#6c757d',
                  width: isMobile ? '20px' : '24px',
                  height: isMobile ? '20px' : '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  position: 'absolute',
                  top: isMobile ? '6px' : '8px',
                  right: isMobile ? '6px' : '8px',
                  fontWeight: 'bold',
                  zIndex: 10
                }}
              >
                ✕
              </div>

              {/* Edit button for farmers - only show for farmer's own fields */}
              {userType === 'farmer' && selectedProduct.isOwnField && onEditField && (
                <div style={{
                  position: 'absolute',
                  top: isMobile ? '6px' : '8px',
                  right: isMobile ? '60px' : '72px',
                  width: isMobile ? '28px' : '32px',
                  height: isMobile ? '28px' : '32px',
                  backgroundColor: '#28a745',
                  borderRadius: isMobile ? '6px' : '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(40, 167, 69, 0.3)',
                  transition: 'all 0.2s ease',
                  border: '2px solid white',
                  zIndex: 10
                }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#218838';
                    e.target.style.transform = 'scale(1.1)';
                    e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#28a745';
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.3)';
                  }}
                  onClick={() => onEditField(selectedProduct)}
                  title="Edit Field"
                >
                  <svg width={isMobile ? "14" : "16"} height={isMobile ? "14" : "16"} viewBox="0 0 24 24" fill="white">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </div>
              )}





              {/* Location */}
              {showPurchaseUI && (
                <div style={{
                  fontSize: isMobile ? '9px' : '10px',
                  color: '#6c757d',
                  marginBottom: isMobile ? '6px' : '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: 500
                }}>
                  {(() => {
                    const cachedLocation = productLocations.get(selectedProduct.id);
                    const fallbackLocation = selectedProduct.location;
                    const displayLocation = cachedLocation || fallbackLocation || 'LOADING LOCATION...';
                    return displayLocation;
                  })()}
                </div>
              )}
            </div>

            {/* Content */}
            <div
              ref={popupContentScrollRef}
              style={{
                padding: isMobile ? '0 12px 12px' : '0 16px 16px',
                position: 'relative',
                maxHeight: '75vh',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style>
                {`@keyframes popupPulse { 0% { transform: scale(1); } 100% { transform: scale(1.07); } }`}
              </style>
              {/* Main Content Row */}
              <div style={{ display: 'flex', gap: isMobile ? '8px' : '10px', marginBottom: isMobile ? '10px' : '12px' }}>
                {showPurchaseUI && (
                  <>
                    {/* Left side - Product Image */}
                    <div style={{
                      width: isMobile ? '60px' : '70px',
                      height: isMobile ? '60px' : '70px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: isMobile ? '4px' : '6px',
                      flexShrink: 0
                    }}>
                      <img
                        src={getProductImageSrc(selectedProduct)}
                        alt={selectedProduct.name || selectedProduct.productName || 'Product'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: isMobile ? '4px' : '6px' }}
                        onError={(e) => { e.currentTarget.src = getProductIcon(selectedProduct?.subcategory || selectedProduct?.category); }}
                      />
                    </div>

                    {/* Middle - Product Info */}
                    <div style={{ flex: 1 }}>
                      {/* Product Name and Category */}
                      <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: '2px' }}>
                        {selectedProduct.category || 'Category'}
                      </div>
                      <div style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 600, color: '#212529', marginBottom: '2px' }}>
                        {selectedProduct.name || 'Product Name'}
                      </div>

                      {/* Farm Name */}
                      {selectedProduct.farmName && (
                        <div style={{ fontSize: isMobile ? '9px' : '11px', color: '#28a745', marginBottom: '2px', fontWeight: 500 }}>
                          🏡 {selectedProduct.farmName}
                        </div>
                      )}

                      {/* Farmer Name - use current user name when they own the field (avoids stale "Demo Farmer") */}
                      <div style={{ fontSize: isMobile ? '9px' : '11px', color: '#6c757d', marginBottom: isMobile ? '6px' : '8px' }}>
                        ({(() => {
                          const ownerId = selectedProduct.farmer_id || selectedProduct.owner_id || selectedProduct.created_by;
                          const isOwner = currentUser?.id && ownerId && String(ownerId) === String(currentUser.id);
                          return (selectedProduct.isOwnField || isOwner) ? (currentUser?.name || 'You') : (selectedProduct.farmer_name || 'Farmer');
                        })()})
                      </div>

                      {/* Action Buttons: Chat & Webcam */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: isMobile ? '8px' : '10px' }}>
                        {/* Chat to owner */}
                        {(() => {
                          const ownerId = selectedProduct.farmer_id || selectedProduct.owner_id || selectedProduct.created_by;
                          const isOwner = currentUser?.id && ownerId && String(ownerId) === String(currentUser.id);
                          if (!ownerId || isOwner) return null;
                          const messagesPath = userType === 'farmer' ? '/farmer/messages' : '/buyer/messages';
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(null);
                                setPopupPosition(null);
                                navigate(messagesPath, { state: { openWithUserId: ownerId, openWithUserName: selectedProduct.farmer_name || 'Field owner' } });
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: isMobile ? '4px 8px' : '6px 10px',
                                backgroundColor: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: isMobile ? '10px' : '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(76, 175, 80, 0.25)',
                                transition: 'all 0.2s ease',
                                flex: 1,
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#43a047';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.35)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#4caf50';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(76, 175, 80, 0.25)';
                              }}
                              title="Chat with owner"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" /></svg>
                              Chat
                            </button>
                          );
                        })()}

                        {/* Webcam button */}
                        {selectedProduct?.webcam_url && (
                          <button
                            type="button"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: isMobile ? '4px 8px' : '6px 10px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: isMobile ? '10px' : '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0, 123, 255, 0.25)',
                              transition: 'all 0.2s ease',
                              flex: 1,
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#0056b3';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 123, 255, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#007bff';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 123, 255, 0.25)';
                            }}
                            onClick={() => {
                              setSelectedFarmForWebcam({
                                name: selectedProduct?.farm_name || selectedProduct?.name || 'Farm',
                                webcamUrl: selectedProduct?.webcam_url
                              });
                              setWebcamPopupOpen(true);
                            }}
                            title="View Live Camera Feed"
                          >
                            <svg width={isMobile ? "12" : "14"} height={isMobile ? "12" : "14"} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7-3.5c0-1-.3-2-.8-2.8l2.4-2.4c.8 1.3 1.3 2.8 1.3 4.4s-.5 3.1-1.3 4.4l-2.4-2.4c.5-.8.8-1.8.8-2.8M4.3 19.3l2.4-2.4c.8.5 1.8.8 2.8.8s2-.3 2.8-.8l2.4 2.4c-1.3.8-2.8 1.3-4.4 1.3s-3.1-.5-4.4-1.3M19.7 4.7l-2.4 2.4c-.8-.5-1.8-.8-2.8-.8s-2 .3-2.8.8L9.3 4.7C10.6 3.9 12.2 3.4 13.8 3.4s3.1.5 4.4 1.3z" />
                              <circle cx="12" cy="12" r="3" fill="currentColor" />
                            </svg>
                            Cam
                          </button>
                        )}
                      </div>

                      {/* Rating */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginBottom: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} style={{ color: star <= 4 ? '#ffc107' : '#e9ecef', fontSize: isMobile ? '10px' : '12px' }}>★</span>
                        ))}
                      </div>

                      {/* Weather */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px' }}>🌤️</span>
                        <div style={{ fontSize: isMobile ? '9px' : '11px', color: '#6c757d' }}>
                          {productWeather.get(String(selectedProduct.id))?.weatherString || selectedProduct.weather || 'Unknown weather'}

                        </div>
                      </div>
                    </div>

                    {/* Right side - Area Info */}
                    <div style={{
                      width: isMobile ? '60px' : '70px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: '3px' }}>
                        {formatAreaInt(getOccupiedArea(selectedProduct))}/{formatAreaInt(selectedProduct.total_area || 0)}m²
                      </div>
                      <div style={{
                        width: '100%',
                        height: isMobile ? '4px' : '6px',
                        backgroundColor: '#e9ecef',
                        borderRadius: isMobile ? '2px' : '3px',
                        overflow: 'hidden',
                        marginBottom: '3px'
                      }}>
                        <div style={{
                          width: `${Math.round(((getOccupiedArea(selectedProduct) || 0) / (selectedProduct.total_area || 1)) * 100)}%`,
                          height: '100%',
                          backgroundColor: '#28a745'
                        }} />
                      </div>
                      <div style={{
                        fontSize: isMobile ? '9px' : '11px',
                        color: '#28a745',
                        fontWeight: 600,
                        textAlign: 'right'
                      }}>
                        {Math.round(((getOccupiedArea(selectedProduct) || 0) / (selectedProduct.total_area || 1)) * 100)}%
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Tab Navigation */}
              {renderPopupTabs()}

              {/* Tab Content */}
              {popupTab === 'details' ? (
                <div style={{ animation: 'cardSlideIn 0.3s ease-out' }}>
                  {showPurchaseUI && (
                    <>
                      {/* Divider Line */}
                      <div style={{ height: '1px', backgroundColor: '#e9ecef', margin: isMobile ? '10px 0' : '12px 0' }} />

                      {/* Harvest Dates */}
                      <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: isMobile ? '10px' : '12px' }}>
                        {(() => {
                          const harvestDates = selectedProduct.harvest_dates || selectedProduct.harvestDates;
                          const singleDate = selectedProduct.harvest_date || selectedProduct.harvestDate;

                          // Function to format a date
                          const formatDate = (date) => {
                            if (!date) return null;

                            // If it's already in the desired format, return as is
                            if (typeof date === 'string' && /^\d{1,2}\s\w{3}\s\d{4}$/.test(date)) {
                              return date;
                            }

                            // Try to parse and format the date
                            try {
                              const parsedDate = new Date(date);
                              if (isNaN(parsedDate.getTime())) return date; // Return original if invalid

                              const day = parsedDate.getDate();
                              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                              const month = months[parsedDate.getMonth()];
                              const year = parsedDate.getFullYear();

                              return `${day} ${month} ${year}`;
                            } catch (e) {
                              return date; // Return original if parsing fails
                            }
                          };

                          // Handle multiple harvest dates - make them selectable
                          if (harvestDates && Array.isArray(harvestDates) && harvestDates.length > 0) {
                            const validDates = harvestDates.filter(hd => hd.date && hd.date.trim() !== '');

                            if (validDates.length === 0) {
                              return 'Estimated harvest Date: Not specified';
                            }

                            if (validDates.length === 1) {
                              const formattedDate = formatDate(validDates[0].date);
                              const label = validDates[0].label ? ` (${validDates[0].label})` : '';
                              const dateObj = validDates[0];

                              // Auto-select the single date if not already selected
                              if (!selectedHarvestDate) {
                                setSelectedHarvestDate(dateObj);
                              }

                              return (
                                <div>
                                  <div style={{ marginBottom: '4px', fontWeight: '500' }}>Estimated harvest Date:</div>
                                  <div
                                    style={{
                                      marginLeft: '8px',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      backgroundColor: '#007bff',
                                      color: 'white',
                                      borderRadius: '4px',
                                      display: 'inline-block',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {formattedDate}{label}
                                  </div>
                                </div>
                              );
                            }

                            // Multiple dates - make them selectable
                            return (
                              <div>
                                <div style={{ marginBottom: '6px', fontWeight: '500' }}>Select harvest Date:</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {validDates.map((hd, index) => {
                                    const formattedDate = formatDate(hd.date);
                                    const label = hd.label ? ` (${hd.label})` : '';
                                    const isSelected = selectedHarvestDate && selectedHarvestDate.date === hd.date;

                                    return (
                                      <div
                                        key={index}
                                        onClick={() => setSelectedHarvestDate(hd)}
                                        style={{
                                          marginLeft: '8px',
                                          fontSize: '11px',
                                          padding: '4px 8px',
                                          backgroundColor: isSelected ? '#007bff' : '#f8f9fa',
                                          color: isSelected ? 'white' : '#6c757d',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          border: isSelected ? 'none' : '1px solid #e9ecef',
                                          fontWeight: isSelected ? '500' : 'normal',
                                          transition: 'all 0.2s ease',
                                          width: '70px',
                                          textAlign: 'center',
                                        }}
                                      >
                                        {formattedDate}{label}
                                      </div>
                                    );
                                  })}
                                </div>
                                {!selectedHarvestDate && (
                                  <div style={{
                                    fontSize: '10px',
                                    color: '#dc3545',
                                    marginTop: '4px',
                                    marginLeft: '8px'
                                  }}>
                                    Please select a harvest date to proceed
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Fallback to single date
                          const formattedDate = formatDate(singleDate);
                          if (singleDate) {
                            // Auto-select the single date if not already selected
                            if (!selectedHarvestDate) {
                              setSelectedHarvestDate({ date: singleDate, label: '' });
                            }

                            return (
                              <div>
                                <div style={{ marginBottom: '4px', fontWeight: '500' }}>Estimated harvest Date:</div>
                                <div
                                  style={{
                                    marginLeft: '8px',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    borderRadius: '4px',
                                    display: 'inline-block'
                                  }}
                                >
                                  {formattedDate || 'Not specified'}
                                </div>
                              </div>
                            );
                          }

                          return 'Estimated harvest Date: Not specified';
                        })()}
                      </div>



                      {/* Bottom Section */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Left Side - Quantity, Price, Shipping */}
                        <div style={{ flex: 1 }}>
                          {/* Rent disabled: Buy vs Rent toggle and Rent duration commented out – only buy for now */}
                          {/* {showPurchaseUI && (currentUser?.user_type || '').toLowerCase() === 'farmer' && (() => {
                            const availBuy = selectedProduct.available_for_buy !== false && selectedProduct.available_for_buy !== 'false';
                            const availRent = selectedProduct.available_for_rent === true || selectedProduct.available_for_rent === 'true';
                            const hasRentPrice = selectedProduct.rent_price_per_month != null && selectedProduct.rent_price_per_month !== '' && !isNaN(parseFloat(selectedProduct.rent_price_per_month));
                            const hasRentDuration = (selectedProduct.rent_duration_monthly === true || selectedProduct.rent_duration_monthly === 'true') ||
                              (selectedProduct.rent_duration_quarterly === true || selectedProduct.rent_duration_quarterly === 'true') ||
                              (selectedProduct.rent_duration_yearly === true || selectedProduct.rent_duration_yearly === 'true');
                            const canRent = availRent && hasRentPrice && hasRentDuration;
                            const modes = [];
                            if (availBuy) modes.push('buy');
                            if (canRent) modes.push('rent');
                            if (modes.length === 0) return null;
                            return (
                              <div style={{ marginBottom: isMobile ? '6px' : '8px' }}>
                                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: '4px', fontWeight: 500 }}>I want to:</div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {modes.map((mode) => (
                                    <div key={mode} role="button" aria-pressed={purchaseMode === mode} tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPurchaseMode(mode); }}
                                      onClick={() => setPurchaseMode(mode)}
                                      style={{ padding: '4px 10px', backgroundColor: purchaseMode === mode ? '#007bff' : '#f8f9fa', color: purchaseMode === mode ? 'white' : '#6c757d', borderRadius: '4px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', border: purchaseMode === mode ? 'none' : '1px solid #e9ecef', textTransform: 'capitalize' }}>
                                      {mode === 'buy' ? 'Buy' : 'Rent'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()} */}
                          {/* Rent duration – disabled
                          {showPurchaseUI && purchaseMode === 'rent' && (() => {
                            const monthly = selectedProduct.rent_duration_monthly === true || selectedProduct.rent_duration_monthly === 'true';
                            const quarterly = selectedProduct.rent_duration_quarterly === true || selectedProduct.rent_duration_quarterly === 'true';
                            const yearly = selectedProduct.rent_duration_yearly === true || selectedProduct.rent_duration_yearly === 'true';
                            const options = [];
                            if (monthly) options.push({ key: 'monthly', label: 'Monthly', months: 1 });
                            if (quarterly) options.push({ key: 'quarterly', label: 'Quarterly', months: 3 });
                            if (yearly) options.push({ key: 'yearly', label: 'Yearly', months: 12 });
                            if (options.length === 0) return null;
                            return (
                              <div style={{ marginBottom: isMobile ? '6px' : '8px' }}>
                                <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: '4px', fontWeight: 500 }}>Rent duration:</div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {options.map((opt) => (
                                    <div key={opt.key} role="button" aria-pressed={rentDuration === opt.key} tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRentDuration(opt.key); }}
                                      onClick={() => setRentDuration(opt.key)}
                                      style={{ padding: '4px 8px', backgroundColor: rentDuration === opt.key ? '#059669' : '#f8f9fa', color: rentDuration === opt.key ? 'white' : '#6c757d', borderRadius: '4px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', border: rentDuration === opt.key ? 'none' : '1px solid #e9ecef' }}>
                                      {opt.label}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          */}
                          {/* Quantity Selector */}
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                style={{
                                  width: isMobile ? '20px' : '24px',
                                  height: isMobile ? '20px' : '24px',
                                  fontSize: isMobile ? '10px' : '12px',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '3px',
                                  border: '1px solid #e9ecef',
                                  color: '#6c757d',
                                  cursor: 'pointer'
                                }}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  setQuantity(Math.max(1, value));
                                  setInsufficientFunds(false);
                                }}
                                style={{
                                  width: isMobile ? '32px' : '40px',
                                  height: isMobile ? '20px' : '24px',
                                  fontSize: isMobile ? '10px' : '12px',
                                  fontWeight: 600,
                                  textAlign: 'center',
                                  border: '1px solid #e9ecef',
                                  borderRadius: '3px',
                                  backgroundColor: '#fff',
                                  color: '#212529',
                                  outline: 'none'
                                }}
                              />
                              <button
                                onClick={() => setQuantity(quantity + 1)}
                                style={{
                                  width: isMobile ? '20px' : '24px',
                                  height: isMobile ? '20px' : '24px',
                                  fontSize: isMobile ? '10px' : '12px',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '3px',
                                  border: '1px solid #e9ecef',
                                  color: '#6c757d',
                                  cursor: 'pointer'
                                }}
                              >
                                +
                              </button>
                              <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d' }}>m²</div>
                            </div>
                          </div>

                          {/* Price Info – rent disabled, only buy */}
                          <div style={{ marginBottom: isMobile ? '6px' : '8px' }}>
                            <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d' }}>
                              Price {(parseFloat(selectedProduct.price_per_m2) || parseFloat(selectedProduct.price) || parseFloat(selectedProduct.sellingPrice) || 0).toFixed(2)}$/m²
                            </div>
                            <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d' }}>
                              Exp Prod {selectedProduct.production_rate || selectedProduct.productionRate || 'N/A'} {selectedProduct.production_rate_unit || 'Kg'}
                            </div>
                          </div>

                          {/* Shipping Options (only for Buy) */}
                          {showPurchaseUI && purchaseMode === 'buy' && (
                            <div>
                              <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: isMobile ? '4px' : '6px', fontWeight: 500 }}>
                                Shipping Options:
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {(() => {
                                  const availableOptions = [];
                                  if (selectedProduct.shipping_pickup) availableOptions.push('Pickup');
                                  if (selectedProduct.shipping_delivery) availableOptions.push('Delivery');
                                  const options = (availableOptions.length > 0 ? availableOptions : ['Delivery', 'Pickup']);
                                  const deliveryAllowed = isDeliveryAllowed(selectedProduct);
                                  return options.map((option) => {
                                    const isDelivery = option === 'Delivery';
                                    const disabled = isDelivery && !deliveryAllowed;
                                    return (
                                      <div
                                        key={option}
                                        role="button"
                                        aria-pressed={selectedShipping === option}
                                        aria-disabled={disabled}
                                        tabIndex={disabled ? -1 : 0}
                                        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { setSelectedShipping(option); setShippingError(false); } }}
                                        onClick={() => { if (disabled) return; setSelectedShipping(option); setShippingError(false); }}
                                        onMouseEnter={(e) => { if (disabled) return; e.currentTarget.style.transform = selectedShipping === option ? 'scale(1.06)' : 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                                        onMouseLeave={(e) => { if (disabled) return; e.currentTarget.style.transform = selectedShipping === option ? 'scale(1.05)' : 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        style={{
                                          padding: '4px 8px',
                                          backgroundColor: disabled ? '#f0f0f0' : (selectedShipping === option ? '#007bff' : '#f8f9fa'),
                                          color: disabled ? '#9aa0a6' : (selectedShipping === option ? 'white' : '#6c757d'),
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          cursor: disabled ? 'not-allowed' : 'pointer',
                                          border: disabled ? '1px solid #e9ecef' : (selectedShipping ? (selectedShipping === option ? 'none' : '1px solid #e9ecef') : (shippingError ? '2px solid #ef4444' : '1px solid #e9ecef')),
                                          fontWeight: 500,
                                          transition: 'background-color 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease',
                                          transform: selectedShipping === option ? 'scale(1.05)' : 'scale(1)',
                                          opacity: disabled ? 0.7 : 1
                                        }}
                                      >
                                        {option}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>

                              {!isDeliveryAllowed(selectedProduct) && (
                                <div style={{
                                  width: '98%',
                                  margin: isMobile ? '6px 0 6px 0' : '8px 0 8px 0',
                                  color: '#ef4444',
                                  fontWeight: 600,
                                  fontSize: isMobile ? '9px' : '11px',
                                  textAlign: 'left'
                                }}>
                                  Delivery is unavailable at your location.
                                  <div style={{ marginTop: isMobile ? '4px' : '6px', color: '#ef4444', fontWeight: 600, textAlign: 'left', fontSize: isMobile ? '9px' : '11px' }}>
                                    {(() => {
                                      const scopeRaw = selectedProduct.shipping_scope || selectedProduct.shippingScope || 'Global';
                                      const scope = String(scopeRaw || '').toLowerCase();
                                      const locStr = productLocations.get(selectedProduct.id) || selectedProduct.location || '';
                                      const p = extractCityCountry(locStr);
                                      if (scope === 'city' && p.city) return `Delivery is only available in ${p.city}`;
                                      if (scope === 'country' && p.country) return `Delivery is only available in ${p.country}`;
                                      return '';
                                    })()}
                                  </div>
                                </div>
                              )}

                              <div style={{ marginTop: isMobile ? '6px' : '8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={orderForSomeoneElse}
                                      onChange={(e) => setOrderForSomeoneElse(e.target.checked)}
                                      color="primary"
                                      size={isMobile ? 'small' : 'medium'}
                                      sx={{
                                        '& .MuiSvgIcon-root': { fontSize: isMobile ? 16 : 18 },
                                        '&.MuiCheckbox-root': { padding: isMobile ? '2px' : '4px' }
                                      }}
                                    />
                                  }
                                  label="Order for someone else"
                                  sx={{
                                    marginLeft: 0,
                                    '.MuiFormControlLabel-label': { fontSize: isMobile ? '10px' : '12px', fontWeight: 600, color: '#4a5568' }
                                  }}
                                />
                              </div>



                              {selectedShipping === 'Delivery' && (
                                <div style={{ marginTop: isMobile ? '8px' : '10px' }}>
                                  <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d', marginBottom: isMobile ? '4px' : '6px', fontWeight: 500 }}>
                                    Delivery Address:
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', marginBottom: isMobile ? '6px' : '8px' }}>
                                    <div
                                      role="button"
                                      aria-pressed={deliveryMode === 'existing'}
                                      onClick={() => { setDeliveryMode('existing'); setShowAddressOverlay(false); }}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: deliveryMode === 'existing' ? '#ff9800' : '#f8f9fa',
                                        color: deliveryMode === 'existing' ? '#fff' : '#6c757d',
                                        borderRadius: '4px',
                                        border: deliveryMode === 'existing' ? 'none' : '1px solid #e9ecef',
                                        fontWeight: 500,
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        transition: 'transform 150ms ease, box-shadow 150ms ease',
                                        transform: deliveryMode === 'existing' ? 'scale(1.05)' : 'scale(1)'
                                      }}
                                    >
                                      Use saved address
                                    </div>
                                    <div
                                      role="button"
                                      aria-pressed={deliveryMode === 'new'}
                                      onClick={() => { setDeliveryMode('new'); setShowAddressOverlay(true); }}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: deliveryMode === 'new' ? '#ff9800' : '#f8f9fa',
                                        color: deliveryMode === 'new' ? '#fff' : '#6c757d',
                                        borderRadius: '4px',
                                        border: deliveryMode === 'new' ? 'none' : '1px solid #e9ecef',
                                        fontWeight: 500,
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        transition: 'transform 150ms ease, box-shadow 150ms ease',
                                        transform: deliveryMode === 'new' ? 'scale(1.05)' : 'scale(1)'
                                      }}
                                    >
                                      Add new address
                                    </div>
                                  </div>

                                  {deliveryMode === 'existing' ? (
                                    <div style={{
                                      backgroundColor: '#fff8e1',
                                      border: '1px solid #ff9800',
                                      borderRadius: isMobile ? '6px' : '8px',
                                      padding: isMobile ? '8px' : '10px',
                                      fontSize: isMobile ? '10px' : '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      {existingDeliveryAddress ? (
                                        <div style={{ color: '#7a5a00', fontWeight: 600 }}>{existingDeliveryAddress}</div>
                                      ) : (
                                        <>
                                          <span style={{ fontSize: isMobile ? '12px' : '14px' }}>⚠️</span>
                                          <div style={{ color: '#7a5a00', fontWeight: 600 }}>No saved address. Please add a new address.</div>
                                        </>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              )}

                            </div>
                          )}
                        </div>

                        {/* Right Side - Buy Now Button and Total Price */}
                        <div style={{
                          width: isMobile ? '80px' : '100px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          marginLeft: isMobile ? '8px' : '12px'
                        }}>
                          {showPurchaseUI && (
                            /* Rent disabled – only BUY NOW
                            purchaseMode === 'rent' ? (
                              <button onClick={() => handleRentNow(selectedProduct)} disabled={rentInProgress}
                                style={{ width: '100%', backgroundColor: rentInProgress ? '#6c757d' : '#059669', color: 'white', border: 'none', borderRadius: isMobile ? '4px' : '6px', padding: isMobile ? '6px 0' : '8px 0', fontSize: isMobile ? '10px' : '12px', fontWeight: 600, cursor: rentInProgress ? 'not-allowed' : 'pointer', opacity: rentInProgress ? 0.7 : 1, marginBottom: isMobile ? '6px' : '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                {rentInProgress ? 'Renting…' : 'RENT'}
                              </button>
                            ) : */
                            shippingError ? (
                              <div style={{
                                width: isMobile ? '92%' : '98%',
                                margin: isMobile ? '0 0 6px 0' : '0 8px 8px 0',
                                backgroundColor: 'rgba(255,255,255,0.96)',
                                border: '1px solid #ef4444',
                                borderRadius: isMobile ? '6px' : '8px',
                                padding: isMobile ? '6px 8px' : '8px 12px',
                                color: '#ef4444',
                                fontWeight: 700,
                                fontSize: isMobile ? '11px' : '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                animation: 'popupPulse 600ms ease-in-out infinite alternate',
                                willChange: 'transform',
                                textAlign: 'center',
                              }}>
                                Please select a shipping option
                              </div>
                            ) : (
                              <button
                                onClick={() => handleBuyNow(selectedProduct)}
                                disabled={buyNowInProgress}
                                style={{
                                  width: '100%',
                                  backgroundColor: buyNowInProgress ? '#6c757d' : '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: isMobile ? '4px' : '6px',
                                  padding: isMobile ? '6px 0' : '8px 0',
                                  fontSize: isMobile ? '10px' : '12px',
                                  fontWeight: 600,
                                  cursor: buyNowInProgress ? 'not-allowed' : 'pointer',
                                  opacity: buyNowInProgress ? 0.7 : 1,
                                  marginBottom: isMobile ? '6px' : '8px',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                {buyNowInProgress ? 'Processing…' : 'BUY NOW'}
                              </button>
                            )
                          )}

                          {/* Total Price – rent disabled, buy only */}
                          {(() => {
                            const totalCostInDollars = (parseFloat(selectedProduct.price_per_m2) || parseFloat(selectedProduct.price) || 0) * quantity;
                            const totalCostInCoins = Math.ceil(totalCostInDollars * coinsPerUnit);
                            return (
                              <>
                                <div style={{
                                  fontSize: isMobile ? '10px' : '12px',
                                  fontWeight: 600,
                                  color: '#212529',
                                  textAlign: 'center',
                                  marginBottom: isMobile ? '2px' : '4px'
                                }}>
                                  Total Price ${totalCostInDollars.toFixed(2)}
                                </div>
                                <div style={{
                                  fontSize: isMobile ? '9px' : '11px',
                                  fontWeight: 600,
                                  color: '#ff9800',
                                  textAlign: 'center',
                                  marginBottom: isMobile ? '4px' : '6px'
                                }}>
                                  Cost: {totalCostInCoins} coins
                                </div>
                              </>
                            );
                          })()}

                          {/* User Coins */}
                          <div style={{
                            fontSize: isMobile ? '9px' : '11px',
                            color: '#6c757d',
                            textAlign: 'center'
                          }}>
                            <div style={{ marginBottom: '1px' }}>Available Coins: {userCoins}</div>
                          </div>

                          {/* Insufficient Funds Error */}
                          {insufficientFunds && (() => {
                            const isRent = purchaseMode === 'rent';
                            const rentPricePerMonth = parseFloat(selectedProduct.rent_price_per_month) || 0;
                            const months = rentDuration === 'monthly' ? 1 : rentDuration === 'quarterly' ? 3 : 12;
                            const totalCostInDollars = isRent && rentPricePerMonth > 0
                              ? rentPricePerMonth * quantity * months
                              : ((parseFloat(selectedProduct.price_per_m2) || parseFloat(selectedProduct.price) || 0) * quantity);
                            const totalCostInCoins = Math.ceil(totalCostInDollars * coinsPerUnit);
                            const shortfall = totalCostInCoins - userCoins;
                            return (
                              <div style={{
                                fontSize: isMobile ? '9px' : '11px',
                                color: '#dc3545',
                                textAlign: 'center',
                                marginTop: isMobile ? '6px' : '8px',
                                fontWeight: 600
                              }}>
                                Insufficient coins! Need {totalCostInCoins}, have {userCoins} ({shortfall > 0 ? `need ${shortfall} more` : ''})
                              </div>
                            );
                          })()}
                        </div> {/* Closes 3919 */}
                      </div> {/* Closes 3676 */}
                    </>
                  )}
                </div>
              ) : renderWeatherTabContent()}



              {showAddressOverlay && (
                <div style={{ position: 'absolute', top: isMobile ? -34 : -30, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                  <div style={{ backgroundColor: 'white', width: isMobile ? '280px' : '380px', borderRadius: isMobile ? '8px' : '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid #e9ecef', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', padding: isMobile ? '6px 12px 0' : '8px 16px 0' }}>
                      <div style={{ fontWeight: 700, color: '#212529', fontSize: isMobile ? '12px' : '14px', paddingBottom: isMobile ? '6px' : '8px' }}>Add Delivery Address</div>
                      <div onClick={() => setShowAddressOverlay(false)} style={{ cursor: 'pointer', fontSize: isMobile ? '12px' : '14px', color: '#6c757d', width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: '#f0f0f0', position: 'absolute', top: isMobile ? '6px' : '8px', right: isMobile ? '6px' : '8px', fontWeight: 'bold', zIndex: 10 }}>✕</div>
                    </div>
                    <div ref={addressOverlayContentRef} style={{ position: 'relative', padding: isMobile ? '8px' : '10px', maxHeight: isMobile ? '70vh' : '72vh', overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '8px' : '10px', marginBottom: isMobile ? '8px' : '10px' }}>
                        <TextField label="Full name" variant="outlined" size="small" fullWidth value={newDeliveryAddress.name} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, name: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                        <TextField label="Phone" variant="outlined" size="small" fullWidth value={newDeliveryAddress.phone} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, phone: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                      </div>
                      <div ref={addressLine1Ref} style={{ marginBottom: isMobile ? '8px' : '10px' }}>
                        <TextField
                          label="Address line 1"
                          variant="outlined"
                          size="small"
                          fullWidth
                          value={newDeliveryAddress.line1}
                          onChange={e => {
                            const v = e.target.value;
                            setNewDeliveryAddress({ ...newDeliveryAddress, line1: v });
                            if (addressSearchTimeoutRef.current) clearTimeout(addressSearchTimeoutRef.current);
                            addressSearchTimeoutRef.current = setTimeout(() => { fetchAddressSuggestions(v); }, 300);
                          }}
                          onBlur={() => { setAddressSuggestions([]); setAddressSuggestionsPos(null); }}
                          sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }}
                        />
                      </div>
                      <div style={{ marginBottom: isMobile ? '8px' : '10px' }}>
                        <TextField label="Address line 2 (optional)" variant="outlined" size="small" fullWidth value={newDeliveryAddress.line2} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, line2: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '8px' : '10px', marginBottom: isMobile ? '8px' : '10px' }}>
                        <TextField label="City" variant="outlined" size="small" fullWidth value={newDeliveryAddress.city} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, city: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                        <TextField label="State" variant="outlined" size="small" fullWidth value={newDeliveryAddress.state} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, state: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                        <TextField label="ZIP" variant="outlined" size="small" fullWidth value={newDeliveryAddress.zip} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, zip: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                      </div>
                      <TextField label="Country" variant="outlined" size="small" fullWidth value={newDeliveryAddress.country} onChange={e => setNewDeliveryAddress({ ...newDeliveryAddress, country: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: isMobile ? '12px' : '13px', padding: isMobile ? '8px' : '10px' }, '& .MuiOutlinedInput-root': { borderRadius: isMobile ? '6px' : '8px' }, '& .MuiInputLabel-root': { fontSize: isMobile ? '11px' : '12px' } }} />
                      {addressError && (<div style={{ color: '#ef4444', fontSize: isMobile ? '10px' : '12px', marginTop: isMobile ? '8px' : '10px', fontWeight: 600 }}>{addressError}</div>)}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: isMobile ? '10px' : '12px' }}>
                        <button onClick={() => {
                          const scopeRaw = selectedProduct?.shipping_scope || selectedProduct?.shippingScope || 'Global';
                          const scope = String(scopeRaw || '').toLowerCase();
                          let valid = true;
                          if (scope !== 'global') {
                            const locStr = productLocations.get(selectedProduct.id) || selectedProduct.location || '';
                            const p = extractCityCountry(locStr);
                            if (scope === 'city') {
                              const rCity = (newDeliveryAddress.city || '').trim().toLowerCase();
                              valid = Boolean(p.city && rCity && p.city.toLowerCase() === rCity);
                            } else if (scope === 'country') {
                              const rCountry = (newDeliveryAddress.country || '').trim().toLowerCase();
                              valid = Boolean(p.country && rCountry && p.country.toLowerCase() === rCountry);
                            }
                          }
                          if (!valid) { setAddressError('Address is outside the delivery region.'); return; }
                          const summary = `${newDeliveryAddress.name}, ${newDeliveryAddress.line1}${newDeliveryAddress.line2 ? ' ' + newDeliveryAddress.line2 : ''}, ${newDeliveryAddress.city}, ${newDeliveryAddress.state ? newDeliveryAddress.state + ', ' : ''}${newDeliveryAddress.zip}, ${newDeliveryAddress.country}`;
                          setExistingDeliveryAddress(summary);
                          setDeliveryMode('existing');
                          setShowAddressOverlay(false);
                          setAddressError('');
                        }} style={{ backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: isMobile ? '4px' : '6px', padding: isMobile ? '8px 12px' : '10px 14px', fontSize: isMobile ? '12px' : '13px', cursor: 'pointer', fontWeight: 600 }}>Save Address</button>
                      </div>
                      {addressSuggestionsPos && addressSuggestions.length > 0 && (
                        <Paper
                          style={{
                            position: 'absolute',
                            top: addressSuggestionsPos.top,
                            left: addressSuggestionsPos.left,
                            minWidth: addressSuggestionsPos.width,
                            maxHeight: isMobile ? 150 : 200,
                            overflow: 'auto',
                            borderRadius: isMobile ? 8 : 12,
                            border: '1px solid #e8f5e8',
                            boxShadow: '0 4px 20px rgba(76, 175, 80, 0.1)',
                            zIndex: 1102,
                            backgroundColor: '#fff'
                          }}
                        >
                          {addressSuggestions.map((place, idx) => (
                            <Box
                              key={`addr-sugg-${idx}`}
                              onClick={() => applyAddressSelection(place)}
                              style={{
                                padding: isMobile ? '12px' : '14px',
                                cursor: 'pointer',
                                borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #f0f7f0' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fdf8';
                                e.currentTarget.style.borderLeft = '3px solid #4caf50';
                                e.currentTarget.style.paddingLeft = isMobile ? '14px' : '16px';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderLeft = 'none';
                                e.currentTarget.style.paddingLeft = isMobile ? '12px' : '14px';
                              }}
                            >
                              <Typography style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#2e7d32', marginBottom: 2 }}>
                                {place.name}
                              </Typography>
                              <Typography style={{ fontSize: isMobile ? 9 : 11, color: '#666' }}>
                                {place.formatted_address}
                              </Typography>
                            </Box>
                          ))}
                        </Paper>
                      )}
                    </div>
                  </div>
                </div>
              )}


              {/* Rented Field Card when not in purchase mode */}
              {!showPurchaseUI && (
                <div style={{ padding: isMobile ? '8px' : '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', marginBottom: isMobile ? '10px' : '12px' }}>
                    <div style={{
                      width: isMobile ? '60px' : '70px',
                      height: isMobile ? '60px' : '70px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: isMobile ? '4px' : '6px',
                      flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      <img
                        src={getProductImageSrc(selectedProduct)}
                        alt={selectedProduct.name || 'Product'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.src = getProductIcon(selectedProduct?.subcategory || selectedProduct?.category); }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '12px' : '14px', lineHeight: 1.3 }}>
                        {selectedProduct.name || selectedProduct.farmName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#64748b"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z" /></svg>
                        </span>
                        <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '10px' : '12px', marginLeft: '6px' }}>
                          {productLocations.get(selectedProduct.id) || selectedProduct.location}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px' }}>🌤️</span>
                        <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#6c757d' }}>
                          {productWeather.get(String(selectedProduct.id))?.weatherString || selectedProduct.weather || 'Unknown weather'}

                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'inline-block', backgroundColor: '#22c55e', color: 'white', borderRadius: isMobile ? '10px' : '12px', padding: isMobile ? '3px 8px' : '4px 10px', fontSize: isMobile ? '10px' : '11px', fontWeight: 600, marginBottom: isMobile ? '8px' : '10px' }}>
                    Active
                  </div>
                  {(() => {
                    const availBuy = selectedProduct.available_for_buy !== false && selectedProduct.available_for_buy !== 'false';
                    if (!availBuy) return null;
                    return (
                      <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#64748b', marginBottom: isMobile ? '8px' : '10px' }}>
                        Your field. Listed for buy.
                      </div>
                    );
                  })()}

                  <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: isMobile ? '8px 0' : '10px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981"><path d="M5 21h14v-2H5v2zm7-18l-5 5h3v4h4v-4h3l-5-5z" /></svg>
                      </span>
                      <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '10px' : '12px' }}>Crop Type</div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '11px' : '12px' }}>{selectedProduct.subcategory || selectedProduct.category}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 15H5V10h14v9z" /></svg>
                      </span>
                      <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '10px' : '12px' }}>Harvest Date</div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '11px' : '12px' }}>
                      {(() => { const list = getSelectedHarvestList(selectedProduct); const uniq = Array.from(new Set(list)); return uniq.length ? uniq.join(', ') : 'Not specified'; })()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b"><path d="M20 8h-3V4H7v4H4v12h16V8zm-9 0V6h2v2h-2zm9 10H4v-8h16v8z" /></svg>
                      </span>
                      <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '10px' : '12px' }}>Mode of Shipping</div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '11px' : '12px' }}>
                      {(function () { const modes = getShippingModes(selectedProduct); return modes.length ? modes.join(', ') : 'Not specified'; })()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '8px' : '10px' }}>
                    <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '10px' : '12px' }}>Your purchased: {formatAreaInt(((() => { const pidA = selectedProduct?.id ?? selectedProduct?.field_id; const byId = purchasedProducts.find(p => String(p.id ?? p.field_id) === String(pidA)); if (byId) return byId.purchased_area || 0; const canonProd = canonicalizeCategory(selectedProduct?.subcategory || selectedProduct?.category || selectedProduct?.category_key || selectedProduct?.id); const matches = purchasedProducts.filter(p => { const kp = canonicalizeCategory(p?.subcategory || p?.category || p?.category_key || p?.id); return kp.key === canonProd.key; }); return matches.length === 1 ? (matches[0].purchased_area || 0) : 0; })()))}m²</div>
                    <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '11px' : '12px' }}>Available: {formatAreaInt(getAvailableArea(selectedProduct))}m²</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ color: '#6c757d', fontWeight: 500, fontSize: isMobile ? '10px' : '12px' }}>Occupied area</div>
                      <div style={{ fontWeight: 600, color: '#212529', fontSize: isMobile ? '11px' : '12px' }}>{Math.round(((getOccupiedArea(selectedProduct) || 0) / (selectedProduct.total_area || 1)) * 100)}%</div>
                    </div>
                    <div style={{ height: isMobile ? '6px' : '8px', borderRadius: '4px', backgroundColor: '#e9ecef', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(((getOccupiedArea(selectedProduct) || 0) / (selectedProduct.total_area || 1)) * 100)}%`, height: '100%', backgroundColor: '#10b981' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: isMobile ? '10px' : '12px' }}>
                    <button
                      onClick={() => {
                        setShowPurchaseUI(true);
                        setPopupTab('details');
                        requestAnimationFrame(() => {
                          if (popupContentScrollRef.current) {
                            popupContentScrollRef.current.scrollTop = 0;
                          }
                        });
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: isMobile ? '8px 0' : '10px 0',
                        fontSize: isMobile ? '11px' : '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginTop: '8px',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                        transition: 'all 0.2s ease',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em'
                      }}>
                      Buy More Area
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* Keyframes for animations */}
      < style >
        {`
          @keyframes glow-blink {
            0% { 
              filter: drop-shadow(0 0 15px rgba(255, 193, 7, 0.9)) drop-shadow(0 0 30px rgba(255, 193, 7, 0.7));
            }
            50% { 
              filter: drop-shadow(0 0 8px rgba(255, 193, 7, 0.5)) drop-shadow(0 0 16px rgba(255, 193, 7, 0.3));
            }
            100% { 
              filter: drop-shadow(0 0 15px rgba(255, 193, 7, 0.9)) drop-shadow(0 0 30px rgba(255, 193, 7, 0.7));
            }
          }

          @keyframes glow-pulse-white {
            0% { 
              filter: brightness(1) drop-shadow(0 0 12px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.7));
              transform: scale(1);
            }
            50% { 
              filter: brightness(1.2) drop-shadow(0 0 20px rgba(255, 255, 255, 1)) drop-shadow(0 0 35px rgba(255, 255, 255, 0.9));
              transform: scale(1.05);
            }
            100% { 
              filter: brightness(1) drop-shadow(0 0 12px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.7));
              transform: scale(1);
            }
          }

          @keyframes heartbeat {
            0% {
              transform: scale(1);
            }
            25% {
              transform: scale(1.1);
            }
            50% {
              transform: scale(1);
            }
            75% {
              transform: scale(1.1);
            }
            100% {
              transform: scale(1);
            }
          }

          @keyframes enhanced-pulse {
            0% {
              filter: brightness(1) drop-shadow(0 0 0px rgba(255, 255, 255, 0.7));
            }
            50% {
              filter: brightness(1.2) drop-shadow(0 0 5px rgba(255, 255, 255, 0.9));
            }
            100% {
              filter: brightness(1) drop-shadow(0 0 0px rgba(255, 255, 255, 0.7));
            }
          }

          @keyframes glow-steady-blue {
            0% { 
              filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 16px rgba(59, 130, 246, 0.6));
            }
            100% { 
              filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 16px rgba(59, 130, 246, 0.6));
            }
          }

          @keyframes glow-steady-green {
            0% { 
              filter: brightness(1.1) drop-shadow(0 0 10px rgba(76, 175, 80, 0.8)) drop-shadow(0 0 20px rgba(76, 175, 80, 0.6));
            }
            50% { 
              filter: brightness(1.2) drop-shadow(0 0 15px rgba(76, 175, 80, 0.9)) drop-shadow(0 0 25px rgba(76, 175, 80, 0.7));
            }
            100% { 
              filter: brightness(1.1) drop-shadow(0 0 10px rgba(76, 175, 80, 0.8)) drop-shadow(0 0 20px rgba(76, 175, 80, 0.6));
            }
          }

          @keyframes glow-farmer-created {
            0% { 
              filter: brightness(1.05) drop-shadow(0 0 6px rgba(76, 175, 80, 0.5)) drop-shadow(0 0 12px rgba(76, 175, 80, 0.3));
            }
            50% { 
              filter: brightness(1.15) drop-shadow(0 0 10px rgba(76, 175, 80, 0.7)) drop-shadow(0 0 20px rgba(76, 175, 80, 0.5));
            }
            100% { 
              filter: brightness(1.05) drop-shadow(0 0 6px rgba(76, 175, 80, 0.5)) drop-shadow(0 0 12px rgba(76, 175, 80, 0.3));
            }
          }

          @keyframes flipTravelY {
            0% { transform: translate(-50%, -50%) rotateY(0deg); }
            50% { transform: translate(-50%, -50%) rotateY(180deg); }
            100% { transform: translate(-50%, -50%) rotateY(360deg); }
          }

          @keyframes harvest-bounce {
            0% {
              transform: translateY(0) scale(1, 1);
            }
            25% {
              transform: translateY(-3px) scale(1.1, 0.9);
            }
            50% {
              transform: translateY(0) scale(0.95, 1.05);
            }
            75% {
              transform: translateY(-2px) scale(1.08, 0.92);
            }
            100% {
              transform: translateY(0) scale(1, 1);
            }
          }
          @keyframes cardSlideIn {
            0% { transform: translate(-20px, -20px); opacity: 0; }
            60% { transform: translate(0px, 0px); opacity: 1; }
            100% { transform: translate(0px, 0px); opacity: 1; }
          }

          @keyframes cardGlow {
            0% { box-shadow: 0 8px 24px rgba(255,152,0,0.16); }
            50% { box-shadow: 0 12px 32px rgba(255,152,0,0.28); }
            100% { box-shadow: 0 8px 24px rgba(255,152,0,0.16); }
          }
          @keyframes orbit-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes locationPulse {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) scale(2);
              opacity: 0;
            }
          }
        `}
      </style >

      {/* Webcam Popup - Global */}
      <WebcamPopup
        open={webcamPopupOpen}
        onClose={() => setWebcamPopupOpen(false)}
        webcamUrl={selectedFarmForWebcam?.webcamUrl}
        farmName={selectedFarmForWebcam?.name}
      />

    </div >
  );
});

export default EnhancedFarmMap;
