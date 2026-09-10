import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Check, Shield } from 'lucide-react';
import { useMarketData } from '../market/MarketDataContext';
import { TraderProfile, productApi } from '../product/api';
import { ActionButton, FieldLabel, Hairline, MicroLabel, SegButton } from './ui';

type Nav = (view: string, payload?: unknown) => void;

type Style = TraderProfile['style'];
type Horizon = TraderProfile['holding_period'];

export default function ConnectedTrader({ onNav }: { onNav: Nav }) {
  const { assets } = useMarketData();
  const [name, setName] = useState('Night Drift');
  const [style, setStyle] = useState<Style>('Event-driven');
  const [risk, setRisk] = useState(50);
  const [horizon, setHorizon] = useState<Horizon>('24H');
  const [selected, setSelected] = useState<string[]>(['rNVDA', 'rTSLA', 'rAAPL']);
  const [profiles, setProfiles] = useState<TraderProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<TraderProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void productApi.traders().then(setProfiles).catch(() => {});
  }, []);

  const toggle = (symbol: string) => {
    setSelected((current) => current.includes(symbol) ? current.filter((x) => x !== symbol) : [...current, symbol]);
  };

  const save = async () => {
    if (saving || name.trim().length < 2 || selected.length === 0) return;
    setSaving(true); setError(''); setSaved(null);
    try {
      const profile = await productApi.createTrader({
        name: name.trim(), style, risk_appetite: risk, holding_period: horizon, assets: selected,
      });
      setSaved(profile);
      setProfiles((rows) => [profile, ...rows]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save trader');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-up">
      <MicroLabel>Create trader · Virtual only</MicroLabel>
      <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="max-w-[820px] text-[44px] font-semibold tracking-[-0.055em] md:text-[60px]">Build a point of view, <span className="serif-italic font-normal text-[#55554F]">not a magic bot.</span></h1>
          <p className="mt-3 max-w-[650px] text-[14px] leading-6 text-[#55554F]">Create an AI opponent profile for paper battles. It controls analysis style and risk posture, never real-money permissions.</p>
        </div>
        <Bot size={44} strokeWidth={1.25} className="hidden text-[#D9D7CF] md:block" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[26px] border border-[#E7E5DE] bg-white p-6 md:p-8">
          <div><FieldLabel>Name</FieldLabel><input value={name} onChange={(e)=>setName(e.target.value)} className="w-full rounded-xl border border-[#D9D7CF] bg-[#FAF9F6] px-4 py-3 text-[14px] outline-none focus:border-[#141412]" /></div>
          <div className="mt-6"><FieldLabel>Thinking style</FieldLabel><div className="flex flex-wrap gap-2">{(['Event-driven','Momentum','Contrarian','Risk-first'] as Style[]).map((s)=><SegButton key={s} active={style===s} onClick={()=>setStyle(s)}>{s}</SegButton>)}</div></div>
          <div className="mt-6"><FieldLabel>Risk appetite · {risk}/100</FieldLabel><input type="range" min="10" max="90" value={risk} onChange={(e)=>setRisk(Number(e.target.value))} className="w-full accent-[#141412]"/><div className="mt-2 flex justify-between text-[10px] text-[#8A8A84]"><span>Protect capital</span><span>Seek volatility</span></div></div>
          <div className="mt-6"><FieldLabel>Default horizon</FieldLabel><div className="flex flex-wrap gap-2">{(['1H','6H','24H','7D','30D'] as Horizon[]).map((h)=><SegButton key={h} active={horizon===h} onClick={()=>setHorizon(h)}>{h}</SegButton>)}</div></div>
          <div className="mt-6"><FieldLabel>Assets</FieldLabel><div className="flex flex-wrap gap-2">{assets.slice(0,6).map((a)=><button key={a.symbol} onClick={()=>toggle(a.symbol)} className={`rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all ${selected.includes(a.symbol)?'border-[#141412] bg-[#141412] text-white':'border-[#D9D7CF] bg-white text-[#55554F]'}`}>{a.symbol}</button>)}</div></div>
          <ActionButton onClick={()=>void save()} className="mt-8">{saving?'Saving…':'Save virtual trader'} <ArrowRight size={14}/></ActionButton>
          {error&&<p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}
          {saved&&<div className="mt-5 flex items-center gap-2 rounded-xl bg-[#E6F4EC] px-4 py-3 text-[12px] font-medium text-[#0D7A4F]"><Check size={14}/> {saved.name} is ready for virtual Arena battles.</div>}
        </section>

        <aside className="rounded-[26px] bg-[#141412] p-6 text-white md:p-8">
          <MicroLabel className="text-white/45">Profile preview</MicroLabel>
          <h2 className="mt-5 text-[31px] font-semibold tracking-[-0.04em]">{name || 'Unnamed trader'}</h2>
          <p className="mt-2 text-[13px] text-white/55">{style} · {horizon} horizon</p>
          <div className="mt-8 border-y border-white/15 py-5"><div className="flex items-center justify-between text-[12px]"><span className="text-white/50">Risk appetite</span><span className="mono-num">{risk}/100</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white" style={{width:`${risk}%`}}/></div></div>
          <div className="mt-6"><div className="text-[10px] uppercase tracking-[.12em] text-white/40">Universe</div><div className="mt-3 flex flex-wrap gap-2">{selected.map((s)=><span key={s} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px]">{s}</span>)}</div></div>
          <div className="mt-8 flex gap-2 text-[11px] leading-5 text-white/50"><Shield size={15} className="mt-0.5 shrink-0"/><span>Virtual-only by design. This profile can argue, simulate and compete, but it is never given a Bitget trading key.</span></div>
          <Hairline className="my-7 bg-white/15" />
          <div className="text-[11px] text-white/45">{profiles.length} saved profile{profiles.length===1?'':'s'} in the current AlphaArena data store.</div>
          {saved&&<ActionButton variant="secondary" onClick={()=>onNav('arena',{aiSide:'WAIT'})} className="mt-5 border-white/20 bg-white text-black">Take it to Arena</ActionButton>}
        </aside>
      </div>
    </div>
  );
}
