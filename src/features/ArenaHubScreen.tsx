import { lazy, Suspense } from 'react';
import TruthLabel from '../components/TruthLabel';
import { MicroLabel } from '../components/ui';
import type { DecisionSession } from '../product/decisionSessions';

const Arena = lazy(() =>
  import('./ArenaScreens').then((m) => ({ default: m.ArenaScreen })),
);
const Battle = lazy(() =>
  import('./ArenaScreens').then((m) => ({ default: m.BattleScreen })),
);

type Nav = (view: string, payload?: unknown) => void;

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
      <MicroLabel>Arena · Same-snapshot paper battle</MicroLabel>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TruthLabel kind="PAPER" />
        <TruthLabel kind="LIVE" />
        {session && <TruthLabel kind="DETERMINISTIC CALCULATION" />}
      </div>
      {session && (
        <section
          aria-label="Frozen decision context"
          className="mt-4 rounded-3xl border border-[#E7E5DE] bg-[#FAF9F6] p-5 text-[13px] leading-6 text-[#55554F]"
        >
          <span className="font-semibold text-[#141412]">“{session.thesis}”</span>
          <span className="mt-1 block">
            {session.symbol} · snapshot {new Date(session.snapshot.captured_at).toLocaleString()} · receipt{' '}
            <span className="mono-num break-all">{session.receipt_hash.slice(0, 16)}…</span>
          </span>
        </section>
      )}
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
          ) : (
            <Arena onNav={onNav} initialSymbol={initialSymbol} initialThesis={initialThesis} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
