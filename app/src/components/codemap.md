# app/src/components/

## Responsibility

UI layer of the OPTCG Card Database browser. These React components render the entire user interface — cards, filters, modals, navigation, and app shell. All components are presentational with state accessed via the Zustand store (`useAppStore`). No SQLite queries run directly in components; all database access goes through `db.ts` (Web Worker bridge).

## Component Catalog

### Layout (`Layout.tsx`)
App shell owned by React Router. Renders a fixed navbar (`TopSearchBar`), active filter chips (`ActiveFilterChips`), a sidebar filter panel, an `Outlet` for route content, the mobile `FilterFAB`, an install banner, and an install-success toast.

**Sub-components defined within the file:**

- **`TopSearchBar`** — Debounced (300ms) text input. Writes to `searchInput` (immediate) and `search` filter (debounced) on the store.
- **`ActiveFilterChips`** — Pill-shaped removable chips for every active filter. Exit animations through an `exiting` state array with `chipOut` keyframes. "Clear all" resets all filters at once.
- **`SettingsMenu`** — Dropdown menu with language (EN/JP), theme (light/dark), card images toggle (with slow-connection override), install app button, Help modal, About modal, and Ko-fi link. Handles iOS/Android/desktop install guides via a tooltip overlay.
- **`InstallBanner`** — Mobile-only bottom sheet for PWA install. Respects 7-day dismiss cooldown via `localStorage`.
- **Sidebar** — Filter panel. Mobile: bottom sheet with drag-to-dismiss via pointer events, `overscroll-behavior: none`. Desktop: right drawer. Closes via `optcg-close-sidebar` event dispatch.

### CardGrid (`CardGrid.tsx`)
Main card listing view. Renders a responsive CSS grid (2–6 columns) of `CardTile` wrappers around `CardCard`.

- **`InfiniteScrollSentinel`** — A `div` at the bottom observed by `IntersectionObserver` with 200px `rootMargin`. Calls `loadMore()` from the store when visible.
- **`PullToRefresh`** — Mobile-only (hidden at `sm:` breakpoint). Uses `useSwipe` from `lib/gesture` with `direction: 'y'`. Drag distance drives rotation of an anchor icon; threshold 80px triggers `init()` to re-fetch.
- **`CardTile`** — Wraps each `CardCard` with `disableClick` to delegate click handling upward. Applies spring entrance animations (staggered by 16ms per card, capped at 250ms). Uses CSS `viewTransitionName` for `startViewTransition` API.
- **State management**: Uses `resultKey` (incremented after each search completes) to force re-mount animation. Shows `SkeletonCard` placeholders during initial loading, and an empty-state with "No cards match those filters" and "clear all filters" link when no results.

### CardCard (`CardCard.tsx`)
Individual card tile, `React.memo` wrapped. Displays: color strip, cost badge, power, attribute icons, card image (via `ImageLoader`), effect text (with search highlighting), category, name, types, counter strip, bottom banner (ID, rarity, block, parallel star).

- **Image mode**: When `loadExternalImages` is enabled and connection isn't slow (unless overridden), shows card image. Otherwise shows text layout with cost/power/attribute strip.
- **Counter strip**: Vertical text label on the left edge when card has a counter value and images are off.
- **Variant suffix**: Appends "(Parallel)" or "(Reprint)" based on ID pattern match.
- **Click handler**: Calls `setSelectedCard(card)` on the store, which triggers `CardModal`.

### CardDetail (`CardDetail.tsx`)
Route-based card detail page (`/card/:id`). Uses React Router `useParams`. Fetches card data, packs, and variants from `db.ts` (Web Worker) on mount with a cancellation flag pattern.

- Forwards all data to `CardDetailContent` with `variant="page"`.
- Shows spinner while loading, pirate emoji + error message on failure.
- Computes `bestImageUrl` from variants using `languagePriority` respecting `preferredLanguage`.

### CardDetailContent (`CardDetailContent.tsx`)
Pure presentational component shared by both `CardDetail` (page mode) and `CardModal` (modal mode). Renders:

- Counter strip (vertical, left edge)
- Cost/Power/Attribute strip (when no image)
- Card image via `ImageLoader` with `cursor-zoom-in`
- Effect + trigger text with search highlighting
- Category → Name → Type display order
- Bottom banner (ID, rarity, block)
- `PriceLinks` component
- Image variants grid (English/Japanese groups) — when `onAltImageClick` is provided (modal mode), renders inline images with click-to-zoom; otherwise renders external links
- Packs list ("Found in")

**Variants**: `variant="modal"` adjusts padding and enables `onAltImageClick` for zoom behavior.

### CardModal (`CardModal.tsx`)
Full-screen modal overlay for browsing card details. Triggered by `setSelectedCard` in the store.

- **Keyboard**: Escape to close, ArrowLeft/ArrowRight for prev/next navigation (nested: Escape first closes zoom before dismissing modal).
- **Swipe**: Horizontal swipe via `useSwipe` with resistance-based drag. Left/right gestures navigate cards; partial swipes snap back.
- **Prev/Next**: Arrow buttons positioned on sides, visible when adjacent cards exist in the current result list.
- **Image zoom**: Click main/alt image sets `zoomedImg` URL; renders full-screen black overlay with `cursor-zoom-out`. Escape or click to dismiss.
- **Scroll**: `scrollTop` reset on card change. Body scroll lock with `paddingRight` accounting for scrollbar width.
- Delegates content rendering to `CardDetailContent` with `variant="modal"`.

### FilterBar (`FilterBar.tsx`)
Sidebar filter panel embedded inside Layout's sidebar section. Contains collapsible `FilterSection` groups:

- **Colors** — Toggle pills with color dot, hex-tinted active styles
- **Category** — Toggle pills, Leader crown icon
- **Search in** — Scope toggles: Name, Effect, Trigger, Type
- **Sets** — Dynamically populated from store `sets` array
- **Blocks** — `DualRangeSlider` (block number)
- **Rarities** — Toggle pills with short labels (C, UC, R, SR, SEC...)
- **Attributes** — Toggle pills
- **Cost / Power / Counter** — `DualRangeSlider` with dual-thumb input (Native `<input type="range">` overlaid, with `pointer-events: none` on the track and `auto` on thumb)
- **Sticky bottom bar**: "Show N results" button that dispatches `optcg-close-sidebar`

**Sub-components**: `FilterSection` (collapsible, `aria-expanded`), `TogglePill` (`aria-pressed`, active/inactive styles), `DualRangeSlider` (dual-thumb range with visual fill, text inputs for direct entry).

### FilterFAB (`FilterFAB.tsx`)
Mobile-only floating action button. Hidden at `sm:`. Mounts with WAAPI spring animation. Dispatches `optcg-open-sidebar` event. Shows red badge with active filter count. Fades/scales out when sidebar is open (`sidebarOpen` prop).

### ImageLoader (`ImageLoader.tsx`)
Image wrapper with three states: loading (pulsing placeholder logo), error (static placeholder logo), and loaded (opacity crossfade via CSS `transition: opacity 200ms`). Uses `loading="lazy"` for native lazy loading. Click handler forwarded to parent.

### SkeletonCard (`SkeletonCard.tsx`)
Loading placeholder matching the card tile layout structure. Shimmer animations via CSS class `skeleton-shimmer` / `skeleton-shimmer-dark`. Used by `CardGrid` during initial search.

### PriceLinks (`PriceLinks.tsx`)
External marketplace links row. Renders Mercard, Yuyu-Tei, TCGPlayer, and CardRush links with site icons. All links open in new tabs. Uses `baseId` (e.g. "OP01-001") as search keyword.

### AboutModal (`AboutModal.tsx`)
App story modal ("Why I Built This"). Sections: The problem, How it works, Built for speed. Includes `DebugInfo` component and a "Cache card images" button that opens `ImageCacheModal`. Animated entry/exit with overlay + content springs.

### HelpModal (`HelpModal.tsx`)
Help and symbol guide modal. Three sections: Getting Started (numbered steps), Card Symbols (color strip, cost, power, attributes, counter, leader, DON!!, variants, bottom banner), Settings & Features (offline, language, theme, images, install). Attribute badges show kanji characters.

### ImageCacheModal (`ImageCacheModal.tsx`)
Image caching UI. Features:

- Set selection pills with caching status (checkmark when fully cached, partial count when in progress)
- Batch fetch of image URLs via `queryImageUrlsBySets` from the worker
- Concurrent batch size of 5, `no-cors` mode for cache storage
- Progress bar with done/total/failed counts
- Cancel via `abortRef` flag
- Clear cache button
- Auto-refreshes cache info and per-set status on open and after operations

### DebugInfo (`DebugInfo.tsx`)
Diagnostics panel. Gathers: build time (`__BUILD_TIME__` global), total cards (via `getStats()`), DB size (HEAD request), service worker state, standalone mode, storage estimate, screen size/DPR, cached image count/size. Each call has a 3-second timeout via `Promise.race`.

### UpdateBanner (`UpdateBanner.tsx`)
PWA update notification. Receives `needRefresh` and `onUpdate` from the service worker registration in `main.tsx`. Hidden in dev mode (`import.meta.env.DEV`). Slide-down animation. Dismissible per-session.

## Design Patterns

### Component Composition
- **`CardDetailContent`** is the canonical card detail view, rendered by both `CardDetail` (page route) and `CardModal` (overlay). The `variant` prop (`'page' | 'modal'`) adjusts padding and enables alt-image inline zoom in modal mode.
- **Modal nesting**: `AboutModal` opens `ImageCacheModal` internally — a pattern for multi-level modals without stacking complexity.
- **Layout → FilterBar**: The sidebar shell lives in `Layout`; `FilterBar` is the content-only child.

### Modal Stacking
Three modal components (`AboutModal`, `HelpModal`, `ImageCacheModal`) share a common pattern:
- `isOpen`/`onClose` props
- `closing` state with reversed animation before `onClose` fires
- Keyboard Escape handler with conditional body scroll lock
- Overlay backdrop click to dismiss
- Animated entry/exit via CSS keyframes (`modalOverlayIn`/`modalOverlayOut`, `modalContentInSpring`/`modalContentOutSpring`)
- `prefersReducedMotion()` shortens durations

### Infinite Scroll
- `IntersectionObserver` in `InfiniteScrollSentinel` triggers `loadMore()` from the store.
- `CardGrid` shows a spinner "Loading more..." during subsequent fetches.
- `rootMargin: '200px'` prefetches before the user reaches the bottom.

### Memoization
- `CardCard` is wrapped in `React.memo` — cards are referentially stable unless the search query changes (which highlights text and thus re-renders existing cards).
- `ActiveFilterChips` uses `useMemo` to derive chip data from filter state.
- `Layout` and `CardDetail` use `useCallback` for event handlers passed to children.
- Cancellation flags in `useEffect` cleanup prevent state updates on unmounted components (`cancelled = true`).

### Event-Driven Communication
- **Sidebar open/close**: `FilterBar`'s "Show results" button and `FilterFAB` dispatch `optcg-close-sidebar` / `optcg-open-sidebar` custom events on `window`. `Layout` listens for these.
- **Install prompt**: `installPrompt.ts` provides a subscription mechanism. `Layout` subscribes on mount; `SettingsMenu` and `InstallBanner` consume the deferred prompt.

### Animation Strategy
- **Spring animations**: CSS custom properties `var(--ease-spring-default)`, `var(--ease-spring-tight)`, `var(--ease-spring-snappy)` used for content entry.
- **Out-quart easing**: Used for exit animations and overlay fades.
- **Stagger**: `CardTile` and `HelpSection`/`StorySection` use staggered `animation-delay`.
- **CSS keyframes**: Defined globally (not in `tailwind.css` explicitly — these are injected via `@keyframes` in the stylesheet setup).
- **Reduced motion**: `lib/spring.ts` `prefersReducedMotion()` shortens or skips animations throughout.

## Data & Control Flow

```
User action
  → Component callback (onClick, onSwipe, etc.)
    → Store action (setFilters, setSelectedCard, loadMore, etc.)
      → Async query via db.ts → Web Worker → SQLite
        → Result → Store state update
          → React re-render via Zustand selectors
```

**Search flow:**
```
TopSearchBar input (onChange)
  → setSearchInput (immediate, UI feedback)
  → 300ms debounce → setSearchFilter (store)
    → store.search() query
      → worker: FTS MATCH + partial ID + filters + pagination
      → store.cards / store.totalCards / store.hasMore / store.searching
        → CardGrid re-render
```

**Card detail flow:**
```
CardCard onClick → setSelectedCard(card)
  → CardModal mounts with cardId
    → db.ts getCardById + getCardPacks + getCardVariants (parallel)
      → card, cardPacks, cardVariants state
        → CardDetailContent renders
```

**Filter flow:**
```
TogglePill onClick → toggle('colors', 'Red')
  → setFilters({ colors: [...] })
    → store.search() triggers (via middleware/watcher)
      → URL sync (history.replaceState)
      → worker query with all active filters
```

## Integration Points

| File | Imported by | Purpose |
|------|-------------|---------|
| `store.ts` (useAppStore) | All major components | Global state: cards, filters, search, selected card, settings, theme |
| `db.ts` | CardDetail, CardModal, DebugInfo, ImageCacheModal | Async queries over Web Worker: getCardById, getCardPacks, getCardVariants, getStats, queryImageUrlsBySets, queryAllSetImageUrls |
| `types.ts` | CardCard, CardDetailContent, FilterBar, HelpModal, Layout | Types (Card, CardFilters) and constants (COLOR_HEX, RARITY_SHORT, CATEGORY_COLORS, ALL_COLORS, etc.) |
| `utils.ts` | CardCard, CardDetailContent, ImageCacheModal, DebugInfo | decodeHtmlEntities, renderCardText, highlightSearchText, getAttributeIcon, getAttributeColor, getExternalImageUrl, groupImagesByLanguage, formatBytes, costCircleBg |
| `lib/spring.ts` | CardGrid, CardModal, Layout, AboutModal, HelpModal, ImageCacheModal, FilterFAB | prefersReducedMotion() |
| `lib/gesture.ts` | CardGrid, CardModal | useSwipe, snapBack |
| `lib/filters.ts` | Layout, FilterFAB | getActiveFilterCount |
| `installPrompt.ts` | Layout | InstallPrompt subscription |

## Key Design Decisions

1. **No direct sql.js imports in components** — All DB access is async via `db.ts` → Web Worker. Components never import sql.js.

2. **`CardCard` memoized but re-renders on search change** — Because `highlightSearchText()` produces HTML that changes per search term via `dangerouslySetInnerHTML`, memoization gains limited benefit during active search but helps when scrolling/filtering without text search.

3. **Modal exit animation via state, not CSS** — The `closing` state pattern sets reversed animations, then calls `onClose` after a timeout. This ensures the exit animation completes before the component unmounts (and React unmounts would kill animations instantly).

4. **Dual-thumb range inputs overlap native `<input type="range">`** — Two inputs stacked with `pointer-events: none` on the container and `auto` on thumbs. The thumb with the lower z-index gets pointer priority when values are equal.

5. **Image caching uses `no-cors`** — The image proxy (serveproxy.com) may not expose CORS headers; `no-cors` mode still populates the browser cache via opaque responses, enabling offline access even though JavaScript can't read the response body.
