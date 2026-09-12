import { ChevronDown } from 'lucide-react';
import type { HistoricalAnalogue, TwinImpact, TwinTransparency } from '../product/api';

const MIN_OBSERVATIONS = 20;

function fmtBeta(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : 'n/a';
}

function fmtVol(value: number | null | undefined) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : null;
}

/** Plain-language "show your work" sentence for one calibrated-or-prior leg. */
export function workSentence(impact: TwinImpact, displayName: string): string {
  const minimum = impact.observations_minimum ?? MIN_OBSERVATIONS;
  if (impact.calibrated && typeof impact.beta_to_qqq === 'number') {
    const n = impact.paired_observations ?? minimum;
    return `${displayName}: based on ${n} aligned historical observations, beta of ${fmtBeta(impact.beta_to_qqq)} to QQQ.`;
  }
  const prior = typeof impact.prior_beta === 'number' ? ` (sensitivity ${fmtBeta(impact.prior_beta)})` : '';
  if (impact.fallback_reason === 'fewer_than_20_paired_observations') {
    const n = impact.paired_observations ?? 0;
    return `${displayName}: historical beta wasn't used because only ${n} of the required ${minimum} paired observations were available, so a transparent AlphaArena prior${prior} was used instead.`;
  }
  if (impact.fallback_reason === 'non_nasdaq_category_uses_prior') {
    return `${displayName}: this isn't a Nasdaq shock, so a transparent AlphaArena prior${prior} was used instead of historical beta.`;
  }
  return `${displayName}: historical beta wasn't used because historical research was unavailable, so a transparent AlphaArena prior${prior} was used instead.`;
}

export function volatilitySentence(impact: TwinImpact): string {
  const shortVol = fmtVol(impact.short_volatility_pct);
  const annualVol = fmtVol(impact.annualized_volatility_pct);
  if (shortVol && annualVol) {
    return `Uncertainty range widened by short-window volatility ${shortVol} from recent live prices and historical volatility ${annualVol}.`;
  }
  if (shortVol) {
    return `Uncertainty range widened by short-window volatility ${shortVol} from recent live prices.`;
  }
  return 'Short-window volatility was unavailable, so the range was not widened by recent price swings.';
}

/** Extra paragraphs rendered inside the per-impact "View why" disclosure. */
export function ImpactWorkDetails({ impact }: { impact: TwinImpact }) {
  const minimum = impact.observations_minimum ?? MIN_OBSERVATIONS;
  const observations =
    typeof impact.paired_observations === 'number'
      ? `${impact.paired_observations} of the required ${minimum} paired observations`
      : 'no counted paired observations (historical research unavailable)';
  return (
    <>
      <p className="mt-2">
        {impact.calibrated
          ? `Observation count: ${observations} — enough to use measured historical beta.`
          : `Observation count: ${observations} — not enough, so historical beta wasn't used.`}
      </p>
      <p className="mt-2">{volatilitySentence(impact)}</p>
    </>
  );
}

type WorkResult = {
  impacts: TwinImpact[];
  analogues: HistoricalAnalogue[];
  transparency?: TwinTransparency | null;
};

/**
 * Collapsible "Show your work" panel: one plain-language line per leg plus the
 * shared analogue/volatility notes. Reused by MarketTwin results and by each
 * portfolio-stress leg plus the aggregate.
 */
export default function ShowYourWork({
  result,
  nameFor,
  idPrefix = 'work',
}: {
  result: WorkResult;
  nameFor?: (impact: TwinImpact) => string;
  idPrefix?: string;
}) {
  const label = nameFor ?? ((impact) => impact.asset_name || impact.symbol);
  const transparency = result.transparency ?? {};
  const analogueCount = transparency.analogue_count ?? result.analogues.length;
  return (
    <details className="mt-6 rounded-2xl border border-[#D9D7CF] bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[13px] font-semibold">
        <span>Show your work</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="border-t border-[#E7E5DE] px-5 py-4 text-[12px] leading-6 text-[#55554F]">
        <ul className="space-y-2">
          {result.impacts.map((impact) => (
            <li key={`${idPrefix}-${impact.symbol}`} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{workSentence(impact, label(impact))} {volatilitySentence(impact)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Historical context: {analogueCount} past daily move{analogueCount === 1 ? '' : 's'} selected
          because {analogueCount === 1 ? 'it matched' : 'they matched'} the direction and size of the current move.
          Shown for context only — not predictions.
        </p>
        {transparency.volatility_note && <p className="mt-2 text-[#8A8A84]">{transparency.volatility_note}</p>}
        <p className="mt-2 text-[#8A8A84]">
          Stress estimates, not forecasts. Company news and changing conditions can make them wrong.
        </p>
      </div>
    </details>
  );
}
