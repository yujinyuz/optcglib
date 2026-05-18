export default function SkeletonCard() {
  return (
    <div className="relative bg-white dark:bg-[#1a1d2e] rounded-xl border border-slate-200 dark:border-[#2e303a] overflow-hidden animate-pulse">
      {/* Color strip placeholder */}
      <div className="h-1.5 bg-slate-200 dark:bg-[#2e303a]" />
      {/* Image placeholder */}
      <div className="aspect-[2/3] bg-slate-100 dark:bg-[#13151f]" />
      {/* Badge placeholders */}
      <div className="absolute top-3 right-3 h-4 w-8 bg-slate-200/60 dark:bg-[#2e303a]/60 rounded" />
      <div className="absolute top-3 left-3 h-6 w-6 rounded-full bg-slate-200/60 dark:bg-[#2e303a]/60" />
    </div>
  )
}