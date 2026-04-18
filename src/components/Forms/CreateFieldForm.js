import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  InputAdornment,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Alert,
  AlertTitle,
} from '@mui/material';

import {
  Close,
  LocationOn,
  Add,
  Remove,
  Agriculture,
  Grass,
  Nature,
  LocalFlorist,
  Park,
  Terrain,
  Yard
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import LocationPicker from './LocationPicker';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../services/supabase';
import { v4 as uuidv4 } from 'uuid';
import { userDocumentsService } from '../../services/userDocuments';
import { useNavigate } from 'react-router-dom';
import farmsService from '../../services/farms';
import { getProductIcon, getProductImageUrlForStorage } from '../../utils/productIcons';
import { FIELD_CATEGORY_DATA as categoryData } from '../../utils/fieldCategoryData';
import {
  normalizeTotalProductionUnit,
  perAreaUnitSuffix,
  usdPerProductionUnitSuffix,
  productionUnitLabel,
} from '../../utils/fieldProductionUnits';
import { fieldHasOngoingPurchase, normalizeOrdersArray } from '../../utils/fieldEditRestrictions';
import { orderService } from '../../services/orders';

/** Numeric inputs that must not go negative (field size, pricing, rent). */
const NON_NEGATIVE_NUMERIC_FIELDS = new Set([
  'fieldSize',
  'totalProduction',
  'distributionPrice',
  'retailPrice',
  'sellingPrice',
  'sellingAmount',
  'rent_price_per_month',
]);

/** Editable while purchases are open; all other `handleInputChange` keys stay blocked. */
const ALLOWED_FIELD_EDITS_WHEN_COMMERCIAL_LOCKED = new Set([
  'productName',
  'description',
  'shortDescription',
  'galleryImages',
]);

function clampNonNegativeNumericInput(value) {
  if (value === '' || value == null) return value;
  const s = String(value);
  if (/^-/.test(s)) return s.replace(/^-+/, '') || '';
  const n = parseFloat(s);
  if (!Number.isNaN(n) && n < 0) return '';
  return s;
}

// Custom hook for mobile detection
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

// Styled components for SaaS design
const StyledDialog = styled(Dialog)(({ theme, isMobile }) => ({
  '& .MuiDialog-paper': {
    borderRadius: isMobile ? '12px' : '20px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e0e7ff',
    maxWidth: isMobile ? '320px' : '800px',
    width: isMobile ? '320px' : '800px',
    margin: isMobile ? '8px' : '32px',
    maxHeight: isMobile ? '85vh' : '90vh',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme, isMobile }) => ({
  background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
  color: 'white',
  fontWeight: 700,
  fontSize: isMobile ? '1.2rem' : '1.5rem',
  textAlign: 'center',
  padding: isMobile ? '16px' : '24px',
  borderRadius: isMobile ? '12px 12px 0 0' : '20px 20px 0 0',
}));

const StyledDialogContent = styled(DialogContent)(({ theme, isMobile }) => ({
  padding: isMobile ? '16px' : '32px',
  background: 'linear-gradient(135deg, #f8fffe 0%, #f1f8e9 100%)',
  maxHeight: isMobile ? '75vh' : '80vh',
  overflowY: 'auto',
}));

const StyledTextField = styled(TextField)(({ theme, isMobile, isSuggested }) => ({
  width: isMobile ? '100%' : '320px',
  '& .MuiOutlinedInput-root': {
    borderRadius: isMobile ? '8px' : '12px',
    backgroundColor: isSuggested ? '#f8fafc' : '#ffffff',
    transition: 'all 0.3s ease',
    fontSize: isMobile ? '14px' : '16px',
    height: isMobile ? '48px' : '56px',
    '&:not(.Mui-disabled):hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#c8e6c9',
      boxShadow: isSuggested ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.1)',
    },
    '&.Mui-focused:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
      borderColor: isSuggested ? '#e2e8f0' : '#4caf50',
      borderWidth: isSuggested ? '1px' : '2px',
    },
    '&.Mui-disabled': {
      backgroundColor: '#e8edf3 !important',
      cursor: 'not-allowed',
    },
    '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
      borderColor: '#94a3b8 !important',
      borderWidth: '1px',
    },
    '&.Mui-disabled:hover': {
      backgroundColor: '#e8edf3 !important',
    },
  },
  '& .MuiInputBase-input': {
    fontStyle: isSuggested ? 'italic' : 'normal',
    color: isSuggested ? '#64748b' : 'inherit',
    cursor: isSuggested ? 'default' : 'text',
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: '#475569',
    cursor: 'not-allowed',
  },
  '& .MuiInputLabel-root': {
    color: '#4a5568',
    fontWeight: 500,
    fontSize: isMobile ? '12px' : '14px',
    zIndex: 1,
    '&.Mui-focused': {
      color: isSuggested ? '#4a5568' : '#4caf50',
    },
    '&.Mui-disabled': {
      color: '#64748b',
    },
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: '2px solid #e8f5e8',
    borderRadius: isMobile ? '8px' : '12px',
    transition: 'all 0.3s ease',
  },
  '& .MuiFormHelperText-root': {
    fontSize: isMobile ? '10px' : '12px',
  },
}));

const StyledFormControl = styled(FormControl)(({ theme, isMobile }) => ({
  width: isMobile ? '100%' : '320px',
  '& .MuiOutlinedInput-root': {
    borderRadius: isMobile ? '8px' : '12px',
    backgroundColor: '#ffffff',
    transition: 'all 0.3s ease',
    fontSize: isMobile ? '14px' : '16px',
    height: isMobile ? '48px' : '56px',
    '&:not(.Mui-disabled):hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#c8e6c9',
    },
    '&.Mui-focused:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
      borderColor: '#4caf50',
      borderWidth: '2px',
    },
    '&.Mui-disabled': {
      backgroundColor: '#e8edf3 !important',
      cursor: 'not-allowed',
    },
    '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
      borderColor: '#94a3b8 !important',
      borderWidth: '1px',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#4a5568',
    fontWeight: 500,
    fontSize: isMobile ? '12px' : '14px',
    zIndex: 1,
    '&.Mui-focused': {
      color: '#4caf50',
    },
    '&.Mui-disabled': {
      color: '#64748b',
    },
  },
  '& .MuiSelect-select.Mui-disabled': {
    WebkitTextFillColor: '#475569',
    cursor: 'not-allowed',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: '2px solid #e8f5e8',
    borderRadius: isMobile ? '8px' : '12px',
    transition: 'all 0.3s ease',
  },
  '& .MuiSelect-select': {
    paddingRight: '48px !important',
    fontSize: isMobile ? '14px' : '16px',
    display: 'flex',
    alignItems: 'center',
    height: '100% !important',
    paddingTop: '0 !important',
    paddingBottom: '0 !important',
  },
}));

const StyledButton = styled(Button)(({ theme, isMobile }) => ({
  borderRadius: isMobile ? '8px' : '12px',
  padding: isMobile ? '8px 16px' : '12px 24px',
  fontWeight: 600,
  textTransform: 'none',
  fontSize: isMobile ? '14px' : '1rem',
  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4)',
  },
}));


const CombinedInputContainer = styled(Box)(({ theme, isMobile }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  flexWrap: isMobile ? 'wrap' : 'nowrap',
  gap: isMobile ? '12px' : '12px',
  width: '100%',
  maxWidth: '100%',
  '& .MuiTextField-root': {
    flex: '1 1 auto',
    minWidth: 0,
    width: 'auto !important',
    maxWidth: '100%',
  },
  '& .MuiFormControl-root': {
    flex: isMobile ? '1 1 100%' : '0 0 auto',
    width: isMobile ? '100% !important' : '132px !important',
    minWidth: isMobile ? '100%' : 132,
    maxWidth: isMobile ? '100%' : 132,
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: '#2d3748',
  marginBottom: '16px',
  fontSize: '1.25rem',
  borderBottom: '2px solid #e8f5e8',
  paddingBottom: '8px',
}));

// const StyledRadioGroup = styled(RadioGroup)(({ theme }) => ({
//   '& .MuiFormControlLabel-root': {
//     backgroundColor: '#ffffff',
//     margin: '4px',
//     borderRadius: '12px',
//     border: '2px solid #e8f5e8',
//     padding: '8px 16px',
//     transition: 'all 0.3s ease',
//     '&:hover': {
//       borderColor: '#c8e6c9',
//       boxShadow: '0 4px 12px rgba(76, 175, 80, 0.1)',
//     },
//   },
//   '& .MuiRadio-root.Mui-checked + .MuiFormControlLabel-label': {
//     color: '#4caf50',
//     fontWeight: 600,
//   },
// }));

// const InfoBox = styled(Box)(({ theme }) => ({
//   backgroundColor: '#f8fffe',
//   border: '1px solid #e8f5e8',
//   borderRadius: '12px',
//   padding: '16px',
//   marginBottom: '16px',
//   '& .MuiTypography-root': {
//     color: '#4a5568',
//     fontSize: '0.875rem',
//   },
// }));

const StyledDialogActions = styled(DialogActions)(({ theme, isMobile }) => ({
  padding: isMobile ? '16px 20px' : '24px 32px',
  backgroundColor: '#ffffff',
  borderTop: '1px solid #e8f5e8',
  borderRadius: isMobile ? '0 0 12px 12px' : '0 0 20px 20px',
  gap: isMobile ? '8px' : '12px',
  flexDirection: isMobile ? 'column' : 'row',
  '& .MuiButton-root': {
    width: isMobile ? '100%' : 'auto',
  }
}));

const FormSection = styled(Paper)(({ theme }) => ({
  padding: '24px',
  marginBottom: '24px',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
  border: '1px solid #e8f5e8',
}));

/** Wrapper + descendant styles when commercial fields are read-only (pending orders). */
const lockedCommercialWrapSx = {
  position: 'relative',
  borderRadius: 2,
  border: '1px dashed #94a3b8',
  bgcolor: 'rgba(15, 23, 42, 0.045)',
  p: 1.5,
  mb: 2,
  '& .MuiOutlinedInput-root.Mui-disabled': {
    backgroundColor: '#e2e8f0 !important',
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: '#475569',
  },
  '& .MuiInputLabel-root.Mui-disabled': {
    color: '#64748b',
  },
  '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': {
    borderColor: '#94a3b8 !important',
  },
  '& .MuiSelect-icon.Mui-disabled': {
    color: '#94a3b8',
  },
  '& .MuiIconButton-root.Mui-disabled': {
    opacity: 0.4,
  },
  '& .MuiRadio-root.Mui-disabled': {
    color: '#94a3b8',
  },
  '& .MuiFormControlLabel-label.Mui-disabled': {
    color: '#64748b',
  },
  '& .MuiFormControlLabel-root.Mui-disabled': {
    opacity: 0.85,
  },
  '& .MuiButton-root.Mui-disabled': {
    borderColor: '#cbd5e1',
    color: '#94a3b8',
  },
};

// Farm icons mapping
const farmIcons = [
  { value: 'agriculture', label: 'Agriculture', icon: <Agriculture sx={{ color: '#8bc34a' }} /> },
  { value: 'grass', label: 'Grass Field', icon: <Grass sx={{ color: '#4caf50' }} /> },
  { value: 'eco', label: 'Eco Farm', icon: <Nature sx={{ color: '#2e7d32' }} /> },
  { value: 'flower', label: 'Flower Farm', icon: <LocalFlorist sx={{ color: '#e91e63' }} /> },
  { value: 'park', label: 'Park Farm', icon: <Park sx={{ color: '#388e3c' }} /> },
  { value: 'terrain', label: 'Terrain', icon: <Terrain sx={{ color: '#795548' }} /> },
  { value: 'nature', label: 'Nature Farm', icon: <Nature sx={{ color: '#689f38' }} /> },
  { value: 'yard', label: 'Yard', icon: <Yard sx={{ color: '#558b2f' }} /> }
];

// Helper to normalize area unit to select values
const normalizeAreaUnit = (unit) => {
  if (!unit) return 'sqm';
  const u = unit.toLowerCase().trim();
  if (u === 'sqm' || u === 'm²' || u === 'm2' || u === 'm^2') return 'sqm';
  if (u === 'acres' || u === 'acre') return 'acres';
  if (u === 'hectares' || u === 'hectare' || u === 'ha') return 'hectares';
  return 'sqm';
};

// Helper to format date for input fields (yyyy-MM-dd format)
const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

/** yyyy-MM-dd for local calendar "today" (same basis as native date inputs). */
const getTodayYmdLocal = () => {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** True if ymd string (yyyy-MM-dd) is strictly before local today. */
const isYmdBeforeLocalToday = (ymd) => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd < getTodayYmdLocal();
};

const CreateFieldForm = ({
  open,
  onClose,
  onSubmit,
  editMode = false,
  initialData = null,
  farmsList = [],
  fieldsList = [],
  restrictCommercialEdits = false,
  ordersList = [],
}) => {
  // Debug logging

  // Mobile detection hook
  const isMobile = useIsMobile();
  const { user } = useAuth();

  /** Parent may pass orders before they load; refresh when edit dialog opens so lock matches server. */
  const [fetchedOrdersForLock, setFetchedOrdersForLock] = useState([]);
  useEffect(() => {
    if (!open || !editMode || !user?.id) {
      setFetchedOrdersForLock([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const ordersRes = await orderService.getFarmerOrdersWithFields(user.id);
        const raw = ordersRes?.data;
        const ord = Array.isArray(raw) ? raw : (raw?.orders ?? raw?.data ?? []);
        if (!cancelled) setFetchedOrdersForLock(Array.isArray(ord) ? ord : []);
      } catch {
        if (!cancelled) setFetchedOrdersForLock([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editMode, user?.id]);

  const ordersForCommercialLock = useMemo(
    () => [...normalizeOrdersArray(ordersList), ...normalizeOrdersArray(fetchedOrdersForLock)],
    [ordersList, fetchedOrdersForLock]
  );

  const lockCommercial =
    Boolean(editMode && restrictCommercialEdits) ||
    Boolean(editMode && initialData && fieldHasOngoingPurchase(initialData, ordersForCommercialLock));
  const navigate = useNavigate();
  const minSelectableDate = getTodayYmdLocal();
  /** Avoid repeated GET /api/farms/:id when parent props churn re-runs the area effect. */
  const farmDetailCacheRef = useRef(new Map());

  const [formData, setFormData] = useState({
    selectedIcon: '',
    category: '',
    subcategory: '',
    productName: '',
    description: '',
    shortDescription: '',
    galleryImages: [],
    totalProduction: '',
    fieldSize: '',
    fieldSizeUnit: normalizeAreaUnit('sqm'),
    productionPerArea: '', // Calculated
    distributionPrice: '',
    retailPrice: '',
    suggestedPrice: '', // Calculated
    sellingPrice: '', // This is YOUR SHARECROP PRICE
    sellingAmount: '', // How much to sell in app
    potentialIncome: '', // Calculated
    virtualProductionRate: '',
    virtualCostPerUnit: '', // Calculated from distributionPrice
    appFees: '', // Calculated (5%)
    userAreaVirtualRentPrice: '', // Calculated from sellingPrice
    harvestDates: [{ date: '', label: '' }],
    shippingOption: 'Both',
    deliveryTime: '',
    deliveryCharges: [{ upto: '', amount: '' }],
    hasWebcam: false,
    webcamUrl: '',
    latitude: '',
    longitude: '',
    shippingScope: 'Global',
    farmId: '',
    available_for_rent: false,
    rent_price_per_month: '',
    rent_duration_monthly: false,
    rent_duration_quarterly: false,
    rent_duration_yearly: false,
    totalProductionUnit: 'kg',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  // Selected farm info for area validation
  const [selectedFarmArea, setSelectedFarmArea] = useState({ total: 0, occupied: 0, remaining: 0, unit: 'sqm' });

  // Calculation logic for pricing and production
  useEffect(() => {
    const totalProd = parseFloat(formData.totalProduction) || 0;
    const rawSize = parseFloat(formData.fieldSize) || 0;
    
    // Normalize size to m2 for standardized backend storage and logic
    const unit = formData.fieldSizeUnit || 'sqm';
    let normalizedSize = rawSize;
    if (unit === 'acres') normalizedSize = rawSize * 4046.86;
    else if (unit === 'hectares') normalizedSize = rawSize * 10000;
    
    const distPrice = parseFloat(formData.distributionPrice) || 0;
    const retPrice = parseFloat(formData.retailPrice) || 0;
    const scPrice = parseFloat(formData.sellingPrice) || 0;
    const amountToSell = parseFloat(formData.sellingAmount) || 0;

    // Production per Area should be in Kg / m2 based on normalized size
    const prodPerArea = normalizedSize > 0 ? (totalProd / normalizedSize) : 0;
    const suggested = (distPrice + retPrice) / 2;
    const distPriceM2 = distPrice * prodPerArea;
    const scPriceM2 = scPrice * prodPerArea;
    const potential = amountToSell * scPrice;
    const fees = potential * 0.05;

    setFormData(prev => {
      // Only update if values actually changed to avoid infinite loops
      if (
        prev.productionPerArea === prodPerArea.toFixed(3) &&
        prev.suggestedPrice === suggested.toFixed(2) &&
        prev.virtualCostPerUnit === distPriceM2.toFixed(3) &&
        prev.userAreaVirtualRentPrice === scPriceM2.toFixed(3) &&
        prev.potentialIncome === potential.toFixed(2) &&
        prev.appFees === fees.toFixed(2)
      ) {
        return prev;
      }

      return {
        ...prev,
        productionPerArea: prodPerArea.toFixed(3),
        suggestedPrice: suggested.toFixed(2),
        virtualCostPerUnit: distPriceM2.toFixed(3),
        userAreaVirtualRentPrice: scPriceM2.toFixed(3),
        potentialIncome: potential.toFixed(2),
        appFees: fees.toFixed(2)
      };
    });
  }, [formData.totalProduction, formData.totalProductionUnit, formData.fieldSize, formData.fieldSizeUnit, formData.distributionPrice, formData.retailPrice, formData.sellingPrice, formData.sellingAmount]);

  useEffect(() => {
    if (!open) {
      farmDetailCacheRef.current.clear();
    }
  }, [open]);

  // Calculate remaining area whenever farm selection or fields change
  useEffect(() => {
    const calculateArea = async () => {
      if (formData.farmId) {
        const farmIdStr = String(formData.farmId);
        let farm = farmsList.find(f => String(f.id || f._id) === farmIdStr);

        if (!farm) {
          farm = farmDetailCacheRef.current.get(farmIdStr);
        }
        if (!farm) {
          try {
            const response = await farmsService.getById(farmIdStr);
            if (response.data) {
              farm = response.data;
              farmDetailCacheRef.current.set(farmIdStr, farm);
            }
          } catch (err) {
            console.error('Error fetching farm details:', err);
          }
        }

        if (farm) {
          const farmIdSource = String(farm.id || farm._id || '');
          const totalArea = parseFloat(farm.area_value || farm.areaValue) || 0;
          const farmUnit = normalizeAreaUnit(farm.area_unit || farm.areaUnit || 'sqm');

          // Use fields from parent only. Avoid calling /api/fields/all here (it was firing on every
          // effect run when the list was empty and fighting the map + form).
          const allFields = fieldsList || [];

          const farmFields = allFields.filter(field => {
            const fieldFarmId = String(field.farm_id || field.farmId || '').trim().toLowerCase();
            const farmIdTarget = farmIdSource.trim().toLowerCase();
            const isSameFarm = fieldFarmId === farmIdTarget;

            const ci = initialData || {};
            const currentFieldId = String(ci.id || ci._id || '').trim().toLowerCase();
            const thisFieldId = String(field.id || field._id || '').trim().toLowerCase();

            const isNotCurrentField = !editMode || (thisFieldId !== currentFieldId && currentFieldId !== '');

            return isSameFarm && isNotCurrentField;
          });

          const occupied = farmFields.reduce((sum, f) => {
            const sizeStr = f.field_size || f.fieldSize || f.area_m2 || '0';
            const size = parseFloat(sizeStr) || 0;
            return sum + size;
          }, 0);

          setSelectedFarmArea({
            total: totalArea,
            occupied: occupied,
            remaining: Math.max(0, totalArea - occupied),
            unit: farmUnit
          });

          setFormData(prev => {
            const updates = {};
            
            // Auto-fill fieldSizeUnit from farm (only in create mode)
            if (!editMode && prev.fieldSizeUnit !== farmUnit) {
              updates.fieldSizeUnit = farmUnit;
            }
            
            // Auto-fill harvest dates from farm (only in create mode, if empty)
            if (!editMode && (!prev.harvestDates || prev.harvestDates.length === 0 || !prev.harvestDates[0]?.date)) {
              const farmHarvestDates = [];
              // Handle array format
              if (farm.harvest_dates && Array.isArray(farm.harvest_dates) && farm.harvest_dates.length > 0) {
                farm.harvest_dates.forEach(h => {
                  if (h.date) {
                    farmHarvestDates.push({ date: h.date, label: h.label || '' });
                  }
                });
              }
              // Handle single date format (harvest_date)
              if (farm.harvest_date && farmHarvestDates.length === 0) {
                farmHarvestDates.push({ date: farm.harvest_date, label: '' });
              }
              if (farmHarvestDates.length > 0) {
                const futureHarvests = farmHarvestDates.filter((h) => {
                  const ymd = formatDateForInput(h.date);
                  return ymd && !isYmdBeforeLocalToday(ymd);
                });
                if (futureHarvests.length > 0) {
                  updates.harvestDates = futureHarvests;
                }
              }
            }
            
            // Auto-fill webcam from farm (only in create mode, if empty)
            if (!editMode && !prev.webcamUrl && farm.webcam_url) {
              updates.hasWebcam = true;
              updates.webcamUrl = farm.webcam_url || '';
            }
            
            // Auto-fill coordinates from farm (only in create mode, if empty)
            if (!editMode && !prev.latitude && !prev.longitude) {
              // Handle object format {lat, lng}
              if (farm.coordinates && typeof farm.coordinates === 'object' && !Array.isArray(farm.coordinates)) {
                if (farm.coordinates.lat != null && farm.coordinates.lng != null) {
                  updates.latitude = farm.coordinates.lat;
                  updates.longitude = farm.coordinates.lng;
                }
              }
              // Handle array format [lng, lat]
              else if (farm.coordinates && Array.isArray(farm.coordinates) && farm.coordinates.length >= 2) {
                updates.latitude = farm.coordinates[1];
                updates.longitude = farm.coordinates[0];
              }
              // Handle separate lat/lng fields
              else if (farm.latitude != null && farm.longitude != null) {
                updates.latitude = farm.latitude;
                updates.longitude = farm.longitude;
              }
            }
            
            // Auto-fill shipping scope from farm (only in create mode, if empty)
            if (!editMode && !prev.shippingScope && farm.shipping_scope) {
              updates.shippingScope = farm.shipping_scope;
            }
            
            // Auto-fill shipping option from farm (only in create mode, if empty)
            if (!editMode && !prev.shippingOption && farm.shipping_option) {
              updates.shippingOption = farm.shipping_option;
            }
            
            return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
          });

          // Auto-fill location address from farm (only in create mode, if empty)
          if (!editMode && !locationAddress && farm.location) {
            setLocationAddress(farm.location);
          }
        }
      } else {
        setSelectedFarmArea({ total: 0, occupied: 0, remaining: 0, unit: 'sqm' });
      }
    };

    calculateArea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.farmId, farmsList, fieldsList, editMode]);

  // State for license check and upload
  const [checkingLicense, setCheckingLicense] = useState(true);
  const [hasLicense, setHasLicense] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [licenseFile, setLicenseFile] = useState(null);

  useEffect(() => {
    // Only verify if open
    if (open) {
      checkLicenseStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when user or open changes
  }, [user, open]);

  const checkLicenseStatus = async () => {
    if (!user || !user.id || !open) return;

    // Determine status - aligned with AdminUsers logic
    // We check locally first, then API response data
    const status = user.approval_status || (user.is_active ? 'approved' : 'pending');

    // Only check documents if pending
    if (status === 'pending') {
      try {
        setCheckingLicense(true);
        // We can just rely on user.uploaded_documents if available from the new API
        // But for safety, let's fetch or check existing prop if passed
        if (user.uploaded_documents && user.uploaded_documents.length > 0) {
          setHasLicense(true);
          setCheckingLicense(false);
          return;
        }

        const response = await userDocumentsService.getUserDocuments(user.id);
        const docs = response.data || [];
        setHasLicense(docs.length > 0);
      } catch (error) {
        console.error('Error checking documents:', error);
        setHasLicense(false);
      } finally {
        setCheckingLicense(false);
      }
    } else {
      setCheckingLicense(false);
    }
  };

  const handleLicenseFileChange = (e) => {
    if (e.target.files[0]) {
      setLicenseFile(e.target.files[0]);
    }
  };

  const handleLicenseUpload = async () => {
    if (!licenseFile || !user) return;

    try {
      setUploadingLicense(true);
      const file = licenseFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}-${file.name}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-documents')
        .getPublicUrl(filePath);

      await userDocumentsService.addDocument({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileExt
      });

      setHasLicense(true);
      setLicenseFile(null);
      // alert('License uploaded successfully! Please wait for admin approval.');
    } catch (error) {
      console.error('Error uploading license:', error);
      alert('Failed to upload license. Please try again.');
    } finally {
      setUploadingLicense(false);
    }
  };

  const handleErrorDirectToFarms = () => {
    onClose();
    navigate('/farmer/my-farms?action=add-farm');
  };

  // Helper function to get farm icon component
  const getFarmIcon = (farmIconValue) => {
    const iconData = farmIcons.find(icon => icon.value === farmIconValue);
    // Return default agriculture icon if no icon is found or farmIconValue is null/undefined
    return iconData ? iconData.icon : <Agriculture sx={{ color: '#8bc34a' }} />;
  };



  // Show all available categories (FIELD_CATEGORY_DATA imported as categoryData)
  const availableCategories = Object.keys(categoryData);
  const categories = ['Select Category', ...availableCategories];

  // State for location address display
  const [locationAddress, setLocationAddress] = useState('');

  // Hydrate edit/create form when dialog opens or edited field id changes — not on every parent re-render
  // (parent `fields` refreshes used to replace initialData by reference and wipe in-progress edits).
  useEffect(() => {
    if (!open) return;
    if (initialData && editMode) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        selectedIcon: initialData.icon ? initialData.icon.split('/').pop() : (initialData.image ? initialData.image.split('/').pop() : ''),
      }));
      setFormData(prev => ({
        ...prev,
        productName: initialData.name || '',
        description: initialData.description || '',
        shortDescription: initialData.short_description || initialData.shortDescription || '',
        galleryImages: Array.isArray(initialData.gallery_images) ? [...initialData.gallery_images] : (Array.isArray(initialData.galleryImages) ? [...initialData.galleryImages] : []),
        // Ensure category matches a parent category, if not use subcategory logic or fallback
        category: initialData.category || '',
        subcategory: initialData.subcategory || '',
        fieldSize: initialData.field_size || initialData.fieldSize || initialData.area_m2 || '',
        fieldSizeUnit: normalizeAreaUnit(initialData.field_size_unit || initialData.fieldSizeUnit || initialData.unit || 'sqm'),
        productionRate: initialData.production_rate || initialData.productionRate || '',
        productionRateUnit: initialData.production_rate_unit || initialData.productionRateUnit || 'Kg',
        sellingAmount: initialData.quantity || '',
        sellingPrice: initialData.price || '',
        totalProduction: initialData.total_production || initialData.totalProduction || '',
        distributionPrice: initialData.distribution_price || initialData.distributionPrice || '',
        farmId: initialData.farm_id || initialData.farmId || '',
        latitude: initialData.coordinates?.[1] || initialData.latitude || '',
        longitude: initialData.coordinates?.[0] || initialData.longitude || '',
        hasWebcam: initialData.has_webcam || !!initialData.webcam_url,
        webcamUrl: initialData.webcam_url || initialData.webcamUrl || '',
        harvestDates: Array.isArray(initialData.harvest_dates) ? initialData.harvest_dates :
          Array.isArray(initialData.harvestDates) ? initialData.harvestDates :
            [{ date: '', label: '' }],
        shippingOption: initialData.shipping_option || 'Standard Delivery',
        deliveryCharges: Array.isArray(initialData.delivery_charges) ? initialData.delivery_charges :
          Array.isArray(initialData.deliveryCharges) ? initialData.deliveryCharges :
            [{ upto: '', amount: '' }],
        deliveryTime: formatDateForInput(
          initialData.estimated_delivery_date ??
            initialData.estimatedDeliveryDate ??
            initialData.deliveryTime ??
            initialData.delivery_time
        ) || '',
        shippingScope: initialData.shipping_scope || 'Global',
        price_per_m2: initialData.price_per_m2 || initialData.pricePerM2 || 0,
        available_for_buy: initialData.available_for_buy ?? true,
        available_for_rent: Boolean(initialData.available_for_rent),
        rent_price_per_month: initialData.rent_price_per_month ?? '',
        rent_duration_monthly: Boolean(initialData.rent_duration_monthly),
        rent_duration_quarterly: Boolean(initialData.rent_duration_quarterly),
        rent_duration_yearly: Boolean(initialData.rent_duration_yearly),
        totalProductionUnit: normalizeTotalProductionUnit(
          initialData.total_production_unit || initialData.totalProductionUnit
        ),
      }));

      // Special fix for the "Watermelon" in category warning:
      // If the incoming category doesn't match a main category but is a valid subcategory,
      // we need to set the parent category correctly.
      const categoriesLookup = {
        'Fruits': ['All Fruits', 'Apple', 'Banana', 'Berries', 'Citrus', 'Grapes', 'Mango', 'Melon', 'Peach', 'Pear', 'Stone Fruit', 'Tropical Fruit', 'Watermelon', 'Green Apple', 'Red Apple', 'Strawberry', 'Tangerine', 'Avocados'],
        'Vegetables': ['All Vegetables', 'Beans', 'Cabbage', 'Carrot', 'Corn', 'Cucumber', 'Leafy Greens', 'Onion', 'Potato', 'Tomato', 'Root Vegetables', 'Eggplant', 'Lemon', 'Broccoli', 'Capsicum', 'Onions', 'Potatoes', 'Salad Greens'],
      };

      setFormData(prev => {
        let correctedCategory = prev.category;
        let correctedSubcategory = prev.subcategory;

        // If category is actually a subcategory (like "Watermelon"), fix it
        for (const [parent, children] of Object.entries(categoriesLookup)) {
          if (children.includes(prev.category)) {
            correctedCategory = parent;
            correctedSubcategory = prev.category;
            break;
          }
        }

        if (correctedCategory !== prev.category || correctedSubcategory !== prev.subcategory) {
          return {
            ...prev,
            category: correctedCategory,
            subcategory: correctedSubcategory
          };
        }
        return prev;
      });
      // Set location address if coordinates exist
      if (initialData.latitude && initialData.longitude) {
        setLocationAddress(initialData.location || `${initialData.latitude}, ${initialData.longitude}`);
      }
    } else if (!editMode) {
      setFormData({
        selectedIcon: '',
        category: '',
        productName: '',
        description: '',
        fieldSize: '',
        fieldSizeUnit: 'sqm',
        totalProduction: '',
        totalProductionUnit: 'kg',
        productionRate: '',
        productionRateUnit: 'Kg',
        sellingAmount: '',
        sellingPrice: '',
        retailPrice: '',
        virtualProductionRate: '',
        virtualCostPerUnit: '',
        appFees: '',
        userAreaVirtualRentPrice: '',
        harvestDates: [{ date: '', label: '' }],
        shippingOption: 'Both',
        deliveryTime: '',
        deliveryCharges: [{ upto: '', amount: '' }],
        hasWebcam: false,
        webcamUrl: '',
        latitude: '',
        longitude: '',
        shippingScope: '',
        farmId: ''
      });
      // Reset location address for new forms
      setLocationAddress('');
    }
    /* Intentionally omit full `initialData` from deps: parent often passes a new object reference when
     * `fields` refreshes, which would re-run this effect and wipe in-progress edits while the dialog stays open. */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-hydrate when open, editMode, or edited record id/_id changes
  }, [open, editMode, initialData?.id, initialData?._id]);

  // Quick apply recommended delivery rates
  const applyRecommendedRates = () => {
    if (editMode && lockCommercial) return;
    setFormData(prev => ({
      ...prev,
      deliveryCharges: [
        { upto: '12', amount: '15.00' },
        { upto: '36', amount: '25.00' },
        { upto: '1000', amount: '35.00' }
      ]
    }));
  };

  const handleInputChange = (field, value) => {
    if (editMode && lockCommercial && !ALLOWED_FIELD_EDITS_WHEN_COMMERCIAL_LOCKED.has(field)) return;
    let processedValue = value;
    if (NON_NEGATIVE_NUMERIC_FIELDS.has(field)) {
      processedValue = clampNonNegativeNumericInput(processedValue);
    }

    // Preventive validation for field size - cap at available remaining area
    if (field === 'fieldSize' && formData.farmId) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > selectedFarmArea.remaining) {
        processedValue = selectedFarmArea.remaining.toString();
      }
    }

    if (field === 'deliveryTime' && processedValue) {
      const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(processedValue).trim())
        ? String(processedValue).trim()
        : formatDateForInput(processedValue);
      if (ymd && isYmdBeforeLocalToday(ymd)) {
        setErrors(prev => ({
          ...prev,
          deliveryTime: `Date cannot be in the past (minimum ${minSelectableDate})`
        }));
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }));

    // When category changes, reset subcategory safely
    if (field === 'category') {
      setFormData(prev => ({
        ...prev,
        subcategory: ''  // Reset to empty string, not undefined
      }));
    }

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle harvest date changes
  const handleHarvestDateChange = (index, field, value) => {
    if (editMode && lockCommercial) return;
    if (field === 'date' && value && isYmdBeforeLocalToday(value)) {
      setErrors(prev => ({
        ...prev,
        harvestDates: `Date cannot be in the past (minimum ${minSelectableDate})`
      }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      harvestDates: (prev.harvestDates || []).map((date, i) =>
        i === index ? { ...date, [field]: value } : date
      )
    }));

    if (errors.harvestDates) {
      setErrors(prev => ({
        ...prev,
        harvestDates: ''
      }));
    }
  };

  // Add new harvest date
  const addHarvestDate = () => {
    if (editMode && lockCommercial) return;
    setFormData(prev => ({
      ...prev,
      harvestDates: [...(prev.harvestDates || []), { date: '', label: '' }]
    }));
  };

  // Remove harvest date
  const removeHarvestDate = (index) => {
    if (editMode && lockCommercial) return;
    const currentHarvestDates = formData.harvestDates || [];
    if (currentHarvestDates.length > 1) {
      setFormData(prev => ({
        ...prev,
        harvestDates: (prev.harvestDates || []).filter((_, i) => i !== index)
      }));
    }
  };

  /** Preview: Supabase URL from admin, or grey placeholder until you upload that subcategory. */
  const subcategoryProductImageSrc = formData.subcategory
    ? getProductIcon(formData.subcategory)
    : '';
  const subcategoryImageForApi = formData.subcategory
    ? getProductImageUrlForStorage(formData.subcategory)
    : '';

  const addDeliveryCharge = () => {
    if (editMode && lockCommercial) return;
    setFormData(prev => ({
      ...prev,
      deliveryCharges: [...(prev.deliveryCharges || []), { upto: '', amount: '' }]
    }));
  };

  const removeDeliveryCharge = (index) => {
    if (editMode && lockCommercial) return;
    setFormData(prev => ({
      ...prev,
      deliveryCharges: (prev.deliveryCharges || []).filter((_, i) => i !== index)
    }));
  };

  const updateDeliveryCharge = (index, field, value) => {
    if (editMode && lockCommercial) return;
    setFormData(prev => {
      const updatedCharges = (prev.deliveryCharges || []).map((charge, i) => {
        if (i === index) {
          const rawVal = field === 'upto' || field === 'amount' ? clampNonNegativeNumericInput(value) : value;
          const newCharge = { ...charge, [field]: rawVal };
          // Auto-fill amount based on upto value
          if (field === 'upto') {
            const num = parseFloat(rawVal);
            if (!isNaN(num)) {
              if (num <= 12) newCharge.amount = '15.00';
              else if (num <= 36) newCharge.amount = '25.00';
              else if (num >= 37) newCharge.amount = '35.00'; // Recommended base
            }
          }
          return newCharge;
        }
        return charge;
      });
      return { ...prev, deliveryCharges: updatedCharges };
    });
  };

  // Handle location selection from LocationPicker
  const handleLocationSelect = (locationData) => {
    if (editMode && lockCommercial) return;
    // LocationPicker returns { coordinates: [lng, lat], address: string }
    const [lng, lat] = locationData.coordinates;
    setFormData(prev => ({
      ...prev,
      latitude: lat?.toString() || '',
      longitude: lng?.toString() || ''
    }));
    // Store the address for display in the location field
    setLocationAddress(locationData.address || `${lat}, ${lng}`);
    setLocationPickerOpen(false);
  };

  const validateForm = () => {
    const newErrors = {};

    if (lockCommercial) {
      if (!formData.productName.trim()) newErrors.productName = 'Product name is required';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (!formData.productName.trim()) newErrors.productName = 'Product name is required';
    if (!formData.category || formData.category === 'Select Category') newErrors.category = 'Category is required';
    if (!formData.subcategory || formData.subcategory === 'Select Sub Category') newErrors.subcategory = 'Sub category is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.fieldSize) {
      newErrors.fieldSize = 'Field size is required';
    } else if (parseFloat(formData.fieldSize) <= 0) {
      newErrors.fieldSize = 'Field size must be a positive number';
    } else if (parseFloat(formData.fieldSize) > selectedFarmArea.remaining) {
      newErrors.fieldSize = `Not enough area left in farm (${selectedFarmArea.remaining.toFixed(2)} ${selectedFarmArea.unit} available)`;
    }

    if (!formData.totalProduction) newErrors.totalProduction = 'Total production is required';
    else if (parseFloat(formData.totalProduction) <= 0) newErrors.totalProduction = 'Total production must be greater than zero';
    if (!formData.distributionPrice) newErrors.distributionPrice = 'Distribution price is required';
    else if (parseFloat(formData.distributionPrice) < 0) newErrors.distributionPrice = 'Cannot be negative';
    if (!formData.sellingAmount) newErrors.sellingAmount = 'How much product to sell is required';
    else if (parseFloat(formData.sellingAmount) <= 0) newErrors.sellingAmount = 'Selling quantity must be greater than zero';
    if (!formData.sellingPrice) newErrors.sellingPrice = 'Your sharecrop price is required';
    else if (parseFloat(formData.sellingPrice) < 0) newErrors.sellingPrice = 'Cannot be negative';
    if (!formData.retailPrice) newErrors.retailPrice = 'Retail price is required';
    else if (parseFloat(formData.retailPrice) < 0) newErrors.retailPrice = 'Cannot be negative';

    // Validate harvest dates
    const harvestDatesArray = formData.harvestDates || [];
    const hasValidHarvestDate = harvestDatesArray.some(date => date.date && date.date.trim() !== '');
    if (!hasValidHarvestDate) newErrors.harvestDates = 'At least one harvest date is required';
    else {
      const todayYmd = getTodayYmdLocal();
      for (let i = 0; i < harvestDatesArray.length; i += 1) {
        const raw = harvestDatesArray[i]?.date;
        if (!raw || !String(raw).trim()) continue;
        const ymd = formatDateForInput(raw);
        if (!ymd) {
          newErrors.harvestDates = `Harvest date ${i + 1} is not valid`;
          break;
        }
        if (isYmdBeforeLocalToday(ymd)) {
          newErrors.harvestDates = `Harvest date ${i + 1} cannot be in the past (use today (${todayYmd}) or a future date)`;
          break;
        }
      }
    }

    if (formData.deliveryTime && String(formData.deliveryTime).trim() !== '') {
      const dYmd = formatDateForInput(formData.deliveryTime);
      if (!dYmd) {
        newErrors.deliveryTime = 'Estimated delivery date is not valid';
      } else if (isYmdBeforeLocalToday(dYmd)) {
        newErrors.deliveryTime = `Delivery date cannot be in the past (use today (${getTodayYmdLocal()}) or a future date)`;
      }
    }

    if (formData.hasWebcam && (!formData.webcamUrl || !formData.webcamUrl.trim())) {
      newErrors.webcamUrl = 'Webcam URL is required when webcam is enabled';
    }
    if (!formData.latitude) newErrors.latitude = 'Latitude is required';
    if (!formData.longitude) newErrors.longitude = 'Longitude is required';
    if (!formData.farmId) newErrors.farmId = 'Please select a farm for this field';
    if (formData.available_for_rent) {
      if (!formData.rent_price_per_month || String(formData.rent_price_per_month).trim() === '' || isNaN(parseFloat(formData.rent_price_per_month))) {
        newErrors.rent_price_per_month = 'Rent price per month is required when available for rent';
      } else if (parseFloat(formData.rent_price_per_month) < 0) {
        newErrors.rent_price_per_month = 'Rent price cannot be negative';
      }
      if (!formData.rent_duration_monthly && !formData.rent_duration_quarterly && !formData.rent_duration_yearly) {
        newErrors.rent_duration = 'Select at least one rent duration (Monthly, Quarterly, or Yearly)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    if (lockCommercial) {
      const submitData = {
        restrictedFieldUpdate: true,
        productName: formData.productName,
        name: formData.productName,
        description: formData.description,
        short_description: formData.shortDescription || '',
        shortDescription: formData.shortDescription || '',
        gallery_image_urls: (formData.galleryImages || []).filter(Boolean).slice(0, 5),
        galleryImages: (formData.galleryImages || []).filter(Boolean).slice(0, 5),
      };
      setTimeout(() => {
        onSubmit(submitData);
        setIsSubmitting(false);
        handleClose();
      }, 400);
      return;
    }

    // Get actual location using reverse geocoding, or use pre-filled location from farm
    let actualLocation = locationAddress || 'Unknown Location';
    try {
      if (formData.latitude && formData.longitude) {
        const { cachedReverseGeocode } = await import('../../utils/geocoding');
        actualLocation = await cachedReverseGeocode(
          parseFloat(formData.latitude),
          parseFloat(formData.longitude)
        );
      }
    } catch (error) {
      console.error('Failed to get location:', error);
      // Fallback to coordinates if reverse geocoding fails and no pre-filled location
      if (actualLocation === 'Unknown Location' && formData.latitude && formData.longitude) {
        actualLocation = `${parseFloat(formData.latitude).toFixed(4)}, ${parseFloat(formData.longitude).toFixed(4)}`;
      }
    }

    // Convert deliveryCharges array to JSON array for database storage
    const getDeliveryChargeValue = (deliveryCharges) => {
      if (!deliveryCharges || !Array.isArray(deliveryCharges) || deliveryCharges.length === 0) {
        return null;
      }
      // Filter out empty charges and format properly
      const validCharges = deliveryCharges
        .filter(c => c && c.amount && c.amount.trim() !== '')
        .map(c => ({
          upto: c.upto ? parseFloat(c.upto) : null,
          amount: parseFloat(c.amount) || 0
        }));
      return validCharges.length > 0 ? JSON.stringify(validCharges) : null;
    };

    const submitData = {
      productName: formData.productName,
      name: formData.productName, // Snake case for backend
      category: formData.category,
      subcategory: formData.subcategory,
      description: formData.description,
      short_description: formData.shortDescription || '',
      shortDescription: formData.shortDescription || '',
      gallery_image_urls: (formData.galleryImages || []).filter(Boolean).slice(0, 5),
      galleryImages: (formData.galleryImages || []).filter(Boolean).slice(0, 5),
      price: parseFloat(formData.sellingPrice),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      image: subcategoryImageForApi,
      icon: subcategoryImageForApi,
      fieldSize: formData.fieldSize,
      field_size: formData.fieldSize, // Snake case
      fieldSizeUnit: formData.fieldSizeUnit,
      field_size_unit: formData.fieldSizeUnit, // Snake case
      productionRate: formData.productionPerArea,
      production_rate: formData.productionPerArea, // Calculated production per area
      productionRateUnit: perAreaUnitSuffix(formData.totalProductionUnit),
      production_rate_unit: perAreaUnitSuffix(formData.totalProductionUnit),
      totalProduction: formData.totalProduction,
      total_production: formData.totalProduction,
      totalProductionUnit: normalizeTotalProductionUnit(formData.totalProductionUnit),
      total_production_unit: normalizeTotalProductionUnit(formData.totalProductionUnit),
      distributionPrice: formData.distributionPrice,
      distribution_price: formData.distributionPrice,
      sellingAmount: formData.sellingAmount,
      quantity: formData.sellingAmount, // Map to quantity
      retailPrice: parseFloat(formData.retailPrice),
      virtualProductionRate: formData.productionPerArea,
      virtualCostPerUnit: formData.virtualCostPerUnit,
      appFees: formData.appFees,
      potentialIncome: formData.potentialIncome,
      userVirtualRent: formData.userAreaVirtualRentPrice,
      harvestDates: (formData.harvestDates || []).filter(date => date.date && date.date.trim() !== ''),
      harvest_dates: (formData.harvestDates || []).filter(date => date.date && date.date.trim() !== ''), // Snake case
      shippingOption: formData.shippingOption,
      shipping_option: formData.shippingOption, // Snake case
      deliveryTime: formData.deliveryTime,
      deliveryCharges: getDeliveryChargeValue(formData.deliveryCharges), // Convert to numeric value
      delivery_charges: getDeliveryChargeValue(formData.deliveryCharges), // Snake case
      hasWebcam: formData.hasWebcam,
      has_webcam: formData.hasWebcam, // Snake case
      webcam_url: formData.hasWebcam ? formData.webcamUrl : '',
      webcamUrl: formData.hasWebcam ? formData.webcamUrl : '',
      shippingScope: formData.shippingScope,
      shipping_scope: formData.shippingScope, // Snake case
      farmId: formData.farmId,
      farm_id: formData.farmId, // Snake case
      // Add these default values for popup compatibility:
      coordinates: [parseFloat(formData.longitude), parseFloat(formData.latitude)],
      farmer_name: user?.name || '',
      location: actualLocation,
      available_area: formData.fieldSize || 100,
      total_area: formData.fieldSize || 100,
      weather: 'Sunny', // Default weather
      price_per_m2: parseFloat(formData.userAreaVirtualRentPrice) || 0,
      shipping_pickup: formData.shippingOption !== 'Shipping',
      shipping_delivery: formData.shippingOption !== 'Pickup',
      harvest_date: (formData.harvestDates || []).length > 0 && formData.harvestDates[0].date ? formData.harvestDates[0].date : '15 Sep, 2025',
      isOwnField: true, // Mark as your own field for edit button
      is_own_field: true, // Snake case
      available_for_buy: true,
      available_for_rent: Boolean(formData.available_for_rent),
      rent_price_per_month: formData.available_for_rent && formData.rent_price_per_month ? parseFloat(formData.rent_price_per_month) : null,
      rent_duration_monthly: Boolean(formData.rent_duration_monthly),
      rent_duration_quarterly: Boolean(formData.rent_duration_quarterly),
      rent_duration_yearly: Boolean(formData.rent_duration_yearly)
    };

    setTimeout(() => {
      onSubmit(submitData);
      setIsSubmitting(false);
      handleClose();
    }, 1000);
  };


  const handleClose = () => {
    setFormData({
      selectedIcon: '',
      category: '',
      subcategory: '',
      productName: '',
      description: '',
      shortDescription: '',
      galleryImages: [],
      totalProduction: '',
      fieldSize: '',
      fieldSizeUnit: 'sqm',
      productionPerArea: '',
      distributionPrice: '',
      retailPrice: '',
      suggestedPrice: '',
      sellingPrice: '',
      sellingAmount: '',
      potentialIncome: '',
      virtualProductionRate: '',
      virtualCostPerUnit: '',
      appFees: '',
      userAreaVirtualRentPrice: '',
      harvestDates: [{ date: '', label: '' }],
      shippingOption: 'Both',
      deliveryTime: '',
      deliveryTimeUnit: 'Days',
      deliveryCharges: [{ upto: '', amount: '' }],
      hasWebcam: false,
      webcamUrl: '',
      latitude: '',
      longitude: '',
      shippingScope: 'Global',
      farmId: '',
      available_for_buy: true,
      available_for_rent: false,
      rent_price_per_month: '',
      rent_duration_monthly: false,
      rent_duration_quarterly: false,
      rent_duration_yearly: false,
      totalProductionUnit: 'kg',
    });
    setErrors({});
    setIsSubmitting(false);
    onClose();
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleClose}
      maxWidth={isMobile ? false : "md"}
      fullWidth={!isMobile}
      isMobile={isMobile}
    >
      <StyledDialogTitle isMobile={isMobile}>
        {editMode ? (lockCommercial ? 'Edit listing (limited)' : 'Edit Field') : 'Create New Field'}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: isMobile ? 8 : 16,
            top: isMobile ? 8 : 16,
            color: 'white',
            '& .MuiSvgIcon-root': {
              fontSize: isMobile ? '18px' : '20px'
            }
          }}
        >
          <Close />
        </IconButton>
      </StyledDialogTitle>

      <StyledDialogContent isMobile={isMobile}>
        {/* Conditional Rendering Logic */}
        {(() => {
          const status = user?.approval_status || (user?.is_active ? 'approved' : 'pending');

          if (checkingLicense) {
            return (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="textSecondary">Checking eligibility...</Typography>
              </Box>
            );
          }

          if (status === 'pending' && !hasLicense) {
            return (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h4" sx={{ mb: 2, fontSize: '3rem' }}>⚠️</Typography>
                <Typography variant="h6" gutterBottom>Action Required</Typography>
                <Typography variant="body1" color="textSecondary" paragraph>
                  Please upload your farming license to be eligible for adding fields.
                </Typography>
                <Box sx={{ my: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    component="label"
                    sx={{ mb: 2 }}
                  >
                    Choose License File
                    <input
                      type="file"
                      hidden
                      onChange={handleLicenseFileChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                  </Button>
                  {licenseFile && (
                    <Typography variant="body2" color="primary" sx={{ mb: 2 }}>
                      Selected: {licenseFile.name}
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!licenseFile || uploadingLicense}
                    onClick={handleLicenseUpload}
                  >
                    {uploadingLicense ? 'Uploading...' : 'Upload License'}
                  </Button>
                </Box>
              </Box>
            );
          }

          if (status === 'pending' && hasLicense) {
            return (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h4" sx={{ mb: 2, fontSize: '3rem' }}>ℹ️</Typography>
                <Typography variant="h6" gutterBottom>Verification Pending</Typography>
                <Typography variant="body1" color="textSecondary" paragraph>
                  Please wait for the approval from admin.
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Your license has been uploaded and is under review.
                </Typography>
              </Box>
            );
          }

          if (status === 'approved' && (!farmsList || farmsList.length === 0)) {
            return (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h4" sx={{ mb: 2, fontSize: '3rem' }}>🏠</Typography>
                <Typography variant="h6" gutterBottom>No Farms Found</Typography>
                <Typography variant="body1" color="textSecondary" paragraph>
                  You need to create a farm before you can add any fields.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleErrorDirectToFarms}
                  sx={{ mt: 2 }}
                >
                  Create My First Farm
                </Button>
              </Box>
            );
          }

          // Render normal form if approved and has farms
          return (
            <Box sx={{ width: '100%' }}>
              {lockCommercial && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  <AlertTitle sx={{ fontWeight: 700 }}>Purchases in progress</AlertTitle>
                  Buyers are linked to this field’s price, area, harvest dates, and location — including any
                  <strong> pending </strong>
                  order. You can still update the product name, descriptions, and gallery. Other fields stay read-only until every order is completed or cancelled and there is no committed area.
                </Alert>
              )}
              {/* Basic Information Section */}
              <FormSection>
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem' }}>Basic Information</SectionTitle>
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: isMobile ? '16px' : '24px',
                  justifyContent: 'flex-start'
                }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: isMobile ? '16px' : '24px',
                      width: '100%',
                      alignItems: 'flex-start',
                      ...(lockCommercial ? { ...lockedCommercialWrapSx, mb: 2 } : {}),
                    }}
                  >
                    {lockCommercial ? (
                      <Typography
                        variant="caption"
                        sx={{
                          width: '100%',
                          mb: 0.5,
                          color: '#475569',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Farm &amp; crop type — read-only while orders are open
                      </Typography>
                    ) : null}
                  {/* Farm Selection Dropdown */}
                  <StyledFormControl error={!!errors.farmId} isMobile={isMobile}>
                    <InputLabel sx={{ fontWeight: 500 }}>Select Farm</InputLabel>
                    <Select
                      value={formData.farmId ?? ''}
                      onChange={(e) => handleInputChange('farmId', e.target.value)}
                      label="Select Farm"
                      disabled={lockCommercial}
                      displayEmpty
                      renderValue={(selected) => {
                        if (!selected) {
                          return <Typography sx={{ color: '#9ca3af', fontStyle: 'italic' }}></Typography>;
                        }
                        const selectedFarm = farmsList.find(farm => farm.id === selected);
                        if (!selectedFarm) return selected;
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getFarmIcon(selectedFarm.farmIcon)}
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {selectedFarm.farmName}
                            </Typography>
                          </Box>
                        );
                      }}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            borderRadius: '8px',
                            border: '1px solid #e8f5e8',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                            marginTop: '2px',
                            maxHeight: '200px',
                          },
                        },
                      }}
                    >
                      <MenuItem value="" disabled sx={{ fontStyle: 'italic', color: '#9ca3af' }}>
                        Choose a farm for this field
                      </MenuItem>
                      {farmsList.map((farm) => (
                        <MenuItem
                          key={farm.id}
                          value={farm.id}
                          sx={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            margin: '2px 4px',
                            transition: 'all 0.2s ease',
                            minHeight: 'auto',
                            '&:hover': { backgroundColor: '#f1f8e9', borderRadius: '6px' },
                            '&.Mui-selected': { backgroundColor: '#e8f5e8', '&:hover': { backgroundColor: '#e1f5e1' } },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
                            <Box sx={{ fontSize: '1rem' }}>{getFarmIcon(farm.farmIcon || 'agriculture')}</Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: '#2d3748', lineHeight: 1.2 }}>
                                {farm.farmName || 'Unnamed Farm'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#718096', fontSize: '0.75rem', lineHeight: 1.1 }}>
                                {formatLocationDisplay(farm.location || 'Location not set')}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.farmId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                        {errors.farmId}
                      </Typography>
                    )}
                    {formData.farmId && (
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: selectedFarmArea.remaining > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        Remaining Area: {selectedFarmArea.remaining.toFixed(2)} {selectedFarmArea.unit === 'sqm' ? 'm²' : selectedFarmArea.unit}
                      </Typography>
                    )}
                  </StyledFormControl>

                  {/* Category Dropdown */}
                  <StyledFormControl error={!!errors.category} isMobile={isMobile}>
                    <InputLabel sx={{ fontWeight: 500 }}>Select Category</InputLabel>
                    <Select
                      value={formData.category ?? ''}
                      onChange={(e) => {
                        const selectedCategory = e.target.value;
                        handleInputChange('category', selectedCategory);
                        if (selectedCategory === 'Select Category' || selectedCategory === '') {
                          handleInputChange('subcategory', '');
                        } else {
                          handleInputChange('subcategory', '');
                        }
                      }}
                      label="Select Category"
                      disabled={lockCommercial}
                    >
                      {categories && Array.isArray(categories) && categories
                        .filter(category => category != null)
                        .map((category) => (
                          <MenuItem key={category} value={category} disabled={category === 'Select Category'}>
                            {category || 'Unknown Category'}
                          </MenuItem>
                        ))}
                    </Select>
                  </StyledFormControl>

                  {/* Sub Category Dropdown */}
                  <StyledFormControl
                    error={!!errors.subcategory}
                    disabled={lockCommercial || !formData.category || formData.category === 'Select Category'}
                    isMobile={isMobile}
                  >
                    <InputLabel sx={{ fontWeight: 500 }}>Select Sub Category</InputLabel>
                    <Select
                      value={formData.subcategory || ''}
                      onChange={(e) => {
                        handleInputChange('subcategory', e.target.value);
                        handleInputChange('selectedIcon', '');
                      }}
                      label="Select Sub Category"
                    >
                      <MenuItem value="" disabled>
                        <Typography sx={{ color: '#9e9e9e', fontSize: '0.875rem' }}>Select Sub Category</Typography>
                      </MenuItem>
                      {formData.category &&
                        formData.category !== 'Select Category' &&
                        categoryData[formData.category] &&
                        Array.isArray(categoryData[formData.category]) &&
                        categoryData[formData.category]
                          .filter(subcategory => subcategory != null && subcategory.trim() !== '')
                          .map((subcategory, index) => (
                            <MenuItem key={subcategory || `subcat-${index}`} value={subcategory}>
                              {subcategory || 'Unknown Subcategory'}
                            </MenuItem>
                          ))
                      }
                    </Select>
                  </StyledFormControl>
                  </Box>

                  {/* Product image (same resolver as map: admin overrides + public/icons) */}
                  <Box sx={{
                    width: isMobile ? '100%' : '320px',
                    minHeight: isMobile ? '56px' : '64px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {formData.subcategory ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            border: '2px solid #4CAF50',
                            borderRadius: 1.25,
                            p: 0.5,
                            bgcolor: 'rgba(76,175,80,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            component="img"
                            src={subcategoryProductImageSrc}
                            alt={formData.subcategory}
                            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </Box>
                       
                      </Box>
                    ) : (
                      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', color: 'text.secondary', fontStyle: 'italic', pl: 1 }}>
                        Select a subcategory to preview the product image
                      </Box>
                    )}
                  </Box>

                  {/* Product Name - Wider fixed width */}
                  <StyledTextField
                    label="Product Name"
                    placeholder="The Name of The Product"
                    value={formData.productName}
                    onChange={(e) => handleInputChange('productName', e.target.value)}
                    error={!!errors.productName}
                    helperText={errors.productName}
                    isMobile={isMobile}
                    sx={{ width: isMobile ? '100%' : '664px !important' }}
                  />

                  {/* Product Description - Wider fixed width */}
                  <StyledTextField
                    label="Description"
                    placeholder="The Description of The Product"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    error={!!errors.description}
                    helperText={errors.description}
                    isMobile={isMobile}
                    sx={{ width: isMobile ? '100%' : '664px !important' }}
                  />

                  <StyledTextField
                    label="Short description (map popup)"
                    placeholder="One or two lines for the map card"
                    value={formData.shortDescription}
                    onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                    isMobile={isMobile}
                    multiline
                    minRows={2}
                    sx={{ width: isMobile ? '100%' : '664px !important' }}
                  />

                  <Box sx={{ width: isMobile ? '100%' : '664px' }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                      Gallery images (max 5)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                      {(formData.galleryImages || []).map((url, idx) => (
                        <Box key={`${url}-${idx}`} sx={{ position: 'relative' }}>
                          <Box
                            component="img"
                            src={url}
                            alt=""
                            sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, border: '1px solid #e5e7eb' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (formData.galleryImages || []).filter((_, i) => i !== idx);
                              handleInputChange('galleryImages', next);
                            }}
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              border: 'none',
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: 12,
                              cursor: 'pointer',
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </Box>
                      ))}
                    </Box>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      disabled={galleryUploading || (formData.galleryImages || []).length >= 5}
                    >
                      {galleryUploading ? 'Uploading…' : 'Add photos'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const room = 5 - (formData.galleryImages || []).length;
                          if (room <= 0 || !files.length) return;
                          setGalleryUploading(true);
                          const uploaded = [];
                          try {
                            for (const file of files.slice(0, room)) {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${uuidv4()}-${file.name}`;
                              const filePath = `field-gallery/${fileName}`;
                              const { error: uploadError } = await supabase.storage
                                .from('user-documents')
                                .upload(filePath, file);
                              if (uploadError) throw uploadError;
                              const { data: { publicUrl } } = supabase.storage
                                .from('user-documents')
                                .getPublicUrl(filePath);
                              uploaded.push(publicUrl);
                            }
                            handleInputChange('galleryImages', [...(formData.galleryImages || []), ...uploaded]);
                          } catch (err) {
                            console.error(err);
                            alert('Failed to upload one or more images.');
                          } finally {
                            setGalleryUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </Button>
                  </Box>
                </Box>
              </FormSection>

              {/* Field Details Section */}
              <Box sx={lockCommercial ? lockedCommercialWrapSx : undefined}>
                <FormSection
                  sx={
                    lockCommercial
                      ? {
                          mb: 0,
                          bgcolor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          boxShadow: 'none',
                        }
                      : undefined
                  }
                >
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem', borderBottomColor: lockCommercial ? '#cbd5e1' : undefined }}>
                  Field Details
                </SectionTitle>
                  {lockCommercial ? (
                    <Typography variant="caption" sx={{ display: 'block', mb: 1.5, mt: -0.5, color: '#64748b', fontWeight: 600 }}>
                      Read-only while orders are open
                    </Typography>
                  ) : null}
                <Grid container spacing={isMobile ? 2 : 3}>
                  {/* Field Size with Unit */}
                  {/* Field Size with Unit */}
                  <Grid item xs={12} md={6}>
                    <CombinedInputContainer isMobile={isMobile}>
                      <StyledTextField
                        label="Field Size"
                        placeholder="How big is your field"
                        value={formData.fieldSize}
                        onChange={(e) => handleInputChange('fieldSize', e.target.value)}
                        error={!!errors.fieldSize}
                        helperText={errors.fieldSize || (formData.farmId ? `Max ${selectedFarmArea.remaining.toFixed(2)} ${selectedFarmArea.unit === 'sqm' ? 'm²' : selectedFarmArea.unit} available` : '')}
                        isMobile={isMobile}
                        type="number"
                        inputProps={{ min: 0, step: 'any' }}
                        disabled={lockCommercial}
                      />
                      <StyledFormControl isMobile={isMobile}>
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={formData.fieldSizeUnit}
                          onChange={(e) => handleInputChange('fieldSizeUnit', e.target.value)}
                          label="Unit"
                          disabled={lockCommercial || !!formData.farmId}
                        >
                          <MenuItem value="sqm">m²</MenuItem>
                          <MenuItem value="acres">acres</MenuItem>
                          <MenuItem value="hectares">hectares</MenuItem>
                        </Select>
                      </StyledFormControl>
                    </CombinedInputContainer>
                  </Grid>


                  {/* Location Selection - Single field */}
                  <Grid item xs={12}>
                    <StyledTextField
                      fullWidth
                      label="Select Location"
                      placeholder="Click the pin icon to select your field location"
                      value={locationAddress}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setLocationPickerOpen(true)}
                              disabled={lockCommercial}
                              sx={{
                                color: '#4CAF50',
                                padding: isMobile ? '6px' : '8px',
                                '& .MuiSvgIcon-root': {
                                  fontSize: isMobile ? '20px' : '20px'
                                },
                                '&:hover': {
                                  backgroundColor: 'rgba(76, 175, 80, 0.1)'
                                }
                              }}
                            >
                              <LocationOn />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      error={!!errors.latitude || !!errors.longitude}
                      helperText={errors.latitude || errors.longitude || "Select your field location using the map"}
                      sx={{
                        '& .MuiInputBase-input': {
                          cursor: 'pointer'
                        }
                      }}
                      onClick={() => { if (!lockCommercial) setLocationPickerOpen(true); }}
                      isMobile={isMobile}
                      disabled={lockCommercial}
                    />
                  </Grid>

                  {/* Harvest Dates */}
                  <Grid item xs={12}>
                    <Typography variant="body1" sx={{ mb: 2, fontWeight: 500, color: '#2d3748', fontSize: isMobile ? '14px' : '0.875rem' }} >
                      Estimated Harvest Dates
                    </Typography>
                    {(formData.harvestDates || []).map((harvestDate, index) => (
                      <Box key={index} sx={{
                        mb: 2,
                        p: isMobile ? 0 : 2,
                        border: isMobile ? 'none' : '1px solid #e2e8f0',
                        borderRadius: isMobile ? 0 : '8px'
                      }}>
                        {isMobile ? (
                          // Mobile Layout - Clean vertical stack without outer box
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {/* Date field - full width */}
                            <StyledTextField
                              fullWidth
                              type="date"
                              label="Date"
                              value={formatDateForInput(harvestDate?.date)}
                              onChange={(e) => handleHarvestDateChange(index, 'date', e.target.value)}
                              InputLabelProps={{ shrink: true }}
                              inputProps={{ min: minSelectableDate }}
                              isMobile={isMobile}
                              disabled={lockCommercial}
                            />

                            {/* Label field with icons positioned at bottom right */}
                            <Box sx={{ position: 'relative' }}>
                              <StyledTextField
                                fullWidth
                                label="Label (optional)"
                                placeholder="e.g., First harvest, Main crop"
                                value={harvestDate?.label ?? ''}
                                onChange={(e) => handleHarvestDateChange(index, 'label', e.target.value)}
                                isMobile={isMobile}
                                disabled={lockCommercial}
                              />

                              {/* Icons positioned at bottom right of label field */}
                              <Box sx={{
                                position: 'absolute',
                                top: 40,
                                right: 8,
                                display: 'flex',
                                gap: 0.5,
                                zIndex: 1
                              }}>
                                {index === (formData.harvestDates || []).length - 1 && (
                                  <IconButton
                                    onClick={addHarvestDate}
                                    size="small"
                                    disabled={lockCommercial}
                                    sx={{
                                      color: '#4caf50',
                                      backgroundColor: '#e8f5e8',
                                      '&:hover': { backgroundColor: '#c8e6c9' },
                                      width: 28,
                                      height: 28,
                                      minWidth: 28
                                    }}
                                  >
                                    <Add sx={{ fontSize: 16 }} />
                                  </IconButton>
                                )}
                                {(formData.harvestDates || []).length > 1 && (
                                  <IconButton
                                    onClick={() => removeHarvestDate(index)}
                                    size="small"
                                    disabled={lockCommercial}
                                    sx={{
                                      color: '#f44336',
                                      backgroundColor: '#ffebee',
                                      '&:hover': { backgroundColor: '#ffcdd2' },
                                      width: 28,
                                      height: 28,
                                      minWidth: 28
                                    }}
                                  >
                                    <Remove sx={{ fontSize: 16 }} />
                                  </IconButton>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        ) : (
                          // Desktop Layout - Horizontal
                          <Grid container spacing={2} alignItems="flex-end">
                            <Grid item xs={12} md={5}>
                              <StyledTextField
                                fullWidth
                                type="date"
                                label="Date"
                                value={formatDateForInput(harvestDate?.date)}
                                onChange={(e) => handleHarvestDateChange(index, 'date', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: minSelectableDate }}
                                isMobile={isMobile}
                                sx={{ width: '100%' }}
                                disabled={lockCommercial}
                              />
                            </Grid>
                            <Grid item xs={12} md={5}>
                              <StyledTextField
                                fullWidth
                                label="Label (optional)"
                                placeholder="e.g., First harvest, Main crop"
                                value={harvestDate?.label ?? ''}
                                onChange={(e) => handleHarvestDateChange(index, 'label', e.target.value)}
                                isMobile={isMobile}
                                sx={{ width: '100%' }}
                                disabled={lockCommercial}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                {index === (formData.harvestDates || []).length - 1 && (
                                  <IconButton
                                    onClick={addHarvestDate}
                                    disabled={lockCommercial}
                                    sx={{
                                      color: '#4caf50',
                                      backgroundColor: '#e8f5e8',
                                      '&:hover': { backgroundColor: '#c8e6c9' }
                                    }}
                                  >
                                    <Add />
                                  </IconButton>
                                )}
                                {(formData.harvestDates || []).length > 1 && (
                                  <IconButton
                                    onClick={() => removeHarvestDate(index)}
                                    disabled={lockCommercial}
                                    sx={{
                                      color: '#f44336',
                                      backgroundColor: '#ffebee',
                                      '&:hover': { backgroundColor: '#ffcdd2' }
                                    }}
                                  >
                                    <Remove />
                                  </IconButton>
                                )}
                              </Box>
                            </Grid>
                          </Grid>
                        )}
                      </Box>
                    ))}
                    {errors.harvestDates && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                        {errors.harvestDates}
                      </Typography>
                    )}
                  </Grid>

                  {/* Webcam Option */}
                  <Grid item xs={12}>
                    <Typography variant="body1" sx={{ mb: 2, fontWeight: 500, color: '#2d3748', fontSize: isMobile ? '14px' : '0.875rem' }}>
                      Do you have a Webcam on the field?
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.hasWebcam ? 'Yes' : 'No'}
                      onChange={(e) => handleInputChange('hasWebcam', e.target.value === 'Yes')}
                      disabled={lockCommercial}
                      sx={{
                        gap: isMobile ? 1.5 : 3,
                        justifyContent: 'center',
                        '& .MuiFormControlLabel-root': {
                          margin: 0,
                          padding: isMobile ? '8px 16px' : '12px 24px',
                          paddingLeft: '8px',
                          borderRadius: '12px',
                          border: '2px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          transition: 'all 0.2s ease',
                          minWidth: isMobile ? 'auto' : 'unset',
                          flex: isMobile ? '0 0 auto' : 'unset',
                          ...(!lockCommercial
                            ? {
                                '&:hover': {
                                  backgroundColor: '#e8f5e8',
                                  borderColor: '#4caf50'
                                },
                              }
                            : {
                                borderColor: '#cbd5e1',
                                backgroundColor: '#e8edf3',
                                '&:hover': {
                                  backgroundColor: '#e8edf3',
                                  borderColor: '#cbd5e1',
                                },
                              }),
                          '& .MuiTypography-root': {
                            fontSize: isMobile ? '14px' : '1rem'
                          }
                        }
                      }}
                    >
                      <FormControlLabel value="Yes" control={<Radio sx={{ color: '#4caf50' }} />} label="Yes" />
                      <FormControlLabel value="No" control={<Radio sx={{ color: '#4caf50' }} />} label="No" />
                    </RadioGroup>
                    {formData.hasWebcam && (
                      <Box sx={{ mt: 2 }}>
                        <StyledTextField
                          fullWidth
                          label="Webcam URL"
                          placeholder="Enter the stream URL for your webcam"
                          value={formData.webcamUrl || ''}
                          onChange={(e) => handleInputChange('webcamUrl', e.target.value)}
                          error={!!errors.webcamUrl}
                          helperText={errors.webcamUrl || "Provide a direct streaming URL (e.g., YouTube Live link)"}
                          isMobile={isMobile}
                          disabled={lockCommercial}
                        />
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </FormSection>
              </Box>

              {/* Pricing Information Section */}
              <Box sx={lockCommercial ? lockedCommercialWrapSx : undefined}>
                <FormSection
                  sx={
                    lockCommercial
                      ? {
                          mb: 0,
                          bgcolor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          boxShadow: 'none',
                        }
                      : undefined
                  }
                >
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem', borderBottomColor: lockCommercial ? '#cbd5e1' : undefined }}>
                  Pricing Information
                </SectionTitle>
                  {lockCommercial ? (
                    <Typography variant="caption" sx={{ display: 'block', mb: 1.5, mt: -0.5, color: '#64748b', fontWeight: 600 }}>
                      Read-only while orders are open
                    </Typography>
                  ) : null}
                <Grid container spacing={3}>
                  {/* Total production row: most grid width; amount field grows more than unit */}
                  <Grid item xs={12} md={9}>
                    <CombinedInputContainer
                      isMobile={isMobile}
                      sx={
                        isMobile
                          ? undefined
                          : {
                              '& .MuiTextField-root': {
                                flex: '1 1 0%',
                                minWidth: 300,
                              },
                              '& .MuiFormControl-root': {
                                flex: '0 0 118px',
                                width: '118px !important',
                                minWidth: '118px !important',
                                maxWidth: '118px !important',
                              },
                            }
                      }
                    >
                      <StyledTextField
                        fullWidth
                        label="Total production per harvest"
                        placeholder="e.g. 200"
                        type="number"
                        inputProps={{ min: 0, step: 'any' }}
                        value={formData.totalProduction}
                        onChange={(e) => handleInputChange('totalProduction', e.target.value)}
                        error={!!errors.totalProduction}
                        helperText={errors.totalProduction || 'Amount expected for one harvest'}
                        InputLabelProps={{
                          shrink: true,
                          sx: {
                            whiteSpace: 'normal',
                            lineHeight: 1.25,
                            '&.MuiInputLabel-shrink': { maxWidth: 'calc(100% + 8px)' },
                          },
                        }}
                        isMobile={isMobile}
                        disabled={lockCommercial}
                      />
                      <StyledFormControl isMobile={isMobile}>
                        <InputLabel id="total-prod-unit-label" shrink>
                          Unit
                        </InputLabel>
                        <Select
                          labelId="total-prod-unit-label"
                          label="Unit"
                          notched
                          value={normalizeTotalProductionUnit(formData.totalProductionUnit)}
                          onChange={(e) => handleInputChange('totalProductionUnit', e.target.value)}
                          disabled={lockCommercial}
                        >
                          <MenuItem value="kg">kg</MenuItem>
                          <MenuItem value="L">L (liters)</MenuItem>
                          <MenuItem value="lbs">lbs</MenuItem>
                          <MenuItem value="units">units</MenuItem>
                        </Select>
                      </StyledFormControl>
                    </CombinedInputContainer>
                  </Grid>

                  {/* Linked area — compact column */}
                  <Grid item xs={12} md={3}>
                    <StyledTextField
                      fullWidth
                      label="Linked Field Area"
                      value={`${formData.fieldSize} ${formData.fieldSizeUnit === 'sqm' ? 'm²' : formData.fieldSizeUnit}`}
                      isSuggested={true}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        readOnly: true,
                        endAdornment: <InputAdornment position="end">📍</InputAdornment>
                      }}
                      sx={{
                        opacity: 0.8,
                        '& .MuiInputLabel-root': { whiteSpace: 'normal', lineHeight: 1.25 },
                      }}
                      helperText="Size linked from Field Details section"
                      isMobile={isMobile}
                    />
                  </Grid>

                  {/* Production per Area */}
                  <Grid item xs={12} md={6}>
                    <Box>
                      <StyledTextField
                        fullWidth
                        label="Production per Area"
                        value={formData.productionPerArea}
                        isSuggested={true}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">{perAreaUnitSuffix(formData.totalProductionUnit)}</InputAdornment>
                          ),
                        }}
                        helperText="Calculated from total production and normalized field area"
                        isMobile={isMobile}
                      />
                      <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        ✨ Suggested by Sharecrop
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Distribution Price */}
                  <Grid item xs={12} md={6}>
                    <StyledTextField
                      fullWidth
                      label="Wholesale / Distribution Price"
                      placeholder="e.g. 4.00"
                      value={formData.distributionPrice}
                      onChange={(e) => handleInputChange('distributionPrice', e.target.value)}
                      error={!!errors.distributionPrice}
                      helperText={errors.distributionPrice}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">{usdPerProductionUnitSuffix(formData.totalProductionUnit)}</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: 'any' }}
                      type="number"
                      isMobile={isMobile}
                      disabled={lockCommercial}
                    />
                  </Grid>

                  {/* Retail Price */}
                  <Grid item xs={12} md={6}>
                    <StyledTextField
                      fullWidth
                      label="Retail Supermarket Price"
                      placeholder="e.g. 8.00"
                      value={formData.retailPrice}
                      onChange={(e) => handleInputChange('retailPrice', e.target.value)}
                      error={!!errors.retailPrice}
                      helperText={errors.retailPrice}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">{usdPerProductionUnitSuffix(formData.totalProductionUnit)}</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: 'any' }}
                      type="number"
                      isMobile={isMobile}
                      disabled={lockCommercial}
                    />
                  </Grid>

                  {/* Suggested Sharecrop Price */}
                  <Grid item xs={12} md={6}>
                    <Box>
                      <StyledTextField
                        fullWidth
                        label="Suggested Price on App"
                        value={formData.suggestedPrice}
                        isSuggested={true}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">{usdPerProductionUnitSuffix(formData.totalProductionUnit)}</InputAdornment>
                          ),
                        }}
                        helperText="Calculated: (Wholesale + Retail) / 2"
                        isMobile={isMobile}
                      />
                      <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        ✨ Suggested by Sharecrop
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Your Sharecrop Price */}
                  <Grid item xs={12} md={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <StyledTextField
                        fullWidth={isMobile}
                        label="Your App Selling Price"
                        placeholder="e.g. 7.00"
                        value={formData.sellingPrice}
                        onChange={(e) => handleInputChange('sellingPrice', e.target.value)}
                        error={!!errors.sellingPrice}
                        helperText={errors.sellingPrice}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">{usdPerProductionUnitSuffix(formData.totalProductionUnit)}</InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, step: 'any' }}
                        type="number"
                        isMobile={isMobile}
                        disabled={lockCommercial}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 'fit-content' }}>
                        <Typography variant="body2" sx={{ mx: 2, color: '#64748b', fontStyle: 'italic' }}>equal to:</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                          {formData.userAreaVirtualRentPrice} <span style={{ color: '#4caf50' }}>$ / m²</span>
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Virtual Cost (Distribution per m2) */}
                  <Grid item xs={12} md={6}>
                    <Box>
                      <StyledTextField
                        fullWidth
                        label="Total Virtual Cost"
                        placeholder="Virtual cost per unit"
                        value={formData.virtualCostPerUnit || ''}
                        isSuggested={true}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          readOnly: true,
                          endAdornment: <InputAdornment position="end">$/m²</InputAdornment>
                        }}
                        helperText="Calculated virtual cost (Wholesale Price * Production/Area)"
                        isMobile={isMobile}
                      />
                      <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        ✨ Suggested by Sharecrop
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Selling Amount */}
                  <Grid item xs={12} md={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', mt: 1 }}>
                      <StyledTextField
                        fullWidth={isMobile}
                        label="Selling Quantity in App"
                        placeholder="e.g. 10.00"
                        value={formData.sellingAmount}
                        onChange={(e) => handleInputChange('sellingAmount', e.target.value)}
                        error={!!errors.sellingAmount}
                        helperText={errors.sellingAmount}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">{productionUnitLabel(formData.totalProductionUnit)}</InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, step: 'any' }}
                        type="number"
                        isMobile={isMobile}
                        disabled={lockCommercial}
                      />
                      <Box sx={{ display: 'flex', minWidth: 'fit-content', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', ml: 2 }}>potential TOTAL APP income</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                            {formData.potentialIncome} <span style={{ color: '#4caf50' }}>$</span>
                          </Typography>
                          <Typography variant="body2" sx={{ mx: 2, color: '#64748b', fontStyle: 'italic' }}>equal to:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                            {formData.potentialIncome} <span style={{ color: '#64748b' }}>USD</span>
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>

                  {/* App Fees */}
                  <Grid item xs={12} md={6}>
                    <Box>
                      <StyledTextField
                        fullWidth
                        label="Sharecrop Platform Fees"
                        placeholder="Platform fees"
                        value={formData.appFees || ''}
                        isSuggested={true}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          readOnly: true,
                          endAdornment: <InputAdornment position="end">$</InputAdornment>
                        }}
                        helperText="Estimated platform service fees (5%)"
                        isMobile={isMobile}
                      />
                      <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        ✨ Calculated by Sharecrop
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </FormSection>
              </Box>

              {/* Shipping & Delivery Section */}
              <Box sx={lockCommercial ? lockedCommercialWrapSx : undefined}>
                <FormSection
                  sx={
                    lockCommercial
                      ? {
                          mb: 0,
                          bgcolor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          boxShadow: 'none',
                        }
                      : undefined
                  }
                >
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem', borderBottomColor: lockCommercial ? '#cbd5e1' : undefined }}>
                  Shipping & Delivery
                </SectionTitle>
                  {lockCommercial ? (
                    <Typography variant="caption" sx={{ display: 'block', mb: 1.5, mt: -0.5, color: '#64748b', fontWeight: 600 }}>
                      Read-only while orders are open
                    </Typography>
                  ) : null}
                <Grid container spacing={3}>
                  {/* Shipping Options */}
                  <Grid item xs={12}>
                    <Typography variant="body1" sx={{ mb: 2, fontWeight: 500, fontSize: isMobile ? '14px' : '0.875rem' }}>
                      Shipping Options
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.shippingOption}
                      onChange={(e) => handleInputChange('shippingOption', e.target.value)}
                      disabled={lockCommercial}
                      sx={{
                        display: 'flex',
                        gap: 2,
                        flexWrap: 'wrap',
                        '& .MuiFormControlLabel-root': {
                          flex: '1 1 auto',
                          margin: 0,
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          borderRadius: 2,
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          ...(!lockCommercial
                            ? {
                                '&:hover': {
                                  backgroundColor: '#f5f5f5',
                                  borderColor: '#4caf50'
                                },
                              }
                            : {
                                backgroundColor: '#e8edf3',
                                borderColor: '#cbd5e1',
                                '&:hover': {
                                  backgroundColor: '#e8edf3',
                                  borderColor: '#cbd5e1',
                                },
                              }),
                          '& .MuiTypography-root': {
                            fontWeight: 500,
                            fontSize: isMobile ? '0.875rem' : '1rem'
                          }
                        }
                      }}
                    >
                      <FormControlLabel
                        value="Shipping"
                        control={<Radio sx={{ color: '#4caf50' }} />}
                        label="Shipping"
                      />
                      <FormControlLabel
                        value="Pickup"
                        control={<Radio sx={{ color: '#4caf50' }} />}
                        label="Pickup"
                      />
                      <FormControlLabel
                        value="Both"
                        control={<Radio sx={{ color: '#4caf50' }} />}
                        label="Both"
                      />
                    </RadioGroup>
                  </Grid>

                  {/* Delivery Date */}
                  <Grid item xs={12} md={6}>
                    <StyledTextField
                      fullWidth
                      type="date"
                      label="Estimated Delivery Date"
                      value={formatDateForInput(formData.deliveryTime)}
                      onChange={(e) => handleInputChange('deliveryTime', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: minSelectableDate }}
                      error={!!errors.deliveryTime}
                      helperText={errors.deliveryTime || 'Expected delivery date after harvest (today or future only)'}
                      isMobile={isMobile}
                      disabled={lockCommercial}
                    />
                  </Grid>

                  {/* Shipping Scope */}
                  <Grid item xs={12}>
                    <Typography variant="body1" sx={{ mb: 2, fontWeight: 500, color: '#2d3748' }}>
                      Shipping Scope
                    </Typography>
                    <RadioGroup
                      row
                      value={formData.shippingScope}
                      onChange={(e) => handleInputChange('shippingScope', e.target.value)}
                      disabled={lockCommercial}
                      sx={{
                        gap: 2,
                        mb: 2,
                        '& .MuiFormControlLabel-root': {
                          margin: 0,
                          padding: '10px 20px',
                          borderRadius: '12px',
                          border: '2px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          transition: 'all 0.2s ease',
                          ...(!lockCommercial
                            ? {
                                '&:hover': {
                                  backgroundColor: '#e8f5e8',
                                  borderColor: '#4caf50'
                                },
                              }
                            : {
                                backgroundColor: '#e8edf3',
                                borderColor: '#cbd5e1',
                                '&:hover': {
                                  backgroundColor: '#e8edf3',
                                  borderColor: '#cbd5e1',
                                },
                              }),
                          '& .MuiTypography-root': {
                            fontWeight: 500,
                            fontSize: isMobile ? '0.875rem' : '1rem'
                          }
                        }
                      }}
                    >
                      <FormControlLabel value="Global" control={<Radio sx={{ color: '#4caf50' }} />} label="Global" />
                      <FormControlLabel value="Country" control={<Radio sx={{ color: '#4caf50' }} />} label="Country" />
                      <FormControlLabel value="City" control={<Radio sx={{ color: '#4caf50' }} />} label="City" />
                    </RadioGroup>

                    {formData.shippingScope === 'Global' && (
                       <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#64748b', fontStyle: 'italic', backgroundColor: '#f1f5f9', p: 1, borderRadius: 1 }}>
                         🌍 <strong>International Delivery:</strong> To be calculated based on destination and actual weight at checkout.
                       </Typography>
                    )}
                  </Grid>

                  {/* Delivery Charges */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: '#2d3748' }}>
                      Delivery Charges configuration
                    </Typography>
                    {/* Pricing Guidelines */}
                    <Box sx={{ 
                      mt: 2, 
                      mb: 2, 
                      p: 2, 
                      borderRadius: '12px', 
                      backgroundColor: '#fff5f5', 
                      border: '1px solid #feb2b2',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}>
                      <Typography variant="subtitle2" sx={{ color: '#c53030', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                        ✨ Suggested Delivery Rates by Sharecrop:
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: '#742a2a' }}>
                          0–12 {productionUnitLabel(formData.totalProductionUnit)}:
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a', fontWeight: 700 }}>$15.00 USD</Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a' }}>
                          13–36 {productionUnitLabel(formData.totalProductionUnit)}:
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a', fontWeight: 700 }}>$25.00 USD</Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a' }}>
                          37–1000 {productionUnitLabel(formData.totalProductionUnit)}:
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a', fontWeight: 700 }}>$25.00+ (tiered)</Typography>
                      </Box>
                    </Box>

                    {(formData.deliveryCharges || []).map((charge, index) => (
                      <Box key={index} sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <StyledTextField
                            label={`Upto (${productionUnitLabel(formData.totalProductionUnit)})`}
                            placeholder={productionUnitLabel(formData.totalProductionUnit)}
                            value={charge?.upto ?? ''}
                            onChange={(e) => updateDeliveryCharge(index, 'upto', e.target.value)}
                            isMobile={isMobile}
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            disabled={lockCommercial}
                          />
                          <StyledTextField
                            label="Amount ($)"
                            placeholder="$"
                            value={charge?.amount ?? ''}
                            onChange={(e) => updateDeliveryCharge(index, 'amount', e.target.value)}
                            isMobile={isMobile}
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: 'any' }}
                            disabled={lockCommercial}
                          />
                          {(formData.deliveryCharges || []).length > 1 && (
                            <IconButton size="small" onClick={() => removeDeliveryCharge(index)} color="error" disabled={lockCommercial}>
                              <Remove fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ mt: 0.5, color: '#d32f2f', fontWeight: 'bold' }}>
                          ✨ Value Suggestion by Sharecrop
                        </Typography>
                        {/* Status message for weight depth */}
                        {parseFloat(charge?.upto) >= 37 && (
                          <Typography variant="caption" sx={{ mt: 0.2, color: '#d32f2f', fontWeight: 500, fontStyle: 'italic' }}>
                            ⚠️ For 37kg+, cost is more than $25 and increases with weight.
                          </Typography>
                        )}
                      </Box>
                    ))}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      <Button
                        startIcon={<Add />}
                        onClick={addDeliveryCharge}
                        size="small"
                        disabled={lockCommercial}
                        sx={{ textTransform: 'none' }}
                      >
                        Add Charge Tier
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={applyRecommendedRates}
                        disabled={lockCommercial}
                        sx={{
                          textTransform: 'none',
                          borderColor: '#ffcc00',
                          color: '#d4a017',
                          '&:hover': { backgroundColor: '#fff9e6', borderColor: '#d4a017' }
                        }}
                      >
                         Apply Recommended Rates
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </FormSection>
              </Box>
            </Box>
          );
        })()}
      </StyledDialogContent >

      {/* Location Picker Dialog */}
      < LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onLocationSelect={handleLocationSelect}
        initialLocation={
          formData.latitude && formData.longitude ? {
            lat: parseFloat(formData.latitude) || 0,
            lng: parseFloat(formData.longitude) || 0
          } : null
        }
      />

      {/* Only show standard actions if we are in the normal form state */}
      {
        (!checkingLicense &&
          (user?.approval_status || (user?.is_active ? 'approved' : 'pending')) === 'approved' &&
          farmsList && farmsList.length > 0) && (
          <StyledDialogActions isMobile={isMobile}>
            <StyledButton
              onClick={handleClose}
              variant="outlined"
              isMobile={isMobile}
            >
              Cancel
            </StyledButton>
            <StyledButton
              onClick={handleSubmit}
              variant="contained"
              disabled={isSubmitting}
              isMobile={isMobile}
              sx={{
                backgroundColor: '#4caf50',
                '&:hover': {
                  backgroundColor: '#45a049'
                }
              }}
            >
              {isSubmitting ? 'Creating...' : (editMode ? (lockCommercial ? 'Save listing details' : 'Update Field') : 'Create Field')}
            </StyledButton>
          </StyledDialogActions>
        )
      }
    </StyledDialog >
  );
};

export default CreateFieldForm;

// Function to format location to show only city and country
const formatLocationDisplay = (location) => {
  if (!location) return '';

  const parts = location.split(', ');
  if (parts.length >= 2) {
    // If we have at least 2 parts, take the first (city) and last (country)
    const city = parts[0];
    const country = parts[parts.length - 1];
    return `${city}, ${country}`;
  }

  // If only one part or less, return as is
  return location;
};