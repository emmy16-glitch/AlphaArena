import { ArrowRight, CircleAlert } from 'lucide-react';
import { fmtPrice } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { ActionButton, Hairline, Logo, MicroLabel, Pnl, Sparkline, VerdictPill } from '../components/ui';

function MarketStatus() {
  const { status } = useMarketData();
  const live = status === 'live';
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-[#8A8A84]">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#0D7A4F]' : 'bg-[#9A6B00]'}`} />
      {live ? 'Live market data' : 'Limited market data'}
    </span>
  );
}

export default function Landing({ onEnter }: { onEnter: (view: string) => void }) {
  const { assets, status } = useMarketData();
  const hero = assets[0];
  const tape = [...assets.slice(0, 4), ...assets.slice(0, 4)];
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#141412] paper-texture">
      <header className="sticky top-0 z-30 border-b border-[#E7E5DE] bg-[#FAF9F6]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 md:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13px] text-[#55554F] md:flex">
            <button onClick={() => onEnter('pulse')} className="hover:text-black">Pulse</button>
            <button onClick={() => onEnter('lab')} className="hover:text-black">Lab</button>
            <button onClick={() => onEnter('arena')} className="hover:text-black">Arena</button>
          </nav>
          <ActionButton onClick={() => onEnter('pulse')}>Enter app <ArrowRight size={14} /></ActionButton>
        </div>
      </header>

      <div className="overflow-hidden border-b border-[#E7E5DE] bg-white/70">
        <div className="marquee-track flex w-max items-center gap-9 py-3">
          {tape.map((a, i) => (
            <div key={`${a.symbol}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-[12px]">
              <span className="font-semibold">{a.symbol}</span>
              <span className="mono-num text-[#55554F]">${fmtPrice(a.price)}</span>
              <Pnl value={a.changePct} className="text-[12px]" />
            </div>
          ))}
        </div>
      </div>

      <main>
        <section className="mx-auto grid min-h-[760px] max-w-[1240px] items-center gap-14 px-5 py-20 md:px-8 lg:grid-cols-[1.08fr_.92fr] lg:py-28">
          <div className="fade-up">
            <div className="mb-10 flex flex-wrap items-center gap-5">
              <MicroLabel>N°01 — AI Market Laboratory</MicroLabel>
              <span className="h-px w-16 bg-[#D9D7CF]" />
              <MicroLabel className="text-[#1D3DFF]">Tokenized U.S. equities</MicroLabel>
            </div>
            <h1 className="max-w-[760px] text-[clamp(3.7rem,8vw,7.4rem)] font-semibold leading-[0.86] tracking-[-0.07em]">
              Don’t just watch<br />the market.
              <span className="serif-italic block pt-3 font-normal tracking-[-0.035em] text-[#55554F]">Test it.</span>
            </h1>
            <p className="mt-10 max-w-[610px] text-[18px] leading-8 text-[#55554F] md:text-[21px]">
              AlphaArena is a 24/7 AI market laboratory for tokenized U.S. equities. Watch, simulate and put your ideas to the test — with virtual capital.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <ActionButton onClick={() => onEnter('pulse')} className="px-7 py-3.5 text-[15px]">Enter the Arena <ArrowRight size={16} /></ActionButton>
              <ActionButton variant="secondary" onClick={() => onEnter('lab')} className="px-7 py-3.5 text-[15px]">Explore the Lab</ActionButton>
            </div>
            <div className="mt-14 grid max-w-[610px] grid-cols-3 border-y border-[#E7E5DE] py-5">
              <div><div className="mono-num text-[18px] font-semibold">24/7</div><div className="mt-1 text-[11px] text-[#8A8A84]">Market context</div></div>
              <div className="border-x border-[#E7E5DE] px-4"><div className="mono-num text-[18px] font-semibold">$100K</div><div className="mt-1 text-[11px] text-[#8A8A84]">Virtual capital</div></div>
              <div className="pl-4"><div className="text-[14px] font-semibold">Watch · Simulate · Battle</div><div className="mt-1 text-[11px] text-[#8A8A84]">One connected loop</div></div>
            </div>
          </div>

          <div className="relative fade-up stagger-2">
            <div className="absolute -left-12 top-16 hidden h-48 w-48 rounded-full bg-[#EEF0FF] blur-3xl lg:block" />
            <div className="relative overflow-hidden rounded-[28px] border border-[#D9D7CF] bg-white p-6 shadow-[0_24px_80px_-48px_rgba(20,20,18,.35)] md:p-8">
              <div className="flex items-center justify-between"><div><MicroLabel>NightWatch live brief</MicroLabel><div className="mt-2 text-[12px] text-[#8A8A84]">{status === 'live' ? 'Live market data' : 'Limited data while the market feed connects'}</div></div><MarketStatus /></div>
              <Hairline className="my-6" />
              <div className="flex items-start justify-between gap-4">
                <div><div className="text-[16px] font-semibold">{hero.symbol}</div><div className="mt-1 text-[12px] text-[#8A8A84]">{hero.name}</div></div>
                <div className="text-right"><div className="mono-num text-[28px] font-semibold">${fmtPrice(hero.price)}</div><Pnl value={hero.changePct} className="text-[13px]" /></div>
              </div>
              <div className="mt-8 rounded-2xl bg-[#F4F3EF] px-4 py-6"><Sparkline data={hero.spark} width={420} height={110} className="h-[110px] w-full" /></div>
              <div className="mt-6"><VerdictPill tone="warn"><CircleAlert size={12} /> NightWatch · thesis pressure rising</VerdictPill></div>
              <h2 className="mt-4 text-[25px] font-semibold tracking-[-0.035em]">The move is strong. The evidence is mixed.</h2>
              <p className="mt-3 text-[14px] leading-6 text-[#55554F]">Before chasing momentum, compare the current move with past behaviour and test how the thesis survives a weaker Nasdaq session.</p>
              <div className="mt-7 grid grid-cols-3 gap-2">
                <button onClick={() => onEnter('asset')} className="rounded-xl bg-[#141412] px-3 py-3 text-[12px] font-medium text-white">Investigate</button>
                <button onClick={() => onEnter('lab')} className="rounded-xl border border-[#D9D7CF] px-3 py-3 text-[12px] font-medium">Simulate</button>
                <button onClick={() => onEnter('arena')} className="rounded-xl border border-[#D9D7CF] px-3 py-3 text-[12px] font-medium">Battle</button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#E7E5DE] bg-white/45">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:grid-cols-3 md:px-8">
            {[['01','Watch','NightWatch notices what changed and challenges the obvious explanation.'],['02','Simulate','MarketTwin lets you change the world before risking a decision.'],['03','Battle','Put the thesis against real market outcomes using virtual capital.']].map(([n,t,d]) => <div key={n} className="border-t border-[#141412] pt-5"><MicroLabel>{n}</MicroLabel><h3 className="mt-6 text-[32px] font-semibold tracking-[-0.045em]">{t}</h3><p className="mt-3 max-w-[320px] text-[14px] leading-6 text-[#55554F]">{d}</p></div>)}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E7E5DE]"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 text-[12px] text-[#8A8A84] md:flex-row md:items-center md:justify-between md:px-8"><Logo /><span>24/7 AI market laboratory · virtual capital only</span></div></footer>
    </div>
  );
}
