import type { RecipeResponse } from '../lib/shared/types';
import { errorJson, json } from '../lib/server/http';
import { extractIngredientsWithLlm, normalizeIngredients } from '../lib/server/llm';
import { RecipeFetchError, extractRecipe, fetchHtml, ingredientWindowText, linesFromText } from '../lib/server/recipe';

const cache = new Map<string, RecipeResponse>();

export async function POST(request: Request): Promise<Response> {
  let body: { url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson('Invalid JSON body', 400, 'bad_request');
  }

  try {
    if (body.text && body.text.trim()) {
      const lines = linesFromText(body.text).slice(0, 80);
      if (lines.length === 0) return errorJson('No ingredient lines found in the pasted text.', 422, 'no_recipe');
      const { items, by } = await normalizeIngredients(lines);
      return json({ title: 'Pasted recipe', extraction: 'text', normalizedBy: by, items } satisfies RecipeResponse);
    }

    const url = (body.url ?? '').trim();
    if (!url) return errorJson('Enter a recipe URL or paste ingredients.', 400, 'bad_url');
    const cached = cache.get(url);
    if (cached) return json(cached);

    const html = await fetchHtml(url);
    let title: string;
    let image: string | undefined;
    let lines: string[];
    let extraction: RecipeResponse['extraction'];
    const found = extractRecipe(html);
    if (found) {
      ({ title, image, lines } = found);
      extraction = found.method;
    } else {
      const llm = await extractIngredientsWithLlm(ingredientWindowText(html));
      if (!llm) {
        return errorJson("Couldn't find an ingredient list on that page. Try pasting the ingredients instead.", 422, 'no_recipe');
      }
      title = llm.title || 'Recipe';
      lines = llm.lines;
      extraction = 'llm';
    }

    const { items, by } = await normalizeIngredients(lines.slice(0, 80));
    const result: RecipeResponse = { title, image, sourceUrl: url, extraction, normalizedBy: by, items };
    if (by === 'llm') cache.set(url, result);
    return json(result);
  } catch (err) {
    if (err instanceof RecipeFetchError) {
      const status = err.code === 'bad_url' ? 400 : err.code === 'not_found' ? 404 : 502;
      return errorJson(`${err.message} Try pasting the ingredients instead.`, status, err.code);
    }
    console.error('recipe error', err);
    return errorJson('Something went wrong reading that recipe.', 500, 'server');
  }
}
