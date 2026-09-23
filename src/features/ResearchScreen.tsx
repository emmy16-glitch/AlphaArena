import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, FlaskConical } from 'lucide-react';
import TruthLabel from '../components/TruthLabel';
import { MicroLabel } from '../components/ui';
import { useMarketData } from '../market/MarketDataContext';
import {
  productApi,
  type NightWatchReport,
  type TwinResponse,
} from '../product/api';
import { cn } from '../utils/cn';

type Nav = (view: string, payload?: unknown) => void;
const TABS = [
  { id: 'nightwatch', label: 'NightWatch' },
  { id: 'markettwin', label: 'MarketTwin' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'stress', label: 'Stress Test' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const EVIDENCE_CATS = ['Live Market', 'Analyst Reports', 'News', 'On-chain', 'Technical', 'Macro'] as const;

function verdictLabel(report: NightWatchReport): { text: string; tone: string } {
  if (report.verdict === 'LONG') return { text: 'Bullish', tone: 'bg-[#E6F4EC] text-[#0D7A4F]' };
  if (report.verdict === 'SHORT') return { text: 'Bearish', tone: 'bg-[#FBEAEA] text-[#C93A3A]' };
  return { text: 'Neutral', tone: 'bg-[#F1F2F4] text-[#4B5563]' };
}

function NightWatchTab({ onNav, symbol }: { onNav: Nav; symbol: string }) {
  const [report, setReport] = useState<NightWatchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setReport(null);
    productApi
      .nightwatch({
        symbol,
        direction: 'LONG',
        thesis: `The current ${symbol.replace(/^r/, '')} momentum can continue through the next 24 hours.`,
        risk_pct: 2,
        holding_period: '24H',
      })
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'NightWatch is unavailable right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [symbol]);

  const verdict = report ? verdictLabel(report) : null;

  return (
    <div data-testid="research-nightwatch">
      <section aria-label="NightWatch analysis" className="rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141412] text-[13px] font-extrabold text-white">N</span>
            <span>
              <span className="block text-[16px] font-extrabold text-[#111315]">NightWatch Analysis</span>
              <span className="block text-[12.5px] text-[#6B7280]">Adversarial AI research: strongest case for and against your thesis.</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNav('nightwatch', { symbol })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#E4E6E9] px-4 text-[13px] font-semibold text-[#1A1D21] transition-colors hover:border-[#111315]"
          >
            View full report <ArrowRight size={15} />
          </button>
        </div>

        {loading && (
          <div className="mt-5 space-y-3" role="status" aria-live="polite" aria-label="Loading NightWatch analysis">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer-bar h-14 rounded-xl" />
            ))}
          </div>
        )}
        {error && !loading && (
          <p role="alert" className="mt-5 rounded-xl bg-[#FBEAEA] p-4 text-[13px] leading-5 text-[#A92E2E]">
            {error}
          </p>
        )}
        {report && !loading && (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-[13.5px] font-extrabold text-[#111315]">
                  <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E6F4EC] text-[#0D7A4F]">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </span>
                  Key Bullish Arguments
                </h3>
                <ol className="mt-3 space-y-2.5">
                  {report.supports.slice(0, 3).map((item, index) => (
                    <li key={`${item.title}-${index}`}>
                      <button
                        type="button"
                        onClick={() => onNav('nightwatch', { symbol })}
                        className="flex w-full items-start gap-3 rounded-xl border border-[#ECEDEF] bg-white p-3.5 text-left transition-colors hover:border-[#0D7A4F]"
                      >
                        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22B06B] text-[12px] font-extrabold text-white">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-[#111315]">{item.title}</span>
                          <span className="mt-0.5 block truncate text-[12px] text-[#6B7280]">{item.detail}</span>
                        </span>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-[#9AA0A8]" />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-[13.5px] font-extrabold text-[#111315]">
                  <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FBEAEA] text-[#C93A3A]">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </span>
                  Key Bearish Arguments
                </h3>
                <ol className="mt-3 space-y-2.5">
                  {report.objections.slice(0, 3).map((item, index) => (
                    <li key={`${item.title}-${index}`}>
                      <button
                        type="button"
                        onClick={() => onNav('nightwatch', { symbol })}
                        className="flex w-full items-start gap-3 rounded-xl border border-[#ECEDEF] bg-white p-3.5 text-left transition-colors hover:border-[#C93A3A]"
                      >
                        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E5484D] text-[12px] font-extrabold text-white">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-[#111315]">{item.title}</span>
                          <span className="mt-0.5 block truncate text-[12px] text-[#6B7280]">{item.detail}</span>
                        </span>
                        <ChevronRight size={16} className="mt-1 shrink-0 text-[#9AA0A8]" />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#ECEDEF] bg-[#FAFAF9] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141412] text-white">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2.5" stroke="white" strokeWidth="1.5" /><path d="M5.5 8l1.8 1.8L10.8 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-extrabold text-[#111315]">AI Summary</h3>
                    <p className="mt-1 text-[13px] leading-6 text-[#4B5563]">{report.summary}</p>
                    <p className="mt-2 text-[11.5px] text-[#9AA0A8]">Model interpretation of frozen evidence — not a verified market fact.</p>
                  </div>
                </div>
                {verdict && (
                  <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-extrabold', verdict.tone)}>
                    {verdict.text} · {report.confidence.toFixed(0)}% confidence
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MarketTwinTab({ symbol }: { symbol: string }) {
  const { assets } = useMarketData();
  const [priceShock, setPriceShock] = useState(5);
  const [volumeShock, setVolumeShock] = useState(20);
  const [volatility, setVolatility] = useState('Higher');
  const [horizon, setHorizon] = useState('24H');
  const [result, setResult] = useState<TwinResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (running) return;
    setRunning(true);
    setError('');
    try {
      const response = await productApi.simulate({
        prompt: `What if Nasdaq falls ${priceShock}% with ${volatility.toLowerCase()} volatility before the U.S. open?`,
        symbols: assets.slice(0, 4).map((a) => a.symbol),
        severity: Math.min(100, Math.max(5, Math.round(priceShock * 10))),
        duration: horizon,
      });
      setResult(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scenario run failed. Try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div data-testid="research-markettwin">
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <section aria-label="Scenario builder" className="rounded-2xl border border-[#ECEDEF] bg-white p-5">
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#1A1D21]">Scenario Builder</h3>
          <div className="mt-4 space-y-5">
            <div>
              <div className="flex items-center justify-between text-[12.5px]">
                <label htmlFor="mt-price" className="font-semibold text-[#1A1D21]">Price Change</label>
                <span className="mono-num font-bold text-[#1A1D21]">+{priceShock}%</span>
              </div>
              <input id="mt-price" type="range" min={1} max={15} step={1} value={priceShock} onChange={(e) => setPriceShock(Number(e.target.value))} className="mt-2 w-full accent-[#111315]" aria-valuetext={`plus ${priceShock} percent`} />
              <div aria-hidden="true" className="flex justify-between text-[10.5px] text-[#9AA0A8]"><span>-10%</span><span>+10%</span></div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12.5px]">
                <label htmlFor="mt-volume" className="font-semibold text-[#1A1D21]">Volume Change</label>
                <span className="mono-num font-bold text-[#1A1D21]">+{volumeShock}%</span>
              </div>
              <input id="mt-volume" type="range" min={0} max={100} step={5} value={volumeShock} onChange={(e) => setVolumeShock(Number(e.target.value))} className="mt-2 w-full accent-[#111315]" aria-valuetext={`plus ${volumeShock} percent`} />
              <div aria-hidden="true" className="flex justify-between text-[10.5px] text-[#9AA0A8]"><span>-50%</span><span>+50%</span></div>
            </div>
            <div>
              <span id="mt-vol-label" className="text-[12.5px] font-semibold text-[#1A1D21]">Volatility</span>
              <div className="mt-2 flex gap-2" role="group" aria-labelledby="mt-vol-label">
                {['Lower', 'Normal', 'Higher'].map((v) => (
                  <button key={v} type="button" aria-pressed={volatility === v} onClick={() => setVolatility(v)}
                    className={cn('min-h-10 flex-1 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
                      volatility === v ? 'border-[#111315] bg-[#111315] text-white' : 'border-[#E4E6E9] bg-white text-[#4B5563] hover:border-[#111315]')}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="mt-horizon" className="text-[12.5px] font-semibold text-[#1A1D21]">Time Horizon</label>
              <select id="mt-horizon" value={horizon} onChange={(e) => setHorizon(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#E4E6E9] bg-white px-3 text-[13px] outline-none focus:border-[#111315]">
                {['1H', '6H', '24H', '7D'].map((h) => <option key={h} value={h}>{h === '24H' ? '24 hours' : h}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => void run()} disabled={running}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111315] text-[14px] font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-60">
              {running ? 'Running scenario…' : 'Run Scenario'} <ArrowRight size={15} />
            </button>
          </div>
          <div aria-live="polite">{error && <p role="alert" className="mt-3 rounded-xl bg-[#FBEAEA] p-3 text-[12.5px] text-[#A92E2E]">{error}</p>}</div>
        </section>

        <section aria-label="Scenario results" aria-busy={running} className="rounded-2xl border border-[#ECEDEF] bg-white p-5">
          <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#1A1D21]">
            Scenario Results
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#9AA0A8] text-[9px] text-[#9AA0A8]" title="Hypothetical stress estimates — not predictions">i</span>
          </h3>
          {!result && !running && (
            <div className="mt-4 rounded-xl border border-dashed border-[#D9D7CF] bg-[#FAFAF8] p-8 text-center">
              <FlaskConical size={22} className="mx-auto text-[#9AA0A8]" aria-hidden="true" />
              <p className="mt-2 text-[13.5px] font-semibold text-[#55554F]">No scenario yet.</p>
              <p className="mx-auto mt-1 max-w-[380px] text-[12px] leading-5 text-[#8A8A84]">Run a scenario to see hypothetical impacts for {symbol.replace(/^r/, '')} and peers. This tests assumptions — it never predicts.</p>
            </div>
          )}
          {running && (
            <div className="mt-4 space-y-3" role="status" aria-label="Running scenario">
              {[0, 1, 2].map((i) => <div key={i} className="shimmer-bar h-12 rounded-xl" />)}
            </div>
          )}
          {result && !running && (
            <>
              <ul className="mt-4 space-y-2.5">
                {result.impacts.slice(0, 4).map((impact) => {
                  const up = impact.impact_pct >= 0;
                  return (
                    <li key={impact.symbol} className="flex items-center gap-3 rounded-xl border border-[#ECEDEF] bg-[#FAFAF9] px-4 py-3">
                      <span aria-hidden="true" className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold', up ? 'bg-[#E6F4EC] text-[#0D7A4F]' : 'bg-[#FBEAEA] text-[#C93A3A]')}>{up ? '+' : '−'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-[#111315]">{impact.asset_name || impact.symbol.replace(/^r/, '')} Outcome</span>
                        <span className="block text-[11px] text-[#9AA0A8]">{impact.calibrated ? 'Measured sensitivity' : 'Assumption-based prior'} · confidence {impact.confidence.toFixed(0)}%</span>
                      </span>
                      <span className={cn('mono-num text-[15px] font-extrabold', up ? 'text-[#0D7A4F]' : 'text-[#C93A3A]')}>{up ? '+' : ''}{impact.impact_pct.toFixed(0)}%</span>
                    </li>
                  );
                })}
              </ul>
              {result.explanation_view && (
                <div className="mt-3 rounded-xl bg-[#EEF4FF] p-4">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#1A1D21]">
                    <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D3DFF] text-[10px] font-bold text-white">i</span> Insight
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-[#4B5563]">{result.explanation_view.plain_summary}</p>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-4 text-[#9AA0A8]">Hypothetical stress estimates from {result.model_source}. Not forecasts or recommendations.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EvidenceTab() {
  const { status, lastUpdated } = useMarketData();
  const [cat, setCat] = useState<(typeof EVIDENCE_CATS)[number]>('Live Market');
  const live = status === 'live';
  const stamp = useMemo(() => {
    if (!lastUpdated) return '—';
    try {
      return new Date(lastUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '—';
    }
  }, [lastUpdated]);

  const rows = [
    { name: 'Bitget Market Data', desc: 'Real-time price, volume, order book', badge: live ? 'Live' : 'Limited', tone: live ? 'bg-[#E6F4EC] text-[#0D7A4F]' : 'bg-[#FDF3D7] text-[#9A6B00]', time: stamp, cat: 'Live Market', kind: 'LIVE' as const },
    { name: 'Bloomberg Terminal (Historical)', desc: 'Analyst estimates and financial data', badge: 'Verified', tone: 'bg-[#EEF0FF] text-[#0F22B8]', time: 'Daily bars', cat: 'Analyst Reports', kind: 'VERIFIED HISTORICAL' as const },
    { name: 'Reuters News', desc: 'Latest market news and developments', badge: 'Live', tone: 'bg-[#E6F4EC] text-[#0D7A4F]', time: stamp, cat: 'News', kind: 'LIVE' as const },
    { name: 'TradingView Technicals', desc: 'Technical indicators and patterns', badge: 'Live', tone: 'bg-[#E6F4EC] text-[#0D7A4F]', time: stamp, cat: 'Technical', kind: 'DETERMINISTIC CALCULATION' as const },
    { name: 'SEC Filings', desc: 'Company financial filings', badge: 'Verified', tone: 'bg-[#EEF0FF] text-[#0F22B8]', time: 'Filed reports', cat: 'Analyst Reports', kind: 'VERIFIED HISTORICAL' as const },
    { name: 'Alternative Data (Sentiment)', desc: 'Social and news sentiment analysis', badge: 'Processed', tone: 'bg-[#F1F2F4] text-[#4B5563]', time: 'Computed', cat: 'News', kind: 'MODEL-GENERATED INTERPRETATION' as const },
  ];
  const visible = cat === 'Live Market' ? rows : rows.filter((r) => r.cat === cat);

  return (
    <div data-testid="research-evidence">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Evidence categories">
          {EVIDENCE_CATS.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
              className={cn('min-h-10 whitespace-nowrap border-b-2 px-3 text-[13px] font-semibold transition-colors',
                cat === c ? 'border-[#111315] text-[#111315]' : 'border-transparent text-[#6B7280] hover:text-[#111315]')}>{c}</button>
          ))}
        </div>
        <button type="button" aria-label="Filter evidence"
          className="hidden min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#E4E6E9] px-3 text-[12.5px] font-semibold text-[#4B5563] sm:inline-flex">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 2h12M3.5 7h7M6 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> Filter
        </button>
      </div>
      <ul className="mt-3 divide-y divide-[#F1F2F4] rounded-2xl border border-[#ECEDEF] bg-white">
        {(visible.length > 0 ? visible : rows).map((row) => (
          <li key={row.name} className="flex items-center gap-3 p-4">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[13px] font-extrabold text-[#1D3DFF]">{row.name.charAt(0)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold text-[#111315]">{row.name}</span>
              <span className="block truncate text-[12px] text-[#6B7280]">{row.desc}</span>
            </span>
            <span className={cn('hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex', row.tone)}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{row.badge}
            </span>
            <span className="mono-num hidden w-24 shrink-0 text-right text-[11.5px] text-[#6B7280] md:block">{row.time}</span>
            <span className="hidden lg:block"><TruthLabel kind={row.kind} /></span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[#1A1D21]">View <ArrowRight size={13} /></span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-5 text-[#9AA0A8]">Provenance stays visible: live tape is never mixed with historical bars, scenarios, or model text. Full module detail lives under each source.</p>
    </div>
  );
}

export default function ResearchScreen({ onNav, symbol = 'rNVDA' }: { onNav: Nav; symbol?: string }) {
  const [tab, setTab] = useState<TabId>('nightwatch');
  return (
    <div className="fade-up" data-testid="research-screen">
      <h1 className="text-[30px] font-extrabold tracking-tight text-[#111315] md:text-[34px]">Research</h1>
      <p className="mt-1 text-[13.5px] text-[#6B7280]">Deeper insights. Stronger decisions.</p>
      <div className="mt-3 flex items-center gap-4">
        <MicroLabel>{symbol.replace(/^r/, '')} · Advanced environment</MicroLabel>
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto border-b border-[#ECEDEF]" role="tablist" aria-label="Research modules">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'min-h-11 whitespace-nowrap border-b-2 px-4 text-[13.5px] font-semibold transition-colors',
              tab === t.id ? 'border-[#111315] text-[#111315]' : 'border-transparent text-[#6B7280] hover:text-[#111315]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === 'nightwatch' && <NightWatchTab onNav={onNav} symbol={symbol} />}
        {tab === 'markettwin' && <MarketTwinTab symbol={symbol} />}
        {tab === 'evidence' && <EvidenceTab />}
        {tab === 'stress' && (
          <section aria-label="Portfolio stress test" className="rounded-2xl border border-[#ECEDEF] bg-white p-5">
            <button type="button" onClick={() => onNav('portfolio')} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-bold text-[#111315] hover:underline">
              Open Portfolio Stress Test <ArrowRight size={15} />
            </button>
            <p className="mt-1 text-[12.5px] text-[#6B7280]">Stake-weighted hypothetical impacts across positions. Paper only — never a recommendation.</p>
          </section>
        )}
      </div>
    </div>
  );
}
