export const HARVEST_DEFAULT_CYCLE_DAYS = 90;

export function parseHarvestDate(raw) {
  if (!raw) return null;

  // Treat any ISO-like string starting with YYYY-MM-DD as a local calendar date
  // to avoid timezone drift (e.g. "2026-05-12T00:00:00.000Z" should render as May 12).
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(trimmed);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const localDate = new Date(y, mo, d);
      if (!Number.isNaN(localDate.getTime())) return localDate;
    }
  }

  try {
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;
  } catch {
    // Ignore invalid direct parse and try a looser fallback below.
  }

  try {
    const text = String(raw).trim();
    const parts = text.split(/[-/ ]/);
    if (parts.length >= 3) {
      const normalized = `${parts[0]} ${parts[1]} ${parts[2]}`;
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  } catch {
    // Ignore fallback parse errors.
  }

  return null;
}

export function formatHarvestDate(raw) {
  const parsed = parseHarvestDate(raw);
  if (!parsed) return raw ? String(raw) : 'Not specified';
  return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKeyUtc(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffCalendarDays(fromDate, toDate) {
  return Math.round((dayKeyUtc(toDate) - dayKeyUtc(fromDate)) / (24 * 60 * 60 * 1000));
}

function isCurrentOrFuture(date) {
  if (!date) return false;
  const today = normalizeDay(new Date());
  return normalizeDay(date).getTime() >= today.getTime();
}

function normalizeHarvestItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    const text = items.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch {
      return [text];
    }
  }
  if (items && typeof items === 'object') return [items];
  return [];
}

function getBestDateFromList(items) {
  const normalizedItems = normalizeHarvestItems(items);
  if (normalizedItems.length === 0) return null;

  const today = normalizeDay(new Date());
  let bestFuture = null;
  let bestFutureTs = Infinity;

  for (const item of normalizedItems) {
    const raw = item && typeof item === 'object'
      ? (item.date ?? item.value ?? item.harvest_date)
      : item;
    const parsed = parseHarvestDate(raw);
    if (!parsed) continue;

    const normalized = normalizeDay(parsed);
    const ts = normalized.getTime();

    if (ts >= today.getTime() && ts < bestFutureTs) {
      bestFutureTs = ts;
      bestFuture = normalized;
    }
  }

  return bestFuture;
}

/** Collect every harvest date string from a field-like or order-like object. */
export function collectHarvestDateStrings(item) {
  if (!item || typeof item !== 'object') return [];
  const strings = [];
  const pushRaw = (raw) => {
    if (raw == null || raw === '') return;
    const s = String(raw).trim();
    if (s) strings.push(s);
  };
  const fromList = (list) => {
    for (const row of normalizeHarvestItems(list)) {
      const raw = row && typeof row === 'object' ? (row.date ?? row.value ?? row.harvest_date) : row;
      pushRaw(raw);
    }
  };
  fromList(item.selected_harvests || item.selectedHarvests);
  fromList(item.harvest_dates || item.harvestDates);
  fromList(item.field_harvest_dates || item.fieldHarvestDates);
  pushRaw(item.selected_harvest_date);
  if (item.selectedHarvestDate && typeof item.selectedHarvestDate === 'object') {
    pushRaw(item.selectedHarvestDate.date);
  }
  pushRaw(item.harvest_date || item.harvestDate);
  pushRaw(item.field_harvest_date || item.fieldHarvestDate);
  return [...new Set(strings)];
}

/**
 * True if the record has no harvest schedule OR at least one harvest on today or in the future.
 * False only when there is at least one parseable date and every date is strictly before today.
 */
export function hasUpcomingHarvestOnRecord(item) {
  const unique = collectHarvestDateStrings(item);
  if (unique.length === 0) return true;
  const today = normalizeDay(new Date());
  let anyValid = false;
  for (const s of unique) {
    const d = parseHarvestDate(s);
    if (!d) continue;
    anyValid = true;
    if (normalizeDay(d).getTime() >= today.getTime()) return true;
  }
  if (!anyValid) return true;
  return false;
}

function getMostRecentPastHarvestDay(item) {
  const today = normalizeDay(new Date());
  let best = null;
  let bestTs = -Infinity;
  for (const s of collectHarvestDateStrings(item)) {
    const d = parseHarvestDate(s);
    if (!d) continue;
    const day = normalizeDay(d);
    const ts = day.getTime();
    if (ts < today.getTime() && ts > bestTs) {
      bestTs = ts;
      best = day;
    }
  }
  return best;
}

export function resolveHarvestDate(item) {
  if (!item || typeof item !== 'object') return null;

  const explicitRaw = parseHarvestDate(
    item.selected_harvest_date ??
    item.selectedHarvestDate?.date ??
    item.harvest_date ??
    item.harvestDate ??
    item.field_harvest_date ??
    item.fieldHarvestDate ??
    item.delivery_date ??
    item.deliveryDate ??
    item.harvest_start_date ??
    item.harvestStartDate
  );
  const explicit = isCurrentOrFuture(explicitRaw) ? normalizeDay(explicitRaw) : null;

  const listDate = getBestDateFromList(item.selected_harvests || item.selectedHarvests)
    || getBestDateFromList(item.harvest_dates || item.harvestDates)
    || getBestDateFromList(item.field_harvest_dates || item.fieldHarvestDates);

  return listDate || explicit || null;
}

export function getHarvestProgressInfo(item) {
  const harvestDate = resolveHarvestDate(item);
  if (!harvestDate) {
    if (!hasUpcomingHarvestOnRecord(item)) {
      const pastDay = getMostRecentPastHarvestDay(item);
      return {
        harvestDate: pastDay,
        progress: 1,
        progressPercent: 100,
        daysLeft: 0,
        daysUntil: 0,
        totalCycleDays: HARVEST_DEFAULT_CYCLE_DAYS,
        daysElapsed: HARVEST_DEFAULT_CYCLE_DAYS,
        hasHarvestDate: Boolean(pastDay),
        isExpiredSeason: true,
      };
    }
    return {
      harvestDate: null,
      progress: 0,
      progressPercent: 0,
      daysLeft: null,
      daysUntil: null,
      totalCycleDays: HARVEST_DEFAULT_CYCLE_DAYS,
      daysElapsed: 0,
      hasHarvestDate: false,
      isExpiredSeason: false,
    };
  }

  const today = normalizeDay(new Date());
  const harvestDay = normalizeDay(harvestDate);
  const daysLeft = diffCalendarDays(today, harvestDay);

  const startRaw =
    item.field_created_at ||
    item.fieldCreatedAt ||
    item.field_created_date ||
    item.fieldCreatedDate ||
    item.created_at ||
    item.createdAt ||
    item.start_date ||
    item.startDate;
  const startDateRaw = parseHarvestDate(startRaw);
  const startDate = startDateRaw ? normalizeDay(startDateRaw) : null;

  let totalCycleDays = HARVEST_DEFAULT_CYCLE_DAYS;
  let daysElapsed = totalCycleDays - daysLeft;

  if (startDate && startDate.getTime() < harvestDay.getTime()) {
    const computedTotal = diffCalendarDays(startDate, harvestDay);
    if (computedTotal > 0) {
      totalCycleDays = computedTotal;
      daysElapsed = diffCalendarDays(startDate, today);
    }
  }

  const progress = Math.max(0, Math.min(1, daysElapsed / Math.max(1, totalCycleDays)));

  return {
    harvestDate,
    progress,
    progressPercent: Math.round(progress * 100),
    daysLeft,
    daysUntil: daysLeft,
    totalCycleDays,
    daysElapsed,
    hasHarvestDate: true,
    isExpiredSeason: false,
  };
}

export function getHarvestProgressColors(item) {
  const { progress, hasHarvestDate, isExpiredSeason } = getHarvestProgressInfo(item);
  if (!hasHarvestDate) {
    return { track: '#e2e8f0', fill: 'linear-gradient(90deg, #cbd5e1, #94a3b8)', text: '#64748b' };
  }
  if (isExpiredSeason) {
    return { track: '#ffedd5', fill: 'linear-gradient(90deg, #fb923c, #ea580c)', text: '#c2410c' };
  }

  const startHue = Math.min(110, Math.max(0, progress * 110));
  const endHue = Math.min(110, Math.max(0, (progress * 110) - 20));
  return {
    track: '#e2e8f0',
    fill: `linear-gradient(90deg, hsl(${startHue}, 85%, 55%), hsl(${endHue}, 90%, 40%))`,
    text: `hsl(${endHue}, 90%, 32%)`,
  };
}

export function getHarvestDaysLeftLabel(daysLeft, short = false, options = {}) {
  if (options.isExpiredSeason) {
    return short ? 'Passed' : 'Harvest passed — fulfill deliveries';
  }
  if (typeof daysLeft !== 'number') return 'No harvest date';
  if (daysLeft < 0) return short ? 'Passed' : 'Harvest passed';
  if (daysLeft === 0) return short ? 'Due' : 'Due today';
  if (daysLeft === 1) return short ? '1d left' : '1 day left';
  return short ? `${daysLeft}d left` : `${daysLeft} days left`;
}
