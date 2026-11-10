import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Stack,
} from '@mui/material';
import {
  Close,
  LocationOn,
  Agriculture,
  Grass,
  LocalFlorist,
  Park,
  Terrain,
  Nature,
  Yard,
  CloudUpload,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import LocationPicker from './LocationPicker';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth <= 768);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

/** Comfortable desktop width — not cramped; mobile uses nearly full screen. */
const StyledDialog = styled(Dialog)(({ theme, isMobile }) => ({
  '& .MuiDialog-container': {
    alignItems: isMobile ? 'flex-end' : 'center',
  },
  '& .MuiDialog-paper': {
    borderRadius: isMobile ? '20px 20px 0 0' : '20px',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
    border: '1px solid #dcfce7',
    width: isMobile ? '100%' : 'min(560px, calc(100vw - 48px))',
    maxWidth: isMobile ? '100%' : '560px',
    margin: isMobile ? 0 : '24px',
    maxHeight: isMobile ? '92vh' : '90vh',
    background: '#f8fffe',
    display: 'flex',
    flexDirection: 'column',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ isMobile }) => ({
  background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
  color: 'white',
  fontWeight: 700,
  fontSize: isMobile ? '1.125rem' : '1.25rem',
  textAlign: 'left',
  padding: isMobile ? '16px 48px 16px 20px' : '18px 52px 18px 24px',
  borderRadius: isMobile ? '20px 20px 0 0' : '20px 20px 0 0',
  position: 'relative',
  flexShrink: 0,
}));

const StyledDialogContent = styled(DialogContent)(({ isMobile }) => ({
  padding: isMobile ? '16px 16px 8px !important' : '20px 24px 8px !important',
  background: '#f8fffe',
  overflowY: 'auto',
  flex: '1 1 auto',
}));

const fieldSx = (isMobile) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    fontSize: isMobile ? '0.9375rem' : '1rem',
    minHeight: isMobile ? 48 : 44,
    '& fieldset': { borderColor: '#bbf7d0', borderWidth: '1.5px' },
    '&:hover fieldset': { borderColor: '#86efac' },
    '&.Mui-focused fieldset': { borderColor: '#4caf50', borderWidth: '2px' },
  },
  '& .MuiInputLabel-root': {
    color: '#475569',
    fontWeight: 500,
    '&.Mui-focused': { color: '#15803d' },
  },
  '& .MuiFormHelperText-root': {
    marginLeft: 0,
    fontSize: '0.75rem',
  },
});

const farmIcons = [
  { value: 'agriculture', label: 'Agriculture', icon: <Agriculture sx={{ color: '#8bc34a' }} /> },
  { value: 'grass', label: 'Grass Field', icon: <Grass sx={{ color: '#4caf50' }} /> },
  { value: 'eco', label: 'Eco Farm', icon: <Nature sx={{ color: '#2e7d32' }} /> },
  { value: 'flower', label: 'Flower Farm', icon: <LocalFlorist sx={{ color: '#e91e63' }} /> },
  { value: 'park', label: 'Park Farm', icon: <Park sx={{ color: '#388e3c' }} /> },
  { value: 'terrain', label: 'Terrain', icon: <Terrain sx={{ color: '#795548' }} /> },
  { value: 'nature', label: 'Nature Farm', icon: <Nature sx={{ color: '#689f38' }} /> },
  { value: 'yard', label: 'Yard', icon: <Yard sx={{ color: '#558b2f' }} /> },
];

const emptyFarmForm = () => ({
  farmName: '',
  farmIcon: '',
  location: '',
  coordinates: { lat: null, lng: null },
  webcamUrl: '',
  description: '',
  status: 'Active',
  licenseFile: null,
});

const apiFarmToFormInitial = (farm) => {
  if (!farm) return null;
  let coords = { lat: null, lng: null };
  if (farm.coordinates) {
    if (Array.isArray(farm.coordinates)) {
      coords = { lng: farm.coordinates[0], lat: farm.coordinates[1] };
    } else if (farm.coordinates.lat != null && farm.coordinates.lng != null) {
      coords = { lat: farm.coordinates.lat, lng: farm.coordinates.lng };
    }
  }
  return {
    farmName: farm.farm_name || farm.name || '',
    farmIcon: farm.farm_icon || farm.farmIcon || '',
    location: farm.location || '',
    coordinates: coords,
    webcamUrl: farm.webcam_url || farm.webcamUrl || '',
    description: farm.description || '',
    status: farm.status || 'Active',
    licenseFile: null,
  };
};

const AddFarmForm = ({ open, onClose, onSubmit, editMode = false, initialData = null }) => {
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState(emptyFarmForm());
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && editMode && initialData) {
      const initial = apiFarmToFormInitial(initialData);
      if (initial) setFormData(initial);
    }
    if (open && !editMode) {
      setFormData(emptyFarmForm());
      setErrors({});
    }
  }, [open, editMode, initialData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleLocationSelect = (locationData) => {
    const coordinates = Array.isArray(locationData.coordinates)
      ? { lng: locationData.coordinates[0], lat: locationData.coordinates[1] }
      : locationData.coordinates;

    setFormData((prev) => ({
      ...prev,
      location: locationData.address,
      coordinates,
    }));
    if (errors.location) setErrors((prev) => ({ ...prev, location: '' }));
    setLocationPickerOpen(false);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.farmName.trim()) newErrors.farmName = 'Farm name is required';
    if (!formData.farmIcon || formData.farmIcon.trim() === '') {
      newErrors.farmIcon = 'Please select a farm icon';
    }
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';

    if (formData.webcamUrl.trim()) {
      try {
        new URL(formData.webcamUrl);
      } catch {
        newErrors.webcamUrl = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClose = () => {
    setFormData(emptyFarmForm());
    setErrors({});
    onClose();
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    const farmData = {
      farmName: formData.farmName,
      name: formData.farmName,
      farmIcon: formData.farmIcon,
      location: formData.location,
      coordinates: formData.coordinates,
      webcamUrl: formData.webcamUrl,
      description: formData.description,
      status: formData.status,
      licenseFile: formData.licenseFile,
    };
    if (editMode && initialData?.id) {
      farmData.id = initialData.id;
    } else {
      farmData.id = Date.now();
      farmData.created_at = new Date().toISOString();
    }
    onSubmit(farmData);
    handleClose();
  };

  const inputSx = fieldSx(isMobile);

  return (
    <>
      <StyledDialog
        open={open}
        onClose={handleClose}
        maxWidth={false}
        fullWidth
        isMobile={isMobile}
      >
        <StyledDialogTitle isMobile={isMobile}>
          {editMode ? 'Edit Farm' : 'Add New Farm'}
          <IconButton
            aria-label="Close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              width: 44,
              height: 44,
            }}
          >
            <Close />
          </IconButton>
        </StyledDialogTitle>

        <StyledDialogContent isMobile={isMobile}>
          <Typography
            sx={{
              display: 'block',
              color: '#64748b',
              mb: 2,
              fontSize: '0.8125rem',
              lineHeight: 1.45,
            }}
          >
            Keep this short — crop, area, and harvest details go on each product/field.
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Farm Name"
              value={formData.farmName}
              onChange={(e) => handleInputChange('farmName', e.target.value)}
              error={!!errors.farmName}
              helperText={errors.farmName}
              placeholder="e.g. Green Valley Farm"
              sx={inputSx}
            />

            <FormControl fullWidth error={!!errors.farmIcon} sx={inputSx}>
              <InputLabel>Farm icon</InputLabel>
              <Select
                value={formData.farmIcon}
                label="Farm icon"
                onChange={(e) => handleInputChange('farmIcon', e.target.value)}
                renderValue={(selected) => {
                  const selectedItem = farmIcons.find((icon) => icon.value === selected);
                  return selectedItem ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {selectedItem.icon}
                      <Typography component="span">{selectedItem.label}</Typography>
                    </Box>
                  ) : null;
                }}
              >
                {farmIcons.map((icon) => (
                  <MenuItem key={icon.value} value={icon.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {icon.icon}
                      <Typography>{icon.label}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {errors.farmIcon && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 0 }}>
                  {errors.farmIcon}
                </Typography>
              )}
            </FormControl>

            <TextField
              fullWidth
              label="Status"
              select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              sx={inputSx}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Growing">Growing</MenuItem>
              <MenuItem value="Harvesting">Harvesting</MenuItem>
              <MenuItem value="Planning">Planning</MenuItem>
            </TextField>

            <TextField
              fullWidth
              label="Location"
              value={formData.location}
              error={!!errors.location}
              helperText={errors.location || 'Tap the pin to pick on the map'}
              placeholder="Choose on map"
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Pick location on map"
                      onClick={() => setLocationPickerOpen(true)}
                      edge="end"
                      sx={{
                        color: '#15803d',
                        width: 44,
                        height: 44,
                        bgcolor: 'rgba(76, 175, 80, 0.1)',
                        '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.18)' },
                      }}
                    >
                      <LocationOn />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              onClick={() => setLocationPickerOpen(true)}
              sx={{ ...inputSx, cursor: 'pointer', '& .MuiInputBase-input': { cursor: 'pointer' } }}
            />

            <TextField
              fullWidth
              label="Webcam URL (optional)"
              value={formData.webcamUrl}
              onChange={(e) => handleInputChange('webcamUrl', e.target.value)}
              error={!!errors.webcamUrl}
              helperText={errors.webcamUrl}
              placeholder="https://…"
              sx={inputSx}
            />

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              error={!!errors.description}
              helperText={errors.description}
              placeholder="A short note about this farm"
              sx={inputSx}
            />

            <Box
              sx={{
                border: '1.5px dashed #86efac',
                bgcolor: '#ffffff',
                p: 2,
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#15803d',
                  borderColor: '#4caf50',
                  borderRadius: '12px',
                  minHeight: 44,
                  px: 2.5,
                  '&:hover': { borderColor: '#388e3c', bgcolor: 'rgba(76, 175, 80, 0.06)' },
                }}
              >
                Upload license
                <input
                  type="file"
                  hidden
                  onChange={(e) => handleInputChange('licenseFile', e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
              </Button>
              {formData.licenseFile && (
                <Typography variant="body2" sx={{ mt: 1.25, color: '#334155', wordBreak: 'break-all' }}>
                  {formData.licenseFile.name}
                </Typography>
              )}
            </Box>
          </Stack>
        </StyledDialogContent>

        <DialogActions
          sx={{
            px: isMobile ? 2 : 3,
            py: 2,
            gap: 1,
            flexDirection: isMobile ? 'column-reverse' : 'row',
            borderTop: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <Button
            onClick={handleClose}
            variant="outlined"
            fullWidth={isMobile}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '12px',
              minHeight: 44,
              color: '#475569',
              borderColor: '#cbd5e1',
              px: 2.5,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            fullWidth={isMobile}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '12px',
              minHeight: 44,
              px: 2.5,
              bgcolor: '#4caf50',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#43a047', boxShadow: 'none' },
            }}
          >
            {editMode ? 'Save changes' : 'Save farm'}
          </Button>
        </DialogActions>
      </StyledDialog>

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onLocationSelect={handleLocationSelect}
        initialLocation={formData.coordinates.lat ? formData.coordinates : null}
      />
    </>
  );
};

export default AddFarmForm;
