import { useEffect, useState } from 'react';
import { Skull } from 'lucide-react';
import { MicroLabel } from '../components/ui';
import type { MorgueRow } from '../product/api';
import { productApi } from '../product/api';
import { SessionBadge } from './ShadowSession';

type Nav = (view: string, payload?: unknown) => void;

export default function MorgueScreen({ onNav }: { onNav: Nav }) {
  const [rows, setRows] = useState<MorgueRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    productApi.morgue().then(setRows).catch((cause) => setError(cause instanceof Error ? cause.message : 'Morgue unavailable'));
  }, []);

  return (
    <div className="fade-up">
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
              onClick={() => onNav('battle', { id: row.id })}
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
