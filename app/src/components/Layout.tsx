import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import FilterBar from './FilterBar'
import FilterFAB from './FilterFAB'
import AboutModal from './AboutModal'
import HelpModal from './HelpModal'

import { prefersReducedMotion } from '../lib/spring'
import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeInstallPrompt,
  type InstallPrompt,
} from '../installPrompt'
import {
  RARITY_SHORT,
  COLOR_HEX,
  CATEGORY_COLORS,
} from '../types'
import { getActiveFilterCount } from '../lib/filters'

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function getAndroidInstallGuide() {
  const ua = navigator.userAgent

  if (/Firefox\//i.test(ua)) {
    return [
      'Tap the ⋮ menu in the top-right corner',
      'Tap "Install"',
      'Tap "Add" to confirm',
    ]
  }

  if (/SamsungBrowser\//i.test(ua)) {
    return [
      'Tap the ≡ menu in the bottom-right corner',
      'Tap "Add page to"',
      'Choose "Home screen"',
    ]
  }

  return [
    'Tap the ⋮ menu in your browser',
    'Tap "Install app"',
    'Tap "Install" to confirm',
  ]
}

const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Extracted SettingsMenu sub-components ─────────────────────────

function LanguageToggle({ value, onChange }: { value: 'english' | 'japanese'; onChange: (lang: 'english' | 'japanese') => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <span className="text-sm text-slate-700 dark:text-[#cbd5e1]">Language</span>
      <div className="flex rounded-lg border border-slate-200 dark:border-[#2e303a] overflow-hidden">
        <button
          onClick={() => onChange('english')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${value === 'english' ? 'bg-[#3b82f6] text-white' : 'text-slate-500 dark:text-[#64748b] hover:bg-slate-100 dark:hover:bg-[#25283a]'}`}
        >
          EN
        </button>
        <button
          onClick={() => onChange('japanese')}
          className={`px-2.5 py-1 text-xs font-bold transition-colors ${value === 'japanese' ? 'bg-[#3b82f6] text-white' : 'text-slate-500 dark:text-[#64748b] hover:bg-slate-100 dark:hover:bg-[#25283a]'}`}
        >
          JP
        </button>
      </div>
    </div>
  )
}

function ThemeToggle({ value, onChange }: { value: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <span className="text-sm text-slate-700 dark:text-[#cbd5e1]">Theme</span>
      <div className="flex rounded-lg border border-slate-200 dark:border-[#2e303a] overflow-hidden">
        <button
          onClick={() => { if (value === 'dark') onChange() }}
          className={`p-1.5 transition-colors ${value !== 'dark' ? 'bg-[#3b82f6] text-white' : 'text-slate-500 dark:text-[#64748b] hover:bg-slate-100 dark:hover:bg-[#25283a]'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>
        <button
          onClick={() => { if (value !== 'dark') onChange() }}
          className={`p-1.5 transition-colors ${value === 'dark' ? 'bg-[#3b82f6] text-white' : 'text-slate-500 dark:text-[#64748b] hover:bg-slate-100 dark:hover:bg-[#25283a]'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function ExternalImagesToggle({ value, onChange, isSlowConnection, slowConnectionOverride }: {
  value: boolean
  onChange: (next: boolean) => void
  isSlowConnection: boolean
  slowConnectionOverride: boolean
}) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <span className="text-sm text-slate-700 dark:text-[#cbd5e1]">Card images</span>
      <div className="flex items-center gap-2">
        {isSlowConnection && !slowConnectionOverride && value && (
          <span className="text-[10px] text-amber-500 dark:text-amber-400">Slow network</span>
        )}
        <button
          onClick={() => onChange(!value)}
          className={`relative w-11 h-6 rounded-full transition-all ${value ? 'bg-[#3b82f6]' : 'bg-slate-200 dark:bg-[#3a3d4a]'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}

function InstallTooltip({ isIOS, androidInstallGuide, onClose }: {
  isIOS: boolean
  androidInstallGuide: string[]
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-xl p-6 max-w-xs mx-4 mb-8 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Install app</h3>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#25283a] rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ol className="text-sm text-slate-600 dark:text-[#cbd5e1] space-y-3">
          {isIOS ? (
            <>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">1</span>
                <span>Tap the <strong>Share</strong> button in Safari</span>
              </li>
              <li className="flex items-center justify-center py-2">
                <svg className="w-8 h-8 text-[#007aff]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">2</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">3</span>
                <span>Tap <strong>"Add"</strong> to confirm</span>
              </li>
            </>
          ) : navigator.maxTouchPoints > 0 ? (
            <>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">1</span>
                <span dangerouslySetInnerHTML={{ __html: androidInstallGuide[0].replace('⋮', '<strong>⋮</strong>').replace('≡', '<strong>≡</strong>') }} />
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">2</span>
                <span dangerouslySetInnerHTML={{ __html: androidInstallGuide[1].replace(/"([^"]+)"/g, '<strong>"$1"</strong>') }} />
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">3</span>
                <span dangerouslySetInnerHTML={{ __html: androidInstallGuide[2].replace(/"([^"]+)"/g, '<strong>"$1"</strong>') }} />
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">1</span>
                <span>Click the <strong>install icon</strong> in the address bar (or press <strong>⋮</strong> menu)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">2</span>
                <span>Select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#3b82f6] text-white text-xs font-bold flex items-center justify-center">3</span>
                <span>Click <strong>"Install"</strong> to confirm</span>
              </li>
            </>
          )}
        </ol>
      </div>
    </div>
  )
}

// ── SettingsMenu ─────────────────────────────────────────────────

function SettingsMenu({ deferredPrompt, onInstall, installSuccess }: {
  deferredPrompt: InstallPrompt | null
  onInstall: () => void
  installSuccess: boolean
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [installTooltip, setInstallTooltip] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const loadExternalImages = useAppStore((state) => state.loadExternalImages)
  const setLoadExternalImages = useAppStore((state) => state.setLoadExternalImages)
  const isSlowConnection = useAppStore((state) => state.isSlowConnection)
  const slowConnectionOverride = useAppStore((state) => state.slowConnectionOverride)
  const setSlowConnectionOverride = useAppStore((state) => state.setSlowConnectionOverride)
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const preferredLanguage = useAppStore((state) => state.preferredLanguage)
  const setPreferredLanguage = useAppStore((state) => state.setPreferredLanguage)
  const reducedMotion = prefersReducedMotion()

  const isIOS = isIOSDevice()
  const isStandalone = isStandaloneMode()
  const androidInstallGuide = getAndroidInstallGuide()

  const handleInstall = useCallback(() => {
    if (isIOS || !deferredPrompt) {
      setInstallTooltip(true)
      return
    }
    onInstall()
    setInstallDismissed(true)
  }, [isIOS, deferredPrompt, onInstall])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setInstallTooltip(false)
        setClosing(true)
        setTimeout(() => { setOpen(false); setClosing(false) }, reducedMotion ? 100 : 150)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [open, reducedMotion])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          if (open) { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false) }, reducedMotion ? 100 : 150) }
          else { setOpen(true); setClosing(false) }
        }}
        className={`p-3.5 text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d2e] rounded-lg transition-all ${open ? 'rotate-45' : 'rotate-0'}`}
        style={{ transition: `color 150ms, background-color 150ms, transform ${reducedMotion ? 150 : 200}ms var(--ease-spring-tight)` }}
        aria-label="Settings"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-52 sm:w-56 bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-xl shadow-lg py-2 z-50 origin-top-right max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={closing
            ? { animation: `menuOutSpring ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }
            : { animation: `menuInSpring ${reducedMotion ? 100 : 180}ms var(--ease-spring-tight) forwards` }
          }
        >
          <LanguageToggle value={preferredLanguage} onChange={setPreferredLanguage} />
          <ThemeToggle value={theme} onChange={toggleTheme} />
          <div className="border-t border-slate-100 dark:border-[#2e303a] my-1" />
          <ExternalImagesToggle
            value={loadExternalImages}
            onChange={(next) => {
              setLoadExternalImages(next)
              if (next && isSlowConnection) setSlowConnectionOverride(true)
            }}
            isSlowConnection={isSlowConnection}
            slowConnectionOverride={slowConnectionOverride}
          />

          <div className="border-t border-slate-100 dark:border-[#2e303a] my-1" />
          {!isStandalone && installSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Installed!
            </div>
          )}
          {!isStandalone && !installSuccess && (
            <button
              onClick={handleInstall}
              disabled={installDismissed}
              className={`flex items-center gap-2 w-full px-3 py-3 text-sm transition-colors ${
                installDismissed
                  ? 'text-slate-400 dark:text-[#64748b] cursor-default'
                  : 'text-slate-700 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-[#25283a]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {installDismissed ? 'Install canceled' : 'Install app'}
            </button>
          )}
          <div className="border-t border-slate-100 dark:border-[#2e303a] my-1" />
          <a
            href="https://ko-fi.com/yujinyuz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-3 text-sm text-slate-700 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-[#25283a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
            </svg>
            Support on Ko-fi
          </a>
          <button
            onClick={() => { setOpen(false); setHelpOpen(true) }}
            className="flex items-center gap-2 w-full px-3 py-3 text-sm text-slate-700 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-[#25283a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Help / Guide
          </button>
          <button
            onClick={() => { setOpen(false); setAboutOpen(true) }}
            className="flex items-center gap-2 w-full px-3 py-3 text-sm text-slate-700 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-[#25283a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About this app
          </button>
        </div>
      )}
      <AboutModal key={aboutOpen ? 'about-open' : 'about-closed'} isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
      <HelpModal key={helpOpen ? 'help-open' : 'help-closed'} isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      {installTooltip && (
        <InstallTooltip isIOS={isIOS} androidInstallGuide={androidInstallGuide} onClose={() => setInstallTooltip(false)} />
      )}
    </div>
  )
}

function TopSearchBar({ onFocusChange }: { onFocusChange: (focused: boolean) => void }) {
  const searchInput = useAppStore((state) => state.searchInput)
  const setSearchInput = useAppStore((state) => state.setSearchInput)
  const setSearchFilter = useAppStore((state) => state.setSearchFilter)
  const searchLoading = useAppStore((state) => state.searchLoading)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchFilter(value)
    }, 300)
  }, [setSearchInput, setSearchFilter])

  return (
    <div className="relative flex-1 min-w-0 max-w-xs">
      <input
        type="text"
        aria-label="Search cards"
        placeholder="Search..."
        value={searchInput}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        className={`w-full bg-transparent border-0 border-b rounded-none pl-2 pr-14 py-2 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#64748b] focus:outline-none focus:ring-0 focus-visible:outline-none transition-colors ${searchLoading ? 'border-[#3b82f6] dark:border-[#60a5fa]' : 'border-slate-300 dark:border-[#3a3d4a] focus:border-slate-900 dark:focus:border-white'}`}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {searchInput && !searchLoading && (
          <button
            onClick={() => handleChange('')}
            className="p-2 text-slate-400 dark:text-[#64748b] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#25283a] rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {searchLoading ? (
          <svg className="w-4 h-4 text-[#3b82f6] dark:text-[#60a5fa] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-slate-400 dark:text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
    </div>
  )
}

// ── Format helpers for ActiveFilterChips ─────────────────────────

function formatPowerValue(value: number | null): string {
  if (value == null) return ''
  return value >= 1000 ? `${value / 1000}k` : String(value)
}

function formatCostValue(value: number | null): string {
  return value != null ? String(value) : ''
}

function formatRangeLabel(min: number | null, max: number | null, defaultMin: string, defaultMax: string): string {
  const minStr = min != null ? String(min) : defaultMin
  const maxStr = max != null ? String(max) : defaultMax
  return `${minStr}–${maxStr}`
}

/** Active filter chips shown below navbar */
function ActiveFilterChips() {
  const filters = useAppStore((state) => state.filters)
  const setFilters = useAppStore((state) => state.setFilters)
  const resetFilters = useAppStore((state) => state.resetFilters)
  const [exiting, setExiting] = useState<{ key: string; label: string; color?: string; onRemove: () => void }[]>([])
  const reducedMotion = prefersReducedMotion()

  const currentChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void; color?: string }[] = []

    if (filters.search) {
      chips.push({
        key: 'search',
        label: `"${filters.search}"`,
        onRemove: () => { setFilters({ search: '' }); useAppStore.getState().setSearchInput('') },
      })
    }

    filters.colors.forEach((c) => chips.push({
      key: `color-${c}`,
      label: c,
      onRemove: () => setFilters({ colors: filters.colors.filter((v) => v !== c) }),
      color: COLOR_HEX[c],
    }))

    filters.categories.forEach((c) => chips.push({
      key: `cat-${c}`,
      label: c === 'Don' ? 'DON!!' : c,
      onRemove: () => setFilters({ categories: filters.categories.filter((v) => v !== c) }),
      color: CATEGORY_COLORS[c],
    }))

    filters.rarities.forEach((r) => chips.push({
      key: `rarity-${r}`,
      label: RARITY_SHORT[r] || r,
      onRemove: () => setFilters({ rarities: filters.rarities.filter((v) => v !== r) }),
    }))

    filters.attributes.forEach((a) => chips.push({
      key: `attr-${a}`,
      label: a,
      onRemove: () => setFilters({ attributes: filters.attributes.filter((v) => v !== a) }),
    }))

    filters.sets.forEach((s) => chips.push({
      key: `set-${s}`,
      label: s,
      onRemove: () => setFilters({ sets: filters.sets.filter((v) => v !== s) }),
    }))

    if (filters.blockMin != null || filters.blockMax != null) {
      const label = formatRangeLabel(filters.blockMin, filters.blockMax, '1', '5')
      chips.push({ key: 'block', label: `Block ${label}`, onRemove: () => setFilters({ blockMin: null, blockMax: null }) })
    }

    if (filters.costMin != null || filters.costMax != null) {
      const min = formatCostValue(filters.costMin) || '0'
      const max = formatCostValue(filters.costMax) || '10'
      chips.push({ key: 'cost', label: `Cost ${min}–${max}`, onRemove: () => setFilters({ costMin: null, costMax: null }) })
    }

    if (filters.powerMin != null || filters.powerMax != null) {
      const min = formatPowerValue(filters.powerMin) || '0'
      const max = formatPowerValue(filters.powerMax) || '13k'
      chips.push({ key: 'power', label: `Power ${min}–${max}`, onRemove: () => setFilters({ powerMin: null, powerMax: null }) })
    }

    return chips
  }, [filters, setFilters])

  if (currentChips.length === 0 && exiting.length === 0) return null

  const handleRemove = (chip: typeof currentChips[0]) => {
    if (reducedMotion) {
      chip.onRemove()
      return
    }
    setExiting((prev) => [...prev, chip])
    setTimeout(() => {
      chip.onRemove()
      setExiting((prev) => prev.filter((c) => c.key !== chip.key))
    }, 180)
  }

  const handleReset = () => {
    if (reducedMotion) {
      resetFilters()
      return
    }
    const toExit = currentChips
    if (toExit.length === 0) return
    setExiting((prev) => [...prev, ...toExit])
    setTimeout(() => {
      resetFilters()
      setExiting((prev) => prev.filter((c) => !toExit.some((t) => t.key === c.key)))
    }, 180)
  }

  return (
    <div className="shrink-0 bg-slate-50/80 dark:bg-[#0f1117]/80 border-b border-slate-200/40 dark:border-[#2e303a]/40 px-3 sm:px-6 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {currentChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => handleRemove(chip)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium active:scale-95 border animate-[chipIn_180ms_var(--ease-out-quart)_both]"
            style={chip.color
              ? { backgroundColor: chip.color + '18', borderColor: chip.color + '40', color: chip.color }
              : { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#3b82f6' }
            }
          >
            {chip.label}
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ))}
        {exiting.map((chip) => (
          <button
            key={chip.key}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border animate-[chipOut_180ms_var(--ease-out-quart)_both]"
            style={chip.color
              ? { backgroundColor: chip.color + '18', borderColor: chip.color + '40', color: chip.color }
              : { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#3b82f6' }
            }
          >
            {chip.label}
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ))}
        {currentChips.length > 1 && (
          <button
            onClick={handleReset}
            className="shrink-0 text-xs text-slate-400 dark:text-[#64748b] hover:text-slate-600 dark:hover:text-[#94a3b8] transition-colors ml-1 px-1.5 py-1"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

function InstallBanner({ deferredPrompt, onInstall }: {
  deferredPrompt: InstallPrompt | null
  onInstall: () => void
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const ts = localStorage.getItem('optcg-install-banner-dismissed')
      if (ts && Date.now() - Number(ts) < DISMISS_COOLDOWN_MS) return true
    } catch { /* localStorage unavailable */ }
    return false
  })
  const [closing, setClosing] = useState(false)
  const reducedMotion = prefersReducedMotion()

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem('optcg-install-banner-dismissed', String(Date.now()))
    } catch { /* localStorage unavailable */ }
    setClosing(true)
    setTimeout(() => { setDismissed(true); setClosing(false) }, reducedMotion ? 100 : 200)
  }, [reducedMotion])

  if (isStandaloneMode() || isIOSDevice() || !deferredPrompt || dismissed) return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[15] sm:hidden"
      style={{
        transform: closing ? 'translateY(100%)' : 'translateY(0)',
        transition: `transform ${reducedMotion ? 100 : 200}ms var(--ease-out-quart)`,
      }}
    >
      <div className="bg-white dark:bg-[#1a1d2e] border-t border-slate-200 dark:border-[#2e303a] shadow-[0_-2px_10px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src="/android-chrome-192x192.png"
            alt=""
            className="w-8 h-8 rounded-lg shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              Install OPTCG Lib
            </div>
            <div className="text-xs text-slate-500 dark:text-[#94a3b8] leading-tight mt-0.5">
              Browse cards offline
            </div>
          </div>
          <button
            onClick={onInstall}
            className="shrink-0 px-3.5 py-2.5 text-xs font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb] active:bg-[#1d4ed8] rounded-lg transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="shrink-0 p-2.5 text-slate-400 dark:text-[#64748b] hover:text-slate-600 dark:hover:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#25283a] rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const navigate = useNavigate()
  const filters = useAppStore((state) => state.filters)
  const resetFilters = useAppStore((state) => state.resetFilters)
  const setSelectedCard = useAppStore((state) => state.setSelectedCard)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarClosing, setSidebarClosing] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPrompt | null>(() => getInstallPrompt())
  const [installSuccess, setInstallSuccess] = useState(false)
  const [toastClosing, setToastClosing] = useState(false)
  const dragOffsetRef = useRef(0)
  const reducedMotion = prefersReducedMotion()
  const dragStartRef = useRef<number | null>(null)

  // ── Install prompt lifecycle ──────────────────────────────────
  useEffect(() => subscribeInstallPrompt(setDeferredPrompt), [])

  useEffect(() => {
    const handleAppInstalled = () => {
      setToastClosing(false)
      setInstallSuccess(true)
      setTimeout(() => { setToastClosing(true); setTimeout(() => { setInstallSuccess(false); setToastClosing(false) }, 200) }, 4000)
    }
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice ?? { outcome: 'dismissed' }
      if (outcome === 'accepted') {
        setToastClosing(false)
        setInstallSuccess(true)
        setTimeout(() => { setToastClosing(true); setTimeout(() => { setInstallSuccess(false); setToastClosing(false) }, 200) }, 4000)
      }
    } catch {
      // prompt() failed — user can retry from settings
    }
    clearInstallPrompt()
  }, [deferredPrompt])

  // ── Sidebar events ────────────────────────────────────────────
  useEffect(() => {
    const handleClose = () => { setSidebarClosing(true); setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false) }, reducedMotion ? 100 : 200) }
    const handleOpen = () => { setSidebarOpen(true); setSidebarClosing(false); setDragOffset(0) }
    window.addEventListener('optcg-close-sidebar', handleClose)
    window.addEventListener('optcg-open-sidebar', handleOpen)
    return () => {
      window.removeEventListener('optcg-close-sidebar', handleClose)
      window.removeEventListener('optcg-open-sidebar', handleOpen)
    }
  }, [reducedMotion])

  // Prevent browser pull-to-refresh when filter panel is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overscrollBehavior = 'none'
      return () => { document.body.style.overscrollBehavior = '' }
    }
  }, [sidebarOpen])

  const duration = reducedMotion ? 100 : 200
  const dismissThreshold = 80
  const activeFilterCount = getActiveFilterCount(filters)

  const handleDragStart = (clientY: number) => {
    if (!sidebarOpen || sidebarClosing) return
    setIsDragging(true)
    dragStartRef.current = clientY
  }

  const handleDragMove = (clientY: number) => {
    if (dragStartRef.current === null || !sidebarOpen || sidebarClosing) return
    const delta = clientY - dragStartRef.current
    if (delta > 0) {
      const offset = Math.min(delta, 150)
      dragOffsetRef.current = offset
      setDragOffset(offset)
    }
  }

  const handleDragEnd = () => {
    if (dragStartRef.current === null) return
    setIsDragging(false)
    if (dragOffsetRef.current >= dismissThreshold) {
      setSidebarClosing(true)
      setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false); setDragOffset(0); dragOffsetRef.current = 0 }, duration)
    } else {
      setDragOffset(0)
      dragOffsetRef.current = 0
    }
    dragStartRef.current = null
  }

  return (
    <div className="flex-1 flex h-screen overflow-hidden">
      {/* Overlay backdrop */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 z-30 bg-black/40 ${sidebarClosing ? `animate-[sidebarOverlayOut_${duration}ms_var(--ease-out-quart)_forwards]` : ''}`}
          onClick={() => { setSidebarClosing(true); setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false) }, duration) }}
          style={!sidebarClosing ? { animation: `sidebarOverlayIn ${duration}ms var(--ease-out-quart) forwards` } : undefined}
        />
      )}

      {/* Filter panel: bottom sheet on mobile, right drawer on desktop */}
      <aside
        className={`fixed z-30 bg-white dark:bg-[#1a1d2e] border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-[#2e303a] overflow-y-auto overscroll-y-none shadow-xl inset-x-0 bottom-0 sm:inset-y-0 sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-0 sm:w-80 sm:h-screen rounded-t-2xl sm:rounded-none max-h-[70vh] landscape:max-h-[60vh] sm:max-h-none ${
          sidebarClosing
            ? 'translate-y-full sm:translate-x-full sm:translate-y-0'
            : sidebarOpen
              ? 'translate-y-0 sm:translate-x-0 sm:translate-y-0'
              : 'translate-y-full sm:translate-x-full sm:translate-y-0'
        }`}
        style={{
          transition: isDragging ? 'none' : sidebarOpen && !sidebarClosing
            ? `transform ${duration}ms var(--ease-spring-default)`
            : `transform ${duration}ms var(--ease-out-quart)`,
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 pb-4 pt-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-[#2e303a] dark:bg-[#1a1d2e]/95 dark:supports-[backdrop-filter]:bg-[#1a1d2e]/85">
          {/* Mobile drag handle */}
          <div
            className="flex justify-center mb-4 sm:hidden cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              handleDragStart(e.clientY)
            }}
            onPointerMove={(e) => handleDragMove(e.clientY)}
            onPointerUp={handleDragEnd}
            onLostPointerCapture={handleDragEnd}
          >
            <div
              className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-[#3a3d4a] transition-colors duration-150"
              style={{
                backgroundColor: dragOffset > 20
                  ? `rgba(59, 130, 246, ${Math.min(dragOffset / dismissThreshold, 1)})`
                  : undefined,
              }}
            />
          </div>
          {dragOffset > 20 && (
            <div
              className="text-center text-xs text-slate-400 dark:text-[#64748b] -mt-2 mb-2 sm:hidden transition-opacity"
              style={{ opacity: Math.min((dragOffset - 20) / 40, 1) }}
            >
              Swipe down to close
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Filters</span>
              <div className="mt-1 text-xs text-slate-500 dark:text-[#94a3b8]">
                {activeFilterCount === 0 ? 'Browse all cards' : `${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="rounded-lg px-3 py-3 text-xs font-semibold text-[#3b82f6] transition-colors hover:bg-slate-100 dark:text-[#60a5fa] dark:hover:bg-[#25283a]"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => { setSidebarClosing(true); setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false) }, duration) }}
                className="p-3 text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#25283a] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4">
          <FilterBar />
        </div>
      </aside>

      {/* Main area: fixed navbar + scrollable content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Navbar */}
        <div
          className={`shrink-0 border-b transition-colors duration-200 px-3 sm:px-6 py-2.5 sm:py-3 ${
            searchFocused
              ? 'bg-slate-50/60 dark:bg-[#0f1117]/60 border-slate-200/30 dark:border-[#2e303a]/30'
              : 'bg-slate-50 dark:bg-[#0f1117] border-slate-200/60 dark:border-[#2e303a]/60'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap">
            <div
              className={`shrink-0 group cursor-pointer transition-opacity duration-200 ${
                searchFocused ? 'opacity-40' : 'opacity-100'
              }`}
              onClick={() => {
                navigate('/')
                resetFilters()
                setSelectedCard(null)
              }}
              title="Go home"
            >
              <div className="transition-transform duration-200 group-hover:scale-[1.02]">
                <img
                  src="/logo-op.png"
                  alt="ONE PIECE CARD GAME"
                  className="h-4 sm:h-5 w-auto dark:hidden"
                />
                <img
                  src="/logo-op-white.png"
                  alt="ONE PIECE CARD GAME"
                  className="h-4 sm:h-5 w-auto hidden dark:block"
                />
              </div>
              <div className="text-[4px] sm:text-[5px] font-bold tracking-wider text-slate-400 dark:text-[#64748b] uppercase leading-none mt-0.5 text-center transition-colors duration-200 group-hover:text-[#c8963e]">
                Offline Library
              </div>
            </div>
            <div className="flex items-center gap-0.5 min-w-0">
              <TopSearchBar onFocusChange={setSearchFocused} />
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="hidden sm:flex p-3 text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d2e] rounded-lg active:scale-95 transition-all"
                style={{ transition: 'transform 150ms var(--ease-spring-tight), background-color 150ms, color 150ms' }}
                aria-label="Open filters"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 7h.01M12 7h.01" />
                </svg>
              </button>
              <SettingsMenu deferredPrompt={deferredPrompt} onInstall={handleInstall} installSuccess={installSuccess} />
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        <ActiveFilterChips />

        {/* Scrollable content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile filter FAB — replaces navbar filter button on small screens */}
        <FilterFAB sidebarOpen={sidebarOpen} />
      </div>

      {/* Android install banner — proactive prompt for mobile browsers */}
      <InstallBanner deferredPrompt={deferredPrompt} onInstall={handleInstall} />

      {/* Install success toast — visible feedback after installation */}
      {installSuccess && (
        <div
          className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          style={{
            opacity: toastClosing ? 0 : 1,
            transform: toastClosing ? 'translateY(-8px)' : 'translateY(0)',
            transition: `opacity ${reducedMotion ? 100 : 200}ms ease-out, transform ${reducedMotion ? 100 : 200}ms ease-out`,
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 pointer-events-auto">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Installed! Find it on your home screen
          </div>
        </div>
      )}
    </div>
  )
}
