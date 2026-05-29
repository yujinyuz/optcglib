import DOMPurify from 'dompurify'
import { COLOR_HEX } from './types'
import type { Card } from './types'

export function getExternalImageUrl(imgUrl: string): string {
  return `https://serveproxy.com/?url=${encodeURIComponent(imgUrl)}`
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

/**
 * Decode common HTML entities in text (e.g. &amp; -> &)
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (match) => HTML_ENTITY_MAP[match] || match)
}

/**
 * Render card text that may contain HTML tags like <br>, <b>, <i>, etc.
 * from the One Piece TCG database. Also highlights OPTCG keywords.
 */
export function renderCardText(text: string | null | undefined): string {
  if (!text) return ''
  // Italicize parenthesized content
  const italicized = text.replace(/\(([^)]+)\)/g, '<i>($1)</i>')
  const sanitized = DOMPurify.sanitize(italicized, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'span', 'u'],
    ALLOWED_ATTR: [],
  })
  return highlightKeywords(sanitized)
}

/**
 * Highlight OPTCG keywords in rendered HTML text.
 * Wraps keywords in a styled span without breaking existing HTML tags.
 * Keywords extracted from english/english-asia source data.
 */
/**
 * Highlight OPTCG keywords in rendered HTML text.
 * Wraps keywords in styled spans without breaking existing HTML tags.
 */
function highlightKeywords(html: string): string {
  // Keyword → CSS class mapping (longest first to avoid partial matches)
  const keywordMap: [RegExp, string, string][] = [
    [/\[On Your Opponent's Attack\]/g, 'kw-on-opponent-attack', "On Your Opponent's Attack"],
    [/\[Activate: Main\]/g, 'kw-activate-main', 'Activate: Main'],
    [/\[Rush: Character\]/g, 'kw-rush-char', 'Rush: Character'],
    [/\[End of Your Turn\]/g, 'kw-end-turn', 'End of Your Turn'],
    [/\[Opponent's Turn\]/g, 'kw-opponent-turn', "Opponent's Turn"],
    [/\[Once Per Turn\]/g, 'kw-once-per-turn', 'Once Per Turn'],
    [/\[When Attacking\]/g, 'kw-when-attacking', 'When Attacking'],
    [/\[DON!! x(\d)\]/g, 'kw-don', 'DON!! x$1'],
    [/\[DON!! -10\]/g, 'kw-don', 'DON!! -10'],
    [/\[DON!! -8\]/g, 'kw-don', 'DON!! -8'],
    [/\[DON!! -7\]/g, 'kw-don', 'DON!! -7'],
    [/\[DON!! -6\]/g, 'kw-don', 'DON!! -6'],
    [/\[DON!! -5\]/g, 'kw-don', 'DON!! -5'],
    [/\[DON!! -4\]/g, 'kw-don', 'DON!! -4'],
    [/\[DON!! -3\]/g, 'kw-don', 'DON!! -3'],
    [/\[DON!! -2\]/g, 'kw-don', 'DON!! -2'],
    [/\[DON!! -1\]/g, 'kw-don', 'DON!! -1'],
    [/\[Counter\]/g, 'kw-counter', 'Counter'],
    [/\[Blocker\]/g, 'kw-blocker', 'Blocker'],
    [/\[Trigger\]/g, 'kw-trigger', 'Trigger'],
    [/\[Unblockable\]/g, 'kw-unblockable', 'Unblockable'],
    [/\[Banish\]/g, 'kw-banish', 'Banish'],
    [/\[On Play\]/g, 'kw-on-play', 'On Play'],
    [/\[On Block\]/g, 'kw-on-block', 'On Block'],
    [/\[On K\.O\.\]/g, 'kw-on-ko', 'On K.O.'],
    [/\[Your Turn\]/g, 'kw-your-turn', 'Your Turn'],
    [/\[Main\]/g, 'kw-main', 'Main'],
    [/\[Rush\]/g, 'kw-rush', 'Rush'],
    [/\[Double Attack\]/g, 'kw-double-attack', 'Double Attack'],
  ]

  // Split into HTML tags and text segments, only replace in text
  return html
    .split(/(<[^>]+>)/g)
    .map((segment) => {
      if (segment.startsWith('<')) return segment
      for (const [regex, cls, replacement] of keywordMap) {
        segment = segment.replace(regex, `<span class="${cls}">${replacement}</span>`)
      }
      return segment
    })
    .join('')
}

/** Strip HTML tags from a string */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Get kanji icon for a card attribute */
export function getAttributeIcon(attr: string): string {
  switch (attr) {
    case 'Strike': return '打'
    case 'Slash': return '斬'
    case 'Ranged': return '射'
    case 'Wisdom': return '知'
    case 'Special': return '特'
    default: return attr.slice(0, 1)
  }
}

/** Get color hex for a card attribute */
export function getAttributeColor(attr: string): string {
  switch (attr) {
    case 'Strike': return '#eab308'
    case 'Slash': return '#3b82f6'
    case 'Ranged': return '#e74c3c'
    case 'Wisdom': return '#22c55e'
    case 'Special': return '#a855f7'
    default: return '#eab308'
  }
}

/** Use dark text for light/bright backgrounds (Yellow, Green) to meet WCAG AA */
export function getTextColorForBg(hex: string): string {
  const lightBgHexes = ['#f1c40f', '#eab308', '#2ecc71', '#22c55e']
  return lightBgHexes.includes(hex.toLowerCase()) ? 'text-[#1a1a2e]' : 'text-white'
}

/** Build cost circle background style for a card */
export function costCircleBg(card: Card): React.CSSProperties {
  const primaryColor = card.colors[0] ? COLOR_HEX[card.colors[0]] : '#64748b'
  return card.colors.length === 1
    ? { backgroundColor: primaryColor }
    : {
        background: `conic-gradient(from 225deg, ${card.colors.map((c, i) => `${COLOR_HEX[c]} ${i * 180}deg ${(i + 1) * 180}deg`).join(', ')})`,
      }
}

/** Clean pack name by removing parallel/reprint suffixes */
export function cleanPackName(pack: string): string {
  return pack
    .replace(/_p\d+\s*\(Parallel\)/gi, '')
    .replace(/_r\d+\s*\(Reprint\)/gi, '')
    .replace(/_p\d+/g, '')
    .replace(/_r\d+/g, '')
    .trim()
}

/** Group card variant images by language */
export interface ArtImage {
  imgUrl: string
  isCurrentVariant: boolean
  packName?: string
  variantSuffix?: string
}

export function groupImagesByLanguage(
  variants: { card: Card; images: { language: string; imgUrl: string | null }[]; packs: { title: string; language: string }[] }[],
  currentCardId: string
): { english: ArtImage[]; japanese: ArtImage[] } {
  const enByUrl = new Map<string, ArtImage>()
  const jpByUrl = new Map<string, ArtImage>()

  for (const variant of variants) {
    const enPack = variant.packs.find(p => p.language === 'english')
    const jpPack = variant.packs.find(p => p.language === 'japanese')
    const isCurrent = variant.card.id === currentCardId

    for (const img of variant.images) {
      if (!img.imgUrl) continue
      const variantSuffix = variant.card.id !== variant.card.base_id
        ? (variant.card.id.match(/_p\d+$/) ? ' (Parallel)'
        : variant.card.id.match(/_r\d+$/) ? ' (Reprint)'
        : '')
        : ''
      if (img.language === 'japanese') {
        const packName = jpPack ? cleanPackName(jpPack.title) : undefined
        const entry: ArtImage = { imgUrl: img.imgUrl, isCurrentVariant: isCurrent, packName, variantSuffix }
        if (!jpByUrl.has(img.imgUrl)) jpByUrl.set(img.imgUrl, entry)
      } else if (img.language === 'english') {
        const packName = enPack ? cleanPackName(enPack.title) : undefined
        const entry: ArtImage = { imgUrl: img.imgUrl, isCurrentVariant: isCurrent, packName, variantSuffix }
        if (!enByUrl.has(img.imgUrl)) enByUrl.set(img.imgUrl, entry)
      }
    }
  }

  return {
    english: Array.from(enByUrl.values()),
    japanese: Array.from(jpByUrl.values()),
  }
}