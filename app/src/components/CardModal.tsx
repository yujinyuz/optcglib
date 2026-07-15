import { useEffect, useState, useCallback, useRef } from 'react'
import { getCardById, getCardPacks, getCardVariants } from '../db'
import { useAppStore } from '../store'
import type { Card } from '../types'
import { prefersReducedMotion } from '../lib/spring'
import { useSwipe, snapBack } from '../lib/gesture'
import CardDetailContent from './CardDetailContent'
import ImageLoader from './ImageLoader'

interface CardModalProps {
  cardId: string
  onClose: () => void
}

export default function CardModal({ cardId, onClose }: CardModalProps) {
  const [card, setCard] = useState<Card | null>(null)
  const [cardPacks, setCardPacks] = useState<{ packId: string; label: string; rawTitle: string }[]>([])
  const [cardVariants, setCardVariants] = useState<{ card: Card; images: { language: string; imgUrl: string | null }[]; packs: { title: string; language: string }[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const cards = useAppStore((state) => state.cards)
  const setSelectedCard = useAppStore((state) => state.setSelectedCard)
  const search = useAppStore((state) => state.filters.search)
  const preferredLanguage = useAppStore((state) => state.preferredLanguage)
  const loadExternalImages = useAppStore((state) => state.loadExternalImages)
  const isSlowConnection = useAppStore((state) => state.isSlowConnection)
  const slowConnectionOverride = useAppStore((state) => state.slowConnectionOverride)
  const showImages = loadExternalImages && (!isSlowConnection || slowConnectionOverride)
  const reducedMotion = prefersReducedMotion()

  const currentIndex = cards.findIndex((c) => c.id === cardId)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < cards.length - 1

  const goPrev = useCallback(() => {
    if (hasPrev) setSelectedCard(cards[currentIndex - 1])
  }, [hasPrev, currentIndex, cards, setSelectedCard])

  const goNext = useCallback(() => {
    if (hasNext) setSelectedCard(cards[currentIndex + 1])
  }, [hasNext, currentIndex, cards, setSelectedCard])

  // Swipe gesture for prev/next navigation
  const swipeOffsetRef = useRef(0)
  const { handlers: swipeHandlers } = useSwipe({
    threshold: 80,
    maxDistance: 200,
    direction: 'x',
    onSwipe: (_velocity, _distance, direction) => {
      if (direction === 'left' && hasNext) goNext()
      else if (direction === 'right' && hasPrev) goPrev()
      else if (modalRef.current) snapBack(modalRef.current, 'x', 250)
      swipeOffsetRef.current = 0
    },
    onDrag: (offsetX) => {
      swipeOffsetRef.current = offsetX
    },
    onRelease: () => {
      if (modalRef.current && Math.abs(swipeOffsetRef.current) > 0) {
        snapBack(modalRef.current, 'x', 250)
      }
      swipeOffsetRef.current = 0
    },
    resistance: 0.5,
  })

  useEffect(() => {
    let cancelled = false

    async function loadCard() {
      try {
        const result = await getCardById(cardId, preferredLanguage)
        if (cancelled) return
        setCard(result)

        if (result) {
          const [packs, variantsResult] = await Promise.all([
            getCardPacks(result.id),
            getCardVariants(result.base_id),
          ])
          if (cancelled) return
          setCardPacks(packs)
          setCardVariants(variantsResult.variants)
        }

        if (!cancelled) setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    loadCard()
    return () => { cancelled = true }
  }, [cardId, preferredLanguage])

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
    swipeOffsetRef.current = 0
  }, [cardId])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, reducedMotion ? 100 : 200)
  }, [onClose, reducedMotion])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (zoomedImg) {
        setZoomedImg(null)
      } else {
        handleClose()
      }
    }
    if (e.key === 'ArrowLeft') goPrev()
    if (e.key === 'ArrowRight') goNext()
  }, [handleClose, goPrev, goNext, zoomedImg])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [handleKeyDown])

  const overlayStyle = closing
    ? { animation: `modalOverlayOut ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }
    : { animation: `modalOverlayIn ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }

  let inner: React.ReactNode
  if (loading) {
    inner = <div className="w-8 h-8 border-2 border-slate-200 dark:border-[#2e303a] border-t-[#3b82f6] rounded-full animate-spin" />
  } else if (!card) {
    inner = (
      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🏴‍☠️</div>
        <div className="text-slate-500 dark:text-[#64748b] text-sm">Card not found</div>
      </div>
    )
  } else {
    const languagePriority: Record<string, number> = preferredLanguage === 'japanese'
      ? { japanese: 0, 'english-asia': 0, english: 1 }
      : { english: 0, 'english-asia': 1, japanese: 2 }

    const currentVariant = cardVariants.find((v) => v.card.id === card.id)
    const currentImages = currentVariant?.images.filter((img): img is { language: string; imgUrl: string } => !!img.imgUrl) ?? []
    const currentBestImage = currentImages
      .sort((a, b) => (languagePriority[a.language] ?? 3) - (languagePriority[b.language] ?? 3))[0]?.imgUrl ?? null

    const fallbackImage = cardVariants
      .flatMap((v) => v.images)
      .filter((img): img is { language: string; imgUrl: string } => !!img.imgUrl)
      .sort((a, b) => (languagePriority[a.language] ?? 3) - (languagePriority[b.language] ?? 3))[0]?.imgUrl ?? null

    const bestImageUrl = currentBestImage ?? fallbackImage

    inner = (
      <>
        {/* Swipe hint edges */}
        {hasPrev && (
          <div className="sm:hidden absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-r from-slate-400/20 to-transparent rounded-r-full animate-[swipeHint_2s_ease-in-out_1s_3]" />
        )}
        {hasNext && (
          <div className="sm:hidden absolute right-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-l from-slate-400/20 to-transparent rounded-l-full animate-[swipeHint_2s_ease-in-out_1.5s_3]" />
        )}

        {/* Prev arrow */}
        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev() }}
            className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-[10px] sm:p-3 rounded-full bg-white/90 dark:bg-black/60 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white shadow-lg hover:scale-105 transition-all touch-manipulation"
            style={{ transition: 'transform 200ms var(--ease-spring-snappy), box-shadow 150ms var(--ease-out-quart)' }}
            aria-label="Previous card"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext() }}
            className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-[10px] sm:p-3 rounded-full bg-white/90 dark:bg-black/60 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white shadow-lg hover:scale-105 transition-all touch-manipulation"
            style={{ transition: 'transform 200ms var(--ease-spring-snappy), box-shadow 150ms var(--ease-out-quart)' }}
            aria-label="Next card"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div
          ref={(el) => {
            contentRef.current = el
            modalRef.current = el
          }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl"
          style={{
            animation: closing
              ? `modalContentOutSpring ${reducedMotion ? 100 : 200}ms var(--ease-out-quart) forwards`
              : `modalContentInSpring ${reducedMotion ? 100 : 250}ms var(--ease-spring-default) forwards`,
            viewTransitionName: 'optcg-card-morph',
          }}
          onClick={(e) => e.stopPropagation()}
          {...swipeHandlers}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-white/90 dark:bg-black/60 text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center"
            style={{ transition: 'transform 150ms var(--ease-spring-tight), box-shadow 150ms var(--ease-out-quart), color 150ms' }}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="px-4 py-6">
            <CardDetailContent
              card={card}
              bestImageUrl={bestImageUrl}
              cardVariants={cardVariants}
              cardPacks={cardPacks}
              showImages={showImages}
              search={search}
              preferredLanguage={preferredLanguage}
              onMainImageClick={(url) => setZoomedImg(url)}
              {...(showImages ? { onAltImageClick: (url: string) => setZoomedImg(url) } : {})}
              variant="modal"
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      style={overlayStyle}
    >
      {inner}

      {/* Full-screen image zoom overlay */}
      {zoomedImg && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={(e) => { e.stopPropagation(); setZoomedImg(null) }}
        >
          <div className="relative">
            <ImageLoader
              src={zoomedImg}
              alt="Full view"
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={() => setZoomedImg(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
