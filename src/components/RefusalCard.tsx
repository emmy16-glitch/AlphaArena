import { ShieldAlert } from 'lucide-react';
import type { SessionRefusal } from '../product/decisionSessions';

export default function RefusalCard({ refusal }: { refusal: SessionRefusal }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-2xl border border-[#9A6B00]/30 bg-[#FDF3D7] p-5"
      data-testid="refusal-card"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141412] text-white" aria-hidden="true">
          <ShieldAlert size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A6B00]">
            No action justified · {refusal.code}
          </div>
          <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-[#141412]">{refusal.title}</h3>
          <p className="mt-1.5 text-[13px] leading-6 text-[#55554F]">{refusal.explanation}</p>
          {refusal.technical && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-[#55554F]">
                Technical details
              </summary>
              <p className="mt-2 break-words font-mono text-[11px] leading-5 text-[#8A8A84]">{refusal.technical}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
