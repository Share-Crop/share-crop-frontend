import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { ISO2_COUNTRY_OPTIONS } from '../../data/isoCountryOptions';
import { findUsStateByCode, findUsStateByName } from '../../data/usStates';
import ShippingStateAutocomplete from './ShippingStateAutocomplete';
import ShippingCityAutocomplete from './ShippingCityAutocomplete';
import {
  searchMapboxAddressesWithFallback,
  mapboxFeatureToAddressSuggestion,
} from '../../utils/mapboxPlaces';
import { deliveryAutocompletePopperSlot } from './deliveryAutocompletePopper';

const fieldSx = (isMobile) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    borderRadius: isMobile ? '8px' : '8px',
    fontSize: '16px',
    minHeight: isMobile ? 48 : 48,
  },
  '& .MuiInputBase-input': {
    fontSize: '16px',
    lineHeight: 1.5,
    padding: '12px 14px !important',
  },
});


/**
 * Delivery address: Country → State → Address (with suggestions) → City / ZIP.
 */
const DeliveryAddressFields = ({
  value,
  onChange,
  isMobile = false,
  addressError = '',
  onFetchSuggestionsFilter,
  popperZIndex = 16000,
}) => {
  const [line1Options, setLine1Options] = useState([]);
  const [line1Loading, setLine1Loading] = useState(false);
  const [line1Open, setLine1Open] = useState(false);
  const [line1Hint, setLine1Hint] = useState('');
  const [selectedLine1, setSelectedLine1] = useState(null);
  const searchTimer = useRef(null);
  const searchSeq = useRef(0);

  const countryOption =
    ISO2_COUNTRY_OPTIONS.find((o) => o.code === value.countryCode)
    || ISO2_COUNTRY_OPTIONS.find(
      (o) => o.name.toLowerCase() === String(value.country || '').trim().toLowerCase()
    )
    || null;

  const geoRow = {
    countryCode: value.countryCode || countryOption?.code || '',
    region: value.state || '',
    regionCode: value.stateCode || '',
  };

  const resolveCountryFields = (place) => {
    const code = place.countryCode || '';
    const byCode = ISO2_COUNTRY_OPTIONS.find((o) => o.code === code);
    const byName = ISO2_COUNTRY_OPTIONS.find(
      (o) => o.name.toLowerCase() === String(place.country || '').trim().toLowerCase()
    );
    return {
      country: byCode?.name || byName?.name || place.country || '',
      countryCode: byCode?.code || byName?.code || code || '',
    };
  };

  const applySuggestion = useCallback(
    (place) => {
      if (!place || typeof place !== 'object') return;
      const us = findUsStateByCode(place.stateCode) || findUsStateByName(place.state);
      const countryFields = resolveCountryFields(place);
      onChange({
        ...value,
        line1: place.line1 || place.name || value.line1,
        city: place.city || '',
        state: us?.name || place.state || '',
        stateCode: us?.code || place.stateCode || '',
        zip: place.zip || '',
        ...countryFields,
      });
      setSelectedLine1(place);
      setLine1Options([]);
      setLine1Open(false);
      setLine1Hint('');
    },
    [onChange, value]
  );

  const runLine1Search = useCallback(
    (query) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const q = String(query || '').trim();
      if (q.length < 2) {
        setLine1Options([]);
        setLine1Loading(false);
        setLine1Hint('');
        return;
      }
      const seq = ++searchSeq.current;
      searchTimer.current = setTimeout(async () => {
        setLine1Loading(true);
        setLine1Hint('');
        try {
          let features = await searchMapboxAddressesWithFallback(q, {
            countryCode: geoRow.countryCode || undefined,
            limit: 10,
          });
          if (typeof onFetchSuggestionsFilter === 'function') {
            features = onFetchSuggestionsFilter(features) || [];
          }
          if (seq !== searchSeq.current) return;
          const mapped = features
            .map(mapboxFeatureToAddressSuggestion)
            .filter(Boolean)
            .filter(
              (item, idx, arr) =>
                arr.findIndex(
                  (x) =>
                    (x.mapboxId && item.mapboxId && x.mapboxId === item.mapboxId)
                    || x.formatted_address === item.formatted_address
                ) === idx
            );
          setLine1Options(mapped);
          if (mapped.length === 0) {
            setLine1Hint(
              geoRow.countryCode
                ? 'No matches in this country. Try the full place name (e.g. "NUST University Islamabad") or pick another country.'
                : 'No matches. Select country above, then type building, university, or street name.'
            );
          }
        } catch {
          if (seq === searchSeq.current) {
            setLine1Options([]);
            setLine1Hint('Address search failed. Check your connection and try again.');
          }
        } finally {
          if (seq === searchSeq.current) setLine1Loading(false);
        }
      }, 280);
    },
    [geoRow.countryCode, onFetchSuggestionsFilter]
  );

  useEffect(() => {
    const q = String(value.line1 || '').trim();
    if (q.length >= 2 && !selectedLine1) {
      runLine1Search(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only when country changes
  }, [geoRow.countryCode]);

  const setGeo = (patch) => {
    onChange({ ...value, ...patch });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 1.5 : 1.25,
        alignItems: 'stretch',
        '& > *': { flex: '0 0 auto' },
        '& .MuiAutocomplete-root': { flex: '0 0 auto', width: '100%' },
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 1.5 : 1.25 }}>
        <TextField
          label="Full name"
          size="small"
          fullWidth
          value={value.name}
          onChange={(e) => setGeo({ name: e.target.value })}
          sx={fieldSx(isMobile)}
          inputProps={{ autoComplete: 'name' }}
        />
        <TextField
          label="Phone"
          size="small"
          fullWidth
          value={value.phone}
          onChange={(e) => setGeo({ phone: e.target.value })}
          sx={fieldSx(isMobile)}
          inputProps={{ autoComplete: 'tel' }}
        />
      </Box>

      <Autocomplete
        options={ISO2_COUNTRY_OPTIONS}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        value={countryOption}
        onChange={(_, opt) => {
          setSelectedLine1(null);
          onChange({
            ...value,
            country: opt?.name || '',
            countryCode: opt?.code || '',
            state: '',
            stateCode: '',
            city: '',
            cityMapboxId: '',
            cityLabel: '',
          });
        }}
        slotProps={deliveryAutocompletePopperSlot(popperZIndex)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Country"
            size="small"
            sx={fieldSx(isMobile)}
            inputProps={{ ...params.inputProps, autoComplete: 'country-name' }}
          />
        )}
      />

      <ShippingStateAutocomplete
        countryCode={geoRow.countryCode}
        value={geoRow}
        isMobile={isMobile}
        popperZIndex={popperZIndex}
        onChange={(row) => {
          setSelectedLine1(null);
          onChange({
            ...value,
            state: row.region || '',
            stateCode: row.regionCode || '',
            city: '',
            cityMapboxId: '',
            cityLabel: '',
          });
        }}
      />

      <Box sx={{ position: 'relative', flex: '0 0 auto', width: '100%' }}>
        <Autocomplete
          fullWidth
          sx={{ width: '100%' }}
          freeSolo
          clearOnBlur={false}
          open={line1Open && (line1Loading || line1Options.length > 0)}
          onOpen={() => setLine1Open(true)}
          onClose={() => setLine1Open(false)}
          options={line1Options}
          loading={line1Loading}
          filterOptions={(x) => x}
          value={selectedLine1}
          inputValue={value.line1 || ''}
          isOptionEqualToValue={(a, b) =>
            Boolean(a && b && a.mapboxId && b.mapboxId && a.mapboxId === b.mapboxId)
          }
          getOptionLabel={(o) =>
            typeof o === 'string' ? o : (o?.formatted_address || o?.line1 || '')
          }
          onInputChange={(_, v, reason) => {
            if (reason === 'reset') {
              const typed = String(value.line1 || '').trim();
              if (typed && !String(v || '').trim()) return;
            }
            setGeo({ line1: v });
            setSelectedLine1(null);
            if (reason === 'input') {
              setLine1Open(true);
              runLine1Search(v);
            }
          }}
          onChange={(_, opt) => {
            if (opt && typeof opt === 'object') applySuggestion(opt);
          }}
          noOptionsText={line1Loading ? 'Searching…' : (line1Hint || 'Type a place or address (min. 2 characters)')}
          loadingText="Searching addresses…"
          slotProps={deliveryAutocompletePopperSlot(popperZIndex)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Address line 1"
              size="small"
              sx={fieldSx(isMobile)}
              placeholder="Building, university, street, or landmark"
              inputProps={{ ...params.inputProps, autoComplete: 'street-address' }}
              onFocus={(e) => {
                params.inputProps?.onFocus?.(e);
                if (line1Loading || line1Options.length > 0) setLine1Open(true);
              }}
              onBlur={(e) => {
                params.inputProps?.onBlur?.(e);
                setTimeout(() => setLine1Open(false), 150);
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.mapboxId || option.formatted_address}>
              <Box sx={{ py: 0.25, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, fontSize: '0.85rem', flex: 1, lineHeight: 1.35 }}
                  >
                    {option.name || option.line1}
                  </Typography>
                  {option.featureTypeLabel ? (
                    <Typography
                      variant="caption"
                      sx={{
                        flexShrink: 0,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: '#059669',
                        bgcolor: '#ecfdf5',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        lineHeight: 1.2,
                      }}
                    >
                      {option.featureTypeLabel}
                    </Typography>
                  ) : null}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {option.formatted_address
                    || [option.city, option.state, option.zip, option.country].filter(Boolean).join(', ')}
                </Typography>
              </Box>
            </li>
          )}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            mt: 0.5,
            display: 'block',
            minHeight: '1.25rem',
            visibility: line1Hint && !line1Loading && line1Options.length === 0 ? 'visible' : 'hidden',
          }}
        >
          {line1Hint || '\u00a0'}
        </Typography>
      </Box>

      <TextField
        label="Address line 2 (optional)"
        size="small"
        fullWidth
        value={value.line2}
        onChange={(e) => setGeo({ line2: e.target.value })}
        sx={fieldSx(isMobile)}
        inputProps={{ autoComplete: 'address-line2' }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 1.5 : 1.25 }}>
        <ShippingCityAutocomplete
          countryCode={geoRow.countryCode}
          regionCode={geoRow.regionCode}
          regionName={geoRow.region}
          value={{
            countryCode: geoRow.countryCode,
            city: value.city || '',
            region: value.state || '',
            regionCode: value.stateCode || '',
            mapboxId: value.cityMapboxId || '',
            label: value.cityLabel || value.city || '',
            center: null,
          }}
          onChange={(row) => {
            onChange({
              ...value,
              city: row.city || '',
              cityMapboxId: row.mapboxId || '',
              cityLabel: row.label || '',
              // Keep existing state unless the city pick includes a clearer region.
              state: row.region || value.state || '',
              stateCode: row.regionCode || value.stateCode || '',
            });
          }}
          isMobile={isMobile}
          size="small"
          label="City"
          optional={false}
          freeSolo
          showSelectedCaption={false}
          popperZIndex={popperZIndex}
          placeholder={
            !geoRow.countryCode
              ? 'Select country first'
              : String(geoRow.countryCode).toUpperCase() === 'US' && !geoRow.regionCode && !geoRow.region
                ? 'Select state first'
                : 'Type to search cities'
          }
        />
        <TextField
          label="ZIP / postal code"
          size="small"
          fullWidth
          value={value.zip}
          onChange={(e) => setGeo({ zip: e.target.value })}
          sx={fieldSx(isMobile)}
          inputProps={{ autoComplete: 'postal-code' }}
        />
      </Box>

      {addressError ? (
        <Box sx={{ color: '#ef4444', fontSize: isMobile ? 11 : 12, fontWeight: 600 }}>{addressError}</Box>
      ) : null}
    </Box>
  );
};

export default DeliveryAddressFields;
