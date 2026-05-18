import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useAppStore } from './store'
import CardGrid from './components/CardGrid'
import CardDetail from './components/CardDetail'

function ThemeToggle() {
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1d2e] transition-colors"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}

function App() {
  const init = useAppStore((state) => state.init)
  const loading = useAppStore((state) => state.loading)
  const error = useAppStore((state) => state.error)

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-slate-200 dark:border-[#2e303a] border-t-[#3b82f6] rounded-full animate-spin" />
          <div className="text-slate-500 dark:text-[#94a3b8] text-sm font-medium tracking-wide">Loading database...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] flex items-center justify-center px-4">
        <div className="bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-red-900/30 rounded-xl p-6 max-w-md w-full">
          <div className="text-red-500 dark:text-red-400 font-semibold mb-2">Failed to load</div>
          <div className="text-slate-500 dark:text-[#94a3b8] text-sm">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-[#e2e8f0] flex flex-col">
        <nav className="sticky top-0 z-30 border-b border-slate-200 dark:border-[#2e303a] bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link to="/" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white hover:opacity-90 transition-opacity">
                OPTCG DB
              </Link>
              <div className="flex items-center gap-2">
                <Link to="/" className="text-sm font-medium text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1d2e]">
                  Cards
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<CardGrid />} />
            <Route path="/card/:id" element={<CardDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App