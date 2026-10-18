import * as cheerio from 'cheerio';

export interface ExtractedRecipe {
  title: string;
  image?: string;
  lines: string[];
  method: 'jsonld' | 'selectors';
}

export class RecipeFetchError extends Error {
  constructor(
    message: string,
    public code: 'blocked' | 'not_found' | 'network' | 'bad_url' | 'no_recipe',
    public pageText?: string,
  ) {
    super(message);
  }
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
};

export type FetchVia = 'direct' | 'archive' | 'reader';

/**
 * Fetches a recipe page. Big recipe sites (AllRecipes, Serious Eats, Simply Recipes, Food Network...) put
 * Cloudflare bot walls in front of datacenter IPs like Vercel's, which no header set gets past. When the direct
 * fetch is blocked or has no recipe in it, try the latest good Wayback Machine capture, then the r.jina.ai reader.
 */
export async function fetchRecipePage(url: string): Promise<{ html: string; via: FetchVia; recipe?: ExtractedRecipe }> {
  let direct: string | undefined;
  let firstError: RecipeFetchError | undefined;
  try {
    direct = await fetchHtml(url);
    const recipe = extractRecipe(direct);
    if (recipe) return { html: direct, via: 'direct', recipe };
  } catch (err) {
    if (!(err instanceof RecipeFetchError) || err.code === 'bad_url') throw err;
    firstError = err;
  }
  for (const [via, fetcher] of [
    ['archive', fetchFromArchive],
    ['reader', fetchFromReader],
  ] as const) {
    try {
      const html = await fetcher(url);
      const recipe = html ? extractRecipe(html) : undefined;
      if (html && recipe) return { html, via, recipe };
    } catch (err) {
      console.error(`${via} fallback failed for ${url}:`, (err as Error).message);
    }
  }
  if (direct) return { html: direct, via: 'direct' };
  throw firstError ?? new RecipeFetchError('Could not load that page.', 'network');
}

async function fetchFromArchive(url: string): Promise<string | undefined> {
  const cdx = await fetch(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&filter=statuscode:200&fl=timestamp&limit=-1&output=json`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!cdx.ok) return undefined;
  const rows = (await cdx.json()) as string[][];
  const ts = rows.length > 1 ? rows[rows.length - 1][0] : undefined;
  if (!ts) return undefined;
  const res = await fetch(`https://web.archive.org/web/${ts}id_/${url}`, { signal: AbortSignal.timeout(12000) });
  return res.ok ? res.text() : undefined;
}

async function fetchFromReader(url: string): Promise<string | undefined> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'X-Return-Format': 'html' },
    signal: AbortSignal.timeout(15000),
  });
  return res.ok ? res.text() : undefined;
}

export async function fetchHtml(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error();
  } catch {
    throw new RecipeFetchError('That does not look like a valid web address.', 'bad_url');
  }
  let res: Response;
  try {
    res = await fetch(parsed, { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  } catch {
    throw new RecipeFetchError('Could not reach that page.', 'network');
  }
  const html = await res.text();
  if (res.status === 404) throw new RecipeFetchError('That page was not found (404).', 'not_found');
  if (res.status >= 400 || looksLikeChallenge(html)) {
    throw new RecipeFetchError(`The recipe site blocked our request (HTTP ${res.status}).`, 'blocked');
  }
  return html;
}

function looksLikeChallenge(html: string): boolean {
  if (html.length > 50000) return false;
  return /cf-browser-verification|challenge-platform|captcha|Access Denied|px-captcha|Just a moment/i.test(html);
}

export function cleanText(s: string): string {
  const $ = cheerio.load(`<div>${s}</div>`);
  return $('div').text().replace(/\s+/g, ' ').trim();
}

function hasRecipeType(t: unknown): boolean {
  if (typeof t === 'string') return t.toLowerCase() === 'recipe';
  if (Array.isArray(t)) return t.some(hasRecipeType);
  return false;
}

function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!node || typeof node !== 'object' || depth > 8) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  const obj = node as Record<string, unknown>;
  if (hasRecipeType(obj['@type'])) return obj;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipeNode(obj[key], depth + 1);
    if (r) return r;
  }
  return undefined;
}

function pickImage(img: unknown): string | undefined {
  if (!img) return undefined;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return pickImage(img[0]);
  if (typeof img === 'object') {
    const o = img as Record<string, unknown>;
    if (typeof o.url === 'string') return o.url;
  }
  return undefined;
}

function toLines(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(toLines);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return [o.text];
    if (typeof o.name === 'string') return [o.name];
  }
  return [];
}

export function extractRecipe(html: string): ExtractedRecipe | undefined {
  const $ = cheerio.load(html);
  const pageTitle = cleanText($('meta[property="og:title"]').attr('content') || $('title').first().text() || 'Recipe');
  const ogImage = $('meta[property="og:image"]').attr('content');

  // 1. JSON-LD
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    const raw = $(s).contents().text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' '));
      } catch {
        continue;
      }
    }
    const recipe = findRecipeNode(data);
    if (!recipe) continue;
    const lines = toLines(recipe.recipeIngredient ?? recipe.ingredients).map(cleanText).filter(Boolean);
    if (lines.length === 0) continue;
    return {
      title: cleanText(String(recipe.name ?? pageTitle)),
      image: pickImage(recipe.image) ?? ogImage,
      lines,
      method: 'jsonld',
    };
  }

  // 2. Common recipe-plugin selectors
  const selectors = [
    '.wprm-recipe-ingredient',
    '.tasty-recipes-ingredients li',
    '.mv-create-ingredients li',
    '[itemprop="recipeIngredient"]',
    '[itemprop="ingredients"]',
    '.ingredients li',
  ];
  for (const sel of selectors) {
    const lines = $(sel)
      .toArray()
      .map((el) => cleanText($(el).text()))
      .filter((l) => l.length > 1 && l.length < 200);
    if (lines.length >= 2) return { title: pageTitle, image: ogImage, lines, method: 'selectors' };
  }
  return undefined;
}

/** Visible text around the word "Ingredients", for the LLM fallback. */
export function ingredientWindowText(html: string, maxChars = 8000): string {
  const $ = cheerio.load(html);
  $('script,style,nav,footer,header,aside,iframe,noscript,svg,form').remove();
  const text = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const idx = text.search(/ingredients/i);
  const start = idx < 0 ? 0 : Math.max(0, idx - 500);
  return text.slice(start, start + maxChars);
}

/** Splits pasted text into ingredient lines. */
export function linesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•▢☐□]|\d+[.)](?=\s))\s*/, '').trim())
    .filter((l) => l.length > 1 && !/^ingredients:?$/i.test(l));
}
