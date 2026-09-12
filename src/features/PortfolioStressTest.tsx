import { useMemo, useState } from 'react';
import { ArrowRight, Briefcase, ChevronDown, Minus, Plus } from 'lucide-react';
import ShowYourWork, { volatilitySentence, workSentence } from '../components/ShowYourWork';
import { useMarketData } from '../market/MarketDataContext';
import { type Direction, type PortfolioLeg, type PortfolioStressResponse, productApi } from '../product/api';
import { ActionButton, FieldLabel, MicroLabel, SegButton } from '../components/ui';

const SIDES: Direction[] = ['LONG', 'SHORT'];
const MAX_POSITIONS = 8;

type DraftPosition = { key: number; symbol: string; side: Direction; stake: string };

let nextKey = 1;

function fmtMoney(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function legName(leg: { asset_name?: string | null; symbol: string; side?: Direction; stake?: number }) {
  const side = leg.side ? ` ${leg.side}` : '';
  const stake = typeof leg.stake === 'number' ? ` $${leg.stake.toLocaleString('en-US')}` : '';
  return `${leg.asset_name || leg.symbol}${side}${stake}`;
}

function LegCard({ leg }: { leg: PortfolioLeg }) {
  const [open, setOpen] = useState(false);
  const dollarsUp = leg.impact_dollars >= 0;
  return (
    <div className="rounded-2xl border border-[#E7E5DE] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{leg.asset_name || leg.symbol}</h3>
          <p className="mt-1 text-[11px] text-[#8A8A84]">
            {leg.side} · ${leg.stake.toLocaleString('en-US')} paper · {leg.symbol}
          </p>
        </div>
        <div className="text-right">
          <div className={`mono-num text-[20px] font-semibold ${dollarsUp ? 'text-[#0D7A4F]' : 'text-[#C93A3A]'}`}>
            {fmtMoney(leg.impact_dollars)}
          </div>
          <div className="mono-num mt-1 text-[12px] text-[#8A8A84]">{fmtPct(leg.impact_pct)}</div>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[#8A8A84]">
        Estimated range <span className="mono-num">{fmtMoney(leg.lower_dollars)} to {fmtMoney(leg.upper_dollars)}</span>
        {leg.calibrated ? ' · measured historical beta' : ' · AlphaArena prior (uncalibrated)'}
      </p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-3 inline-flex min-h-10 items-center gap-2 text-[12px] font-semibold text-[#1D3DFF] hover:text-[#0F22B8]"
      >
        {open ? 'Hide leg work' : 'Show leg work'} <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="mt-3 border-t border-[#E7E5DE] pt-3 text-[12px] leading-6 text-[#55554F]">
          <p>{workSentence(leg, leg.asset_name || leg.symbol)} {volatilitySentence(leg)}</p>
          <p className="mt-2 text-[#8A8A84]">Stress estimate for this leg, not a forecast.</p>
        </div>
      )}
    </div>
  );
}

export default function PortfolioStressTest({ defaultPrompt }: { defaultPrompt?: string }) {
  const { assets } = useMarketData();
  const symbols = useMemo(() => assets.map((asset) => asset.symbol), [assets]);
  const [prompt, setPrompt] = useState(defaultPrompt || 'What if Nasdaq falls 5% before the U.S. open?');
  const [positions, setPositions] = useState<DraftPosition[]>([
    { key: 0, symbol: 'rNVDA', side: 'LONG', stake: '10000' },
    { key: -1, symbol: 'rAAPL', side: 'LONG', stake: '5000' },
  ]);
  const [result, setResult] = useState<PortfolioStressResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key: number, patch: Partial<DraftPosition>) =>
    setPositions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const add = () => {
    if (positions.length >= MAX_POSITIONS) return;
    setPositions((rows) => [...rows, { key: nextKey++, symbol: symbols[0] || 'rNVDA', side: 'LONG', stake: '5000' }]);
  };

  const remove = (key: number) => setPositions((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows));

  const run = async () => {
    if (loading) return;
    const parsed = positions.map((row) => ({ symbol: row.symbol, side: row.side, stake: Number(row.stake) }));
    if (parsed.some((row) => !row.symbol || !(row.stake > 0))) {
      setError('Give every position a symbol and a stake above $0.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await productApi.portfolioStress({ prompt: prompt.trim() || 'Nasdaq falls 5%', positions: parsed, severity: 62, duration: '24H' });
      setResult(next);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'The portfolio stress test could not run. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const aggregate = result?.aggregate;
  const aggregateUp = (aggregate?.impact_dollars ?? 0) >= 0;

  return (
    <section aria-label="Portfolio stress test" className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-5 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <MicroLabel>MarketTwin · Portfolio stress test</MicroLabel>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.035em]">Stress several paper positions at once.</h2>
          <p className="mt-2 max-w-[640px] text-[13px] leading-6 text-[#55554F]">
            Build a small paper portfolio, run one scenario across every leg with the same engine as the single-position lab,
            and inspect the aggregate plus each leg&apos;s work. Hypothetical stress test, not a forecast.
          </p>
        </div>
        <Briefcase size={40} strokeWidth={1.2} className="hidden text-[#D9D7CF] md:block" aria-hidden="true" />
      </div>

      <div className="mt-6">
        <FieldLabel>Scenario</FieldLabel>
        <input
          aria-label="Portfolio stress scenario"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3 text-[14px] outline-none focus:border-[#141412]"
        />
      </div>

      <div className="mt-6 space-y-3">
        {positions.map((row, index) => (
          <div key={row.key} className="grid gap-3 rounded-2xl bg-[#F4F3EF] p-4 sm:grid-cols-[1fr_auto_auto_auto]">
            <div>
              <FieldLabel>Position {index + 1} · symbol</FieldLabel>
              <select
                aria-label={`Position ${index + 1} symbol`}
                value={row.symbol}
                onChange={(event) => update(row.key, { symbol: event.target.value })}
                className="mt-2 w-full rounded-xl border border-[#D9D7CF] bg-white px-3 py-2.5 text-[13px] outline-none"
              >
                {symbols.map((symbol) => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Side</FieldLabel>
              <div className="mt-2 flex gap-1">
                {SIDES.map((side) => (
                  <SegButton key={side} active={row.side === side} onClick={() => update(row.key, { side })}>{side}</SegButton>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Stake $</FieldLabel>
              <input
                aria-label={`Position ${index + 1} stake`}
                inputMode="decimal"
                value={row.stake}
                onChange={(event) => update(row.key, { stake: event.target.value.replace(/[^0-9.]/g, '') })}
                className="mono-num mt-2 w-32 rounded-xl border border-[#D9D7CF] bg-white px-3 py-2.5 text-[13px] outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                aria-label={`Remove position ${index + 1}`}
                onClick={() => remove(row.key)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[#D9D7CF] text-[#55554F] hover:border-[#141412]"
              >
                <Minus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton variant="secondary" onClick={add}>
          <Plus size={14} /> Add position
        </ActionButton>
        <ActionButton disabled={loading} onClick={() => void run()}>
          {loading ? 'Stressing…' : 'Run portfolio stress test'} <ArrowRight size={14} />
        </ActionButton>
      </div>
      {error && <p className="mt-3 rounded-xl bg-[#FBEAEA] p-3 text-[13px] leading-5 text-[#A92E3A]">{error}</p>}

      {result && aggregate && (
        <div className="mt-6" aria-live="polite">
          <div className="rounded-2xl bg-[#141412] p-6 text-white md:p-8">
            <MicroLabel className="text-white/45">Portfolio aggregate · {result.legs.length} legs · paper only</MicroLabel>
            <div className={`mono-num mt-4 text-[44px] font-semibold tracking-[-0.04em] ${aggregateUp ? 'text-[#7BDCA8]' : 'text-[#F19B9B]'}`}>
              {fmtMoney(aggregate.impact_dollars)}
            </div>
            <p className="mono-num mt-1 text-[14px] text-white/70">
              {fmtPct(aggregate.impact_pct)} on ${aggregate.total_stake.toLocaleString('en-US')} paper · range {fmtMoney(aggregate.lower_dollars)} to {fmtMoney(aggregate.upper_dollars)}
            </p>
            <p className="mt-3 text-[12px] leading-5 text-white/50">{aggregate.method}</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {result.legs.map((leg) => (
              <LegCard key={`${leg.symbol}-${leg.side}-${leg.stake}`} leg={leg} />
            ))}
          </div>

          <ShowYourWork result={{ impacts: result.legs, analogues: [], transparency: result.transparency }} nameFor={legName} idPrefix="portfolio" />
        </div>
      )}
    </section>
  );
}
