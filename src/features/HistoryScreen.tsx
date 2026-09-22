import { lazy, Suspense, useState } from 'react';
import { MicroLabel, SegButton } from '../components/ui';

const DecisionTape = lazy(() => import('./DecisionTapePanel'));
const TrackRecord = lazy(() => import('./TrackRecordScreen'));
const Morgue = lazy(() => import('./MorgueScreen'));

type Nav = (view: string, payload?: unknown) => void;
const TABS = [
  { id: 'tape', label: 'Decision Tape' },
  { id: 'record', label: 'Track Record' },
  { id: 'morgue', label: 'Morgue' },
] as const;

export default function HistoryScreen({ onNav }: { onNav: Nav }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('tape');
  return (
    <div className="fade-up" data-testid="history-screen">
      <MicroLabel>History · Settled and verifiable</MicroLabel>
      <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] md:text-[50px]">
        Learn <span className="serif-italic font-normal text-[#55554F]">from the result.</span>
      </h1>
      <p className="mt-2 max-w-[620px] text-[13.5px] leading-6 text-[#55554F]">
        Chronological decisions from frozen snapshots, aggregated calibration, and dead theses with receipts.
        One observation never proves edge.
      </p>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="History sections">
        {TABS.map((t) => (
          <SegButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <span role="tab" aria-selected={tab === t.id}>
              {t.label}
            </span>
          </SegButton>
        ))}
      </div>
      <div className="mt-5">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[#E7E5DE] bg-white px-5 py-4 text-[13px] text-[#8A8A84]" role="status">
              Loading history…
            </div>
          }
        >
          {tab === 'tape' && <DecisionTape symbol="rNVDA" thesis="" thesisDirection="WAIT" />}
          {tab === 'record' && <TrackRecord onNav={onNav} />}
          {tab === 'morgue' && <Morgue onNav={onNav} />}
        </Suspense>
      </div>
    </div>
  );
}
