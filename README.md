# RecipeCheckout

Paste a recipe URL, pick a location, and get a shopping list with the **aisle, side and shelf** of every ingredient at a nearby Kroger-family store (QFC, Fred Meyer, Kroger, Ralphs, King Soopers, ...). The whole list is checked at the 3 nearest stores (and your preferred stores), and the list goes to one store that has everything whenever there is one.

Built with Expo Router + React Native Web (static SPA) and plain Vercel Node functions in `api/`.

## How it works

1. `POST /api/recipe` fetches the page, reads the schema.org `Recipe` JSON-LD (falls back to common recipe-plugin selectors, then an LLM), and makes **one** LLM call (Claude Haiku 5.5 via OpenRouter, low reasoning effort) that turns the ingredient lines into grocery search terms, alternates, department, "avoid" words and pantry-staple flags. If the LLM is unavailable a heuristic parser is used instead.
2. `GET /api/stores?lat=&lng=` (or `?zip=`) finds the 3 nearest stores with the Kroger Locations API.
3. `POST /api/search` searches one store's catalog (Kroger Products API with `filter.locationId`, which returns aisle locations, price and stock) for all the items in parallel, and picks the best match with a no-LLM heuristic (term words must appear, avoid words and non-food categories are rejected, aisle and stock are preferred). The client calls it once per candidate store (the 3 nearest plus any preferred stores, 3 at a time) with the whole list.
4. `lib/shared/plan.ts` picks where to shop: the first preferred store that has everything, else the nearest store that has everything, else a split that fills from preferred stores first, then by distance. When several stores have everything the results compare them (Cheapest, Nearest) and say when another store is cheaper. Preferred stores are starred on a store card and live in localStorage; they are listed under "Your stores" in the location menu.

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

## Deploying

- **Live:** https://recipecheckout.vercel.app, version 2 (this branch), launched 2026-10-18.
- **Dev:** https://recipecheckout2.vercel.app, a separate Vercel project with the same env vars. Build and check new work here first.

`scripts/deploy.sh` deploys to dev by default. `scripts/deploy.sh live` promotes to the live site, so only run it on purpose.

## Demo replay

Add `?demo=1` to the URL to replay a recorded real run (BBC Good Food chicken tikka masala, QFC stores near South Lake Union: the nearest store lacks two items, so QFC Broadway Market is the one-stop plan and QFC Harvard Market is flagged as $6.90 cheaper) with no network calls, in case venue wifi or an API fails. Any recipe link works in this mode. `?demo=0` turns it off. The recording lives in `lib/client/demo-run.json`. `?mock=1` uses small hand-written mock data for UI development instead.

## Recipe sites

Pages are fetched directly with browser headers. Sites behind Cloudflare bot walls (AllRecipes, Serious Eats, Simply Recipes) block Vercel's datacenter IPs regardless of headers, so the server falls back to the latest good Wayback Machine capture, then the r.jina.ai reader. If all fail, the UI offers "paste ingredients instead".
