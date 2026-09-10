import { useState } from 'react';
import { ArrowRight, FlaskConical, ShieldCheck, Swords, Zap } from 'lucide-react';
import { fmtPrice } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { Direction, NightWatchReport, SourceStatus, productApi } from '../product/api';
import { ActionButton, FieldLabel, Hairline, MicroLabel, Pnl, ScoreRing, SegButton, VerdictPill } from '../components/ui';

type Nav = (view: string, payload?: unknown) => void;

function sourceTone(value: string) {
  if (value === 'connected' || value.includes('live')) return 'text-[#0D7A4F]';
  if (value.includes('fallback') || value.includes('unavailable') || value.includes('not-')) return 'text-[#9A6B00]';
  return 'text-[#55554F]';
}

function Sources({ sources }: { sources: SourceStatus }) {
  return <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#E7E5DE] pt-4 text-[10px] uppercase tracking-[.12em] text-[#8A8A84]">{Object.entries(sources).map(([key, value]) => <span key={key}>{key}<b className={`ml-1 font-medium normal-case tracking-normal ${sourceTone(value)}`}>{value}</b></span>)}</div>;
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
    if (loading || thesis.trim().length < 8) return;
    setLoading(true);
    setError('');
    try {
      setReport(await productApi.nightwatch({ symbol: asset.symbol, direction, thesis: thesis.trim(), risk_pct: risk, holding_period: '24H' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'NightWatch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><MicroLabel>NightWatch · Decision stress test</MicroLabel><h1 className="mt-3 text-[43px] font-semibold tracking-[-0.055em] md:text-[58px]">Put your thesis <span className="serif-italic font-normal text-[#55554F]">under pressure.</span></h1><p className="mt-3 max-w-[650px] text-[14px] leading-6 text-[#55554F]">Live Bitget context, Vibe-Trading history, opposing arguments and deterministic stress tests. You remain the decision-maker.</p></div>
        <div className="flex items-center gap-3 text-[12px] text-[#8A8A84]"><span className="h-1.5 w-1.5 rounded-full bg-[#0D7A4F]" />{asset.symbol}<span className="mono-num text-[#141412]">${fmtPrice(asset.price)}</span></div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[.76fr_1.24fr]">
        <section className="rounded-[26px] border border-[#E7E5DE] bg-white p-6">
          <MicroLabel>Trade thesis</MicroLabel>
          <div className="mt-6"><FieldLabel>Asset</FieldLabel><div className="flex items-center justify-between rounded-xl bg-[#F4F3EF] px-4 py-3"><span className="font-semibold">{asset.symbol}</span><Pnl value={asset.changePct} className="text-[12px]" /></div></div>
          <div className="mt-5"><FieldLabel>Direction</FieldLabel><div className="flex flex-wrap gap-2">{(['LONG', 'SHORT', 'WAIT'] as Direction[]).map((item) => <SegButton key={item} active={direction === item} onClick={() => setDirection(item)}>{item}</SegButton>)}</div></div>
          <div className="mt-5"><FieldLabel>Risk allocation · {risk.toFixed(1)}%</FieldLabel><input aria-label="Risk allocation" type="range" min="0.5" max="10" step="0.5" value={risk} onChange={(event) => setRisk(Number(event.target.value))} className="w-full accent-[#141412]" /></div>
          <div className="mt-5"><FieldLabel>Your thesis</FieldLabel><textarea value={thesis} onChange={(event) => setThesis(event.target.value)} className="min-h-[160px] w-full resize-none rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] p-4 text-[14px] leading-6 outline-none focus:border-[#141412]" /></div>
          <ActionButton onClick={() => void run()} className="mt-5 w-full py-3">{loading ? 'Stress-testing…' : 'Stress-test my trade'} <Zap size={14} /></ActionButton>
          <p className="mt-3 text-[10.5px] leading-5 text-[#8A8A84]">Advisory analysis only. AlphaArena does not place real-money orders.</p>
          {error && <p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}
        </section>

        <section className="rounded-[26px] border border-[#D9D7CF] bg-white p-6 md:p-8">
          {loading && <div className="flex min-h-[500px] flex-col justify-center"><MicroLabel>NightWatch is working</MicroLabel><h2 className="mt-4 text-[32px] font-semibold tracking-[-0.04em]">Challenging the obvious answer.</h2><div className="mt-8 space-y-3">{['Collect Bitget Reality market context', 'Read Vibe-Trading history', 'Check Bitget Signal macro context', 'Build Bull / Bear / Risk cases', 'Run deterministic shocks', 'Chief Critic weighs evidence'].map((step, index) => <div key={step} className="flex items-center gap-3 border-b border-[#E7E5DE] py-3"><span className={`h-2 w-2 rounded-full ${index < 2 ? 'bg-[#0D7A4F]' : 'shimmer-bar'}`} /><span className="text-[13px]">{step}</span></div>)}</div></div>}

          {!loading && !report && <div className="flex min-h-[500px] flex-col justify-center"><MicroLabel>No verdict yet</MicroLabel><h2 className="mt-4 max-w-[520px] text-[34px] font-semibold tracking-[-0.045em]">NightWatch starts with your claim, not an AI prediction.</h2><p className="mt-4 max-w-[550px] text-[14px] leading-6 text-[#55554F]">Write the idea you believe. NightWatch tries to find the strongest objection, measures historical context where available and states what would invalidate the thesis.</p></div>}

          {!loading && report && <>
            <div className="flex items-start justify-between gap-4"><div><MicroLabel>NightWatch report</MicroLabel><div className="mt-2 text-[11px] text-[#8A8A84]">Evidence confidence {report.confidence}% · {report.risk_level} risk</div></div><VerdictPill tone={report.resilience >= 70 ? 'up' : report.resilience < 45 ? 'down' : 'warn'}>{report.verdict}</VerdictPill></div>
            <div className="mt-8 grid gap-6 sm:grid-cols-[112px_1fr]"><ScoreRing score={report.resilience} size={98} label="resilience" /><div><h2 className="text-[29px] font-semibold tracking-[-0.04em]">{report.headline}</h2><p className="mt-2 text-[14px] leading-6 text-[#55554F]">{report.summary}</p></div></div>
            <Hairline className="my-7" />
            <div className="grid gap-7 md:grid-cols-2">
              <div><div className="text-[12px] font-semibold text-[#0D7A4F]">Strongest support</div><div className="mt-4 space-y-4">{report.supports.slice(0, 4).map((item, index) => <div key={`${item.title}-${index}`}><div className="text-[13px] font-semibold">{item.title}</div><p className="mt-1 text-[12px] leading-5 text-[#55554F]">{item.detail}</p><div className="mt-1 text-[10px] text-[#8A8A84]">{item.source}</div></div>)}</div></div>
              <div><div className="text-[12px] font-semibold text-[#C93A3A]">Strongest objection</div><div className="mt-4 space-y-4">{report.objections.slice(0, 4).map((item, index) => <div key={`${item.title}-${index}`}><div className="text-[13px] font-semibold">{item.title}</div><p className="mt-1 text-[12px] leading-5 text-[#55554F]">{item.detail}</p><div className="mt-1 text-[10px] text-[#8A8A84]">{item.source}</div></div>)}</div></div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">{report.stress_scenarios.map((scenario) => <div key={scenario.name} className="rounded-2xl bg-[#F4F3EF] p-4"><div className="text-[11px] text-[#8A8A84]">{scenario.name}</div><div className={`mono-num mt-2 text-[22px] font-semibold ${scenario.impact_pct < 0 ? 'text-[#C93A3A]' : 'text-[#0D7A4F]'}`}>{scenario.impact_pct > 0 ? '+' : ''}{scenario.impact_pct.toFixed(2)}%</div><p className="mt-2 text-[10.5px] leading-4 text-[#8A8A84]">{scenario.detail}</p></div>)}</div>
            <div className="mt-7 rounded-2xl border border-[#E7E5DE] p-5"><div className="flex items-center gap-2"><ShieldCheck size={15} /><span className="text-[13px] font-semibold">Thesis invalidated if…</span></div><ul className="mt-3 space-y-2 text-[12px] leading-5 text-[#55554F]">{report.invalidation_conditions.map((condition) => <li key={condition}>• {condition}</li>)}</ul></div>
            {report.analogues.length > 0 && <div className="mt-7"><MicroLabel>Historical analogues</MicroLabel><div className="mt-3 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">{report.analogues.slice(0, 4).map((item) => <div key={`${item.label}-${item.outcome}`} className="py-4"><div className="text-[12px] font-semibold">{item.label}</div><div className="mt-1 text-[12px] text-[#55554F]">{item.outcome}</div><div className="mt-1 text-[10.5px] leading-4 text-[#8A8A84]">{item.relevance}</div></div>)}</div></div>}
            <Sources sources={report.sources} />
            <div className="mt-6 flex flex-wrap gap-2"><ActionButton variant="accent" onClick={() => onNav('lab', { prompt: `What if Nasdaq falls 5% while ${report.symbol} is trading?` })}>Simulate downside <FlaskConical size={14} /></ActionButton><ActionButton variant="secondary" onClick={() => onNav('arena', { symbol: report.symbol, thesis: report.thesis, aiSide: report.verdict })}>Battle the verdict <Swords size={14} /></ActionButton><ActionButton variant="ghost" onClick={() => onNav('asset', { symbol: report.symbol })}>Asset view <ArrowRight size={14} /></ActionButton></div>
          </>}
        </section>
      </div>
    </div>
  );
}
