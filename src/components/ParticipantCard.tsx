import { useState } from 'react';
import { ArrowRight, BarChart3, Sparkles, User } from 'lucide-react';
import { cn } from '../utils/cn';
import { marketToCall, type SessionParticipant } from '../product/decisionSessions';

const META: Record<string, { name: string; sub: string }> = {
  human: { name: 'You', sub: '(Human)' },
  nightwatch: { name: 'NightWatch', sub: '(AlphaArena)' },
  qwen: { name: 'Qwen 3.8', sub: '' },
  baseline: { name: 'Baseline', sub: '(Technical)' },
};

function Avatar({ lane }: { lane: string }) {
  if (lane === 'human')
    return (
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4A3F2A] text-[#E8C86A]">
        <User size={19} />
      </span>
    );
  if (lane === 'nightwatch')
    return (
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16294D] text-white">
        <Sparkles size={18} />
      </span>
    );
  if (lane === 'qwen')
    return (
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B7CF6] text-white">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="white" strokeWidth="1.6" />
          <circle cx="10" cy="10" r="3.4" stroke="white" strokeWidth="1.6" />
          <circle cx="10" cy="10" r="1" fill="white" />
        </svg>
      </span>
    );
  return (
    <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E6E9] bg-white text-[#1A1D21]">
      <BarChart3 size={18} />
    </span>
  );
}

function callPill(call: string) {
  if (call === 'BUY') return 'bg-[#CDEEDB] text-[#0B6B3F]';
  if (call === 'SELL') return 'bg-[#FBDCDC] text-[#E5484D] shadow-[0_0_18px_rgba(229,72,77,0.25)]';
  if (call === 'HOLD') return 'bg-[#E9EBEF] text-[#1A1D21]';
  return 'bg-[#F1F2F4] text-[#6B7280]';
}

export default function ParticipantCard({ lane, participant, riskLabel }: { lane: string; participant: SessionParticipant; riskLabel?: string }) {
  const [open, setOpen] = useState(false);
  const meta = META[lane] || { name: lane.toUpperCase(), sub: lane };
  const unavailable = participant.status === 'unavailable';
  const call = unavailable ? 'Unavailable' : marketToCall(participant.direction);

  return (
    <article
      aria-label={`${meta.name} decision`}
      data-testid={`participant-${lane}`}
      className="flex flex-col items-center rounded-2xl border border-[#ECEDEF] bg-[#FAFAF9] px-4 py-5 text-center"
    >
      <div className="flex items-center gap-2.5 self-start">
        <Avatar lane={lane} />
        <span className="text-left leading-tight">
          <span className="block text-[13.5px] font-bold text-[#1A1D21]">{meta.name}</span>
          {meta.sub && <span className="block text-[11.5px] font-normal text-[#6B7280]">{meta.sub}</span>}
        </span>
      </div>
      {unavailable ? (
        <div className="mt-4">
          <span className="inline-flex items-center rounded-full bg-[#FDF3D7] px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-[#9A6B00]">
            Unavailable
          </span>
          <p className="mt-2 text-[11.5px] leading-5 text-[#6B7280]">
            Provider unreachable — recorded as unavailable, not a market call.
          </p>
        </div>
      ) : (
        <>
          <span className={cn('mt-4 inline-flex min-w-[118px] items-center justify-center rounded-full px-5 py-2 text-[15px] font-extrabold tracking-wide', callPill(call))}>
            {call}
            <span className="sr-only">{call === 'BUY' ? 'buy' : call === 'SELL' ? 'sell' : 'hold'}</span>
          </span>
          <span className="mono-num mt-2.5 text-[15px] font-extrabold text-[#1A1D21]">
            {participant.confidence != null ? `${participant.confidence.toFixed(0)}%` : '—'}
            <span className="ml-1 text-[12.5px] font-normal text-[#1A1D21]">confidence</span>
          </span>
          {riskLabel && (
            <span className="mt-1 text-[12px] font-medium text-[#6B7280]" title="Risk band derived from frozen confidence">{riskLabel}</span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2.5 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-medium text-[#1A1D21] hover:underline"
          >
            {open ? 'Hide reasoning' : 'View reasoning'} <ArrowRight size={13} />
          </button>
          {open && (
            <p className="mt-1 text-left text-[12px] leading-5 text-[#55554F]">
              {participant.reasoning || 'Reasoning recorded against the frozen snapshot.'}
              {participant.model && (
                <span className="mt-1 block font-mono text-[10.5px] text-[#8A8A84]">model: {participant.model}</span>
              )}
            </p>
          )}
        </>
      )}
    </article>
  );
}
