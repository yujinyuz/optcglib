import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCardById, getCardPacks, getCardVariants, getRelatedCards } from '../db'
import type { Card } from '../types'
import { COLOR_HEX, RARITY_SHORT } from '../types'
import { decodeHtmlEntities, renderCardText } from '../utils'

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'Common': return '#64748b'
    case 'Uncommon': return '#475569'
    case 'Rare': return '#3b82f6'
    case 'SuperRare': return '#a855f7'
    case 'SecretRare': return '#eab308'
    case 'Leader': return '#e74c3c'
    case 'Special': return '#ec4899'
    case 'TreasureRare': return '#f59e0b'
    case 'Promo': return '#22c55e'
    default: return '#64748b'
  }
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'Leader': return '👑'
    case 'Character': return '⚔'
    case 'Event': return '⚡'
    case 'Stage': return '🏰'
    case 'Don': return '💎'
    default: return ''
  }
}

export default function CardDetail() {
  const { id } = useParams<{ id: string }>()

  const [card, setCard] = useState<Card | null>(null)
  const [cardPacks, setCardPacks] = useState<{ packId: string; label: string; rawTitle: string; language: string }[]>([])
  const [cardVariants, setCardVariants] = useState<{ card: Card; images: { language: string; imgUrl: string | null }[] }[]>([])
  const [relatedCards, setRelatedCards] = useState<Card[]>([])
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
        const result = await getCardById(id!)
        if (cancelled) return
        setCard(result)

        if (result) {
          const [packs, variants, related] = await Promise.all([
            getCardPacks(result.id),
            getCardVariants(result.id),
            getRelatedCards(result.id, result.types, 8),
          ])
          if (cancelled) return
          setCardPacks(packs)
          setCardVariants(variants)
          setRelatedCards(related)
        }

        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
          setLoading(false)
        }
      }
    }

    loadCard()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-slate-200 dark:border-[#2e303a] border-t-[#3b82f6] rounded-full animate-spin mx-auto mb-4" />
        <div className="text-slate-500 dark:text-[#94a3b8] text-sm">Loading card...</div>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-red-500 dark:text-red-400 mb-4 font-medium">{error || 'Card not found'}</div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to cards
        </Link>
      </div>
    )
  }

  const rarityColor = getRarityColor(card.rarity)
  const setPrefix = card.id.split('-')[0]
  const primaryColor = card.colors[0] ? COLOR_HEX[card.colors[0]] : '#64748b'
  const colorGradient = card.colors.length > 1
    ? `linear-gradient(135deg, ${card.colors.map(c => COLOR_HEX[c] || c).join(', ')})`
    : primaryColor
  const baseId = card.id.replace(/_[pr]\d+$/, '')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back button */}
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to cards
      </Link>

      {/* Card frame */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#2e303a] bg-white dark:bg-[#1a1d2e] mb-6">
        {/* Color strip */}
        <div className="h-2" style={{ background: colorGradient }} />

        <div className="p-5">
          {/* Header: rarity + id + set */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: rarityColor }}>
              {RARITY_SHORT[card.rarity] || card.rarity}
            </span>
            <span className="text-xs text-slate-500 dark:text-[#64748b] font-mono">{card.id}</span>
            <span className="text-[10px] bg-slate-100 dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] text-slate-600 dark:text-[#94a3b8] px-1.5 py-0.5 rounded">{setPrefix}</span>
            <span className="text-xs ml-auto">{getCategoryIcon(card.category)} {card.category}</span>
          </div>

          {/* Card name */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight mb-4">{decodeHtmlEntities(card.name)}</h1>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {card.colors.map((color) => (
              <span key={color} className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-[#e2e8f0]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[color] || color }} />
                {color}
              </span>
            ))}
            {card.cost !== null && (
              <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-lg px-3 py-1.5 text-sm">
                <span className="w-5 h-5 rounded-full bg-[#f1c40f] text-white text-[10px] font-bold inline-flex items-center justify-center">{card.cost}</span>
                <span className="text-slate-600 dark:text-[#94a3b8]">Cost</span>
              </span>
            )}
            {card.power !== null && (
              <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-lg px-3 py-1.5 text-sm">
                <span className="text-[#e74c3c] font-bold">⚔</span>
                <span className="text-slate-800 dark:text-[#e2e8f0]">{card.power}</span>
              </span>
            )}
            {card.counter !== null && (
              <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-lg px-3 py-1.5 text-sm">
                <span className="text-[#3498db] font-bold">＋</span>
                <span className="text-slate-800 dark:text-[#e2e8f0]">{card.counter}</span>
              </span>
            )}
            {card.block_number !== null && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-500 dark:bg-[#3e4050] text-white text-xs font-bold">
                {card.block_number}
              </span>
            )}
          </div>

          {/* Attributes & Types */}
          {(card.attributes.length > 0 || card.types.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              {card.attributes.map((attr) => (
                <span key={attr} className="text-xs text-slate-600 dark:text-[#94a3b8] bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-0.5">{attr}</span>
              ))}
              {card.types.map((type) => (
                <span key={type} className="text-xs text-slate-600 dark:text-[#94a3b8] bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-0.5">{type}</span>
              ))}
            </div>
          )}

          {/* Image variants */}
          {cardVariants.length > 0 && (
            <div className="mb-4 space-y-2">
              {cardVariants.map((variant) => (
                <div key={variant.card.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold shrink-0">
                    {variant.card.id === card.id ? 'Image' : variant.card.id.replace(card.id, '').replace(/^_/ , '') || 'Alt'}
                  </span>
                  {variant.images.length > 0 ? (
                    variant.images.map((img) => (
                      <a
                        key={img.language}
                        href={img.imgUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2.5 py-1 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-[#3b82f6] transition-all"
                      >
                        {img.language === 'english-asia' ? 'Asia' : img.language === 'japanese' ? 'JP' : 'EN'}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-[#64748b]">No images</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Price links */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold shrink-0">Price</span>
            <a
              href={`https://www.mercardop.jp/product-list?keyword=${encodeURIComponent(baseId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2.5 py-1 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-[#3b82f6] transition-all"
            >
              mercard
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a
              href={`https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(baseId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2.5 py-1 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-[#3b82f6] transition-all"
            >
              yuyu-tei
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Packs */}
          {cardPacks.length > 0 && (
            <div className="mb-4">
              <h2 className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-1.5">
                Found in {cardPacks.length === 1 ? '1 pack' : `${cardPacks.length} packs`}
              </h2>
              <div className="space-y-0.5">
                {cardPacks.map((pack) => (
                  <div key={`${pack.packId}-${pack.language}`} className="text-xs text-slate-800 dark:text-[#e2e8f0]">
                    {pack.rawTitle || pack.label || pack.packId}
                    {pack.language !== 'english' && (
                      <span className="text-[10px] text-slate-400 dark:text-[#64748b] ml-1">({pack.language})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Effect */}
      {card.effect && (
        <div className="bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-xl p-4 mb-4">
          <h2 className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-2">Effect</h2>
          <p className="text-sm text-slate-800 dark:text-[#e2e8f0] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderCardText(card.effect) }} />
        </div>
      )}

      {/* Trigger */}
      {card.trigger_text && (
        <div className="bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-xl p-4 mb-4">
          <h2 className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-2">Trigger</h2>
          <p className="text-sm text-slate-800 dark:text-[#e2e8f0] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderCardText(card.trigger_text) }} />
        </div>
      )}

      {/* Related cards */}
      {relatedCards.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Related cards</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {relatedCards.map((rc) => (
              <Link
                key={rc.id}
                to={`/card/${rc.id}`}
                className="block rounded-lg overflow-hidden border border-slate-200 dark:border-[#2e303a] hover:border-slate-300 dark:hover:border-[#3e4050] transition-all bg-white dark:bg-[#1a1d2e]"
              >
                <div
                  className="h-1"
                  style={{
                    background: rc.colors.length > 1
                      ? `linear-gradient(90deg, ${rc.colors.map(c => COLOR_HEX[c] || c).join(', ')})`
                      : (COLOR_HEX[rc.colors[0]] || '#64748b')
                  }}
                />
                <div className="p-2">
                  <div className="text-xs font-medium text-slate-900 dark:text-white line-clamp-1">{decodeHtmlEntities(rc.name)}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-mono text-slate-400 dark:text-[#64748b]">{rc.id}</span>
                    {rc.cost !== null && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#f1c40f] text-white text-[8px] font-bold">{rc.cost}</span>
                    )}
                    {rc.power !== null && (
                      <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">⚔{rc.power}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}