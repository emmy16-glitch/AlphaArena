import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FlaskConical, ShieldCheck, Swords } from 'lucide-react';
import { fmtPrice } from '../data';
import { useMarketData } from '../market/MarketDataContext';
import { PulseEvent, productApi } from '../product/api';
import { Hairline, MicroLabel, Pnl, Sparkline, VerdictPill } from './ui';

type Nav = (view: string, payload?: unknown) => void;

function std(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length);
}

export default function ConnectedAsset({ symbol, onNav }: { symbol: string; onNav: Nav }) {
  const { assets, status } = useMarketData();
  const asset = assets.find((item) => item.symbol === symbol) || assets[0];
  const [pulse, setPulse] = useState<PulseEvent | null>(null);

  useEffect(() => {
    let alive = true;
    void productApi.pulse().then((events) => {
      if (alive) setPulse(events.find((event) => event.symbol === asset.symbol) || null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [asset.symbol]);

  const metrics = useMemo(() => {
    const values = asset.spark.filter((value) => value > 0);
    const changes = values.slice(1).map((value, index) => ((value / values[index]) - 1) * 100);
    const realised = std(changes) * Math.sqrt(Math.max(1, changes.length));
    const range = asset.price > 0 ? ((asset.high24 - asset.low24) / asset.price) * 100 : 0;
    return { realised, range };
  }, [asset]);

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <MicroLabel>Reality asset · Bitget</MicroLabel>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2"><h1 className="text-[48px] font-semibold tracking-[-0.055em] md:text-[64px]">{asset.symbol}</h1><span className="text-[16px] text-[#8A8A84]">{asset.name}</span></div>
          <div className="mt-3 flex items-baseline gap-4"><span className="mono-num text-[30px] font-semibold">${fmtPrice(asset.price)}</span><Pnl value={asset.changePct} className="text-[14px]" /></div>
        </div>
        <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-[#0D7A4F]' : 'bg-[#9A6B00]'}`} /><span className="text-[11px] text-[#8A8A84]">{status === 'live' ? 'Live Bitget market feed' : 'Preview until market API connects'}</span></div>
      </div>

      <section className="mt-8 overflow-hidden rounded-[28px] border border-[#D9D7CF] bg-white">
        <div className="p-5 md:p-8"><Sparkline data={asset.spark} width={960} height={240} className="h-[220px] w-full md:h-[260px]" /></div>
        <div className="grid grid-cols-2 border-t border-[#E7E5DE] md:grid-cols-4">{[
          ['24H high', `$${fmtPrice(asset.high24)}`], ['24H low', `$${fmtPrice(asset.low24)}`], ['24H volume', asset.volume], ['24H range', `${metrics.range.toFixed(2)}%`],
        ].map(([label, value]) => <div key={label} className="border-r border-[#E7E5DE] p-4 last:border-r-0"><MicroLabel>{label}</MicroLabel><div className="mono-num mt-2 text-[17px] font-semibold">{value}</div></div>)}</div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[24px] border border-[#E7E5DE] bg-white p-6">
          <div className="flex items-start justify-between gap-4"><div><MicroLabel>NightWatch context</MicroLabel><h2 className="mt-3 text-[24px] font-semibold tracking-[-0.035em]">{pulse?.title || 'No live anomaly verdict yet.'}</h2></div>{pulse && <VerdictPill tone={pulse.severity === 'elevated' ? 'warn' : 'neutral'}>{pulse.score}/100</VerdictPill>}</div>
          <p className="mt-4 text-[13px] leading-6 text-[#55554F]">{pulse?.summary || `The current market snapshot shows ${asset.changePct >= 0 ? '+' : ''}${asset.changePct.toFixed(2)}% over 24 hours. Open NightWatch to challenge a specific trade thesis instead of treating price movement as a recommendation.`}</p>
          <Hairline className="my-6" />
          <div className="grid gap-4 sm:grid-cols-2"><div><MicroLabel>Short-window realised volatility</MicroLabel><div className="mono-num mt-2 text-[20px] font-semibold">{metrics.realised.toFixed(2)}%</div></div><div><MicroLabel>Market principle</MicroLabel><div className="mt-2 text-[12px] font-medium">Evidence before conviction.</div></div></div>
        </section>
        <section className="rounded-[24px] bg-[#141412] p-6 text-white"><MicroLabel className="text-white/45">What next?</MicroLabel><h2 className="serif-italic mt-4 text-[28px] leading-9">One asset. Three ways to test the idea.</h2><div className="mt-7 space-y-2"><button onClick={() => onNav('nightwatch', { symbol: asset.symbol })} className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left text-[13px] font-semibold text-black"><span className="flex items-center gap-2"><ShieldCheck size={15} />Challenge a thesis</span><ArrowRight size={14} /></button><button onClick={() => onNav('lab', { prompt: `What if Nasdaq falls 5% while ${asset.symbol} is trading?` })} className="flex w-full items-center justify-between rounded-xl border border-white/15 px-4 py-3 text-left text-[13px] font-medium"><span className="flex items-center gap-2"><FlaskConical size={15} />Simulate a shock</span><ArrowRight size={14} /></button><button onClick={() => onNav('arena', { symbol: asset.symbol })} className="flex w-full items-center justify-between rounded-xl border border-white/15 px-4 py-3 text-left text-[13px] font-medium"><span className="flex items-center gap-2"><Swords size={15} />Start a paper battle</span><ArrowRight size={14} /></button></div></section>
      </div>

      <div className="mt-6 text-[10.5px] leading-5 text-[#8A8A84]">Market values are informational. AlphaArena does not treat a live price, scenario estimate, or NightWatch verdict as financial advice.</div>
    </div>
  );
}
