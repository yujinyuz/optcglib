import { useState, useEffect, useCallback } from 'react'

interface CacheInfo {
  count: number
  size: number
  cacheNames: string[]
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

async function findImageCaches(): Promise<string[]> {
  const allNames = await caches.keys()
  // Workbox may prefix the cache name; scan every cache for serveproxy URLs.
  const result: string[] = []
  for (const name of allNames) {
    const cache = await caches.open(name)
    const reqs = await cache.keys()
    const hasImages = reqs.some((r) => r.url.includes('serveproxy.com'))
    if (hasImages) result.push(name)
  }
  return result
}

async function readCacheInfo(): Promise<CacheInfo> {
  const allNames = await caches.keys()
  const imageCacheNames = await findImageCaches()
  let count = 0
  let size = 0
  for (const name of imageCacheNames) {
    const cache = await caches.open(name)
    const reqs = await cache.keys()
    for (const req of reqs) {
      if (!req.url.includes('serveproxy.com')) continue
      const res = await cache.match(req)
      if (res) {
        try {
          const blob = await res.blob()
          size += blob.size
          count++
        } catch {
          // ignore unreadable entries
        }
      }
    }
  }
  return { count, size, cacheNames: allNames }
}

export default function CacheStatus() {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ count: 0, size: 0, cacheNames: [] })
  const [loading, setLoading] = useState(false)
  const [cleared, setCleared] = useState(false)

  const readCache = useCallback(async () => {
    try {
      const info = await readCacheInfo()
      setCacheInfo(info)
    } catch {
      setCacheInfo({ count: 0, size: 0, cacheNames: [] })
    }
  }, [])

  useEffect(() => {
    readCache()
  }, [readCache])

  const handleClear = async () => {
    setLoading(true)
    try {
      const cacheNames = await findImageCaches()
      for (const name of cacheNames) {
        const cache = await caches.open(name)
        const reqs = await cache.keys()
        await Promise.all(
          reqs
            .filter((r) => r.url.includes('serveproxy.com'))
            .map((req) => cache.delete(req))
        )
      }
      setCacheInfo({ count: 0, size: 0, cacheNames: [] })
      setCleared(true)
      setTimeout(() => setCleared(false), 2000)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const hasNoCaches = cacheInfo.cacheNames.length === 0

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm text-slate-700 dark:text-[#cbd5e1]">Cached images</span>
          <span className="text-[11px] text-slate-400 dark:text-[#64748b]">
            {hasNoCaches
              ? 'No service worker caches found'
              : cacheInfo.count > 0 && cacheInfo.size === 0
                ? `${cacheInfo.count} images · size hidden (cross-origin)`
                : `${cacheInfo.count} images · ${formatBytes(cacheInfo.size)}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={readCache}
            className="p-1.5 rounded-lg text-slate-400 dark:text-[#64748b] hover:text-slate-600 dark:hover:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#25283a] transition-colors"
            aria-label="Refresh cache info"
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handleClear}
            disabled={loading || cacheInfo.count === 0}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              cleared
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#25283a] dark:text-[#94a3b8] dark:hover:bg-[#2e303a]'
            } ${loading || cacheInfo.count === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {cleared ? 'Cleared' : loading ? '...' : 'Clear'}
          </button>
        </div>
      </div>
      {hasNoCaches && (
        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
          No caches found. Either the service worker is still updating, or no card images have been loaded yet. Browse some cards first — images are lazy-loaded.
        </p>
      )}
      {!hasNoCaches && cacheInfo.count === 0 && (
        <p className="mt-1 text-[11px] text-slate-400 dark:text-[#64748b]">
          No images cached yet. Scroll through the card grid to load images; they will be cached as you browse.
        </p>
      )}
    </div>
  )
}
