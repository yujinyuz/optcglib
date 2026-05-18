import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '../store'
import {
  ALL_COLORS,
  ALL_CATEGORIES,
  ALL_RARITIES,
  ALL_ATTRIBUTES,
  COLOR_HEX,
} from '../types'

export default function FilterBar() {
  const filters = useAppStore((state) => state.filters)
  const setFilters = useAppStore((state) => state.setFilters)
  const resetFilters = useAppStore((state) => state.resetFilters)
  const sets = useAppStore((state) => state.sets)
  const blocks = useAppStore((state) => state.blocks)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const toggleColor = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color]
    setFilters({ colors: newColors })
  }

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = []
  filters.colors.forEach((c) => activeChips.push({ label: c, onRemove: () => setFilters({ colors: filters.colors.filter((x) => x !== c) }) }))
  filters.categories.forEach((c) => activeChips.push({ label: c, onRemove: () => setFilters({ categories: filters.categories.filter((x) => x !== c) }) }))
  filters.rarities.forEach((r) => activeChips.push({ label: r, onRemove: () => setFilters({ rarities: filters.rarities.filter((x) => x !== r) }) }))
  filters.attributes.forEach((a) => activeChips.push({ label: a, onRemove: () => setFilters({ attributes: filters.attributes.filter((x) => x !== a) }) }))
  if (filters.setPrefix) activeChips.push({ label: `Set: ${filters.setPrefix}`, onRemove: () => setFilters({ setPrefix: null }) })
  if (filters.costMin !== null) activeChips.push({ label: `Cost ≥ ${filters.costMin}`, onRemove: () => setFilters({ costMin: null }) })
  if (filters.costMax !== null) activeChips.push({ label: `Cost ≤ ${filters.costMax}`, onRemove: () => setFilters({ costMax: null }) })
  if (filters.powerMin !== null) activeChips.push({ label: `Power ≥ ${filters.powerMin}`, onRemove: () => setFilters({ powerMin: null }) })
  if (filters.powerMax !== null) activeChips.push({ label: `Power ≤ ${filters.powerMax}`, onRemove: () => setFilters({ powerMax: null }) })

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

  return (
    <div className="space-y-3">
      {/* Search + Color pills row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, ID, effect, or trigger..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-lg pl-10 pr-8 py-2 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
          />
          {localSearch && (
            <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64748b] hover:text-slate-900 dark:hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="shrink-0 bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-[#3e4050] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <button
              key={i}
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[#3b82f6]/10 dark:bg-[#3b82f6]/20 text-[#3b82f6] dark:text-[#60a5fa] border border-[#3b82f6]/20 dark:border-[#3b82f6]/30 hover:bg-[#3b82f6]/20 dark:hover:bg-[#3b82f6]/30 transition-colors"
            >
              {chip.label}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          <button onClick={resetFilters} className="px-2 py-0.5 rounded-md text-xs text-slate-400 dark:text-[#64748b] hover:text-slate-600 dark:hover:text-[#94a3b8] transition-colors">
            Clear all
          </button>
        </div>
      )}

      {/* Color pills */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => toggleColor(color)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
              filters.colors.includes(color)
                ? 'text-white border-white/30'
                : 'text-slate-500 dark:text-[#64748b] border-slate-200 dark:border-[#2e303a] hover:border-slate-300 dark:hover:border-[#3e4050] hover:text-slate-600 dark:hover:text-[#94a3b8]'
            }`}
            style={filters.colors.includes(color) ? { backgroundColor: COLOR_HEX[color] + '30', borderColor: COLOR_HEX[color] } : {}}
          >
            {color}
          </button>
        ))}
      </div>

      {/* Block pills */}
      {blocks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-slate-500 dark:text-[#64748b] self-center mr-1">Block</span>
          {blocks.map((block) => (
            <button
              key={block}
              type="button"
              onClick={() => {
                const newBlocks = filters.blocks.includes(block)
                  ? filters.blocks.filter((b) => b !== block)
                  : [...filters.blocks, block]
                setFilters({ blocks: newBlocks })
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                filters.blocks.includes(block)
                  ? 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/40'
                  : 'text-slate-500 dark:text-[#64748b] border-slate-200 dark:border-[#2e303a] hover:border-slate-300 dark:hover:border-[#3e4050] hover:text-slate-600 dark:hover:text-[#94a3b8]'
              }`}
            >
              {block}
            </button>
          ))}
        </div>
      )}

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Category */}
            <div>
              <label className="block text-[11px] text-slate-700 dark:text-[#94a3b8] mb-1 font-medium">Category</label>
              <div className="space-y-1">
                {ALL_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-xs text-slate-800 dark:text-[#e2e8f0] cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(cat)}
                      onChange={() => setFilters({
                        categories: filters.categories.includes(cat)
                          ? filters.categories.filter((c) => c !== cat)
                          : [...filters.categories, cat]
                      })}
                      className="w-4 h-4 rounded border-slate-400 dark:border-[#2e303a] bg-white dark:bg-[#13151f] accent-[#3b82f6] focus:ring-[#3b82f6]/20"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            {/* Rarity */}
            <div>
              <label className="block text-[11px] text-slate-700 dark:text-[#94a3b8] mb-1 font-medium">Rarity</label>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {ALL_RARITIES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-xs text-slate-800 dark:text-[#e2e8f0] cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={filters.rarities.includes(r)}
                      onChange={() => setFilters({
                        rarities: filters.rarities.includes(r)
                          ? filters.rarities.filter((x) => x !== r)
                          : [...filters.rarities, r]
                      })}
                      className="w-4 h-4 rounded border-slate-400 dark:border-[#2e303a] bg-white dark:bg-[#13151f] accent-[#3b82f6] focus:ring-[#3b82f6]/20"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {/* Attribute */}
            <div>
              <label className="block text-[11px] text-slate-700 dark:text-[#94a3b8] mb-1 font-medium">Attribute</label>
              <div className="space-y-1">
                {ALL_ATTRIBUTES.map((attr) => (
                  <label key={attr} className="flex items-center gap-2 text-xs text-slate-800 dark:text-[#e2e8f0] cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={filters.attributes.includes(attr)}
                      onChange={() => setFilters({
                        attributes: filters.attributes.includes(attr)
                          ? filters.attributes.filter((a) => a !== attr)
                          : [...filters.attributes, attr]
                      })}
                      className="w-4 h-4 rounded border-slate-400 dark:border-[#2e303a] bg-white dark:bg-[#13151f] accent-[#3b82f6] focus:ring-[#3b82f6]/20"
                    />
                    {attr}
                  </label>
                ))}
              </div>
            </div>

            {/* Set + ranges */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-700 dark:text-[#94a3b8] mb-1 font-medium">Set</label>
                <select
                  value={filters.setPrefix || ''}
                  onChange={(e) => setFilters({ setPrefix: e.target.value || null })}
                  className="w-full bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-1.5 text-base text-slate-900 dark:text-white focus:outline-none focus:border-[#3b82f6]"
                >
                  <option value="">All Sets</option>
                  {sets.map((set) => (
                    <option key={set} value={set}>{set}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-700 dark:text-[#94a3b8] mb-1">Cost</label>
                  <div className="flex gap-1">
                    <input type="number" placeholder="0" value={filters.costMin ?? ''} onChange={(e) => setFilters({ costMin: e.target.value === '' ? null : Number(e.target.value) })} className="w-full bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-1 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b]" />
                    <input type="number" placeholder="10" value={filters.costMax ?? ''} onChange={(e) => setFilters({ costMax: e.target.value === '' ? null : Number(e.target.value) })} className="w-full bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-1 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-700 dark:text-[#94a3b8] mb-1">Power</label>
                  <div className="flex gap-1">
                    <input type="number" placeholder="0" value={filters.powerMin ?? ''} onChange={(e) => setFilters({ powerMin: e.target.value === '' ? null : Number(e.target.value) })} className="w-full bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-1 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b]" />
                    <input type="number" placeholder="15k" value={filters.powerMax ?? ''} onChange={(e) => setFilters({ powerMax: e.target.value === '' ? null : Number(e.target.value) })} className="w-full bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-1 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}