/**
 * Excel FIELD SETUP: "% to sell" with derived mass in fields.quantity.
 * DB may store quantity_sell_percent; legacy rows infer % from quantity / total_production.
 */
export function inferQuantitySellPercentFromField(raw) {
  if (!raw) return '';
  const p = raw.quantity_sell_percent ?? raw.quantitySellPercent;
  if (p != null && p !== '' && !Number.isNaN(parseFloat(p))) {
    return String(parseFloat(p));
  }
  const tp = parseFloat(raw.total_production ?? raw.totalProduction) || 0;
  const qty = parseFloat(raw.quantity) || 0;
  if (tp > 0 && qty >= 0) return String((qty / tp) * 100);
  return '';
}

/** Sellable amount in production units (kg, L, …) from total harvest and % to list. */
export function derivedSellQuantityFromPercent(totalProduction, percent) {
  const tp = parseFloat(totalProduction) || 0;
  const pct = parseFloat(percent) || 0;
  if (tp <= 0 || pct <= 0) return 0;
  return (tp * pct) / 100;
}
