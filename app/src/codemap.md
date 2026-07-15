# app/src/

## Responsibility

Application entry point and core layer. Contains the React root, router, global state, DB client, type definitions, utilities, styles, and PWA plumbing. This is the hub every other module connects to.

## Design Patterns

### Web Worker Proxy (`db.ts`)
Every SQLite query runs in a dedicated Web Worker (`workers/db.worker.ts`). `db.ts` is a thin async wrapper that sends typed `postMessage` requests and resolves Promises from worker responses. Never import `sql.js` outside the worker — `db.ts` is the only client-facing API.

```ts
// db.ts registers a pending promise per request ID, worker replies are dispatched by ID
function sendRequest<T>(type: string, payload?: unknown): Promise<T>
```

Exported operations: `initDB`, `queryCards`, `queryPacks`, `querySets`, `queryBlocks`, `getCardById`, `getCardPacks`, `getCardVariants`, `getStats`, `queryImageUrlsBySets`, `queryAllSetImageUrls`.

### Zustand Store with URL-Synced Filters (`store.ts`)
Single `useAppStore` hook manages all global state. Filters are serialized to/from `URLSearchParams`:
- **Init**: `readUrlFilters()` reads `window.location.search` and merges with `DEFAULT_FILTERS`
- **On change**: `writeUrlFilters()` calls `history.replaceState(null, '', newUrl)` — no navigation
- All filter setters (`setFilters`, `setSearchScope`, `resetFilters`) trigger `get().search()` automatically
- `searchInput` is debounced (1s timer) before URL sync to avoid typing flicker

### State categories
| Category | Keys | Persisted |
|----------|------|-----------|
| Search results | `cards`, `totalCards`, `hasMore`, `searching`, `searchLoading` | ephemeral |
| Filters | `filters` (CardFilters shape), `searchInput` | URL params |
| Metadata | `packs`, `sets`, `blocks` | loaded once at init |
| UI state | `theme`, `preferredLanguage`, `loadExternalImages` | localStorage |
| Connection | `isOnline`, `isSlowConnection`, `slowConnectionOverride`, `offlineReady` | derived from browser APIs + SW events |
| Toasts | `showOfflineToast`, `showSlowToast` | auto-dismiss via timers in App.tsx |

### CSS Animation System (`index.css`)
Spring-based animation system using cubic-bezier approximations:
- Spring curves: `--ease-spring-tight`, `--ease-spring-default`, `--ease-spring-soft`, `--ease-spring-snappy`
- Keyframes defined for: modals, panels (mobile slide-up, desktop slide-right), filter chips, card grid stagger entrances, skeleton shimmer, tooltips, swipe hints, empty state pulse
- View Transition API: `::view-transition-old/new(optcg-card-morph)` for card tile → modal morph animations
- Reduced motion: `@media (prefers-reduced-motion: reduce)` zeroes out all animation durations

### Attribute + Keyword Styling (`utils.ts` + `index.css`)
Card text content is sanitized via DOMPurify, then OPTCG keywords (`[Blocker]`, `[Trigger]`, etc.) are replaced with CSS-classed `<span>` tags. Each keyword class has distinct visual styling in `index.css`:
- Timing pills (blue rounded): `[Activate: Main]`, `[On Play]`, `[When Attacking]`
- Counter pill (red rounded, with ⚡ prefix): `[Counter]`, `[Once Per Turn]`
- DON!! pill (dark rounded): `[DON!! xN]`
- Keyword hexagons (orange clip-path): `[Blocker]`, `[Banish]`, `[Rush]`, `[Double Attack]`
- Trigger chevron (yellow clip-path): `[Trigger]`

### PWA Install Prompt (`installPrompt.ts`)
Captures the `beforeinstallprompt` event and exposes it via a subscriber pattern:
- `subscribeInstallPrompt(fn)` returns an unsubscribe function
- Components call `getInstallPrompt()` to check availability, `clearInstallPrompt()` after user dismisses

## Data & Control Flow

### Initialization sequence
```
main.tsx
  └─ initInstallPromptCapture()        ← wire PWA install event listener
  └─ render(<StrictMode><App /></StrictMode>)
       └─ App.tsx
            ├─ useRegisterSW()         ← vite-plugin-pwa service worker registration
            ├─ init():
            │    ├─ initDB()           ← db.ts → worker loads sql.js WASM + optcg.db
            │    ├─ queryPacks()       ← metadata fetch
            │    ├─ querySets()
            │    ├─ queryBlocks()
            │    └─ search()           ← initial card load (offset=0, limit=50)
            ├─ window event listeners  ← online/offline + NetworkInformation API
            └─ Routes
                 ├─ / → CardGrid       ← displays filter bar + card tiles
                 ├─ /c/:id → CardDetail
                 ├─ /card/:id → CardDetail
                 └─ selectedCard → CardModal  ← overlay on any route
```

### Search flow
```
FilterBar/other components
  └─ store.setFilters(partial)    or    store.search(append=false)
       ├─ writeUrlFilters(newFilters)    ← URL sync
       ├─ set({ filters, offset: 0 })   ← pagination resets
       └─ search(append):
            ├─ buildQueryParams(filters, limit, offset, preferredLanguage)
            ├─ db.queryCards(params)
            │    └─ worker.postMessage({ type: 'queryCards', id, payload })
            │         └─ worker runs SQL (CTE + QueryBuilder + filters)
            │         └─ worker.postMessage({ type: 'result', id, data })
            └─ set({ cards, totalCards, hasMore, searching: false })
```

### Filter → SQL parameter mapping
`store.ts` `buildQueryParams()` translates `CardFilters` shape to `QueryCardsFilters` (flat shape consumed by the worker):
- Array filters (colors, categories, etc.) collapse to `undefined` when empty so the worker skips the filter
- `hideVariants: true` is hardcoded — card list never shows parallel/reprint duplicates
- `preferredLanguage` is forwarded for FTS Japanese text matching

### Pagination
- `limit: 50`, `offset: 0` initially
- `loadMore()` increments offset by limit, sets `lastSearchWasAppend: true`, `search()` appends to existing `cards` array
- `hasMore` calculated as `offset + cards.length < total`

## Integration Points

### What depends on this layer
| Consumer | Depends on |
|----------|-----------|
| `components/` | `store.ts` (useAppStore), `db.ts` (queryCards, getCardById, etc.), `types.ts`, `utils.ts` |
| `workers/` | none (autonomous Web Worker) |
| `lib/` | none (pure utilities used by components) |

### What this layer depends on
| Module | Used by | Purpose |
|--------|---------|---------|
| `workers/db.worker.ts` | `db.ts` | All SQL queries (via postMessage) |
| `zustand` | `store.ts` | State management |
| `react-router-dom` | `App.tsx` | Routing (`BrowserRouter`, `Routes`, `Route`) |
| `virtual:pwa-register/react` | `App.tsx` | SW update detection (`useRegisterSW`) |
| `dompurify` | `utils.ts` | HTML sanitization of card text content |
| `sql.js` (via sql-wasm.wasm) | `workers/db.worker.ts` | SQLite WASM engine |

### File-by-file integration

| File | Imports from | Exports to | External deps |
|------|-------------|-----------|---------------|
| `main.tsx` | `App`, `installPrompt`, `index.css` | — | `react-dom/client` |
| `App.tsx` | `store`, all components | default export | `react-router-dom`, `virtual:pwa-register/react` |
| `db.ts` | `types` (Card, Pack) | `initDB`, `queryCards`, all query fns | — |
| `store.ts` | `db` (all queries), `types` (Card, CardFilters) | `useAppStore` | `zustand` |
| `types.ts` | — | Cards, Pack, filters, constants | — |
| `utils.ts` | `types` (COLOR_HEX, Card) | all formatting/mapping fns | `dompurify` |
| `installPrompt.ts` | — | `initInstallPromptCapture`, `subscribeInstallPrompt` | — |
| `index.css` | — | imported by `main.tsx` | `tailwindcss` |
| `sqljs.d.ts` | — | global type augmentations | — |
| `vite-env.d.ts` | — | global type augmentations | `vite/client`, `vite-plugin-pwa/client` |

## File inventory

| File | Lines | Role |
|------|-------|------|
| `App.tsx` | 204 | Root component: routing, loading/error states, modal, toasts, PWA SW registration |
| `db.ts` | 115 | Async Web Worker proxy — typed request/response bridge |
| `store.ts` | 359 | Zustand store: filters, search, pagination, theme, language, connection, URL sync |
| `types.ts` | 112 | Card, Pack, CardFilters interfaces + color/rarity/category constants |
| `utils.ts` | 220 | HTML decode, keyword highlighting, search highlighting, attribute icons, cost circles, image grouping |
| `main.tsx` | 13 | React entry: renders App in StrictMode, initializes PWA install capture |
| `index.css` | 336 | Tailwind v4 + ~40 animation keyframes + keyword pill/hex/chevron CSS + view transitions |
| `installPrompt.ts` | 47 | PWA beforeinstallprompt capture with subscriber pattern |
| `sqljs.d.ts` | 19 | Minimal sql.js type declarations (Database.exec, initSqlJs) |
| `vite-env.d.ts` | 4 | Vite + PWA plugin + `__BUILD_TIME__` type declarations |
