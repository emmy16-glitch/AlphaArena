import { type ReactNode, useEffect, useState } from 'react';
import { Activity, FlaskConical, Swords, Wallet, Trophy, Plus, ChevronLeft, ShieldCheck } from 'lucide-react';
import { Logo } from './ui';
import { cn } from '../utils/cn';
import { type BudgetStatus, type PortfolioSummary, productApi } from '../product/api';

const nav = [
  { id: 'pulse', label: 'Pulse', icon: Activity, hint: 'Watch' },
  { id: 'lab', label: 'Lab', icon: FlaskConical, hint: 'Simulate' },
  { id: 'arena', label: 'Arena', icon: Swords, hint: 'Battle' },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet, hint: 'Paper' },
  { id: 'leaderboard', label: 'Ranks', icon: Trophy, hint: 'Results' },
];

function compactMoney(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export default function AppShell({ view, onNav, onHome, children, onCreate }: { view: string; onNav: (v: string) => void; onHome: () => void; children: ReactNode; onCreate: () => void }) {
  const inSub = ['asset', 'nightwatch', 'battle', 'create'].includes(view);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [portfolioResult, budgetResult] = await Promise.allSettled([productApi.portfolio(), productApi.budget()]);
      if (!active) return;
      if (portfolioResult.status === 'fulfilled') setPortfolio(portfolioResult.value);
      if (budgetResult.status === 'fulfilled') setBudget(budgetResult.value);
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const net = portfolio?.net_value ?? 100_000;
  const free = portfolio?.free_capital ?? 100_000;
  const deployed = portfolio?.deployed_capital ?? 0;
  const returnPct = portfolio?.return_pct ?? 0;
  const deployedShare = net > 0 ? Math.min(100, Math.max(0, (deployed / net) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[#E7E5DE] bg-[#FAF9F6]/95 backdrop-blur-xl lg:flex">
        <div className="flex h-[72px] items-center px-5">
          <button aria-label="AlphaArena home" onClick={onHome} className="rounded-lg"><Logo /></button>
        </div>

        <div className="mx-3 rounded-2xl border border-[#E7E5DE] bg-white p-3.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold"><ShieldCheck size={15} /> Paper-only guardrail</div>
          <p className="mt-1.5 text-[11.5px] leading-5 text-[#8A8A84]">No wallet, deposit or Bitget order endpoint is connected.</p>
        </div>

        <nav aria-label="Main navigation" className="mt-5 flex-1 space-y-1 px-3">
          <div className="micro-label px-2 pb-2 text-[#8A8A84]">Explore</div>
          {nav.map((n) => {
            const active = view === n.id || (n.id === 'pulse' && inSub && (view === 'asset' || view === 'nightwatch')) || (n.id === 'arena' && view === 'battle');
            return (
              <a key={n.id} href={`#/${n.id}`} onClick={(event) => { event.preventDefault(); onNav(n.id); }} aria-label={n.label} aria-current={active ? 'page' : undefined} className={cn('group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors', active ? 'bg-[#141412] text-white' : 'text-[#55554F] hover:bg-[#EDECE7]/70 hover:text-black')}>
                <n.icon size={17} strokeWidth={1.9} />{n.label}
                <span aria-hidden="true" className={cn('ml-auto text-[11px]', active ? 'text-white/55' : 'text-[#B9B7B0]')}>{n.hint}</span>
              </a>
            );
          })}
          <div className="micro-label px-2 pb-2 pt-5 text-[#8A8A84]">Profile</div>
          <button onClick={onCreate} className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl border border-dashed px-3 text-[14px] font-medium transition-colors', view === 'create' ? 'border-[#141412] bg-[#141412] text-white' : 'border-[#D9D7CF] text-[#55554F] hover:border-[#141412] hover:text-black')}><Plus size={17} /> New trader</button>
        </nav>

        <div className="p-3">
          <div className="rounded-2xl border border-[#E7E5DE] bg-white p-4">
            <div className="micro-label text-[#8A8A84]">Virtual capital</div>
            <div className="mono-num mt-1 text-[22px] font-semibold">{compactMoney(net)}</div>
            <div className={cn('mono-num mt-0.5 text-[12px] font-medium', returnPct >= 0 ? 'text-[#0D7A4F]' : 'text-[#C93A3A]')}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}% marked</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F4F3EF]"><div className="h-full rounded-full bg-[#141412]" style={{ width: `${deployedShare}%` }} /></div>
            <div className="mt-2 text-[11.5px] text-[#8A8A84]">{compactMoney(deployed)} deployed · {compactMoney(free)} free</div>
            {budget && <div className="mt-3 border-t border-[#E7E5DE] pt-3 text-[11px] text-[#8A8A84]">AI safety budget: <span className="font-semibold text-[#55554F]">{budget.qwen.attempts_remaining_today}/{budget.qwen.daily_attempt_limit}</span> attempts left today</div>}
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-[#E7E5DE] bg-[#FAF9F6]/92 backdrop-blur-xl lg:ml-[232px]">
        <div className="flex h-[64px] items-center justify-between px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="AlphaArena home" onClick={onHome} className="rounded-lg lg:hidden"><Logo /></button>
            {inSub && <button aria-label="Go back" onClick={() => onNav(view === 'battle' ? 'arena' : 'pulse')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E7E5DE] bg-white lg:hidden"><ChevronLeft size={16} /></button>}
            <div className="hidden items-center gap-2 rounded-full border border-[#E7E5DE] bg-white px-3 py-2 lg:flex"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-[#0D7A4F]" /><span className="text-[12px] font-medium text-[#55554F]">Live evidence · paper decisions</span></div>
          </div>
          <button onClick={() => onNav('portfolio')} className="flex min-h-11 items-center gap-2.5 rounded-full border border-[#E7E5DE] bg-white py-1 pl-1 pr-3.5 transition-colors hover:border-[#141412]" aria-label={`Open paper portfolio, ${compactMoney(net)}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#141412] text-[11px] font-semibold text-white">YO</span>
            <span className="mono-num hidden text-[12.5px] font-semibold sm:inline">{compactMoney(net)}</span>
            <span className="hidden text-[11px] text-[#8A8A84] md:inline">paper</span>
          </button>
        </div>
      </header>

      <main className="pb-28 lg:ml-[232px] lg:pb-14"><div className="mx-auto max-w-[1120px] px-4 pt-6 sm:px-5 md:px-8 md:pt-8">{children}</div></main>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E5DE] bg-[#FAF9F6]/96 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5">
          {nav.map((n) => {
            const active = view === n.id || (n.id === 'pulse' && (view === 'asset' || view === 'nightwatch')) || (n.id === 'arena' && view === 'battle');
            return (
              <a key={n.id} href={`#/${n.id}`} onClick={(event) => { event.preventDefault(); onNav(n.id); }} aria-label={n.label} aria-current={active ? 'page' : undefined} className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-xl px-1">
                <span className={cn('flex h-8 w-11 items-center justify-center rounded-full transition-colors', active && 'bg-[#141412] text-white')}><n.icon size={17} strokeWidth={active ? 2.1 : 1.8} /></span>
                <span aria-hidden="true" className={cn('text-[10.5px] font-medium', active ? 'text-black' : 'text-[#8A8A84]')}>{n.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
