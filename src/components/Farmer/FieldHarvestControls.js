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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import fieldsService from '../../services/fields';
import {
  getFieldHarvestOrders,
  harvestEligibilityMessage,
} from '../../utils/farmerOrderOccupancy';
import { formatTotalProductionWithUnit, productionUnitLabel } from '../../utils/fieldProductionUnits';

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

const FieldHarvestControls = ({ field, farmerOrders = [], onFieldUpdated, prominent = false }) => {
  const [operationalStatus, setOperationalStatus] = useState(field?.operational_status || 'growing');
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [totalQty, setTotalQty] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState([]);
  const [loadingHarvest, setLoadingHarvest] = useState(false);

  // Locked to field setup unit (not editable in harvest dialog).
  const harvestUnit = useMemo(
    () => productionUnitLabel(field?.totalProductionUnit || field?.total_production_unit || 'kg'),
    [field?.totalProductionUnit, field?.total_production_unit]
  );

  useEffect(() => {
    setOperationalStatus(field?.operational_status || 'growing');
  }, [field?.operational_status, field?.id]);

  const activeOrdersOnField = getFieldHarvestOrders(farmerOrders, field.id);

  const eligibility = harvestEligibilityMessage(
    farmerOrders,
    field.id,
    field.totalAreaM2 ?? field.total_area,
    field.available_area ?? field.availableAreaM2
  );

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
        {!prominent && (
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
          style={{ color: badge.color, backgroundColor: badge.bg }}
        >
          Field: {badge.text}
        </span>
        )}
        {operationalStatus === 'growing' && (
          <Button
            size={prominent ? 'medium' : 'small'}
            variant="contained"
            color="warning"
            disabled={busy || activeOrdersOnField.length === 0}
            onClick={() => {
              setError(null);
              setHarvestOpen(true);
            }}
            sx={btnSx}
          >
            {prominent ? 'Mark field harvested (enter total kg)' : 'Mark harvested'}
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
            {prominent ? 'Mark field as shipped' : 'Mark shipped'}
          </Button>
        )}
      </div>

      {operationalStatus === 'growing' && activeOrdersOnField.length === 0 && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
          {eligibility.text}
        </Typography>
      )}

      {(operationalStatus === 'harvested' || operationalStatus === 'shipped') && (
        <div className="mt-1">
          {loadingHarvest ? (
            <CircularProgress size={16} />
          ) : comparison.declared || comparison.estimated != null ? (
            <Table size="small" sx={{ '& td, & th': { fontSize: '0.7rem', py: 0.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Field harvest</TableCell>
                  <TableCell align="right">Est.</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">+/-</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Whole field</TableCell>
                  <TableCell align="right">
                    {comparison.estimatedText || '—'}
                  </TableCell>
                  <TableCell align="right">
                    {comparison.actualText || '—'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        comparison.delta == null
                          ? 'inherit'
                          : comparison.delta >= 0
                            ? '#059669'
                            : '#dc2626',
                      fontWeight: 600,
                    }}
                  >
                    {comparison.delta == null
                      ? '—'
                      : `${comparison.delta >= 0 ? '+' : ''}${Number(comparison.delta).toFixed(1)} ${comparison.unit}`}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
    </div>
  );
};

export default FieldHarvestControls;
