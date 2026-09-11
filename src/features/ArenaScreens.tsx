import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, Shield, Swords, Trophy, Wallet } from 'lucide-react';
import { fmtPrice } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { BattleReview, BattleView, Direction, LeaderRow, PortfolioSummary, productApi } from '../product/api';
import { ActionButton, EmptyAvatar, FieldLabel, Hairline, MicroLabel, Pnl, SegButton, Sparkline, VerdictPill } from '../components/ui';

type Nav = (view: string, payload?: unknown) => void;
const directionLabel = (value: Direction) => value === 'LONG' ? 'Up' : value === 'SHORT' ? 'Down' : 'No position';

function money(value: number, decimals = 0) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function durationLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'settling';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function ArenaScreen({ onNav, initialSymbol = 'rNVDA', initialThesis = '', initialAiSide = 'WAIT' }: { onNav: Nav; initialSymbol?: string; initialThesis?: string; initialAiSide?: Direction }) {
  const { assets } = useMarketData();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [side, setSide] = useState<Direction>('LONG');
  const [aiSide, setAiSide] = useState<Direction>(initialAiSide);
  const [stake, setStake] = useState(10000);
  const [duration, setDuration] = useState(24);
  const [thesis, setThesis] = useState(initialThesis || `The current ${initialSymbol} move will continue over the next 24 hours.`);
  const [battles, setBattles] = useState<BattleView[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [battleResult, portfolioResult] = await Promise.allSettled([productApi.battles(), productApi.portfolio()]);
    if (battleResult.status === 'fulfilled') setBattles(battleResult.value);
    if (portfolioResult.status === 'fulfilled') setPortfolio(portfolioResult.value);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (creating || thesis.trim().length < 4) return;
    setCreating(true);
    setError('');
    try {
      const battle = await productApi.createBattle({ symbol, user_side: side, ai_side: aiSide, thesis: thesis.trim(), stake, duration_hours: duration, opponent: 'NightWatch' });
      await load();
      onNav('battle', { id: battle.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create battle');
    } finally {
      setCreating(false);
    }
  };

  const shownCapital = portfolio?.net_value ?? 100000;
  const freeCapital = portfolio?.free_capital ?? 100000;

  return <div className="fade-up">
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>Arena · Virtual capital</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">You have a thesis. <span className="serif-italic font-normal text-[#55554F]">Prove it.</span></h1><p className="mt-3 max-w-[650px] text-[14px] leading-6 text-[#55554F]">No deposit. No wallet. No real-money execution. Record a paper position using live market prices and let the observed market settle it.</p></div><Swords size={48} strokeWidth={1.2} className="hidden text-[#D9D7CF] md:block" /></div>

    <div className="mt-8 grid gap-5 lg:grid-cols-[.78fr_1.22fr]">
      <section className="rounded-[26px] bg-[#141412] p-6 text-white md:p-8"><MicroLabel className="text-white/45">Virtual net value</MicroLabel><div className="mono-num mt-4 text-[45px] font-semibold tracking-[-0.05em]">{money(shownCapital)}</div><div className="mt-1 text-[11px] text-white/45">Starting capital {money(portfolio?.starting_capital ?? 100000)} · never withdrawable</div><div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Free</div><div className="mono-num mt-1 text-[16px]">{money(freeCapital)}</div></div><div><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Deployed</div><div className="mono-num mt-1 text-[16px]">{money(portfolio?.deployed_capital ?? 0)}</div></div></div></section>

      <section className="rounded-[26px] border border-[#D9D7CF] bg-white p-6 md:p-8"><MicroLabel>Start a thesis battle</MicroLabel><div className="mt-6 grid gap-5 sm:grid-cols-2"><div><FieldLabel>Asset</FieldLabel><div className="flex flex-wrap gap-2">{assets.slice(0, 6).map((asset) => <SegButton key={asset.symbol} active={symbol === asset.symbol} onClick={() => setSymbol(asset.symbol)}>{asset.name || asset.symbol}</SegButton>)}</div></div><div><FieldLabel>Your side</FieldLabel><div className="flex flex-wrap gap-2">{(['LONG', 'SHORT', 'WAIT'] as Direction[]).map((item) => <SegButton key={item} active={side === item} onClick={() => setSide(item)}>{directionLabel(item)}</SegButton>)}</div></div></div><div className="mt-5"><FieldLabel>NightWatch stance</FieldLabel><div className="flex flex-wrap gap-2">{(['LONG', 'SHORT', 'WAIT'] as Direction[]).map((item) => <SegButton key={item} active={aiSide === item} onClick={() => setAiSide(item)}>{directionLabel(item)}</SegButton>)}</div></div><div className="mt-5"><FieldLabel>Thesis</FieldLabel><textarea aria-label="Battle thesis" value={thesis} onChange={(event) => setThesis(event.target.value)} className="min-h-[110px] w-full resize-none rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] p-4 text-[13px] leading-5 outline-none focus:border-[#141412]" /></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><FieldLabel>Virtual stake · {money(stake)}</FieldLabel><input aria-label="Virtual stake" type="range" min="1000" max={Math.max(1000, Math.min(50000, Math.floor(freeCapital / 1000) * 1000))} step="1000" value={Math.min(stake, Math.max(1000, freeCapital))} onChange={(event) => setStake(Number(event.target.value))} className="w-full accent-[#141412]" /></div><div><FieldLabel>Duration</FieldLabel><div className="flex gap-2">{[6, 24, 72].map((hours) => <SegButton key={hours} active={duration === hours} onClick={() => setDuration(hours)}>{hours < 24 ? `${hours}H` : `${hours / 24}D`}</SegButton>)}</div></div></div><ActionButton onClick={() => void create()} className="mt-6">{creating ? 'Recording battle…' : 'Enter the Arena'} <ArrowRight size={14} /></ActionButton>{error && <p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}</section>
    </div>

    <div className="mt-10 flex items-center justify-between"><h2 className="text-[20px] font-semibold">Your battles</h2><button onClick={() => void load()} className="flex items-center gap-1.5 text-[11px] text-[#55554F]"><RefreshCw size={12} />Refresh</button></div>
    {battles.length === 0 ? <div className="mt-4 rounded-[22px] border border-dashed border-[#D9D7CF] p-8 text-center text-[13px] text-[#8A8A84]">No recorded battles yet. Your first one will appear here.</div> : <div className="mt-4 grid gap-4 md:grid-cols-3">{battles.map((battle) => <button key={battle.id} onClick={() => onNav('battle', { id: battle.id })} className="rounded-[22px] border border-[#E7E5DE] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#D9D7CF]"><div className="flex items-center justify-between"><span className="font-semibold">{battle.symbol}</span><VerdictPill tone={battle.status === 'live' ? 'up' : 'neutral'}>{battle.status}</VerdictPill></div><p className="mt-4 min-h-[58px] text-[12px] leading-5 text-[#55554F]">{battle.thesis}</p><Hairline className="my-4" /><div className="flex items-center justify-between"><span className="text-[11px]">{battle.user_side} vs {battle.ai_side}</span><Pnl value={battle.user_pnl_pct} className="text-[11px]" /></div></button>)}</div>}
  </div>;
}

export function BattleScreen({ onNav, battleId }: { onNav: Nav; battleId?: string }) {
  const { assets } = useMarketData();
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [review, setReview] = useState<BattleReview | null>(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const load = async () => {
    try {
      if (battleId) {
        setBattle(await productApi.battle(battleId));
      } else {
        const rows = await productApi.battles();
        setBattle(rows[0] || null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Battle unavailable');
    }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [battleId]);

  const requestReview = async () => {
    if (!battle || battle.status !== 'settled' || reviewing) return;
    setReviewing(true);
    setError('');
    try { setReview(await productApi.reviewBattle(battle.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Review unavailable'); }
    finally { setReviewing(false); }
  };

  if (!battle) return <div className="fade-up rounded-[26px] border border-dashed border-[#D9D7CF] p-10 text-center"><MicroLabel>Battle</MicroLabel><h1 className="mt-4 text-[30px] font-semibold">No battle selected.</h1><ActionButton variant="secondary" onClick={() => onNav('arena')} className="mt-5">Open Arena</ActionButton>{error && <p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}</div>;
  const asset = assets.find((item) => item.symbol === battle.symbol);

  return <div className="fade-up">
    <div className="flex items-start justify-between gap-4"><div><MicroLabel>{battle.status === 'live' ? 'Live' : 'Settled'} battle · virtual capital</MicroLabel><h1 className="mt-3 text-[40px] font-semibold tracking-[-0.05em] md:text-[52px]">{battle.symbol} thesis battle</h1></div><VerdictPill tone={battle.status === 'live' ? 'up' : 'neutral'}>{battle.status === 'live' ? durationLeft(battle.expires_at) : 'Final'}</VerdictPill></div>
    <section className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-6 md:p-9"><div className="grid gap-5 md:grid-cols-[1fr_100px_1fr] md:items-center"><div className="rounded-[22px] border border-[#1D3DFF]/20 bg-[#EEF0FF] p-6"><MicroLabel className="text-[#1D3DFF]">You</MicroLabel><div className="mt-4 text-[28px] font-semibold">{battle.user_side}</div><div className="mt-1 text-[11px] text-[#55554F]">Entry ${fmtPrice(battle.entry_price)} · stake {money(battle.stake)}</div><Pnl value={battle.user_pnl_pct} className="mt-6 block text-[30px]" /></div><div className="serif-italic text-center text-[28px] text-[#8A8A84]">vs.</div><div className="rounded-[22px] bg-[#F4F3EF] p-6"><MicroLabel>{battle.opponent}</MicroLabel><div className="mt-4 text-[28px] font-semibold">{battle.ai_side}</div><div className="mt-1 text-[11px] text-[#55554F]">Same recorded market entry</div><Pnl value={battle.ai_pnl_pct} className="mt-6 block text-[30px]" /></div></div><Hairline className="my-8" /><div className="grid gap-7 md:grid-cols-[1fr_.8fr]"><div><MicroLabel>Original thesis</MicroLabel><blockquote className="serif-italic mt-4 text-[25px] leading-9 text-[#2A2A28]">“{battle.thesis}”</blockquote></div><div><MicroLabel>{battle.status === 'settled' ? 'Settlement' : 'Market now'}</MicroLabel><div className="mt-4 mono-num text-[28px] font-semibold">${fmtPrice(battle.current_price)}</div>{asset && <div className="mt-4 rounded-xl bg-[#F4F3EF] p-3"><Sparkline data={asset.spark} width={360} height={75} className="h-[75px] w-full" /></div>}{battle.settled_at && <div className="mt-2 text-[10px] text-[#8A8A84]">Frozen {new Date(battle.settled_at).toLocaleString()}</div>}</div></div><div className="mt-8 flex flex-wrap gap-2"><ActionButton variant="secondary" onClick={() => onNav('nightwatch', { symbol: battle.symbol })}>Open NightWatch</ActionButton><ActionButton variant="secondary" onClick={() => onNav('lab', { prompt: battle.thesis })}>Open MarketTwin</ActionButton>{battle.status === 'settled' && <ActionButton onClick={() => void requestReview()}>{reviewing ? 'Reviewing…' : 'Review this battle'}</ActionButton>}</div>{error && <p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}</section>
    {review && <section className="mt-5 rounded-[26px] bg-[#141412] p-6 text-white md:p-8"><div className="flex items-center gap-2"><Shield size={15} /><MicroLabel className="text-white/45">Post-trade learning</MicroLabel></div><h2 className="mt-5 text-[27px] font-semibold tracking-[-0.035em]">{review.lesson}</h2><div className="mt-7 grid gap-6 md:grid-cols-2"><div><div className="text-[11px] font-semibold text-white/60">What worked</div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-white/70">{review.what_worked.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><div className="text-[11px] font-semibold text-white/60">What failed / remains unknown</div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-white/70">{review.what_failed.map((item) => <li key={item}>• {item}</li>)}</ul></div></div><div className="mt-6 rounded-2xl border border-white/15 p-4"><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Next falsifiable rule</div><p className="mt-2 text-[13px] leading-5">{review.next_rule}</p></div></section>}
  </div>;
}

export function PortfolioScreen({ onNav }: { onNav: Nav }) {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [battles, setBattles] = useState<BattleView[]>([]);
  useEffect(() => { void Promise.all([productApi.portfolio(), productApi.battles()]).then(([summary, rows]) => { setPortfolio(summary); setBattles(rows); }).catch(() => {}); }, []);
  const summary = portfolio || { starting_capital: 100000, net_value: 100000, free_capital: 100000, deployed_capital: 0, return_pct: 0, open_battles: 0, settled_battles: 0 };
  return <div className="fade-up"><div className="flex items-end justify-between"><div><MicroLabel>Portfolio · Virtual only</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">Your decisions, <span className="serif-italic font-normal text-[#55554F]">remembered.</span></h1></div><Wallet className="hidden text-[#D9D7CF] md:block" size={48} strokeWidth={1.2} /></div><div className="mt-8 grid gap-5 md:grid-cols-[.8fr_1.2fr]"><section className="rounded-[26px] bg-[#141412] p-7 text-white"><MicroLabel className="text-white/45">Virtual net value</MicroLabel><div className="mono-num mt-4 text-[48px] font-semibold">{money(summary.net_value)}</div><Pnl value={summary.return_pct} className="mt-1 block text-[13px]" /><div className="mt-9 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><div className="text-[10px] text-white/40">FREE</div><div className="mono-num mt-1 text-[15px]">{money(summary.free_capital)}</div></div><div><div className="text-[10px] text-white/40">DEPLOYED</div><div className="mono-num mt-1 text-[15px]">{money(summary.deployed_capital)}</div></div></div></section><section className="rounded-[26px] border border-[#E7E5DE] bg-white p-7"><MicroLabel>Battle book</MicroLabel><div className="mt-5 grid grid-cols-2 gap-5"><div><div className="mono-num text-[30px] font-semibold">{summary.open_battles}</div><div className="mt-1 text-[11px] text-[#8A8A84]">Open</div></div><div><div className="mono-num text-[30px] font-semibold">{summary.settled_battles}</div><div className="mt-1 text-[11px] text-[#8A8A84]">Settled</div></div></div><Hairline className="my-5" /><p className="text-[12px] leading-5 text-[#55554F]">Returns are computed from recorded virtual stakes and market-marked outcomes. They are virtual results, not cash balances.</p></section></div><div className="mt-8 flex items-center justify-between"><h2 className="text-[20px] font-semibold">Decision history</h2><ActionButton variant="secondary" onClick={() => onNav('arena')}>New battle</ActionButton></div><div className="mt-4 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">{battles.map((battle) => <button key={battle.id} onClick={() => onNav('battle', { id: battle.id })} className="grid w-full grid-cols-[1fr_auto] gap-4 py-4 text-left"><div><div className="text-[13px] font-semibold">{battle.symbol} · {battle.user_side}</div><p className="mt-1 max-w-[700px] text-[11px] text-[#8A8A84]">{battle.thesis}</p></div><div className="text-right"><Pnl value={battle.user_pnl_pct} className="text-[12px]" /><div className="mt-1 text-[10px] text-[#8A8A84]">{battle.status}</div></div></button>)}</div></div>;
}

export function LeaderboardScreen() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'human' | 'ai'>('all');
  useEffect(() => { void productApi.leaderboard().then(setRows).catch(() => {}); }, []);
  const visible = rows.filter((row) => filter === 'all' || row.type === filter);
  return <div className="fade-up"><div className="flex items-end justify-between"><div><MicroLabel>Leaderboard · Paper results</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">Let results <span className="serif-italic font-normal text-[#55554F]">speak.</span></h1></div><Trophy size={44} strokeWidth={1.2} className="hidden text-[#D9D7CF] md:block" /></div><div className="mt-6 flex gap-1 rounded-full bg-[#EDECE7] p-1 w-fit">{(['all', 'human', 'ai'] as const).map((item) => <SegButton key={item} active={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'Everyone' : item === 'human' ? 'Humans' : 'AI'}</SegButton>)}</div>{visible.length === 0 ? <div className="mt-8 rounded-[24px] border border-dashed border-[#D9D7CF] p-10 text-center text-[13px] text-[#8A8A84]">Leaderboard begins after the first virtual battle.</div> : <div className="mt-8 overflow-hidden rounded-[26px] border border-[#E7E5DE] bg-white"><div className="grid grid-cols-[48px_1fr_76px_70px] gap-3 border-b border-[#E7E5DE] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8A8A84] md:grid-cols-[60px_1fr_150px_90px_90px]"><span>#</span><span>Trader</span><span className="hidden md:block">Style</span><span className="text-right">Return</span><span className="text-right">Win</span></div>{visible.map((row) => <div key={`${row.type}-${row.name}`} className="grid grid-cols-[48px_1fr_76px_70px] items-center gap-3 border-b border-[#E7E5DE] px-5 py-4 last:border-0 md:grid-cols-[60px_1fr_150px_90px_90px]"><span className="mono-num text-[12px] text-[#8A8A84]">{String(row.rank).padStart(2, '0')}</span><div className="flex items-center gap-3"><EmptyAvatar name={row.name} ai={row.type === 'ai'} /><div><div className="text-[13px] font-semibold">{row.name}</div><div className="mt-0.5 text-[10.5px] text-[#8A8A84]">{row.battles} battles</div></div></div><span className="hidden text-[11px] text-[#55554F] md:block">{row.style}</span><Pnl value={row.return_pct} className="text-right text-[12px]" /><span className="mono-num text-right text-[12px]">{row.win_rate}%</span></div>)}</div>}</div>;
}
