import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCardById, getCardPacks, getCardVariants } from '../db'
import { useAppStore } from '../store'
import type { Card } from '../types'
import CardDetailContent from './CardDetailContent'

export default function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const search = useAppStore((state) => state.filters.search)
  const preferredLanguage = useAppStore((state) => state.preferredLanguage)
  const loadExternalImages = useAppStore((state) => state.loadExternalImages)
  const isSlowConnection = useAppStore((state) => state.isSlowConnection)
  const slowConnectionOverride = useAppStore((state) => state.slowConnectionOverride)
  const showImages = loadExternalImages && (!isSlowConnection || slowConnectionOverride)

  const [card, setCard] = useState<Card | null>(null)
  const [cardPacks, setCardPacks] = useState<{ packId: string; label: string; rawTitle: string }[]>([])
  const [cardVariants, setCardVariants] = useState<{ card: Card; images: { language: string; imgUrl: string | null }[]; packs: { title: string; language: string }[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCard() {
      if (!id) {
        if (!cancelled) {
          setError('Missing card ID')
          setLoading(false)
        }
        return
      }

      try {
        const result = await getCardById(id!, preferredLanguage)
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
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
          setLoading(false)
        }
      }
    }

    loadCard()
    return () => { cancelled = true }
  }, [id, preferredLanguage])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-slate-200 dark:border-[#2e303a] border-t-[#3b82f6] rounded-full animate-spin" role="status" aria-label="Loading card" />
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="py-20 text-center">
        <div className="text-4xl mb-3">🏴‍☠️</div>
        <div className="text-slate-500 dark:text-[#64748b] text-sm">{error || 'Card not found'}</div>
        <Link to="/" className="mt-4 inline-block text-[#3b82f6] dark:text-[#60a5fa] text-sm hover:underline">
          Back to search
        </Link>
      </div>
    )
  }

  const languagePriority: Record<string, number> = preferredLanguage === 'japanese'
    ? { japanese: 0, 'english-asia': 0, english: 1 }
    : { english: 0, 'english-asia': 1, japanese: 2 }
  const bestImageUrl = cardVariants
    .flatMap((v) => v.images)
    .filter((img): img is { language: string; imgUrl: string } => !!img.imgUrl)
    .sort((a, b) => (languagePriority[a.language] ?? 3) - (languagePriority[b.language] ?? 3))[0]?.imgUrl ?? null

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      <CardDetailContent
        card={card}
        bestImageUrl={bestImageUrl}
        cardVariants={cardVariants}
        cardPacks={cardPacks}
        showImages={showImages}
        search={search}
        preferredLanguage={preferredLanguage}
        onMainImageClick={(url) => window.open(url, '_blank')}
        variant="page"
      />
    </div>
  )
}
