import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../store'
import { prefersReducedMotion } from '../lib/spring'

function useActiveFilterCount(): number {
  const filters = useAppStore((state) => state.filters)

  let count = 0
  if (filters.search) count++
  if (filters.colors.length > 0) count++
  if (filters.categories.length > 0) count++
  if (filters.rarities.length > 0) count++
  if (filters.attributes.length > 0) count++
  if (filters.sets.length > 0) count++
  if (filters.blocks.length > 0) count++
  if (filters.costMin != null || filters.costMax != null) count++
  if (filters.powerMin != null || filters.powerMax != null) count++
  if (filters.counterMin != null || filters.counterMax != null) count++

  return count
}

export default function FilterFAB({ sidebarOpen }: { sidebarOpen: boolean }) {
  const [mounted, setMounted] = useState(false)
  const reducedMotion = prefersReducedMotion()
  const count = useActiveFilterCount()
  const btnRef = useRef<HTMLButtonElement>(null)

  // Animate in on mount
  useEffect(() => {
    if (reducedMotion) {
      setMounted(true)
      return
    }
    // Small delay so the browser paints the hidden state first
    const raf = requestAnimationFrame(() => {
      setMounted(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  // Spring entrance animation via WAAPI
  useEffect(() => {
    if (!mounted || !btnRef.current) return
    if (reducedMotion) return

    const el = btnRef.current
    const keyframes: Keyframe[] = [
      { opacity: '0', transform: 'scale(0.6)' },
      { opacity: '1', transform: 'scale(1.08)' },
      { opacity: '1', transform: 'scale(1)' },
    ]
    el.animate(keyframes, {
      duration: 350,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    })
  }, [mounted, reducedMotion])

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('optcg-open-sidebar'))
  }

  // Don't render at all until mount animation starts
  if (!mounted) return null

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      aria-label="Open filters"
      className={`
        sm:hidden fixed bottom-6 right-6 z-20
        w-14 h-14 rounded-full
        bg-[#3b82f6] hover:bg-[#2563eb] active:bg-[#1d4ed8]
        flex items-center justify-center
        text-white
        shadow-lg shadow-[#3b82f6]/30
        dark:shadow-[#3b82f6]/40 dark:shadow-xl
        transition-transform
        ${sidebarOpen ? 'pointer-events-none' : ''}
      `}
      style={{
        transition: `transform ${reducedMotion ? 150 : 250}ms var(--ease-spring-tight), opacity ${reducedMotion ? 100 : 200}ms ease-out`,
        transform: sidebarOpen ? 'scale(0.6)' : 'scale(1)',
        opacity: sidebarOpen ? 0 : 1,
      }}
    >
      {/* Sliders / filter icon */}
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 7h.01M12 7h.01" />
      </svg>

      {/* Active filter badge */}
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#ef4444] text-white text-xs font-bold flex items-center justify-center leading-none"
          style={{ fontSize: '11px' }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
