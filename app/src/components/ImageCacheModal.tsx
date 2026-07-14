import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '../store'
import { queryImageUrlsBySets, queryAllSetImageUrls } from '../db'
import { getExternalImageUrl } from '../utils'
import { prefersReducedMotion } from '../lib/spring'

/* ── Helpers ─────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

async function readCacheInfo(): Promise<{ count: number; size: number }> {
  if (!('caches' in window)) return { count: 0, size: 0 }
  const allNames = await caches.keys()
  let count = 0
  let size = 0
  for (const name of allNames) {
    const cache = await caches.open(name)
    const reqs = await cache.keys()
    const hasImages = reqs.some((r) => r.url.includes('serveproxy.com'))
    if (!hasImages) continue
    for (const req of reqs) {
      if (!req.url.includes('serveproxy.com')) continue
      const res = await cache.match(req)
      if (res) {
        try {
          const blob = await res.blob()
          size += blob.size
          count++
        } catch {
          // skip entries that can't be read
        }
      }
    }
  }
  return { count, size }
}

async function getCachedProxyUrlSet(): Promise<Set<string>> {
  const set = new Set<string>();
  if (!('caches' in window)) return set;
  const allNames = await caches.keys();
  for (const name of allNames) {
    const cache = await caches.open(name);
    const reqs = await cache.keys();
    for (const req of reqs) {
      if (req.url.includes('serveproxy.com')) set.add(req.url);
    }
  }
  return set;
}

/* ── Component ───────────────────────────────────────────────── */

interface ImageCacheModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ImageCacheModal({ isOpen, onClose }: ImageCacheModalProps) {
  const [closing, setClosing] = useState(false)
  const reducedMotion = prefersReducedMotion()
  const storeSets = useAppStore((state) => state.sets)
  const preferredLanguage = useAppStore((state) => state.preferredLanguage)

  const [sets] = useState<string[]>(() => storeSets)
  const [selectedSets, setSelectedSets] = useState<string[]>([])
  const [cacheInfo, setCacheInfo] = useState<{ count: number; size: number } | null>(null)
  const [progress, setProgress] = useState<{ total: number; done: number; failed: number } | null>(null)
  const [caching, setCaching] = useState(false)
  const [setStatus, setSetStatus] = useState<Record<string, { total: number; cached: number }>>({})
  const abortRef = useRef(false)

  const handleClose = useCallback(() => {
    abortRef.current = true
    setClosing(true)
    setTimeout(onClose, reducedMotion ? 100 : 200)
  }, [onClose, reducedMotion])

  const refreshSetStatus = useCallback(async () => {
    const [allUrls, cachedSet] = await Promise.all([
      queryAllSetImageUrls(preferredLanguage),
      getCachedProxyUrlSet(),
    ]);
    const next: Record<string, { total: number; cached: number }> = {};
    for (const [set, urls] of Object.entries(allUrls)) {
      const proxyUrls = urls.map(getExternalImageUrl);
      const cached = proxyUrls.filter((u) => cachedSet.has(u)).length;
      next[set] = { total: proxyUrls.length, cached };
    }
    setSetStatus(next);
  }, []);

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

  // Refresh cache info and set status on open
  useEffect(() => {
    if (!isOpen) return
    setClosing(false)
    setProgress(null)
    setCaching(false)
    abortRef.current = false
    Promise.all([
      readCacheInfo().then(setCacheInfo),
      refreshSetStatus(),
    ])
  }, [isOpen, refreshSetStatus])

  const handleStartCaching = useCallback(async () => {
    if (selectedSets.length === 0 || caching) return
    setCaching(true)
    setProgress(null)
    abortRef.current = false

    try {
      const rawUrls = await queryImageUrlsBySets(selectedSets, preferredLanguage)
      if (abortRef.current) return

      const proxyUrls = rawUrls.map(getExternalImageUrl)
      if (!proxyUrls.length) {
        setProgress({ total: 0, done: 0, failed: 0 })
        return
      }

      const total = proxyUrls.length
      let done = 0
      let failed = 0
      const BATCH_SIZE = 5

      setProgress({ total, done: 0, failed: 0 })

      for (let i = 0; i < proxyUrls.length; i += BATCH_SIZE) {
        if (abortRef.current) break
        const batch = proxyUrls.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(batch.map((url) => fetch(url, { mode: 'no-cors' })))
        if (abortRef.current) break
        results.forEach((r, idx) => {
          const url = batch[idx]
          if (r.status === 'rejected') {
            console.warn('[Cache] Network error fetching:', url, r.reason)
            failed++
          } else if (!r.value.ok && r.value.type !== 'opaque') {
            console.warn('[Cache] HTTP error fetching:', url, r.value.status)
            failed++
          }
        })
        done = Math.min(i + BATCH_SIZE, total)
        setProgress({ total, done, failed })
      }
    } catch {
      // error during caching
    } finally {
      setCaching(false)
      const [info] = await Promise.all([
        readCacheInfo(),
        refreshSetStatus(),
      ])
      setCacheInfo(info)
    }
  }, [selectedSets, caching, refreshSetStatus])

  const handleClearCache = useCallback(async () => {
    if (caching) return
    if (!('caches' in window)) return

    const allNames = await caches.keys()
    for (const name of allNames) {
      const cache = await caches.open(name)
      const reqs = await cache.keys()
      const serveproxyReqs = reqs.filter((r) => r.url.includes('serveproxy.com'))
      if (serveproxyReqs.length > 0) {
        await Promise.all(serveproxyReqs.map((req) => cache.delete(req)))
      }
    }
    Promise.all([
      readCacheInfo().then(setCacheInfo),
      refreshSetStatus(),
    ])
  }, [caching, refreshSetStatus])

  if (!isOpen) return null

  const overlayStyle = closing
    ? { animation: `modalOverlayOut ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }
    : { animation: `modalOverlayIn ${reducedMotion ? 100 : 150}ms var(--ease-out-quart) forwards` }

  const contentStyle = closing
    ? { animation: `modalContentOutSpring ${reducedMotion ? 100 : 200}ms var(--ease-out-quart) forwards` }
    : { animation: `modalContentInSpring ${reducedMotion ? 100 : 250}ms var(--ease-spring-default) forwards` }

  const progressPct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      style={overlayStyle}
    >
      <div
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1d2e] shadow-2xl"
        style={contentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-[#2e303a]">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Cache card images
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-[#64748b] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#25283a] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Cache stats */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider mb-2">
              Current cache
            </h3>
            <div className="text-sm text-slate-700 dark:text-[#cbd5e1]">
              {cacheInfo === null ? (
                <span className="text-slate-400 dark:text-[#64748b]">Loading...</span>
              ) : cacheInfo.count > 0 ? (
                <>
                  <span className="font-medium text-slate-900 dark:text-white">{cacheInfo.count}</span>
                  {' '}images · {formatBytes(cacheInfo.size)}
                </>
              ) : (
                <span className="text-slate-400 dark:text-[#64748b]">No images cached yet</span>
              )}
            </div>
          </div>

          {/* Set selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">
                Select sets
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSets([...sets])}
                  className="text-xs text-[#3b82f6] hover:underline"
                >
                  Select all
                </button>
                <span className="text-xs text-slate-300 dark:text-[#3a3d4a]">·</span>
                <button
                  onClick={() => setSelectedSets([])}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-[#94a3b8]"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sets.map((set) => (
                <button
                  key={set}
                  type="button"
                  onClick={() => {
                    setSelectedSets((prev) =>
                      prev.includes(set)
                        ? prev.filter((s) => s !== set)
                        : [...prev, set]
                    )
                  }}
                  aria-pressed={selectedSets.includes(set)}
                  className={`shrink-0 px-3 py-1.5 rounded-md text-base sm:text-[11px] font-medium transition-all border active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#1a1d2e] ${
                    selectedSets.includes(set)
                      ? 'bg-[#3b82f6]/10 dark:bg-[#3b82f6]/20 text-[#3b82f6] dark:text-[#60a5fa] border-[#3b82f6]/30 dark:border-[#3b82f6]/40'
                      : 'text-slate-500 dark:text-[#64748b] border-slate-200 dark:border-[#2e303a] hover:border-slate-300 dark:hover:border-[#3e4050] hover:text-slate-700 dark:hover:text-[#94a3b8]'
                  }`}
                >
                  <span className="inline-flex items-center">
                    {set}
                    {(() => {
                      const s = setStatus[set]
                      if (s && s.cached === s.total && s.total > 0) {
                        return (
                          <svg className="w-3 h-3 ml-1 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )
                      }
                      if (s && s.cached > 0 && s.cached < s.total) {
                        return (
                          <span className="ml-1 text-[10px] text-slate-400 dark:text-[#64748b]">{s.cached}/{s.total}</span>
                        )
                      }
                      return null
                    })()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleStartCaching}
              disabled={selectedSets.length === 0 || caching}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                selectedSets.length === 0 || caching
                  ? 'bg-slate-200 dark:bg-[#2e303a] text-slate-400 dark:text-[#64748b] cursor-not-allowed'
                  : 'bg-[#3b82f6] text-white hover:bg-[#2563eb] active:bg-[#1d4ed8] active:scale-[0.97]'
              }`}
            >
              {caching ? 'Caching...' : 'Start caching'}
            </button>
            {caching && (
              <button
                onClick={() => { abortRef.current = true }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-[#94a3b8] border border-slate-200 dark:border-[#2e303a] hover:bg-slate-100 dark:hover:bg-[#25283a] transition-all active:scale-[0.97]"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleClearCache}
              disabled={caching}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                caching
                  ? 'text-slate-300 dark:text-[#3a3d4a] cursor-not-allowed'
                  : 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.97]'
              }`}
            >
              Clear cache
            </button>
          </div>

          {/* Progress */}
          {progress && progress.total > 0 && (
            <div className="space-y-2">
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#2e303a] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3b82f6] transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-[#94a3b8]">
                {progress.done === progress.total ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Done ✓</span>
                ) : (
                  <>
                    Caching {progress.done}/{progress.total}...
                    {progress.failed > 0 && (
                      <span className="text-amber-500 dark:text-amber-400 ml-1">
                        ({progress.failed} failed)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
