/**
 * Single source of truth for Create Field (and admin product-icon uploads).
 * Keys = parent category labels; values = subcategory labels shown in the form.
 */
export const FIELD_CATEGORY_DATA = {
  Beverages: ['Beer', 'Coffee', 'Juice', 'Milk', 'Soda', 'Teabags', 'Wine'],
  'Bread & Bakery': ['Bagels', 'Bread', 'Cookies', 'Muffins', 'Pies', 'Tortillas'],
  'Canned Goods': ['Fruit', 'Pasta Sauce', 'Soup', 'Vegetables'],
  Dairy: ['Butter', 'Cheese', 'Eggs', 'Milk'],
  Deli: ['Cheeses', 'Salami'],
  'Fish & Seafood': ['Bivalves & Clams', 'Crab', 'Fish', 'Lobster', 'Octopus & Squid', 'Shrimp'],
  'Frozen Foods': ['Fish', 'Ice cream', 'Pizza', 'Potatoes', 'Ready Meals'],
  Fruits: ['Green Apple', 'Red Apple', 'Peach', 'Strawberry', 'Tangerine', 'Watermelon', 'Avocados', 'Mango', 'Grapes', 'Banana'],
  Vegetables: ['Corn', 'Eggplant', 'Lemon', 'Tomato', 'Broccoli', 'Capsicum', 'Carrot', 'Onions', 'Potatoes', 'Salad Greens'],
  Meat: ['Bacon', 'Chicken', 'Pork', 'Beef'],
  Oil: ['Coconut Oil', 'Olive Oil', 'Peanut Oil', 'Sunflower Oil'],
  Seeds: ['Hibiscus', 'Rice Seeds', 'Rose'],
  Snacks: ['Nuts', 'Popcorn', 'Pretzels'],
};

export function getFieldCategoryLabels() {
  return Object.keys(FIELD_CATEGORY_DATA);
}

/** Every subcategory option from the create-field form (for admin icon uploads). */
export function collectAllFieldSubcategories() {
  const set = new Set();
  Object.values(FIELD_CATEGORY_DATA).forEach((arr) => {
    (arr || []).forEach((s) => {
      const t = s != null ? String(s).trim() : '';
      if (t) set.add(t);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}
