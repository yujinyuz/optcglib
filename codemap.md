# optcgdb/

Offline-first One Piece TCG card database browser. Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand. SQLite (sql.js WASM) runs in a Web Worker. Data sourced from a local clone of `buhbbl/punk-records`.

## Responsibility

The repo owns the **full data pipeline**: ingesting raw card JSON from punk-records, seeding a SQLite database, serving it to the browser via Vite, and rendering a search/filter UI. It also provides deployment config for Netlify and scaffolding for price scraping.

### Root-level files

| File | Role |
|------|------|
| `seed.py` | Python ETL script — reads punk-records JSON, populates `optcg.db` |
| `schema.sql` | SQLite schema — 10 tables (cards, packs, card_images, cards_fts, junction tables, translations) with composite indexes |
| `justfile` | Task runner: `build`, `dev`, `seed`, `cpdb` |
| `netlify.toml` | Netlify SPA deploy — copies DB at build time, Node 22, SPA redirects |
| `AGENTS.md` | Agent instructions — architecture, conventions, commands |
| `PRODUCT.md` | Product context — users (players/collectors), principles (offline-first, speed over polish) |
| `codemap.md` | This file — architectural overview |
| `scrapers/` | (Scaffolding) Python price scraper — currently empty (only `__pycache__/`) |
| `vendor/` | `.gitignore`d — must clone `https://github.com/buhbbl/punk-records` here |
| `app/` | Vite + React frontend — the browser application |

## Design Patterns

### Multi-source data merging

The DB seed (`seed.py`) processes languages in order. The **first language** is the **primary source** for card data:

1. **Primary** (default: `english-asia`) — inserts rows into `cards`, junction tables (`card_colors`, `card_attributes`, `card_types`), FTS index, and image/pack membership tables.
2. **Secondary** (default: `english`, `japanese`) — cards already in the `cards` table are **skipped** for card data. But their **pack memberships** and **image URLs** are still recorded in `card_packs` / `card_images`. Non-primary languages also populate `card_translations`.

Result: ~4,700 unique cards, ~13,000 pack memberships + image variants. Deduplication happens at **seed time**, not query time.

**Block number resolution**: Japanese source provides block numbers (1-5). `build_block_number_map()` scans all languages to build a `base_id → block_number` map. If ANY variant of a card has a null block_number, the entire card is treated as Block X (null).

**Japanese image derivation**: `fill_missing_japanese_images()` derives JP image URLs from English entries by swapping `en.onepiece-cardgame.com` → `www.onepiece-cardgame.com` for cards missing Japanese images.

**English-asia effect patch**: When english-asia has `<br>` in effect/trigger text that english lacks, the primary entry is updated with the richer text.

### FTS indexing

- `cards_fts` is an FTS4 virtual table using `unicode61` tokenizer.
- After all languages are processed, `rebuild_fts_index()` reconstructs the index by concatenating card data + all translations + types + colors.
- Search uses a **CTE**: `WITH _search_ids AS (SELECT card_id FROM cards_fts WHERE search_text MATCH '?*' UNION SELECT id FROM cards WHERE id LIKE '%?%')`.
- FTS MATCH is never combined with `OR` against regular columns — SQLite FTS doesn't handle that correctly.

### Pack sort order

`PACK_SORT_ORDER` in `seed.py` is a manual priority list (newest first: ST-36, OP-16, ..., OP-01). Unlisted packs derive sort order from regex pattern matching on `(OP|ST|EB|PRB)-NN`. `compute_pack_sort_order()` maps labels to integers — lower = displayed first.

### QueryBuilder pattern (app layer)

The Web Worker (`app/src/workers/db.worker.ts`) uses a **QueryBuilder** class for dynamic SQL construction:

```ts
const q = new QueryBuilder();
q.where('c.category IN (?)', 'Leader');
q.join('_search_ids _s ON c.id = _s.id');
const { sql, params } = q.select('c.id, c.name', 'cards c', 50, 0);
```

### Filter state architecture

Filters are **URL-synced** via `history.replaceState`. The Zustand store reads initial filters from `URLSearchParams` on init. Mapping:

| URL param | Store field |
|-----------|-------------|
| `?q=` | `filters.search` |
| `?colors=` | `filters.colors` |
| `?categories=` | `filters.categories` |
| `?rarities=` | `filters.rarities` |
| `?attributes=` | `filters.attributes` |
| `?set=` | `filters.setPrefix` |
| `?costMin=,costMax=` | cost range |
| `?powerMin=,powerMax=` | power range |
| `?blocks=` | `filters.blocks` |

## Data & Control Flow

```
vendor/punk-records/  (git clone of buhbbl/punk-records)
  ├── english-asia/
  │   ├── packs.json          → seed_packs() → packs table
  │   └── data/{pack_id}.json → seed_cards() → cards + junction + FTS
  ├── english/                → card_packs, card_images (card data skipped if exists)
  └── japanese/               → card_packs, card_images, card_translations
        │
        ▼
    seed.py --clean
        │
        ▼
    optcg.db  (~10.6 MB, SQLite WAL mode)
        │
        ▼  cp optcg.db app/public/optcg.db
        │
        ▼
    app/  (Vite dev / build)
      ├── public/optcg.db        → served as static asset
      ├── public/sql-wasm-browser.wasm  → sql.js binary (auto-copied)
      │
      ├── src/workers/db.worker.ts  → Web Worker: loads DB via sql.js, handles queries
      ├── src/db.ts                 → async client: postMessage to worker
      ├── src/store.ts              → Zustand: search() dispatches to db.ts, syncs URL
      ├── src/types.ts              → TypeScript types: Card, Pack, CardFilters
      ├── src/utils.ts              → HTML entity decode, keyword highlighting
      └── src/components/           → React components (FilterBar, CardGrid, CardDetail, etc.)
              │
              ▼
        Browser PWA
```

### Seed pipeline (detail)

1. `create_database()` — creates fresh `optcg.db` from `schema.sql` (removes WAL companions when `--clean`).
2. `build_block_number_map()` — scans ALL languages first to compute block numbers per card.
3. For each language (in order):
   - `seed_packs()` — `INSERT OR REPLACE INTO packs`.
   - `seed_cards()` — two passes: (a) determine canonical card data per `base_id`, (b) insert into `cards` (primary only), (c) insert into `card_packs`, `card_images`, junction tables, FTS, and `card_translations`.
4. `rebuild_fts_index()` — reconstructs full FTS index from cards + translations + types + colors.
5. `fill_missing_japanese_images()` — derives JP image URLs from English entries where missing.
6. `update_card_sort_orders()` — syncs `cards.sort_order` from the minimum pack sort order per card.

### App boot flow

1. User loads PWA → Vite serves `index.html` + `optcg.db` + WASM.
2. `db.ts` spawns a Web Worker (`db.worker.ts`).
3. Worker loads `optcg.db` via `sql.js` (in-browser SQLite compiled to WASM).
4. Web Worker replies `ready`. `db.ts` queues pending requests, dispatches them.
5. `store.ts` reads URL params, calls `db.search()`, populates Zustand state.
6. React components render cards from store. Image fallback on error → text layout.

## Integration Points

### External data source

- **`vendor/punk-records/`** — must be a local clone of `https://github.com/buhbbl/punk-records`. `.gitignore`d.
- Update cycle: `git pull`, `python3 seed.py --clean`, `cp optcg.db app/public/optcg.db`.
- Each language directory contains `packs.json` (set metadata) and `data/{pack_id}.json` (card arrays).

### App consumer

- **`app/public/optcg.db`** — the DB copied to the public directory. Must stay under 12 MB (PWA `vite-plugin-pwa` `maxFileSize` limit).
- Frontend never imports `sql.js` directly — always goes through `db.ts` → Web Worker.
- New DB queries: add handler in `db.worker.ts` (QueryBuilder pattern), expose via `db.ts`.
- New filter fields: update `types.ts` `CardFilters`, `db.worker.ts` `queryCards()`, `store.ts` URL sync, `FilterBar.tsx`.

### Deployment

- **Netlify** (`netlify.toml`): build from `app/`, copies `optcg.db` from root before `npm ci && npm run build`. SPA redirects all routes to `index.html`.
- **PWA constraint**: `vite-plugin-pwa` `maxFileSize=12MB`. Current DB ~10.6 MB.

### Scrapers (price data)

- `scrapers/` directory exists with `__pycache__/` but no source files currently tracked.
- Scaffolding for Python price scraping (e.g., yuyutei for Japanese market prices).
- Not wired into the main pipeline.

## Schema Quick Reference

| Table | Rows | Purpose | Key columns |
|-------|------|---------|-------------|
| `cards` | ~4,700 | One row per unique card ID | `id`, `base_id`, `name`, `rarity`, `category`, `cost`, `power`, `counter`, `colors_json` |
| `packs` | ~100 | Pack/set metadata per language | `id`, `label` (OP-01), `sort_order` |
| `card_packs` | ~13,000 | Which packs contain which cards | `(card_id, pack_id, language)` |
| `card_images` | ~13,000 | Image URLs per language variant | `(card_id, language)`, `img_url`, `img_full_url` |
| `card_translations` | ~4,700 | Localized text (non-english) | `(card_id, language)`, `name`, `effect` |
| `card_colors` | ~8,000 | Many-to-many colors | `(card_id, color)` — e.g. Red, Blue |
| `card_attributes` | ~4,000 | Many-to-many attributes | `(card_id, attribute)` — e.g. Strike, Slash |
| `card_types` | ~10,000 | Many-to-many types/factions | `(card_id, type)` — e.g. Straw Hat Crew |
| `cards_fts` | ~9,000 | FTS4 virtual table | `card_id`, `search_text` (unicode61) |

## Repository Directory Map

| Directory | Codemap | Scope |
|-----------|---------|-------|
| `app/` | [`app/codemap.md`](app/codemap.md) | Build tooling, Vite config, PWA, TypeScript |
| `app/src/` | [`app/src/codemap.md`](app/src/codemap.md) | Core app layer — store, db client, types, utils, CSS |
| `app/src/components/` | [`app/src/components/codemap.md`](app/src/components/codemap.md) | React components — grid, cards, filters, modals |
| `app/src/lib/` | [`app/src/lib/codemap.md`](app/src/lib/codemap.md) | Shared libraries — filters, gestures, spring animations |
| `app/src/workers/` | [`app/src/workers/codemap.md`](app/src/workers/codemap.md) | Web Worker — all SQLite queries, QueryBuilder, FTS search |
| `scrapers/` | *(scaffolding — no codemap yet)* | Python price scrapers |

## Key Constraints

- **DB size**: Keep under 12 MB (PWA limit).
- **No direct sql.js import in components**: All SQL runs in Web Worker.
- **TypeScript strictness**: `noUnusedLocals` and `noUnusedParameters` enabled — build fails on dead code.
- **Mobile**: iOS Safari inputs zoom on font-size < 16px — use `text-base` mobile, `text-sm` at `sm:` breakpoint. No `dvh` units (breaks DevTools). `min-h-screen` for scroll areas.
- **Dark mode**: `class`-based via `<html class="dark">`. Persisted in `localStorage` key `optcg-theme`.
