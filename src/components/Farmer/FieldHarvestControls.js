import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import fieldsService from '../../services/fields';
import {
  getFieldHarvestOrders,
  harvestEligibilityMessage,
} from '../../utils/farmerOrderOccupancy';
import { areaDisplay } from '../../utils/fieldAreaDisplay';

const statusLabel = (s) => {
  const v = (s || 'growing').toLowerCase();
  if (v === 'harvested') return { text: 'Harvested', color: '#b45309', bg: '#fffbeb' };
  if (v === 'shipped') return { text: 'Shipped', color: '#1d4ed8', bg: '#eff6ff' };
  return { text: 'Growing', color: '#047857', bg: '#ecfdf5' };
};

const FieldHarvestControls = ({ field, farmerOrders = [], onFieldUpdated, prominent = false }) => {
  const [operationalStatus, setOperationalStatus] = useState(field?.operational_status || 'growing');
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [totalQty, setTotalQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [loadingAlloc, setLoadingAlloc] = useState(false);

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

  const loadAllocations = useCallback(async () => {
    if (!field?.id) return;
    setLoadingAlloc(true);
    try {
      const res = await fieldsService.getHarvestEvents(field.id);
      setAllocations(res.data?.allocations || []);
    } catch {
      setAllocations([]);
    } finally {
      setLoadingAlloc(false);
    }
  }, [field?.id]);

  useEffect(() => {
    if (operationalStatus === 'harvested' || operationalStatus === 'shipped') {
      loadAllocations();
    }
  }, [operationalStatus, loadAllocations]);

  const submitHarvest = async () => {
    setError(null);
    setBusy(true);
    try {
      await fieldsService.completeHarvest(field.id, {
        total_quantity: totalQty,
        unit,
        notes,
      });
      setOperationalStatus('harvested');
      setHarvestOpen(false);
      setTotalQty('');
      await loadAllocations();
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
          {loadingAlloc ? (
            <CircularProgress size={16} />
          ) : allocations.length > 0 ? (
            <Table size="small" sx={{ '& td, & th': { fontSize: '0.65rem', py: 0.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Renter</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Est.</TableCell>
                  <TableCell align="right">+/-</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allocations.slice(0, 5).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.buyer_name || 'Buyer'}</TableCell>
                    <TableCell align="right">{Number(a.actual_kg).toFixed(1)} kg</TableCell>
                    <TableCell align="right">{Number(a.estimated_kg).toFixed(1)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: Number(a.delta_kg) >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}
                    >
                      {Number(a.delta_kg) >= 0 ? '+' : ''}
                      {Number(a.delta_kg).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </div>
      )}

      <Dialog open={harvestOpen} onClose={() => !busy && setHarvestOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Total harvest for this field</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the total quantity harvested. It will be split across {activeOrdersOnField.length} active rental(s) by
            area ({areaDisplay(field).unit}). Renters see actual vs estimated (+/-).
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
          />
          <TextField fullWidth label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} margin="dense" />
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
            {busy ? 'Saving…' : 'Distribute harvest'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FieldHarvestControls;
