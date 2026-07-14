import { useState, useEffect } from 'react'
import { getStats } from '../db'

interface CacheInfo {
  count: number
  size: number
  cacheNames: string[]
}

interface DebugData {
  buildTime: string
  totalCards: number
  dbSize: number | null
  swState: string
  isStandalone: boolean
  storageUsed: number | null
  storageQuota: number | null
  screenSize: string
  dpr: number
  cacheCount: number
  cacheSize: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
          // ignore
        }
      }
    }
  }
  return { count, size, cacheNames: imageCacheNames }
}

async function fetchDbSize(): Promise<number | null> {
  try {
    const res = await fetch('/optcg.db', { method: 'HEAD', cache: 'no-store' })
    const len = res.headers.get('content-length')
    return len ? parseInt(len, 10) : null
  } catch {
    return null
  }
}

async function getSwState(): Promise<string> {
  if (!('serviceWorker' in navigator)) return 'not supported'
  const reg = await navigator.serviceWorker.ready
  if (reg.active?.state) return reg.active.state
  if (reg.installing?.state) return `installing (${reg.installing.state})`
  if (reg.waiting?.state) return `waiting (${reg.waiting.state})`
  return 'unknown'
}

async function getStorageEstimate(): Promise<{ used: number | null; quota: number | null }> {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) return { used: null, quota: null }
  try {
    const est = await navigator.storage.estimate()
    return { used: est.usage ?? null, quota: est.quota ?? null }
  } catch {
    return { used: null, quota: null }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default function DebugInfo() {
  const [data, setData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [stats, dbSize, swState, storage, cacheInfo] = await Promise.all([
          withTimeout(getStats(), 3000, { totalCards: 0 }),
          withTimeout(fetchDbSize(), 3000, null),
          withTimeout(getSwState(), 3000, 'unknown'),
          withTimeout(getStorageEstimate(), 3000, { used: null, quota: null }),
          withTimeout(readCacheInfo(), 3000, { count: 0, size: 0, cacheNames: [] }),
        ])

        if (cancelled) return

        setData({
          buildTime: __BUILD_TIME__,
          totalCards: stats.totalCards,
          dbSize,
          swState,
          isStandalone: window.matchMedia('(display-mode: standalone)').matches,
          storageUsed: storage.used,
          storageQuota: storage.quota,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          dpr: window.devicePixelRatio,
          cacheCount: cacheInfo.count,
          cacheSize: cacheInfo.size,
        })
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-[#64748b]">
        Loading diagnostics...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
        Failed to load diagnostics.
      </div>
    )
  }

  const rows = [
    { label: 'Build', value: formatDate(data.buildTime) },
    { label: 'Cards', value: data.totalCards.toLocaleString() },
    { label: 'DB size', value: data.dbSize ? formatBytes(data.dbSize) : 'unknown' },
    { label: 'Service worker', value: data.swState },
    { label: 'Standalone', value: data.isStandalone ? 'yes' : 'no' },
    { label: 'Storage', value: data.storageUsed && data.storageQuota ? `${formatBytes(data.storageUsed)} / ${formatBytes(data.storageQuota)}` : 'unavailable' },
    { label: 'Screen', value: `${data.screenSize} @ ${data.dpr}x` },
    { label: 'Cached images', value: data.cacheCount > 0 ? `${data.cacheCount} · ${formatBytes(data.cacheSize)}` : 'none' },
  ]

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 dark:text-[#64748b]">{row.label}</span>
          <span className="text-slate-600 dark:text-[#94a3b8] font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
