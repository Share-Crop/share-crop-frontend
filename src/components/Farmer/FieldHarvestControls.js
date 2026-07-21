import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Typography,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import fieldsService from '../../services/fields';
import {
  getFieldHarvestOrders,
  harvestEligibilityMessage,
} from '../../utils/farmerOrderOccupancy';
import { formatTotalProductionWithUnit, productionUnitLabel } from '../../utils/fieldProductionUnits';
import FieldListAgainDialog from './FieldListAgainDialog';
import RelistedFieldBadge from './RelistedFieldBadge';

const statusLabel = (s) => {
  const v = (s || 'growing').toLowerCase();
  if (v === 'harvested') return { text: 'Harvested', color: '#b45309', bg: '#fffbeb' };
  if (v === 'shipped') return { text: 'Shipped', color: '#1d4ed8', bg: '#eff6ff' };
  return { text: 'Growing', color: '#047857', bg: '#ecfdf5' };
};

function toNum(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Whole-field Est vs Actual (My Farms):
 * - estimated = field setup total_production
 * - actual    = harvest quantity farmer entered
 */
function getFieldHarvestComparison(field, events) {
  const estimated = toNum(field?.totalProduction ?? field?.total_production);
  const latest = Array.isArray(events) && events.length ? events[0] : null;
  const actual = latest ? toNum(latest.total_quantity) : null;
  const unitRaw =
    latest?.unit ||
    field?.totalProductionUnit ||
    field?.total_production_unit ||
    'kg';
  const unit = productionUnitLabel(unitRaw);
  const declared = actual != null && actual > 0;
  const delta =
    declared && estimated != null ? actual - estimated : null;

  return {
    estimated,
    actual,
    delta,
    declared,
    unit,
    estimatedText:
      estimated != null ? formatTotalProductionWithUnit(estimated, unitRaw) : null,
    actualText:
      declared ? formatTotalProductionWithUnit(actual, unitRaw) : null,
  };
}

const FieldHarvestControls = ({
  field,
  farmerOrders = [],
  onFieldUpdated,
  prominent = false,
  hideStatusBadge = false,
}) => {
  const [operationalStatus, setOperationalStatus] = useState(field?.operational_status || 'growing');
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [totalQty, setTotalQty] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingHarvest, setLoadingHarvest] = useState(false);
  const [listAgainOpen, setListAgainOpen] = useState(false);

  // Locked to field setup unit (not editable in harvest dialog).
  const harvestUnit = useMemo(
    () => productionUnitLabel(field?.totalProductionUnit || field?.total_production_unit || 'kg'),
    [field?.totalProductionUnit, field?.total_production_unit]
  );

  useEffect(() => {
    setOperationalStatus(field?.operational_status || 'growing');
  }, [field?.operational_status, field?.id]);

  const activeOrdersOnField = getFieldHarvestOrders(farmerOrders, field.id);

  const eligibility = harvestEligibilityMessage(farmerOrders, field.id);

  const loadHarvestSummary = useCallback(async () => {
    if (!field?.id) return;
    setLoadingHarvest(true);
    try {
      const res = await fieldsService.getHarvestEvents(field.id);
      setEvents(res.data?.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoadingHarvest(false);
    }
  }, [field?.id]);

  useEffect(() => {
    if (operationalStatus === 'harvested' || operationalStatus === 'shipped') {
      loadHarvestSummary();
    }
  }, [operationalStatus, loadHarvestSummary]);

  const comparison = useMemo(
    () => getFieldHarvestComparison(field, events),
    [field, events]
  );

  const submitHarvest = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fieldsService.completeHarvest(field.id, {
        total_quantity: totalQty,
        unit: harvestUnit,
        notes,
      });
      setOperationalStatus('harvested');
      setHarvestOpen(false);
      setTotalQty('');
      if (res.data?.event) {
        setEvents([res.data.event, ...(res.data?.events || [])].filter(Boolean));
      } else {
        await loadHarvestSummary();
      }
      if (onFieldUpdated) onFieldUpdated();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not record harvest');
    } finally {
      setBusy(false);
    }
  };

  const submitShipped = async () => {
    setError(null);
    setBusy(true);
    try {
      await fieldsService.markShipped(field.id);
      setOperationalStatus('shipped');
      if (onFieldUpdated) onFieldUpdated();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not mark as shipped');
    } finally {
      setBusy(false);
    }
  };

  if (!field?.id) return null;

  const badge = statusLabel(operationalStatus);

  const btnSx = prominent
    ? { fontSize: '0.8rem', py: 0.75, px: 2, textTransform: 'none', fontWeight: 600 }
    : { fontSize: '0.65rem', py: 0.25, textTransform: 'none' };

  const fieldEstPreview = toNum(field?.totalProduction ?? field?.total_production);

  return (
    <div className={prominent ? 'mt-1' : 'mt-2 border-t border-slate-100 pt-2'}>
      <div className={`mb-2 flex flex-wrap items-center gap-2 ${prominent ? 'justify-start' : ''}`}>
        {!prominent && !hideStatusBadge && (
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
          style={{ color: badge.color, backgroundColor: badge.bg }}
        >
          {badge.text}
        </span>
        )}
        {!hideStatusBadge && (
          <RelistedFieldBadge field={{ ...field, operational_status: operationalStatus }} />
        )}
        {operationalStatus === 'growing' && (
          <Button
            size={prominent ? 'medium' : 'small'}
            variant="contained"
            color="warning"
            disabled={busy}
            onClick={() => {
              setError(null);
              setHarvestOpen(true);
            }}
            sx={btnSx}
          >
            Mark harvested
          </Button>
        )}
        {operationalStatus === 'harvested' && (
          <Button
            size={prominent ? 'medium' : 'small'}
            variant="contained"
            color="primary"
            disabled={busy}
            onClick={submitShipped}
            sx={btnSx}
          >
            {prominent ? 'Mark shipped' : 'Mark shipped'}
          </Button>
        )}
        {(operationalStatus === 'harvested' || operationalStatus === 'shipped') && (
          <Button
            size={prominent ? 'medium' : 'small'}
            variant="outlined"
            color="success"
            disabled={busy}
            onClick={() => setListAgainOpen(true)}
            sx={btnSx}
          >
            {prominent ? 'List again on map' : 'List again'}
          </Button>
        )}
      </div>

      {operationalStatus === 'growing' && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
          {eligibility.text}
        </Typography>
      )}

      {(operationalStatus === 'harvested' || operationalStatus === 'shipped') && (
        <div className="mt-1">
          {loadingHarvest ? (
            <CircularProgress size={16} />
          ) : comparison.declared || comparison.estimated != null ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div className="mb-1 font-semibold text-slate-800">This season harvest</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Expected: <strong>{comparison.estimatedText || '—'}</strong></span>
                <span>Actual: <strong>{comparison.actualText || '—'}</strong></span>
                {comparison.delta != null ? (
                  <span style={{ color: comparison.delta >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {comparison.delta >= 0 ? '+' : ''}
                    {Number(comparison.delta).toFixed(1)} {comparison.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={harvestOpen} onClose={() => !busy && setHarvestOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Total harvest for this field</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Enter the <strong>total</strong> quantity harvested from this whole field
            {fieldEstPreview != null ? (
              <>
                . Setup estimate is{' '}
                <strong>
                  {formatTotalProductionWithUnit(
                    fieldEstPreview,
                    field?.totalProductionUnit || field?.total_production_unit || harvestUnit
                  )}
                </strong>
              </>
            ) : null}
            .
            {activeOrdersOnField.length > 0
              ? ' Active buyers will get their share by rented area.'
              : ' No active buyers — this records your total only (nothing to distribute).'}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Total harvested"
            type="number"
            value={totalQty}
            onChange={(e) => setTotalQty(e.target.value)}
            margin="dense"
            required
            inputProps={{ min: 0, step: 'any' }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">{harvestUnit}</InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            margin="dense"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHarvestOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitHarvest} disabled={busy}>
            {busy ? 'Saving…' : 'Save harvest'}
          </Button>
        </DialogActions>
      </Dialog>

      <FieldListAgainDialog
        open={listAgainOpen}
        onClose={() => setListAgainOpen(false)}
        field={field}
        lastSeasonYield={comparison.actual ?? field?.last_season_yield}
        lastSeasonUnit={
          events[0]?.unit || field?.last_season_yield_unit || field?.total_production_unit
        }
        onListed={(updated) => {
          setOperationalStatus(updated?.operational_status || 'growing');
          if (onFieldUpdated) onFieldUpdated(updated);
        }}
      />
    </div>
  );
};

export default FieldHarvestControls;
