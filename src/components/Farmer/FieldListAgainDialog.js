import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import fieldsService from '../../services/fields';
import { formatTotalProductionWithUnit, productionUnitLabel } from '../../utils/fieldProductionUnits';
import {
  buildShippingDestinationsFromUi,
  deriveShippingScopeEnum,
  emptyShippingCityRow,
  normalizeShippingDestinations,
  shippingDestinationsSummary,
} from '../../utils/shippingDestinations';
import { ISO2_COUNTRY_OPTIONS } from '../../data/isoCountryOptions';
import ShippingCityAutocomplete from '../Forms/ShippingCityAutocomplete';
import ShippingStateAutocomplete from '../Forms/ShippingStateAutocomplete';

function toNum(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function todayYmdLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hydrateShippingFromField(src) {
  const sd = normalizeShippingDestinations(
    src?.shipping_destinations ?? src?.shippingDestinations
  );
  const countryCodes = [];
  const seenCode = new Set();
  for (const item of sd) {
    if (item.type === 'country' && item.countryCode && !seenCode.has(item.countryCode)) {
      seenCode.add(item.countryCode);
      countryCodes.push(item.countryCode);
    }
  }
  const cityRows = sd
    .filter(
      (item) =>
        (item.type === 'city' && item.countryCode && item.city) ||
        (item.type === 'region' && item.countryCode && (item.region || item.regionCode))
    )
    .map((item) => ({
      countryCode: item.countryCode,
      city: item.type === 'city' ? item.city : '',
      region: item.region || '',
      regionCode: item.regionCode || '',
      mapboxId: item.type === 'city' ? item.mapboxId || '' : '',
      label:
        item.label ||
        (item.type === 'region'
          ? item.region || item.regionCode || ''
          : item.region
            ? `${item.city}, ${item.region}`
            : item.city),
      center: item.type === 'city' ? item.center || null : null,
    }));

  const scopeRaw = String((src?.shipping_scope ?? src?.shippingScope) || 'Global').trim();
  const shippingScope = ['City', 'Country', 'Global'].includes(scopeRaw) ? scopeRaw : 'Global';
  const shippingOption = String((src?.shipping_option ?? src?.shippingOption) || 'Both').trim() || 'Both';

  return {
    shippingCountryCodes: countryCodes,
    shippingCityRows: cityRows.length > 0 ? cityRows : [emptyShippingCityRow()],
    useSpecificDeliveryList: sd.length > 0,
    shippingScope,
    shippingOption,
  };
}

/**
 * Put a harvested/shipped field back on the map for a new season.
 * Editable: harvest date, production, price, % sell, shipping destinations/modes.
 */
export default function FieldListAgainDialog({
  open,
  onClose,
  field,
  lastSeasonYield,
  lastSeasonUnit,
  onListed,
}) {
  const unit = productionUnitLabel(
    lastSeasonUnit || field?.totalProductionUnit || field?.total_production_unit || 'kg'
  );
  const lastActual = toNum(lastSeasonYield ?? field?.last_season_yield);
  const priorExpected = toNum(field?.totalProduction ?? field?.total_production);

  const [harvestDate, setHarvestDate] = useState(todayYmdLocal());
  const [totalProduction, setTotalProduction] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [sellPercent, setSellPercent] = useState('80');
  const [shippingScope, setShippingScope] = useState('Global');
  const [shippingOption, setShippingOption] = useState('Both');
  const [useSpecificDeliveryList, setUseSpecificDeliveryList] = useState(false);
  const [shippingCountryCodes, setShippingCountryCodes] = useState([]);
  const [shippingCityRows, setShippingCityRows] = useState([emptyShippingCityRow()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingField, setLoadingField] = useState(false);

  const shippingDestinationsDraft = useMemo(
    () => buildShippingDestinationsFromUi(shippingCountryCodes, shippingCityRows),
    [shippingCountryCodes, shippingCityRows]
  );
  const hasDestinationRules = shippingDestinationsDraft.length > 0;

  useEffect(() => {
    if (!open || !field?.id) return;
    let cancelled = false;

    const apply = (src) => {
      setError(null);
      setHarvestDate(todayYmdLocal());
      const prefProd = lastActual != null && lastActual > 0 ? lastActual : priorExpected;
      setTotalProduction(prefProd != null ? String(prefProd) : '');
      setSellingPrice(src.price != null && src.price !== '' ? String(src.price) : '');
      const pct = toNum(src.quantity_sell_percent ?? src.quantitySellPercent ?? src.sellingAmount);
      setSellPercent(pct != null ? String(pct) : '80');
      const ship = hydrateShippingFromField(src);
      setShippingCountryCodes(ship.shippingCountryCodes);
      setShippingCityRows(ship.shippingCityRows);
      setUseSpecificDeliveryList(ship.useSpecificDeliveryList);
      setShippingScope(ship.shippingScope);
      setShippingOption(ship.shippingOption);
    };

    apply(field);
    setLoadingField(true);
    fieldsService
      .getById(field.id)
      .then((res) => {
        if (cancelled || !res?.data) return;
        apply({ ...field, ...res.data });
      })
      .catch(() => {
        /* keep hydrated from list row */
      })
      .finally(() => {
        if (!cancelled) setLoadingField(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, field, lastActual, priorExpected]);

  const lastSeasonText = useMemo(() => {
    if (lastActual == null) return null;
    return formatTotalProductionWithUnit(
      lastActual,
      lastSeasonUnit || field?.total_production_unit || unit
    );
  }, [lastActual, lastSeasonUnit, field, unit]);

  const submit = async () => {
    setError(null);
    if (!harvestDate) {
      setError('Choose the next harvest date.');
      return;
    }
    if (!(toNum(totalProduction) > 0)) {
      setError('Enter expected total production for this season.');
      return;
    }
    if (toNum(sellingPrice) == null || toNum(sellingPrice) < 0) {
      setError('Enter your app selling price.');
      return;
    }
    const pct = toNum(sellPercent);
    if (pct == null || pct <= 0 || pct > 100) {
      setError('Percent to sell must be between 1 and 100.');
      return;
    }
    if (useSpecificDeliveryList && !hasDestinationRules) {
      setError('Add at least one country or place you deliver to, or switch back to a simple rule.');
      return;
    }

    const shippingDestinationsForApi = useSpecificDeliveryList
      ? shippingDestinationsDraft
      : [];
    const shippingScopeForApi = deriveShippingScopeEnum(
      shippingDestinationsForApi,
      shippingScope
    );

    setBusy(true);
    try {
      const res = await fieldsService.listAgain(field.id, {
        harvest_dates: [{ date: harvestDate, label: '' }],
        total_production: totalProduction,
        total_production_unit: field?.totalProductionUnit || field?.total_production_unit || unit,
        price: sellingPrice,
        quantity_sell_percent: pct,
        shipping_destinations: shippingDestinationsForApi,
        shipping_scope: shippingScopeForApi,
        shipping_option: shippingOption,
        shipping_pickup: shippingOption !== 'Shipping',
        shipping_delivery: shippingOption !== 'Pickup',
      });
      if (onListed) onListed(res.data?.field || res.data);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not list field again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>List field again</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Put <strong>{field?.productName || field?.name || 'this field'}</strong> back on the map for a
          new season. Update harvest details and delivery areas if they changed.
        </Typography>

        {lastSeasonText ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Last season actual yield: <strong>{lastSeasonText}</strong>
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No recorded harvest total yet — enter expected production for this season.
          </Alert>
        )}

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {loadingField ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Loading current delivery settings…
          </Typography>
        ) : null}

        <TextField
          fullWidth
          margin="dense"
          type="date"
          label="Next harvest date"
          value={harvestDate}
          onChange={(e) => setHarvestDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: todayYmdLocal() }}
          required
        />
        <TextField
          fullWidth
          margin="dense"
          type="number"
          label="Expected total production"
          value={totalProduction}
          onChange={(e) => setTotalProduction(e.target.value)}
          required
          inputProps={{ min: 0, step: 'any' }}
          InputProps={{
            endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
          }}
          helperText={
            lastSeasonText
              ? `Prefills from last season actual (${lastSeasonText}). Change if this season will differ.`
              : 'Amount you expect for one harvest this season'
          }
        />
        <TextField
          fullWidth
          margin="dense"
          type="number"
          label="App selling price"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
          required
          inputProps={{ min: 0, step: 'any' }}
          InputProps={{
            endAdornment: <InputAdornment position="end">{`USD / ${unit}`}</InputAdornment>,
          }}
        />
        <TextField
          fullWidth
          margin="dense"
          type="number"
          label="% of harvest to sell"
          value={sellPercent}
          onChange={(e) => setSellPercent(e.target.value)}
          required
          inputProps={{ min: 1, max: 100, step: 'any' }}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />

        <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1, fontWeight: 700 }}>
          Delivery / shipping
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Change where buyers can receive this crop — add new cities or countries for this season.
        </Typography>

        <RadioGroup
          row
          value={shippingOption}
          onChange={(e) => setShippingOption(e.target.value)}
          sx={{ mb: 1.5 }}
        >
          <FormControlLabel value="Both" control={<Radio size="small" />} label="Pickup & delivery" />
          <FormControlLabel value="Pickup" control={<Radio size="small" />} label="Pickup only" />
          <FormControlLabel value="Shipping" control={<Radio size="small" />} label="Delivery only" />
        </RadioGroup>

        {shippingOption !== 'Pickup' ? (
          !useSpecificDeliveryList ? (
            <Box sx={{ mb: 1 }}>
              <RadioGroup
                value={shippingScope}
                onChange={(e) => setShippingScope(e.target.value)}
              >
                <FormControlLabel value="Global" control={<Radio size="small" />} label="Worldwide" />
                <FormControlLabel value="Country" control={<Radio size="small" />} label="My country only" />
                <FormControlLabel value="City" control={<Radio size="small" />} label="My city only" />
              </RadioGroup>
              <Button
                variant="text"
                size="small"
                onClick={() => setUseSpecificDeliveryList(true)}
                sx={{ textTransform: 'none', px: 0, mt: 0.5 }}
              >
                I deliver to a custom list of countries or cities…
              </Button>
            </Box>
          ) : (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {!hasDestinationRules ? (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setUseSpecificDeliveryList(false)}
                    sx={{ textTransform: 'none', px: 0 }}
                  >
                    ← Back to simple rule
                  </Button>
                ) : (
                  <Button
                    variant="text"
                    size="small"
                    color="secondary"
                    onClick={() => {
                      setShippingCountryCodes([]);
                      setShippingCityRows([emptyShippingCityRow()]);
                      setUseSpecificDeliveryList(false);
                    }}
                    sx={{ textTransform: 'none', px: 0 }}
                  >
                    Clear list & use simple rule
                  </Button>
                )}
              </Box>

              <Autocomplete
                multiple
                disableCloseOnSelect
                options={ISO2_COUNTRY_OPTIONS}
                getOptionLabel={(o) => `${o.name} (${o.code})`}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                value={ISO2_COUNTRY_OPTIONS.filter((o) => shippingCountryCodes.includes(o.code))}
                onChange={(_, newVal) => setShippingCountryCodes(newVal.map((o) => o.code))}
                sx={{ width: '100%', mb: 2 }}
                slotProps={{ popper: { sx: { zIndex: 15000 } } }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.code}
                      label={option.name}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Whole countries you deliver to" placeholder="Type to search" />
                )}
              />

              <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
                Or specific places — country, then state/province (city optional):
              </Typography>
              {(shippingCityRows || []).map((row, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr auto' },
                    gap: 1,
                    mb: 1.5,
                    alignItems: 'start',
                  }}
                >
                  <Autocomplete
                    options={ISO2_COUNTRY_OPTIONS}
                    getOptionLabel={(o) => `${o.name} (${o.code})`}
                    isOptionEqualToValue={(a, b) => a.code === b.code}
                    value={ISO2_COUNTRY_OPTIONS.find((o) => o.code === row.countryCode) || null}
                    onChange={(_, v) => {
                      setShippingCityRows((prev) => {
                        const next = [...prev];
                        next[index] = {
                          ...emptyShippingCityRow(),
                          countryCode: v?.code || '',
                        };
                        return next;
                      });
                    }}
                    slotProps={{ popper: { sx: { zIndex: 15000 } } }}
                    renderInput={(params) => (
                      <TextField {...params} label="Country" size="small" />
                    )}
                  />
                  <ShippingStateAutocomplete
                    countryCode={row.countryCode}
                    value={row}
                    isMobile={false}
                    onChange={(nextRow) => {
                      setShippingCityRows((prev) => {
                        const next = [...prev];
                        next[index] = nextRow;
                        return next;
                      });
                    }}
                  />
                  <ShippingCityAutocomplete
                    countryCode={row.countryCode}
                    regionCode={row.regionCode}
                    regionName={row.region}
                    value={row}
                    isMobile={false}
                    onChange={(nextRow) => {
                      setShippingCityRows((prev) => {
                        const next = [...prev];
                        next[index] = nextRow;
                        return next;
                      });
                    }}
                  />
                  {shippingCityRows.length > 1 ? (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() =>
                        setShippingCityRows((prev) =>
                          prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
                        )
                      }
                      aria-label="Remove place"
                    >
                      <Remove fontSize="small" />
                    </IconButton>
                  ) : (
                    <span />
                  )}
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => setShippingCityRows((prev) => [...prev, emptyShippingCityRow()])}
                sx={{ textTransform: 'none', mb: 1 }}
              >
                Add another place
              </Button>
              {hasDestinationRules ? (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Delivering to: {shippingDestinationsSummary(shippingDestinationsDraft)}
                </Alert>
              ) : null}
            </Box>
          )
        ) : (
          <Typography variant="caption" color="text.secondary">
            Pickup only — buyers collect from the farm; no delivery regions needed.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="success" onClick={submit} disabled={busy || loadingField}>
          {busy ? 'Listing…' : 'List again on map'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
