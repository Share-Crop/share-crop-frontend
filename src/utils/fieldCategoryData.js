import api from '../services/api';
import { collectVariantSubcategoryValues, getSelectableSubcategories } from './productSubcategoryVariants';

/**
 * Static defaults for Create Field / product icons.
 * Live catalog = static + approved category requests via `/api/field-categories`.
 * Keys = parent category labels; values = subcategory labels shown in the form.
 * Color variants (Apple green/red/yellow, etc.) live in productSubcategoryVariants.js.
 */
export const FIELD_CATEGORY_DATA = {
  Beverages: ['Beer', 'Coffee', 'Juice', 'Milk', 'Soda', 'Teabags', 'Wine'],
  'Bread & Bakery': ['Bagels', 'Bread', 'Cookies', 'Muffins', 'Pies', 'Tortillas'],
  'Canned Goods': ['Fruit', 'Pasta Sauce', 'Soup', 'Vegetables'],
  Dairy: ['Butter', 'Cheese', 'Eggs', 'Milk'],
  Deli: ['Cheeses', 'Salami'],
  'Fish & Seafood': ['Bivalves & Clams', 'Crab', 'Fish', 'Lobster', 'Octopus & Squid', 'Shrimp'],
  'Frozen Foods': ['Fish', 'Ice cream', 'Pizza', 'Potatoes', 'Ready Meals'],
  Fruits: ['Apple', 'Peach', 'Strawberry', 'Tangerine', 'Watermelon', 'Avocados', 'Mango', 'Grapes', 'Banana'],
  Vegetables: ['Corn', 'Eggplant', 'Lemon', 'Tomato', 'Broccoli', 'Capsicum', 'Carrot', 'Onions', 'Potatoes', 'Salad Greens'],
  Meat: ['Bacon', 'Chicken', 'Pork', 'Beef'],
  Oil: ['Coconut Oil', 'Olive Oil', 'Peanut Oil', 'Sunflower Oil'],
  Seeds: ['Hibiscus', 'Rice Seeds', 'Rose'],
  Snacks: ['Nuts', 'Popcorn', 'Pretzels'],
};

export function getFieldCategoryLabels(data = FIELD_CATEGORY_DATA) {
  return Object.keys(data || FIELD_CATEGORY_DATA);
}

/** Every concrete subcategory / variant key (for admin icon uploads). */
export function collectAllFieldSubcategories(data = FIELD_CATEGORY_DATA) {
  const set = new Set();
  Object.values(data || {}).forEach((arr) => {
    (arr || []).forEach((s) => {
      const t = s != null ? String(s).trim() : '';
      if (t) set.add(t);
    });
  });
  // Expand grouped types into concrete icon keys (Green Apple, Red Capsicum, …)
  collectVariantSubcategoryValues().forEach((v) => set.add(v));
  // Drop bare group labels that are only UI shells when variants exist
  ['Apple'].forEach((g) => {
    // keep Apple only if no variants — we always have variants, so remove bare Apple from icon list
    set.delete(g);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Dropdown labels for Create Field (groups variants). */
export function getCreateFieldSubcategories(parentCategory, data = FIELD_CATEGORY_DATA) {
  const raw = data?.[parentCategory] || [];
  return getSelectableSubcategories(raw);
}

/**
 * Fetch static + approved custom categories from the API.
 * Falls back to static defaults if the request fails.
 */
export async function fetchFieldCategoryData() {
  try {
    const res = await api.get('/api/field-categories');
    const categories = res.data?.categories;
    if (categories && typeof categories === 'object' && !Array.isArray(categories)) {
      return categories;
    }
  } catch (err) {
    console.warn('[fieldCategoryData] live catalog unavailable; using static list', err?.message);
  }
  return FIELD_CATEGORY_DATA;
}
