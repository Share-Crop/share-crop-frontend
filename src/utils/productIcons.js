/**
 * Product images resolution order:
 * 1) Admin / DB overrides (Supabase or Twemoji URLs from product_category_icons)
 * 2) Accurate bundled PNGs under public/icons (only real matches)
 * 3) Twemoji 72×72 from subcategory emoji map
 * 4) Neutral placeholder (never reuse green apple for unrelated types)
 */

import { resolveEmojiForTitle } from './subcategoryEmojis';

let apiIconOverrides = {};

/** Bundled icons that actually match the crop name (do not remap unrelated types here). */
export const productIcons = {
  'green-apple': '/icons/products/fruits/apple_green.png',
  'red-apple': '/icons/products/fruits/apple_red.png',
  corn: '/icons/products/fruits/corn.png',
  eggplant: '/icons/products/fruits/eggplant.png',
  lemon: '/icons/products/fruits/lemon.png',
  peach: '/icons/products/fruits/peach.png',
  strawberry: '/icons/products/fruits/strawberry.png',
  tangerine: '/icons/products/fruits/tangerine.png',
  tomato: '/icons/products/fruits/tomato.png',
  watermelon: '/icons/products/fruits/watermelon.png',

  'Green Apple': '/icons/products/fruits/apple_green.png',
  'Red Apple': '/icons/products/fruits/apple_red.png',
  Corn: '/icons/products/fruits/corn.png',
  Eggplant: '/icons/products/fruits/eggplant.png',
  Lemon: '/icons/products/fruits/lemon.png',
  Peach: '/icons/products/fruits/peach.png',
  Strawberry: '/icons/products/fruits/strawberry.png',
  Tangerine: '/icons/products/fruits/tangerine.png',
  Tomato: '/icons/products/fruits/tomato.png',
  Watermelon: '/icons/products/fruits/watermelon.png',
};

/** Grey tile — only if no API, bundled, or Twemoji match. */
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

function resolveBundledIcon(rawCategory) {
  if (!rawCategory) return null;
  const category = rawCategory.toString().trim();
  if (productIcons[category]) return productIcons[category];
  const normalized = category.toLowerCase().replace(/\s+/g, '-');
  if (productIcons[normalized]) return productIcons[normalized];
  return null;
}

function resolveTwemojiIcon(rawCategory) {
  if (!rawCategory) return null;
  return resolveEmojiForTitle(String(rawCategory).trim())?.twemojiUrl || null;
}

/** Prefer a durable URL for field payloads: DB override, else Twemoji (not local /icons paths). */
export function getProductImageUrlForStorage(rawCategory) {
  return resolveOverrideUrl(rawCategory) || resolveTwemojiIcon(rawCategory) || '';
}

/** Image URL for map, forms, lists: Admin/DB → bundled → Twemoji → placeholder. */
export const getProductIcon = (rawCategory) => {
  const fromApi = resolveOverrideUrl(rawCategory);
  if (fromApi) return fromApi;
  const bundled = resolveBundledIcon(rawCategory);
  if (bundled) return bundled;
  const twemoji = resolveTwemojiIcon(rawCategory);
  if (twemoji) return twemoji;
  return PRODUCT_IMAGE_PLACEHOLDER;
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
