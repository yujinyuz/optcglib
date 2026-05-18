import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '../store'
import {
  ALL_COLORS,
  ALL_CATEGORIES,
  ALL_RARITIES,
  ALL_ATTRIBUTES,
  RARITY_SHORT,
  COLOR_HEX,
} from '../types'

function PillRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-400 dark:text-[#64748b] shrink-0 w-9">{label}</span>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
        {children}
      </div>
    </div>
  )
}

function TogglePill({
  active,
  onClick,
  children,
  style,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border ${
        active
          ? 'bg-[#3b82f6]/10 dark:bg-[#3b82f6]/20 text-[#3b82f6] dark:text-[#60a5fa] border-[#3b82f6]/30 dark:border-[#3b82f6]/40'
          : 'text-slate-500 dark:text-[#64748b] border-slate-200 dark:border-[#2e303a] hover:border-slate-300 dark:hover:border-[#3e4050] hover:text-slate-700 dark:hover:text-[#94a3b8]'
      }`}
      style={style}
    >
      {children}
    </button>
  )
}

export default function FilterBar() {
  const filters = useAppStore((state) => state.filters)
  const setFilters = useAppStore((state) => state.setFilters)
  const resetFilters = useAppStore((state) => state.resetFilters)
  const sets = useAppStore((state) => state.sets)
  const blocks = useAppStore((state) => state.blocks)

  const toggle = (key: 'colors' | 'categories' | 'rarities' | 'attributes' | 'blocks', value: string | number) => {
    const current = filters[key] as (string | number)[]
    const next = current.includes(value as never)
      ? current.filter((v) => v !== value)
      : [...current, value]
    setFilters({ [key]: next } as Partial<typeof filters>)
  }

  // Debounced search input
  const [localSearch, setLocalSearch] = useState(filters.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters({ search: value })
    }, 150)
  }, [setFilters])

  const hasActiveFilters =
    filters.colors.length > 0 ||
    filters.categories.length > 0 ||
    filters.rarities.length > 0 ||
    filters.attributes.length > 0 ||
    filters.blocks.length > 0 ||
    filters.setPrefix !== null ||
    filters.search !== ''

  return (
    <div className="space-y-1.5">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search cards..."
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-lg pl-8 pr-7 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
        {localSearch && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64748b] hover:text-slate-900 dark:hover:text-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 dark:text-[#64748b]">Filters active</span>
          <button
            onClick={resetFilters}
            className="text-[10px] text-[#3b82f6] dark:text-[#60a5fa] hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Colors */}
      <PillRow label="Color">
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
      </PillRow>

      {/* Categories */}
      <PillRow label="Type">
        {ALL_CATEGORIES.map((cat) => (
          <TogglePill
            key={cat}
            active={filters.categories.includes(cat)}
            onClick={() => toggle('categories', cat)}
          >
            {cat === 'Don' ? 'DON!!' : cat}
          </TogglePill>
        ))}
      </PillRow>

      {/* Rarities */}
      <PillRow label="Rarity">
        {ALL_RARITIES.map((r) => (
          <TogglePill
            key={r}
            active={filters.rarities.includes(r)}
            onClick={() => toggle('rarities', r)}
          >
            {RARITY_SHORT[r] || r}
          </TogglePill>
        ))}
      </PillRow>

      {/* Attributes */}
      <PillRow label="Attr">
        {ALL_ATTRIBUTES.map((attr) => (
          <TogglePill
            key={attr}
            active={filters.attributes.includes(attr)}
            onClick={() => toggle('attributes', attr)}
          >
            {attr}
          </TogglePill>
        ))}
      </PillRow>

      {/* Blocks */}
      {blocks.length > 0 && (
        <PillRow label="Block">
          {blocks.map((block) => (
            <TogglePill
              key={block}
              active={filters.blocks.includes(block)}
              onClick={() => toggle('blocks', block)}
            >
              {block}
            </TogglePill>
          ))}
        </PillRow>
      )}

      {/* Sets */}
      {sets.length > 0 && (
        <PillRow label="Set">
          <TogglePill
            active={filters.setPrefix === null}
            onClick={() => setFilters({ setPrefix: null })}
          >
            All
          </TogglePill>
          {sets.map((set) => (
            <TogglePill
              key={set}
              active={filters.setPrefix === set}
              onClick={() =>
                setFilters({ setPrefix: filters.setPrefix === set ? null : set })
              }
            >
              {set}
            </TogglePill>
          ))}
        </PillRow>
      )}
    </div>
  )
}
