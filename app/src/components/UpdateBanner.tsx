import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // check for SW updates periodically
      if (registration) {
        setInterval(() => { registration.update() }, 60 * 60 * 1000) // hourly
      }
    },
  })

  // Hide in dev — Vite regenerates the SW on every restart, so needRefresh is always true
  if (import.meta.env.DEV || !needRefresh || dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-[#3b82f6] text-white px-4 py-2.5 text-sm font-medium shadow-lg animate-[slideDown_0.3s_ease-out]">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>New version available</span>
      <button
        onClick={() => updateServiceWorker()}
        className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors font-semibold"
      >
        Click to update
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
