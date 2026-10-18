# RecipeCheckout

Paste a recipe URL, pick a location, and get a shopping list with the **aisle, side and shelf** of every ingredient at your nearest Kroger-family store (QFC, Fred Meyer, Kroger, Ralphs, King Soopers, ...). Items a store doesn't have are searched at the next nearest store (up to 3).

Built with Expo Router + React Native Web (static SPA) and plain Vercel Node functions in `api/`.

## How it works

1. `POST /api/recipe` fetches the page, reads the schema.org `Recipe` JSON-LD (falls back to common recipe-plugin selectors, then an LLM), and makes **one** LLM call (Claude Haiku 5.5 via OpenRouter, low reasoning effort) that turns the ingredient lines into grocery search terms, alternates, department, "avoid" words and pantry-staple flags. If the LLM is unavailable a heuristic parser is used instead.
2. `GET /api/stores?lat=&lng=` (or `?zip=`) finds the 3 nearest stores with the Kroger Locations API.
3. `POST /api/search` searches one store's catalog (Kroger Products API with `filter.locationId`, which returns aisle locations, price and stock) for all pending items in parallel, and picks the best match with a no-LLM heuristic (term words must appear, avoid words and non-food categories are rejected, aisle and stock are preferred). The client calls it store by store with whatever is still unavailable.

## Environment variables

| Var | Purpose |
|---|---|
| `KR_ID`, `KR_SECRET` | Kroger developer API client id/secret (`product.compact` scope) |
| `OR_KEY` | OpenRouter API key |
| `OR_MODEL` | optional, default `anthropic/claude-haiku-5.5` |
| `OR_EFFORT` | optional reasoning effort, default `low` |
| `LLM_MOCK=1` | use the heuristic parser instead of the LLM |

## Development

```bash
npm install
npm test                 # unit tests (extraction, parsing, matching)
npm run typecheck
npx expo start --web     # UI only; add ?mock=1 to use mock API data
npx vercel dev           # UI + API functions locally
npx tsx scripts/try-search.ts 70500887 "chicken thighs" "garlic"   # real Kroger search at QFC Broadway
```

Rules for `api/` and `lib/server/`: relative imports only (no `@/` alias), keep TypeScript at Expo's pinned `~6.0`, and nothing in `app/` may import server code.
