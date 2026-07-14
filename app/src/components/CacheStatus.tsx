import { useState, useEffect, useCallback } from 'react'

interface CacheInfo {
  count: number
  size: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function CacheStatus() {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ count: 0, size: 0 })
  const [loading, setLoading] = useState(false)
  const [cleared, setCleared] = useState(false)

  const readCache = useCallback(async () => {
    try {
      const cache = await caches.open('card-images')
      const requests = await cache.keys()
      let totalSize = 0
      for (const request of requests) {
        const response = await cache.match(request)
        if (response) {
          const blob = await response.blob()
          totalSize += blob.size
        }
      }
      setCacheInfo({ count: requests.length, size: totalSize })
    } catch {
      setCacheInfo({ count: 0, size: 0 })
    }
  }, [])

  useEffect(() => {
    readCache()
  }, [readCache])

  const handleClear = async () => {
    setLoading(true)
    try {
      const cache = await caches.open('card-images')
      const requests = await cache.keys()
      await Promise.all(requests.map((req) => cache.delete(req)))
      setCacheInfo({ count: 0, size: 0 })
      setCleared(true)
      setTimeout(() => setCleared(false), 2000)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm text-slate-700 dark:text-[#cbd5e1]">Cached images</span>
        <span className="text-[11px] text-slate-400 dark:text-[#64748b]">
          {cacheInfo.count} images · {formatBytes(cacheInfo.size)}
        </span>
      </div>
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
  )
}
