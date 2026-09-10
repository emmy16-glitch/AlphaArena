import { useState } from 'react';
import { ArrowRight, FlaskConical, SlidersHorizontal } from 'lucide-react';
import { scenarios } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { type TwinResponse, productApi } from '../product/api';
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
    if (loading) return;
    if (prompt.trim().length < 3) {
      setError('Describe one market change to simulate. For example: “Nasdaq falls 5%.”');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setResult(await productApi.simulate({ prompt: prompt.trim(), symbols: assets.slice(0, 6).map((asset) => asset.symbol), severity, duration }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'MarketTwin couldn’t finish this scenario. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><MicroLabel>MarketTwin · Scenario lab</MicroLabel><h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] sm:text-[48px] md:text-[60px]">Change one thing. <span className="serif-italic font-normal text-[#55554F]">See the stress.</span></h1><p className="mt-3 max-w-[720px] text-[15px] leading-6 text-[#55554F]">Describe a market shock. MarketTwin estimates how the tracked Reality assets could react using live Bitget context and historical calibration where Vibe-Trading has enough verified data. It is a stress test, not a forecast.</p></div>
        <FlaskConical className="hidden text-[#D9D7CF] md:block" size={46} strokeWidth={1.2} />
      </div>

      <div className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-5 md:p-8">
        <label className="micro-label text-[#8A8A84]" htmlFor="scenario-prompt">1 · What should change?</label>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3"><FlaskConical size={18} aria-hidden="true" /><input id="scenario-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" /><button disabled={loading} aria-label="Run scenario" onClick={() => void run()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#141412] text-white"><ArrowRight size={15} /></button></div>
        <div aria-live="polite">{error && <p className="mt-3 rounded-xl bg-[#FBEAEA] p-3 text-[13px] leading-5 text-[#A92E2E]">{error}</p>}</div>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_280px]">
          <section className="min-h-[440px] rounded-2xl bg-[#F4F3EF] p-5 md:p-6" aria-busy={loading}>
            {!result && !loading && <div className="flex min-h-[390px] flex-col justify-center"><MicroLabel>3 · Result appears here</MicroLabel><h2 className="mt-4 max-w-[620px] text-[30px] font-semibold tracking-[-0.04em]">Ask “what if?” instead of asking AI to predict the future.</h2><p className="mt-4 max-w-[610px] text-[14px] leading-6 text-[#55554F]">Try a Nasdaq drop, a yield spike, a liquidity shock or another clear event. You will get estimated impact ranges and the model source behind them.</p></div>}
            {loading && <div className="flex min-h-[390px] flex-col justify-center"><MicroLabel>3 · Building the stress test</MicroLabel><h2 className="mt-4 text-[30px] font-semibold tracking-[-0.04em]">Calibrating the shock.</h2><div className="mt-7 space-y-3">{['Understand the scenario', 'Read current Bitget volatility', 'Retrieve Vibe-Trading history', 'Measure QQQ sensitivity where available', 'Build uncertainty ranges'].map((step) => <div key={step} className="flex items-center gap-3 border-b border-[#DDDCD5] py-3"><span className="shimmer-bar h-2 w-2 rounded-full" /><span className="text-[13px]">{step}</span></div>)}</div></div>}
            {result && !loading && <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><MicroLabel>3 · {result.shock.category} stress</MicroLabel><h2 className="mt-2 max-w-[630px] text-[25px] font-semibold tracking-[-0.035em]">{result.prompt}</h2><p className="mt-2 text-[12px] text-[#8A8A84]">Read as: {result.shock.driver} {result.shock.direction} {result.shock.magnitude}{result.shock.unit}</p></div><VerdictPill tone="neutral">{result.duration}</VerdictPill></div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">{result.impacts.map((impact) => <div key={impact.symbol} className="rounded-2xl border border-[#E7E5DE] bg-white p-5"><div className="flex items-center justify-between gap-4"><span className="font-semibold">{impact.symbol}</span><span className={`mono-num text-[20px] font-semibold ${impact.impact_pct < 0 ? 'text-[#C93A3A]' : 'text-[#0D7A4F]'}`}>{impact.impact_pct > 0 ? '+' : ''}{impact.impact_pct.toFixed(2)}%</span></div><div className="mt-4 text-[12px] leading-5 text-[#8A8A84]">Estimated range <span className="mono-num">{impact.lower_pct.toFixed(2)}% → {impact.upper_pct.toFixed(2)}%</span><br />Evidence confidence {impact.confidence}%</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EDECE7]"><div className="h-full rounded-full bg-[#141412]" style={{ width: `${Math.min(96, Math.max(8, Math.abs(impact.impact_pct) * 8))}%` }} /></div>{impact.model && <div className="mt-3 text-[11px] leading-4 text-[#8A8A84]">Source: {impact.model}{typeof impact.beta_to_qqq === 'number' ? ` · historical β ${impact.beta_to_qqq.toFixed(2)}` : ''}</div>}</div>)}</div>
              <div className="mt-6 rounded-2xl border border-[#DDDCD5] bg-white/70 p-5"><MicroLabel>Why this moves</MicroLabel><p className="mt-3 text-[13px] leading-5 text-[#55554F]">{result.explanation}</p></div>
              {result.analogues.length > 0 && <div className="mt-6"><MicroLabel>Historical context</MicroLabel><div className="mt-2 divide-y divide-[#DDDCD5]">{result.analogues.slice(0, 3).map((item) => <div key={`${item.label}-${item.outcome}`} className="py-3"><div className="text-[12px] font-semibold">{item.label}</div><div className="mt-1 text-[12px] text-[#55554F]">{item.outcome}</div><div className="mt-1 text-[11px] leading-4 text-[#8A8A84]">{item.relevance}</div></div>)}</div></div>}
              <div className="mt-6 border-t border-[#DDDCD5] pt-4 text-[11px] leading-5 text-[#8A8A84]">Model source: {result.model_source}</div>
            </>}
          </section>

          <aside className="rounded-2xl border border-[#E7E5DE] p-5">
            <div className="flex items-center gap-2"><SlidersHorizontal size={15} /><span className="text-[13px] font-semibold">2 · Tune the stress</span></div>
            <div className="mt-7"><FieldLabel>Severity · {severity}/100</FieldLabel><input aria-label="Scenario severity" type="range" min="10" max="100" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} className="w-full accent-[#141412]" /></div>
            <div className="mt-7"><FieldLabel>Time horizon</FieldLabel><div className="flex flex-wrap gap-1">{['1H', '6H', '24H', '7D'].map((item) => <SegButton key={item} active={duration === item} onClick={() => setDuration(item)}>{item}</SegButton>)}</div></div>
            <Hairline className="my-6" />
            <FieldLabel>Try an example</FieldLabel><div className="space-y-2">{scenarios.slice(0, 5).map((scenario) => <button type="button" key={scenario.id} onClick={() => { setPrompt(scenario.label); setSeverity(scenario.severity); }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-[#F4F3EF] px-3 py-2.5 text-left text-[12px]"><span>{scenario.label}</span><ArrowRight size={12} /></button>)}</div>
            <ActionButton disabled={loading} onClick={() => void run()} className="mt-6 w-full">{loading ? 'Running…' : 'Run scenario'}</ActionButton>
          </aside>
        </div>
      </div>
      {result && <div className="mt-5 flex justify-end"><ActionButton variant="secondary" onClick={() => onNav('arena', { symbol: result.impacts[0]?.symbol || 'rNVDA', thesis: result.prompt })}>Use this in Arena <ArrowRight size={14} /></ActionButton></div>}
    </div>
  );
}
