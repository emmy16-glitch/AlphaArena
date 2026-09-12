import { fmtPrice } from '../data';
import type { BattleView } from '../product/api';
import { cn } from '../utils/cn';

export function SessionBadge({ session }: { session?: 'listed' | 'shadow' | string | null }) {
  if (!session) return null;
  const listed = session === 'listed';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
        listed ? 'border-[#0D7A4F]/25 bg-[#E6F4EC] text-[#0D7A4F]' : 'border-[#141412]/20 bg-[#141412] text-white'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', listed ? 'bg-[#0D7A4F]' : 'bg-white')} />
      {listed ? 'Listed' : 'Shadow'}
    </span>
  );
}

export function ShadowBars({ battle, dark = false }: { battle: BattleView; dark?: boolean }) {
  const shadow = battle.shadow;
  if (!shadow || shadow.candle_count === 0) return null;
  const listed = Number.isFinite(shadow.listed_move_pct) ? shadow.listed_move_pct : 0;
  const shad = Number.isFinite(shadow.shadow_move_pct) ? shadow.shadow_move_pct : 0;
  const span = Math.max(Math.abs(listed), Math.abs(shad), 0.0001);
  const bar = (value: number) => ({ width: `${Math.min(100, (Math.abs(value) / span) * 100).toFixed(1)}%` });
  const fmt = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  // Kill copy: only claim a "kill hit" when the level was actually touched.
  // Otherwise the bars describe where the move occurred so far.
  const killHit = shadow.kill_hit === true && shadow.kill_at;
  const killText = killHit
    ? `Kill hit ${shadow.is_estimate ? '~' : ''}${new Date(shadow.kill_at as string).toLocaleString('en-US', { timeZone: 'UTC' })} UTC — in ${shadow.kill_session === 'listed' ? 'Listed' : 'Shadow'} session.`
    : battle.status === 'settled'
      ? 'Thesis survived — kill level was not touched on the observed path.'
      : null;
  const moveText = !killHit && shadow.kill_at
    ? `Move so far occurred in ${shadow.kill_session === 'listed' ? 'Listed' : 'Shadow'} session · ${shadow.is_estimate ? '~' : ''}${new Date(shadow.kill_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
    : null;
  return (
    <section
      aria-label="Shadow Session attribution — where the move occurred"
      className={cn('mt-5 rounded-[22px] border p-5 md:p-6', dark ? 'border-white/15 bg-white/[0.04]' : 'border-[#E7E5DE] bg-[#FAF9F6]')}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className={cn('micro-label', dark ? 'text-white/45' : 'text-[#8A8A84]')}>Where the move occurred · paper only</div>
        {shadow.kill_session && <SessionBadge session={shadow.kill_session} />}
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className={cn('font-semibold', dark ? 'text-white/80' : 'text-[#55554F]')}>Listed</span>
            <span className={cn('mono-num font-semibold', listed >= 0 ? 'text-[#0D7A4F]' : 'text-[#C93A3A]')}>{fmt(listed)}</span>
          </div>
          <div className={cn('mt-1.5 h-2 overflow-hidden rounded-full', dark ? 'bg-white/10' : 'bg-[#EDECE7]')}>
            <div className="h-full rounded-full bg-[#0D7A4F]" style={bar(listed)} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className={cn('font-semibold', dark ? 'text-white/80' : 'text-[#55554F]')}>Shadow</span>
            <span className={cn('mono-num font-semibold', shad >= 0 ? 'text-[#0D7A4F]' : 'text-[#C93A3A]')}>{fmt(shad)}</span>
          </div>
          <div className={cn('mt-1.5 h-2 overflow-hidden rounded-full', dark ? 'bg-white/10' : 'bg-[#EDECE7]')}>
            <div className="h-full rounded-full bg-[#141412]" style={dark ? { ...bar(shad), background: '#fff' } : bar(shad)} />
          </div>
        </div>
      </div>
      {killText && (
        <p className={cn('mt-4 text-[12px] font-semibold leading-5', dark ? 'text-white/80' : 'text-[#2A2A28]')}>
          {killText}
        </p>
      )}
      {moveText && (
        <p className={cn('mt-1 text-[12px] leading-5', dark ? 'text-white/60' : 'text-[#55554F]')}>
          {moveText}
        </p>
      )}
      {battle.wrong_sentence && (
        <blockquote className={cn('serif-italic mt-3 border-l-2 pl-3 text-[14px] leading-6', dark ? 'border-white/25 text-white/80' : 'border-[#D9D7CF] text-[#2A2A28]')}>
          You said: “{battle.wrong_sentence}”
        </blockquote>
      )}
      <p className={cn('mt-3 text-[10.5px] leading-4', dark ? 'text-white/35' : 'text-[#8A8A84]')}>
        {shadow.session_label}
        {shadow.is_estimate ? ` Timestamps are candle-bucket estimates (~${shadow.granularity} resolution), not exact fills.` : ' 1m candle resolution.'}
      </p>
    </section>
  );
}

export function FlattenNote({ battle }: { battle: BattleView }) {
  const flat = battle.flatten_before_dark;
  if (!flat || battle.status !== 'settled') return null;
  const sign = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  return (
    <p className="mt-3 rounded-2xl border border-dashed border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3 text-[12px] leading-5 text-[#55554F]">
      If flattened at the last Listed close (${fmtPrice(flat.flatten_price)}): <strong className="mono-num">{sign(flat.flatten_pnl_pct)}</strong>{' '}
      instead of <strong className="mono-num">{sign(flat.final_pnl_pct)}</strong>. Observed outcome, not a recommendation.
    </p>
  );
}
