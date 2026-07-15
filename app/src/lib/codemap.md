# lib/ — Shared Utility Libraries

## Responsibility

Provides reusable, framework-agnostic utility modules consumed across the
component tree. Each file is a standalone unit with zero cross-dependencies
within `lib/`. Responsibilities span gesture detection, spring-style animation
helpers, accessibility-aware motion queries, and filter-state introspection.

## Files

### `filters.ts` — Active Filter Counting

Exports a single pure function:

- **`getActiveFilterCount(filters: CardFilters): number`** — Counts how many
  filter dimensions are non-default (search string present, non-empty array,
  or range min/max set). Used by `FilterBar` to display a badge indicating
  the number of active filters.

Zero dependencies beyond the `CardFilters` type.

### `gesture.ts` — Swipe Gesture & Snap-Back Animation

Two exports:

- **`useSwipe(config: SwipeConfig)`** — Custom React hook that tracks
  pointer/touch drag gestures with momentum sampling. Configurable via:
  - `threshold` — minimum px to fire `onSwipe` (default: 80)
  - `maxDistance` — px after which resistance applies (default: 300)
  - `direction` — restrict to `'x'`, `'y'`, or `'both'`
  - `resistance` — factor 0–1 for drag beyond the soft limit
  - `onSwipe(velocity, distance, direction)` — committed swipe callback
  - `onDrag(offsetX, offsetY)` — per-frame drag callback
  - `onRelease()` — called when drag ends below threshold

  Returns `{ handlers, ref, state }`. The `handlers` object contains
  `onTouchStart`/`onTouchMove`/`onTouchEnd` and `onMouseDown` (which
  attaches global `mousemove`/`mouseup` listeners for desktop parity).
  The `ref` is attached to the target element; the hook internally
  registers a `touchmove` listener with `{ passive: false }` to
  prevent scroll while dragging.

  Momentum tracking samples the last 5 instantaneous velocity readings
  and averages the most recent 3 on release for a stable commit velocity.

- **`snapBack(element, axis, durationMs = 300)`** — Imperative utility that
  runs a `Web Animations API` keyframe animation to restore `translateX` or
  `translateY` to `0px`. Easing is a custom cubic-bezier producing a damped
  spring-like feel. No-op when displacement is < 1px.

Consumed by `CardModal` for swipe-to-dismiss and pull-to-navigate gestures.

### `spring.ts` — Motion Accessibility & Physics Primitives

One export (trimmed down from a larger animation module):

- **`prefersReducedMotion(): boolean`** — Queries
  `window.matchMedia('(prefers-reduced-motion: reduce)')`. Returns `false`
  when `window` is unavailable (SSR/worker context). Used by components that
  conditionally disable animations out of respect for OS accessibility
  settings.

## Design Patterns

| Pattern         | Usage                                          |
|-----------------|------------------------------------------------|
| Custom hooks    | `useSwipe` encapsulates gesture lifecycle and cleanup into a React hook with ref-based state (no re-renders on drag frames). |
| Imperative animation | `snapBack` operates directly on DOM elements via `Element.animate()` rather than React state to avoid layout thrash. |
| Pure function   | `getActiveFilterCount` / `prefersReducedMotion` are side-effect-free or single-purpose queries. |
| Ref-based state | `useSwipe` stores all mutable drag state in `useRef` — the hook never calls `setState`, so gesture tracking produces zero React re-renders during drag. |

## Data & Control Flow

```
Components (CardModal, CardGrid, FilterBar)
  │
  ├── useSwipe()      ← gesture.ts   (drag state via ref → onDrag/onSwipe callbacks)
  ├── snapBack()      ← gesture.ts   (imperative DOM animation on release)
  ├── prefersReducedMotion() ← spring.ts  (boolean flag, read at mount)
  └── getActiveFilterCount() ← filters.ts (pure FN, called during render)
```

- **`useSwipe`** returns event handlers that components spread onto JSX
  elements. The internal `ref` is attached to the same element to enable
  passive scroll prevention. Drag state is communicated exclusively through
  the `onDrag`/`onSwipe`/`onRelease` callbacks — components never read from
  `state` directly.
- **`snapBack`** is called imperatively from a `useEffect` or event handler
  after a drag ends below threshold, animating the element back to origin.
- **`prefersReducedMotion`** is typically read once at mount time (or via a
  `useMemo` with a media query listener) to disable `snapBack` or other
  CSS transitions.
- **`getActiveFilterCount`** is called during render in `FilterBar` to produce
  a badge count; its return value is purely derived from the Zustand store's
  `filters` state.

## Integration Points

| Consumer       | Uses                              |
|----------------|-----------------------------------|
| `CardModal`    | `useSwipe` for swipe-to-dismiss (horizontal) and pull-to-navigate (cards in set). Calls `snapBack` on failed swipe. |
| `CardGrid`     | `useSwipe` for horizontal scroll affordance on mobile card rows (optional). |
| `FilterBar`    | `getActiveFilterCount` to render animated badge in the filter toggle button. |
| Any component with spring animations | `prefersReducedMotion` to conditionally skip or shorten animations. |

## Constraints

- `useSwipe` attaches a `touchmove` listener with `{ passive: false }` —
  ensure the host element does not already conflict with scroll behavior
  on the same axis.
- `snapBack` reads `element.style.transform` which assumes the element's
  translation is set inline (via `useSwipe`'s `onDrag` or CSS-in-JS).
  If a computed stylesheet is used instead, `snapBack` will see an empty
  transform string and become a no-op.
- `prefersReducedMotion` is evaluated once per call — components that
  respond to live changes (e.g. OS setting toggled while app is open)
  should wrap it with a `matchMedia` listener.
- No file in `lib/` imports from another file in `lib/` — zero internal
  coupling.
