/**
 * Client-side mirror of backend subcategory → emoji map for live preview
 * while farmers type a product-type request. Persistence uses the same Twemoji URL
 * written to product_category_icons on approve / backfill.
 */

export const TWEMOJI_VERSION = '15.1.0';
export const TWEMOJI_BASE = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/72x72`;

export const SUBCATEGORY_EMOJI_MAP = {
  'Green Apple': '🍏',
  'Red Apple': '🍎',
  Apple: '🍎',
  'Green Capsicum': '🫑',
  'Red Capsicum': '🌶️',
  'Green Grapes': '🍇',
  'Red Grapes': '🍇',
  'Purple Grapes': '🍇',
  'Yellow Onions': '🧅',
  'Red Onions': '🧅',
  Peach: '🍑',
  Strawberry: '🍓',
  Tangerine: '🍊',
  Watermelon: '🍉',
  Avocados: '🥑',
  Avocado: '🥑',
  Mango: '🥭',
  Grapes: '🍇',
  Banana: '🍌',
  Lemon: '🍋',
  Lime: '🍋',
  Cherry: '🍒',
  Cherries: '🍒',
  Pear: '🍐',
  Pineapple: '🍍',
  Kiwi: '🥝',
  Coconut: '🥥',
  Blueberry: '🫐',
  Blueberries: '🫐',
  Melon: '🍈',
  Orange: '🍊',
  Apple: '🍎',
  Kino: '🍊',
  Corn: '🌽',
  Eggplant: '🍆',
  Tomato: '🍅',
  Broccoli: '🥦',
  Capsicum: '🫑',
  Pepper: '🫑',
  Peppers: '🫑',
  Carrot: '🥕',
  Onions: '🧅',
  Onion: '🧅',
  Potatoes: '🥔',
  Potato: '🥔',
  'Salad Greens': '🥬',
  Lettuce: '🥬',
  Cucumber: '🥒',
  Garlic: '🧄',
  Chili: '🌶️',
  Chilli: '🌶️',
  'Hot Pepper': '🌶️',
  Spinach: '🥬',
  Cabbage: '🥬',
  Cauliflower: '🥦',
  Pumpkin: '🎃',
  Squash: '🎃',
  Bean: '🫘',
  Beans: '🫘',
  Mushroom: '🍄',
  Mushrooms: '🍄',
  Ginger: '🫚',
  Herbs: '🌿',
  Herb: '🌿',
  Basil: '🌿',
  Mint: '🌿',
  Bacon: '🥓',
  Chicken: '🍗',
  Pork: '🥩',
  Beef: '🥩',
  Fish: '🐟',
  Shrimp: '🦐',
  Crab: '🦀',
  Lobster: '🦞',
  'Octopus & Squid': '🐙',
  'Bivalves & Clams': '🦪',
  Butter: '🧈',
  Cheese: '🧀',
  Cheeses: '🧀',
  Eggs: '🥚',
  Milk: '🥛',
  Bagels: '🥯',
  Bread: '🍞',
  Cookies: '🍪',
  Muffins: '🧁',
  Pies: '🥧',
  Tortillas: '🫓',
  Nuts: '🥜',
  Popcorn: '🍿',
  Pretzels: '🥨',
  'Coconut Oil': '🥥',
  'Olive Oil': '🫒',
  'Peanut Oil': '🥜',
  'Sunflower Oil': '🌻',
  Hibiscus: '🌺',
  'Rice Seeds': '🌾',
  Rose: '🌹',
  Beer: '🍺',
  Coffee: '☕',
  Juice: '🧃',
  Soda: '🥤',
  Teabags: '🍵',
  Wine: '🍷',
  Fruit: '🍎',
  'Pasta Sauce': '🍝',
  Soup: '🍲',
  Vegetables: '🥬',
  Salami: '🥩',
  'Ice cream': '🍦',
  Pizza: '🍕',
  'Ready Meals': '🍱',
  Fruits: '🍎',
  Beverages: '🥤',
  Dairy: '🧀',
  Deli: '🥪',
  'Fish & Seafood': '🐟',
  'Frozen Foods': '🧊',
  'Bread & Bakery': '🍞',
  'Canned Goods': '🥫',
  Oil: '🫒',
  Snacks: '🍿',
  Seeds: '🌱',
  Meat: '🥩',
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const NORMALIZED_MAP = (() => {
  const out = new Map();
  for (const [name, emoji] of Object.entries(SUBCATEGORY_EMOJI_MAP)) {
    out.set(normalizeKey(name), emoji);
  }
  return out;
})();

export function emojiToTwemojiCodepoints(emoji) {
  const chars = Array.from(String(emoji || ''));
  const codes = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    if (cp === 0xfe0f || cp === 0xfe0e) continue;
    codes.push(cp.toString(16));
  }
  return codes.join('-');
}

export function twemojiPngUrl(emoji) {
  const codepoints = emojiToTwemojiCodepoints(emoji);
  if (!codepoints) return null;
  return `${TWEMOJI_BASE}/${codepoints}.png`;
}

export function resolveEmojiForTitle(title) {
  const q = normalizeKey(title);
  if (!q || q.length < 2) return null;

  if (NORMALIZED_MAP.has(q)) {
    const emoji = NORMALIZED_MAP.get(q);
    return { emoji, match: 'exact', twemojiUrl: twemojiPngUrl(emoji) };
  }

  let best = null;
  for (const [key, emoji] of NORMALIZED_MAP.entries()) {
    if (q.startsWith(key) || key.startsWith(q) || q.includes(key) || key.includes(q)) {
      if (!best || key.length > best.key.length) {
        best = { key, emoji };
      }
    }
  }
  if (!best) return null;
  return {
    emoji: best.emoji,
    match: 'fuzzy',
    matchedKey: best.key,
    twemojiUrl: twemojiPngUrl(best.emoji),
  };
}
