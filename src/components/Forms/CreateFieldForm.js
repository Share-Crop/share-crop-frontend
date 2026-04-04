import React, { useState, useEffect } from 'react';
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
  Checkbox
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
import fieldsService from '../../services/fields';

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
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#c8e6c9',
      boxShadow: isSuggested ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.1)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: isSuggested ? '#e2e8f0' : '#4caf50',
      borderWidth: isSuggested ? '1px' : '2px',
    },
  },
  '& .MuiInputBase-input': {
    fontStyle: isSuggested ? 'italic' : 'normal',
    color: isSuggested ? '#64748b' : 'inherit',
    cursor: isSuggested ? 'default' : 'text',
  },
  '& .MuiInputLabel-root': {
    color: '#4a5568',
    fontWeight: 500,
    fontSize: isMobile ? '12px' : '14px',
    zIndex: 1,
    '&.Mui-focused': {
      color: isSuggested ? '#4a5568' : '#4caf50',
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
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#c8e6c9',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#4caf50',
      borderWidth: '2px',
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
  gap: isMobile ? '8px' : '12px',
  width: isMobile ? '100%' : '320px',
  '& .MuiTextField-root': {
    flex: 1,
    width: 'auto !important',
  },
  '& .MuiFormControl-root': {
    width: '120px',
    flexShrink: 0,
  }
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

const CreateFieldForm = ({ open, onClose, onSubmit, editMode = false, initialData = null, farmsList = [], fieldsList = [] }) => {
  // Debug logging

  // Mobile detection hook
  const isMobile = useIsMobile();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    selectedIcon: '',
    category: '',
    subcategory: '',
    productName: '',
    description: '',
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
    rent_duration_yearly: false
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  }, [formData.totalProduction, formData.fieldSize, formData.fieldSizeUnit, formData.distributionPrice, formData.retailPrice, formData.sellingPrice, formData.sellingAmount]);

  // Calculate remaining area whenever farm selection or fields change
  useEffect(() => {
    const calculateArea = async () => {
      if (formData.farmId) {
        let farm = farmsList.find(f => String(f.id || f._id) === String(formData.farmId));

        if (!farm || (editMode && formData.farmId)) {
          try {
            const response = await farmsService.getById(formData.farmId);
            if (response.data) {
              farm = response.data;
            }
          } catch (err) {
            console.error('Error fetching farm details:', err);
          }
        }

        if (farm) {
          const farmIdSource = String(farm.id || farm._id || '');
          const totalArea = parseFloat(farm.area_value || farm.areaValue) || 0;
          const farmUnit = normalizeAreaUnit(farm.area_unit || farm.areaUnit || 'sqm');

          let allFields = fieldsList || [];

          if (allFields.length === 0) {
            try {
              const fieldsResponse = await fieldsService.getAllForMap();
              if (fieldsResponse.data) {
                allFields = fieldsResponse.data;
              }
            } catch (err) {
              console.error('Error fetching fields list:', err);
            }
          }

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
                updates.harvestDates = farmHarvestDates;
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
  }, [formData.farmId, farmsList, fieldsList, editMode, initialData]);

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



  const categoryData = {
    'Beverages': ['Beer', 'Coffee', 'Juice', 'Milk', 'Soda', 'Teabags', 'Wine'],
    'Bread & Bakery': ['Bagels', 'Bread', 'Cookies', 'Muffins', 'Pies', 'Tortillas'],
    'Canned Goods': ['Fruit', 'Pasta Sauce', 'Soup', 'Vegetables'],
    'Dairy': ['Butter', 'Cheese', 'Eggs', 'Milk'],
    'Deli': ['Cheeses', 'Salami'],
    'Fish & Seafood': ['Bivalves & Clams', 'Crab', 'Fish', 'Lobster', 'Octopus & Squid', 'Shrimp'],
    'Frozen Foods': ['Fish', 'Ice cream', 'Pizza', 'Potatoes', 'Ready Meals'],
    'Fruits': ['Green Apple', 'Red Apple', 'Peach', 'Strawberry', 'Tangerine', 'Watermelon', 'Avocados', 'Mango', 'Grapes', 'Banana'],
    'Vegetables': ['Corn', 'Eggplant', 'Lemon', 'Tomato', 'Broccoli', 'Capsicum', 'Carrot', 'Onions', 'Potatoes', 'Salad Greens'],
    'Meat': ['Bacon', 'Chicken', 'Pork', 'Beef'],
    'Oil': ['Coconut Oil', 'Olive Oil', 'Peanut Oil', 'Sunflower Oil'],
    'Seeds': ['Hibiscus', 'Rice Seeds', 'Rose'],
    'Snacks': ['Nuts', 'Popcorn', 'Pretzels']
  };

  // Show all available categories
  const availableCategories = Object.keys(categoryData);
  const categories = ['Select Category', ...availableCategories];

  // State for location address display
  const [locationAddress, setLocationAddress] = useState('');

  // Update form data when initialData changes
  useEffect(() => {
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
        shippingScope: initialData.shipping_scope || 'Global',
        price_per_m2: initialData.price_per_m2 || initialData.pricePerM2 || 0,
        available_for_buy: initialData.available_for_buy ?? true,
        available_for_rent: Boolean(initialData.available_for_rent),
        rent_price_per_month: initialData.rent_price_per_month ?? '',
        rent_duration_monthly: Boolean(initialData.rent_duration_monthly),
        rent_duration_quarterly: Boolean(initialData.rent_duration_quarterly),
        rent_duration_yearly: Boolean(initialData.rent_duration_yearly)
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
  }, [initialData, editMode]);

  // Quick apply recommended delivery rates
  const applyRecommendedRates = () => {
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
    let processedValue = value;

    // Preventive validation for field size - cap at available remaining area
    if (field === 'fieldSize' && formData.farmId) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > selectedFarmArea.remaining) {
        processedValue = selectedFarmArea.remaining.toString();
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
    setFormData(prev => ({
      ...prev,
      harvestDates: [...(prev.harvestDates || []), { date: '', label: '' }]
    }));
  };

  // Remove harvest date
  const removeHarvestDate = (index) => {
    const currentHarvestDates = formData.harvestDates || [];
    if (currentHarvestDates.length > 1) {
      setFormData(prev => ({
        ...prev,
        harvestDates: (prev.harvestDates || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Map subcategory names to icon filenames
  const subcategoryToIconMap = {
    'Green Apple': 'apple_green.png',
    'Red Apple': 'apple_red.png',
    'Corn': 'corn.png',
    'Eggplant': 'eggplant.png',
    'Lemon': 'lemon.png',
    'Peach': 'peach.png',
    'Strawberry': 'strawberry.png',
    'Tangerine': 'tangerine.png',
    'Tomato': 'tomato.png',
    'Watermelon': 'watermelon.png',
    // Additional subcategories with fallback icons
    'Avocados': 'apple_green.png',
    'Mango': 'peach.png',
    'Grapes': 'strawberry.png',
    'Banana': 'tangerine.png',
    'Broccoli': 'eggplant.png',
    'Capsicum': 'tomato.png',
    'Carrot': 'tangerine.png',
    'Onions': 'eggplant.png',
    'Potatoes': 'corn.png',
    'Salad Greens': 'eggplant.png',
  };

  // Get available icons based on selected subcategory
  const getAvailableIcons = () => {
    // Only show icon if subcategory is selected
    if (!formData.subcategory) {
      return [];
    }

    // Get the icon for the selected subcategory
    const iconName = subcategoryToIconMap[formData.subcategory];

    // If icon exists for this subcategory, return it as an array
    if (iconName) {
      return [iconName];
    }

    // If no icon mapping found, return empty array
    return [];
  };

  const getIconPath = (iconName) => {
    if (!iconName) return '';
    // Determine category folder based on selected category
    // Fruits and Vegetables both use the 'fruits' folder for now
    const category = formData.category?.toLowerCase() === 'fruits' || formData.category?.toLowerCase() === 'vegetables'
      ? 'fruits'
      : 'fruits'; // Default to fruits folder
    return `/icons/products/${category}/${iconName}`;
  };

  const addDeliveryCharge = () => {
    setFormData(prev => ({
      ...prev,
      deliveryCharges: [...(prev.deliveryCharges || []), { upto: '', amount: '' }]
    }));
  };

  const removeDeliveryCharge = (index) => {
    setFormData(prev => ({
      ...prev,
      deliveryCharges: (prev.deliveryCharges || []).filter((_, i) => i !== index)
    }));
  };

  const updateDeliveryCharge = (index, field, value) => {
    setFormData(prev => {
      const updatedCharges = (prev.deliveryCharges || []).map((charge, i) => {
        if (i === index) {
          const newCharge = { ...charge, [field]: value };
          // Auto-fill amount based on upto value
          if (field === 'upto') {
            const num = parseFloat(value);
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
    if (!formData.distributionPrice) newErrors.distributionPrice = 'Distribution price is required';
    if (!formData.sellingAmount) newErrors.sellingAmount = 'How much product to sell is required';
    if (!formData.sellingPrice) newErrors.sellingPrice = 'Your sharecrop price is required';
    if (!formData.retailPrice) newErrors.retailPrice = 'Retail price is required';

    // Validate harvest dates
    const harvestDatesArray = formData.harvestDates || [];
    const hasValidHarvestDate = harvestDatesArray.some(date => date.date && date.date.trim() !== '');
    if (!hasValidHarvestDate) newErrors.harvestDates = 'At least one harvest date is required';

    if (formData.hasWebcam && (!formData.webcamUrl || !formData.webcamUrl.trim())) {
      newErrors.webcamUrl = 'Webcam URL is required when webcam is enabled';
    }
    if (!formData.latitude) newErrors.latitude = 'Latitude is required';
    if (!formData.longitude) newErrors.longitude = 'Longitude is required';
    if (!formData.farmId) newErrors.farmId = 'Please select a farm for this field';
    if (formData.available_for_rent) {
      if (!formData.rent_price_per_month || String(formData.rent_price_per_month).trim() === '' || isNaN(parseFloat(formData.rent_price_per_month))) {
        newErrors.rent_price_per_month = 'Rent price per month is required when available for rent';
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
      price: parseFloat(formData.sellingPrice),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      image: formData.selectedIcon ? getIconPath(formData.selectedIcon) : '',
      icon: formData.selectedIcon ? getIconPath(formData.selectedIcon) : '',
      fieldSize: formData.fieldSize,
      field_size: formData.fieldSize, // Snake case
      fieldSizeUnit: formData.fieldSizeUnit,
      field_size_unit: formData.fieldSizeUnit, // Snake case
      productionRate: formData.productionPerArea,
      production_rate: formData.productionPerArea, // Calculated production per area
      productionRateUnit: 'Kg/m²',
      production_rate_unit: 'Kg/m²',
      totalProduction: formData.totalProduction,
      total_production: formData.totalProduction,
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
      rent_duration_yearly: false
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
        {editMode ? 'Edit Field' : 'Create New Field'}
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
              {/* Basic Information Section */}
              <FormSection>
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem' }}>Basic Information</SectionTitle>
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: isMobile ? '16px' : '24px',
                  justifyContent: 'flex-start'
                }}>
                  {/* Farm Selection Dropdown */}
                  <StyledFormControl error={!!errors.farmId} isMobile={isMobile}>
                    <InputLabel sx={{ fontWeight: 500 }}>Select Farm</InputLabel>
                    <Select
                      value={formData.farmId ?? ''}
                      onChange={(e) => handleInputChange('farmId', e.target.value)}
                      label="Select Farm"
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
                    disabled={!formData.category || formData.category === 'Select Category'}
                    isMobile={isMobile}
                  >
                    <InputLabel sx={{ fontWeight: 500 }}>Select Sub Category</InputLabel>
                    <Select
                      value={formData.subcategory || ''}
                      onChange={(e) => {
                        const newSubcategory = e.target.value;
                        handleInputChange('subcategory', newSubcategory);
                        const iconForSubcategory = subcategoryToIconMap[newSubcategory];
                        if (iconForSubcategory) {
                          handleInputChange('selectedIcon', iconForSubcategory);
                        } else {
                          handleInputChange('selectedIcon', '');
                        }
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

                  {/* Product Icon */}
                  <Box sx={{
                    width: isMobile ? '100%' : '320px',
                    height: isMobile ? '48px' : '56px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {formData.subcategory && getAvailableIcons().length > 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: '100%' }}>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, flexWrap: 'wrap' }}>
                          {getAvailableIcons().map((iconName) => {
                            const iconPath = getIconPath(iconName);
                            const isSelected = formData.selectedIcon === iconName;
                            return (
                              <Box
                                key={iconName}
                                onClick={() => handleInputChange('selectedIcon', iconName)}
                                sx={{
                                  position: 'relative',
                                  width: 40, height: 40,
                                  border: isSelected ? '2px solid' : '1.5px solid',
                                  borderColor: isSelected ? '#4CAF50' : '#e0e0e0',
                                  borderRadius: 1.25,
                                  p: 0.5,
                                  cursor: 'pointer',
                                  bgcolor: isSelected ? 'rgba(76,175,80,0.08)' : '#fafafa',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  '&:hover': { borderColor: '#4CAF50', bgcolor: 'rgba(76,175,80,0.12)' }
                                }}
                              >
                                <Box component="img" src={iconPath} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                {isSelected && (
                                  <Box sx={{
                                    position: 'absolute', top: -4, right: -4, width: 14, height: 14,
                                    borderRadius: '50%', bgcolor: '#4CAF50', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 8, border: '2px solid white'
                                  }}>✓</Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', color: 'text.secondary', fontStyle: 'italic', pl: 1 }}>
                        No icon available
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
                </Box>
              </FormSection>

              {/* Field Details Section */}
              <FormSection>
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem' }}>Field Details</SectionTitle>
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
                      />
                      <StyledFormControl isMobile={isMobile}>
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={formData.fieldSizeUnit}
                          onChange={(e) => handleInputChange('fieldSizeUnit', e.target.value)}
                          label="Unit"
                          disabled={!!formData.farmId}
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
                      onClick={() => setLocationPickerOpen(true)}
                      isMobile={isMobile}
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
                              isMobile={isMobile}
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
                                isMobile={isMobile}
                                sx={{ width: '100%' }}
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
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                {index === (formData.harvestDates || []).length - 1 && (
                                  <IconButton
                                    onClick={addHarvestDate}
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
                          '&:hover': {
                            backgroundColor: '#e8f5e8',
                            borderColor: '#4caf50'
                          },
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
                        />
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </FormSection>

              {/* Pricing Information Section */}
              <FormSection>
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem' }}>Pricing Information</SectionTitle>
                <Grid container spacing={3}>
                  {/* Total Production */}
                  <Grid item xs={12} md={6}>
                    <StyledTextField
                      fullWidth
                      label="Total production per harvest"
                      placeholder="e.g. 200"
                      value={formData.totalProduction}
                      onChange={(e) => handleInputChange('totalProduction', e.target.value)}
                      error={!!errors.totalProduction}
                      helperText={errors.totalProduction}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">Kg</InputAdornment>
                      }}
                      isMobile={isMobile}
                    />
                  </Grid>

                  {/* Field Size Display */}
                  <Grid item xs={12} md={6}>
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
                      sx={{ opacity: 0.8 }}
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
                          endAdornment: <InputAdornment position="end">Kg/m²</InputAdornment>
                        }}
                        helperText="Calculated from Total Production and Normalized Area"
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
                        endAdornment: <InputAdornment position="end">USD / Kg</InputAdornment>
                      }}
                      isMobile={isMobile}
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
                        endAdornment: <InputAdornment position="end">USD / Kg</InputAdornment>
                      }}
                      isMobile={isMobile}
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
                          endAdornment: <InputAdornment position="end">USD / Kg</InputAdornment>
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
                          endAdornment: <InputAdornment position="end">USD / Kg</InputAdornment>
                        }}
                        isMobile={isMobile}
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
                          endAdornment: <InputAdornment position="end">Kg</InputAdornment>
                        }}
                        isMobile={isMobile}
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

              {/* Shipping & Delivery Section */}
              <FormSection>
                <SectionTitle sx={{ fontSize: isMobile ? '16px' : '1.5rem' }}>Shipping & Delivery</SectionTitle>
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
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            borderColor: '#4caf50'
                          },
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
                      helperText="Expected delivery date after harvest"
                      isMobile={isMobile}
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
                          '&:hover': {
                            backgroundColor: '#e8f5e8',
                            borderColor: '#4caf50'
                          },
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
                        <Typography variant="caption" sx={{ color: '#742a2a' }}>0 Kg – 12 Kg:</Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a', fontWeight: 700 }}>$15.00 USD</Typography>
                        
                        <Typography variant="caption" sx={{ color: '#742a2a' }}>13 Kg – 36 Kg:</Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a', fontWeight: 700 }}>$25.00 USD</Typography>
                        
                        <Typography variant="caption" sx={{ color: '#742a2a' }}>37 Kg – 1000 Kg:</Typography>
                        <Typography variant="caption" sx={{ color: '#742a2a', fontWeight: 700 }}>$25.00+ (Increases with weight)</Typography>
                      </Box>
                    </Box>

                    {(formData.deliveryCharges || []).map((charge, index) => (
                      <Box key={index} sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <StyledTextField
                            label="Upto (Kg)"
                            placeholder="Kg"
                            value={charge?.upto ?? ''}
                            onChange={(e) => updateDeliveryCharge(index, 'upto', e.target.value)}
                            isMobile={isMobile}
                            size="small"
                          />
                          <StyledTextField
                            label="Amount ($)"
                            placeholder="$"
                            value={charge?.amount ?? ''}
                            onChange={(e) => updateDeliveryCharge(index, 'amount', e.target.value)}
                            isMobile={isMobile}
                            size="small"
                          />
                          {(formData.deliveryCharges || []).length > 1 && (
                            <IconButton size="small" onClick={() => removeDeliveryCharge(index)} color="error">
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
                        sx={{ textTransform: 'none' }}
                      >
                        Add Charge Tier
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={applyRecommendedRates}
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
              {isSubmitting ? 'Creating...' : (editMode ? 'Update Field' : 'Create Field')}
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