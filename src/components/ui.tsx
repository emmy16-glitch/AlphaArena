import { ReactNode } from 'react';
import { sparkPath } from '../data';
import { cn } from '../utils/cn';

export function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('micro-label text-[#8A8A84]', className)}>{children}</div>;
}

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-[8px]', dark ? 'bg-white text-black' : 'bg-[#141412] text-white')}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L14.5 14H11.7L8 6.8L4.3 14H1.5L8 1.5Z" fill="currentColor" />
          <path d="M5.4 11.5H10.6" stroke={dark ? '#141412' : '#FAF9F6'} strokeWidth="1.4" />
        </svg>
      </div>
      {!compact && <span className={cn('text-[15px] font-semibold tracking-tight', dark ? 'text-white' : 'text-[#141412]')}>AlphaArena</span>}
    </div>
  );
}

export function Sparkline({ data, width = 120, height = 36, positive, className, id }: { data: number[]; width?: number; height?: number; positive?: boolean; className?: string; id?: string }) {
  const safeData = data.length > 1 ? data : [0, 0];
  const up = positive ?? safeData[safeData.length - 1] >= safeData[0];
  const color = up ? '#0D7A4F' : '#C93A3A';
  const path = sparkPath(safeData, width, height);
  const area = `${path} L${width},${height} L0,${height} Z`;
  const gid = id || `g${Math.random().toString(36).slice(2, 7)}`;
  const min = Math.min(...safeData); const max = Math.max(...safeData); const range = max - min || 1;
  const endY = height - ((safeData[safeData.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} fill="none">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.14" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="live-line" />
      <circle cx={width - 1.5} cy={endY} r="2.5" fill={color} stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}

export function Pnl({ value, className, mono = true }: { value: number; className?: string; mono?: boolean }) {
  const up = value >= 0;
  return <span className={cn(mono && 'mono-num', 'font-medium tabular-nums', up ? 'text-[#0D7A4F]' : 'text-[#C93A3A]', className)}>{up ? '+' : ''}{value.toFixed(2)}%</span>;
}

export function Hairline({ className }: { className?: string }) { return <div className={cn('h-px w-full bg-[#E7E5DE]', className)} />; }
export function FieldLabel({ children }: { children: ReactNode }) { return <div className="micro-label mb-2 text-[#8A8A84]">{children}</div>; }

export function SegButton({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200', active ? 'bg-[#141412] text-white' : 'text-[#55554F] hover:bg-[#EDECE7] hover:text-[#141412]')}>{children}</button>;
}

export function ActionButton({ variant = 'primary', children, onClick, className }: { variant?: 'primary' | 'secondary' | 'ghost' | 'accent'; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button onClick={onClick} className={cn('inline-flex items-center justify-center gap-2 rounded-full text-[14px] font-medium transition-all duration-200 active:scale-[0.98]', variant === 'primary' && 'bg-[#141412] px-5 py-2.5 text-white hover:bg-black', variant === 'accent' && 'bg-[#1D3DFF] px-5 py-2.5 text-white hover:bg-[#0F22B8]', variant === 'secondary' && 'border border-[#D9D7CF] bg-white px-5 py-2.5 text-[#141412] hover:border-[#141412]', variant === 'ghost' && 'px-3 py-1.5 text-[#55554F] hover:text-[#141412]', className)}>{children}</button>;
}

export function ScoreRing({ score, size = 64, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 8) / 2; const c = 2 * Math.PI * r; const off = c - (score / 100) * c;
  const color = score >= 65 ? '#0D7A4F' : score >= 40 ? '#9A6B00' : '#C93A3A';
  return <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}><svg width={size} height={size} className="-rotate-90"><circle cx={size/2} cy={size/2} r={r} stroke="#EDECE7" strokeWidth="5" fill="none" /><circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="mono-num text-[15px] font-semibold leading-none">{score}</span>{label && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8A8A84]">{label}</span>}</div></div>;
}

export function VerdictPill({ tone, children }: { tone: 'up' | 'down' | 'warn' | 'neutral'; children: ReactNode }) {
  const styles = { up: 'bg-[#E6F4EC] text-[#0D7A4F] border-[#0D7A4F]/20', down: 'bg-[#FBEAEA] text-[#C93A3A] border-[#C93A3A]/20', warn: 'bg-[#FDF3D7] text-[#9A6B00] border-[#9A6B00]/20', neutral: 'bg-[#F4F3EF] text-[#55554F] border-[#E7E5DE]' };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold', styles[tone])}>{children}</span>;
}

export function EmptyAvatar({ name, ai }: { name: string; ai?: boolean }) {
  const initials = name.split(/[\s.]+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold', ai ? 'bg-[#141412] text-white' : 'bg-[#EDECE7] text-[#55554F]')}>{initials}</div>;
}
