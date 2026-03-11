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
import { useAuth } from '../contexts/AuthContext';
import rentedFieldsService from '../services/rentedFields';
import { orderService } from '../services/orders';
import farmsService from '../services/farms';
import CreateFieldForm from '../components/Forms/CreateFieldForm';

const SEGMENT_ALL = 'all';
const SEGMENT_OWNED = 'owned';
const SEGMENT_RENTED = 'rented';

// Map fields API response to the shape the UI expects
function mapFieldFromApi(raw, currentUserId) {
  const areaM2 = typeof raw.area_m2 === 'string' ? parseFloat(raw.area_m2) : (raw.area_m2 ?? 0);
  const availableArea = typeof raw.available_area === 'string' ? parseFloat(raw.available_area) : (raw.available_area ?? 0);
  const totalArea = typeof raw.total_area === 'string' ? parseFloat(raw.total_area) : (raw.total_area ?? areaM2) || areaM2;
  const pricePerM2 = typeof raw.price_per_m2 === 'string' ? parseFloat(raw.price_per_m2) : (raw.price_per_m2 ?? 0);
  const quantity = typeof raw.quantity === 'string' ? parseFloat(raw.quantity) : (raw.quantity ?? 0);
  const occupied = Math.max(0, totalArea - availableArea);
  const progress = totalArea > 0 ? Math.round((occupied / totalArea) * 100) : 0;
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
    total_area: totalArea,
    area_m2: areaM2,
    available_area: availableArea,
    area: quantity ? `${quantity} ${raw.unit || 'm²'}` : `${areaM2} m²`,
    price_per_m2: pricePerM2,
    monthlyRent: (pricePerM2 * (quantity || areaM2)) || (typeof raw.price === 'string' ? parseFloat(raw.price) : raw.price),
    status: raw.available !== false ? 'Active' : 'Inactive',
    progress,
    selected_harvests: harvestDates,
    selected_harvest_date: harvestDates[0]?.date,
    selected_harvest_label: harvestDates[0]?.label,
    shipping_modes: shippingModes,
    image_url: raw.image,
    farmer_name: raw.farmer_name,
    created_at: raw.created_at,
    rentPeriod: totalArea > 0 ? 'Ongoing' : null,
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
  const totalArea = typeof r.total_area === 'string' ? parseFloat(r.total_area) : (r.total_area ?? 0);
  const availableArea = typeof r.available_area === 'string' ? parseFloat(r.available_area) : (r.available_area ?? 0);
  const areaRented = r.area_rented != null && r.area_rented !== '' ? parseFloat(r.area_rented) : 0;
  const occupied = Math.max(0, totalArea > 0 ? totalArea - availableArea : areaRented);
  const progress = totalArea > 0 ? Math.round((occupied / totalArea) * 100) : 0;
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
    total_area: totalArea,
    area_m2: areaRented,
    available_area: availableArea,
    area: `${areaRented} m²`,
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
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
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
              py: 1
            }}
          >
            Field Report
          </Button>
        </Stack>

        {/* Stats Overview */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    width: 40,
                    height: 40
                  }}
                >
                  <Agriculture sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {totalFields}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Total Fields
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    backgroundColor: '#dcfce7',
                    color: '#059669',
                    width: 40,
                    height: 40
                  }}
                >
                  <TrendingUp sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {activeFields}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Active Rentals
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    backgroundColor: '#f3e8ff',
                    color: '#7c3aed',
                    width: 40,
                    height: 40
                  }}
                >
                  <Assessment sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {avgProgress}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Avg Progress
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    backgroundColor: '#fef3c7',
                    color: '#d97706',
                    width: 40,
                    height: 40
                  }}
                >
                  <Schedule sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {currencySymbols[userCurrency]}{totalMonthlyRent.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Monthly Revenue
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Filters: segment, search, category */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Tabs
            value={segment}
            onChange={(_, v) => { setSegment(v); setCurrentPage(1); }}
            sx={{ minHeight: 40, mb: 2, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
          >
            <Tab value={SEGMENT_ALL} label="All fields" />
            <Tab value={SEGMENT_OWNED} label="My fields (owned)" icon={<HomeWork sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value={SEGMENT_RENTED} label="Rented from others" icon={<Store sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              placeholder="Search by name, location, crop..."
              size="small"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <FormControl size="small" sx={{ minWidth: 180, borderRadius: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">All categories</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {(searchQuery || categoryFilter || segment !== SEGMENT_ALL) && (
              <Button
                size="small"
                onClick={() => { setSearchQuery(''); setCategoryFilter(''); setSegment(SEGMENT_ALL); setCurrentPage(1); }}
              >
                Clear filters
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Fields Grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)'
          },
          gap: 2,
          alignItems: 'stretch',
          width: '100%'
        }}>
          {paginatedFields.map((field) => (
            <Card
              key={field.id}
              elevation={0}
              sx={{
                height: 420, // Fixed height for consistency
                minWidth: 0, // Prevent overflow
                maxWidth: '100%', // Ensure it doesn't exceed grid cell
                width: '100%', // Full width of grid cell
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                bgcolor: 'white',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden', // Prevent content overflow
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
                  borderColor: '#3b82f6'
                }
              }}
            >
              <CardContent sx={{
                p: 0,
                '&:last-child': { pb: 0 },
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0, // Prevent overflow
                width: '100%'
              }}>
                {/* Card Header */}
                <Box sx={{ p: 2, pb: 1.5, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: '#1a202c',
                          fontSize: '1rem',
                          mb: 0.25,
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {field.name || field.farmName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationOn sx={{ fontSize: 14, color: '#64748b', mr: 0.5 }} />
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                          {field.location}
                        </Typography>
                      </Box>
                    </Box>
                    {field.is_own_field && (
                      <Stack direction="row" spacing={0.5} flexShrink={0}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openEditField(field); }}
                          sx={{
                            color: '#3b82f6',
                            bgcolor: '#eff6ff',
                            '&:hover': { bgcolor: '#dbeafe', color: '#2563eb' },
                            width: 32,
                            height: 32
                          }}
                          title="Edit field"
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        {/* Rent disabled – only buy for now
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openEditRent(field); }}
                          sx={{
                            color: '#059669',
                            bgcolor: '#f0fdf4',
                            '&:hover': { bgcolor: '#dcfce7', color: '#4CAF50' },
                            width: 32,
                            height: 32
                          }}
                          title="Edit rent settings"
                        >
                          <RentIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        */}
                      </Stack>
                    )}
                  </Box>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={field.is_own_field ? 'My field' : 'Rented'}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 24,
                        borderRadius: 1.5,
                        bgcolor: field.is_own_field ? '#dbeafe' : '#fef3c7',
                        color: field.is_own_field ? '#1d4ed8' : '#b45309'
                      }}
                    />
                    <Chip
                      label={field.status}
                      color={getStatusColor(field.status)}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 24,
                        borderRadius: 1.5,
                        ...(field.status === 'Active' && {
                          color: '#ffffff'
                        })
                      }}
                    />
                  </Stack>
                </Box>

                <Divider sx={{ mx: 2 }} />

                {/* Field Details */}
                <Box sx={{ p: 2, py: 1.5, flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Agriculture sx={{ fontSize: 16, color: '#10b981', mr: 0.75 }} />
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                          Crop Type
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a202c', fontSize: '0.8rem' }}>
                        {field.cropType}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarToday sx={{ fontSize: 16, color: '#3b82f6', mr: 0.75 }} />
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                          Harvest Date
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a202c', fontSize: '0.8rem' }}>
                        {(() => {
                          const items = Array.isArray(field.selected_harvests) ? field.selected_harvests : [];
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
                            return uniq.join(', ');
                          }
                          return field.selected_harvest_label || field.selected_harvest_date || 'Not specified';
                        })()}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" style={{ marginRight: 6 }}><path d="M20 8h-3V4H7v4H4v12h16V8zm-9 0V6h2v2h-2zm9 10H4v-8h16v8z" /></svg>
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                          Mode of Shipping
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a202c', fontSize: '0.8rem' }}>
                        {(() => {
                          const modes = Array.isArray(field.shipping_modes) ? field.shipping_modes : [];
                          const uniq = (() => { const s = new Set(); return modes.filter(m => { const k = (m || '').toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); })();
                          return uniq.length ? uniq.join(', ') : 'Not specified';
                        })()}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                        Occupied: {field.area}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a202c', fontSize: '0.8rem' }}>
                        {field.available_area}m² available
                      </Typography>
                    </Box>

                    {/* Progress Bar */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                          Occupied Area
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a202c', fontSize: '0.8rem' }}>
                          {field.progress}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={field.progress}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: '#f1f5f9',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: field.progress === 100 ? '#10b981' : field.progress > 50 ? '#3b82f6' : '#f59e0b'
                          }
                        }}
                      />
                    </Box>
                  </Stack>
                </Box>

                <Divider sx={{ mx: 2 }} />

                {/* Card Footer */}
                <Box sx={{ p: 2, pt: 1.5, mt: 'auto', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: '#059669',
                        fontSize: '1.25rem'
                      }}
                    >
                      {currencySymbols[userCurrency]}{(() => {
                        const amount = parseFloat(field.monthlyRent) || 0;
                        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>
                      /month
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => handleFieldClick(field)}
                    sx={{
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      bgcolor: '#4caf50',
                      color: '#ffffff',
                      py: 0.75,

                    }}
                  >
                    View Details
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

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

      {/* Field Detail Modal */}
      <Dialog
        open={fieldDetailOpen}
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
                        Available: <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedField.available_area}m²</span>
                      </Typography>
                      {selectedField.total_area && (
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          Total: <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedField.total_area}m²</span>
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
