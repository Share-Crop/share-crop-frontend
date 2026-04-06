/**
 * Product images come from the database (URLs pointing at Supabase Storage, usually bucket `product-images`).
 * Loaded via ProductIconOverridesLoader + GET /api/product-category-icons.
 * There is no fallback to files under public/icons — upload each subcategory in Admin → Product pictures.
 */

let apiIconOverrides = {};

/** Grey tile with “?” — same everywhere until an image is uploaded for that subcategory. */
export const PRODUCT_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect fill="#eceff4" width="72" height="72" rx="14"/><path fill="#94a3b8" d="M36 20c-6 0-11 4-11 10 0 5 3 8 6 10v4h10v-4c3-2 6-5 6-10 0-6-5-10-11-10zm-8 36c0-2 2-4 8-4s8 2 8 4v2H28v-2z"/></svg>`
  );

export function setProductIconOverrides(map) {
  apiIconOverrides = map && typeof map === 'object' ? { ...map } : {};
}

export function getProductIconOverrides() {
  return { ...apiIconOverrides };
}

function resolveOverrideUrl(rawCategory) {
  if (rawCategory == null || rawCategory === '') return null;
  const category = rawCategory.toString().trim();
  if (!category) return null;
  if (apiIconOverrides[category]) return apiIconOverrides[category];
  const normalized = category.toLowerCase().replace(/\s+/g, '-');
  if (apiIconOverrides[normalized]) return apiIconOverrides[normalized];
  const key = Object.keys(apiIconOverrides).find((k) => k.toLowerCase() === category.toLowerCase());
  return key ? apiIconOverrides[key] : null;
}

/** Only a real uploaded/configured URL, or empty string (for API payloads — do not store the placeholder). */
export function getProductImageUrlForStorage(rawCategory) {
  return resolveOverrideUrl(rawCategory) || '';
}

/** Image URL for map, forms, lists: Supabase (or any) URL from admin, else placeholder. */
export const getProductIcon = (rawCategory) => {
  const url = resolveOverrideUrl(rawCategory);
  return url || PRODUCT_IMAGE_PLACEHOLDER;
};

/** @deprecated Same as getProductIcon — kept so old imports do not break. */
export const getStaticProductIcon = getProductIcon;

export const productCategories = [
  { id: 1, name: 'Green Apple', key: 'green-apple' },
  { id: 2, name: 'Red Apple', key: 'red-apple' },
  { id: 3, name: 'Corn', key: 'corn' },
  { id: 4, name: 'Eggplant', key: 'eggplant' },
  { id: 5, name: 'Lemon', key: 'lemon' },
  { id: 6, name: 'Peach', key: 'peach' },
  { id: 7, name: 'Strawberry', key: 'strawberry' },
  { id: 8, name: 'Tangerine', key: 'tangerine' },
  { id: 9, name: 'Tomato', key: 'tomato' },
  { id: 10, name: 'Watermelon', key: 'watermelon' },
];
