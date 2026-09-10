import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ChevronRight, CircleAlert, Clock, FlaskConical, RefreshCw,
  ShieldCheck, SlidersHorizontal, Swords, Trophy, Wallet, Zap,
} from 'lucide-react';
import { battles as previewBattles, leaders as previewLeaders, pulseItems, scenarios, fmtPrice } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import {
  BattleView, Direction, LeaderRow, NightWatchReport, PortfolioSummary, PulseEvent,
  SourceStatus, TwinResponse, productApi,
} from '../product/api';
import {
  ActionButton, EmptyAvatar, FieldLabel, Hairline, MicroLabel, Pnl, ScoreRing,
  SegButton, Sparkline, VerdictPill,
} from './ui';

type Nav = (view: string, payload?: unknown) => void;

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function sourceTone(value: string) {
  return value === 'connected' || value.includes('live') ? 'text-[#0D7A4F]' : value.includes('fallback') || value.includes('not-') ? 'text-[#9A6B00]' : 'text-[#55554F]';
}

function SourceStrip({ sources }: { sources?: SourceStatus }) {
  if (!sources) return null;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#E7E5DE] pt-4 text-[10px] uppercase tracking-[.12em] text-[#8A8A84]">
      {Object.entries(sources).map(([key, value]) => (
        <span key={key}>{key} <b className={`ml-1 font-medium normal-case tracking-normal ${sourceTone(value)}`}>{value}</b></span>
      ))}
    </div>
  );
}

function StatusDot({ live = true }: { live?: boolean }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#0D7A4F]' : 'bg-[#9A6B00]'}`} />;
}

export function ConnectedPulse({ onNav }: { onNav: Nav }) {
  const { assets, status, refresh } = useMarketData();
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try { setEvents(await productApi.pulse()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Pulse is unavailable'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const fallback: PulseEvent[] = pulseItems.map((p) => ({
    id: p.id, symbol: p.asset, severity: p.severity, title: p.title, summary: p.summary,
    score: p.score, tags: p.tags, detected_at: '',
  }));
  const rows = events.length ? events : fallback;
  const visible = rows.filter((p) => `${p.symbol} ${p.title} ${p.summary}`.toLowerCase().includes(query.toLowerCase()));
  const hero = events[0] || rows[0];
  const heroAsset = assets.find((a) => a.symbol === hero?.symbol) || assets[0];

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <MicroLabel>Pulse · NightWatch</MicroLabel>
          <h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] md:text-[56px]">What matters <span className="serif-italic font-normal text-[#55554F]">right now.</span></h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#55554F]">A quiet feed of measurable market changes worth investigating.</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#8A8A84]"><StatusDot live={events.length > 0} />{events.length ? 'Live detections' : 'Preview until API connects'}<button onClick={() => { void refresh(); void load(); }} className="ml-2 flex items-center gap-1 font-medium text-[#1D3DFF]"><RefreshCw size={12}/>Refresh</button></div>
      </div>

      <div className="mt-8 rounded-2xl border border-[#E7E5DE] bg-white px-4 py-3">
        <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search assets or market changes" className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#B9B7B0]" />
      </div>

      {hero && heroAsset && <section className="mt-6 overflow-hidden rounded-[26px] border border-[#D9D7CF] bg-white">
        <div className="grid gap-8 p-6 md:grid-cols-[1.2fr_.8fr] md:p-8">
          <div>
            <div className="flex items-center gap-2"><StatusDot /><span className="text-[12px] font-semibold">{hero.title}</span></div>
            <div className="mt-5 flex items-baseline gap-3"><span className="mono-num text-[38px] font-semibold">${fmtPrice(heroAsset.price)}</span><Pnl value={heroAsset.changePct} className="text-[15px]" /></div>
            <p className="mt-5 max-w-[620px] text-[14px] leading-6 text-[#55554F]">{hero.summary}</p>
            <div className="mt-6 flex flex-wrap gap-2">{hero.tags.map(tag=><VerdictPill key={tag} tone={hero.severity==='elevated'?'warn':'neutral'}>{tag}</VerdictPill>)}</div>
            <div className="mt-7 flex flex-wrap gap-2"><ActionButton onClick={()=>onNav('asset',{symbol:hero.symbol})}>Investigate <ArrowRight size={14}/></ActionButton><ActionButton variant="secondary" onClick={()=>onNav('lab',{symbol:hero.symbol})}>Simulate</ActionButton><ActionButton variant="secondary" onClick={()=>onNav('arena',{symbol:hero.symbol})}>Battle</ActionButton></div>
          </div>
          <div className="flex min-h-[220px] items-center rounded-2xl bg-[#F4F3EF] p-5"><Sparkline data={heroAsset.spark} width={420} height={180} className="h-[180px] w-full" /></div>
        </div>
      </section>}

      <div className="mt-10 flex items-center justify-between"><h2 className="text-[20px] font-semibold tracking-[-0.025em]">Signals worth a second look</h2><span className="text-[11px] text-[#8A8A84]">{loading ? 'Updating…' : events.length ? 'Derived from live Bitget Reality data' : 'Preview data'}</span></div>
      {error && <p className="mt-2 text-[11px] text-[#9A6B00]">Live Pulse unavailable: {error}. Showing design preview.</p>}
      <div className="mt-3 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">
        {visible.map((p) => {
          const asset = assets.find((a)=>a.symbol===p.symbol);
          return <button key={p.id} onClick={()=>onNav(p.symbol.startsWith('r')?'asset':'lab',{symbol:p.symbol})} className="grid w-full gap-4 py-6 text-left transition-opacity hover:opacity-70 md:grid-cols-[90px_1fr_auto] md:items-center"><div><MicroLabel>{p.score}/100</MicroLabel><div className="mt-2 text-[13px] font-semibold">{p.symbol}</div></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-semibold">{p.title}</h3>{p.severity==='elevated'&&<VerdictPill tone="warn">Elevated</VerdictPill>}</div><p className="mt-2 max-w-[760px] text-[13px] leading-5 text-[#55554F]">{p.summary}</p></div><div className="flex items-center gap-4">{asset&&<Pnl value={asset.changePct} className="text-[12px]"/>}<ChevronRight size={16} className="text-[#8A8A84]"/></div></button>;
        })}
      </div>
    </div>
  );
}

export function ConnectedNightWatch({ onNav, symbol = 'rNVDA' }: { onNav: Nav; symbol?: string }) {
  const { assets } = useMarketData();
  const asset = assets.find(a=>a.symbol===symbol) || assets[0];
  const [direction,setDirection] = useState<Direction>('LONG');
  const [risk,setRisk] = useState(2);
  const [thesis,setThesis] = useState(`The current ${asset.symbol} momentum can continue through the next 24 hours.`);
  const [report,setReport] = useState<NightWatchReport|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');

  const run = async () => {
    if (loading || thesis.trim().length < 8) return;
    setLoading(true); setError('');
    try { setReport(await productApi.nightwatch({symbol:asset.symbol,direction,thesis,risk_pct:risk,holding_period:'24H'})); }
    catch (e) { setError(e instanceof Error ? e.message : 'NightWatch failed'); }
    finally { setLoading(false); }
  };

  return <div className="fade-up">
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>NightWatch · Decision stress test</MicroLabel><h1 className="mt-3 text-[43px] font-semibold tracking-[-0.055em] md:text-[58px]">Put your thesis <span className="serif-italic font-normal text-[#55554F]">under pressure.</span></h1><p className="mt-3 max-w-[650px] text-[14px] leading-6 text-[#55554F]">Research, opposing arguments and deterministic stress tests. You remain the decision-maker.</p></div><div className="flex items-center gap-2 text-[12px] text-[#8A8A84]"><StatusDot/> {asset.symbol} · ${fmtPrice(asset.price)}</div></div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[.76fr_1.24fr]">
      <section className="rounded-[26px] border border-[#E7E5DE] bg-white p-6"><MicroLabel>Trade thesis</MicroLabel><div className="mt-6"><FieldLabel>Asset</FieldLabel><div className="flex items-center justify-between rounded-xl bg-[#F4F3EF] px-4 py-3"><span className="font-semibold">{asset.symbol}</span><Pnl value={asset.changePct} className="text-[12px]"/></div></div><div className="mt-5"><FieldLabel>Direction</FieldLabel><div className="flex gap-2">{(['LONG','SHORT','WAIT'] as Direction[]).map(d=><SegButton key={d} active={direction===d} onClick={()=>setDirection(d)}>{d}</SegButton>)}</div></div><div className="mt-5"><FieldLabel>Risk allocation · {risk.toFixed(1)}%</FieldLabel><input type="range" min="0.5" max="10" step="0.5" value={risk} onChange={e=>setRisk(Number(e.target.value))} className="w-full accent-[#141412]"/></div><div className="mt-5"><FieldLabel>Your thesis</FieldLabel><textarea value={thesis} onChange={e=>setThesis(e.target.value)} className="min-h-[150px] w-full resize-none rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] p-4 text-[14px] leading-6 outline-none focus:border-[#141412]"/></div><ActionButton onClick={()=>void run()} className="mt-5 w-full py-3">{loading?'Stress-testing…':'Stress-test my trade'} <Zap size={14}/></ActionButton>{error&&<p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}</section>
      <section className="rounded-[26px] border border-[#D9D7CF] bg-white p-6 md:p-8">
        {loading && <div className="flex min-h-[480px] flex-col justify-center"><MicroLabel>NightWatch is working</MicroLabel><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.04em]">Challenging the obvious answer.</h2><div className="mt-8 space-y-3">{['Collecting Bitget market context','Reading Vibe-Trading research','Checking Bitget Signal macro context','Building opposing cases','Running deterministic stress tests','Chief critic weighing evidence'].map((s,i)=><div key={s} className="flex items-center gap-3 border-b border-[#E7E5DE] py-3"><span className={`h-2 w-2 rounded-full ${i<2?'bg-[#0D7A4F]':'shimmer-bar'}`}/><span className="text-[13px]">{s}</span></div>)}</div></div>}
        {!loading && !report && <div className="flex min-h-[480px] flex-col justify-center"><MicroLabel>No verdict yet</MicroLabel><h2 className="mt-4 max-w-[520px] text-[34px] font-semibold tracking-[-0.045em]">NightWatch starts with your claim, not an AI prediction.</h2><p className="mt-4 max-w-[540px] text-[14px] leading-6 text-[#55554F]">Write the idea you actually believe. The engine will collect live evidence, find the strongest objection and show where the thesis stops being valid.</p></div>}
        {!loading && report && <><div className="flex items-center justify-between"><div><MicroLabel>NightWatch report</MicroLabel><div className="mt-2 text-[11px] text-[#8A8A84]">Evidence confidence {report.confidence}% · {report.risk_level} risk</div></div><VerdictPill tone={report.resilience>=70?'up':report.resilience<45?'down':'warn'}>{report.verdict}</VerdictPill></div><div className="mt-8 grid gap-6 sm:grid-cols-[112px_1fr]"><ScoreRing score={report.resilience} size={98} label="resilience"/><div><h2 className="text-[29px] font-semibold tracking-[-0.04em]">{report.headline}</h2><p className="mt-2 text-[14px] leading-6 text-[#55554F]">{report.summary}</p></div></div><Hairline className="my-7"/><div className="grid gap-7 md:grid-cols-2"><div><div className="text-[12px] font-semibold text-[#0D7A4F]">Strongest support</div><div className="mt-4 space-y-4">{report.supports.slice(0,3).map((x,i)=><div key={i}><div className="text-[13px] font-semibold">{x.title}</div><p className="mt-1 text-[12px] leading-5 text-[#55554F]">{x.detail}</p><div className="mt-1 text-[10px] text-[#8A8A84]">{x.source}</div></div>)}</div></div><div><div className="text-[12px] font-semibold text-[#C93A3A]">Strongest objection</div><div className="mt-4 space-y-4">{report.objections.slice(0,3).map((x,i)=><div key={i}><div className="text-[13px] font-semibold">{x.title}</div><p className="mt-1 text-[12px] leading-5 text-[#55554F]">{x.detail}</p><div className="mt-1 text-[10px] text-[#8A8A84]">{x.source}</div></div>)}</div></div></div><div className="mt-7 grid gap-3 sm:grid-cols-3">{report.stress_scenarios.map(s=><div key={s.name} className="rounded-2xl bg-[#F4F3EF] p-4"><div className="text-[11px] text-[#8A8A84]">{s.name}</div><div className={`mono-num mt-2 text-[20px] font-semibold ${s.impact_pct<0?'text-[#C93A3A]':'text-[#0D7A4F]'}`}>{s.impact_pct>0?'+':''}{s.impact_pct.toFixed(2)}%</div><p className="mt-2 text-[10.5px] leading-4 text-[#8A8A84]">{s.detail}</p></div>)}</div><div className="mt-7 rounded-2xl border border-[#E7E5DE] p-5"><div className="flex items-center gap-2"><ShieldCheck size={15}/><span className="text-[13px] font-semibold">Thesis invalidated if…</span></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-[#55554F]">{report.invalidation_conditions.map((x,i)=><li key={i}>• {x}</li>)}</ul></div><div className="mt-7"><MicroLabel>Adversarial council</MicroLabel><div className="mt-3 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">{report.agents.map(a=><div key={a.role} className="grid gap-2 py-3 sm:grid-cols-[130px_80px_1fr]"><span className="text-[12px] font-semibold">{a.role}</span><span className="mono-num text-[11px] text-[#8A8A84]">{a.confidence}%</span><span className="text-[12px] text-[#55554F]">{a.summary}</span></div>)}</div></div><SourceStrip sources={report.sources}/><div className="mt-6 flex flex-wrap gap-2"><ActionButton variant="accent" onClick={()=>onNav('lab',{symbol:asset.symbol,prompt:`What if Nasdaq falls 5% while I am ${direction.toLowerCase()} ${asset.symbol}?`})}>Simulate downside <FlaskConical size={14}/></ActionButton><ActionButton variant="secondary" onClick={()=>onNav('arena',{symbol:asset.symbol,thesis,aiSide:report.verdict})}>Battle it anyway <Swords size={14}/></ActionButton></div></>}
      </section>
    </div>
  </div>;
}

export function ConnectedLab({ onNav, initialPrompt }: { onNav: Nav; initialPrompt?: string }) {
  const { assets } = useMarketData();
  const [prompt,setPrompt] = useState(initialPrompt || 'What if Nasdaq falls 5% before the U.S. open?');
  const [severity,setSeverity] = useState(65);
  const [duration,setDuration] = useState('24H');
  const [result,setResult] = useState<TwinResponse|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const run = async () => { if(loading)return; setLoading(true);setError('');try{setResult(await productApi.simulate({prompt,symbols:assets.slice(0,6).map(a=>a.symbol),severity,duration}));}catch(e){setError(e instanceof Error?e.message:'Simulation failed');}finally{setLoading(false);} };
  return <div className="fade-up"><div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>MarketTwin · Scenario lab</MicroLabel><h1 className="mt-3 text-[44px] font-semibold tracking-[-0.055em] md:text-[60px]">Change one thing. <span className="serif-italic font-normal text-[#55554F]">Watch the market move.</span></h1><p className="mt-3 max-w-[680px] text-[14px] leading-6 text-[#55554F]">Stress-test a hypothetical world. The engine separates scenario estimates from forecasts.</p></div></div><div className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-5 md:p-8"><div className="flex items-center gap-3 rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3"><FlaskConical size={18}/><input value={prompt} onChange={e=>setPrompt(e.target.value)} className="w-full bg-transparent text-[15px] outline-none"/><button onClick={()=>void run()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141412] text-white"><ArrowRight size={15}/></button></div><div className="mt-8 grid gap-7 lg:grid-cols-[1fr_260px]"><div className="min-h-[450px] rounded-2xl bg-[#F4F3EF] p-6">{loading?<div className="flex min-h-[390px] items-center justify-center text-center"><div><MicroLabel>MarketTwin is calculating</MicroLabel><div className="serif-italic mt-4 text-[30px] text-[#55554F]">Testing a different world…</div></div></div>:result?<><div className="flex flex-wrap items-start justify-between gap-3"><div><MicroLabel>{result.shock.category} scenario</MicroLabel><h2 className="mt-2 max-w-[620px] text-[25px] font-semibold tracking-[-0.035em]">{result.prompt}</h2></div><VerdictPill tone="neutral">{result.duration}</VerdictPill></div><div className="mt-9 grid gap-3 sm:grid-cols-2">{result.impacts.map(x=><div key={x.symbol} className="rounded-2xl border border-[#E7E5DE] bg-white p-5"><div className="flex items-center justify-between"><span className="font-semibold">{x.symbol}</span><span className={`mono-num text-[20px] font-semibold ${x.impact_pct<0?'text-[#C93A3A]':'text-[#0D7A4F]'}`}>{x.impact_pct>0?'+':''}{x.impact_pct.toFixed(2)}%</span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#EDECE7]"><div className={x.impact_pct<0?'h-full rounded-full bg-[#C93A3A]':'h-full rounded-full bg-[#0D7A4F]'} style={{width:`${Math.min(95,Math.abs(x.impact_pct)*8)}%`}}/></div><div className="mono-num mt-3 text-[10px] text-[#8A8A84]">range {x.lower_pct.toFixed(2)}% → {x.upper_pct.toFixed(2)}% · confidence {x.confidence}%</div></div>)}</div><div className="mt-6 border-t border-[#D9D7CF] pt-5"><p className="text-[12.5px] leading-5 text-[#55554F]">{result.explanation}</p><div className="mt-3 text-[10px] text-[#8A8A84]">Model: {result.model_source}</div></div><SourceStrip sources={result.sources}/></>:<div className="flex min-h-[390px] flex-col justify-center"><MicroLabel>No scenario running</MicroLabel><h2 className="mt-4 max-w-[520px] text-[34px] font-semibold tracking-[-0.045em]">Ask a counterfactual the market can answer with numbers.</h2><p className="mt-4 max-w-[520px] text-[13px] leading-6 text-[#55554F]">Try an index shock, yield spike, earnings miss, liquidity event or a custom scenario.</p></div>}</div><aside className="rounded-2xl border border-[#E7E5DE] p-5"><div className="flex items-center gap-2"><SlidersHorizontal size={15}/><span className="text-[13px] font-semibold">Scenario controls</span></div><div className="mt-7"><FieldLabel>Severity · {severity}</FieldLabel><input type="range" min="10" max="100" value={severity} onChange={e=>setSeverity(Number(e.target.value))} className="w-full accent-[#141412]"/></div><div className="mt-7"><FieldLabel>Duration</FieldLabel><div className="flex flex-wrap gap-1">{['1H','6H','24H','7D'].map(d=><SegButton key={d} active={duration===d} onClick={()=>setDuration(d)}>{d}</SegButton>)}</div></div><Hairline className="my-6"/><FieldLabel>Quick shocks</FieldLabel><div className="space-y-2">{scenarios.slice(0,5).map(s=><button key={s.id} onClick={()=>{setPrompt(s.label);setSeverity(s.severity);}} className="flex w-full items-center justify-between rounded-xl bg-[#F4F3EF] px-3 py-2.5 text-left text-[12px]"><span>{s.label}</span><ChevronRight size={13}/></button>)}</div><ActionButton onClick={()=>void run()} className="mt-6 w-full">{loading?'Running…':'Run scenario'}</ActionButton>{error&&<p className="mt-3 text-[10.5px] text-[#C93A3A]">{error}</p>}</aside></div></div><div className="mt-5 flex justify-end"><ActionButton variant="secondary" onClick={()=>onNav('arena',{symbol:result?.impacts[0]?.symbol})}>Take the thesis to Arena <ArrowRight size={14}/></ActionButton></div></div>;
}

function remaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'settled';
  const hours = Math.floor(ms/3_600_000); const mins = Math.floor((ms%3_600_000)/60_000);
  return `${hours}h ${mins}m`;
}

export function ConnectedArena({ onNav, initialSymbol = 'rNVDA', initialThesis = '', initialAiSide = 'WAIT' }: { onNav: Nav; initialSymbol?: string; initialThesis?: string; initialAiSide?: Direction }) {
  const { assets } = useMarketData();
  const [rows,setRows] = useState<BattleView[]>([]);
  const [portfolio,setPortfolio] = useState<PortfolioSummary|null>(null);
  const [symbol,setSymbol] = useState(initialSymbol);
  const [side,setSide] = useState<Direction>('LONG');
  const [stake,setStake] = useState(10000);
  const [thesis,setThesis] = useState(initialThesis || 'The current market move will continue over the next 24 hours.');
  const [creating,setCreating] = useState(false);
  const [error,setError] = useState('');
  const load=async()=>{try{const [b,p]=await Promise.all([productApi.battles(),productApi.portfolio()]);setRows(b);setPortfolio(p);}catch{/* backend may not be running yet */}};
  useEffect(()=>{void load();},[]);
  const create=async()=>{if(creating)return;setCreating(true);setError('');try{const b=await productApi.createBattle({symbol,user_side:side,ai_side:initialAiSide,thesis,stake,duration_hours:24,opponent:'NightWatch'});await load();onNav('battle',{id:b.id});}catch(e){setError(e instanceof Error?e.message:'Could not create battle');}finally{setCreating(false);}};
  return <div className="fade-up"><div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><MicroLabel>Arena · Virtual capital</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">You have a thesis. <span className="serif-italic font-normal text-[#55554F]">Prove it.</span></h1><p className="mt-3 max-w-[650px] text-[14px] leading-6 text-[#55554F]">No deposit. No wallet. No real-money order. A virtual position is marked against real Bitget prices.</p></div></div><section className="mt-8 grid gap-5 lg:grid-cols-[.76fr_1.24fr]"><div className="rounded-[26px] bg-[#141412] p-7 text-white"><MicroLabel className="text-white/45">Virtual capital</MicroLabel><div className="mono-num mt-5 text-[46px] font-semibold">{money(portfolio?.net_value ?? 100000)}</div><div className="mt-1 text-[12px] text-white/50">{portfolio?.open_battles ?? 0} active battles · paper only</div><div className="mt-9 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><div className="text-[10px] text-white/40">FREE</div><div className="mono-num mt-1">{money(portfolio?.free_capital ?? 100000)}</div></div><div><div className="text-[10px] text-white/40">DEPLOYED</div><div className="mono-num mt-1">{money(portfolio?.deployed_capital ?? 0)}</div></div></div></div><div className="rounded-[26px] border border-[#E7E5DE] bg-white p-6 md:p-8"><div className="flex items-center justify-between"><MicroLabel>Start a 24H thesis battle</MicroLabel><Swords size={18}/></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><div><FieldLabel>Asset</FieldLabel><div className="flex flex-wrap gap-1">{assets.slice(0,6).map(a=><SegButton key={a.symbol} active={symbol===a.symbol} onClick={()=>setSymbol(a.symbol)}>{a.symbol}</SegButton>)}</div></div><div><FieldLabel>Your side</FieldLabel><div className="flex gap-1">{(['LONG','SHORT','WAIT'] as Direction[]).map(x=><SegButton key={x} active={side===x} onClick={()=>setSide(x)}>{x}</SegButton>)}</div></div></div><div className="mt-5"><FieldLabel>Virtual stake · {money(stake)}</FieldLabel><input type="range" min="1000" max="50000" step="1000" value={stake} onChange={e=>setStake(Number(e.target.value))} className="w-full accent-[#141412]"/></div><div className="mt-5"><FieldLabel>Thesis</FieldLabel><textarea value={thesis} onChange={e=>setThesis(e.target.value)} className="min-h-[100px] w-full resize-none rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] p-4 text-[13px] leading-5 outline-none"/></div><ActionButton onClick={()=>void create()} className="mt-5">{creating?'Entering…':'Enter battle'} <ArrowRight size={14}/></ActionButton>{error&&<p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}</div></section><div className="mt-10 flex items-center justify-between"><h2 className="text-[20px] font-semibold">Your battles</h2><button onClick={()=>onNav('leaderboard')} className="text-[12px] font-medium text-[#1D3DFF]">Leaderboard</button></div><div className="mt-4 grid gap-4 md:grid-cols-3">{rows.length?rows.map(b=><button key={b.id} onClick={()=>onNav('battle',{id:b.id})} className="rounded-[22px] border border-[#E7E5DE] bg-white p-5 text-left"><div className="flex items-center justify-between"><span className="font-semibold">{b.symbol}</span><span className="text-[10px] text-[#8A8A84]">{remaining(b.expires_at)}</span></div><p className="mt-4 min-h-[55px] text-[12px] leading-5 text-[#55554F]">{b.thesis}</p><Hairline className="my-4"/><div className="flex items-center justify-between"><span className="text-[11px]">{b.user_side} vs {b.ai_side}</span><Pnl value={b.user_pnl_pct} className="text-[11px]"/></div></button>):<div className="col-span-full rounded-[22px] border border-dashed border-[#D9D7CF] p-8 text-center text-[13px] text-[#8A8A84]">No real virtual battles yet. Create the first one above.</div>}</div></div>;
}

export function ConnectedBattle({ onNav, battleId }: { onNav: Nav; battleId?: string }) {
  const [battle,setBattle] = useState<BattleView|null>(null); const [error,setError]=useState('');
  useEffect(()=>{if(!battleId)return;let active=true;const load=async()=>{try{const b=await productApi.battle(battleId);if(active)setBattle(b);}catch(e){if(active)setError(e instanceof Error?e.message:'Battle unavailable');}};void load();const timer=window.setInterval(()=>void load(),15000);return()=>{active=false;window.clearInterval(timer);};},[battleId]);
  if(!battleId)return <div className="fade-up rounded-[26px] border border-[#E7E5DE] bg-white p-10"><MicroLabel>Arena</MicroLabel><h1 className="mt-4 text-[36px] font-semibold">No battle selected.</h1><ActionButton onClick={()=>onNav('arena')} className="mt-6">Open Arena</ActionButton></div>;
  if(!battle)return <div className="fade-up rounded-[26px] border border-[#E7E5DE] bg-white p-10"><MicroLabel>Live battle</MicroLabel><h1 className="mt-4 text-[34px] font-semibold">{error||'Loading the market…'}</h1></div>;
  return <div className="fade-up"><div className="flex items-center justify-between"><div><MicroLabel>Battle · {battle.status}</MicroLabel><h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em]">{battle.symbol} thesis battle</h1></div><VerdictPill tone={battle.status==='live'?'up':'neutral'}><StatusDot live={battle.status==='live'}/> {battle.status}</VerdictPill></div><section className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-6 md:p-9"><div className="grid gap-5 md:grid-cols-[1fr_120px_1fr] md:items-center"><div className="rounded-[22px] border border-[#1D3DFF]/20 bg-[#EEF0FF] p-6"><MicroLabel className="text-[#1D3DFF]">You</MicroLabel><div className="mt-4 text-[28px] font-semibold">{battle.user_side}</div><div className="mt-1 text-[12px] text-[#55554F]">Entry ${fmtPrice(battle.entry_price)} · {money(battle.stake)} virtual</div><Pnl value={battle.user_pnl_pct} className="mt-6 block text-[30px]"/></div><div className="text-center"><div className="serif-italic text-[28px] text-[#8A8A84]">vs.</div><div className="mono-num mt-3 text-[11px] text-[#8A8A84]">{remaining(battle.expires_at)}</div></div><div className="rounded-[22px] bg-[#F4F3EF] p-6"><MicroLabel>{battle.opponent}</MicroLabel><div className="mt-4 text-[28px] font-semibold">{battle.ai_side}</div><div className="mt-1 text-[12px] text-[#55554F]">Same market entry</div><Pnl value={battle.ai_pnl_pct} className="mt-6 block text-[30px]"/></div></div><Hairline className="my-8"/><div className="grid gap-7 md:grid-cols-[1fr_.75fr]"><div><MicroLabel>Thesis</MicroLabel><blockquote className="serif-italic mt-4 text-[26px] leading-9 text-[#2A2A28]">“{battle.thesis}”</blockquote></div><div><MicroLabel>Marked to Bitget</MicroLabel><div className="mono-num mt-4 text-[29px] font-semibold">${fmtPrice(battle.current_price)}</div><div className="mt-2 flex items-center gap-2 text-[11px] text-[#8A8A84]"><StatusDot/> refreshed from public Reality market data</div></div></div><div className="mt-8 flex gap-2"><ActionButton variant="secondary" onClick={()=>onNav('nightwatch',{symbol:battle.symbol})}>Review NightWatch</ActionButton><ActionButton variant="secondary" onClick={()=>onNav('lab',{prompt:`Stress ${battle.symbol} under a Nasdaq -5% scenario`})}>Open MarketTwin</ActionButton></div></section></div>;
}

export function ConnectedPortfolio({ onNav }: { onNav: Nav }) {
  const [summary,setSummary] = useState<PortfolioSummary|null>(null); const [rows,setRows]=useState<BattleView[]>([]);
  useEffect(()=>{void Promise.all([productApi.portfolio(),productApi.battles()]).then(([p,b])=>{setSummary(p);setRows(b);}).catch(()=>{});},[]);
  return <div className="fade-up"><div className="flex items-end justify-between"><div><MicroLabel>Portfolio · Virtual only</MicroLabel><h1 className="mt-3 text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">Your decisions, <span className="serif-italic font-normal text-[#55554F]">remembered.</span></h1></div><Wallet className="hidden text-[#D9D7CF] md:block" size={48} strokeWidth={1.2}/></div><div className="mt-8 grid gap-5 md:grid-cols-[.8fr_1.2fr]"><section className="rounded-[26px] bg-[#141412] p-7 text-white"><MicroLabel className="text-white/45">Virtual net value</MicroLabel><div className="mono-num mt-4 text-[48px] font-semibold">{money(summary?.net_value??100000)}</div><div className={`mono-num mt-1 text-[13px] ${(summary?.return_pct??0)>=0?'text-[#77D7AA]':'text-[#FF9A9A]'}`}>{(summary?.return_pct??0)>=0?'+':''}{(summary?.return_pct??0).toFixed(2)}%</div><div className="mt-9 grid grid-cols-2 gap-4 border-t border-white/15 pt-5"><div><div className="text-[10px] text-white/40">FREE</div><div className="mono-num mt-1">{money(summary?.free_capital??100000)}</div></div><div><div className="text-[10px] text-white/40">DEPLOYED</div><div className="mono-num mt-1">{money(summary?.deployed_capital??0)}</div></div></div></section><section className="rounded-[26px] border border-[#E7E5DE] bg-white p-7"><MicroLabel>Battle exposure</MicroLabel><div className="mt-5 space-y-4">{rows.length?rows.slice(0,5).map(b=><button key={b.id} onClick={()=>onNav('battle',{id:b.id})} className="flex w-full items-center justify-between border-b border-[#E7E5DE] pb-4 text-left last:border-0"><div><div className="text-[13px] font-semibold">{b.symbol} · {b.user_side}</div><div className="mt-1 text-[11px] text-[#8A8A84]">{money(b.stake)} · {b.status}</div></div><Pnl value={b.user_pnl_pct} className="text-[12px]"/></button>):<p className="text-[13px] text-[#8A8A84]">No virtual positions yet.</p>}</div></section></div><div className="mt-7"><ActionButton onClick={()=>onNav('arena')}>Start a battle <Swords size={14}/></ActionButton></div></div>;
}

export function ConnectedLeaderboard() {
  const [filter,setFilter]=useState<'all'|'human'|'ai'>('all'); const [rows,setRows]=useState<LeaderRow[]>([]); const [apiLive,setApiLive]=useState(false);
  useEffect(()=>{void productApi.leaderboard().then(x=>{setRows(x);setApiLive(true);}).catch(()=>{});},[]);
  const fallback:LeaderRow[]=previewLeaders.map(x=>({rank:x.rank,name:x.name,type:x.type,style:x.style,return_pct:x.returnPct,win_rate:x.winRate,battles:x.battles}));
  const data=(rows.length?rows:fallback).filter(x=>filter==='all'||x.type===filter);
  return <div className="fade-up"><MicroLabel>Leaderboard · {apiLive?'live virtual results':'preview until battles settle'}</MicroLabel><div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><h1 className="text-[46px] font-semibold tracking-[-0.055em] md:text-[62px]">Let results <span className="serif-italic font-normal text-[#55554F]">speak.</span></h1><p className="mt-3 text-[14px] text-[#55554F]">Virtual-capital performance ranked by market-marked outcomes.</p></div><div className="flex gap-1 rounded-full bg-[#EDECE7] p-1">{(['all','human','ai'] as const).map(f=><SegButton key={f} active={filter===f} onClick={()=>setFilter(f)}>{f==='all'?'Everyone':f==='human'?'Humans':'AI'}</SegButton>)}</div></div><div className="mt-8 overflow-hidden rounded-[26px] border border-[#E7E5DE] bg-white"><div className="grid grid-cols-[48px_1fr_76px_70px] gap-3 border-b border-[#E7E5DE] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8A8A84] md:grid-cols-[60px_1fr_150px_90px_90px]"><span>#</span><span>Trader</span><span className="hidden md:block">Style</span><span className="text-right">Return</span><span className="text-right">Win</span></div>{data.map(l=><div key={`${l.type}-${l.name}`} className="grid grid-cols-[48px_1fr_76px_70px] items-center gap-3 border-b border-[#E7E5DE] px-5 py-4 last:border-0 md:grid-cols-[60px_1fr_150px_90px_90px]"><span className="mono-num text-[12px] text-[#8A8A84]">{String(l.rank).padStart(2,'0')}</span><div className="flex items-center gap-3"><EmptyAvatar name={l.name} ai={l.type==='ai'}/><div><div className="text-[13px] font-semibold">{l.name}</div><div className="mt-0.5 text-[10.5px] text-[#8A8A84]">{l.battles} battles</div></div></div><span className="hidden text-[11px] text-[#55554F] md:block">{l.style}</span><Pnl value={l.return_pct} className="text-right text-[12px]"/><span className="mono-num text-right text-[12px]">{l.win_rate}%</span></div>)}</div></div>;
}
