import React, { useMemo } from 'react';
import { Alert, AlertTitle, Typography } from '@mui/material';
import { Agriculture, LocalShipping, ExpandMore } from '@mui/icons-material';
import FieldHarvestControls from './FieldHarvestControls';
import {
  getFieldHarvestOrders,
} from '../../utils/farmerOrderOccupancy';

function activeRentalsOnField(fieldId, farmerOrders) {
  return getFieldHarvestOrders(farmerOrders, fieldId);
}

function fieldNeedsAction(field, farmerOrders) {
  const status = (field.operational_status || 'growing').toLowerCase();
  const rentals = activeRentalsOnField(field.id, farmerOrders);
  if (status === 'growing' && rentals.length > 0) return 'harvest';
  if (status === 'harvested') return 'ship';
  return null;
}

const statusChip = (status) => {
  const v = (status || 'growing').toLowerCase();
  if (v === 'harvested') return { label: 'Harvested', cls: 'bg-amber-100 text-amber-800' };
  if (v === 'shipped') return { label: 'Shipped', cls: 'bg-blue-100 text-blue-800' };
  return { label: 'Growing', cls: 'bg-emerald-100 text-emerald-800' };
};

/**
 * Primary farmer UX: farms with fields visible inline + harvest / ship actions (no buried modal).
 */
export default function FarmHarvestDashboard({
  farms = [],
  fields = [],
  farmerOrders = [],
  onRefresh,
  onOpenFarmDetail,
}) {
  const fieldsByFarmId = useMemo(() => {
    const map = new Map();
    fields.forEach((f) => {
      const fid = f.farm_id;
      if (!fid) return;
      const list = map.get(String(fid)) || [];
      list.push(f);
      map.set(String(fid), list);
    });
    return map;
  }, [fields]);

  const orphanFields = useMemo(
    () => fields.filter((f) => !f.farm_id),
    [fields]
  );

  const actionFields = useMemo(() => {
    return fields
      .map((f) => ({ field: f, action: fieldNeedsAction(f, farmerOrders) }))
      .filter((x) => x.action);
  }, [fields, farmerOrders]);

  const farmsWithFields = useMemo(() => {
    return farms.map((farm) => ({
      farm,
      fields: fieldsByFarmId.get(String(farm.id)) || [],
    }));
  }, [farms, fieldsByFarmId]);

  const refreshFields = async () => {
    if (onRefresh) await onRefresh();
  };

  if (fields.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        <AlertTitle>No fields yet</AlertTitle>
        Switch to <strong>Create & edit fields</strong> to add a field, then come back here to manage harvest.
      </Alert>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#065f46', mb: 0.5 }}>
          Harvest & ship — quick guide
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0 }}>
          1) When crop is ready → <strong>Mark harvested</strong> and enter total kg for that field.
          <br />
          2) When you send product → <strong>Mark shipped</strong>. Renters see their share on the map.
        </Typography>
      </div>

      {actionFields.length > 0 && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>
            {actionFields.length} field{actionFields.length > 1 ? 's' : ''} need your action
          </AlertTitle>
          Scroll to the field below — buttons are on each field row (no need to open View details).
        </Alert>
      )}

      {farmsWithFields.map(({ farm, fields: farmFields }) => {
        if (farmFields.length === 0) return null;
        const hasAction = farmFields.some((f) => fieldNeedsAction(f, farmerOrders));
        return (
          <details
            key={farm.id}
            open={hasAction || farmsWithFields.length === 1}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <ExpandMore
                sx={{ fontSize: 22, color: '#64748b', transition: 'transform 0.2s' }}
                className="group-open:rotate-180"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-slate-900">{farm.name}</div>
                <div className="text-xs text-slate-500">
                  {farm.location} · {farmFields.length} field{farmFields.length !== 1 ? 's' : ''}
                </div>
              </div>
              {onOpenFarmDetail && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenFarmDetail(farm);
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[0.65rem] font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Farm info
                </button>
              )}
            </summary>

            <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-3">
              {farmFields.map((field) => {
                const chip = statusChip(field.operational_status);
                const rentals = activeRentalsOnField(field.id, farmerOrders);
                const need = fieldNeedsAction(field, farmerOrders);
                return (
                  <div
                    key={field.id}
                    className={`rounded-xl border bg-white p-3 shadow-sm ${
                      need ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{field.name}</div>
                        <div className="text-xs text-slate-500">
                          {field.cropType || 'Crop'} · {Math.round(field.totalAreaM2 || 0).toLocaleString()} m²
                          {rentals.length > 0 && (
                            <span className="ml-2 font-medium text-emerald-700">
                              · {rentals.length} active rental{rentals.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${chip.cls}`}>
                        {chip.label}
                      </span>
                    </div>

                    {need === 'harvest' && (
                      <div className="mb-2 flex items-center gap-1 text-xs font-medium text-amber-800">
                        <Agriculture sx={{ fontSize: 16 }} />
                        Ready to harvest — enter total kg below
                      </div>
                    )}
                    {need === 'ship' && (
                      <div className="mb-2 flex items-center gap-1 text-xs font-medium text-blue-800">
                        <LocalShipping sx={{ fontSize: 16 }} />
                        Harvest recorded — mark as shipped when sent
                      </div>
                    )}

                    <FieldHarvestControls
                      prominent
                      field={field}
                      farmerOrders={farmerOrders}
                      onFieldUpdated={refreshFields}
                    />
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      {orphanFields.length > 0 && (
        <details open className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
            Fields not linked to a farm ({orphanFields.length})
          </summary>
          <div className="space-y-3 border-t border-slate-100 p-3">
            {orphanFields.map((field) => (
              <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold">{field.name}</div>
                <FieldHarvestControls
                  prominent
                  field={field}
                  farmerOrders={farmerOrders}
                  onFieldUpdated={refreshFields}
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
