import DOMPurify from 'dompurify'

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
  const sanitized = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'span', 'u'],
    ALLOWED_ATTR: [],
  })
  return highlightKeywords(sanitized)
}

/**
 * Highlight OPTCG keywords in rendered HTML text.
 * Wraps keywords in a styled span without breaking existing HTML tags.
 */
function highlightKeywords(html: string): string {
  // Build a regex that matches keywords outside of HTML tags
  const keywords = [
    'DON!!', 'Counter', 'Blocker', 'Rush', 'Double Attack',
    'Main', 'Once Per Turn', 'On Play', 'On KO',
    'When Attacking', 'Activate', 'Banish',
    'Start of Main', 'End of Main', 'Start of Turn', 'End of Turn',
    'Your Turn', "Opponent's Turn", 'Life', 'Dominated',
    'Trigger', 'Rest',
  ]
  // Sort by length (longest first) to avoid partial matches
  keywords.sort((a, b) => b.length - a.length)

  const pattern = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = new RegExp(`(?<![<\\w/])\\b(${pattern})\\b(?![^<]*>)`, 'g')

  return html.replace(regex, '<span class="kw">$1</span>')
}