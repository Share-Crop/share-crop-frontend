import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { US_STATES, findUsStateByCode, findUsStateByName } from '../../data/usStates';
import {
  searchMapboxRegions,
  mapboxFeatureToRegionRow,
  regionRowToOption,
} from '../../utils/mapboxPlaces';
import { deliveryAutocompletePopperSlot } from './deliveryAutocompletePopper';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const fieldSx = (isMobile) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: isMobile ? '8px' : '12px',
    fontSize: isMobile ? '16px' : '16px',
    minHeight: isMobile ? 48 : 56,
  },
  '& .MuiInputBase-input': {
    fontSize: isMobile ? '16px' : '16px',
    lineHeight: 1.5,
    padding: isMobile ? '12px 14px !important' : undefined,
  },
});

/**
 * State / province: US fixed list; other countries Mapbox region search + manual entry.
 */
const ShippingStateAutocomplete = ({
  countryCode,
  value,
  onChange,
  disabled = false,
  isMobile = false,
  error = false,
  popperZIndex = 15000,
}) => {
  const cc = String(countryCode || '').trim().toUpperCase();
  const isUs = cc === 'US';

  const [inputValue, setInputValue] = useState(() => value?.region || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchTimer = useRef(null);

  const selected = useMemo(() => {
    if (!isUs) return regionRowToOption(value);
    const code = String(value?.regionCode || '').trim().toUpperCase();
    if (code) return findUsStateByCode(code);
    const name = String(value?.region || '').trim();
    if (name) return findUsStateByName(name);
    return null;
  }, [isUs, value]);

  useEffect(() => {
    setInputValue(value?.region || '');
  }, [value?.region, value?.regionCode, value?.mapboxId]);

  const runRegionSearch = (query) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!MAPBOX_TOKEN || !cc) {
      setOptions([]);
      return;
    }
    const q = String(query || '').trim();
    if (q.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const features = await searchMapboxRegions(q, { countryCode: cc, limit: 8 });
        const mapped = features
          .map((f) => mapboxFeatureToRegionRow(f, cc))
          .filter(Boolean)
          .map((row) => regionRowToOption(row))
          .filter(Boolean)
          .filter(
            (item, idx, arr) =>
              arr.findIndex(
                (x) =>
                  (x.mapboxId && item.mapboxId && x.mapboxId === item.mapboxId)
                  || String(x.region || x.name || '').toLowerCase()
                    === String(item.region || item.name || '').toLowerCase()
              ) === idx
          );
        setOptions(mapped);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  };

  if (!cc) {
    return (
      <TextField
        fullWidth
        sx={fieldSx(isMobile)}
        label="State / province"
        placeholder="Select country first"
        disabled
        size={isMobile ? 'small' : 'medium'}
      />
    );
  }

  if (isUs) {
    return (
      <Autocomplete
        sx={{ width: '100%', flex: '0 0 auto' }}
        disabled={disabled}
        options={US_STATES}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a?.code === b?.code}
        value={selected}
        onChange={(_, opt) => {
          onChange({
            ...value,
            countryCode: cc,
            region: opt?.name || '',
            regionCode: opt?.code || '',
            city: '',
            mapboxId: '',
            label: '',
            center: null,
          });
        }}
      slotProps={deliveryAutocompletePopperSlot(popperZIndex)}
      renderInput={(params) => (
        <TextField
          {...params}
          sx={fieldSx(isMobile)}
          label="State"
            placeholder="e.g. Florida"
            error={error}
            size={isMobile ? 'small' : 'medium'}
            inputProps={{ ...params.inputProps, autoComplete: 'address-level1' }}
          />
        )}
      />
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <TextField
        fullWidth
        sx={fieldSx(isMobile)}
        label="State / province"
        placeholder="e.g. Punjab, Bavaria"
        value={value?.region || ''}
        disabled={disabled}
        error={error}
        size={isMobile ? 'small' : 'medium'}
        onChange={(e) =>
          onChange({
            ...value,
            region: e.target.value,
            regionCode: '',
          })
        }
        inputProps={{ autoComplete: 'address-level1' }}
      />
    );
  }

  return (
    <Autocomplete
      sx={{ width: '100%', flex: '0 0 auto' }}
      disabled={disabled}
      freeSolo
      clearOnBlur={false}
      open={menuOpen && (loading || options.length > 0)}
      onOpen={() => setMenuOpen(true)}
      onClose={() => setMenuOpen(false)}
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === 'string' ? o : (o?.label || o?.name || o?.region || ''))}
      isOptionEqualToValue={(a, b) => {
        if (!a || !b) return false;
        if (a.mapboxId && b.mapboxId) return a.mapboxId === b.mapboxId;
        return (
          String(a.region || a.name || '').toLowerCase()
          === String(b.region || b.name || '').toLowerCase()
        );
      }}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_, newInput, reason) => {
        if (reason === 'reset') {
          const typed = String(value?.region || '').trim();
          if (typed && !String(newInput || '').trim()) return;
        }
        setInputValue(newInput);
        onChange({
          ...value,
          countryCode: cc,
          region: newInput,
          regionCode: reason === 'input' ? '' : value?.regionCode || '',
          city: reason === 'input' ? '' : value?.city,
        });
        if (reason === 'input') {
          setMenuOpen(true);
          runRegionSearch(newInput);
        }
      }}
      onChange={(_, opt) => {
        setMenuOpen(false);
        if (!opt || typeof opt === 'string') {
          if (typeof opt === 'string') {
            onChange({
              ...value,
              countryCode: cc,
              region: opt,
              regionCode: '',
            });
            setInputValue(opt);
          }
          return;
        }
        onChange({
          ...value,
          countryCode: cc,
          region: opt.region || opt.name || '',
          regionCode: opt.regionCode || opt.code || '',
          city: '',
          mapboxId: opt.mapboxId || '',
          label: '',
          center: null,
        });
        setInputValue(opt.region || opt.name || '');
      }}
      slotProps={deliveryAutocompletePopperSlot(popperZIndex)}
      noOptionsText={
        inputValue.trim().length < 2
          ? 'Type at least 2 characters (e.g. Punjab)'
          : 'No provinces found — you can keep typing your own'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          sx={fieldSx(isMobile)}
          label="State / province"
          placeholder="Search province (e.g. Punjab)"
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
          inputProps={{ ...params.inputProps, autoComplete: 'address-level1' }}
          onFocus={(e) => {
            params.inputProps?.onFocus?.(e);
            if (options.length > 0 || loading) setMenuOpen(true);
          }}
          onBlur={(e) => {
            params.inputProps?.onBlur?.(e);
            setTimeout(() => setMenuOpen(false), 150);
          }}
        />
      )}
    />
  );
};

export default ShippingStateAutocomplete;
