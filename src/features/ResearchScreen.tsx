import { lazy, Suspense, useState } from 'react';
import TruthLabel from '../components/TruthLabel';
import { MicroLabel, SegButton } from '../components/ui';

const NightWatch = lazy(() => import('./NightWatchScreen'));
const MarketTwin = lazy(() => import('./MarketTwinScreen'));
const StressTest = lazy(() => import('./PortfolioStressTest'));

type Nav = (view: string, payload?: unknown) => void;
const TABS = [
  { id: 'nightwatch', label: 'NightWatch' },
  { id: 'markettwin', label: 'MarketTwin' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'stress', label: 'Portfolio Stress' },
] as const;

function EvidenceTab({ symbol }: { symbol: string }) {
  return (
    <div className="rounded-3xl border border-[#E7E5DE] bg-white p-6 md:p-8">
      <MicroLabel>Evidence · {symbol}</MicroLabel>
      <h2 className="mt-3 text-[24px] font-semibold tracking-tight">Provenance is the product.</h2>
      <p className="mt-2 max-w-[640px] text-[13.5px] leading-6 text-[#55554F]">
        AI text never overwrites deterministic calculations. Every number below keeps its source label.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          { name: 'Bitget Reality', desc: 'Current rToken market evidence — price, spread, tape.', kind: 'LIVE' as const },
          { name: 'Vibe-Trading evidence', desc: 'Historical U.S.-equity research and mechanical calibration.', kind: 'VERIFIED HISTORICAL' as const },
          { name: 'Bitget Signal context', desc: 'Macro and cross-asset context when available.', kind: 'MODEL-GENERATED INTERPRETATION' as const },
          { name: 'AlphaArena engine', desc: 'Market metrics, stress impacts, uncertainty and paper PnL.', kind: 'DETERMINISTIC CALCULATION' as const },
        ].map((row) => (
          <div key={row.name} className="rounded-2xl border border-[#E7E5DE] bg-[#FAF9F6] p-5">
            <div className="text-[14px] font-semibold">{row.name}</div>
            <p className="mt-1 text-[12.5px] leading-5 text-[#55554F]">{row.desc}</p>
            <div className="mt-3">
              <TruthLabel kind={row.kind} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12px] leading-5 text-[#8A8A84]">
        Scenario outputs are counterfactuals, never predictions. Paper outcomes are virtual, never real-money returns.
      </p>
    </div>
  );
}

export default function ResearchScreen({ onNav, symbol = 'rNVDA' }: { onNav: Nav; symbol?: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('nightwatch');
  return (
    <div className="fade-up" data-testid="research-screen">
      <MicroLabel>Research · Advanced environment</MicroLabel>
      <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.05em] md:text-[50px]">
        Challenge. <span className="serif-italic font-normal text-[#55554F]">Stress. Verify.</span>
      </h1>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Research modules">
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
              Loading research module…
            </div>
          }
        >
          {tab === 'nightwatch' && <NightWatch onNav={onNav} symbol={symbol} />}
          {tab === 'markettwin' && <MarketTwin onNav={onNav} />}
          {tab === 'evidence' && <EvidenceTab symbol={symbol} />}
          {tab === 'stress' && <StressTest />}
        </Suspense>
      </div>
    </div>
  );
}
