import type { Department, Item } from '../shared/types';
import { isStaple } from './staples';

// Heuristic ingredient parser. Used by LLM_MOCK and as a fallback when the LLM call fails.

const UNITS = [
  'cups?', 'c', 'tablespoons?', 'tbsps?', 'tbs', 'tbsp', 'T', 'teaspoons?', 'tsps?', 't', 'pounds?', 'lbs?', 'ounces?', 'oz',
  'grams?', 'g', 'kg', 'kilograms?', 'ml', 'milliliters?', 'l', 'liters?', 'litres?', 'pints?', 'quarts?', 'gallons?',
  'cloves?', 'cans?', 'jars?', 'packages?', 'pkgs?', 'sticks?', 'bunch(?:es)?', 'heads?', 'pinch(?:es)?', 'dash(?:es)?',
  'slices?', 'sprigs?', 'stalks?', 'fl oz', 'handfuls?', 'pieces?', 'bags?', 'boxes?', 'bottles?', 'large', 'medium', 'small',
];
const QTY = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:-|to|–)\s*(?:\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]))?`;
const LEAD_RE = new RegExp(String.raw`^\s*(${QTY})?\s*(?:\(([^)]*)\)\s*)?(?:(${UNITS.join('|')})\.?\s+)?(?:of\s+)?`, 'i');

const PREP_WORDS = new Set(
  (
    'fresh freshly chopped finely roughly coarsely minced diced sliced thinly thickly grated shredded crushed ground peeled ' +
    'seeded deveined trimmed halved quartered cubed julienned softened melted cold warm hot room temperature divided packed ' +
    'loosely lightly heaping level large small medium extra optional to taste plus more for serving garnish about approximately ' +
    'boneless skinless and or of the a an into cut pieces piece inch inches cm whole raw cooked uncooked rinsed drained good quality'
  ).split(' '),
);
// Words that change what product you buy, so keep them even though they look like prep words.
const KEEP_PHRASES = ['ground beef', 'ground turkey', 'ground pork', 'ground chicken', 'ground lamb', 'ground cumin', 'ground cinnamon',
  'ground ginger', 'ground coriander', 'ground nutmeg', 'ground cloves', 'ground cardamom', 'ground turmeric', 'whole milk',
  'whole wheat', 'crushed tomatoes', 'diced tomatoes', 'crushed red pepper', 'red pepper flakes', 'heavy cream', 'sour cream',
  'cream cheese', 'brown sugar', 'powdered sugar', 'baking soda', 'baking powder', 'large eggs', 'chicken thighs', 'chicken breasts',
  'grated parmesan', 'shredded mozzarella', 'shredded cheddar'];

const DEPT_KEYWORDS: [Department, RegExp][] = [
  ['seafood', /\b(salmon|shrimp|prawns?|cod|tuna|tilapia|halibut|scallops?|crab|lobster|mussels|clams|fish fillets?)\b/],
  ['meat', /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|steak|veal|chorizo|prosciutto|pancetta|ground meat)\b/],
  ['eggs', /\beggs?\b/],
  ['dairy', /\b(milk|cream|butter|cheese|yogurt|yoghurt|parmesan|mozzarella|cheddar|ricotta|feta|buttermilk|ghee|half-and-half)\b/],
  ['spices', /\b(cumin|paprika|cinnamon|turmeric|coriander|chili powder|chilli powder|cayenne|nutmeg|garam masala|oregano|thyme|curry powder|cardamom|cloves|bay lea(f|ves)|red pepper flakes|allspice|seasoning|peppercorns?)\b/],
  ['baking', /\b(flour|sugar|baking soda|baking powder|yeast|vanilla|chocolate chips?|cocoa|cornstarch|molasses|honey|maple syrup)\b/],
  ['produce', /\b(onions?|garlic|ginger|tomato(es)?|potato(es)?|carrots?|celery|lemons?|limes?|cilantro|parsley|basil|mint|spinach|kale|lettuce|peppers?|jalape(n|ñ)os?|chil(i|e|li)s?|mushrooms?|zucchini|avocados?|apples?|bananas?|berries|scallions?|green onions?|shallots?|leeks?|cucumbers?|cabbage|broccoli|cauliflower|squash|corn|herbs?|rosemary|dill|chives|lettuce)\b/],
  ['condiments', /\b(sauce|ketchup|mustard|mayo|mayonnaise|vinegar|soy|sriracha|salsa|dressing|oil)\b/],
  ['bakery', /\b(bread|buns?|tortillas?|pita|naan|baguette|rolls?)\b/],
  ['frozen', /\bfrozen\b/],
  ['beverages', /\b(wine|beer|juice|stock|broth)\b/],
  ['pantry', /\b(rice|pasta|noodles|beans|lentils|chickpeas|oats|canned|tomato paste|coconut milk|stock|broth|nuts|almonds|peanuts|quinoa|breadcrumbs|panko)\b/],
];

export function guessDepartment(name: string): Department {
  const n = name.toLowerCase();
  if (/\b(broth|stock|tomato paste|coconut milk|canned)\b/.test(n)) return 'pantry';
  for (const [dept, re] of DEPT_KEYWORDS) if (re.test(n)) return dept;
  return 'other';
}

const DEFAULT_AVOID: Partial<Record<Department, string[]>> = {
  meat: ['broth', 'stock', 'seasoning', 'flavored', 'soup', 'bouillon', 'treats', 'dog', 'cat'],
  seafood: ['seasoning', 'sauce', 'treats', 'cat'],
  produce: ['seasoning', 'soap', 'candle', 'chips', 'flavored', 'juice', 'sauce'],
  spices: ['tea', 'candle', 'soap'],
  dairy: ['peanut', 'almond', 'body', 'soap', 'lotion'],
};

export function parseLine(line: string): { quantity: string; unit: string; name: string } {
  let s = line.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const m = s.match(LEAD_RE);
  let quantity = '';
  let unit = '';
  if (m) {
    quantity = (m[1] ?? '').trim();
    unit = (m[3] ?? '').trim();
    s = s.slice(m[0].length);
  }
  s = s.split(/,|;|\bfor serving\b|\bto taste\b/i)[0];
  return { quantity, unit, name: s.trim() };
}

export function searchTermFor(name: string): string {
  const lower = name.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const p of KEEP_PHRASES) if (lower.includes(p)) return p.replace(/^large /, '');
  const words = lower.split(' ').filter((w) => w && !PREP_WORDS.has(w));
  return words.slice(-3).join(' ') || lower;
}

export function heuristicNormalize(lines: string[]): Item[] {
  const items: Item[] = [];
  const byTerm = new Map<string, Item>();
  lines.forEach((line) => {
    const { quantity, unit, name } = parseLine(line);
    const term = searchTermFor(name);
    if (!term) return;
    const existing = byTerm.get(term);
    if (existing) {
      existing.raw.push(line);
      return;
    }
    const department = guessDepartment(term);
    const item: Item = {
      id: `i${items.length + 1}`,
      name: name || term,
      quantity,
      unit,
      searchTerm: term,
      altTerms: [],
      department,
      avoidWords: DEFAULT_AVOID[department] ?? [],
      isPantryStaple: isStaple(term),
      raw: [line],
    };
    byTerm.set(term, item);
    items.push(item);
  });
  return items;
}
