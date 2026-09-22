import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  Info,
  Lock,
  Search,
  Trophy,
} from 'lucide-react';
import ParticipantCard from '../components/ParticipantCard';
import RefusalCard from '../components/RefusalCard';
import { Sparkline } from '../components/ui';
import { useMarketData } from '../market/MarketDataContext';
import {
  HORIZONS,
  marketToCall,
  sessionApi,
  thesisDirectionToMarket,
  type DecisionSession,
  type ThesisDirection,
} from '../product/decisionSessions';
import { cn } from '../utils/cn';

type Nav = (view: string, payload?: unknown) => void;

const ASSET_NAMES: Record<string, string> = {
  rNVDA: 'NVIDIA Corporation',
  rTSLA: 'Tesla, Inc.',
  rAAPL: 'Apple Inc.',
  rMSFT: 'Microsoft Corporation',
  rAMD: 'Advanced Micro Devices',
  rQQQ: 'Nasdaq 100 Tracker',
};

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y'] as const;
const PROGRESS_STEPS = [
  'Freezing evidence…',
  'Running NightWatch…',
  'Running model analysis…',
  'Building deterministic baseline…',
  'Ready for Arena',
];

const HORIZON_LABELS: Record<string, string> = {
  '30m': '30 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '24h': '24 hours',
};

function NvdaMark() {
  return (
    <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F8F1]">
      <svg width="34" height="26" viewBox="0 0 34 26" fill="none">
        <path d="M2 13C6 5 12 2 17 2c8 0 13 5 15 11-2 6-7 11-15 11-5 0-11-3-15-11Z" fill="#76B900" />
        <path d="M7 13c3-4.5 6.5-6.5 10-6.5 4.5 0 7.5 2.5 9 6.5-1.5 4-4.5 6.5-9 6.5-3.5 0-7-2-10-6.5Z" fill="white" />
        <path d="M10 13c1.8-2.6 4-4 7-4 2.4 0 4 1.2 5 4-1 2.8-2.6 4-5 4-3 0-5.2-1.4-7-4Z" fill="#76B900" />
      </svg>
    </span>
  );
}

export default function HomeScreen({
  onNav,
  initialSymbol = 'rNVDA',
  onEnterArena,
}: {
  onNav: Nav;
  initialSymbol?: string;
  onEnterArena: (battleId: string, session: DecisionSession) => void;
}) {
  const { assets, status } = useMarketData();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('1D');
  const [thesis, setThesis] = useState('NVDA stays strong over the next 24 hours.');
  const [direction, setDirection] = useState<ThesisDirection>('Bullish');
  const [horizon, setHorizon] = useState<string>('24h');
  const [confidence, setConfidence] = useState(60);
  const [phase, setPhase] = useState(0);
  const [busy, setBusy] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<DecisionSession | null>(null);
  const busyRef = useRef(false);

  const asset = useMemo(
    () => assets.find((a) => a.symbol === symbol) || assets[0],
    [assets, symbol],
  );

  const chartData = useMemo(() => {
    const spark = asset.spark && asset.spark.length > 2 ? asset.spark : [0, 0];
    if (timeframe === '1D') return spark.slice(-28);
    if (timeframe === '1W') return spark.slice(-48);
    if (timeframe === '1M') return spark.slice(-64);
    if (timeframe === '3M') return spark.slice(-96);
    return spark;
  }, [asset, timeframe]);

  const snapshotFrozen = session != null;
  const snapshotStamp = session
    ? new Date(session.snapshot.captured_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  const testThesis = async () => {
    if (busyRef.current) return; // double-click / duplicate protection
    const text = thesis.trim();
    if (text.length < 8) {
      setError('Write your thesis first — a sentence with a direction and a horizon.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setSession(null);
    setPhase(0);
    // Staged UI feedback; the actual freeze happens in a single backend call
    // so no lane can observe post-snapshot prices.
    const ticker = window.setInterval(() => setPhase((p) => Math.min(p + 1, PROGRESS_STEPS.length - 2)), 900);
    try {
      const result = await sessionApi.create({
        symbol: asset.symbol,
        thesis: text,
        human_direction: thesisDirectionToMarket(direction),
        horizon,
        confidence,
        risk_pct: 2.0,
      });
      setSession(result);
      setPhase(PROGRESS_STEPS.length - 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not test the thesis. Try again.');
    } finally {
      window.clearInterval(ticker);
      busyRef.current = false;
      setBusy(false);
    }
  };

  const enterArena = async () => {
    if (!session || entering) return;
    setEntering(true);
    setError('');
    try {
      const result = await sessionApi.enterArena(session.id);
      onEnterArena(result.battle.id, result.session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enter the Arena yet.');
    } finally {
      setEntering(false);
    }
  };

  const lanes = ['human', 'nightwatch', 'qwen', 'baseline'];
  const price = asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const abs = (asset.changeAbs ?? (asset.price * asset.changePct) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const up = asset.changePct >= 0;

  return (
    <div className="fade-up" data-testid="home-screen">
      {/* Market + snapshot row */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section aria-label="Selected asset" className="rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <NvdaMark />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[30px] font-extrabold tracking-tight text-[#111315] md:text-[34px]">
                    {asset.symbol.replace(/^r/, '')}
                  </h1>
                  {['US Equities', 'Tech', 'Large Cap'].map((t) => (
                    <span key={t} className="rounded-full bg-[#F1F2F4] px-2.5 py-1 text-[11px] font-medium text-[#4B5563]">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-0.5 text-[13px] text-[#6B7280]">{ASSET_NAMES[asset.symbol] || asset.name || asset.symbol}</p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
                  <span className="mono-num text-[26px] font-extrabold tracking-tight text-[#111315] md:text-[30px]">${price}</span>
                  <span className={cn('mono-num text-[13.5px] font-bold', up ? 'text-[#12925A]' : 'text-[#E5484D]')}>
                    {up ? '+' : ''}{abs} ({up ? '+' : ''}{asset.changePct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-[#ECEDEF] bg-[#F7F8F9] p-1" role="group" aria-label="Chart timeframe">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={timeframe === t}
                  onClick={() => setTimeframe(t)}
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-[12.5px] font-semibold transition-colors',
                    timeframe === t ? 'bg-[#111315] text-white' : 'text-[#1A1D21] hover:bg-[#E9EBED]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Sparkline data={chartData} width={640} height={150} className="h-[150px] w-full" />
                <div aria-hidden="true" className="mt-1 flex justify-between text-[10.5px] text-[#9AA0A8]">
                  <span>09:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>16:00</span><span>19:30</span>
                </div>
              </div>
              <div aria-hidden="true" className="flex flex-col justify-between py-0.5 text-[10.5px] text-[#9AA0A8]">
                <span>885</span><span>870</span><span>855</span><span>840</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-[#9AA0A8]">
              Orientation chart from {status === 'live' ? 'observed Bitget Reality tape' : 'cached sample'} · {timeframe} view.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Choose asset">
            <Search size={14} className="text-[#9AA0A8]" />
            {assets.slice(0, 6).map((a) => (
              <button
                key={a.symbol}
                type="button"
                aria-pressed={a.symbol === asset.symbol}
                onClick={() => { setSymbol(a.symbol); setSession(null); setPhase(0); }}
                className={cn(
                  'min-h-9 rounded-full border px-3 text-[12px] font-semibold transition-colors',
                  a.symbol === asset.symbol
                    ? 'border-[#111315] bg-[#111315] text-white'
                    : 'border-[#E4E6E9] bg-white text-[#4B5563] hover:border-[#111315]',
                )}
              >
                {a.symbol.replace(/^r/, '')}
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Snapshot status" className="rounded-2xl border border-[#ECEDEF] bg-[#FBFAF7] p-5 md:p-6" data-testid="snapshot-card">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5E8C4] text-[#1A1D21]" aria-hidden="true">
                <Lock size={17} />
              </span>
              <span>
                <span className="block text-[15px] font-extrabold text-[#111315]">{snapshotFrozen ? 'Snapshot Frozen' : 'Snapshot not frozen yet'}</span>
                <span className="block text-[12px] text-[#6B7280]">{snapshotFrozen && session ? `${snapshotStamp} UTC` : 'Will freeze when Test Thesis begins'}</span>
              </span>
            </div>
            <Info size={16} className="mt-1 text-[#9AA0A8]" />
          </div>
          <div className="mt-4 space-y-3 text-[13px] text-[#1A1D21]">
            <p className="flex items-center gap-2.5">
              <Clock size={15} className="text-[#4B5563]" />
              {snapshotFrozen && session ? `${session.snapshot.spark.length} evidence points · frozen` : 'Evidence will freeze on Test Thesis'}
            </p>
            <p className="flex items-center gap-2.5">
              <ArrowUpRight size={15} className="text-[#4B5563]" />
              Bitget Reality + Global Sources
            </p>
          </div>
          {!snapshotFrozen && (
            <p className="mt-3 rounded-xl bg-white p-3 text-[12px] leading-5 text-[#6B7280]">
              Snapshot not frozen yet. The actual freeze happens only when Test Thesis begins.
            </p>
          )}
          <button
            type="button"
            onClick={() => onNav('research', { symbol: asset.symbol })}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-bold text-[#111315] hover:underline"
          >
            View evidence <ArrowRight size={15} />
          </button>
        </section>
      </div>

      {/* Thesis composer */}
      <section aria-label="Your thesis" className="mt-4 rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6" data-testid="thesis-composer">
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div>
            <h2 className="flex items-center gap-2 text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-[#1A1D21]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FBF3DC] text-[#8A6512]" aria-hidden="true">
                <FileText size={14} />
              </span>
              Your thesis
            </h2>
            <label htmlFor="thesis-input" className="sr-only">Write your market thesis</label>
            <div className="relative mt-3">
              <textarea
                id="thesis-input"
                value={thesis}
                onChange={(event) => setThesis(event.target.value)}
                rows={2}
                maxLength={280}
                placeholder="NVDA stays strong over the next 24 hours."
                className="min-h-[64px] w-full resize-y rounded-xl border border-[#E4E6E9] bg-white p-4 pr-16 text-[15px] text-[#111315] outline-none placeholder:text-[#9AA0A8] focus:border-[#111315]"
              />
              <span aria-hidden="true" className="absolute bottom-3 right-4 text-[11.5px] text-[#9AA0A8]">{thesis.length}/280</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Thesis direction">
                {(['Bullish', 'Bearish', 'Sideways'] as ThesisDirection[]).map((d) => {
                  const active = direction === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDirection(d)}
                      className={cn(
                        'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors',
                        d === 'Bullish' && active && 'border-transparent bg-[#D9F2E3] text-[#0B6B3F]',
                        d === 'Bearish' && active && 'border-transparent bg-[#FBDCDC] text-[#C92E2E]',
                        d === 'Sideways' && active && 'border-[#111315] bg-[#111315] text-white',
                        !active && 'border-[#E4E6E9] bg-white text-[#1A1D21] hover:border-[#111315]',
                      )}
                    >
                      <ArrowUpRight size={14} className={d === 'Bearish' ? 'text-[#E5484D]' : d === 'Bullish' ? 'text-[#12925A]' : ''} />
                      {d}
                    </button>
                  );
                })}
              </div>
              <label className="relative ml-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-[#E4E6E9] bg-white px-4 text-[13px] font-medium text-[#1A1D21]">
                <Clock size={15} className="text-[#4B5563]" />
                <span className="sr-only">Thesis horizon</span>
                <select
                  aria-label="Thesis horizon"
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  className="appearance-none bg-transparent pr-6 outline-none"
                >
                  {HORIZONS.map((h) => (
                    <option key={h} value={h}>{HORIZON_LABELS[h] || h}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 text-[#4B5563]" />
              </label>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label htmlFor="confidence" className="text-[11.5px] text-[#6B7280]">Your confidence · {confidence}%</label>
              <input
                id="confidence"
                aria-label="Your confidence"
                type="range"
                min={10}
                max={95}
                step={5}
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                className="h-1.5 w-40 accent-[#111315]"
              />
            </div>
          </div>
          <div className="flex flex-col justify-center border-t border-[#F1F2F4] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <button
              type="button"
              onClick={() => void testThesis()}
              disabled={busy}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#E3BA5E] to-[#C69A3F] text-[16px] font-extrabold text-[#1A1405] shadow-[0_6px_20px_rgba(198,154,63,0.35)] transition-transform hover:brightness-[1.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FlaskConical size={16} className="hidden" />
              {busy ? PROGRESS_STEPS[Math.min(phase, PROGRESS_STEPS.length - 2)] : 'Test Thesis'} <ArrowRight size={17} strokeWidth={2.4} />
            </button>
            <p className="mt-3 text-center text-[12px] leading-5 text-[#6B7280]">
              We'll freeze the market snapshot and get AI + human decisions on the same evidence.
            </p>
            {busy && (
              <div className="mt-1 text-center text-[11.5px] text-[#9AA0A8]" role="status" aria-live="polite">
                Step {Math.min(phase + 1, 4)} of 4 · no lane sees post-snapshot prices
              </div>
            )}
          </div>
        </div>
        <div aria-live="polite">
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-[#FBEAEA] p-3 text-[13px] leading-5 text-[#A92E2E]">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Same snapshot decisions */}
      <section aria-label="Same snapshot, different decisions" className="mt-4 rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-[#1A1D21]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FBF3DC] text-[#8A6512]" aria-hidden="true">
            <FileText size={14} />
          </span>
          Same snapshot. Different decisions.
        </h2>
        {!snapshotFrozen ? (
          <>
            <div className="mt-4 rounded-2xl border border-dashed border-[#D9D7CF] bg-[#FAFAF8] p-8 text-center" data-testid="decisions-pending">
              <p className="text-[14px] font-medium text-[#55554F]">No decisions yet.</p>
              <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] leading-5 text-[#8A8A84]">
                Test your thesis to freeze one market moment. Calls appear here only after the freeze — never before.
              </p>
            </div>
            <div className="mt-3 flex flex-col items-center rounded-2xl border border-[#ECEDEF] bg-[#FAFAF9] px-4 py-5 text-center" data-testid="arena-card">
              <Trophy size={30} className="text-[#D8A93C]" aria-hidden="true" />
              <p className="mt-2 text-[15px] font-extrabold text-[#111315]">Ready to go?</p>
              <p className="mt-1 text-[11.5px] leading-5 text-[#6B7280]">Enter Arena unlocks after Test Thesis freezes the snapshot.</p>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="mt-3 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#111315] text-[14px] font-bold text-white opacity-40"
              >
                Enter Arena <ArrowRight size={15} />
              </button>
              <p className="mt-2 text-[11px] text-[#6B7280]">The market will settle the argument.</p>
            </div>
          </>
        ) : (
          session && (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="decisions-ready">
                {lanes.map((lane) => (
                  <ParticipantCard key={lane} lane={lane} participant={session.participants[lane]} />
                ))}
                <div className="flex flex-col items-center rounded-2xl border border-[#ECEDEF] bg-[#FAFAF9] px-4 py-5 text-center" data-testid="arena-card">
                  <Trophy size={30} className="text-[#D8A93C]" aria-hidden="true" />
                  <p className="mt-2 text-[15px] font-extrabold text-[#111315]">Ready to go?</p>
                  <p className="mt-1 text-[11.5px] leading-5 text-[#6B7280]">
                    {session.ready_for_arena
                      ? 'All participants have made their decisions on the same snapshot.'
                      : 'Waiting for participant decisions on the frozen snapshot.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void enterArena()}
                    disabled={!session.ready_for_arena || entering}
                    aria-disabled={!session.ready_for_arena || entering}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111315] text-[14px] font-bold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {entering ? 'Entering…' : 'Enter Arena'} <ArrowRight size={15} />
                  </button>
                  <p className="mt-2 text-[11px] text-[#6B7280]">The market will settle the argument.</p>
                  <p className="mono-num mt-2 break-all text-[10px] text-[#9AA0A8]" data-testid="receipt-hash" title={session.receipt_hash}>
                    {session.receipt_hash.slice(0, 20)}…
                  </p>
                  <p className="mt-1 text-[10.5px] text-[#9AA0A8]">
                    Human call {marketToCall(session.participants.human?.direction)} · {session.participants.human?.confidence ?? '—'}%
                  </p>
                </div>
              </div>
              <p className="mono-num mt-3 hidden text-[11px] text-[#9AA0A8] sm:block" title={session.snapshot_hash}>
                {session.snapshot.id} · {session.snapshot_hash.slice(0, 12)}… · {marketToCall(session.participants.human?.direction)}
              </p>
            </>
          )
        )}
        {session?.refusal && (
          <div className="mt-4">
            <RefusalCard refusal={session.refusal} />
          </div>
        )}
      </section>

      {/* Evidence + stress */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onNav('research', { symbol: asset.symbol })}
          className="flex items-center gap-4 rounded-2xl border border-[#ECEDEF] bg-white p-5 text-left transition-colors hover:border-[#111315]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EDEFF3] text-[#1A1D21]" aria-hidden="true">
            <FileText size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-[#111315]">View Evidence</span>
            <span className="block truncate text-[12.5px] text-[#6B7280]">See the 24 sources and snapshot details</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-[#1A1D21]" />
        </button>
        <button
          type="button"
          onClick={() => onNav('research', { symbol: asset.symbol })}
          className="flex items-center gap-4 rounded-2xl border border-[#ECEDEF] bg-white p-5 text-left transition-colors hover:border-[#111315]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EDEFF3] text-[#1A1D21]" aria-hidden="true">
            <FlaskConical size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-[#111315]">Stress Test</span>
            <span className="block truncate text-[12.5px] text-[#6B7280]">See how the thesis performs under different scenarios</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-[#1A1D21]" />
        </button>
      </div>
    </div>
  );
}
