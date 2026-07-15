import { useState } from 'react'
import { useAppStore } from '../store'
import {
  ALL_COLORS,
  ALL_CATEGORIES,
  ALL_RARITIES,
  ALL_ATTRIBUTES,
  RARITY_SHORT,
  COLOR_HEX,
  CATEGORY_COLORS,
} from '../types'

function FilterSection({
  label,
  count,
  defaultExpanded = false,
  children,
}: {
  label: string
  count?: number
  defaultExpanded?: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section className="border-b border-slate-100 dark:border-[#25283a] last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 dark:text-[#64748b] uppercase tracking-wider">{label}</span>
          {count ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#25283a] dark:text-[#94a3b8]">
              {count}
            </span>
          ) : null}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-[#64748b] ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded ? <div className="pb-3">{children}</div> : null}
    </section>
  )
}

function TogglePill({
  active,
  onClick,
  children,
  style,
  className = '',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 px-3 py-2.5 rounded-md text-base sm:text-[11px] font-medium transition-all border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#1a1d2e] ${
        active
          ? 'bg-[#3b82f6]/10 dark:bg-[#3b82f6]/20 text-[#3b82f6] dark:text-[#60a5fa] border-[#3b82f6]/30 dark:border-[#3b82f6]/40'
          : 'text-slate-500 dark:text-[#64748b] border-slate-200 dark:border-[#2e303a] hover:border-slate-300 dark:hover:border-[#3e4050] hover:text-slate-700 dark:hover:text-[#94a3b8]'
      } ${className}`}
      style={style}
    >
      {children}
    </button>
  )
}

function DualRangeSlider({
  label,
  absoluteMin,
  absoluteMax,
  min,
  max,
  onMinChange,
  onMaxChange,
  step = 1,
}: {
  label: string
  absoluteMin: number
  absoluteMax: number
  min: number | null
  max: number | null
  onMinChange: (val: number | null) => void
  onMaxChange: (val: number | null) => void
  step?: number
}) {
  const low = min ?? absoluteMin
  const high = max ?? absoluteMax
  const range = absoluteMax - absoluteMin

  const pctLow = ((low - absoluteMin) / range) * 100
  const pctHigh = ((high - absoluteMin) / range) * 100

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (val <= (max ?? absoluteMax)) onMinChange(val)
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (val >= (min ?? absoluteMin)) onMaxChange(val)
  }

  const displayValue = (v: number | null, fallback: number) => {
    const val = v ?? fallback
    return step >= 1000 ? `${val / 1000}k` : String(val)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-slate-400 dark:text-[#64748b] w-6 text-right shrink-0">{displayValue(null, absoluteMin)}</span>
        <div className="relative h-5 flex-1 flex items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-[#2e303a]" />
          <div
            className="absolute h-1 rounded-full bg-[#3b82f6] dark:bg-[#60a5fa]"
            style={{ left: `${Math.min(pctLow, pctHigh)}%`, right: `${100 - Math.max(pctLow, pctHigh)}%` }}
          />
          <input
            type="range"
            min={absoluteMin}
            max={absoluteMax}
            step={step}
            value={low}
            onChange={handleMinChange}
            aria-label={`${label} min`}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#3b82f6] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#3b82f6] [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:cursor-grab"
            style={{ zIndex: low === high ? 2 : 1 }}
          />
          <input
            type="range"
            min={absoluteMin}
            max={absoluteMax}
            step={step}
            value={high}
            onChange={handleMaxChange}
            aria-label={`${label} max`}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#3b82f6] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#3b82f6] [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:cursor-grab"
            style={{ zIndex: low === high ? 1 : 2 }}
          />
        </div>
        <span className="text-[10px] font-medium text-slate-400 dark:text-[#64748b] w-6 shrink-0">{displayValue(null, absoluteMax)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          step={step}
          aria-label={`${label} min`}
          placeholder={String(absoluteMin)}
          value={min ?? ''}
          onChange={(e) => onMinChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-16 bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-2.5 text-base sm:text-[11px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 text-center"
        />
        <span className="text-slate-400 dark:text-[#64748b] text-[10px]">–</span>
        <input
          type="number"
          inputMode="numeric"
          step={step}
          aria-label={`${label} max`}
          placeholder={String(step >= 1000 ? `${absoluteMax / 1000}k` : absoluteMax)}
          value={max ?? ''}
          onChange={(e) => onMaxChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-16 bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-2.5 text-base sm:text-[11px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 text-center"
        />
      </div>
    </div>
  )
}

export default function FilterBar() {
  const filters = useAppStore((state) => state.filters)
  const setFilters = useAppStore((state) => state.setFilters)
  const setSearchScope = useAppStore((state) => state.setSearchScope)
  const sets = useAppStore((state) => state.sets)
  const blocks = useAppStore((state) => state.blocks)
  const totalCards = useAppStore((state) => state.totalCards)
  const searchLoading = useAppStore((state) => state.searchLoading)

  const toggle = (key: 'colors' | 'categories' | 'rarities' | 'attributes' | 'sets', value: string | number) => {
    const current = filters[key] as (string | number)[]
    const next = current.includes(value as never)
      ? current.filter((v) => v !== value)
      : [...current, value]
    setFilters({ [key]: next } as Partial<typeof filters>)
  }

  const closeSidebar = () => {
    window.dispatchEvent(new CustomEvent('optcg-close-sidebar'))
  }

  const resultLabel = searchLoading
    ? 'Updating results…'
    : totalCards === 1
      ? 'Show 1 result'
      : `Show ${new Intl.NumberFormat().format(totalCards)} results`

  return (
    <div className="space-y-0 pb-24">
      <FilterSection label="Colors" count={filters.colors.length} defaultExpanded>
        <div className="flex flex-wrap gap-1">
          {ALL_COLORS.map((color) => (
            <TogglePill
              key={color}
              active={filters.colors.includes(color)}
              onClick={() => toggle('colors', color)}
              style={
                filters.colors.includes(color)
                  ? { backgroundColor: COLOR_HEX[color] + '20', borderColor: COLOR_HEX[color] + '60', color: COLOR_HEX[color] }
                  : {}
              }
            >
              <span className="inline-flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: COLOR_HEX[color] }}
                />
                {color}
              </span>
            </TogglePill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Category" count={filters.categories.length} defaultExpanded>
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((cat) => (
            <TogglePill
              key={cat}
              active={filters.categories.includes(cat)}
              onClick={() => toggle('categories', cat)}
              style={
                filters.categories.includes(cat)
                  ? { backgroundColor: CATEGORY_COLORS[cat] + '20', borderColor: CATEGORY_COLORS[cat] + '60', color: CATEGORY_COLORS[cat] }
                  : {}
              }
            >
              {cat === 'Don' ? 'DON!!' : cat}
            </TogglePill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Search in" count={filters.searchScopes.length} defaultExpanded={filters.search !== ''}>
        <div className="flex flex-wrap gap-1">
          {(['name', 'effect', 'trigger', 'type'] as const).map((scope) => (
            <TogglePill
              key={scope}
              active={filters.searchScopes.includes(scope)}
              onClick={() => setSearchScope(scope)}
            >
              {scope.charAt(0).toUpperCase() + scope.slice(1)}
            </TogglePill>
          ))}
        </div>
      </FilterSection>

      {sets.length > 0 && (
        <FilterSection label="Sets" count={filters.sets.length || sets.length} defaultExpanded={filters.sets.length > 0}>
          <div className="flex flex-wrap gap-1">
            {sets.map((set) => (
              <TogglePill
                key={set}
                active={filters.sets.includes(set)}
                onClick={() => toggle('sets', set)}
              >
                {set}
              </TogglePill>
            ))}
          </div>
        </FilterSection>
      )}

      {blocks.length > 0 && (
        <FilterSection label="Blocks" count={filters.blockMin !== null || filters.blockMax !== null ? 1 : undefined} defaultExpanded={filters.blockMin !== null || filters.blockMax !== null}>
          <DualRangeSlider
            label="Block"
            absoluteMin={blocks[0]}
            absoluteMax={blocks[blocks.length - 1]}
            min={filters.blockMin}
            max={filters.blockMax}
            onMinChange={(v) => setFilters({ blockMin: v })}
            onMaxChange={(v) => setFilters({ blockMax: v })}
            step={1}
          />
        </FilterSection>
      )}

      <FilterSection label="Rarities" count={filters.rarities.length} defaultExpanded={filters.rarities.length > 0}>
        <div className="flex flex-wrap gap-1">
          {ALL_RARITIES.map((r) => (
            <TogglePill
              key={r}
              active={filters.rarities.includes(r)}
              onClick={() => toggle('rarities', r)}
            >
              {RARITY_SHORT[r] || r}
            </TogglePill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Attributes" count={filters.attributes.length} defaultExpanded={filters.attributes.length > 0}>
        <div className="flex flex-wrap gap-1">
          {ALL_ATTRIBUTES.map((attr) => (
            <TogglePill
              key={attr}
              active={filters.attributes.includes(attr)}
              onClick={() => toggle('attributes', attr)}
            >
              {attr}
            </TogglePill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Cost" count={filters.costMin !== null || filters.costMax !== null ? 1 : undefined} defaultExpanded={filters.costMin !== null || filters.costMax !== null}>
        <DualRangeSlider
          label="Cost"
          absoluteMin={0}
          absoluteMax={10}
          min={filters.costMin}
          max={filters.costMax}
          onMinChange={(v) => setFilters({ costMin: v })}
          onMaxChange={(v) => setFilters({ costMax: v })}
          step={1}
        />
      </FilterSection>

      <FilterSection label="Power" count={filters.powerMin !== null || filters.powerMax !== null ? 1 : undefined} defaultExpanded={filters.powerMin !== null || filters.powerMax !== null}>
        <DualRangeSlider
          label="Power"
          absoluteMin={0}
          absoluteMax={13000}
          min={filters.powerMin}
          max={filters.powerMax}
          onMinChange={(v) => setFilters({ powerMin: v })}
          onMaxChange={(v) => setFilters({ powerMax: v })}
          step={1000}
        />
      </FilterSection>

      <FilterSection label="Counter" count={filters.counterMin !== null || filters.counterMax !== null ? 1 : undefined} defaultExpanded={filters.counterMin !== null || filters.counterMax !== null}>
        <DualRangeSlider
          label="Counter"
          absoluteMin={0}
          absoluteMax={2000}
          min={filters.counterMin}
          max={filters.counterMax}
          onMinChange={(v) => setFilters({ counterMin: v })}
          onMaxChange={(v) => setFilters({ counterMax: v })}
          step={1000}
        />
      </FilterSection>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-[#2e303a] dark:bg-[#1a1d2e]/95 dark:supports-[backdrop-filter]:bg-[#1a1d2e]/85">
        <button
          type="button"
          onClick={closeSidebar}
          className="flex w-full items-center justify-center rounded-xl bg-[#3b82f6] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#3b82f6]/20 transition-colors hover:bg-[#2563eb] active:bg-[#1d4ed8]"
        >
          {resultLabel}
        </button>
      </div>
    </div>
  )
}
