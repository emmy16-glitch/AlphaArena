import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Wallet,
  Zap,
} from 'lucide-react';
import { battles, fmtPrice, leaders, pulseItems, scenarios } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import {
  ActionButton,
  EmptyAvatar,
  FieldLabel,
  Hairline,
  Logo,
  MicroLabel,
  Pnl,
  ScoreRing,
  SegButton,
  Sparkline,
  VerdictPill,
} from './ui';

type Nav = (view: string, payload?: unknown) => void;

function MarketStatus() {
  const { status } = useMarketData();
  const live = status === 'live';
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-[#8A8A84]">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#0D7A4F]' : 'bg-[#9A6B00]'}`} />
      {live ? 'Live market data' : 'Limited market data'}
    </span>
  );
}

export function Landing({ onEnter }: { onEnter: (view: string) => void }) {
  const { assets, status } = useMarketData();
  const hero = assets[0];
  const tape = [...assets.slice(0, 4), ...assets.slice(0, 4)];
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#141412] paper-texture">
      <header className="sticky top-0 z-30 border-b border-[#E7E5DE] bg-[#FAF9F6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 md:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13px] text-[#55554F] md:flex">
            <button onClick={() => onEnter('pulse')} className="hover:text-black">Pulse</button>
            <button onClick={() => onEnter('lab')} className="hover:text-black">Lab</button>
            <button onClick={() => onEnter('arena')} className="hover:text-black">Arena</button>
          </nav>
          <ActionButton onClick={() => onEnter('pulse')}>Enter app <ArrowRight size={14} /></ActionButton>
        </div>
      </header>

      <div className="overflow-hidden border-b border-[#E7E5DE] bg-white/70">
        <div className="marquee-track flex w-max items-center gap-9 py-3">
          {tape.map((a, i) => (
            <div key={`${a.symbol}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-[12px]">
              <span className="font-semibold">{a.symbol}</span>
              <span className="mono-num text-[#55554F]">${fmtPrice(a.price)}</span>
              <Pnl value={a.changePct} className="text-[12px]" />
            </div>
          ))}
        </div>
      </div>

      <main>
        <section className="mx-auto grid min-h-[760px] max-w-[1240px] items-center gap-14 px-5 py-20 md:px-8 lg:grid-cols-[1.08fr_.92fr] lg:py-28">
          <div className="fade-up">
            <div className="mb-10 flex flex-wrap items-center gap-5">
              <MicroLabel>N°01 — AI Market Laboratory</MicroLabel>
              <span className="h-px w-16 bg-[#D9D7CF]" />
              <MicroLabel className="text-[#1D3DFF]">Tokenized U.S. equities</MicroLabel>
            </div>
            <h1 className="max-w-[760px] text-[clamp(3.7rem,8vw,7.4rem)] font-semibold leading-[0.86] tracking-[-0.07em]">
              Don’t just watch<br />the market.
              <span className="serif-italic block pt-3 font-normal tracking-[-0.035em] text-[#55554F]">Test it.</span>
            </h1>
            <p className="mt-10 max-w-[610px] text-[18px] leading-8 text-[#55554F] md:text-[21px]">
              AlphaArena is a 24/7 AI market laboratory for tokenized U.S. equities. Watch, simulate and put your ideas to the test — with virtual capital.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <ActionButton onClick={() => onEnter('pulse')} className="px-7 py-3.5 text-[15px]">Enter the Arena <ArrowRight size={16} /></ActionButton>
              <ActionButton variant="secondary" onClick={() => onEnter('lab')} className="px-7 py-3.5 text-[15px]">Explore the Lab</ActionButton>
            </div>
            <div className="mt-14 grid max-w-[610px] grid-cols-3 border-y border-[#E7E5DE] py-5">
              <div><div className="mono-num text-[18px] font-semibold">24/7</div><div className="mt-1 text-[11px] text-[#8A8A84]">Market context</div></div>
              <div className="border-x border-[#E7E5DE] px-4"><div className="mono-num text-[18px] font-semibold">$100K</div><div className="mt-1 text-[11px] text-[#8A8A84]">Virtual capital</div></div>
              <div className="pl-4"><div className="text-[14px] font-semibold">Watch · Simulate · Battle</div><div className="mt-1 text-[11px] text-[#8A8A84]">One connected loop</div></div>
            </div>
          </div>

          <div className="relative fade-up stagger-2">
            <div className="absolute -left-12 top-16 hidden h-48 w-48 rounded-full bg-[#EEF0FF] blur-3xl lg:block" />
            <div className="relative overflow-hidden rounded-[28px] border border-[#D9D7CF] bg-white p-6 shadow-[0_24px_80px_-48px_rgba(20,20,18,.35)] md:p-8">
              <div className="flex items-center justify-between"><div><MicroLabel>NightWatch live brief</MicroLabel><div className="mt-2 text-[12px] text-[#8A8A84]">{status === 'live' ? 'Live market data' : 'Limited data while the market feed connects'}</div></div><MarketStatus /></div>
              <Hairline className="my-6" />
              <div className="flex items-start justify-between gap-4">
                <div><div className="text-[16px] font-semibold">{hero.symbol}</div><div className="mt-1 text-[12px] text-[#8A8A84]">{hero.name}</div></div>
                <div className="text-right"><div className="mono-num text-[28px] font-semibold">${fmtPrice(hero.price)}</div><Pnl value={hero.changePct} className="text-[13px]" /></div>
              </div>
              <div className="mt-8 rounded-2xl bg-[#F4F3EF] px-4 py-6"><Sparkline data={hero.spark} width={420} height={110} className="h-[110px] w-full" /></div>
              <div className="mt-6"><VerdictPill tone="warn"><CircleAlert size={12} /> NightWatch · thesis pressure rising</VerdictPill></div>
              <h2 className="mt-4 text-[25px] font-semibold tracking-[-0.035em]">The move is strong. The evidence is mixed.</h2>
              <p className="mt-3 text-[14px] leading-6 text-[#55554F]">Before chasing momentum, compare the current move with past behaviour and test how the thesis survives a weaker Nasdaq session.</p>
              <div className="mt-7 grid grid-cols-3 gap-2">
                <button onClick={() => onEnter('asset')} className="rounded-xl bg-[#141412] px-3 py-3 text-[12px] font-medium text-white">Investigate</button>
                <button onClick={() => onEnter('lab')} className="rounded-xl border border-[#D9D7CF] px-3 py-3 text-[12px] font-medium">Simulate</button>
                <button onClick={() => onEnter('arena')} className="rounded-xl border border-[#D9D7CF] px-3 py-3 text-[12px] font-medium">Battle</button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#E7E5DE] bg-white/45">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:grid-cols-3 md:px-8">
            {[['01','Watch','NightWatch notices what changed and challenges the obvious explanation.'],['02','Simulate','MarketTwin lets you change the world before risking a decision.'],['03','Battle','Put the thesis against real market outcomes using virtual capital.']].map(([n,t,d]) => <div key={n} className="border-t border-[#141412] pt-5"><MicroLabel>{n}</MicroLabel><h3 className="mt-6 text-[32px] font-semibold tracking-[-0.045em]">{t}</h3><p className="mt-3 max-w-[320px] text-[14px] leading-6 text-[#55554F]">{d}</p></div>)}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E7E5DE]"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 text-[12px] text-[#8A8A84] md:flex-row md:items-center md:justify-between md:px-8"><Logo /><span>24/7 AI market laboratory · virtual capital only</span></div></footer>
    </div>
  );
}

export function Pulse({ onNav }: { onNav: Nav }) {
  const { assets, status, refresh } = useMarketData();
  const [query, setQuery] = useState('');
  const hero = assets[0];
  const visible = pulseItems.filter((p) => `${p.asset} ${p.title} ${p.summary}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><MicroLabel>Pulse · NightWatch</MicroLabel><h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] md:text-[56px]">What matters <span className="serif-italic font-normal text-[#55554F]">right now.</span></h1><p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#55554F]">A quiet feed of market changes worth investigating — not another wall of tickers.</p></div>
        <div className="flex items-center gap-3"><MarketStatus /><button onClick={() => void refresh()} className="text-[12px] font-medium text-[#1D3DFF]">Refresh</button></div>
      </div>
      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[#E7E5DE] bg-white px-4 py-3"><Search size={16} className="text-[#8A8A84]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets, catalysts or ideas" className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#B9B7B0]" /></div>

      <section className="mt-6 overflow-hidden rounded-[26px] border border-[#D9D7CF] bg-white">
        <div className="grid gap-8 p-6 md:grid-cols-[1.2fr_.8fr] md:p-8">
          <div><div className="flex items-center gap-2"><span className="tick-dot h-2 w-2 rounded-full bg-[#0D7A4F]" /><span className="text-[12px] font-semibold">{hero.symbol} is moving unusually</span></div><div className="mt-5 flex items-baseline gap-3"><span className="mono-num text-[38px] font-semibold">${fmtPrice(hero.price)}</span><Pnl value={hero.changePct} className="text-[15px]" /></div><h2 className="mt-7 max-w-[600px] text-[27px] font-semibold tracking-[-0.04em]">A strong move does not automatically make a strong thesis.</h2><p className="mt-3 max-w-[600px] text-[14px] leading-6 text-[#55554F]">NightWatch sees elevated momentum and asks whether the move still has room, or whether the trade is becoming crowded.</p><div className="mt-7 flex flex-wrap gap-2"><ActionButton onClick={() => onNav('asset', { symbol: hero.symbol })}>Investigate <ArrowRight size={14}/></ActionButton><ActionButton variant="secondary" onClick={() => onNav('lab')}>Simulate</ActionButton><ActionButton variant="secondary" onClick={() => onNav('arena')}>Battle</ActionButton></div></div>
          <div className="flex min-h-[220px] items-center rounded-2xl bg-[#F4F3EF] p-5"><Sparkline data={hero.spark} width={420} height={180} className="h-[180px] w-full" /></div>
        </div>
      </section>

      <div className="mt-10 flex items-center justify-between"><h2 className="text-[20px] font-semibold tracking-[-0.025em]">Signals worth a second look</h2><span className="text-[12px] text-[#8A8A84]">{status === 'live' ? 'Market prices live · narratives preview' : 'Preview narratives'}</span></div>
      <div className="mt-3 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">
        {visible.map((p) => {
          const asset = assets.find((a) => a.symbol === p.asset);
          return <button key={p.id} onClick={() => onNav(p.asset.startsWith('r') ? 'asset' : 'lab', { symbol: p.asset })} className="grid w-full gap-4 py-6 text-left transition-opacity hover:opacity-70 md:grid-cols-[96px_1fr_auto] md:items-center"><div><MicroLabel>{p.time}</MicroLabel><div className="mt-2 text-[13px] font-semibold">{p.asset}</div></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-semibold">{p.title}</h3>{p.severity === 'elevated' && <VerdictPill tone="warn">Elevated</VerdictPill>}</div><p className="mt-2 max-w-[720px] text-[13px] leading-5 text-[#55554F]">{p.summary}</p></div><div className="flex items-center gap-4 md:justify-end">{asset && <div className="text-right"><div className="mono-num text-[14px] font-semibold">${fmtPrice(asset.price)}</div><Pnl value={asset.changePct} className="text-[11px]" /></div>}<ChevronRight size={16} className="text-[#8A8A84]" /></div></button>;
        })}
      </div>
    </div>
  );
}

export function AssetDetail({ symbol, onNav }: { symbol: string; onNav: Nav }) {
  const { assets } = useMarketData();
  const asset = assets.find((a) => a.symbol === symbol) || assets[0];
  return (
    <div className="fade-up">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div><MicroLabel>Asset intelligence</MicroLabel><div className="mt-4 flex items-center gap-3"><h1 className="text-[48px] font-semibold tracking-[-0.06em] md:text-[64px]">{asset.symbol}</h1><MarketStatus /></div><p className="mt-1 text-[14px] text-[#8A8A84]">{asset.name}</p></div>
        <div className="md:text-right"><div className="mono-num text-[40px] font-semibold">${fmtPrice(asset.price)}</div><Pnl value={asset.changePct} className="text-[15px]" /></div>
      </div>
      <section className="mt-8 rounded-[26px] border border-[#D9D7CF] bg-white p-5 md:p-8"><div className="flex items-center justify-between"><MicroLabel>24 hour movement</MicroLabel><span className="text-[12px] text-[#8A8A84]">{asset.session}</span></div><div className="mt-5 rounded-2xl bg-[#F4F3EF] p-4"><Sparkline data={asset.spark} width={920} height={220} className="h-[220px] w-full" /></div><div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#E7E5DE] pt-5 text-[12px]"><div><div className="text-[#8A8A84]">24h high</div><div className="mono-num mt-1 font-semibold">${fmtPrice(asset.high24)}</div></div><div><div className="text-[#8A8A84]">24h low</div><div className="mono-num mt-1 font-semibold">${fmtPrice(asset.low24)}</div></div><div><div className="text-[#8A8A84]">Volume</div><div className="mono-num mt-1 font-semibold">{asset.volume}</div></div></div></section>
      <section className="mt-8 grid gap-5 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[26px] border border-[#E7E5DE] bg-white p-6"><MicroLabel>NightWatch view</MicroLabel><h2 className="mt-5 text-[28px] font-semibold tracking-[-0.04em]">Strong tape. Fragile assumptions.</h2><p className="mt-3 text-[14px] leading-6 text-[#55554F]">The live price move deserves attention, but NightWatch wants the thesis tested against historical analogues, macro pressure and a weaker-liquidity scenario before you commit virtual capital.</p><div className="mt-6"><ActionButton onClick={() => onNav('nightwatch', { symbol: asset.symbol })}>Stress-test a thesis <ArrowRight size={14}/></ActionButton></div></div>
        <div className="rounded-[26px] border border-[#E7E5DE] bg-[#141412] p-6 text-white"><MicroLabel className="text-white/45">Three moves</MicroLabel><div className="mt-6 space-y-4 text-[14px]"><button onClick={() => onNav('nightwatch')} className="flex w-full items-center justify-between border-b border-white/15 pb-4">Investigate <ArrowUpRight size={14}/></button><button onClick={() => onNav('lab')} className="flex w-full items-center justify-between border-b border-white/15 pb-4">Simulate <ArrowUpRight size={14}/></button><button onClick={() => onNav('arena')} className="flex w-full items-center justify-between">Battle <ArrowUpRight size={14}/></button></div></div>
      </section>
    </div>
  );
}

export function NightWatch({ onNav }: { onNav: Nav }) {
  const { assets } = useMarketData();
  const [thesis, setThesis] = useState('The current rNVDA momentum can continue through the overnight session.');
  const [direction, setDirection] = useState<'LONG' | 'SHORT' | 'WAIT'>('LONG');
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(true);
  const asset = assets[0];
  const run = () => { setRunning(true); setComplete(false); window.setTimeout(() => { setRunning(false); setComplete(true); }, 1500); };
  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>NightWatch · Decision stress test</MicroLabel><h1 className="mt-3 text-[43px] font-semibold tracking-[-0.055em] md:text-[58px]">Put your thesis <span className="serif-italic font-normal text-[#55554F]">under pressure.</span></h1><p className="mt-3 max-w-[650px] text-[14px] leading-6 text-[#55554F]">NightWatch does not decide for you. It tries to find where your idea breaks before the market does.</p></div><MarketStatus /></div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[.78fr_1.22fr]">
        <section className="rounded-[26px] border border-[#E7E5DE] bg-white p-6"><MicroLabel>Trade thesis</MicroLabel><div className="mt-6"><FieldLabel>Asset</FieldLabel><div className="flex items-center justify-between rounded-xl bg-[#F4F3EF] px-4 py-3"><span className="font-semibold">{asset.symbol}</span><span className="mono-num text-[13px]">${fmtPrice(asset.price)}</span></div></div><div className="mt-5"><FieldLabel>Direction</FieldLabel><div className="flex gap-2">{(['LONG','SHORT','WAIT'] as const).map((d) => <SegButton key={d} active={direction===d} onClick={() => setDirection(d)}>{d}</SegButton>)}</div></div><div className="mt-5"><FieldLabel>Your thesis</FieldLabel><textarea value={thesis} onChange={(e) => setThesis(e.target.value)} className="min-h-[140px] w-full resize-none rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] p-4 text-[14px] leading-6 outline-none focus:border-[#141412]" /></div><ActionButton onClick={run} className="mt-5 w-full py-3">{running ? 'Stress-testing…' : 'Stress-test my trade'} <Zap size={14}/></ActionButton><p className="mt-3 text-[11px] leading-4 text-[#8A8A84]">AI analysis stays advisory. You remain the decision-maker.</p></section>
        <section className="rounded-[26px] border border-[#D9D7CF] bg-white p-6 md:p-8">
          {running ? <div className="flex min-h-[480px] flex-col justify-center"><MicroLabel>NightWatch is working</MicroLabel><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.04em]">Challenging the obvious answer.</h2><div className="mt-8 space-y-3">{['Collecting market context','Building bull and bear cases','Reviewing risk conditions','Searching historical analogues','Chief critic weighing evidence'].map((s,i) => <div key={s} className="flex items-center gap-3 border-b border-[#E7E5DE] py-3"><span className={`h-2 w-2 rounded-full ${i<2 ? 'bg-[#0D7A4F]' : 'shimmer-bar'}`} /><span className="text-[13px]">{s}</span></div>)}</div></div> : complete && <><div className="flex items-center justify-between"><div><MicroLabel>NightWatch report</MicroLabel><div className="mt-2 text-[12px] text-[#8A8A84]">Preview intelligence · live market price connected</div></div><VerdictPill tone="warn">Fragile</VerdictPill></div><div className="mt-8 grid gap-6 sm:grid-cols-[110px_1fr]"><ScoreRing score={58} size={96} label="resilience" /><div><h2 className="text-[28px] font-semibold tracking-[-0.04em]">Wait for confirmation.</h2><p className="mt-2 text-[14px] leading-6 text-[#55554F]">Momentum supports the long thesis, but the evidence is not yet strong enough to ignore overnight gap and crowding risk.</p></div></div><Hairline className="my-7" /><div className="grid gap-6 md:grid-cols-2"><div><div className="text-[12px] font-semibold text-[#0D7A4F]">What supports it</div><ul className="mt-3 space-y-2 text-[13px] leading-5 text-[#55554F]"><li>• Live price momentum remains positive.</li><li>• Relative strength is holding into the session.</li><li>• Broader risk pressure is not yet dominant.</li></ul></div><div><div className="text-[12px] font-semibold text-[#C93A3A]">What could break it</div><ul className="mt-3 space-y-2 text-[13px] leading-5 text-[#55554F]"><li>• Catalyst may already be partly priced in.</li><li>• Overnight liquidity can amplify reversals.</li><li>• A weaker Nasdaq open changes the setup.</li></ul></div></div><div className="mt-7 rounded-2xl bg-[#F4F3EF] p-5"><div className="flex items-center gap-2"><ShieldCheck size={16}/><span className="text-[13px] font-semibold">Invalidation condition</span></div><p className="mt-2 text-[13px] leading-5 text-[#55554F]">Treat a loss of the current momentum structure plus a broad index reversal as evidence that the thesis needs to be rewritten.</p></div><div className="mt-6 flex flex-wrap gap-2"><ActionButton variant="accent" onClick={() => onNav('lab')}>Simulate the downside <FlaskConical size={14}/></ActionButton><ActionButton variant="secondary" onClick={() => onNav('arena')}>Battle it anyway <Swords size={14}/></ActionButton></div></>}
        </section>
      </div>
    </div>
  );
}

export function Lab({ onNav }: { onNav: Nav }) {
  const { assets } = useMarketData();
  const [prompt, setPrompt] = useState('What if Nasdaq falls 5% before the U.S. open?');
  const [severity, setSeverity] = useState(62);
  const [duration, setDuration] = useState('24H');
  const [runCount, setRunCount] = useState(1);
  const multiplier = severity / 62;
  const impact = useMemo(() => assets.slice(0, 4).map((a, i) => ({ asset: a, impact: [-7.8,-6.1,-3.4,-4.2][i] * multiplier })), [assets, multiplier]);
  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>MarketTwin · Scenario lab</MicroLabel><h1 className="mt-3 text-[44px] font-semibold tracking-[-0.055em] md:text-[60px]">Change one thing. <span className="serif-italic font-normal text-[#55554F]">Watch the market move.</span></h1><p className="mt-3 max-w-[680px] text-[14px] leading-6 text-[#55554F]">Explore hypothetical shocks before you commit to a thesis. Numbers shown here are scenario estimates, not forecasts.</p></div><MarketStatus /></div>
      <div className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-5 md:p-8"><div className="flex items-center gap-3 rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3"><FlaskConical size={18} /><input value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-transparent text-[15px] outline-none" /><button onClick={() => setRunCount((n)=>n+1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141412] text-white"><ArrowRight size={15}/></button></div><div className="mt-8 grid gap-7 lg:grid-cols-[1fr_260px]">
        <div className="relative min-h-[440px] overflow-hidden rounded-2xl bg-[#F4F3EF] p-6"><div className="flex items-center justify-between"><div><MicroLabel>Scenario #{runCount.toString().padStart(2,'0')}</MicroLabel><h2 className="mt-2 max-w-[580px] text-[25px] font-semibold tracking-[-0.035em]">{prompt}</h2></div><VerdictPill tone="neutral">{duration}</VerdictPill></div><div className="mt-10 grid gap-3 sm:grid-cols-2">{impact.map(({asset, impact: value}) => <div key={asset.symbol} className="rounded-2xl border border-[#E7E5DE] bg-white p-5"><div className="flex items-center justify-between"><span className="font-semibold">{asset.symbol}</span><span className="mono-num text-[19px] font-semibold text-[#C93A3A]">{value.toFixed(1)}%</span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#EDECE7]"><div className="h-full rounded-full bg-[#C93A3A]" style={{width:`${Math.min(95, Math.abs(value)*8)}%`}} /></div><p className="mt-4 text-[11.5px] text-[#8A8A84]">Current ${fmtPrice(asset.price)} · scenario stress</p></div>)}</div><div className="mt-6 text-[12px] leading-5 text-[#8A8A84]">This is an early scenario view using the available market data. Estimates are hypothetical and can be wrong.</div></div>
        <aside className="rounded-2xl border border-[#E7E5DE] p-5"><div className="flex items-center gap-2"><SlidersHorizontal size={15}/><span className="text-[13px] font-semibold">Scenario controls</span></div><div className="mt-7"><FieldLabel>Severity</FieldLabel><input type="range" min="20" max="100" value={severity} onChange={(e)=>setSeverity(Number(e.target.value))} className="w-full accent-[#141412]" /><div className="mt-2 flex justify-between text-[10px] text-[#8A8A84]"><span>Mild</span><span>Extreme</span></div></div><div className="mt-7"><FieldLabel>Duration</FieldLabel><div className="flex flex-wrap gap-1">{['1H','6H','24H','7D'].map(d=><SegButton key={d} active={duration===d} onClick={()=>setDuration(d)}>{d}</SegButton>)}</div></div><Hairline className="my-6" /><FieldLabel>Quick shocks</FieldLabel><div className="space-y-2">{scenarios.slice(0,4).map(s=><button key={s.id} onClick={()=>{setPrompt(s.label);setSeverity(s.severity);}} className="flex w-full items-center justify-between rounded-xl bg-[#F4F3EF] px-3 py-2.5 text-left text-[12px]"><span>{s.label}</span><ChevronRight size={13}/></button>)}</div><ActionButton onClick={()=>setRunCount((n)=>n+1)} className="mt-6 w-full">Run scenario</ActionButton></aside>
      </div></div><div className="mt-5 flex justify-end"><ActionButton variant="secondary" onClick={()=>onNav('arena')}>Take the thesis to Arena <ArrowRight size={14}/></ActionButton></div>
    </div>
  );
}

export function Arena({ onNav }: { onNav: Nav }) {
  const { assets } = useMarketData();
  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>Arena · Virtual capital</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">You have a thesis. <span className="serif-italic font-normal text-[#55554F]">Prove it.</span></h1><p className="mt-3 max-w-[640px] text-[14px] leading-6 text-[#55554F]">No deposit. No wallet. No real-money risk. Enter a virtual position and let real market prices settle the argument.</p></div><ActionButton onClick={()=>onNav('battle')}>Start a battle <Swords size={14}/></ActionButton></div>
      <section className="mt-8 grid gap-5 md:grid-cols-[.75fr_1.25fr]"><div className="rounded-[26px] bg-[#141412] p-6 text-white md:p-8"><MicroLabel className="text-white/45">Arena balance</MicroLabel><div className="mono-num mt-5 text-[46px] font-semibold tracking-[-0.05em]">$100,000</div><div className="mt-1 text-[12px] text-white/50">Virtual capital · zero deposit</div><div className="mt-10 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Live pairs</div><div className="mt-1 text-[15px] font-semibold">{assets.length}</div></div><div><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Mode</div><div className="mt-1 text-[15px] font-semibold">Paper only</div></div></div></div><div className="rounded-[26px] border border-[#E7E5DE] bg-white p-6 md:p-8"><div className="flex items-center justify-between"><MicroLabel>Featured battle</MicroLabel><VerdictPill tone="up"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-current"/> Live</VerdictPill></div><h2 className="mt-5 text-[27px] font-semibold tracking-[-0.04em]">{assets[0].symbol} · 24H Thesis Battle</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#F4F3EF] p-4"><div className="text-[11px] text-[#8A8A84]">You</div><div className="mt-2 flex items-center justify-between"><span className="font-semibold">LONG</span><span className="mono-num text-[#0D7A4F]">+3.12%</span></div></div><div className="rounded-2xl bg-[#F4F3EF] p-4"><div className="text-[11px] text-[#8A8A84]">NightWatch</div><div className="mt-2 flex items-center justify-between"><span className="font-semibold">WAIT</span><span className="mono-num">0.00%</span></div></div></div><p className="mt-5 text-[13px] leading-5 text-[#55554F]">“Partnership momentum carries through the overnight session.”</p><ActionButton variant="secondary" onClick={()=>onNav('battle')} className="mt-5">View live battle <ArrowRight size={14}/></ActionButton></div></section>
      <div className="mt-10 flex items-center justify-between"><h2 className="text-[20px] font-semibold">Open battles</h2><button onClick={()=>onNav('leaderboard')} className="text-[12px] font-medium text-[#1D3DFF]">View leaderboard</button></div><div className="mt-4 grid gap-4 md:grid-cols-3">{battles.map((b)=>{const live=assets.find(a=>a.symbol===b.asset);return <button key={b.id} onClick={()=>onNav('battle',{id:b.id})} className="rounded-[22px] border border-[#E7E5DE] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#D9D7CF]"><div className="flex items-center justify-between"><span className="font-semibold">{b.asset}</span><span className="text-[11px] text-[#8A8A84]">{b.timeLeft}</span></div><p className="mt-4 min-h-[60px] text-[13px] leading-5 text-[#55554F]">{b.thesis}</p><Hairline className="my-4" /><div className="flex items-center justify-between"><span className="text-[11px] font-medium">{b.userSide} vs {b.aiSide}</span>{live && <Pnl value={live.changePct} className="text-[11px]" />}</div></button>})}</div>
    </div>
  );
}

export function Battle({ onNav }: { onNav: Nav }) {
  const { assets } = useMarketData();
  const asset = assets[0];
  const entry = 181.2;
  const livePnl = ((asset.price-entry)/entry)*100;
  return (
    <div className="fade-up"><div className="flex items-center justify-between"><div><MicroLabel>Live battle · 24H</MicroLabel><h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em]">{asset.symbol} thesis battle</h1></div><VerdictPill tone="up"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-current"/> Live</VerdictPill></div><section className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-6 md:p-9"><div className="grid gap-5 md:grid-cols-[1fr_120px_1fr] md:items-center"><div className="battle-glow-you rounded-[22px] border border-[#1D3DFF]/20 bg-[#EEF0FF] p-6"><MicroLabel className="text-[#1D3DFF]">You</MicroLabel><div className="mt-4 text-[28px] font-semibold">LONG</div><div className="mt-1 text-[12px] text-[#55554F]">Entry ${fmtPrice(entry)}</div><Pnl value={livePnl} className="mt-6 block text-[30px]" /></div><div className="text-center"><div className="serif-italic text-[28px] text-[#8A8A84]">vs.</div><div className="mono-num mt-3 text-[11px] text-[#8A8A84]">5h 12m</div></div><div className="rounded-[22px] bg-[#F4F3EF] p-6"><MicroLabel>NightWatch</MicroLabel><div className="mt-4 text-[28px] font-semibold">WAIT</div><div className="mt-1 text-[12px] text-[#55554F]">No position</div><div className="mono-num mt-6 text-[30px] font-semibold">0.00%</div></div></div><Hairline className="my-8" /><div className="grid gap-7 md:grid-cols-[1fr_.8fr]"><div><MicroLabel>Thesis</MicroLabel><blockquote className="serif-italic mt-4 text-[26px] leading-9 text-[#2A2A28]">“Partnership momentum carries through the overnight session.”</blockquote></div><div><MicroLabel>Market now</MicroLabel><div className="mt-4 flex items-baseline gap-3"><span className="mono-num text-[28px] font-semibold">${fmtPrice(asset.price)}</span><Pnl value={asset.changePct}/></div><div className="mt-4 rounded-xl bg-[#F4F3EF] p-3"><Sparkline data={asset.spark} width={360} height={75} className="h-[75px] w-full" /></div></div></div><div className="mt-8 flex flex-wrap gap-2"><ActionButton variant="secondary" onClick={()=>onNav('nightwatch')}>Review NightWatch</ActionButton><ActionButton variant="secondary" onClick={()=>onNav('lab')}>Open MarketTwin</ActionButton></div></section></div>
  );
}

export function Leaderboard() {
  const [filter,setFilter] = useState<'all'|'human'|'ai'>('all');
  const rows = leaders.filter(l=>filter==='all'||l.type===filter);
  return <div className="fade-up"><MicroLabel>Leaderboard</MicroLabel><div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><h1 className="text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">Let results <span className="serif-italic font-normal text-[#55554F]">speak.</span></h1><p className="mt-3 text-[14px] text-[#55554F]">Virtual-capital performance ranked by settled market outcomes.</p></div><div className="flex gap-1 rounded-full bg-[#EDECE7] p-1">{(['all','human','ai'] as const).map(f=><SegButton key={f} active={filter===f} onClick={()=>setFilter(f)}>{f==='all'?'Everyone':f==='human'?'Humans':'AI'}</SegButton>)}</div></div><div className="mt-8 overflow-hidden rounded-[26px] border border-[#E7E5DE] bg-white"><div className="grid grid-cols-[48px_1fr_76px_70px] gap-3 border-b border-[#E7E5DE] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8A8A84] md:grid-cols-[60px_1fr_150px_90px_90px]"><span>#</span><span>Trader</span><span className="hidden md:block">Style</span><span className="text-right">Return</span><span className="text-right">Win</span></div>{rows.map(l=><div key={l.rank} className="grid grid-cols-[48px_1fr_76px_70px] items-center gap-3 border-b border-[#E7E5DE] px-5 py-4 last:border-0 md:grid-cols-[60px_1fr_150px_90px_90px]"><span className="mono-num text-[12px] text-[#8A8A84]">{String(l.rank).padStart(2,'0')}</span><div className="flex items-center gap-3"><EmptyAvatar name={l.name} ai={l.type==='ai'} /><div><div className="text-[13px] font-semibold">{l.name}</div><div className="mt-0.5 text-[10.5px] text-[#8A8A84]">{l.type==='ai'?'AI trader':'Human'}</div></div></div><span className="hidden text-[11px] text-[#55554F] md:block">{l.style}</span><Pnl value={l.returnPct} className="text-right text-[12px]"/><span className="mono-num text-right text-[12px]">{l.winRate}%</span></div>)}</div></div>;
}

export function Portfolio({ onNav }: { onNav: Nav }) {
  const { assets } = useMarketData();
  return <div className="fade-up"><div className="flex items-end justify-between"><div><MicroLabel>Portfolio · Virtual only</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">Your decisions, <span className="serif-italic font-normal text-[#55554F]">remembered.</span></h1></div><Wallet className="hidden text-[#D9D7CF] md:block" size={48} strokeWidth={1.2}/></div><div className="mt-8 grid gap-5 md:grid-cols-[.8fr_1.2fr]"><section className="rounded-[26px] bg-[#141412] p-7 text-white"><MicroLabel className="text-white/45">Virtual net value</MicroLabel><div className="mono-num mt-4 text-[48px] font-semibold">$112,408</div><div className="mono-num mt-1 text-[13px] text-[#77D7AA]">+12.4% all-time</div><div className="mt-9 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><div className="text-[10px] text-white/40">FREE</div><div className="mono-num mt-1 text-[15px]">$80.2k</div></div><div><div className="text-[10px] text-white/40">DEPLOYED</div><div className="mono-num mt-1 text-[15px]">$32.2k</div></div></div></section><section className="rounded-[26px] border border-[#E7E5DE] bg-white p-7"><MicroLabel>Open exposure</MicroLabel><div className="mt-5 space-y-4">{assets.slice(0,3).map((a,i)=><div key={a.symbol} className="flex items-center justify-between border-b border-[#E7E5DE] pb-4 last:border-0"><div><div className="text-[13px] font-semibold">{a.symbol}</div><div className="mt-1 text-[11px] text-[#8A8A84]">{i===0?'Battle position':'Watchlist / no position'}</div></div><div className="text-right"><div className="mono-num text-[13px]">${fmtPrice(a.price)}</div><Pnl value={a.changePct} className="text-[11px]"/></div></div>)}</div></section></div><section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-[20px] font-semibold">Decision history</h2><ActionButton variant="secondary" onClick={()=>onNav('arena')}>New battle</ActionButton></div><div className="mt-4 grid gap-3 md:grid-cols-3">{battles.map(b=><div key={b.id} className="rounded-2xl border border-[#E7E5DE] bg-white p-5"><div className="flex items-center justify-between"><span className="font-semibold">{b.asset}</span><span className="text-[10px] text-[#8A8A84]">{b.status}</span></div><p className="mt-3 text-[12px] leading-5 text-[#55554F]">{b.thesis}</p></div>)}</div></section></div>;
}

export function CreateTrader({ onNav }: { onNav: Nav }) {
  const [risk,setRisk]=useState(55); const [name,setName]=useState('Night Drift'); const [style,setStyle]=useState('Event-driven'); const [saved,setSaved]=useState(false);
  return <div className="fade-up"><MicroLabel>Create trader</MicroLabel><h1 className="mt-3 max-w-[780px] text-[45px] font-semibold tracking-[-0.055em] md:text-[60px]">Build a point of view, <span className="serif-italic font-normal text-[#55554F]">not a magic bot.</span></h1><p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#55554F]">Configure a virtual trading persona to challenge in the Arena. It does not receive real-money execution permissions.</p><div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.72fr]"><section className="rounded-[26px] border border-[#E7E5DE] bg-white p-6 md:p-8"><div><FieldLabel>Name</FieldLabel><input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3 text-[14px] outline-none focus:border-[#141412]"/></div><div className="mt-6"><FieldLabel>Style</FieldLabel><div className="flex flex-wrap gap-2">{['Event-driven','Momentum','Contrarian','Risk-first'].map(s=><SegButton key={s} active={style===s} onClick={()=>setStyle(s)}>{s}</SegButton>)}</div></div><div className="mt-6"><FieldLabel>Risk appetite · {risk}/100</FieldLabel><input type="range" min="10" max="90" value={risk} onChange={e=>setRisk(Number(e.target.value))} className="w-full accent-[#141412]"/><div className="mt-2 flex justify-between text-[10px] text-[#8A8A84]"><span>Conservative</span><span>Aggressive</span></div></div><div className="mt-6"><FieldLabel>Holding period</FieldLabel><div className="flex gap-2"><SegButton active>24H</SegButton><SegButton>7D</SegButton><SegButton>30D</SegButton></div></div><ActionButton onClick={()=>setSaved(true)} className="mt-7">Create virtual trader <Check size={14}/></ActionButton>{saved&&<div className="mt-4 text-[12px] font-medium text-[#0D7A4F]">Trader saved for this session.</div>}</section><aside className="rounded-[26px] bg-[#141412] p-7 text-white"><MicroLabel className="text-white/45">Preview</MicroLabel><div className="mt-8 flex items-center gap-4"><EmptyAvatar name={name} ai/><div><div className="text-[22px] font-semibold">{name}</div><div className="mt-1 text-[12px] text-white/50">Virtual AI opponent</div></div></div><div className="mt-8 space-y-4 border-t border-white/15 pt-6"><div className="flex justify-between text-[12px]"><span className="text-white/50">Style</span><span>{style}</span></div><div className="flex justify-between text-[12px]"><span className="text-white/50">Risk</span><span className="mono-num">{risk}/100</span></div><div className="flex justify-between text-[12px]"><span className="text-white/50">Capital</span><span className="mono-num">$100,000</span></div></div><button onClick={()=>onNav('arena')} className="mt-9 flex w-full items-center justify-between border-t border-white/15 pt-5 text-[13px]">Go to Arena <ArrowRight size={14}/></button></aside></div></div>;
}
