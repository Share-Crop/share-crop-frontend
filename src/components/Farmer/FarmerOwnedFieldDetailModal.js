import React from 'react';
import {
  LocationOn,
  Agriculture,
  CalendarToday,
  Close,
  Edit as EditIcon,
} from '@mui/icons-material';
import HarvestProgressBar from '../Common/HarvestProgressBar';
import {
  formatTotalProductionWithUnit,
  displayProductionRateUnit,
} from '../../utils/fieldProductionUnits';
import { formatHarvestDate } from '../../utils/harvestProgress';

/**
 * Same Tailwind detail overlay as Rented Fields (owned field path), with Edit field in the footer.
 */
export default function FarmerOwnedFieldDetailModal({
  open,
  selectedField,
  onClose,
  userCurrency,
  currencySymbols,
  onEditField,
}) {
  if (!open || !selectedField) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/40"
      style={{
        alignItems: 'flex-start',
        paddingTop: 'calc(var(--app-header-height, 64px) + 12px)',
      }}
    >
      <div className="max-h-[calc(90vh-var(--app-header-height,64px))] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl md:p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {selectedField.name || selectedField.farmName}
            </h2>
            <p className="text-xs text-slate-500">
              My field details
            </p>
            {selectedField.status && (
              <span
                className="mt-2 inline-flex items-center rounded-full px-2 py-1 text-[0.7rem] font-semibold"
                style={{
                  backgroundColor:
                    selectedField.status === 'Active'
                      ? '#22c55e'
                      : selectedField.status === 'Pending'
                      ? '#facc15'
                      : '#e5e7eb',
                  color:
                    selectedField.status === 'Active'
                      ? '#ffffff'
                      : '#374151',
                }}
              >
                {selectedField.status}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <Close sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Field Information
            </h3>
            <div className="space-y-2 text-slate-700">
              <div className="flex items-start gap-1.5">
                <LocationOn sx={{ fontSize: 18, color: '#3b82f6' }} />
                <div>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                    Location
                  </div>
                  <div>{selectedField.location}</div>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <Agriculture sx={{ fontSize: 18, color: '#10b981' }} />
                <div>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                    Crop Type
                  </div>
                  <div>{selectedField.cropType}</div>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <CalendarToday sx={{ fontSize: 18, color: '#f59e0b' }} />
                <div>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                    Harvest Date
                  </div>
                  <div>
                    {(() => {
                      const items = Array.isArray(selectedField.selected_harvests) ? selectedField.selected_harvests : [];
                      const format = (date) => {
                        if (!date) return '';
                        if (typeof date === 'string' && /\d{1,2}\s\w{3}\s\d{4}/.test(date)) return date;
                        return formatHarvestDate(date);
                      };
                      if (items.length) {
                        const mapped = items.map((it) => {
                          const dt = format(it.date);
                          if (it.label && dt) return `${dt} (${it.label})`;
                          if (dt) return dt;
                          if (it.label) return it.label;
                          return '';
                        }).filter(Boolean);
                        const uniq = Array.from(new Set(mapped));
                        return uniq.join(', ') || 'Not specified';
                      }
                      const fallback = selectedField.selected_harvest_date ? formatHarvestDate(selectedField.selected_harvest_date) : '';
                      if (selectedField.selected_harvest_label && fallback) return `${fallback} (${selectedField.selected_harvest_label})`;
                      return fallback || selectedField.selected_harvest_label || 'Not specified';
                    })()}
                  </div>
                </div>
              </div>
              <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                <div className="mb-1 font-semibold text-slate-700">
                  Area Details
                </div>
                <div className="flex flex-wrap gap-2">
                  <span>
                    Occupied:{' '}
                    <span className="font-semibold text-slate-900">
                      {selectedField.area}
                    </span>
                  </span>
                  {(() => {
                    const total = typeof selectedField.total_area === 'string' ? parseFloat(selectedField.total_area) : (selectedField.total_area || 0);
                    const occupied = typeof selectedField.occupied_area === 'string' ? parseFloat(selectedField.occupied_area) : (selectedField.occupied_area || 0);
                    const available = Math.max(0, total - occupied);
                    return (
                      <>
                        <span>
                          Available:{' '}
                          <span className="font-semibold text-slate-900">
                            {available} m²
                          </span>
                        </span>
                        <span>
                          Total:{' '}
                          <span className="font-semibold text-slate-900">
                            {selectedField.total_area_display || `${selectedField.total_area} m²`}
                          </span>
                        </span>
                      </>
                    );
                  })()}
                </div>

                {Array.isArray(selectedField.buyers_breakdown) && selectedField.buyers_breakdown.length > 0 && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                        Buyers breakdown
                      </div>
                      <div className="text-[0.7rem] font-semibold text-slate-700">
                        {selectedField.buyers_breakdown.length} buyer{selectedField.buyers_breakdown.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {selectedField.buyers_breakdown.map((b, idx) => (
                        <div key={`${b.buyer_email || b.buyer_name || 'buyer'}-${idx}`} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900">
                              {b.buyer_name || 'Unknown buyer'}
                            </div>
                            {b.buyer_email && (
                              <div className="truncate text-[0.7rem] text-slate-500">
                                {b.buyer_email}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-xs font-semibold text-emerald-700">
                            {Math.round((b.quantity_m2 || 0)).toLocaleString()} m²
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-slate-200 pt-2 text-[0.7rem] text-slate-600">
                      Tip: this is the total purchased per buyer across all non-cancelled orders.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Rental Details
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>Occupied Area Share</span>
                  <span className="font-semibold text-slate-900">
                    {selectedField.progress}% of field
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${selectedField.progress}%`,
                      backgroundColor:
                        selectedField.progress === 100
                          ? '#10b981'
                          : selectedField.progress > 50
                          ? '#3b82f6'
                          : '#f59e0b',
                    }}
                  />
                </div>
              </div>

              <HarvestProgressBar item={selectedField} />

              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-xs text-slate-600">Earnings per m²</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {currencySymbols[userCurrency]}
                  {(parseFloat(selectedField.price_per_m2) || 0).toFixed(2)}/m²
                </span>
              </div>

              {selectedField.rentPeriod && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Rent Period</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {selectedField.rentPeriod}
                  </span>
                </div>
              )}

              {selectedField.farmer_name && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Farmer</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {selectedField.farmer_name}
                  </span>
                </div>
              )}

              {selectedField.shipping_modes && selectedField.shipping_modes.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Shipping Mode</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {(() => {
                      const modes = Array.isArray(selectedField.shipping_modes) ? selectedField.shipping_modes : [];
                      const uniq = (() => {
                        const s = new Set();
                        return modes.filter((m) => {
                          const k = (m || '').toLowerCase();
                          if (s.has(k)) return false;
                          s.add(k);
                          return true;
                        });
                      })();
                      return uniq.length ? uniq.join(', ') : 'Not specified';
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">
              Pricing Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Sharecrop Price (per unit)</span>
                <span className="font-semibold text-slate-900">
                  {currencySymbols[userCurrency]}{(parseFloat(selectedField.price) || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Price per m²</span>
                <span className="font-semibold text-emerald-600">
                  {currencySymbols[userCurrency]}{(parseFloat(selectedField.price_per_m2) || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Distribution Price</span>
                <span className="font-semibold text-slate-900">
                  {currencySymbols[userCurrency]}{(parseFloat(selectedField.distribution_price) || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Retail Price</span>
                <span className="font-semibold text-slate-900">
                  {currencySymbols[userCurrency]}{(parseFloat(selectedField.retail_price) || 0).toFixed(2)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="mb-1 font-semibold text-slate-700">Production</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Production Rate</span>
                  <span className="font-semibold text-slate-900">
                    {(parseFloat(selectedField.production_rate) || 0).toFixed(3)}{' '}
                    {displayProductionRateUnit(selectedField)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Total Production</span>
                  <span className="font-semibold text-slate-900">
                    {formatTotalProductionWithUnit(
                      selectedField.total_production,
                      selectedField.total_production_unit
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Quantity Available</span>
                  <span className="font-semibold text-slate-900">
                    {(parseFloat(selectedField.quantity) || 0)} {selectedField.unit || 'units'}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">App Fees (5%)</span>
                  <span className="font-semibold text-amber-600">
                    {currencySymbols[userCurrency]}{(parseFloat(selectedField.app_fees) || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Potential Income</span>
                  <span className="font-semibold text-emerald-600">
                    {currencySymbols[userCurrency]}{(parseFloat(selectedField.potential_income) || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {selectedField.is_own_field && (
              <button
                type="button"
                onClick={() => {
                  onEditField(selectedField);
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <EditIcon sx={{ fontSize: 16 }} />
                Edit field
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
