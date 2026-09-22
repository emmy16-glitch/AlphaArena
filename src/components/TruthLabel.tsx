import { cn } from '../utils/cn';

export type TruthKind =
  | 'LIVE'
  | 'VERIFIED HISTORICAL'
  | 'PAPER'
  | 'DEMO'
  | 'PREVIEW'
  | 'FALLBACK'
  | 'MODEL-GENERATED INTERPRETATION'
  | 'DETERMINISTIC CALCULATION';

const STYLES: Record<TruthKind, string> = {
  LIVE: 'bg-[#E6F4EC] text-[#0D7A4F] border-[#0D7A4F]/25',
  'VERIFIED HISTORICAL': 'bg-[#EEF0FF] text-[#0F22B8] border-[#1D3DFF]/25',
  PAPER: 'bg-white text-[#55554F] border-[#D9D7CF]',
  DEMO: 'bg-[#FDF3D7] text-[#9A6B00] border-[#9A6B00]/25',
  PREVIEW: 'bg-[#FDF3D7] text-[#9A6B00] border-[#9A6B00]/25',
  FALLBACK: 'bg-[#FDF3D7] text-[#9A6B00] border-[#9A6B00]/25',
  'MODEL-GENERATED INTERPRETATION': 'bg-[#F4F3EF] text-[#55554F] border-[#E7E5DE]',
  'DETERMINISTIC CALCULATION': 'bg-[#141412] text-white border-[#141412]',
};

export default function TruthLabel({ kind, className }: { kind: TruthKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
        STYLES[kind],
        className,
      )}
    >
      {kind}
    </span>
  );
}
