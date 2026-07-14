import { useState, useEffect } from 'react'

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
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

async function findImageCaches(): Promise<string[]> {
  const allNames = await caches.keys()
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

  useEffect(() => {
    readCacheInfo()
      .then(setCacheInfo)
      .catch(() => setCacheInfo({ count: 0, size: 0, cacheNames: [] }))
  }, [])

  const hasNoCaches = cacheInfo.cacheNames.length === 0

  return (
    <div>
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
