import React, { useState, useEffect, useMemo } from 'react';
import fieldsService from '../services/fields';

import {
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  CircularProgress,
  Box,
  Alert,
  Stack,
  Grid,
  Paper,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  LocationOn,
  CalendarToday,
  Agriculture,
  TrendingUp,
  Visibility,
  Assessment,
  Schedule,
  Close,
  Download,
  Description,
  Search,
  HomeWork,
  Store,
  Edit as EditIcon,
  ReceiptLong as RentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import rentedFieldsService from '../services/rentedFields';
import { orderService } from '../services/orders';
import farmsService from '../services/farms';
import CreateFieldForm from '../components/Forms/CreateFieldForm';
import StatCard from '../components/Common/StatCard';
import { getProductIcon } from '../utils/productIcons';

const SEGMENT_ALL = 'all';
const SEGMENT_OWNED = 'owned';
const SEGMENT_RENTED = 'rented';

const normalizeAreaUnit = (raw) => {
  const u = String(raw || '').trim().toLowerCase();
  if (!u) return 'm2';
  if (u === 'm²' || u === 'm2' || u === 'sqm' || u === 'square meter' || u === 'square meters') return 'm2';
  if (u === 'acre' || u === 'acres') return 'acre';
  if (u === 'hectare' || u === 'hectares' || u === 'ha') return 'ha';
  if (u === 'sqft' || u === 'ft2' || u === 'ft²' || u === 'square feet') return 'ft2';
  return u;
};

const unitLabel = (unit) => {
  const u = normalizeAreaUnit(unit);
  if (u === 'm2') return 'm²';
  if (u === 'acre') return 'acres';
  if (u === 'ha') return 'ha';
  if (u === 'ft2') return 'ft²';
  return unit || 'm²';
};

const toM2 = (value, unit) => {
  const v = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(v)) return 0;
  const u = normalizeAreaUnit(unit);
  if (u === 'acre') return v * 4046.8564224;
  if (u === 'ha') return v * 10000;
  if (u === 'ft2') return v * 0.092903;
  return v; // m2 or unknown assumed m2
};

const formatAreaFromM2 = (m2, unit) => {
  const v = Number(m2) || 0;
  const u = normalizeAreaUnit(unit);
  if (u === 'acre') return `${(v / 4046.8564224).toFixed(2)} acres`;
  if (u === 'ha') return `${(v / 10000).toFixed(2)} ha`;
  if (u === 'ft2') return `${Math.round(v / 0.092903).toLocaleString()} ft²`;
  return `${Math.round(v).toLocaleString()} m²`;
};

// Map fields API response to the shape the UI expects
function mapFieldFromApi(raw, currentUserId) {
  const unit = normalizeAreaUnit(raw.unit || raw.area_unit || raw.field_size_unit || raw.areaUnit || 'm2');
  const areaM2Raw = typeof raw.area_m2 === 'string' ? parseFloat(raw.area_m2) : (raw.area_m2 ?? 0);
  const totalAreaRaw = typeof raw.total_area === 'string' ? parseFloat(raw.total_area) : (raw.total_area ?? areaM2Raw) || areaM2Raw;
  const availableAreaRaw = typeof raw.available_area === 'string' ? parseFloat(raw.available_area) : (raw.available_area ?? 0);
  const availableUnit = normalizeAreaUnit(raw.available_area_unit || 'm2');
  const totalAreaM2 = toM2(totalAreaRaw, unit);
  const availableAreaM2 = toM2(availableAreaRaw, availableUnit);
  const pricePerM2 = typeof raw.price_per_m2 === 'string' ? parseFloat(raw.price_per_m2) : (raw.price_per_m2 ?? 0);
  const quantity = typeof raw.quantity === 'string' ? parseFloat(raw.quantity) : (raw.quantity ?? 0);
  const occupiedM2 = Math.max(0, totalAreaM2 - availableAreaM2);
  const progress = totalAreaM2 > 0 ? Math.round((occupiedM2 / totalAreaM2) * 100) : 0;
  const harvestDates = Array.isArray(raw.harvest_dates)
    ? raw.harvest_dates.map((h) => (typeof h === 'object' && h?.date != null ? { date: h.date, label: h.label || '' } : { date: h, label: '' }))
    : [];
  const shippingOption = raw.shipping_option || '';
  const shippingModes = shippingOption ? shippingOption.split(/[,/]/).map((s) => s.trim()).filter(Boolean) : [];
  const availableForBuy = raw.available_for_buy !== false && raw.available_for_buy !== 'false';
  const availableForRent = raw.available_for_rent === true || raw.available_for_rent === 'true';
  const rentPricePerMonth = raw.rent_price_per_month != null && raw.rent_price_per_month !== '' ? parseFloat(raw.rent_price_per_month) : null;
  
  const isOwnField = currentUserId != null
    ? raw.owner_id === currentUserId
    : Boolean(raw.is_own_field);

  return {
    id: raw.id,
    name: raw.name,
    farmName: raw.farmer_name,
    location: raw.location,
    cropType: raw.category || raw.subcategory,
    category: raw.category,
    subcategory: raw.subcategory,
    is_own_field: Boolean(isOwnField),
    area_unit: unit,
    total_area: totalAreaM2,
    area_m2: totalAreaM2,
    available_area: availableAreaM2,
    occupied_area: occupiedM2,
    total_area_display: formatAreaFromM2(totalAreaM2, unit),
    available_area_display: formatAreaFromM2(availableAreaM2, unit),
    occupied_area_display: quantity ? `${quantity} ${unitLabel(unit)}` : formatAreaFromM2(occupiedM2, unit),
    area: quantity ? `${quantity} ${unitLabel(unit)}` : formatAreaFromM2(occupiedM2, unit),
    price_per_m2: pricePerM2,
    monthlyRent: (pricePerM2 * (quantity || totalAreaM2)) || (typeof raw.price === 'string' ? parseFloat(raw.price) : raw.price),
    status: raw.available !== false ? 'Active' : 'Inactive',
    progress,
    selected_harvests: harvestDates,
    selected_harvest_date: harvestDates[0]?.date,
    selected_harvest_label: harvestDates[0]?.label,
    shipping_modes: shippingModes,
    image_url: raw.image,
    farmer_name: raw.farmer_name,
    created_at: raw.created_at,
    rentPeriod: totalAreaM2 > 0 ? 'Ongoing' : null,
    available_for_buy: availableForBuy,
    available_for_rent: availableForRent,
    rent_price_per_month: rentPricePerMonth,
    rent_duration_monthly: raw.rent_duration_monthly === true || raw.rent_duration_monthly === 'true',
    rent_duration_quarterly: raw.rent_duration_quarterly === true || raw.rent_duration_quarterly === 'true',
    rent_duration_yearly: raw.rent_duration_yearly === true || raw.rent_duration_yearly === 'true',
  };
}

// Convert raw field from API to CreateFieldForm initialData shape
function fieldToFormInitialData(raw) {
  if (!raw) return null;
  const coords = Array.isArray(raw.coordinates) ? raw.coordinates : [];
  const lng = coords[0] != null ? Number(coords[0]) : '';
  const lat = coords[1] != null ? Number(coords[1]) : '';
  const harvestDates = Array.isArray(raw.harvest_dates)
    ? raw.harvest_dates.map((h) => (typeof h === 'object' && h != null ? { date: h.date ?? '', label: h.label ?? '' } : { date: h ?? '', label: '' }))
    : [{ date: '', label: '' }];
  return {
    ...raw,
    name: raw.name ?? '',
    productName: raw.name ?? '',
    category: raw.category ?? '',
    subcategory: raw.subcategory ?? '',
    description: raw.description ?? '',
    price: raw.price ?? raw.price_per_m2,
    sellingPrice: raw.price ?? raw.price_per_m2 ?? '',
    latitude: lat,
    longitude: lng,
    harvestDates: harvestDates.length ? harvestDates : [{ date: '', label: '' }],
    shippingScope: raw.shipping_scope ?? 'Global',
    shippingOption: raw.shipping_option ?? 'Both',
    farmId: raw.farm_id ?? '',
    fieldSize: raw.field_size ?? raw.area_m2 ?? raw.total_area ?? '',
    productionRate: raw.production_rate ?? '',
    available_for_rent: Boolean(raw.available_for_rent),
    rent_price_per_month: raw.rent_price_per_month ?? '',
    rent_duration_monthly: Boolean(raw.rent_duration_monthly),
    rent_duration_quarterly: Boolean(raw.rent_duration_quarterly),
    rent_duration_yearly: Boolean(raw.rent_duration_yearly),
  };
}

// Map my-rentals API response (rented_fields + field details) to same shape as owned fields for the card
function mapRentalFromApi(r) {
  const unit = normalizeAreaUnit(r.unit || r.area_unit || r.field_size_unit || 'm2');
  const totalAreaRaw = typeof r.total_area === 'string' ? parseFloat(r.total_area) : (r.total_area ?? 0);
  const availableAreaRaw = typeof r.available_area === 'string' ? parseFloat(r.available_area) : (r.available_area ?? 0);
  const totalAreaM2 = toM2(totalAreaRaw, unit);
  const availableAreaM2 = toM2(availableAreaRaw, r.available_area_unit || 'm2');
  const areaRentedRaw = r.area_rented != null && r.area_rented !== '' ? parseFloat(r.area_rented) : 0;
  const occupiedM2 = Math.max(0, totalAreaM2 > 0 ? totalAreaM2 - availableAreaM2 : toM2(areaRentedRaw, unit));
  const progress = totalAreaM2 > 0 ? Math.round((occupiedM2 / totalAreaM2) * 100) : 0;
  const status = (r.status || 'active').toLowerCase();
  return {
    id: `rental-${r.id}`,
    _rentalId: r.id,
    _fieldId: r.field_id,
    is_own_field: false,
    name: r.field_name || `Field ${r.field_id}`,
    farmName: r.owner_name,
    location: r.field_location,
    cropType: r.category || r.subcategory,
    category: r.category,
    subcategory: r.subcategory,
    area_unit: unit,
    total_area: totalAreaM2,
    area_m2: totalAreaM2,
    available_area: availableAreaM2,
    occupied_area: occupiedM2,
    total_area_display: formatAreaFromM2(totalAreaM2, unit),
    available_area_display: formatAreaFromM2(availableAreaM2, unit),
    occupied_area_display: formatAreaFromM2(occupiedM2, unit),
    area: formatAreaFromM2(occupiedM2, unit),
    price_per_m2: r.price_per_m2,
    monthlyRent: typeof r.price === 'number' ? r.price : (typeof r.price === 'string' ? parseFloat(r.price) : 0) || 0,
    status: status === 'active' ? 'Active' : status === 'ended' ? 'Ended' : status === 'cancelled' ? 'Cancelled' : status,
    progress,
    selected_harvests: [],
    shipping_modes: [],
    farmer_name: r.owner_name,
    rentPeriod: r.start_date && r.end_date ? `${r.start_date} – ${r.end_date}` : null,
    rental_start_date: r.start_date,
    rental_end_date: r.end_date,
  };
}

const RentedFields = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedFieldId, setExpandedFieldId] = useState(null);
  const [rentedFields, setRentedFields] = useState([]);
  const [myRentals, setMyRentals] = useState([]);
  const [purchasedFields, setPurchasedFields] = useState([]);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [loadingRentals, setLoadingRentals] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [fieldDetailOpen, setFieldDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [showAllFields, setShowAllFields] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [segment, setSegment] = useState(SEGMENT_ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editFieldOpen, setEditFieldOpen] = useState(false);
  const [editingFieldFull, setEditingFieldFull] = useState(null);
  const [farmsListForEdit, setFarmsListForEdit] = useState([]);
  const [editRentOpen, setEditRentOpen] = useState(false);
  const [editRentField, setEditRentField] = useState(null);
  const [editRentForm, setEditRentForm] = useState({
    available_for_buy: true,
    available_for_rent: false,
    rent_price_per_month: '',
    rent_duration_monthly: false,
    rent_duration_quarterly: false,
    rent_duration_yearly: false,
  });
  const [editRentSaving, setEditRentSaving] = useState(false);
  const [editRentError, setEditRentError] = useState('');

  // Exchange rates for currency conversion
  const exchangeRates = {
    'USD': { 'EUR': 0.85, 'GBP': 0.73, 'PKR': 280, 'JPY': 110, 'CAD': 1.25, 'AUD': 1.35, 'CHF': 0.92 },
    'EUR': { 'USD': 1.18, 'GBP': 0.86, 'PKR': 330, 'JPY': 130, 'CAD': 1.47, 'AUD': 1.59, 'CHF': 1.08 },
    'GBP': { 'USD': 1.37, 'EUR': 1.16, 'PKR': 384, 'JPY': 151, 'CAD': 1.71, 'AUD': 1.85, 'CHF': 1.26 },
    'PKR': { 'USD': 0.0036, 'EUR': 0.003, 'GBP': 0.0026, 'JPY': 0.39, 'CAD': 0.0045, 'AUD': 0.0048, 'CHF': 0.0033 },
    'JPY': { 'USD': 0.0091, 'EUR': 0.0077, 'GBP': 0.0066, 'PKR': 2.55, 'CAD': 0.011, 'AUD': 0.012, 'CHF': 0.0084 },
    'CAD': { 'USD': 0.8, 'EUR': 0.68, 'GBP': 0.58, 'PKR': 224, 'JPY': 88, 'AUD': 1.08, 'CHF': 0.74 },
    'AUD': { 'USD': 0.74, 'EUR': 0.63, 'GBP': 0.54, 'PKR': 207, 'JPY': 81, 'CAD': 0.93, 'CHF': 0.68 },
    'CHF': { 'USD': 1.09, 'EUR': 0.93, 'GBP': 0.79, 'PKR': 305, 'JPY': 119, 'CAD': 1.35, 'AUD': 1.47 }
  };

  // Currency symbols mapping
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PKR': '₨',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF'
  };



  // Currency conversion function
  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;

    // Convert to USD first if not already
    let usdAmount = amount;
    if (fromCurrency !== 'USD') {
      usdAmount = amount * (exchangeRates[fromCurrency]?.['USD'] || 1);
    }

    // Convert from USD to target currency
    if (toCurrency === 'USD') {
      return usdAmount;
    }

    return usdAmount * (exchangeRates['USD']?.[toCurrency] || 1);
  };

  // Helper function to calculate rent period
  const calculateRentPeriod = (startDate, endDate = null) => {
    if (!startDate) return '6 months'; // Default fallback

    const start = new Date(startDate);
    if (isNaN(start.getTime())) return '6 months'; // Invalid date fallback

    // If no end date provided, calculate from start date to 6 months later
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + (6 * 30 * 24 * 60 * 60 * 1000));

    if (isNaN(end.getTime())) return '6 months'; // Invalid end date fallback

    const diffTime = Math.abs(end - start);
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return `${diffMonths} months`;
  };

  // Calculate harvest date based on crop type and order date
  const calculateHarvestDate = (createdAt, cropType) => {
    if (!createdAt) return 'Not specified';

    const orderDate = new Date(createdAt);
    let harvestMonths = 3; // Default 3 months

    // Different crops have different growing periods
    const cropGrowthPeriods = {
      'apple': 6,
      'red-apple': 6,
      'green-apple': 6,
      'corn': 4,
      'wheat': 4,
      'rice': 3,
      'tomato': 3,
      'potato': 3,
      'carrot': 2,
      'lettuce': 2,
      'spinach': 2,
      'eggplant': 4,
      'lemon': 8,
      'orange': 8,
      'banana': 12,
      'strawberry': 3,
      'grape': 6
    };

    // Get growth period for the crop type
    const cropKey = cropType?.toLowerCase().replace(/\s+/g, '-');
    harvestMonths = cropGrowthPeriods[cropKey] || 3;

    // Calculate harvest date
    const harvestDate = new Date(orderDate);
    harvestDate.setMonth(harvestDate.getMonth() + harvestMonths);

    // Format the date
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return harvestDate.toLocaleDateString('en-US', options);
  };

  // Load user preferences
  useEffect(() => {
    // Removed localStorage.getItem('userPreferences') as localStorage is deprecated.
    // User currency will default to 'USD' or be managed by a future backend.
  }, []);

  const loadFields = React.useCallback(async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await fieldsService.getAll();
      const rawList = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const mapped = rawList.map((f) => mapFieldFromApi(f, user.id));
      setRentedFields(mapped);
    } catch (error) {
      console.error('Error loading fields:', error);
      setRentedFields([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMyRentals = React.useCallback(async () => {
    try {
      if (!user?.id) {
        setMyRentals([]);
        return;
      }
      setLoadingRentals(true);
      const res = await rentedFieldsService.getMyRentals();
      const list = Array.isArray(res.data) ? res.data : [];
      setMyRentals(list.map(mapRentalFromApi));
    } catch (error) {
      console.error('Error loading my rentals:', error);
      setMyRentals([]);
    } finally {
      setLoadingRentals(false);
    }
  }, [user?.id]);

  // Load fields where the current user has purchased area (orders with field details)
  const loadPurchasedFields = React.useCallback(async () => {
    try {
      if (!user?.id) {
        setPurchasedFields([]);
        return;
      }
      const res = await orderService.getBuyerOrdersWithFields(user.id);
      const orders = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
      const byField = new Map();

      orders.forEach((o) => {
        const status = String(o.status || '').toLowerCase();
        if (!['pending', 'active', 'completed'].includes(status)) return;
        const fid = o.field_id || o.fieldId;
        if (!fid) return;
        const qtyRaw = o.quantity ?? o.area_rented ?? o.area ?? 0;
        const qty = typeof qtyRaw === 'string' ? parseFloat(qtyRaw) : qtyRaw;
        if (!Number.isFinite(qty) || qty <= 0) return;

        const totalAreaRaw = o.total_area ?? o.field_size ?? o.area_m2 ?? 0;
        const totalArea = typeof totalAreaRaw === 'string' ? parseFloat(totalAreaRaw) : totalAreaRaw;
        const availableAreaRaw = o.available_area ?? null;
        const availableArea = typeof availableAreaRaw === 'string' ? parseFloat(availableAreaRaw) : availableAreaRaw;

        if (!byField.has(fid)) {
          byField.set(fid, {
            id: `purchased-${fid}`,
            _fieldId: fid,
            is_own_field: false,
            name: o.field_name || `Field ${fid}`,
            farmName: o.farmer_name,
            location: o.location,
            cropType: o.crop_type,
            category: o.crop_type,
            subcategory: o.subcategory || null,
            total_area: Number.isFinite(totalArea) ? totalArea : 0,
            available_area: Number.isFinite(availableArea) ? availableArea : null,
            purchased_area: 0,
            price_per_m2: o.price_per_m2,
            monthlyRent: 0,
            status:
              status === 'active'
                ? 'Active'
                : status === 'pending'
                ? 'Pending'
                : status === 'completed'
                ? 'Completed'
                : status || 'active',
            selected_harvests: [],
            shipping_modes: [],
            farmer_name: o.farmer_name,
            rentPeriod: null,
          });
        }
        const item = byField.get(fid);
        item.purchased_area = (item.purchased_area || 0) + qty;
      });

      const list = Array.from(byField.values()).map((item) => {
        const totalArea = item.total_area || 0;
        const purchasedArea = item.purchased_area || 0;
        const progress = totalArea > 0 ? Math.round((purchasedArea / totalArea) * 100) : 0;
        return {
          ...item,
          area_m2: purchasedArea,
          area: `${purchasedArea} m²`,
          progress,
        };
      });

      setPurchasedFields(list);
    } catch (error) {
      console.error('Error loading purchased fields from orders:', error);
      setPurchasedFields([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  useEffect(() => {
    loadMyRentals();
    loadPurchasedFields();
  }, [loadMyRentals, loadPurchasedFields]);

  // Combine owned fields + rented fields by segment; then filter by search and category
  const displayedFields = useMemo(() => {
    let list;
    if (segment === SEGMENT_OWNED) list = rentedFields.filter((f) => f.is_own_field);
    else if (segment === SEGMENT_RENTED) list = [...myRentals, ...purchasedFields];
    else list = [...rentedFields, ...myRentals, ...purchasedFields];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (f) =>
          (f.name || '').toLowerCase().includes(q) ||
          (f.location || '').toLowerCase().includes(q) ||
          (f.cropType || '').toLowerCase().includes(q) ||
          (f.farmer_name || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      list = list.filter(
        (f) => (f.category || f.cropType || '').toLowerCase() === categoryFilter.toLowerCase()
      );
    }
    return list;
  }, [rentedFields, myRentals, purchasedFields, segment, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set();
    rentedFields.forEach((f) => {
      const c = f.category || f.cropType;
      if (c) set.add(c);
    });
    myRentals.forEach((f) => {
      const c = f.category || f.cropType;
      if (c) set.add(c);
    });
    purchasedFields.forEach((f) => {
      const c = f.category || f.cropType;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [rentedFields, myRentals, purchasedFields]);


  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Completed': return 'primary';
      case 'Pending': return 'warning';
      default: return 'default';
    }
  };

  // Handle field detail modal
  const handleFieldClick = (field) => {
    setSelectedField(field);
    setFieldDetailOpen(true);
  };

  const handleCloseFieldDetail = () => {
    setFieldDetailOpen(false);
    setSelectedField(null);
  };

  const handleViewOnMap = (field) => {
    const fieldId = field?.id;
    if (!fieldId) return;
    const base = user?.user_type === 'farmer' ? '/farmer' : '/buyer';
    navigate(`${base}?field_id=${encodeURIComponent(String(fieldId))}`);
  };

  const openEditField = async (field) => {
    if (!field?.id || !field.is_own_field) return;
    try {
      const [fieldRes, farmsRes] = await Promise.all([
        fieldsService.getById(field.id),
        farmsService.getAll(user?.id).catch(() => ({ data: [] })),
      ]);
      const raw = fieldRes.data;
      const farms = Array.isArray(farmsRes.data) ? farmsRes.data : farmsRes.data?.data ?? [];
      setEditingFieldFull(raw);
      setFarmsListForEdit(farms.map((f) => ({ id: f.id, farmName: f.farm_name ?? f.name ?? f.farmName, name: f.farm_name ?? f.name ?? f.farmName })));
      setEditFieldOpen(true);
    } catch (e) {
      console.error('Failed to load field for edit:', e);
    }
  };

  const handleFullFieldSubmit = async (formData) => {
    if (!editingFieldFull?.id) return;
    try {
      await fieldsService.update(editingFieldFull.id, { ...editingFieldFull, ...formData, shipping_scope: formData.shippingScope });
      await loadFields();
      setEditFieldOpen(false);
      setEditingFieldFull(null);
    } catch (e) {
      console.error('Failed to update field:', e);
    }
  };

  const openEditRent = (field) => {
    if (!field) return;
    setEditRentField(field);
    setEditRentForm({
      available_for_rent: Boolean(field.available_for_rent),
      rent_price_per_month: field.rent_price_per_month != null && field.rent_price_per_month !== '' ? String(field.rent_price_per_month) : '',
      rent_duration_monthly: Boolean(field.rent_duration_monthly),
      rent_duration_quarterly: Boolean(field.rent_duration_quarterly),
      rent_duration_yearly: Boolean(field.rent_duration_yearly),
    });
    setEditRentError('');
    setEditRentOpen(true);
  };

  const closeEditRent = () => {
    setEditRentOpen(false);
    setEditRentField(null);
    setEditRentError('');
  };

  const handleEditRentSave = async () => {
    if (!editRentField?.id) return;
    if (editRentForm.available_for_rent) {
      const priceOk = editRentForm.rent_price_per_month !== '' && !isNaN(parseFloat(editRentForm.rent_price_per_month)) && parseFloat(editRentForm.rent_price_per_month) >= 0;
      const anyDuration = editRentForm.rent_duration_monthly || editRentForm.rent_duration_quarterly || editRentForm.rent_duration_yearly;
      if (!priceOk) {
        setEditRentError('Rent price per month is required when available for rent.');
        return;
      }
      if (!anyDuration) {
        setEditRentError('Select at least one rent duration (Monthly, Quarterly, or Yearly).');
        return;
      }
    }
    setEditRentError('');
    setEditRentSaving(true);
    try {
      await fieldsService.update(editRentField.id, {
        available_for_buy: true,
        available_for_rent: editRentForm.available_for_rent,
        rent_price_per_month: editRentForm.available_for_rent && editRentForm.rent_price_per_month !== '' ? parseFloat(editRentForm.rent_price_per_month) : null,
        rent_duration_monthly: editRentForm.rent_duration_monthly,
        rent_duration_quarterly: editRentForm.rent_duration_quarterly,
        rent_duration_yearly: editRentForm.rent_duration_yearly,
      });
      await loadFields();
      closeEditRent();
      setFieldDetailOpen(false);
      setSelectedField(null);
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to update field';
      setEditRentError(msg);
    } finally {
      setEditRentSaving(false);
    }
  };

  // Pagination over filtered list
  const totalPages = Math.ceil(displayedFields.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFields = showAllFields ? displayedFields : displayedFields.slice(startIndex, endIndex);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    // Scroll to top of fields grid
    window.scrollTo({ top: 530, behavior: 'smooth' });
  };

  const handleViewAllClick = () => {
    setShowAllFields(!showAllFields);
    setCurrentPage(1);
  };

  // Field Report functionality
  const handleReportClick = () => {
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
  };

  const handleDownloadReport = (format = 'pdf') => {
    // Generate report data
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      totalFields: displayedFields.length,
      activeFields: displayedFields.filter(f => f.status === 'Active').length,
      totalMonthlyRent: totalMonthlyRent,
      avgProgress: avgProgress,
      fields: displayedFields.map(field => ({
        name: field.name || field.farmName,
        location: field.location,
        cropType: field.cropType,
        area: field.area,
        monthlyRent: field.monthlyRent,
        progress: field.progress,
        status: field.status
      }))
    };

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Field Name', 'Location', 'Crop Type', 'Area', 'Monthly Rent', 'Occupied Area', 'Status'];
      const rows = reportData.fields.map(f => [
        f.name,
        f.location,
        f.cropType,
        f.area,
        `${currencySymbols[userCurrency]}${(parseFloat(f.monthlyRent) || 0).toFixed(2)}`,
        `${f.progress}%`,
        f.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `rented-fields-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Generate PDF using browser print functionality
      const printWindow = window.open('', '_blank');
      const reportHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Rented Fields Report</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                color: #333;
              }
              h1 {
                color: #1e293b;
                border-bottom: 2px solid #4caf50;
                padding-bottom: 10px;
              }
              h2 {
                color: #059669;
                margin-top: 30px;
              }
              .summary {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin: 20px 0;
              }
              .summary-card {
                background: #f8fafc;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                border: 1px solid #e2e8f0;
              }
              .summary-value {
                font-size: 24px;
                font-weight: bold;
                color: #1e293b;
                margin-bottom: 5px;
              }
              .summary-label {
                font-size: 12px;
                color: #64748b;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th {
                background-color: #4caf50;
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: bold;
              }
              td {
                padding: 10px;
                border-bottom: 1px solid #e2e8f0;
              }
              tr:nth-child(even) {
                background-color: #f8fafc;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                font-size: 12px;
                color: #64748b;
                text-align: center;
              }
              @media print {
                body { margin: 0; padding: 15px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>Rented Fields Report</h1>
            <p><strong>Generated:</strong> ${reportData.generatedAt}</p>
            
            <div class="summary">
              <div class="summary-card">
                <div class="summary-value">${reportData.totalFields}</div>
                <div class="summary-label">Total Fields</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${reportData.activeFields}</div>
                <div class="summary-label">Active Rentals</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${reportData.avgProgress}%</div>
                <div class="summary-label">Avg Occupied Area</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${currencySymbols[userCurrency]}${totalMonthlyRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="summary-label">Monthly Revenue</div>
              </div>
            </div>

            <h2>Fields Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Location</th>
                  <th>Crop Type</th>
                  <th>Area</th>
                  <th>Monthly Rent</th>
                  <th>Occupied Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.fields.map(field => `
                  <tr>
                    <td>${field.name}</td>
                    <td>${field.location}</td>
                    <td>${field.cropType}</td>
                    <td>${field.area}</td>
                    <td>${currencySymbols[userCurrency]}${(parseFloat(field.monthlyRent) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${field.progress}%</td>
                    <td>${field.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              <p>This report was generated on ${reportData.generatedAt}</p>
            </div>

            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(reportHTML);
      printWindow.document.close();
    }
  };

  // Calculate stats from filtered list
  const totalFields = displayedFields.length;
  const activeFields = displayedFields.filter(f => f.status === 'Active').length;
  const totalMonthlyRent = displayedFields.reduce((sum, field) => sum + (parseFloat(field.monthlyRent) || 0), 0);
  const validFields = displayedFields.filter(field => field.progress != null && !isNaN(field.progress));
  const avgProgress = validFields.length > 0
    ? Math.round(validFields.reduce((sum, field) => sum + field.progress, 0) / validFields.length)
    : 0;

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <Box sx={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        p: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      p: 3
      }}>
        {/* Header Section */}
        <Box sx={{
          maxWidth: '1400px',
          mx: 'auto',
          mb: 4
        }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 2.5, gap: { xs: 1.5, sm: 0 } }}
          >
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#1e293b',
                mb: 0.5,
                fontSize: '1.75rem'
              }}
            >
              Rented fields
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
              View and manage your owned and rented fields
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Assessment />}
            onClick={handleReportClick}
            sx={{
              backgroundColor: '#4caf50',
              color: '#ffffff',
              borderRadius: 2,
              px: 2.5,
              py: 1,
              alignSelf: { xs: 'stretch', sm: 'flex-end' },
              width: { xs: '100%', sm: 'auto' },
              textAlign: 'center'
            }}
          >
            Field Report
          </Button>
        </Stack>

        {/* Stats Overview */}
        <div className="mb-3 grid max-w-[480px] grid-cols-2 gap-3 md:max-w-none md:grid-cols-4">
          <StatCard
            icon={<Agriculture sx={{ fontSize: 20 }} />}
            iconBg="#dbeafe"
            iconColor="#1d4ed8"
            value={totalFields}
            label="Total Fields"
          />
          <StatCard
            icon={<TrendingUp sx={{ fontSize: 20 }} />}
            iconBg="#dcfce7"
            iconColor="#059669"
            value={activeFields}
            label="Active Rentals"
          />
          <StatCard
            icon={<Assessment sx={{ fontSize: 20 }} />}
            iconBg="#f3e8ff"
            iconColor="#7c3aed"
            value={`${avgProgress}%`}
            label="Avg Progress"
          />
          <StatCard
            icon={<Schedule sx={{ fontSize: 20 }} />}
            iconBg="#fef3c7"
            iconColor="#d97706"
            value={`${currencySymbols[userCurrency]}${totalMonthlyRent.toLocaleString()}`}
            label="Monthly Revenue"
          />
        </div>

        {/* Filters: segment, search, category (pure Tailwind for layout) */}
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
          {/* Segment tabs */}
          <div className="mb-2 flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => { setSegment(SEGMENT_ALL); setCurrentPage(1); }}
              className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                segment === SEGMENT_ALL
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All fields
            </button>
            <button
              type="button"
              onClick={() => { setSegment(SEGMENT_OWNED); setCurrentPage(1); }}
              className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                segment === SEGMENT_OWNED
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <HomeWork sx={{ fontSize: 16 }} />
              <span>My fields (owned)</span>
            </button>
            <button
              type="button"
              onClick={() => { setSegment(SEGMENT_RENTED); setCurrentPage(1); }}
              className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                segment === SEGMENT_RENTED
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Store sx={{ fontSize: 16 }} />
              <span>Rented from others</span>
            </button>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Search input */}
            <div className="relative min-w-[140px] max-w-[200px] sm:min-w-[220px] sm:max-w-[260px]">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                <Search sx={{ fontSize: 16 }} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by name, location, crop..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-700 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
              />
            </div>

            {/* Category select */}
            <div className="min-w-[130px] max-w-[180px] sm:min-w-[180px] sm:max-w-[220px]">
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {(searchQuery || categoryFilter || segment !== SEGMENT_ALL) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCategoryFilter(''); setSegment(SEGMENT_ALL); setCurrentPage(1); }}
                className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Fields (compact list; expandable) */}
        <div className="w-full space-y-2">
          {paginatedFields.map((field) => {
            const iconUrl = getProductIcon(field.subcategory || field.category || field.cropType);
            const monthly = (() => {
              const amount = parseFloat(field.monthlyRent) || 0;
              return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            })();
            const harvestText = (() => {
              const items = Array.isArray(field.selected_harvests) ? field.selected_harvests : [];
              const format = (date) => {
                if (!date) return '';
                if (typeof date === 'string' && /\d{1,2}\s\w{3}\s\d{4}/.test(date)) return date;
                const d = new Date(date);
                if (isNaN(d.getTime())) return String(date);
                return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
              };
              if (items.length) {
                const mapped = items.map(it => {
                  const dt = format(it.date);
                  if (it.label && dt) return `${dt} (${it.label})`;
                  if (dt) return dt;
                  if (it.label) return it.label;
                  return '';
                }).filter(Boolean);
                const uniq = Array.from(new Set(mapped));
                return uniq.join(', ') || 'Not specified';
              }
              return field.selected_harvest_label || field.selected_harvest_date || 'Not specified';
            })();
            const shippingText = (() => {
              const modes = Array.isArray(field.shipping_modes) ? field.shipping_modes : [];
              const uniq = (() => { const s = new Set(); return modes.filter(m => { const k = (m || '').toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); })();
              return uniq.length ? uniq.join(', ') : 'Not specified';
            })();
            const progressColor =
              field.progress === 100 ? '#10b981' : field.progress > 50 ? '#3b82f6' : '#f59e0b';
            const isExpanded = expandedFieldId === field.id;

            return (
              <div
                key={field.id}
                className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Compact row */}
                <button
                  type="button"
                  onClick={() => setExpandedFieldId((prev) => (prev === field.id ? null : field.id))}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50"
                >
                  {iconUrl && (
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                      <img src={iconUrl} alt="Field icon" className="h-5 w-5 object-contain" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {/* Mobile: stacked rows. Desktop: single row */}
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Title row (full width on mobile) */}
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 sm:truncate sm:whitespace-nowrap">
                            {field.name || field.farmName}
                          </div>
                          <span
                            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                              field.is_own_field ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {field.is_own_field ? 'My field' : 'Rented'}
                          </span>
                        </div>

                        {/* Location row (full width on mobile) */}
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <LocationOn sx={{ fontSize: 14, color: '#64748b' }} />
                          <div className="min-w-0 flex-1 leading-snug sm:truncate sm:whitespace-nowrap">
                            {field.location}
                          </div>
                        </div>
                      </div>

                      {/* Actions + price row (full width on mobile) */}
                      <div className="mt-1 flex w-full items-center justify-between gap-2 sm:mt-0 sm:w-auto sm:justify-end">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-bold text-emerald-600">
                            {currencySymbols[userCurrency]}{monthly}
                          </div>
                          <div className="text-[0.65rem] font-medium text-slate-500">/month</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {field.is_own_field && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditField(field); }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                              title="Edit field"
                              aria-label="Edit field"
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleViewOnMap(field); }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50"
                            title="View on map"
                            aria-label="View on map"
                          >
                            <LocationOn sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ml-1 shrink-0 text-slate-400">
                    {isExpanded ? '▴' : '▾'}
                  </div>
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-slate-200 px-3 py-3">
                    <div className="mb-3 text-xs text-slate-500">
                      <div className="font-semibold text-slate-800">Crop</div>
                      <div className="text-slate-700">{field.cropType}</div>
                    </div>

                    <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Harvest</span>
                        <span className="truncate font-semibold text-slate-900">{harvestText}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Shipping</span>
                        <span className="truncate font-semibold text-slate-900">{shippingText}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Total</span>
                        <span className="font-semibold text-slate-900">
                          {field.total_area_display || `${field.total_area} m²`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Occupied</span>
                        <span className="font-semibold text-slate-900">{field.area}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Available</span>
                        <span className="font-semibold text-slate-900">{field.available_area_display || `${field.available_area} m²`}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[0.7rem] text-slate-500">
                        <span>Occupied Area</span>
                        <span className="font-semibold text-slate-900">{field.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: `${field.progress}%`, backgroundColor: progressColor }} />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleFieldClick(field); }}
                        className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        <Visibility sx={{ fontSize: 16 }} />
                        <span>View details</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {displayedFields.length > itemsPerPage && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 4 }}>
            {!showAllFields ? (
              <>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Showing {startIndex + 1}-{Math.min(endIndex, displayedFields.length)} of {displayedFields.length} fields
                </Typography>
                <Button
                  variant="outlined"
                  size="medium"
                  onClick={handleViewAllClick}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    borderColor: '#e2e8f0',
                    color: '#64748b',
                    '&:hover': {
                      borderColor: '#3b82f6',
                      color: '#3b82f6',
                      bgcolor: '#f8fafc'
                    }
                  }}
                >
                  View All Fields ({displayedFields.length})
                </Button>
              </>
            ) : (
              <Button
                variant="outlined"
                size="medium"
                onClick={handleViewAllClick}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  borderColor: '#e2e8f0',
                  color: '#64748b',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    color: '#3b82f6',
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                Show Paginated View
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Field Detail Modal (MUI dialog disabled, Tailwind overlay below) */}
      <Dialog
        open={false}
        onClose={handleCloseFieldDetail}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                {selectedField?.name || selectedField?.farmName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Rented Field Details
              </Typography>
              {selectedField?.status && (
                <Chip
                  label={selectedField.status}
                  color={getStatusColor(selectedField.status)}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    height: 24,
                    fontSize: '0.7rem',
                    ...(selectedField.status === 'Active' && {
                      color: '#ffffff'
                    })
                  }}
                />
              )}
            </Box>
            <IconButton
              onClick={handleCloseFieldDetail}
              sx={{
                color: '#64748b',
                '&:hover': { backgroundColor: '#f3f4f6' }
              }}
            >
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedField && (
            <Box>
              {/* Field Information Section */}
              <Paper sx={{ p: 2.5, backgroundColor: '#f8fafc', borderRadius: 2, mb: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1e293b', fontSize: '0.95rem' }}>
                  Field Information
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <LocationOn sx={{ fontSize: 20, color: '#3b82f6', mt: 0.25 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mb: 0.25 }}>
                        Location
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                        {selectedField.location}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <Agriculture sx={{ fontSize: 20, color: '#10b981', mt: 0.25 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mb: 0.25 }}>
                        Crop Type
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                        {selectedField.cropType}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <CalendarToday sx={{ fontSize: 20, color: '#f59e0b', mt: 0.25 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mb: 0.25 }}>
                        Harvest Date
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                        {(() => {
                          const items = Array.isArray(selectedField.selected_harvests) ? selectedField.selected_harvests : [];
                          const format = (date) => {
                            if (!date) return '';
                            if (typeof date === 'string' && /\d{1,2}\s\w{3}\s\d{4}/.test(date)) return date;
                            const d = new Date(date);
                            if (isNaN(d.getTime())) return date;
                            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                          };
                          if (items.length) {
                            const mapped = items.map(it => {
                              const dt = format(it.date);
                              if (it.label && dt) return `${dt} (${it.label})`;
                              if (dt) return dt;
                              if (it.label) return it.label;
                              return '';
                            }).filter(Boolean);
                            const uniq = Array.from(new Set(mapped));
                            return uniq.join(', ') || 'Not specified';
                          }
                          return selectedField.selected_harvest_label || selectedField.selected_harvest_date || 'Not specified';
                        })()}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ pt: 1, borderTop: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mb: 1 }}>
                      Area Details
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Occupied: <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedField.area}</span>
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Available: <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedField.available_area_display || `${selectedField.available_area} m²`}</span>
                      </Typography>
                      {selectedField.total_area && (
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Total: <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedField.total_area_display || `${selectedField.total_area} m²`}</span>
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>

              {/* Rental Details Section */}
              <Paper sx={{ p: 2.5, backgroundColor: '#f0fdf4', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1e293b', fontSize: '0.95rem' }}>
                  Rental Details
                </Typography>
                <Stack spacing={2.5}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Occupied Area
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                        {selectedField.progress}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={selectedField.progress}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: selectedField.progress === 100 ? '#10b981' : selectedField.progress > 50 ? '#3b82f6' : '#f59e0b',
                          borderRadius: 5
                        }
                      }}
                    />
                  </Box>

                  <Divider />

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                      Monthly Rent
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                      {currencySymbols[userCurrency]}{(() => {
                        const amount = parseFloat(selectedField.monthlyRent) || 0;
                        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </Typography>
                  </Stack>

                  {selectedField.rentPeriod && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Rent Period
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {selectedField.rentPeriod}
                      </Typography>
                    </Stack>
                  )}

                  {selectedField.farmer_name && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Farmer
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {selectedField.farmer_name}
                      </Typography>
                    </Stack>
                  )}

                  {selectedField.shipping_modes && selectedField.shipping_modes.length > 0 && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Shipping Mode
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {(() => {
                          const modes = Array.isArray(selectedField.shipping_modes) ? selectedField.shipping_modes : [];
                          const uniq = (() => { const s = new Set(); return modes.filter(m => { const k = (m || '').toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); })();
                          return uniq.length ? uniq.join(', ') : 'Not specified';
                        })()}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 2, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 1 }}>
          {selectedField?.is_own_field && (
            <>
              <Button
                onClick={() => { openEditField(selectedField); handleCloseFieldDetail(); }}
                variant="contained"
                startIcon={<EditIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  bgcolor: '#3b82f6',
                  '&:hover': { bgcolor: '#2563eb' }
                }}
              >
                Edit field
              </Button>
              {/* Rent disabled – only buy for now
              <Button
                onClick={() => { openEditRent(selectedField); handleCloseFieldDetail(); }}
                variant="outlined"
                startIcon={<RentIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  borderColor: '#059669',
                  color: '#059669',
                  '&:hover': { borderColor: '#4CAF50', bgcolor: '#f0fdf4' }
                }}
              >
                Rent settings
              </Button>
              */}
            </>
          )}
          <Button
            onClick={handleCloseFieldDetail}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              borderColor: '#e2e8f0',
              color: '#64748b',
              '&:hover': {
                borderColor: '#059669',
                color: '#059669',
                bgcolor: '#f0fdf4'
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tailwind field detail overlay */}
      {fieldDetailOpen && selectedField && (
        <div
          className="fixed inset-0 z-50 flex justify-center bg-black/40"
          style={{
            alignItems: 'flex-start',
            paddingTop: 'calc(var(--app-header-height, 64px) + 12px)',
          }}
        >
          <div className="max-h-[calc(90vh-var(--app-header-height,64px))] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl md:p-6">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedField.name || selectedField.farmName}
                </h2>
                <p className="text-xs text-slate-500">
                  Rented field details
                </p>
                {selectedField.status && (
                  <span
                    className="mt-2 inline-flex items-center rounded-full px-2 py-1 text-[0.7rem] font-semibold"
                    style={{
                      backgroundColor:
                        selectedField.status === 'Active'
                          ? '#22c55e'
                          : selectedField.status === 'Pending'
                          ? '#facc15'
                          : '#e5e7eb',
                      color:
                        selectedField.status === 'Active'
                          ? '#ffffff'
                          : '#374151',
                    }}
                  >
                    {selectedField.status}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseFieldDetail}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <Close sx={{ fontSize: 18 }} />
              </button>
            </div>

            {/* Field info */}
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Field Information
                </h3>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-start gap-1.5">
                    <LocationOn sx={{ fontSize: 18, color: '#3b82f6' }} />
                    <div>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                        Location
                      </div>
                      <div>{selectedField.location}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Agriculture sx={{ fontSize: 18, color: '#10b981' }} />
                    <div>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                        Crop Type
                      </div>
                      <div>{selectedField.cropType}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CalendarToday sx={{ fontSize: 18, color: '#f59e0b' }} />
                    <div>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                        Harvest Date
                      </div>
                      <div>
                        {(() => {
                          const items = Array.isArray(selectedField.selected_harvests) ? selectedField.selected_harvests : [];
                          const format = (date) => {
                            if (!date) return '';
                            if (typeof date === 'string' && /\d{1,2}\s\w{3}\s\d{4}/.test(date)) return date;
                            const d = new Date(date);
                            if (isNaN(d.getTime())) return date;
                            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                          };
                          if (items.length) {
                            const mapped = items.map(it => {
                              const dt = format(it.date);
                              if (it.label && dt) return `${dt} (${it.label})`;
                              if (dt) return dt;
                              if (it.label) return it.label;
                              return '';
                            }).filter(Boolean);
                            const uniq = Array.from(new Set(mapped));
                            return uniq.join(', ') || 'Not specified';
                          }
                          return selectedField.selected_harvest_label || selectedField.selected_harvest_date || 'Not specified';
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    <div className="mb-1 font-semibold text-slate-700">
                      Area Details
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span>
                        Occupied:{' '}
                        <span className="font-semibold text-slate-900">
                          {selectedField.area}
                        </span>
                      </span>
                      <span>
                        Available:{' '}
                        <span className="font-semibold text-slate-900">
                          {selectedField.available_area_display || `${selectedField.available_area} m²`}
                        </span>
                      </span>
                      {selectedField.total_area && (
                        <span>
                          Total:{' '}
                          <span className="font-semibold text-slate-900">
                            {selectedField.total_area_display || `${selectedField.total_area} m²`}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rental details */}
              <div className="rounded-xl bg-emerald-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  Rental Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                      <span>Occupied Area</span>
                      <span className="font-semibold text-slate-900">
                        {selectedField.progress}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${selectedField.progress}%`,
                          backgroundColor:
                            selectedField.progress === 100
                              ? '#10b981'
                              : selectedField.progress > 50
                              ? '#3b82f6'
                              : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="text-xs text-slate-600">Monthly Rent</span>
                    <span className="text-sm font-semibold text-emerald-600">
                      {currencySymbols[userCurrency]}
                      {(() => {
                        const amount = parseFloat(selectedField.monthlyRent) || 0;
                        return amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      })()}
                    </span>
                  </div>

                  {selectedField.rentPeriod && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Rent Period</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {selectedField.rentPeriod}
                      </span>
                    </div>
                  )}

                  {selectedField.farmer_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Farmer</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {selectedField.farmer_name}
                      </span>
                    </div>
                  )}

                  {selectedField.shipping_modes && selectedField.shipping_modes.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Shipping Mode</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {(() => {
                          const modes = Array.isArray(selectedField.shipping_modes) ? selectedField.shipping_modes : [];
                          const uniq = (() => {
                            const s = new Set();
                            return modes.filter(m => {
                              const k = (m || '').toLowerCase();
                              if (s.has(k)) return false;
                              s.add(k);
                              return true;
                            });
                          })();
                          return uniq.length ? uniq.join(', ') : 'Not specified';
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Close button */}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseFieldDetail}
                  className="rounded-xl border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Field (CreateFieldForm in edit mode) */}
      <CreateFieldForm
        open={editFieldOpen}
        onClose={() => { setEditFieldOpen(false); setEditingFieldFull(null); }}
        onSubmit={handleFullFieldSubmit}
        editMode={true}
        initialData={editingFieldFull ? fieldToFormInitialData(editingFieldFull) : null}
        farmsList={farmsListForEdit}
      />

      {/* Edit Rent Settings Dialog */}
      <Dialog open={editRentOpen} onClose={closeEditRent} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', pb: 2 }}>
          Make this field available for rent
          {editRentField && (
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5 }}>
              {editRentField.name || editRentField.farmName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This field is always available for buy. You can also make it available for rent and set rent price and durations.
          </Typography>
          <Stack spacing={2.5}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={editRentForm.available_for_rent}
                  onChange={(e) => setEditRentForm((f) => ({ ...f, available_for_rent: e.target.checked }))}
                  color="primary"
                />
              }
              label="Also available for rent"
            />
            {editRentForm.available_for_rent && (
              <>
                <TextField
                  label="Rent price per month ($)"
                  type="number"
                  fullWidth
                  size="small"
                  value={editRentForm.rent_price_per_month}
                  onChange={(e) => setEditRentForm((f) => ({ ...f, rent_price_per_month: e.target.value }))}
                  inputProps={{ min: 0, step: 0.01 }}
                  error={editRentForm.available_for_rent && (!editRentForm.rent_price_per_month || isNaN(parseFloat(editRentForm.rent_price_per_month)))}
                />
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1 }}>
                    Rent duration(s) offered (select at least one)
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editRentForm.rent_duration_monthly}
                          onChange={(e) => setEditRentForm((f) => ({ ...f, rent_duration_monthly: e.target.checked }))}
                          color="primary"
                        />
                      }
                      label="Monthly"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editRentForm.rent_duration_quarterly}
                          onChange={(e) => setEditRentForm((f) => ({ ...f, rent_duration_quarterly: e.target.checked }))}
                          color="primary"
                        />
                      }
                      label="Quarterly"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editRentForm.rent_duration_yearly}
                          onChange={(e) => setEditRentForm((f) => ({ ...f, rent_duration_yearly: e.target.checked }))}
                          color="primary"
                        />
                      }
                      label="Yearly"
                    />
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
          {editRentError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setEditRentError('')}>
              {editRentError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={closeEditRent} disabled={editRentSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleEditRentSave} disabled={editRentSaving} sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#4CAF50' } }}>
            {editRentSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Field Report Modal */}
      <Dialog
        open={reportOpen}
        onClose={handleCloseReport}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                Field Rental Report
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive overview of your rented fields
              </Typography>
            </Box>
            <IconButton onClick={handleCloseReport} sx={{ color: '#64748b' }}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box>
            {/* Summary Statistics */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                    {totalFields}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Fields
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
                    {activeFields}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Rentals
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#fef3c7', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#d97706', mb: 0.5 }}>
                    {avgProgress}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Occupied Area
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
                    {currencySymbols[userCurrency]}{totalMonthlyRent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Revenue
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Fields Summary Table */}
            <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                Fields Summary
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Field Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Crop Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Monthly Rent</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Occupied Area</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedFields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>{field.name || field.farmName}</TableCell>
                        <TableCell>{field.location}</TableCell>
                        <TableCell>{field.cropType}</TableCell>
                        <TableCell>{field.area}</TableCell>
                        <TableCell>
                          {currencySymbols[userCurrency]}{(() => {
                            const amount = parseFloat(field.monthlyRent) || 0;
                            return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </TableCell>
                        <TableCell>{field.progress}%</TableCell>
                        <TableCell>
                          <Chip
                            label={field.status}
                            color={getStatusColor(field.status)}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              ...(field.status === 'Active' && {
                                color: '#ffffff'
                              })
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Report generated on {new Date().toLocaleString()}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => handleDownloadReport('csv')}
            variant="outlined"
            startIcon={<Download />}
            sx={{ borderRadius: 1.5 }}
          >
            Download CSV
          </Button>
          <Button
            onClick={() => handleDownloadReport('pdf')}
            variant="outlined"
            startIcon={<Description />}
            sx={{ borderRadius: 1.5 }}
          >
            Download PDF
          </Button>
          <Button onClick={handleCloseReport} variant="contained" sx={{ borderRadius: 1.5, bgcolor: '#4caf50', color: '#ffffff', '&:hover': { bgcolor: '#059669' } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RentedFields;
