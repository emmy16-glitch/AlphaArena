import type { TwinResponse } from '../product/api';

export function twinToPlaybookText(result: TwinResponse): string {
  const top = [...result.impacts]
    .sort((a, b) => Math.abs(b.impact_pct) - Math.abs(a.impact_pct))
    .slice(0, 3);
  const pairs = top.map((i) => i.symbol).join(', ') || 'rNVDA';
  const worst = top.length ? Math.min(...top.map((i) => i.impact_pct)) : 0;
  const lines: Array<[string, string]> = [
    ['Strategy', `Stress-watch: ${result.shock.driver} ${result.shock.direction} ${result.shock.magnitude}${result.shock.unit}`],
    ['Pair', pairs],
    ['Amount per Cycle', 'Paper only in AlphaArena — set your Playbook paper size'],
    ['Frequency', result.duration],
    ['Entry Condition', `Review when driver moves ${result.shock.magnitude}${result.shock.unit} ${result.shock.direction}; most sensitive: ${top[0]?.symbol || 'rNVDA'}`],
    ['Pause Condition', `Pause if realized stress exceeds worst estimated ${worst.toFixed(2)}% or invalidation triggers`],
    ['Market Regime', result.shock.category],
    ['Signal Confidence', `${result.model_source} | calibrated=${top.some((i) => i.calibrated)}`],
    ['Optimizer Reason', (result.explanation_view?.impact_summary || result.explanation || '').slice(0, 400)],
  ];
  return lines.map(([k, v]) => `${k}: ${v}`).join('\n');
}
