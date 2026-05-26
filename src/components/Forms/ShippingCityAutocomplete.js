import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Autocomplete, CircularProgress, TextField, Typography } from '@mui/material';
import {
  searchMapboxPlaces,
  mapboxFeatureToShippingCityRow,
  shippingCityRowToOption,
} from '../../utils/mapboxPlaces';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const fieldSx = (isMobile) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: isMobile ? '8px' : '12px',
    fontSize: isMobile ? '14px' : '16px',
    minHeight: isMobile ? '48px' : '56px',
  },
});

/**
 * City picker backed by Mapbox (disambiguates e.g. multiple Springfields in the US).
 */
const ShippingCityAutocomplete = ({
  countryCode,
  value,
  onChange,
  disabled = false,
  isMobile = false,
  error = false,
}) => {
  const [inputValue, setInputValue] = useState(() => value?.label || value?.city || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef(null);

  const selectedOption = useMemo(() => shippingCityRowToOption(value), [value]);

  useEffect(() => {
    setInputValue(value?.label || value?.city || '');
  }, [value?.mapboxId, value?.label, value?.city, value?.region]);

  const runSearch = (query) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!MAPBOX_TOKEN) {
      setOptions([]);
      return;
    }
    if (!countryCode || String(query || '').trim().length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      const features = await searchMapboxPlaces(query, { countryCode });
      const mapped = features
        .map((f) => mapboxFeatureToShippingCityRow(f, countryCode))
        .filter(Boolean)
        .map((row) => ({
          ...row,
          place_name: row.label,
          id: row.mapboxId,
        }));
      setOptions(mapped);
      setLoading(false);
    }, 320);
  };

  if (!MAPBOX_TOKEN) {
    return (
      <TextField
        fullWidth
        sx={fieldSx(isMobile)}
        label="City (Mapbox token missing)"
        value={value?.city || ''}
        disabled
        helperText="Add REACT_APP_MAPBOX_ACCESS_TOKEN to enable city search"
        size={isMobile ? 'small' : 'medium'}
      />
    );
  }

  return (
    <>
      <Autocomplete
        sx={{ flex: '2 1 220px', minWidth: 0, width: isMobile ? '100%' : 'auto' }}
        disabled={disabled || !countryCode}
        options={options}
        loading={loading}
        filterOptions={(x) => x}
        getOptionLabel={(opt) => opt?.label || opt?.place_name || opt?.city || ''}
        isOptionEqualToValue={(a, b) => {
          if (!a || !b) return false;
          if (a.mapboxId && b.mapboxId) return a.mapboxId === b.mapboxId;
          return (
            a.countryCode === b.countryCode &&
            a.city === b.city &&
            (a.region || '') === (b.region || '')
          );
        }}
        value={selectedOption}
        inputValue={inputValue}
        onInputChange={(_, newInput, reason) => {
          setInputValue(newInput);
          if (reason === 'input') runSearch(newInput);
        }}
        onChange={(_, opt) => {
          if (!opt) {
            onChange({
              countryCode: countryCode || '',
              city: '',
              region: '',
              regionCode: '',
              mapboxId: '',
              label: '',
              center: null,
            });
            setInputValue('');
            return;
          }
          onChange({
            countryCode: opt.countryCode || countryCode || '',
            city: opt.city || '',
            region: opt.region || '',
            regionCode: opt.regionCode || '',
            mapboxId: opt.mapboxId || '',
            label: opt.label || opt.place_name || '',
            center: opt.center || null,
          });
          setInputValue(opt.label || opt.place_name || opt.city || '');
        }}
        noOptionsText={
          !countryCode
            ? 'Select a country first'
            : inputValue.trim().length < 2
              ? 'Type at least 2 characters'
              : 'No cities found'
        }
        renderInput={(params) => (
          <TextField
            {...params}
            sx={fieldSx(isMobile)}
            label="City"
            placeholder={countryCode ? 'Search city (e.g. Springfield, IL)' : 'Select country first'}
            error={error}
            size={isMobile ? 'small' : 'medium'}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {value?.label ? (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
          {value.label}
        </Typography>
      ) : null}
    </>
  );
};

export default ShippingCityAutocomplete;
