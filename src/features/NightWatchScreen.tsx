import { useState } from 'react';
import { ArrowRight, FlaskConical, ShieldCheck, Swords, Zap } from 'lucide-react';
import { fmtPrice } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { type Direction, type NightWatchReport, type SourceStatus, productApi } from '../product/api';
import { ActionButton, FieldLabel, Hairline, MicroLabel, Pnl, ScoreRing, SegButton, VerdictPill } from '../components/ui';

type Nav = (view: string, payload?: unknown) => void;
const ASSET_NAMES: Record<string, string> = { rNVDA: 'Nvidia', rTSLA: 'Tesla', rAAPL: 'Apple', rMSFT: 'Microsoft', rAMD: 'AMD', rQQQ: 'Nasdaq 100 tracker' };
const directionLabel = (value: Direction) => value === 'LONG' ? 'Up' : value === 'SHORT' ? 'Down' : 'No position';

function sourceTone(value: string) {
  if (value === 'connected' || value.includes('live')) return 'text-[#0D7A4F]';
  if (value.includes('fallback') || value.includes('unavailable') || value.includes('not-')) return 'text-[#9A6B00]';
  return 'text-[#55554F]';
}

function Sources({ sources }: { sources: SourceStatus }) {
  const rows = [['Live market prices', sources.market], ['Historical market data', sources.vibe], ['Additional market information', sources.signal], ['Plain-language explanation', sources.qwen]] as const;
  const label = (value: string) => value === 'connected' || value.includes('live') ? 'Available' : value.includes('unavailable') ? 'Partially available' : 'Calculated from market data';
  return <details className="mt-6 border-t border-[#E7E5DE] pt-4"><summary className="cursor-pointer text-[12px] font-semibold text-[#55554F]">Evidence used and availability</summary><div className="mt-3 grid gap-2 text-[11px] text-[#8A8A84] sm:grid-cols-2">{rows.map(([key, value]) => <div key={key} className="flex items-center justify-between gap-3"><span>{key}</span><b className={`font-medium ${sourceTone(value)}`}>{label(value)}</b></div>)}</div></details>;
}

export default function NightWatchScreen({ onNav, symbol = 'rNVDA' }: { onNav: Nav; symbol?: string }) {
  const { assets } = useMarketData();
  const asset = assets.find((item) => item.symbol === symbol) || assets[0];
  const [direction, setDirection] = useState<Direction>('LONG');
  const [risk, setRisk] = useState(2);
  const [thesis, setThesis] = useState(`The current ${asset.symbol} momentum can continue through the next 24 hours.`);
  const [report, setReport] = useState<NightWatchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (loading) return;
    if (thesis.trim().length < 8) {
      setError('Give NightWatch a little more detail about why you expect this move.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await productApi.nightwatch({ symbol: asset.symbol, direction, thesis: thesis.trim(), risk_pct: risk, holding_period: '24H' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'NightWatch couldn’t finish this test. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><MicroLabel>NightWatch · Decision stress test</MicroLabel><h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] sm:text-[48px] md:text-[58px]">Put your thesis <span className="serif-italic font-normal text-[#55554F]">under pressure.</span></h1><p className="mt-3 max-w-[680px] text-[15px] leading-6 text-[#55554F]">Choose a direction, explain why you believe it, then let NightWatch look for the strongest reasons you may be wrong.</p></div>
        <div className="flex items-center gap-3 text-[12px] text-[#8A8A84]"><span className="h-1.5 w-1.5 rounded-full bg-[#0D7A4F]" />{ASSET_NAMES[asset.symbol] || asset.symbol}<span className="mono-num text-[#141412]">${fmtPrice(asset.price)}</span></div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[.76fr_1.24fr]">
        <section className="rounded-[26px] border border-[#E7E5DE] bg-white p-5 sm:p-6">
          <MicroLabel>1 · Your idea</MicroLabel>
          <div className="mt-6"><FieldLabel>Asset</FieldLabel><div className="flex items-center justify-between rounded-xl bg-[#F4F3EF] px-4 py-3"><span className="font-semibold">{ASSET_NAMES[asset.symbol] || asset.symbol}</span><Pnl value={asset.changePct} className="text-[12px]" /></div></div>
          <div className="mt-5"><FieldLabel>Which way do you think it may move?</FieldLabel><div className="flex flex-wrap gap-2">{(['LONG', 'SHORT', 'WAIT'] as Direction[]).map((item) => <SegButton key={item} active={direction === item} onClick={() => setDirection(item)}>{directionLabel(item)}</SegButton>)}</div><p className="mt-2 text-[12px] leading-5 text-[#8A8A84]">Up means you expect a rise. Down means you expect a fall. No position means you are not choosing a direction.</p></div>
          <div className="mt-5"><FieldLabel>Risk allocation · {risk.toFixed(1)}%</FieldLabel><input aria-label="Risk allocation" type="range" min="0.5" max="10" step="0.5" value={risk} onChange={(event) => setRisk(Number(event.target.value))} className="w-full accent-[#141412]" /><p className="mt-2 text-[12px] leading-5 text-[#8A8A84]">A higher allocation lowers the pressure-tolerance score. This only changes the stress test. No money is moved.</p></div>
          <div className="mt-5"><FieldLabel>Why do you believe it?</FieldLabel><textarea aria-label="Trade thesis" value={thesis} onChange={(event) => setThesis(event.target.value)} className="min-h-[160px] w-full resize-y rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] p-4 text-[14px] leading-6 outline-none focus:border-[#141412]" /></div>
          <ActionButton disabled={loading} onClick={() => void run()} className="mt-5 w-full py-3">{loading ? 'Stress-testing…' : 'Stress-test my idea'} <Zap size={14} /></ActionButton>
          <p className="mt-3 text-[12px] leading-5 text-[#8A8A84]">Analysis only. AlphaArena has no real-money order path.</p>
          <div aria-live="polite">{error && <p className="mt-3 rounded-xl bg-[#FBEAEA] p-3 text-[13px] leading-5 text-[#A92E2E]">{error}</p>}</div>
        </section>

        <section className="rounded-[26px] border border-[#D9D7CF] bg-white p-5 sm:p-6 md:p-8" aria-busy={loading}>
          {loading && <div className="flex min-h-[500px] flex-col justify-center"><MicroLabel>2 · Testing your idea</MicroLabel><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.04em]">Challenging the obvious answer.</h2><div className="mt-8 space-y-3">{['Read current market prices', 'Compare past market moves', 'Check broader market context', 'Build the strongest case for and against', 'Run pressure tests', 'Weigh the evidence'].map((step, index) => <div key={step} className="flex items-center gap-3 border-b border-[#E7E5DE] py-3"><span className={`h-2 w-2 rounded-full ${index < 2 ? 'bg-[#0D7A4F]' : 'shimmer-bar'}`} /><span className="text-[13px]">{step}</span></div>)}</div></div>}

          {!loading && !report && <div className="flex min-h-[500px] flex-col justify-center"><MicroLabel>2 · Result appears here</MicroLabel><h2 className="mt-4 max-w-[520px] text-[34px] font-semibold tracking-[-0.045em]">NightWatch tests your claim. It does not tell you what to buy.</h2><p className="mt-4 max-w-[560px] text-[15px] leading-6 text-[#55554F]">You will see the strongest support, strongest objection, stress scenarios and the conditions that would make your thesis fail.</p></div>}

          {!loading && report && <>
            <div className="flex items-start justify-between gap-4"><div><MicroLabel>3 · NightWatch result</MicroLabel><div className="mt-2 text-[12px] text-[#8A8A84]">Evidence strength: {report.confidence < 40 ? 'Limited' : report.confidence < 60 ? 'Mixed' : report.confidence < 80 ? 'Fairly strong, but not conclusive' : 'Stronger, but not a forecast'}</div></div><VerdictPill tone={report.resilience >= 70 ? 'up' : report.resilience < 45 ? 'down' : 'warn'}>{directionLabel(report.verdict)}</VerdictPill></div>
            <div className="mt-8 grid gap-6 sm:grid-cols-[112px_1fr]"><ScoreRing score={report.resilience} size={98} label="pressure tolerance" /><div><h2 className="text-[29px] font-semibold tracking-[-0.04em]">{report.headline}</h2><p className="mt-2 text-[14px] leading-6 text-[#55554F]">{report.summary}</p><p className="mt-3 text-[12px] leading-5 text-[#8A8A84]">This is an analysis of your idea, not a prediction or recommendation.</p></div></div>
            <Hairline className="my-7" />
            <div className="grid gap-7 md:grid-cols-2">
              <div><div className="text-[13px] font-semibold text-[#0D7A4F]">Why the idea might work</div><div className="mt-4 space-y-4">{report.supports.slice(0, 4).map((item, index) => <div key={`${item.title}-${index}`}><div className="text-[13px] font-semibold">{item.title}</div><p className="mt-1 text-[12px] leading-5 text-[#55554F]">{item.detail}</p></div>)}</div></div>
              <div><div className="text-[13px] font-semibold text-[#C93A3A]">The strongest reason it could be wrong</div><div className="mt-4 space-y-4">{report.objections.slice(0, 4).map((item, index) => <div key={`${item.title}-${index}`}><div className="text-[13px] font-semibold">{item.title}</div><p className="mt-1 text-[12px] leading-5 text-[#55554F]">{item.detail}</p></div>)}</div></div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">{report.stress_scenarios.map((scenario) => <div key={scenario.name} className="rounded-2xl bg-[#F4F3EF] p-4"><div className="text-[12px] text-[#8A8A84]">{scenario.name}</div><div className={`mono-num mt-2 text-[22px] font-semibold ${scenario.impact_pct < 0 ? 'text-[#C93A3A]' : 'text-[#0D7A4F]'}`}>{scenario.impact_pct > 0 ? '+' : ''}{scenario.impact_pct.toFixed(2)}%</div><p className="mt-2 text-[11px] leading-4 text-[#8A8A84]">{scenario.detail}</p></div>)}</div>
            <div className="mt-7 rounded-2xl border border-[#E7E5DE] p-5"><div className="flex items-center gap-2"><ShieldCheck size={15} /><span className="text-[13px] font-semibold">What would weaken this idea?</span></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-[#55554F]">{report.invalidation_conditions.map((condition) => <li key={condition}>• {condition}</li>)}</ul></div>
            {report.analogues.length > 0 && <div className="mt-7"><MicroLabel>Historical context</MicroLabel><p className="mt-2 text-[12px] leading-5 text-[#55554F]">These are previous moves that looked similar. They provide context only and are not predictions.</p><div className="mt-3 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">{report.analogues.slice(0, 4).map((item) => <div key={`${item.label}-${item.outcome}`} className="py-4"><div className="text-[12px] font-semibold">{item.label.replace(/T00:00:00(?:\.000)?Z?$/, '')}</div><div className="mt-1 text-[12px] text-[#55554F]">{item.outcome}</div><div className="mt-1 text-[11px] leading-4 text-[#8A8A84]">{item.relevance.replace(/analogue/gi, 'past example')}</div></div>)}</div></div>}
            <Sources sources={report.sources} />
            <div className="mt-6 flex flex-wrap gap-2"><ActionButton variant="accent" onClick={() => onNav('lab', { prompt: `What if Nasdaq falls 5% while ${report.symbol} is trading?` })}>Test a downside scenario <FlaskConical size={14} /></ActionButton><ActionButton variant="secondary" onClick={() => onNav('arena', { symbol: report.symbol, thesis: report.thesis, aiSide: report.verdict })}>Create a paper-only battle <Swords size={14} /></ActionButton><ActionButton variant="ghost" onClick={() => onNav('asset', { symbol: report.symbol })}>View asset details <ArrowRight size={14} /></ActionButton></div>
          </>}
        </section>
      </div>
    </div>
  );
}
