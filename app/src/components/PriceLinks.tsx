interface PriceLinksProps {
  baseId: string
}

export default function PriceLinks({ baseId }: PriceLinksProps) {
  const links = [
    { name: 'Mercard', url: `https://www.mercardop.jp/product-list?keyword=${encodeURIComponent(baseId)}`, icon: '/icons/mercard.png' },
    { name: 'Yuyu-Tei', url: `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(baseId)}`, icon: '/icons/yuyutei.png' },
    { name: 'TCGPlayer', url: `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(baseId)}&view=grid&productLineName=one-piece-card-game`, icon: '/icons/tcgplayer.png' },
    { name: 'CardRush', url: `https://www.cardrush-op.jp/product-list?keyword=${encodeURIComponent(baseId)}`, icon: '/icons/cardrush.png' },
  ]

  return (
    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
      <span className="text-[11px] text-slate-500 dark:text-[#64748b] uppercase tracking-wider font-semibold shrink-0">Price</span>
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] tracking-wider uppercase bg-white dark:bg-[#1a1d2e] border border-slate-200 dark:border-[#2e303a] rounded-md px-2.5 py-1.5 text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:border-[#3b82f6] hover:-translate-y-0.5 hover:shadow-sm transition-all"
          style={{ transition: 'box-shadow 150ms var(--ease-out-quart), transform 150ms var(--ease-out-quart), border-color 150ms, color 150ms' }}
        >
          <img src={link.icon} alt="" className="w-4 h-4 rounded-sm shrink-0" />
          {link.name}
        </a>
      ))}
    </div>
  )
}
