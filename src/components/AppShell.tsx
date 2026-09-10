import { ReactNode } from 'react';
import { Activity, FlaskConical, Swords, Wallet, Trophy, Plus, Search, Bell, ChevronLeft } from 'lucide-react';
import { Logo } from './ui';
import { cn } from '../utils/cn';

const nav = [
  { id: 'pulse', label: 'Pulse', icon: Activity, hint: 'Watch' },
  { id: 'lab', label: 'Lab', icon: FlaskConical, hint: 'Simulate' },
  { id: 'arena', label: 'Arena', icon: Swords, hint: 'Battle' },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet, hint: '$112k' },
  { id: 'leaderboard', label: 'Ranks', icon: Trophy, hint: 'Top' },
];

export default function AppShell({ view, onNav, onHome, children, onCreate }: { view: string; onNav: (v: string) => void; onHome: () => void; children: ReactNode; onCreate: () => void }) {
  const inSub = ['asset', 'nightwatch', 'battle', 'create'].includes(view);
  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[#E7E5DE] bg-[#FAF9F6]/95 backdrop-blur-xl lg:flex">
        <div className="flex h-[64px] items-center justify-between px-5"><button onClick={onHome}><Logo /></button></div>
        <div className="px-3"><button className="flex w-full items-center gap-2.5 rounded-xl border border-[#E7E5DE] bg-white px-3.5 py-2.5 text-[13px] text-[#8A8A84] transition-all hover:border-[#D9D7CF]"><Search size={15} /><span>Search rNVDA, thesis…</span><kbd className="mono-num ml-auto rounded border border-[#E7E5DE] bg-[#F4F3EF] px-1.5 py-0.5 text-[10px]">⌘K</kbd></button></div>
        <nav className="mt-4 flex-1 space-y-1 px-3">
          <div className="micro-label px-2 pb-2 text-[#8A8A84]">Product</div>
          {nav.map((n) => <button key={n.id} onClick={() => onNav(n.id)} className={cn('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all', view === n.id || (n.id === 'pulse' && inSub && (view === 'asset' || view === 'nightwatch')) || (n.id === 'arena' && view === 'battle') ? 'bg-[#141412] text-white' : 'text-[#55554F] hover:bg-[#EDECE7]/70 hover:text-black')}><n.icon size={17} strokeWidth={1.9} />{n.label}<span className={cn('mono-num ml-auto text-[11px]', view === n.id ? 'text-white/50' : 'text-[#B9B7B0]')}>{n.hint}</span></button>)}
          <div className="micro-label px-2 pb-2 pt-5 text-[#8A8A84]">Create</div>
          <button onClick={onCreate} className={cn('flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-[14px] font-medium transition-all', view === 'create' ? 'border-[#141412] bg-[#141412] text-white' : 'border-[#D9D7CF] text-[#55554F] hover:border-[#141412] hover:text-black')}><Plus size={17} /> New trader</button>
        </nav>
        <div className="p-3"><div className="rounded-2xl border border-[#E7E5DE] bg-white p-4"><div className="micro-label text-[#8A8A84]">Virtual capital</div><div className="mono-num mt-1 text-[22px] font-semibold">$112,408</div><div className="mono-num mt-0.5 text-[12px] font-medium text-[#0D7A4F]">+12.4% all-time</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F4F3EF]"><div className="h-full w-[68%] rounded-full bg-[#141412]" /></div><div className="mt-2 text-[11.5px] text-[#8A8A84]">$32k deployed · $80k free</div></div></div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-[#E7E5DE] bg-[#FAF9F6]/90 backdrop-blur-xl lg:ml-[232px]">
        <div className="flex h-[60px] items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3"><button onClick={onHome} className="lg:hidden"><Logo /></button>{inSub && <button onClick={() => onNav(view === 'battle' ? 'arena' : 'pulse')} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E7E5DE] bg-white lg:hidden"><ChevronLeft size={16} /></button>}<div className="hidden items-center gap-2 rounded-full border border-[#E7E5DE] bg-white px-3 py-1.5 lg:flex"><span className="tick-dot h-1.5 w-1.5 rounded-full bg-[#0D7A4F]" /><span className="mono-num text-[11.5px] font-medium text-[#55554F]">24/7 market lab</span></div></div>
          <div className="flex items-center gap-2"><button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E5DE] bg-white transition-all hover:border-[#141412]"><Bell size={16} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#C93A3A]" /></button><button onClick={() => onNav('portfolio')} className="flex items-center gap-2.5 rounded-full border border-[#E7E5DE] bg-white py-1 pl-1 pr-3.5 transition-all hover:border-[#141412]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#141412] text-[11px] font-semibold text-white">YO</span><span className="mono-num hidden text-[12.5px] font-semibold sm:inline">$112.4k</span></button></div>
        </div>
      </header>

      <main className="pb-24 lg:ml-[232px] lg:pb-12"><div className="mx-auto max-w-[1080px] px-4 pt-6 md:px-8 md:pt-8">{children}</div></main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E5DE] bg-[#FAF9F6]/95 backdrop-blur-xl lg:hidden"><div className="grid grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">{nav.map((n) => { const active = view === n.id || (n.id === 'pulse' && (view === 'asset' || view === 'nightwatch')) || (n.id === 'arena' && view === 'battle'); return <button key={n.id} onClick={() => onNav(n.id)} className="flex flex-col items-center gap-0.5 rounded-xl py-2"><span className={cn('flex h-8 w-12 items-center justify-center rounded-full transition-all', active && 'bg-[#141412] text-white')}><n.icon size={17} strokeWidth={active ? 2.1 : 1.8} /></span><span className={cn('text-[10.5px] font-medium', active ? 'text-black' : 'text-[#8A8A84]')}>{n.label}</span></button>; })}</div></nav>
    </div>
  );
}
