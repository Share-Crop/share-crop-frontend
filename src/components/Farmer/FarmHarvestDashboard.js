import React, { useMemo, useState, useEffect } from 'react';
import { Alert, AlertTitle } from '@mui/material';
import { ExpandMore, ChevronLeft, ChevronRight } from '@mui/icons-material';
import FarmerFieldStatusCard from './FarmerFieldStatusCard';
import { getFieldHarvestOrders } from '../../utils/farmerOrderOccupancy';
import { hasUpcomingHarvestOnRecord } from '../../utils/harvestProgress';

const FIELDS_PER_PAGE = 6;

function fieldNeedsAction(field, farmerOrders) {
  const status = (field.operational_status || 'growing').toLowerCase();
  const rentals = getFieldHarvestOrders(farmerOrders, field.id);
  const harvestPast = status === 'growing' && !hasUpcomingHarvestOnRecord(field);
  if (status === 'growing' && (rentals.length > 0 || harvestPast)) return 'harvest';
  if (status === 'harvested') return 'ship';
  if (status === 'shipped') return 'list';
  return null;
}

function FieldCardsGrid({ fields, farmerOrders, onFieldUpdated }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(fields.length / FIELDS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [fields.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageFields = useMemo(() => {
    const start = (page - 1) * FIELDS_PER_PAGE;
    return fields.slice(start, start + FIELDS_PER_PAGE);
  }, [fields, page]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pageFields.map((field) => (
          <FarmerFieldStatusCard
            key={field.id}
            compact
            field={field}
            farmerOrders={farmerOrders}
            onFieldUpdated={onFieldUpdated}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
          <span className="text-xs text-slate-500">
            {(page - 1) * FIELDS_PER_PAGE + 1}–{Math.min(page * FIELDS_PER_PAGE, fields.length)} of{' '}
            {fields.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft sx={{ fontSize: 18 }} />
            </button>
            <span className="min-w-[4.5rem] text-center text-xs font-semibold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Primary farmer UX: farms with clear field status cards + harvest / ship actions.
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
      .filter((x) => x.action === 'harvest' || x.action === 'ship');
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
      <Alert severity="info" sx={{ mb: 2, borderRadius: 2, py: 1 }}>
        <AlertTitle sx={{ mb: 0, fontSize: '0.9rem' }}>No fields yet</AlertTitle>
        Use <strong>Create & edit</strong> above to add a field.
      </Alert>
    );
  }

  return (
    <div className="mb-4 space-y-3">
      {actionFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
            {actionFields.length}
          </span>
          <span className="font-semibold">
            field{actionFields.length > 1 ? 's' : ''} need action
          </span>
          <span className="text-amber-800/80">— open a farm below</span>
        </div>
      )}

      {farmsWithFields.map(({ farm, fields: farmFields }) => {
        if (farmFields.length === 0) return null;
        const hasAction = farmFields.some((f) => {
          const a = fieldNeedsAction(f, farmerOrders);
          return a === 'harvest' || a === 'ship';
        });
        return (
          <details
            key={farm.id}
            open={hasAction || farmsWithFields.length === 1}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-slate-50 sm:px-4 [&::-webkit-details-marker]:hidden">
              <ExpandMore
                sx={{ fontSize: 20, color: '#64748b', transition: 'transform 0.2s' }}
                className="group-open:rotate-180"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-sm font-bold text-slate-900 sm:text-base">{farm.name}</div>
                  {hasAction ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">
                      Needs action
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {farm.location ? `${farm.location} · ` : ''}
                  {farmFields.length} field{farmFields.length !== 1 ? 's' : ''}
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
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[0.7rem] font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Details
                </button>
              )}
            </summary>

            <div className="border-t border-slate-100 bg-slate-50/60 p-3">
              <FieldCardsGrid
                fields={farmFields}
                farmerOrders={farmerOrders}
                onFieldUpdated={refreshFields}
              />
            </div>
          </details>
        );
      })}

      {orphanFields.length > 0 && (
        <details open className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-slate-800">
            Fields not linked to a farm ({orphanFields.length})
          </summary>
          <div className="border-t border-slate-100 bg-slate-50/60 p-3">
            <FieldCardsGrid
              fields={orphanFields}
              farmerOrders={farmerOrders}
              onFieldUpdated={refreshFields}
            />
          </div>
        </details>
      )}
    </div>
  );
}
