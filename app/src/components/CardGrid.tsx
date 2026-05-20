import { useAppStore } from '../store'
import CardCard from './CardCard'
import SkeletonCard from './SkeletonCard'

export default function CardGrid() {
  const cards = useAppStore((state) => state.cards)
  const totalCards = useAppStore((state) => state.totalCards)
  const hasMore = useAppStore((state) => state.hasMore)
  const searching = useAppStore((state) => state.searching)
  const loadMore = useAppStore((state) => state.loadMore)

  return (
    <div className="px-4 sm:px-6 py-6">

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-600 dark:text-[#94a3b8]">
          {searching && cards.length === 0 ? (
            'Searching...'
          ) : (
            <>
              <span className="text-slate-900 dark:text-white font-medium">{cards.length}</span>
              {' '}of{' '}
              <span className="text-slate-900 dark:text-white font-medium">{totalCards}</span> cards
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {cards.map((card, i) => (
          <div
            key={card.id}
            style={{ animation: `cardIn 200ms var(--ease-out-expo) ${Math.min(i * 20, 300)}ms both` }}
          >
            <CardCard card={card} />
          </div>
        ))}
        {searching && Array.from({ length: 12 }, (_, i) => (
          <SkeletonCard key={`skeleton-${i}`} />
        ))}
      </div>

      {cards.length === 0 && !searching && (
        <div className="mt-16 text-center">
          <div className="text-slate-500 dark:text-[#64748b] text-sm font-medium">
            No cards found matching your filters.
          </div>
          <div className="text-slate-400 dark:text-[#4a5568] text-xs mt-1">
            Try adjusting your search or filter criteria.
          </div>
        </div>
      )}

      {hasMore && (
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={() => loadMore()}
            disabled={searching}
            className={`px-6 py-2.5 bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-lg text-sm font-medium text-slate-900 dark:text-white transition-all active:scale-[0.97] ${searching
              ? 'opacity-50 cursor-not-allowed pointer-events-none'
              : 'hover:bg-slate-100 dark:hover:bg-[#25283a] hover:border-slate-300 dark:hover:border-[#3e4050] hover:-translate-y-0.5 hover:shadow-md'
              }`}
            style={{ transition: 'box-shadow 150ms var(--ease-out-quart), transform 150ms var(--ease-out-quart), opacity 150ms, background-color 150ms, border-color 150ms' }}
          >
            {searching ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
