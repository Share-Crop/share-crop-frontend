/**
 * Product types that share one subcategory label but offer color / variety picks.
 * Form shows the group once; persisted `fields.subcategory` stays the concrete variant
 * (e.g. "Green Apple") so icons / map markers stay distinct.
 */

export const PRODUCT_SUBCATEGORY_VARIANTS = {
  Apple: {
    label: 'Apple',
    prompt: 'Apple color',
    variants: [
      { value: 'Green Apple', label: 'Green', emoji: '🍏', swatch: '#7cb342' },
      { value: 'Red Apple', label: 'Red', emoji: '🍎', swatch: '#e53935' },
    ],
  },
  Capsicum: {
    label: 'Capsicum',
    prompt: 'Capsicum color',
    variants: [
      { value: 'Green Capsicum', label: 'Green', emoji: '🫑', swatch: '#43a047' },
      { value: 'Red Capsicum', label: 'Red', emoji: '🌶️', swatch: '#e53935' },
    ],
  },
  Grapes: {
    label: 'Grapes',
    prompt: 'Grape color',
    variants: [
      { value: 'Green Grapes', label: 'Green', emoji: '🍇', swatch: '#9ccc65' },
      { value: 'Red Grapes', label: 'Red', emoji: '🍇', swatch: '#c62828' },
      { value: 'Purple Grapes', label: 'Purple', emoji: '🍇', swatch: '#6a1b9a' },
    ],
  },
  Onions: {
    label: 'Onions',
    prompt: 'Onion type',
    variants: [
      { value: 'Yellow Onions', label: 'Yellow', emoji: '🧅', swatch: '#f9a825' },
      { value: 'Red Onions', label: 'Red', emoji: '🧅', swatch: '#ad1457' },
    ],
  },
};

/** Concrete subcategory value → group key (e.g. Green Apple → Apple). */
const VALUE_TO_GROUP = (() => {
  const map = new Map();
  for (const [groupKey, def] of Object.entries(PRODUCT_SUBCATEGORY_VARIANTS)) {
    map.set(groupKey, groupKey);
    for (const v of def.variants) {
      map.set(v.value, groupKey);
      // legacy singular / plain labels
      map.set(v.label, groupKey);
    }
  }
  // legacy single Capsicum / Grapes / Onions rows count as the group
  map.set('Capsicum', 'Capsicum');
  map.set('Grapes', 'Grapes');
  map.set('Onions', 'Onions');
  map.set('Onion', 'Onions');
  map.set('Apple', 'Apple');
  return map;
})();

export function getVariantGroupKey(subcategory) {
  if (!subcategory) return null;
  return VALUE_TO_GROUP.get(String(subcategory).trim()) || null;
}

export function getVariantGroup(subcategoryOrGroup) {
  const key = getVariantGroupKey(subcategoryOrGroup) || subcategoryOrGroup;
  return key && PRODUCT_SUBCATEGORY_VARIANTS[key] ? { key, ...PRODUCT_SUBCATEGORY_VARIANTS[key] } : null;
}

/** Label shown in the subcategory dropdown (group name when variants exist). */
export function getSubcategorySelectValue(concreteSubcategory) {
  const group = getVariantGroup(concreteSubcategory);
  if (group) return group.key;
  return concreteSubcategory || '';
}

/**
 * Build dropdown options for a parent category's subcategory list:
 * merge Green Apple + Red Apple → Apple, keep unrelated items.
 */
export function getSelectableSubcategories(subList) {
  const list = Array.isArray(subList) ? subList.filter((s) => s != null && String(s).trim()) : [];
  const out = [];
  const consumed = new Set();

  for (const [groupKey, def] of Object.entries(PRODUCT_SUBCATEGORY_VARIANTS)) {
    const hit =
      list.includes(groupKey) ||
      def.variants.some((v) => list.includes(v.value)) ||
      // if API still has only legacy pairs
      (groupKey === 'Apple' && (list.includes('Green Apple') || list.includes('Red Apple')));
    if (hit) {
      out.push(groupKey);
      consumed.add(groupKey);
      def.variants.forEach((v) => consumed.add(v.value));
    }
  }

  for (const s of list) {
    const t = String(s).trim();
    if (!t || consumed.has(t)) continue;
    if (getVariantGroupKey(t) && PRODUCT_SUBCATEGORY_VARIANTS[getVariantGroupKey(t)]) {
      // stray legacy value already represented by group
      continue;
    }
    out.push(t);
  }
  return out;
}

/** All concrete variant values (for product-icon admin / emoji backfill). */
export function collectVariantSubcategoryValues() {
  const set = new Set();
  for (const def of Object.values(PRODUCT_SUBCATEGORY_VARIANTS)) {
    def.variants.forEach((v) => set.add(v.value));
  }
  return [...set];
}

/**
 * Expand UI group labels (Apple, Capsicum, …) into concrete icon keys for admin lists.
 */
export function expandSubcategoriesForIcons(subList) {
  const list = Array.isArray(subList) ? subList : [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const group = PRODUCT_SUBCATEGORY_VARIANTS[s] || getVariantGroup(s);
    if (group && PRODUCT_SUBCATEGORY_VARIANTS[group.key || s]) {
      const def = PRODUCT_SUBCATEGORY_VARIANTS[group.key || s];
      for (const v of def.variants) {
        if (!seen.has(v.value)) {
          seen.add(v.value);
          out.push(v.value);
        }
      }
      continue;
    }
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function isValidVariantValue(groupKey, concreteValue) {
  const def = PRODUCT_SUBCATEGORY_VARIANTS[groupKey];
  if (!def) return true;
  return def.variants.some((v) => v.value === concreteValue);
}
