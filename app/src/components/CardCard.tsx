import { useState, useCallback } from 'react'
import type { Card } from '../types'
import { COLOR_HEX, RARITY_SHORT, CATEGORY_COLORS } from '../types'
import { decodeHtmlEntities, renderCardText, highlightSearchText, getAttributeIcon, getAttributeColor, getTextColorForBg, costCircleBg, getExternalImageUrl } from '../utils'
import { useAppStore } from '../store'
import ImageLoader from './ImageLoader'

interface CardCardProps {
  card: Card
  displayName?: string
  disableClick?: boolean
}

export default function CardCard({ card, displayName, disableClick }: CardCardProps) {
  const setSelectedCard = useAppStore((state) => state.setSelectedCard)
  const search = useAppStore((state) => state.filters.search)
  const loadExternalImages = useAppStore((state) => state.loadExternalImages)
  const isOnline = useAppStore((state) => state.isOnline)
  const isSlowConnection = useAppStore((state) => state.isSlowConnection)
  const slowConnectionOverride = useAppStore((state) => state.slowConnectionOverride)
  const showImages = loadExternalImages && isOnline && (!isSlowConnection || slowConnectionOverride)
  const primaryColor = card.colors[0] ? COLOR_HEX[card.colors[0]] : '#64748b'
  const categoryColor = CATEGORY_COLORS[card.category]

  const [effectExpanded, setEffectExpanded] = useState(!showImages)
  const hasEffect = !!(card.effect || card.trigger_text)

  const handleToggleEffect = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    setEffectExpanded((prev) => !prev)
  }, [])

  const costBg = costCircleBg(card)

  const displayCardName = displayName || card.name

  const variantSuffix = card.id !== card.base_id
    ? (card.id.match(/_p\d+$/) ? ' (Parallel)'
    : card.id.match(/_r\d+$/) ? ' (Reprint)'
    : '')
    : ''

  const transition = 'box-shadow 150ms var(--ease-out-quart), transform 150ms var(--ease-out-quart)'
  const isLeader = card.rarity === 'Leader'
  const cardStyle = { transition }

  return (
    <div
      role="button"
      aria-label={card.name}
      tabIndex={0}
      onClick={() => { if (!disableClick) setSelectedCard(card) }}
      onKeyDown={(e) => { if (!disableClick && (e.key === 'Enter' || e.key === ' ')) setSelectedCard(card) }}
      className={`group relative flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#1a1d2e] shadow-md shadow-black/5 dark:shadow-white/5 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-white/10 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 h-full ${disableClick ? 'cursor-default' : 'cursor-pointer'}`}
      style={cardStyle}
    >
      {/* Color strip */}
      <div
        className="h-1.5 w-full shrink-0"
        style={{
          background: card.colors.length === 1
            ? primaryColor
            : `linear-gradient(90deg, ${card.colors.map((c) => COLOR_HEX[c]).join(', ')})`,
        }}
      />

      {/* Vertical counter strip — left edge */}
      {(!showImages && card.counter !== null) && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center bg-slate-900 dark:bg-black w-3 py-2 rounded-r shadow-sm">
          <span
            className="text-[7px] font-bold text-white tracking-wide leading-tight"
            style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
          >
            +{card.counter}
          </span>
        </div>
      )}

      {/* Top strip: Cost | Power | Attribute (only when no image) */}
      {(!showImages || !card.img_url) && (
      <div className="flex items-center justify-between px-2 py-1.5 shrink-0 min-h-[34px] bg-slate-50 dark:bg-[#13151f]">
        <div className="flex items-center gap-1.5">
          {card.cost !== null ? (
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shadow-sm ${getTextColorForBg(primaryColor)}`}
              style={costBg}
            >
              {card.cost}
            </span>
          ) : (
            <span className="w-6" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {card.power !== null && (
            <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">
              {card.power}
            </span>
          )}
          {card.attributes.length > 0 && (
            <div className={`inline-flex items-center ${card.attributes.length > 1 ? 'divide-x divide-white/20' : ''}`}>
              {card.attributes.map((attr, i) => (
                <span
                  key={attr}
                  className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold ${getTextColorForBg(getAttributeColor(attr))} ${card.attributes.length === 1 ? 'rounded-full' : i === 0 ? 'rounded-l-full' : 'rounded-r-full'}`}
                  style={{ backgroundColor: getAttributeColor(attr) }}
                >
                  {getAttributeIcon(attr)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Card image or link */}
      {showImages && card.img_url ? (
        <div className="shrink-0 bg-slate-50 dark:bg-[#13151f] relative">
          <ImageLoader
            src={getExternalImageUrl(card.img_url)}
            alt={card.name}
            className="w-full aspect-[5/7] object-cover"
          />
        </div>
      ) : card.img_url && (
        <div className="shrink-0 py-2 flex items-center justify-center bg-slate-50/50 dark:bg-[#13151f]/50">
          <a
            href={card.img_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:scale-105 transition-all"
            title="Open card image in new tab"
          >
            <img src="/loading-logo.webp" alt="" className="w-10 opacity-50 dark:invert" />
          </a>
        </div>
      )}

      {/* Effect -> Category -> Name -> Type */}
      <div className={`flex-1 py-2 flex flex-col min-h-0 ${(!showImages && card.counter !== null) ? 'pl-5 pr-2.5' : 'px-2.5'}`}>
        {/* Category */}
        <div
          className="text-[10px] font-medium tracking-[0.3em] uppercase text-center"
          style={isLeader
            ? { color: '#f59e0b' }
            : (categoryColor ? { color: categoryColor } : undefined)
          }
        >
          {isLeader && (
            <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2-2h10v2H7v-2z" />
            </svg>
          )}
          {card.category === 'Don' ? 'DON!!' : card.category}
        </div>

        {/* Name */}
        <h3 className="mt-0.5 text-sm text-slate-900 dark:text-white text-center leading-snug line-clamp-2 card-name">
          <span dangerouslySetInnerHTML={{ __html: highlightSearchText(decodeHtmlEntities(displayCardName), search) }} />{variantSuffix && <span className="text-[10px] font-normal text-slate-400 dark:text-[#64748b]">{variantSuffix}</span>}
        </h3>

        {/* Types */}
        <div className="mt-0.5 text-[10px] text-center text-slate-500 dark:text-[#64748b] leading-tight min-h-[14px]">
          {card.types.length > 0 ? <span dangerouslySetInnerHTML={{ __html: highlightSearchText(card.types.join(' / '), search) }} /> : '\u00A0'}
        </div>

        {/* Attributes — text labels below types (no-image mode) */}
        {!showImages && card.attributes.length > 0 && (
          <div className="mt-0.5 text-[10px] text-center truncate">
            {card.attributes.map((attr, i) => (
              <span key={attr} style={{ color: getAttributeColor(attr) }}>
                {attr}{i < card.attributes.length - 1 && <span className="text-slate-500 dark:text-[#64748b]"> / </span>}
              </span>
            ))}
          </div>
        )}

        {/* Effect — collapsible */}
        {hasEffect && (
          <div
            className="mt-1 text-left rounded bg-slate-50 dark:bg-[#13151f] px-1.5 py-1 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-[#1a1d2e] transition-colors"
            onClick={handleToggleEffect}
          >
            <div className={`text-[11px] leading-[1.3] text-slate-600 dark:text-[#94a3b8] ${effectExpanded ? '' : 'line-clamp-2'}`}>
              {card.effect && (
                <span dangerouslySetInnerHTML={{ __html: highlightSearchText(renderCardText(card.effect), search) }} />
              )}
              {card.trigger_text && (
                <span className="block mt-1 text-[10px] italic text-slate-700 dark:text-[#e2e8f0] bg-slate-200 dark:bg-[#020617] rounded px-1.5 py-0.5" dangerouslySetInnerHTML={{ __html: highlightSearchText(renderCardText(card.trigger_text), search) }} />
              )}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-[#475569] mt-0.5 inline-block">
              {effectExpanded ? 'Show less' : 'Show more'}
            </span>
          </div>
        )}

      </div>

      {/* Bottom banner — always dark */}
      <div className="shrink-0 px-2.5 py-1.5 bg-slate-900 dark:bg-[#0c0e17] text-white flex items-center justify-between text-[10px]">
        <span className="font-mono">{card.id}</span>
        <div className="flex items-center gap-1">
          {isLeader ? (
            <span className="px-1 rounded font-bold bg-amber-500 text-white text-[10px]">
              L
            </span>
          ) : (
            <span className="px-1 rounded bg-white/20 font-bold">
              {RARITY_SHORT[card.rarity] || card.rarity}
            </span>
          )}
          {card.block_number !== null && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold">
              {card.block_number}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
