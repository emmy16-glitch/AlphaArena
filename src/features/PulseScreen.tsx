import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, RefreshCw } from 'lucide-react';
import { fmtPrice, pulseItems } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { PulseEvent, productApi } from '../product/api';
import { ActionButton, MicroLabel, Pnl, Sparkline, VerdictPill } from '../components/ui';

type Nav = (view: string, payload?: unknown) => void;

function Dot({ live }: { live: boolean }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#0D7A4F]' : 'bg-[#9A6B00]'}`} />;
}

export default function PulseScreen({ onNav }: { onNav: Nav }) {
  const { assets, refresh } = useMarketData();
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await productApi.pulse());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pulse unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const fallback: PulseEvent[] = pulseItems.map((item) => ({
    id: item.id,
    symbol: item.asset,
    severity: item.severity,
    title: item.title,
    summary: item.summary,
    score: item.score,
    tags: item.tags,
    detected_at: '',
  }));
  const rows = events.length ? events : fallback;
  const visible = rows.filter((event) => `${event.symbol} ${event.title} ${event.summary}`.toLowerCase().includes(query.toLowerCase()));
  const hero = rows[0];
  const heroAsset = assets.find((asset) => asset.symbol === hero?.symbol) || assets[0];
  const live = events.length > 0;

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <MicroLabel>Pulse · NightWatch</MicroLabel>
          <h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] md:text-[56px]">What matters <span className="serif-italic font-normal text-[#55554F]">right now.</span></h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#55554F]">A quiet feed of measurable market changes. No engagement bait, no wall of tickers.</p>
        </div>
        <button onClick={() => { void refresh(); void load(); }} className="flex items-center gap-2 text-[12px] font-medium text-[#55554F]">
          <Dot live={live} /> {loading ? 'Updating…' : live ? 'Live detections' : 'Preview'} <RefreshCw size={13} />
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-[#E7E5DE] bg-white px-4 py-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets or market changes" className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#B9B7B0]" />
      </div>
      {error && <p className="mt-2 text-[11px] text-[#9A6B00]">Live Pulse is unavailable: {error}. Preview rows remain clearly marked.</p>}

      {hero && heroAsset && (
        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#D9D7CF] bg-white">
          <div className="grid gap-8 p-6 md:grid-cols-[1.15fr_.85fr] md:p-8">
            <div>
              <div className="flex items-center gap-2"><Dot live={live} /><span className="text-[12px] font-semibold">{hero.title}</span></div>
              <div className="mt-5 flex items-baseline gap-3"><span className="mono-num text-[38px] font-semibold">${fmtPrice(heroAsset.price)}</span><Pnl value={heroAsset.changePct} className="text-[15px]" /></div>
              <p className="mt-5 max-w-[630px] text-[14px] leading-6 text-[#55554F]">{hero.summary}</p>
              <div className="mt-6 flex flex-wrap gap-2">{hero.tags.map((tag) => <VerdictPill key={tag} tone={hero.severity === 'elevated' ? 'warn' : 'neutral'}>{tag}</VerdictPill>)}</div>
              <div className="mt-7 flex flex-wrap gap-2">
                <ActionButton onClick={() => onNav('asset', { symbol: hero.symbol })}>Investigate <ArrowRight size={14} /></ActionButton>
                <ActionButton variant="secondary" onClick={() => onNav('nightwatch', { symbol: hero.symbol })}>Stress-test</ActionButton>
                <ActionButton variant="secondary" onClick={() => onNav('lab', { symbol: hero.symbol })}>Simulate</ActionButton>
              </div>
            </div>
            <div className="flex min-h-[220px] items-center rounded-2xl bg-[#F4F3EF] p-5"><Sparkline data={heroAsset.spark} width={420} height={180} className="h-[180px] w-full" /></div>
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between"><h2 className="text-[20px] font-semibold tracking-[-0.025em]">Signals worth a second look</h2><span className="text-[11px] text-[#8A8A84]">{live ? 'Derived from Bitget Reality market data' : 'Design preview'}</span></div>
      <div className="mt-3 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">
        {visible.map((event) => {
          const asset = assets.find((item) => item.symbol === event.symbol);
          return (
            <button key={event.id} onClick={() => onNav(event.symbol.startsWith('r') ? 'asset' : 'lab', { symbol: event.symbol })} className="grid w-full gap-4 py-6 text-left transition-opacity hover:opacity-70 md:grid-cols-[90px_1fr_auto] md:items-center">
              <div><MicroLabel>{event.score}/100</MicroLabel><div className="mt-2 text-[13px] font-semibold">{event.symbol}</div></div>
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-semibold">{event.title}</h3>{event.severity === 'elevated' && <VerdictPill tone="warn">Elevated</VerdictPill>}</div><p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#55554F]">{event.summary}</p></div>
              <div className="flex items-center gap-4">{asset && <Pnl value={asset.changePct} className="text-[12px]" />}<ChevronRight size={16} className="text-[#8A8A84]" /></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
