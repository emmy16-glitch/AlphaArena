import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { DecisionCapture, DecisionRecord, DecisionTapeSummary, Direction, productApi } from '../product/api';
import { ActionButton, FieldLabel, MicroLabel, SegButton, VerdictPill } from '../components/ui';

const directionLabel = (value: Direction) => value === 'LONG' ? 'Up' : value === 'SHORT' ? 'Down' : 'Wait';

export default function DecisionTapePanel({ symbol, thesis, thesisDirection, riskPct = 2 }: { symbol: string; thesis: string; thesisDirection: Direction; riskPct?: number }) {
  const [capture, setCapture] = useState<DecisionCapture | null>(null);
  const [rows, setRows] = useState<DecisionRecord[]>([]);
  const [summary, setSummary] = useState<DecisionTapeSummary | null>(null);
  const [direction, setDirection] = useState<Direction>('WAIT');
  const [confidence, setConfidence] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [tape, stats] = await Promise.all([productApi.decisionTape(), productApi.decisionSummary()]);
    setRows(tape);
    setSummary(stats);
  };

  useEffect(() => { void load().catch(() => {}); }, []);

  const captureNow = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await productApi.captureDecisionSnapshot(symbol);
      setCapture(result);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not capture the market snapshot.');
    } finally {
      setBusy(false);
    }
  };

  const submitHuman = async () => {
    if (!capture || busy) return;
    setBusy(true);
    setError('');
    try {
      await productApi.submitDecision({
        snapshot_id: capture.snapshot.id,
        lane: 'human',
        direction,
        confidence,
        model: 'human-precommitment',
        note: 'Recorded before the outcome; evaluated automatically against later Bitget candles.',
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record this decision.');
    } finally {
      setBusy(false);
    }
  };

  const runNightWatch = async () => {
    if (!capture || busy || thesis.trim().length < 8) return;
    setBusy(true);
    setError('');
    try {
      await productApi.runNightWatchDecision({
        snapshot_id: capture.snapshot.id,
        direction: thesisDirection,
        thesis: thesis.trim(),
        risk_pct: riskPct,
        holding_period: '24H',
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'NightWatch could not evaluate this snapshot.');
    } finally {
      setBusy(false);
    }
  };

  const latest = rows.slice(0, 8);
  const laneStats = summary?.lanes || {};

  return <section className="mt-6 rounded-[26px] border border-[#D9D7CF] bg-white p-6 md:p-8" aria-label="Decision Tape">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2"><Activity size={15} /><MicroLabel>Decision Tape · measured, not marketed</MicroLabel></div>
        <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.035em]">Same market. Different decision lanes.</h2>
        <p className="mt-2 max-w-[720px] text-[12px] leading-5 text-[#55554F]">Capture one Bitget market snapshot, record Human / NightWatch / Jev decisions against that exact state, then let AlphaArena score every lane at 5m, 30m, 1h and 24h. The deterministic baseline is created automatically.</p>
      </div>
      <ActionButton variant="secondary" onClick={() => void captureNow()}>{busy ? 'Capturing…' : 'Capture ' + symbol} <RefreshCw size={13} /></ActionButton>
    </div>

    {capture && <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl bg-[#F4F3EF] p-5">
        <MicroLabel>Frozen market snapshot</MicroLabel>
        <div className="mt-3 flex items-baseline justify-between gap-3"><span className="text-[18px] font-semibold">{capture.snapshot.symbol}</span><span className="mono-num text-[18px]">USD {capture.snapshot.price.toFixed(2)}</span></div>
        <div className="mt-2 text-[10px] text-[#8A8A84]">{new Date(capture.snapshot.captured_at).toLocaleString()} · snapshot {capture.snapshot.id}</div>
        <div className="mt-4 flex items-center gap-2"><VerdictPill tone="neutral">baseline</VerdictPill><span className="text-[12px] font-semibold">{capture.baseline.direction}</span><span className="mono-num text-[11px] text-[#55554F]">{capture.baseline.confidence}%</span></div>
      </div>
      <div className="rounded-2xl border border-[#E7E5DE] p-5">
        <FieldLabel>Your decision on this exact snapshot</FieldLabel>
        <div className="mt-3 flex flex-wrap gap-2">{(['LONG', 'SHORT', 'WAIT'] as Direction[]).map((item) => <SegButton key={item} active={direction === item} onClick={() => setDirection(item)}>{directionLabel(item)}</SegButton>)}</div>
        <div className="mt-4"><FieldLabel>Confidence · {confidence}%</FieldLabel><input aria-label="Decision Tape confidence" type="range" min="10" max="95" step="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="w-full accent-[#141412]" /></div>
        <ActionButton onClick={() => void submitHuman()} className="mt-4">Lock human decision</ActionButton><ActionButton variant="secondary" onClick={() => void runNightWatch()} className="mt-2">Run NightWatch on same snapshot</ActionButton>
      </div>
    </div>}

    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {['human', 'nightwatch', 'jev', 'baseline'].map((lane) => {
        const stats = laneStats[lane];
        const h = stats?.horizons?.['1h'];
        return <div key={lane} className="rounded-2xl border border-[#E7E5DE] p-4">
          <div className="flex items-center justify-between"><span className="text-[11px] font-semibold capitalize">{lane}</span><span className="mono-num text-[10px] text-[#8A8A84]">{stats?.decisions ?? 0} calls</span></div>
          <div className="mt-3 mono-num text-[22px] font-semibold">{h ? h.hit_rate_pct.toFixed(1) + '%' : '—'}</div>
          <div className="mt-1 text-[10px] text-[#8A8A84]">1h hit rate {h ? '· n=' + h.n : '· waiting for outcomes'}</div>
          {h?.brier_score != null && <div className="mt-1 text-[10px] text-[#8A8A84]">Brier {h.brier_score.toFixed(3)}</div>}
        </div>;
      })}
    </div>

    {latest.length > 0 && <div className="mt-6 divide-y divide-[#E7E5DE] border-y border-[#E7E5DE]">
      {latest.map((row) => <div key={row.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-[11px]">
        <div><span className="font-semibold capitalize">{row.lane}</span> · {row.symbol} · {row.direction} <span className="text-[#8A8A84]">{row.confidence}%</span></div>
        <div className="text-right text-[#8A8A84]">{row.latency_ms != null ? row.latency_ms.toFixed(0) + 'ms' : '—'} · {Object.keys(row.outcomes || {}).length}/4 scored</div>
      </div>)}
    </div>}

    <p className="mt-4 text-[10px] leading-4 text-[#8A8A84]">Jev is treated as one measurable lane, not an oracle. A Jev bridge submits a typed LONG / SHORT / WAIT decision plus confidence and latency against the same snapshot ID; AlphaArena owns the later market evaluation.</p>
    {error && <p className="mt-3 text-[11px] text-[#C93A3A]">{error}</p>}
  </section>;
}
