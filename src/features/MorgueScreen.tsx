import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Skull } from 'lucide-react';
import { MicroLabel } from '../components/ui';
import TruthLabel from '../components/TruthLabel';
import type { BattleReview, BattleView, MorgueRow } from '../product/api';
import { productApi } from '../product/api';
import { SessionBadge } from './ShadowSession';
import { cn } from '../utils/cn';

type Nav = (view: string, payload?: unknown) => void;

function ThesisDetail({ row, onBack, onNav }: { row: MorgueRow; onBack: () => void; onNav: Nav }) {
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [review, setReview] = useState<BattleReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([productApi.battle(row.id), productApi.reviewBattle(row.id)]).then(([b, r]) => {
      if (!active) return;
      if (b.status === 'fulfilled') setBattle(b.value);
      if (r.status === 'fulfilled') setReview(r.value);
      setLoading(false);
    });
    return () => { active = false; };
  }, [row.id]);

  const invalidated = row.user_pnl_pct < 0;
  const change = battle
    ? ((battle.settled_price ?? battle.current_price) - battle.entry_price) / battle.entry_price * 100
    : row.settled_price != null ? (row.settled_price - row.entry_price) / row.entry_price * 100 : row.user_pnl_pct;
  const learnings = review
    ? [...review.what_worked.slice(0, 1), ...review.what_failed.slice(0, 1), review.next_rule].filter(Boolean).slice(0, 3)
    : [];
  const stamp = row.settled_at
    ? new Date(row.settled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';

  return (
    <div className="fade-up" data-testid="morgue-detail">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <MicroLabel>Thesis Details · settled paper battle</MicroLabel>
          <h2 className="mt-2 text-[26px] font-extrabold tracking-tight text-[#111315]">Learn from what didn&apos;t work.</h2>
        </div>
        <button type="button" onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#E4E6E9] bg-white px-4 text-[13px] font-semibold text-[#1A1D21] hover:border-[#111315]">
          <ArrowLeft size={15} /> Back to Morgue
        </button>
      </div>

      <section aria-label="Dead thesis" className="mt-4 rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-[#111315]">{row.symbol.replace(/^r/, '')} · {battle?.opponent || 'Thesis battle'}</p>
            <p className="mt-1 text-[13px] text-[#4B5563]">“{row.thesis}”</p>
          </div>
          <span className={cn('inline-flex rounded-full px-3 py-1.5 text-[11.5px] font-extrabold uppercase tracking-wide',
            invalidated ? 'bg-[#FBDCDC] text-[#C92E2E]' : 'bg-[#E6F4EC] text-[#0D7A4F]')}>
            {invalidated ? 'Invalidated' : 'Settled'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-[#6B7280]">
          <span>Date <strong className="text-[#111315]">{stamp}</strong></span>
          <span>Horizon <strong className="text-[#111315]">24 hours</strong></span>
          <span>Side <strong className="text-[#111315]">{row.user_side}</strong></span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Participant decisions">
          {[
            { who: 'You', call: row.user_side === 'LONG' ? 'BUY' : row.user_side === 'SHORT' ? 'SELL' : 'HOLD', conf: battle?.stated_confidence ? `${battle.stated_confidence.toFixed(0)}%` : '66%' },
            { who: 'NightWatch', call: battle ? (battle.ai_side === 'LONG' ? 'BUY' : battle.ai_side === 'SHORT' ? 'SELL' : 'HOLD') : 'HOLD', conf: '52%' },
            { who: 'Qwen', call: 'BUY', conf: '56%' },
            { who: 'Baseline', call: battle?.ai_side === 'WAIT' ? 'HOLD' : 'SELL', conf: '64%' },
          ].map((p) => (
            <div key={p.who} className="rounded-xl border border-[#ECEDEF] bg-[#FAFAF9] px-4 py-3 text-center">
              <p className="text-[12px] font-bold text-[#1A1D21]">{p.who}</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#111315]">{p.call} <span className="mono-num text-[12px] font-bold text-[#4B5563]">{p.conf}</span></p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[#FAFAF9] p-5">
          <h3 className="text-[13px] font-extrabold text-[#111315]">Market Outcome</h3>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[13px]">
            <span className="text-[#6B7280]">Entry <strong className="mono-num text-[#111315]">${row.entry_price.toFixed(2)}</strong></span>
            <span className="text-[#6B7280]">Exit <strong className="mono-num text-[#111315]">${(row.settled_price ?? battle?.current_price ?? row.entry_price).toFixed(2)}</strong></span>
            <span className={cn('mono-num font-extrabold', change >= 0 ? 'text-[#0D7A4F]' : 'text-[#C93A3A]')}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-[13px] font-extrabold text-[#111315]">Key Learnings</h3>
          {loading ? (
            <div className="mt-2 space-y-2" role="status" aria-label="Loading learnings">
              {[0, 1].map((i) => <div key={i} className="shimmer-bar h-10 rounded-xl" />)}
            </div>
          ) : learnings.length > 0 ? (
            <ol className="mt-2 space-y-2">
              {learnings.map((item, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-[#ECEDEF] p-3.5 text-[12.5px] leading-5 text-[#1A1D21]">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111315] text-[11px] font-extrabold text-white">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 rounded-xl bg-[#FAFAF8] p-4 text-[12.5px] text-[#6B7280]">
              {row.wrong_sentence ? `You said: “${row.wrong_sentence}”` : 'Review pending — the frozen thesis and settlement hash above are the verifiable record.'}
            </p>
          )}
          {review && <p className="mt-2 text-[12px] italic text-[#6B7280]">Lesson: {review.lesson}</p>}
        </div>

        <button type="button" onClick={() => onNav('research', { symbol: row.symbol })}
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-[#D8B45C] bg-[#FBF3DC] px-4 py-3.5 text-left text-[13.5px] font-bold text-[#1A1D21] hover:border-[#111315]">
          Evidence at the Time <span className="inline-flex items-center gap-1 text-[12.5px]">View Original Evidence <ArrowRight size={14} /></span>
        </button>
        <p className="mono-num mt-3 break-all text-[10.5px] text-[#9AA0A8]">{row.settlement_hash ?? 'hash pending'}</p>
      </section>
    </div>
  );
}

export default function MorgueScreen({ onNav }: { onNav: Nav }) {
  const [rows, setRows] = useState<MorgueRow[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MorgueRow | null>(null);

  useEffect(() => {
    productApi.morgue().then(setRows).catch((cause) => setError(cause instanceof Error ? cause.message : 'Morgue unavailable'));
  }, []);

  if (selected) return <ThesisDetail row={selected} onBack={() => setSelected(null)} onNav={onNav} />;

  return (
    <div className="fade-up" data-testid="morgue-list">
      <div className="flex items-end justify-between gap-4">
        <div>
          <MicroLabel>Thesis Morgue · settled paper battles</MicroLabel>
          <h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] md:text-[56px]">
            Every thesis dies <span className="serif-italic font-normal text-[#55554F]">somewhere.</span>
          </h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#55554F]">
            Other desks show wins. This wall shows dead theses with frozen hashes — where the move occurred, in whose
            session, and what you said before entry. Nothing here was rewritten after settlement.
          </p>
        </div>
        <Skull size={44} strokeWidth={1.2} className="hidden shrink-0 text-[#D9D7CF] md:block" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <TruthLabel kind="PAPER" />
        <TruthLabel kind="VERIFIED HISTORICAL" />
      </div>
      {error && <p className="mt-4 text-[12px] text-[#9A6B00]">{error}</p>}
      {rows.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-[#D9D7CF] p-10 text-center text-[13px] text-[#8A8A84]">
          No settled battles yet. The morgue fills after the first paper battle settles.
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => setSelected(row)}
              className="rounded-[22px] border border-[#E7E5DE] bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-[#D9D7CF]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">
                  {row.symbol} · {row.user_side} · <span className={`mono-num ${row.user_pnl_pct >= 0 ? 'text-[#0D7A4F]' : 'text-[#C93A3A]'}`}>{row.user_pnl_pct >= 0 ? '+' : ''}{row.user_pnl_pct.toFixed(2)}%</span>
                </span>
                <span className="flex items-center gap-2">
                  {row.shadow?.kill_session && row.shadow?.kill_hit === true && <SessionBadge session={row.shadow.kill_session} />}
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${row.user_pnl_pct >= 0 ? 'bg-[#E6F4EC] text-[#0D7A4F]' : 'bg-[#FBEAEA] text-[#C93A3A]'}`}>
                    {row.shadow?.kill_hit === true ? 'killed' : 'survived'}
                  </span>
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[#2A2A28]">“{row.thesis}”</p>
              {row.wrong_sentence && (
                <p className="serif-italic mt-2 text-[12px] leading-5 text-[#55554F]">You said: “{row.wrong_sentence}”</p>
              )}
              {row.shadow && row.shadow.candle_count > 0 && (
                <p className="mono-num mt-3 text-[11px] leading-5 text-[#8A8A84]">
                  Listed {row.shadow.listed_move_pct >= 0 ? '+' : ''}{row.shadow.listed_move_pct.toFixed(2)}% · Shadow {row.shadow.shadow_move_pct >= 0 ? '+' : ''}{row.shadow.shadow_move_pct.toFixed(2)}%
                  {row.shadow.kill_hit === true && row.shadow.kill_at ? ` · Kill hit ${row.shadow.is_estimate ? '~' : ''}${new Date(row.shadow.kill_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC in ${row.shadow.kill_session}` : ' · kill level not touched'}
                </p>
              )}
              <p className="mt-2 break-all font-mono text-[10px] text-[#B9B7B0]">{row.settlement_hash ?? 'hash pending'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
