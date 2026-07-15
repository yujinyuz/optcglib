import { useState, useEffect, useCallback } from 'react'
import { prefersReducedMotion } from '../lib/spring'
import { COLOR_HEX } from '../types'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [closing, setClosing] = useState(false)
  const reducedMotion = prefersReducedMotion()

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, reducedMotion ? 100 : 200)
  }, [onClose, reducedMotion])

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, handleClose])

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  const overlayStyle = closing
    ? { animation: `modalOverlayOut ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }
    : { animation: `modalOverlayIn ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }

  const contentStyle = closing
    ? { animation: `modalContentOutSpring ${reducedMotion ? 100 : 200}ms var(--ease-out-quart) forwards` }
    : { animation: `modalContentInSpring ${reducedMotion ? 100 : 250}ms var(--ease-spring-default) forwards` }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={handleClose}
      style={overlayStyle}
    >
      <div
        className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl"
        style={contentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-[#3a3d4a]" />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-3 rounded-lg text-slate-400 dark:text-[#64748b] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#25283a] transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-6 pb-8 sm:px-8 sm:pt-8 sm:pb-10">
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center shadow-lg shadow-[#3b82f6]/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 id="help-modal-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Help & Guide
              </h2>
              <p className="text-xs text-slate-400 dark:text-[#64748b] mt-0.5">
                How to use OPTCG Lib
              </p>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            <HelpSection
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              title="Getting Started"
              delay={reducedMotion ? 0 : 50}
            >
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Search</strong> — Type a card name, ID (like ST01-001), or effect keyword in the search bar at the top. Results appear instantly — no loading, no server calls.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Smart search</strong> — Combine terms like <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-[#25283a] text-[11px] font-mono text-[#3b82f6]">op13 luffy green</code> to find all green Luffy cards from OP-13. Case does not matter — <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-[#25283a] text-[11px] font-mono text-[#3b82f6]">LUFFY</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-[#25283a] text-[11px] font-mono text-[#3b82f6]">luffy</code>, and <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-[#25283a] text-[11px] font-mono text-[#3b82f6]">Luffy</code> all work the same.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Filter</strong> — Tap the funnel icon to open the filter panel. Narrow down by color, category, rarity, attribute, cost, power, counter, set, or block.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">4</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Browse</strong> — Tap any card tile to see full details: larger image, effect text, price links, and which packs it appears in.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">5</span>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Clear filters</strong> — Active filters show as chips below the navbar. Tap any chip to remove it, or tap "Clear all" to reset everything.
                  </div>
                </div>
              </div>
            </HelpSection>

            <HelpSection
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
              title="Card Symbols"
              delay={reducedMotion ? 0 : 100}
            >
              <div className="space-y-4">
                {/* Color strip */}
                <SymbolRow label="Color strip">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full" style={{ backgroundColor: COLOR_HEX.Red }} />
                      <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Single color</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${COLOR_HEX.Red}, ${COLOR_HEX.Blue})` }} />
                      <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Multi-color</span>
                    </div>
                  </div>
                </SymbolRow>

                {/* Cost circle */}
                <SymbolRow label="Cost circle">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: COLOR_HEX.Red }}>5</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Cost to play</span>
                  </div>
                </SymbolRow>

                {/* Power */}
                <SymbolRow label="Power">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">6000</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Attack / Defense value</span>
                  </div>
                </SymbolRow>

                {/* Attributes */}
                <SymbolRow label="Attributes">
                  <div className="flex items-center gap-1.5">
                    <AttributeBadge attr="Strike" />
                    <AttributeBadge attr="Slash" />
                    <AttributeBadge attr="Ranged" />
                    <AttributeBadge attr="Wisdom" />
                    <AttributeBadge attr="Special" />
                  </div>
                </SymbolRow>

                {/* Counter strip */}
                <SymbolRow label="Counter">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center bg-slate-900 dark:bg-black w-3 py-1.5 rounded-r">
                      <span className="text-[7px] font-bold text-white tracking-wider" style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>⚡ +1000</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Vertical strip on the left — counter value added when defending</span>
                  </div>
                </SymbolRow>

                {/* Leader crown */}
                <SymbolRow label="Leader">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium tracking-[0.3em] uppercase" style={{ color: '#f59e0b' }}>
                      <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2-2h10v2H7v-2z" />
                      </svg>
                      Leader
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Crown icon marks your deck leader</span>
                  </div>
                </SymbolRow>

                {/* DON!! */}
                <SymbolRow label="DON!!">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium tracking-[0.3em] uppercase" style={{ color: '#ec4899' }}>DON!!</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Resource cards used to pay costs</span>
                  </div>
                </SymbolRow>

                {/* Variant suffix */}
                <SymbolRow label="Variants">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-900 dark:text-white">Card Name<span className="text-[10px] font-normal text-slate-400 dark:text-[#64748b]"> (Parallel)</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-900 dark:text-white">Card Name<span className="text-[10px] font-normal text-slate-400 dark:text-[#64748b]"> (Reprint)</span></span>
                    </div>
                  </div>
                </SymbolRow>

                {/* Bottom banner */}
                <SymbolRow label="Bottom banner">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1 rounded font-bold bg-amber-500 text-white text-[10px]">L</span>
                      <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Leader rarity</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['C', 'UC', 'R', 'SR', 'SEC', 'SP', 'TR', 'P'] as const).map((r) => (
                        <span key={r} className="px-1 rounded bg-white/20 text-[10px] font-bold text-white dark:text-white border border-white/10" style={{ backgroundColor: 'rgba(100,116,139,0.35)' }}>{r}</span>
                      ))}
                      <span className="text-[11px] text-slate-500 dark:text-[#64748b] ml-1">Rarity abbreviations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold text-white dark:text-white border border-white/10" style={{ backgroundColor: 'rgba(100,116,139,0.35)' }}>2</span>
                      <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Block number</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/80 text-[10px] font-bold text-white">★</span>
                      <span className="text-[11px] text-slate-500 dark:text-[#64748b]">Parallel / alternate art available</span>
                    </div>
                  </div>
                </SymbolRow>
              </div>
            </HelpSection>

            <HelpSection
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="Settings & Features"
              delay={reducedMotion ? 0 : 150}
            >
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#13151f] flex items-center justify-center text-[#3b82f6]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Offline-first</strong>
                    <p className="text-sm text-slate-600 dark:text-[#94a3b8] leading-relaxed">The entire database (~10MB) is stored on your device. First visit downloads everything; after that it works fully offline.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#13151f] flex items-center justify-center text-[#3b82f6]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Language</strong>
                    <p className="text-sm text-slate-600 dark:text-[#94a3b8] leading-relaxed">Switch between English and Japanese card names and effect text in the settings menu.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#13151f] flex items-center justify-center text-[#3b82f6]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Theme</strong>
                    <p className="text-sm text-slate-600 dark:text-[#94a3b8] leading-relaxed">Toggle between light and dark mode. Your choice is saved for next time.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#13151f] flex items-center justify-center text-[#3b82f6]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Card images</strong>
                    <p className="text-sm text-slate-600 dark:text-[#94a3b8] leading-relaxed">Toggle card images on or off in settings. Images are disabled automatically on slow connections, but you can override it.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#13151f] flex items-center justify-center text-[#3b82f6]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <strong className="text-slate-900 dark:text-white">Install app</strong>
                    <p className="text-sm text-slate-600 dark:text-[#94a3b8] leading-relaxed">Add OPTCG Lib to your home screen for an app-like experience. It works as a Progressive Web App — no app store needed.</p>
                  </div>
                </div>
              </div>
            </HelpSection>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Help section with stagger ────────────────────────────── */

function HelpSection({ icon, title, children, delay = 0 }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  delay?: number
}) {
  const reducedMotion = prefersReducedMotion()

  return (
    <div
      style={reducedMotion ? undefined : { animation: `fadeInUp 300ms var(--ease-out-quart) ${delay}ms both` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#13151f] text-[#3b82f6]">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="pl-8">
        {children}
      </div>
    </div>
  )
}

/* ── Inline symbol helpers ────────────────────────────────── */

function SymbolRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-[#64748b] w-20 text-right pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

const ATTR_MAP: Record<string, { kanji: string; color: string }> = {
  Strike: { kanji: '打', color: '#eab308' },
  Slash: { kanji: '斬', color: '#3b82f6' },
  Ranged: { kanji: '射', color: '#e74c3c' },
  Wisdom: { kanji: '知', color: '#22c55e' },
  Special: { kanji: '特', color: '#a855f7' },
}

function AttributeBadge({ attr }: { attr: string }) {
  const info = ATTR_MAP[attr]
  if (!info) return null
  const textColor = ['#eab308', '#22c55e'].includes(info.color) ? 'text-[#1a1a2e]' : 'text-white'
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${textColor}`}
      style={{ backgroundColor: info.color }}
      title={attr}
    >
      {info.kanji}
    </span>
  )
}
