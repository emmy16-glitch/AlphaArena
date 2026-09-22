import { type ReactNode, useEffect, useState } from 'react';
import { Clock, Home, Search, Swords, Trophy, User } from 'lucide-react';
import { Logo } from './ui';
import { cn } from '../utils/cn';
import { useMarketData } from '../market/MarketDataContext';
import { productApi, type PortfolioSummary } from '../product/api';

const NAV = [
  { id: 'home', label: 'Home', sub: '', icon: Home },
  { id: 'research', label: 'Research', sub: 'AI Insights & Scenarios', icon: Search },
  { id: 'arena', label: 'Arena', sub: 'Test & Compare', icon: Trophy },
  { id: 'history', label: 'History', sub: 'Past Decisions', icon: Clock },
];

function compactMoney(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function BitgetMark() {
  return (
    <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L16 9L9 17L2 9L9 1Z" fill="#00B5E8" />
        <path d="M9 5.2L12.8 9L9 12.8L5.2 9L9 5.2Z" fill="white" />
      </svg>
    </span>
  );
}

export default function AppShell({
  view,
  onNav,
  onHome,
  onSearch,
  children,
}: {
  view: string;
  onNav: (v: string, payload?: unknown) => void;
  onHome: () => void;
  onSearch?: (symbol: string) => void;
  children: ReactNode;
}) {
  const { status } = useMarketData();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [query, setQuery] = useState('');
  const [bitgetOk, setBitgetOk] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active || document.visibilityState === 'hidden') return;
      const [portfolioResult, diagResult] = await Promise.allSettled([
        productApi.portfolio(),
        productApi.diagnostics(),
      ]);
      if (active && portfolioResult.status === 'fulfilled') setPortfolio(portfolioResult.value);
      if (active && diagResult.status === 'fulfilled') {
        const bitget = (diagResult.value as Record<string, unknown>).bitget as
          | { connected?: boolean }
          | undefined;
        setBitgetOk(typeof bitget?.connected === 'boolean' ? bitget.connected : null);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const net = portfolio?.net_value ?? 100_000;
  const activeId = ['home', 'landing'].includes(view) ? 'home' : view;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (!symbol || !onSearch) return;
    const normalized = symbol.startsWith('R') ? symbol : `R${symbol}`;
    onSearch(normalized);
    setQuery('');
  };

  const live = status === 'live';
  const stamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  return (
    <div className="min-h-screen bg-[#F4F5F6]">
      {/* Dark left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[218px] flex-col bg-[#121416] text-white lg:flex">
        <div className="flex h-[76px] items-center px-5">
          <button aria-label="AlphaArena home" onClick={onHome} className="rounded-lg">
            <Logo dark />
          </button>
        </div>
        <nav aria-label="Primary" className="mt-2 flex-1 space-y-1.5 px-3">
          {NAV.map((n) => {
            const active = activeId === n.id;
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNav(n.id);
                }}
                aria-label={n.sub ? `${n.label}, ${n.sub}` : n.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors',
                  active ? 'bg-[#2B2517] text-[#E8C86A]' : 'text-white/85 hover:bg-white/8 hover:text-white',
                )}
              >
                <n.icon size={21} strokeWidth={1.9} className={active ? 'text-[#E8C86A]' : 'text-[#D8B45C]'} />
                <span className="leading-tight">
                  <span className={cn('block text-[14.5px] font-semibold', active ? 'text-[#E8C86A]' : 'text-white')}>
                    {n.label}
                  </span>
                  {n.sub && <span className="mt-0.5 block text-[11px] font-normal text-white/50">{n.sub}</span>}
                </span>
              </a>
            );
          })}
        </nav>
        <div className="px-5 pb-5">
          <div className="pt-2 text-[14.5px] leading-6 text-white/75">
            <p>Same evidence.</p>
            <p>Same timestamp.</p>
            <p>No hindsight.</p>
            <p className="mt-3 text-[15px] font-bold leading-6 text-[#E8C86A]">Let the market<br />settle it.</p>
          </div>
          <svg aria-hidden="true" viewBox="0 0 160 44" className="mt-4 h-11 w-full opacity-60">
            <path d="M0 38L18 30L34 33L52 22L70 25L88 14L106 18L124 8L142 12L160 2" stroke="#D8B45C" strokeWidth="1.2" fill="none" opacity="0.7" />
            <path d="M0 38L18 30L34 33L52 22L70 25L88 14L106 18L124 8L142 12L160 2L160 44L0 44Z" fill="#D8B45C" opacity="0.08" />
          </svg>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">AlphaArena v1.0</p>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[#E9EBED] bg-[#F4F5F6]/95 backdrop-blur-xl lg:ml-[218px]">
        <div className="flex h-[68px] items-center gap-3 px-4 md:px-6">
          <button aria-label="AlphaArena home" onClick={onHome} className="rounded-lg lg:hidden">
            <Logo />
          </button>
          <form onSubmit={submitSearch} role="search" className="min-w-0 flex-1 sm:max-w-[430px]">
            <label htmlFor="asset-search" className="sr-only">
              Search asset (e.g. NVDA, BTC, AAPL...)
            </label>
            <span className="relative block">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                id="asset-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search asset (e.g. NVDA, BTC, AAPL...)"
                autoComplete="off"
                className="h-11 w-full rounded-full border border-[#E4E6E9] bg-white pl-11 pr-4 text-[13.5px] text-[#1A1D21] outline-none placeholder:text-[#9AA0A8] focus:border-[#1A1D21]"
              />
            </span>
          </form>
          <div className="ml-auto flex items-center gap-2.5">
            <span role="status" aria-label={`Market status ${status}`} className="hidden items-center gap-2 sm:flex">
              <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', live ? 'bg-[#22B06B]' : 'bg-[#D8B45C]')} />
              <span className="leading-tight">
                <span className={cn('block text-[13px] font-bold', live ? 'text-[#12925A]' : 'text-[#8A6512]')}>
                  {live ? 'Market Live' : status === 'fallback' ? 'Market Limited' : 'Connecting'}
                </span>
                <span className="block text-[11px] font-normal text-[#6B7280]">{stamp} UTC</span>
              </span>
            </span>
            <span className="mx-1 hidden h-8 w-px bg-[#E4E6E9] md:block" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onNav('research')}
              aria-label={`Bitget integration status ${bitgetOk == null ? 'unknown' : bitgetOk ? 'connected' : 'unreachable'}`}
              className="hidden min-h-11 items-center gap-2 rounded-full border border-[#E4E6E9] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1D21] transition-colors hover:border-[#1A1D21] md:inline-flex"
            >
              <BitgetMark />
              Connect Bitget
            </button>
            <button
              onClick={() => onNav('arena')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E2E4E7] text-[#4B5563] transition-colors hover:bg-[#D5D8DC]"
              aria-label={`Open paper portfolio, ${compactMoney(net)} virtual`}
            >
              <User size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="bg-[#F4F5F6] pb-28 lg:ml-[218px] lg:pb-12">
        <div className="mx-auto max-w-[1240px] px-4 pt-4 sm:px-5 md:px-6 md:pt-5">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E5DE] bg-white/96 backdrop-blur-xl lg:hidden"
      >
        <div className="grid grid-cols-4 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5">
          {NAV.map((n) => {
            const active = activeId === n.id;
            const Icon = n.id === 'arena' ? Swords : n.icon;
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNav(n.id);
                }}
                aria-label={n.label}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-xl px-1"
              >
                <span
                  className={cn(
                    'flex h-8 w-11 items-center justify-center rounded-full transition-colors',
                    active && 'bg-[#141412] text-white',
                  )}
                >
                  <Icon size={17} strokeWidth={active ? 2.1 : 1.8} />
                </span>
                <span aria-hidden="true" className={cn('text-[10.5px] font-medium', active ? 'text-black' : 'text-[#8A8A84]')}>
                  {n.label}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
