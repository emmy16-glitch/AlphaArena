import { Suspense, lazy, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import ParticipantCard from '../components/ParticipantCard';
import TruthLabel from '../components/TruthLabel';
import { Sparkline } from '../components/ui';
import { useMarketData } from '../market/MarketDataContext';
import type { DecisionSession } from '../product/decisionSessions';
import { cn } from '../utils/cn';

const Arena = lazy(() =>
  import('./ArenaScreens').then((m) => ({ default: m.ArenaScreen })),
);
const Battle = lazy(() =>
  import('./ArenaScreens').then((m) => ({ default: m.BattleScreen })),
);

type Nav = (view: string, payload?: unknown) => void;

function riskBand(confidence: number | null | undefined): string | undefined {
  if (confidence == null) return undefined;
  if (confidence >= 68) return 'Low risk';
  if (confidence >= 55) return 'Moderate risk';
  return 'Elevated risk';
}

function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function settlementAt(capturedAt: string, horizonHours: number): string {
  try {
    const d = new Date(new Date(capturedAt).getTime() + horizonHours * 3_600_000);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

function LiveSessionPanel({ session }: { session: DecisionSession }) {
  const { assets } = useMarketData();
  const asset = useMemo(
    () => assets.find((a) => a.symbol === session.symbol) || assets[0],
    [assets, session.symbol],
  );
  const price = asset?.price ?? session.snapshot.price;
  const changePct = asset?.changePct ?? session.snapshot.change_pct_24h ?? 0;
  const up = changePct >= 0;
  const shortId = session.id.length > 9 ? `${session.id.slice(0, 4)}…${session.id.slice(-4)}` : session.id;
  const snapshotStamp = useMemo(() => {
    try {
      return new Date(session.snapshot.captured_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch {
      return session.snapshot.captured_at;
    }
  }, [session.snapshot.captured_at]);
  const lanes = ['human', 'nightwatch', 'qwen', 'baseline'];

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section aria-label="Session asset" className="rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#6B7280]">
                {session.symbol.replace(/^r/, '')} · {asset?.name || session.symbol}
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="mono-num text-[26px] font-extrabold tracking-tight text-[#111315]">
                  ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={cn('mono-num text-[13px] font-bold', up ? 'text-[#12925A]' : 'text-[#E5484D]')}>
                  {up ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EC] px-3 py-1.5 text-[11.5px] font-bold text-[#0D7A4F]">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              Live Session · {session.horizon_hours || 24}h session
            </span>
          </div>
          <div className="mt-3">
            <Sparkline data={asset?.spark?.length ? asset.spark.slice(-48) : session.snapshot.spark} width={640} height={110} className="h-[110px] w-full" />
          </div>
          <p className="mt-2 text-[11.5px] leading-5 text-[#6B7280]">
            Frozen thesis: “{session.thesis}”
          </p>
        </section>

        <aside aria-label="Session info" className="rounded-2xl border border-[#ECEDEF] bg-white p-5">
          <p className="text-[12px] font-semibold text-[#6B7280]">
            Session ID <span className="mono-num ml-1 font-bold text-[#111315]">{shortId}</span>
          </p>
          <dl className="mt-3 space-y-2.5 text-[12.5px]">
            {[
              ['Snapshot Time', `${snapshotStamp} UTC`],
              ['Horizon', `${session.horizon_hours || 24} hours`],
              ['Evidence Items', `${session.snapshot.spark.length} (Bitget + Global)`],
              ['Status', 'Live'],
              ['Time Elapsed', elapsedSince(session.snapshot.captured_at)],
              ['Est. Settlement', `${settlementAt(session.snapshot.captured_at, session.horizon_hours || 24)} UTC`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-[#6B7280]">{k}</dt>
                <dd className="mono-num truncate text-right font-semibold text-[#111315]" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mono-num mt-3 break-all text-[10.5px] text-[#9AA0A8]" data-testid="receipt-hash" title={session.receipt_hash}>
            receipt {session.receipt_hash.slice(0, 16)}…
          </p>
        </aside>
      </div>

      <section aria-label="Participants' decisions, frozen" className="rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
        <h2 className="text-[14px] font-extrabold text-[#111315]">Participants&apos; Decisions (Frozen)</h2>
        <p className="mt-1 text-[12px] text-[#6B7280]">Same snapshot · {snapshotStamp} UTC · no lane saw post-snapshot prices.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {lanes.map((lane) => {
            const p = session.participants[lane];
            if (!p) return null;
            return <ParticipantCard key={lane} lane={lane} participant={p} riskLabel={riskBand(p.confidence)} />;
          })}
        </div>
      </section>
    </div>
  );
}

export default function ArenaHubScreen({
  onNav,
  battleId,
  session,
  initialSymbol,
  initialThesis,
}: {
  onNav: Nav;
  battleId?: string;
  session?: DecisionSession | null;
  initialSymbol?: string;
  initialThesis?: string;
}) {
  return (
    <div className="fade-up" data-testid="arena-screen">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-[#111315] md:text-[34px]">Arena</h1>
          <p className="mt-1 text-[13.5px] text-[#6B7280]">Same snapshot. Different decisions. Let the market settle it.</p>
        </div>
        <button
          type="button"
          onClick={() => onNav('home')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#E4E6E9] bg-white px-4 text-[13px] font-semibold text-[#1A1D21] transition-colors hover:border-[#111315]"
        >
          <ArrowLeft size={15} /> Back to Home
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TruthLabel kind="PAPER" />
        <TruthLabel kind="LIVE" />
        {session && <TruthLabel kind="DETERMINISTIC CALCULATION" />}
      </div>

      {session && <LiveSessionPanel session={session} />}

      <div className="mt-5">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[#E7E5DE] bg-white px-5 py-4 text-[13px] text-[#8A8A84]" role="status">
              Loading Arena…
            </div>
          }
        >
          {battleId ? (
            <Battle onNav={onNav} battleId={battleId} />
          ) : session ? (
            <p className="rounded-2xl border border-dashed border-[#D9D7CF] bg-white p-5 text-center text-[13px] text-[#6B7280]">
              Settlement detail appears here once the battle record loads. Paper only — no real-money execution.
            </p>
          ) : (
            <Arena onNav={onNav} initialSymbol={initialSymbol} initialThesis={initialThesis} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
