# OPTCG DB — Agent Instructions

## What this is

Offline-first One Piece TCG card database browser. Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand. SQLite (sql.js WASM) runs in a Web Worker. Data sourced from a local clone of `buhbbl/punk-records`.

## Directory layout

```
/
  schema.sql          — SQLite schema
  seed.py             — populate DB from vendor/punk-records JSON
  optcg.db            — generated SQLite DB (root copy)
  vendor/             — punk-records clone (NOT tracked)
  app/
    package.json      — npm scripts, dependencies
    src/
      workers/db.worker.ts  — ALL SQLite queries run here (Web Worker)
      db.ts                — async client wrapper; talks to worker
      store.ts             — Zustand store; search() is async; filters sync to URL
      types.ts             — Card, Pack, filters, constants
      utils.ts             — HTML entity decode, keyword highlighting
      components/          — React components
    public/
      optcg.db          — DB served to browser (copied from root)
      sql-wasm-browser.wasm  — sql.js binary (auto-copied by build)
```

## Commands

| Task | Command | Notes |
|------|---------|-------|
| Build | `cd app && npm run build` | `tsc -b && vite build`. Must run from `app/`. |
| Dev server | `cd app && npm run dev` | Vite dev server |
| Re-seed DB | `python3 seed.py --clean` | Creates `optcg.db` at root. English-Asia is primary source; English and Japanese contribute images/pack memberships for existing cards. |
| Copy DB to app | `cp optcg.db app/public/optcg.db` | Required after every re-seed. |
| Lint | `cd app && npm run lint` | ESLint only. No test runner configured. |

**Shortcut**: The user has an `rtk` alias that runs commands from the `app/` directory. Use `rtk npm run build` from root.

## Database architecture

### Seeding (`seed.py`)

- **Primary source**: `english-asia` (most complete card set). Inserts into `cards` + junction tables + FTS.
- **Secondary sources**: `english`, `japanese`. Cards already in the primary table are **skipped**, but their pack memberships and image URLs are still recorded in `card_packs` and `card_images`.
- Result: ~4,700 unique cards. ~13,000 pack memberships + image variants.
- Deduplication happens at **seed time**, not query time.

### Schema

- `cards` — one row per unique card ID. JSON columns `colors_json`, `attributes_json`, `types_json`. **No `pack_id`, `language`, `img_url` columns.**
- `card_packs` — which packs (and from which language source) contain each card.
- `card_images` — image URLs per language variant (english-asia, english, japanese).
- `cards_fts` — FTS4 virtual table for text search.
- Junction tables (`card_colors`, `card_attributes`, `card_types`) use `(card_id, value)` PK — data is identical across languages.

### Web Worker (`src/workers/db.worker.ts`)

**All SQLite operations run in a Web Worker.** `db.ts` is a thin async wrapper that sends messages via `postMessage`. Never import `sql.js` directly into a React component — always go through `db.ts`.

The worker uses a **QueryBuilder** class for SQL construction. New queries should use the builder pattern:

```ts
const q = new QueryBuilder();
q.where('c.category IN (?)', 'Leader');
q.join('_search_ids _s ON c.id = _s.id');
const { sql, params } = q.select('c.id, c.name', 'cards c', 50, 0);
```

### Search implementation

Search uses a **CTE** that combines FTS text matching + partial ID matching:

```sql
WITH _search_ids AS (
  SELECT card_id as id FROM cards_fts WHERE search_text MATCH 'Luffy*'
  UNION
  SELECT id FROM cards WHERE id LIKE '%Luffy%'
)
SELECT ... FROM cards c JOIN _search_ids _s ON c.id = _s.id
```

**Never** put `MATCH` inside an `OR` with a regular table column — SQLite FTS virtual tables don't handle that correctly.

Queries LEFT JOIN `card_images` filtered to `language = 'english-asia'` to provide a default display image per card.

## Filter state architecture

**Filters are URL-synced.** The store reads initial filters from `URLSearchParams` on init, and writes back via `history.replaceState` on every change.

| URL param | Maps to |
|-----------|---------|
| `?q=Luffy` | `filters.search` |
| `?colors=Red,Blue` | `filters.colors` |
| `?categories=Leader` | `filters.categories` |
| `?rarities=Rare` | `filters.rarities` |
| `?attributes=Strike` | `filters.attributes` |
| `?set=OP01` | `filters.setPrefix` |
| `?costMin=1&costMax=5` | cost range |
| `?powerMin=1000&powerMax=5000` | power range |
| `?blocks=1,2` | `filters.blocks` |

## TypeScript gotchas

`tsconfig.app.json` enables strict dead-code checks:
- `noUnusedLocals: true` — unused locals fail build
- `noUnusedParameters: true` — unused params fail build

Always clean up unused imports and variables.

## Data source

`vendor/punk-records/` must be a local clone of `https://github.com/buhbbl/punk-records`. It is `.gitignore`d. To update data:

```bash
cd vendor/punk-records && git pull && cd ../..
python3 seed.py --clean
cp optcg.db app/public/
```

## Adding new features

- **New DB queries** → add handler to `db.worker.ts` using `QueryBuilder` + `db.ts` client wrapper
- **New filter fields** → add to `types.ts` `CardFilters`, update `queryCards()` in worker, update URL sync in `store.ts`, update `FilterBar.tsx`
- **New components** → place in `src/components/`. Keep Tailwind v4 utility classes.
- **Images** → Card tiles attempt to load `card.img_url` (English-Asia default) with `<img crossorigin="anonymous">`. On error, fall back to text layout. Detail page shows per-variant external links.

## Dark mode

Toggle via `document.documentElement.classList.toggle('dark')`. Tailwind `dark:` variants are active. Theme persisted in `localStorage` key `optcg-theme`.