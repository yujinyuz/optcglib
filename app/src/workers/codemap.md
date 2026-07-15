# db.worker.ts — Web Worker Database Module

## Responsibility

All SQLite queries execute exclusively in this Web Worker. It owns a single `sql.js` WASM database instance and communicates with the main thread through `postMessage`. No React component ever imports `sql.js` directly — all access flows through this worker.

## Design Patterns

### Web Worker Isolation
- **`db` variable** (`Database | null`) — initialized once via the `init` message, then reused for every query. Never accessed from the main thread.
- **Singleton worker** — `db.ts` creates one worker instance via `new Worker(...)` and reuses it for all requests.
- **Message dispatch** — a single `self.onmessage` handler routes by `type` string (`init`, `queryCards`, `queryPacks`, `querySets`, `queryBlocks`, `getCardById`, `getCardPacks`, `getCardImages`, `getRelatedCards`, `getCardVariants`, `getStats`, `queryImageUrlsBySets`, `queryAllSetImageUrls`).

### QueryBuilder Pattern
- **Fluent builder** — `new QueryBuilder().where(...).join(...).select(...)` — wraps CTE accumulation, join clauses, parameterized WHERE conditions, ORDER BY, and pagination.
- **Parameter safety** — all user input passes through `?` placeholders; parameters are collected from CTEs and conditions into a flat array via `allParams()`.
- **CTE support** — `withCte(name, sql, ...params)` accumulates `WITH` clauses. Used for FTS search in `_search_ids`.
- **Dedup helper** — `dedup(table, groupByExpr)` rewrites conditions with a `c2.` alias prefix and wraps them in a `MIN(id)` subquery for variant deduplication.
- **Count + data queries** — `count(from)` always runs first to get `total` before paginated `select(cols, from, limit, offset)`.

### CTE Search
- **Combined FTS + partial ID matching*** — the `_search_ids` CTE unions full-text search (`cards_fts` via `MATCH`) with `LIKE` on `id` and `base_id`. This avoids `MATCH` inside `OR` (which FTS virtual tables handle incorrectly).
- **Scoped search** — when `searchScope` is provided (name, effect, trigger, type), falls back to `LIKE` queries against individual columns instead of FTS.
- **Cost parsing** — `parseCostFromSearch()` extracts `\d+c`, `cost:N`, or `Ncost` patterns from query text and applies them as a `c.cost = ?` filter, stripping the cost token from the search string.

### Image Aggregation
- **Inline subquery** — a `LEFT JOIN` against a grouped `card_images` subquery pivots the three language variants into columns (`img_en`, `img_ea`, `img_jp`). No separate `card_best_images` table.
- **Fallback chain** — `COALESCE(ci.img_en, ci.img_ea, ci.img_jp) as img_url` produces one display image per card, preferring english → english-asia → japanese.

### Japanese Translation Support
- **Translation join** — when `preferredLanguage === 'japanese'`, a `LEFT JOIN card_translations t ON c.base_id = t.card_id AND t.language = 'japanese'` is added.
- **COALESCE fallback** — `COALESCE(t.name, c.name)`, `COALESCE(t.effect, c.effect)`, `COALESCE(t.trigger_text, c.trigger_text)`, and `COALESCE(t.types_json, c.types_json)` override card fields with Japanese text when available.

## Data & Control Flow

### Message Protocol

Every message from the main thread includes: `{ type: string, id: string, payload?: unknown }`.

Every response from the worker includes: `{ type: 'init-done' | 'result' | 'error', id: string, data?: unknown, error?: string }`.

The `id` field is a sequential counter assigned by `db.ts` and is used to resolve/reject the corresponding Promise in `pendingRequests`.

### Initialization Flow

```
db.ts: initDB()
  → worker.postMessage({ type: 'init', id: '1' })
  → worker: initSqlJs({ locateFile }) → fetch('/optcg.db') → new SQL.Database(buffer)
  → worker: sanity-check (verify sort_order column exists)
  → worker: self.postMessage({ type: 'init-done', id: '1' })
```

### Query Flow

```
db.ts: queryCards(filters)
  → worker.postMessage({ type: 'queryCards', id: '2', payload: filters })
  → worker: QueryBuilder builds WHERE/CTE/JOIN clauses
  → worker: count query → total
  → worker: data query with COALESCE image + has_parallel EXISTS subquery → rows → rowToCard()
  → worker: self.postMessage({ type: 'result', id: '2', data: { cards, total } })
  → db.ts: pendingRequests resolves with { cards, total }
```

### Row-to-Card Mapping

`rowToCard(row)` maps positional array index to fields — order must match the SQL column list exactly:

| Index | Column             | Type              |
|-------|--------------------|-------------------|
| 0     | `c.id`             | PK string         |
| 1     | `c.base_id`        | dedup group key   |
| 2     | `c.name`           | string            |
| 3     | `c.rarity`         | string            |
| 4     | `c.category`       | string            |
| 5     | `c.cost`           | number            |
| 6     | `c.power`          | number            |
| 7     | `c.counter`        | number            |
| 8     | `c.effect`         | text              |
| 9     | `c.trigger_text`   | text              |
| 10    | `c.block_number`   | number            |
| 11    | `colors_json`      | JSON array string |
| 12    | `attributes_json`  | JSON array string |
| 13    | `types_json`       | JSON array string |
| 14    | `img_url`          | string (queryCards only) |
| 15    | `has_parallel`     | boolean (queryCards only) |

`buildCardColumns()` adjusts the first four text fields (name, effect, trigger_text, types_json) to use `COALESCE(t.col, c.col)` when `preferredLanguage === 'japanese'`.

### Image URL Coalesce Logic

| Function | Precedence |
|----------|-----------|
| `queryCards` | `COALESCE(img_en, img_ea, img_jp)` |
| `queryImageUrlsBySets` / `queryAllSetImageUrls` (language='english') | `english-asia > english > japanese` |
| `queryImageUrlsBySets` / `queryAllSetImageUrls` (language='japanese') | `japanese > english-asia > english` |
| `getCardVariants` variant images | `english > english-asia > japanese` |

## Integration Points

### Consumed by: `app/src/db.ts`

Thin async wrapper that manages the worker lifecycle and pending request map:
- Creates worker on first call via `new Worker(new URL('./workers/db.worker.ts', import.meta.url), { type: 'module' })`
- Generates sequential request IDs
- Maps each outgoing message ID to a `{ resolve, reject }` pair
- Each exported function (`initDB`, `queryCards`, `queryPacks`, etc.) sends a typed request and returns `Promise<T>`

### Seeded by: `app/../seed.py`

Populates the database (`optcg.db`) that the worker loads at init:
- `cards` — one row per unique card ID (JSON columns for colors, attributes, types)
- `card_packs` + `packs` — pack membership per language source
- `card_images` — image URLs per language variant (english-asia, english, japanese)
- `cards_fts` — FTS4 virtual table for text search
- `card_translations` — Japanese name/effect/trigger/type overrides

### Schema: `schema.sql`

All tables, indexes, and FTS configuration are defined here. The worker queries against this schema.

## Dependencies

- **sql.js** (WASM) — loaded in worker via `initSqlJs({ locateFile })`
- **/optcg.db** — fetched at init time (served from `app/public/`, ~10.6 MB, must stay under 12 MB for PWA)
- **/sql-wasm-browser.wasm** — sql.js binary (auto-copied by build)

## Error Handling

All database operations are wrapped in a single `try/catch` inside `self.onmessage`. Errors are serialized via `String(err)` and returned as `{ type: 'error', id, error: string }`. Unknown message types also return an error. The main thread's `pendingRequests` map rejects the corresponding promise on any error response.

## Performance Considerations

- **DB loaded once** — `fetch('/optcg.db', { cache: 'no-store' })` on every `init` to avoid stale cache; the ~10.6 MB binary must load before any query succeeds.
- **Count before data** — every paginated query runs count + data sequentially (same QueryBuilder instance), not in parallel.
- **Variant queries are expensive** — `getCardVariants` runs N+1 queries: one for the variant list, then per-variant image + pack lookups.
- **Inline aggregation** — image pivoting via grouped subquery avoids a separate table and extra round trips.
