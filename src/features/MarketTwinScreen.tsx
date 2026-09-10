import { useState } from 'react';
import { ArrowRight, FlaskConical, SlidersHorizontal } from 'lucide-react';
import { scenarios } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { TwinResponse, productApi } from '../product/api';
import { ActionButton, FieldLabel, Hairline, MicroLabel, SegButton, VerdictPill } from '../components/ui';

type Nav = (view: string, payload?: unknown) => void;

export default function MarketTwinScreen({ onNav, initialPrompt }: { onNav: Nav; initialPrompt?: string }) {
  const { assets } = useMarketData();
  const [prompt, setPrompt] = useState(initialPrompt || 'What if Nasdaq falls 5% before the U.S. open?');
  const [severity, setSeverity] = useState(62);
  const [duration, setDuration] = useState('24H');
  const [result, setResult] = useState<TwinResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (loading || prompt.trim().length < 3) return;
    setLoading(true);
    setError('');
    try {
      setResult(await productApi.simulate({ prompt: prompt.trim(), symbols: assets.slice(0, 6).map((asset) => asset.symbol), severity, duration }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'MarketTwin failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><MicroLabel>MarketTwin · Scenario lab</MicroLabel><h1 className="mt-3 text-[44px] font-semibold tracking-[-0.055em] md:text-[60px]">Change one thing. <span className="serif-italic font-normal text-[#55554F]">Watch the market move.</span></h1><p className="mt-3 max-w-[690px] text-[14px] leading-6 text-[#55554F]">Stress scenarios use Vibe-Trading historical beta when verified history exists, transparent priors otherwise, and live Bitget volatility to widen uncertainty. They are not forecasts.</p></div>
        <FlaskConical className="hidden text-[#D9D7CF] md:block" size={46} strokeWidth={1.2} />
      </div>

      <div className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-5 md:p-8">
        <div className="flex items-center gap-3 rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3"><FlaskConical size={18} /><input value={prompt} onChange={(event) => setPrompt(event.target.value)} className="w-full bg-transparent text-[15px] outline-none" /><button aria-label="Run scenario" onClick={() => void run()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141412] text-white"><ArrowRight size={15} /></button></div>
        {error && <p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}

        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_260px]">
          <section className="min-h-[440px] rounded-2xl bg-[#F4F3EF] p-5 md:p-6">
            {!result && !loading && <div className="flex min-h-[390px] flex-col justify-center"><MicroLabel>Scenario ready</MicroLabel><h2 className="mt-4 max-w-[620px] text-[30px] font-semibold tracking-[-0.04em]">Ask a falsifiable “what if?” instead of asking AI to predict the future.</h2><p className="mt-4 max-w-[600px] text-[13px] leading-6 text-[#55554F]">Example: Nasdaq -5%, yields +40bp, a liquidity freeze, an earnings miss, or a policy shock.</p></div>}
            {loading && <div className="flex min-h-[390px] flex-col justify-center"><MicroLabel>MarketTwin is running</MicroLabel><h2 className="mt-4 text-[30px] font-semibold tracking-[-0.04em]">Calibrating the shock.</h2><div className="mt-7 space-y-3">{['Parse the scenario', 'Read current Bitget volatility', 'Retrieve Vibe-Trading history', 'Measure QQQ sensitivity', 'Build uncertainty ranges'].map((step) => <div key={step} className="flex items-center gap-3 border-b border-[#DDDCD5] py-3"><span className="shimmer-bar h-2 w-2 rounded-full" /><span className="text-[13px]">{step}</span></div>)}</div></div>}
            {result && !loading && <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><MicroLabel>{result.shock.category} shock</MicroLabel><h2 className="mt-2 max-w-[630px] text-[25px] font-semibold tracking-[-0.035em]">{result.prompt}</h2><p className="mt-2 text-[11px] text-[#8A8A84]">Interpreted: {result.shock.driver} {result.shock.direction} {result.shock.magnitude}{result.shock.unit}</p></div><VerdictPill tone="neutral">{result.duration}</VerdictPill></div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">{result.impacts.map((impact) => <div key={impact.symbol} className="rounded-2xl border border-[#E7E5DE] bg-white p-5"><div className="flex items-center justify-between"><span className="font-semibold">{impact.symbol}</span><span className={`mono-num text-[20px] font-semibold ${impact.impact_pct < 0 ? 'text-[#C93A3A]' : 'text-[#0D7A4F]'}`}>{impact.impact_pct > 0 ? '+' : ''}{impact.impact_pct.toFixed(2)}%</span></div><div className="mt-4 text-[10.5px] text-[#8A8A84]">Range <span className="mono-num">{impact.lower_pct.toFixed(2)}% → {impact.upper_pct.toFixed(2)}%</span> · confidence {impact.confidence}%</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EDECE7]"><div className="h-full rounded-full bg-[#141412]" style={{ width: `${Math.min(96, Math.max(8, Math.abs(impact.impact_pct) * 8))}%` }} /></div>{impact.model && <div className="mt-3 text-[10px] text-[#8A8A84]">{impact.model}{typeof impact.beta_to_qqq === 'number' ? ` · β ${impact.beta_to_qqq.toFixed(2)}` : ''}</div>}</div>)}</div>
              <div className="mt-6 rounded-2xl border border-[#DDDCD5] bg-white/60 p-5"><MicroLabel>Why this moved</MicroLabel><p className="mt-3 text-[12px] leading-5 text-[#55554F]">{result.explanation}</p></div>
              {result.analogues.length > 0 && <div className="mt-6"><MicroLabel>Historical context</MicroLabel><div className="mt-2 divide-y divide-[#DDDCD5]">{result.analogues.slice(0, 3).map((item) => <div key={`${item.label}-${item.outcome}`} className="py-3"><div className="text-[12px] font-semibold">{item.label}</div><div className="mt-1 text-[11px] text-[#55554F]">{item.outcome}</div><div className="mt-1 text-[10px] leading-4 text-[#8A8A84]">{item.relevance}</div></div>)}</div></div>}
              <div className="mt-6 border-t border-[#DDDCD5] pt-4 text-[10px] text-[#8A8A84]">Model: {result.model_source}</div>
            </>}
          </section>

          <aside className="rounded-2xl border border-[#E7E5DE] p-5">
            <div className="flex items-center gap-2"><SlidersHorizontal size={15} /><span className="text-[13px] font-semibold">Scenario controls</span></div>
            <div className="mt-7"><FieldLabel>Severity · {severity}/100</FieldLabel><input aria-label="Scenario severity" type="range" min="10" max="100" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className="w-full accent-[#141412]" /></div>
            <div className="mt-7"><FieldLabel>Duration</FieldLabel><div className="flex flex-wrap gap-1">{['1H', '6H', '24H', '7D'].map((item) => <SegButton key={item} active={duration === item} onClick={() => setDuration(item)}>{item}</SegButton>)}</div></div>
            <Hairline className="my-6" />
            <FieldLabel>Quick shocks</FieldLabel><div className="space-y-2">{scenarios.slice(0, 5).map((scenario) => <button key={scenario.id} onClick={() => { setPrompt(scenario.label); setSeverity(scenario.severity); }} className="flex w-full items-center justify-between rounded-xl bg-[#F4F3EF] px-3 py-2.5 text-left text-[12px]"><span>{scenario.label}</span><ArrowRight size={12} /></button>)}</div>
            <ActionButton onClick={() => void run()} className="mt-6 w-full">{loading ? 'Running…' : 'Run scenario'}</ActionButton>
          </aside>
        </div>
      </div>
      {result && <div className="mt-5 flex justify-end"><ActionButton variant="secondary" onClick={() => onNav('arena', { symbol: result.impacts[0]?.symbol || 'rNVDA', thesis: result.prompt })}>Take it to Arena <ArrowRight size={14} /></ActionButton></div>}
    </div>
  );
}
