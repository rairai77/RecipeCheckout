import { z } from 'zod';
import type { Department, Item } from '../shared/types';
import { heuristicNormalize } from './normalize';
import { isStaple } from './staples';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';

const DEPARTMENTS = [
  'produce', 'meat', 'seafood', 'dairy', 'eggs', 'bakery', 'spices', 'baking', 'pantry', 'condiments',
  'international', 'frozen', 'beverages', 'deli', 'other',
] as const satisfies readonly Department[];

export function llmMocked(): boolean {
  return process.env.LLM_MOCK === '1' || !process.env.OR_KEY;
}

interface ChatOptions {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  reasoning?: boolean;
}

async function chatJson({ system, user, schemaName, schema, maxTokens = 4000, reasoning = true }: ChatOptions): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: process.env.OR_MODEL || DEFAULT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    max_tokens: maxTokens,
    provider: {
      order: ['anthropic', 'google-vertex', 'azure'],
      only: ['anthropic', 'google-vertex', 'azure'],
      require_parameters: true,
    },
  };
  if (reasoning) body.reasoning = { effort: process.env.OR_EFFORT || 'low', exclude: true };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://recipecheckout.vercel.app',
      'X-Title': 'RecipeCheckout',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned no content');
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  return JSON.parse(cleaned);
}

// ---------- Ingredient normalization ----------

const NormalizedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
      unit: z.string(),
      searchTerm: z.string().min(2),
      altTerms: z.array(z.string()),
      department: z.enum(DEPARTMENTS),
      avoidWords: z.array(z.string()),
      isPantryStaple: z.boolean(),
      sourceLines: z.array(z.number().int()),
    }),
  ),
});

const NORMALIZE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'searchTerm', 'altTerms', 'department', 'avoidWords', 'isPantryStaple', 'sourceLines'],
        properties: {
          name: { type: 'string', description: 'Short human-friendly ingredient name, e.g. "Chicken thighs"' },
          quantity: { type: 'string', description: 'Total amount as written, e.g. "2" or "1 1/2". Empty if none.' },
          unit: { type: 'string', description: 'Unit, e.g. "lb", "cup", "cloves". Empty if none.' },
          searchTerm: { type: 'string', description: 'Short grocery-store search query, 1-3 words' },
          altTerms: { type: 'array', items: { type: 'string' }, description: '1-2 alternative search queries' },
          department: { type: 'string', enum: [...DEPARTMENTS] },
          avoidWords: { type: 'array', items: { type: 'string' }, description: 'Lowercase words that indicate a wrong product' },
          isPantryStaple: { type: 'boolean' },
          sourceLines: { type: 'array', items: { type: 'integer' }, description: 'Indexes of the input lines merged into this item' },
        },
      },
    },
  },
};

const NORMALIZE_SYSTEM = `You turn recipe ingredient lines into a grocery shopping list for a US supermarket (Kroger/QFC/Fred Meyer).
For each distinct thing to buy, output one item:
- searchTerm: what you would type into the store's search box to find the product. 1-3 words, generic, no brand, no prep words (chopped, minced, softened), no quantities. Prefer the purchasable form: "2 cloves garlic, minced" -> "garlic"; "boneless skinless chicken thighs" -> "chicken thighs"; "fresh cilantro" -> "cilantro"; "1 can diced tomatoes" -> "diced tomatoes"; "unsalted butter" -> "unsalted butter".
- altTerms: 1-2 broader or alternative queries in case the first finds nothing (e.g. "chicken thigh", "cilantro bunch").
- avoidWords: 2-6 lowercase words that appear in WRONG products for a naive search (e.g. for fresh chicken thighs: broth, seasoning, soup, dog; for lemongrass: soap, dish, tea, candle; for fish sauce: cocktail, tartar). Never include words from the searchTerm.
- Merge duplicate ingredients (e.g. butter used twice) into one item and list all their line indexes in sourceLines.
- Skip lines that are section headers or not ingredients (e.g. "For the sauce:"). Skip water and ice.
- isPantryStaple: true for salt, black pepper, cooking oil, all-purpose flour, white sugar, and similar things most kitchens already have.
- name: short display name. quantity/unit: combined amount if merged and sensible, otherwise the first one.`;

export async function normalizeIngredients(lines: string[]): Promise<{ items: Item[]; by: 'llm' | 'heuristic' }> {
  if (llmMocked()) return { items: heuristicNormalize(lines), by: 'heuristic' };
  const user = `Ingredient lines (index: text):\n${lines.map((l, i) => `${i}: ${l}`).join('\n')}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await chatJson({
        system: NORMALIZE_SYSTEM,
        user,
        schemaName: 'shopping_list',
        schema: NORMALIZE_JSON_SCHEMA,
        reasoning: attempt === 0,
      });
      const parsed = NormalizedSchema.parse(raw);
      const items: Item[] = parsed.items
        .filter((it) => it.searchTerm.trim().length >= 2)
        .map((it, i) => {
          const termWords = new Set(it.searchTerm.toLowerCase().split(/\s+/));
          return {
            id: `i${i + 1}`,
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            searchTerm: it.searchTerm.trim().toLowerCase(),
            altTerms: it.altTerms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 3).slice(0, 2),
            department: it.department,
            avoidWords: it.avoidWords.map((w) => w.toLowerCase().trim()).filter((w) => w && !termWords.has(w)),
            isPantryStaple: it.isPantryStaple || isStaple(it.searchTerm),
            raw: it.sourceLines.map((n) => lines[n]).filter(Boolean),
          };
        });
      if (items.length > 0) return { items: mergeDuplicates(items), by: 'llm' };
    } catch (err) {
      console.error(`normalize attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return { items: heuristicNormalize(lines), by: 'heuristic' };
}

function mergeDuplicates(items: Item[]): Item[] {
  const byTerm = new Map<string, Item>();
  const out: Item[] = [];
  for (const it of items) {
    const prev = byTerm.get(it.searchTerm);
    if (prev) {
      prev.raw.push(...it.raw);
      prev.altTerms = [...new Set([...prev.altTerms, ...it.altTerms])].slice(0, 2);
      prev.avoidWords = [...new Set([...prev.avoidWords, ...it.avoidWords])];
      continue;
    }
    byTerm.set(it.searchTerm, it);
    out.push(it);
  }
  return out.map((it, i) => ({ ...it, id: `i${i + 1}` }));
}

// ---------- Extraction fallback ----------

const EXTRACT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'ingredients'],
  properties: {
    title: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
  },
};
const ExtractSchema = z.object({ title: z.string(), ingredients: z.array(z.string()) });

export async function extractIngredientsWithLlm(pageText: string): Promise<{ title: string; lines: string[] } | undefined> {
  if (llmMocked()) return undefined;
  try {
    const raw = await chatJson({
      system:
        'Extract the recipe title and its ingredient list from this web page text. Return each ingredient line exactly as written. If there is no recipe, return an empty ingredients array.',
      user: pageText,
      schemaName: 'recipe_ingredients',
      schema: EXTRACT_JSON_SCHEMA,
      maxTokens: 3000,
    });
    const parsed = ExtractSchema.parse(raw);
    if (parsed.ingredients.length === 0) return undefined;
    return { title: parsed.title, lines: parsed.ingredients };
  } catch (err) {
    console.error('LLM extraction failed:', (err as Error).message);
    return undefined;
  }
}
