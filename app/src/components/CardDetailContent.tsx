import type { Card } from '../types'
import { COLOR_HEX, RARITY_SHORT, CATEGORY_COLORS } from '../types'
import { decodeHtmlEntities, renderCardText, highlightSearchText, getAttributeIcon, getAttributeColor, getTextColorForBg, costCircleBg, getExternalImageUrl, groupImagesByLanguage } from '../utils'
import ImageLoader from './ImageLoader'
import PriceLinks from './PriceLinks'

export interface CardDetailContentProps {
  card: Card
  bestImageUrl: string | null
  cardVariants: { card: Card; images: { language: string; imgUrl: string | null }[]; packs: { title: string; language: string }[] }[]
  cardPacks: { packId: string; label: string; rawTitle: string }[]
  showImages: boolean
  search: string
  preferredLanguage: string
  onMainImageClick?: (url: string) => void
  onAltImageClick?: (url: string) => void
  variant?: 'page' | 'modal'
}

export default function CardDetailContent({
  card,
  bestImageUrl,
  cardVariants,
  cardPacks,
  showImages,
  search,
  onMainImageClick,
  onAltImageClick,
  variant = 'page',
}: CardDetailContentProps) {
  const isModal = variant === 'modal'
  const px = isModal ? 'px-3 sm:px-4' : 'px-4'
  const p = isModal ? 'p-3 sm:p-4' : 'p-4'

  const primaryColor = card.colors[0] ? COLOR_HEX[card.colors[0]] : '#64748b'
  const costBg = costCircleBg(card)
  const categoryColor = CATEGORY_COLORS[card.category]

  const variantSuffix = card.id !== card.base_id
    ? (card.id.match(/_p\d+$/) ? ' (Parallel)'
    : card.id.match(/_r\d+$/) ? ' (Reprint)'
    : '')
    : ''

  return (
    <>
      {/* Card profile */}
      <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-[#1a1d2e] shadow-xl shadow-black/10 dark:shadow-black/30">
        {/* Vertical counter strip — left edge */}
        {(!showImages || !bestImageUrl) && card.counter !== null && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center bg-slate-900 dark:bg-black px-1.5 py-3 rounded-r-lg shadow-lg">
            <span
              className="text-xs font-bold text-white tracking-wider"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              +{card.counter}
            </span>
          </div>
        )}

        {/* Top strip: Cost | Power | Attribute */}
        {(!showImages || !bestImageUrl) && (
          <div
            className={`flex items-center justify-between ${px} pt-4 pb-2`}
            style={{ background: card.colors.length > 1 ? `linear-gradient(to right, ${card.colors.map(c => COLOR_HEX[c] || '#64748b').map(h => `${h}18`).join(', ')})` : `${primaryColor}18` }}
          >
            {card.cost !== null ? (
              <span
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold shadow-md ${getTextColorForBg(primaryColor)}`}
                style={costBg}
              >
                {card.cost}
              </span>
            ) : (
              <span className="w-10" />
            )}

            <div className="flex items-center gap-2">
              {card.power !== null && (
                <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
                  {card.power}
                </span>
              )}
              {card.attributes.length > 0 && (
                <div className={`inline-flex items-center ${card.attributes.length > 1 ? 'divide-x divide-white/20' : ''}`}>
                  {card.attributes.map((attr, i) => (
                    <span
                      key={attr}
                      className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold ${getTextColorForBg(getAttributeColor(attr))} ${card.attributes.length === 1 ? 'rounded-full' : i === 0 ? 'rounded-l-full' : 'rounded-r-full'}`}
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

        {/* Card image */}
        {showImages && bestImageUrl ? (
          <div className="flex items-center justify-center py-2">
            <div className="relative w-full max-w-xs aspect-[5/7] rounded-lg overflow-hidden bg-slate-100 dark:bg-[#1a1d2e] shadow-md">
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/loading-logo.webp"
                  alt=""
                  className="w-20 opacity-30 animate-pulse dark:invert"
                />
              </div>
              <ImageLoader
                key={bestImageUrl}
                src={getExternalImageUrl(bestImageUrl)}
                alt={card.name}
                className="absolute inset-0 w-full h-full object-contain cursor-zoom-in"
                onClick={() => onMainImageClick?.(getExternalImageUrl(bestImageUrl))}
              />
            </div>
          </div>
        ) : bestImageUrl && (
          <div className="flex items-center justify-center py-4">
            <a
              href={bestImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-[#1a1d2e] text-slate-400 dark:text-[#64748b] hover:text-[#3b82f6] shadow-md hover:scale-110 transition-all"
              title="Open card image in new tab"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Card Effect */}
        {(card.effect || card.trigger_text) && (
          <div className={`${px} pb-3`}>
            <div className={`mt-3 rounded-xl bg-white dark:bg-[#0f1117] ${p}`}>
              {card.effect && (
                <div
                  className="text-sm text-slate-900 dark:text-white leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlightSearchText(renderCardText(card.effect), search) }}
                />
              )}
              {card.trigger_text && (
                <div
                  className={`text-sm text-slate-700 dark:text-[#94a3b8] leading-relaxed ${card.effect ? 'mt-2' : ''}`}
                  dangerouslySetInnerHTML={{ __html: highlightSearchText(renderCardText(card.trigger_text), search) }}
                />
              )}
            </div>
          </div>
        )}

        {/* Category -> Name -> Type */}
        <div className={`${px} pb-3`}>
          <div
            className="text-[10px] font-medium tracking-[0.3em] uppercase text-center"
            style={card.rarity === 'Leader' ? { color: '#f59e0b' } : (categoryColor ? { color: categoryColor } : undefined)}
          >
            {card.rarity === 'Leader' && (
              <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2-2h10v2H7v-2z" />
              </svg>
            )}
            {card.category === 'Don' ? 'DON!!' : card.category}
          </div>

          <h1 className="mt-0.5 text-2xl text-slate-900 dark:text-white text-center leading-snug card-name">
            <span dangerouslySetInnerHTML={{ __html: highlightSearchText(decodeHtmlEntities(card.name), search) }} />
            {variantSuffix && <span className="text-sm font-normal text-slate-400 dark:text-[#64748b]">{variantSuffix}</span>}
          </h1>

          {card.types.length > 0 && (
            <div className="mt-0.5 text-sm text-center text-slate-500 dark:text-[#94a3b8] truncate">
              <span dangerouslySetInnerHTML={{ __html: highlightSearchText(card.types.join(' / '), search) }} />
            </div>
          )}

          {/* Attributes — text labels below types (no-image mode) */}
          {(!showImages || !bestImageUrl) && card.attributes.length > 0 && (
            <div className="mt-0.5 text-sm text-center truncate">
              {card.attributes.map((attr, i) => (
                <span key={attr} style={{ color: getAttributeColor(attr) }}>
                  {attr}{i < card.attributes.length - 1 && <span className="text-slate-500 dark:text-[#94a3b8]"> / </span>}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Bottom banner */}
        <div className={`${px} py-3 bg-slate-900 dark:bg-[#0c0e17] text-white`}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono">{card.id}</span>
            <div className="flex items-center gap-2">
              {card.rarity === 'Leader' ? (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-500 text-white">
                  L
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-white/20">
                  {RARITY_SHORT[card.rarity] || card.rarity}
                </span>
              )}
              {card.block_number !== null && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs font-bold">
                  {card.block_number}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Price links */}
      <PriceLinks baseId={card.base_id} />

      {/* Image variants / alternate arts */}
      {cardVariants.length > 0 && showImages && (
        <div className="mt-4">
          <h3 className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-2">
            Alternate arts
          </h3>
          {onAltImageClick ? (
            /* Inline images with zoom */
            <div className="space-y-4">
              {(() => {
                const { english, japanese } = groupImagesByLanguage(cardVariants, card.id)
                return (
                  <>
                    {english.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-1.5">English</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {english.map((img) => (
                            <div key={img.imgUrl} className="flex flex-col items-center gap-1">
                              <ImageLoader
                                src={getExternalImageUrl(img.imgUrl)}
                                alt=""
                                className={`w-full rounded-lg shadow-md cursor-zoom-in ${img.isCurrentVariant ? 'ring-2 ring-[#3b82f6]' : ''}`}
                                onClick={() => onAltImageClick(getExternalImageUrl(img.imgUrl))}
                              />
                              <span className="text-[10px] text-slate-500 dark:text-[#64748b]">
                                {img.packName || ''}{img.variantSuffix}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {japanese.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-1.5">Japanese</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {japanese.map((img) => (
                            <div key={img.imgUrl} className="flex flex-col items-center gap-1">
                              <ImageLoader
                                src={getExternalImageUrl(img.imgUrl)}
                                alt=""
                                className={`w-full rounded-lg shadow-md cursor-zoom-in ${img.isCurrentVariant ? 'ring-2 ring-[#3b82f6]' : ''}`}
                                onClick={() => onAltImageClick(getExternalImageUrl(img.imgUrl))}
                              />
                              <span className="text-[10px] text-slate-500 dark:text-[#64748b]">
                                {img.packName || ''}{img.variantSuffix}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          ) : (
            /* External links */
            <div className="space-y-3">
              {(() => {
                const { english, japanese } = groupImagesByLanguage(cardVariants, card.id)
                return (
                  <>
                    {english.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-1.5">English</div>
                        <div className="flex flex-wrap gap-1.5">
                          {english.map((img) => (
                            <a
                              key={img.imgUrl}
                              href={img.imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2.5 py-1 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-[#3b82f6] transition-all"
                            >
                              {img.packName || 'Alt'}{img.variantSuffix}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {japanese.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-1.5">Japanese</div>
                        <div className="flex flex-wrap gap-1.5">
                          {japanese.map((img) => (
                            <a
                              key={img.imgUrl}
                              href={img.imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2.5 py-1 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-[#3b82f6] transition-all"
                            >
                              {img.packName || 'Alt'}{img.variantSuffix}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Packs */}
      {cardPacks.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold mb-2">
            Found in
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {cardPacks.map((pack) => (
              <span
                key={pack.packId}
                className="text-[11px] bg-slate-100 dark:bg-[#13151f] border border-slate-200 dark:border-[#2e303a] rounded-md px-2 py-0.5 text-slate-600 dark:text-[#94a3b8]"
                title={pack.label}
              >
                {pack.rawTitle}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
