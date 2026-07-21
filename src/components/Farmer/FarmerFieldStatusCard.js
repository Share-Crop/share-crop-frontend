import React from 'react';
import { Agriculture, LocalShipping, People, Event } from '@mui/icons-material';
import FieldHarvestControls from './FieldHarvestControls';
import RelistedFieldBadge from './RelistedFieldBadge';
import { getFieldHarvestOrders } from '../../utils/farmerOrderOccupancy';
import { areaDisplay } from '../../utils/fieldAreaDisplay';
import { formatTotalProductionWithUnit } from '../../utils/fieldProductionUnits';
import {
  formatHarvestDate,
  getHarvestProgressInfo,
  hasUpcomingHarvestOnRecord,
} from '../../utils/harvestProgress';
import { isFieldRelisted } from '../../utils/fieldRelisted';

function formatShortDate(d) {
  if (!d) return null;
  const formatted = formatHarvestDate(d);
  if (formatted) return formatted;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function harvestDateLabel(field) {
  const dates = field?.harvestDates || field?.harvest_dates || [];
  const list = Array.isArray(dates) ? dates : [dates];
  const strings = list
    .map((h) => (typeof h === 'object' && h != null ? h.date : h))
    .filter(Boolean)
    .map((s) => String(s).slice(0, 10))
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
    .sort();
  if (!strings.length) return { text: null, isPast: false, ymd: null };
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const upcoming = strings.filter((s) => s >= todayYmd);
  if (upcoming.length) {
    return { text: formatShortDate(upcoming[0]), isPast: false, ymd: upcoming[0] };
  }
  const last = strings[strings.length - 1];
  return { text: formatShortDate(last), isPast: true, ymd: last };
}

function daysPastLabel(daysLeft) {
  if (typeof daysLeft !== 'number') return null;
  if (daysLeft > 0) return `${daysLeft}d left`;
  if (daysLeft === 0) return 'Today';
  const past = Math.abs(daysLeft);
  return past === 1 ? '1 day past' : `${past} days past`;
}

const STATUS = {
  growing: {
    label: 'Growing',
    hint: 'Crop is in the field',
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-800',
    border: 'border-slate-200',
  },
  overdue: {
    label: 'Harvest overdue',
    hint: 'Harvest date has passed',
    bar: 'bg-orange-500',
    chip: 'bg-orange-100 text-orange-900',
    border: 'border-orange-200',
  },
  harvested: {
    label: 'Harvested',
    hint: 'Waiting to ship to buyers',
    bar: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-900',
    border: 'border-amber-200',
  },
  shipped: {
    label: 'Shipped',
    hint: 'Season done — list again to sell more',
    bar: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-900',
    border: 'border-blue-200',
  },
};

function fieldNeedsAction(field, rentals, harvestPast) {
  const status = String(field?.operational_status || 'growing').toLowerCase();
  if (status === 'growing' && (rentals.length > 0 || harvestPast)) return 'harvest';
  if (status === 'harvested') return 'ship';
  if (status === 'shipped') return 'list';
  return null;
}

/**
 * Farmer-facing field card: status first, one clear next step, simple facts.
 * @param {boolean} compact — denser layout for 2–3 column grids
 */
export default function FarmerFieldStatusCard({
  field,
  farmerOrders = [],
  onFieldUpdated,
  onDelete,
  deleteDisabled = false,
  deleteTitle = '',
  highlighted = false,
  compact = false,
  id,
}) {
  if (!field?.id) return null;

  const statusKey = String(field.operational_status || 'growing').toLowerCase();
  const harvestInfo = harvestDateLabel(field);
  const progress = getHarvestProgressInfo(field);
  const harvestPast =
    statusKey === 'growing' &&
    (harvestInfo.isPast || progress.isExpiredSeason || !hasUpcomingHarvestOnRecord(field));

  const displayStatusKey =
    statusKey === 'growing' && harvestPast ? 'overdue' : statusKey;
  const status = STATUS[displayStatusKey] || STATUS.growing;

  const rentals = getFieldHarvestOrders(farmerOrders, field.id);
  const need = fieldNeedsAction(field, rentals, harvestPast);
  const areaText = field.total_area_display || areaDisplay(field, field.totalAreaM2).text;
  const productionText = formatTotalProductionWithUnit(
    Math.round(field.totalProduction ?? field.total_production ?? 0),
    field.totalProductionUnit || field.total_production_unit
  );
  const relisted = isFieldRelisted(field);

  let nextStep = null;
  if (need === 'harvest' && harvestPast) {
    nextStep = {
      tone: 'amber',
      icon: <Agriculture sx={{ fontSize: compact ? 16 : 18 }} />,
      title: compact ? 'Harvest overdue' : 'Harvest date has passed',
      body: compact
        ? (harvestInfo.text ? `Due ${harvestInfo.text}` : 'Mark harvested to close season')
        : rentals.length > 0
          ? `Was due ${harvestInfo.text}. Mark harvested and enter the total you got.`
          : `Was due ${harvestInfo.text}. No active buyers now — still mark harvested to close this season, then list again with a new date.`,
    };
  } else if (need === 'harvest') {
    nextStep = {
      tone: 'amber',
      icon: <Agriculture sx={{ fontSize: compact ? 16 : 18 }} />,
      title: compact ? 'Mark harvested' : 'Action needed: mark harvested',
      body: compact ? 'Enter total when ready' : 'Enter total production when this crop is ready.',
    };
  } else if (need === 'ship') {
    nextStep = {
      tone: 'blue',
      icon: <LocalShipping sx={{ fontSize: compact ? 16 : 18 }} />,
      title: compact ? 'Mark shipped' : 'Action needed: mark shipped',
      body: compact ? 'Confirm sent or picked up' : 'Confirm when product has been sent or picked up.',
    };
  } else if (need === 'list') {
    nextStep = {
      tone: 'violet',
      icon: <Agriculture sx={{ fontSize: compact ? 16 : 18 }} />,
      title: compact ? 'List again?' : 'Ready to sell again?',
      body: compact ? 'New season on the map' : 'List this field on the map for a new season.',
    };
  } else if (statusKey === 'growing' && rentals.length === 0 && !harvestPast) {
    nextStep = compact
      ? null
      : {
          tone: 'slate',
          icon: null,
          title: 'On the map for buyers',
          body: harvestInfo.text
            ? `Next harvest ${harvestInfo.text}. No active buyers yet.`
            : 'Waiting for buyers to rent this field.',
        };
  }

  const toneBox =
    nextStep?.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : nextStep?.tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-950'
        : nextStep?.tone === 'violet'
          ? 'border-violet-200 bg-violet-50 text-violet-950'
          : 'border-slate-200 bg-slate-50 text-slate-700';

  const harvestSub =
    statusKey === 'growing' || displayStatusKey === 'overdue'
      ? daysPastLabel(progress.daysLeft)
      : null;

  return (
    <article
      id={id}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
        highlighted ? 'border-amber-400 ring-2 ring-amber-200' : status.border
      } ${need ? 'ring-1 ring-amber-200' : ''}`}
    >
      <div className={`h-1.5 w-full shrink-0 ${status.bar}`} />

      <div className={`flex flex-1 flex-col ${compact ? 'p-3' : 'p-4'}`}>
        <div className={`flex flex-wrap items-start justify-between gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className={`font-bold text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}>
                {field.name || 'Untitled field'}
              </h4>
              {relisted ? <RelistedFieldBadge field={field} /> : null}
            </div>
            <p className={`mt-0.5 text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              {field.cropType || field.category || 'Crop'}
              {!compact && areaText ? ` · ${areaText}` : ''}
            </p>
          </div>
          <div className={compact ? '' : 'text-right'}>
            <span className={`inline-flex rounded-full font-bold ${status.chip} ${compact ? 'px-2 py-0.5 text-[0.65rem]' : 'px-2.5 py-1 text-xs'}`}>
              {status.label}
            </span>
            {!compact ? (
              <div className="mt-1 text-[0.7rem] text-slate-500">{status.hint}</div>
            ) : null}
          </div>
        </div>

        {nextStep ? (
          <div className={`flex gap-2 rounded-xl border ${toneBox} ${compact ? 'mb-2 px-2 py-1.5' : 'mb-3 px-3 py-2.5'}`}>
            {nextStep.icon ? <div className="mt-0.5 shrink-0">{nextStep.icon}</div> : null}
            <div className="min-w-0">
              <div className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`}>{nextStep.title}</div>
              <div className={`opacity-90 ${compact ? 'text-[0.65rem] leading-snug' : 'text-xs'}`}>{nextStep.body}</div>
            </div>
          </div>
        ) : null}

        <div className={`grid gap-1.5 ${compact ? 'mb-2 grid-cols-2' : 'mb-3 grid-cols-2 sm:grid-cols-4'}`}>
          {!compact ? (
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Size</div>
              <div className="text-sm font-semibold text-slate-900">{areaText || '—'}</div>
            </div>
          ) : null}
          <div className={`rounded-xl bg-slate-50 ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              {compact ? 'Yield' : 'Expected'}
            </div>
            <div className={`font-semibold text-slate-900 ${compact ? 'truncate text-xs' : 'text-sm'}`}>
              {productionText || '—'}
            </div>
          </div>
          <div className={`rounded-xl ${harvestPast ? 'bg-orange-50' : 'bg-slate-50'} ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
            <div className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              <Event sx={{ fontSize: 12 }} /> Harvest
            </div>
            <div className={`font-semibold text-slate-900 ${compact ? 'truncate text-xs' : 'text-sm'}`}>
              {harvestInfo.text || 'Not set'}
            </div>
            {harvestSub ? (
              <div className={`font-semibold ${compact ? 'text-[0.6rem]' : 'text-[0.65rem]'} ${harvestPast ? 'text-orange-700' : 'text-slate-500'}`}>
                {harvestSub}
              </div>
            ) : null}
          </div>
          <div className={`rounded-xl bg-slate-50 ${compact ? 'col-span-2 px-2 py-1.5' : 'px-2.5 py-2'}`}>
            <div className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              <People sx={{ fontSize: 12 }} /> Buyers
            </div>
            <div className={`font-semibold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
              {rentals.length > 0 ? `${rentals.length} renting` : 'None active'}
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <FieldHarvestControls
            prominent={!compact}
            hideStatusBadge
            field={field}
            farmerOrders={farmerOrders}
            onFieldUpdated={onFieldUpdated}
          />
        </div>

        {onDelete ? (
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteDisabled}
              title={deleteTitle}
              className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remove field
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
