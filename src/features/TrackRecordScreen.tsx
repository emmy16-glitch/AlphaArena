import { useEffect, useState } from 'react';
import { Crosshair, RefreshCw } from 'lucide-react';
import { type TrackRecord, productApi } from '../product/api';
import { ActionButton, FieldLabel, Hairline, MicroLabel } from '../components/ui';

type Nav = (view: string, payload?: unknown) => void;

function CurveChart({ record }: { record: TrackRecord }) {
  const width = 320;
  const height = 220;
  const padLeft = 34;
  const padBottom = 26;
  const padTop = 12;
  const padRight = 12;
  const x = (stated: number) => padLeft + ((stated - 50) / 50) * (width - padLeft - padRight);
  const y = (rate: number) => padTop + (1 - rate / 100) * (height - padTop - padBottom);
  const points = record.curve.filter((bucket) => bucket.n > 0 && bucket.win_rate !== null);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Calibration curve: stated confidence versus observed paper win rate" className="h-auto w-full">
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={padLeft} x2={width - padRight} y1={y(tick)} y2={y(tick)} stroke="#E7E5DE" strokeWidth="1" />
          <text x={padLeft - 5} y={y(tick) + 3.5} textAnchor="end" fontSize="9" fill="#8A8A84">{tick}%</text>
        </g>
      ))}
      {[50, 60, 70, 80, 90, 100].map((tick) => (
        <text key={tick} x={x(tick)} y={height - 10} textAnchor="middle" fontSize="9" fill="#8A8A84">{tick}%</text>
      ))}
      <line x1={x(50)} y1={y(50)} x2={x(100)} y2={y(100)} stroke="#8A8A84" strokeWidth="1" strokeDasharray="4 4" />
      <text x={width - padRight} y={y(100) - 5} textAnchor="end" fontSize="9" fill="#8A8A84">Perfect calibration</text>
      {points.length > 1 && (
        <polyline
          points={points.map((bucket) => `${x(bucket.stated_midpoint)},${y(bucket.win_rate as number)}`).join(' ')}
          fill="none"
          stroke="#141412"
          strokeWidth="2"
        />
      )}
      {points.map((bucket) => (
        <g key={bucket.bucket}>
          <circle cx={x(bucket.stated_midpoint)} cy={y(bucket.win_rate as number)} r="5" fill="#1D3DFF" />
          <text x={x(bucket.stated_midpoint)} y={y(bucket.win_rate as number) - 10} textAnchor="middle" fontSize="9" fill="#55554F">
            {bucket.bucket} · n={bucket.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function TrackRecordScreen({ onNav }: { onNav: Nav }) {
  const [record, setRecord] = useState<TrackRecord | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      setRecord(await productApi.trackRecord());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Track record is unavailable right now.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <MicroLabel>Track record · Paper only</MicroLabel>
          <h1 className="mt-3 text-[42px] font-semibold tracking-[-0.055em] sm:text-[48px] md:text-[60px]">
            Is your confidence <span className="serif-italic font-normal text-[#55554F]">calibrated?</span>
          </h1>
          <p className="mt-3 max-w-[720px] text-[15px] leading-6 text-[#55554F]">
            One paper battle proves nothing. This page aggregates every settled battle you recorded and checks whether the confidence you stated matched what happened.
          </p>
        </div>
        <Crosshair className="hidden text-[#D9D7CF] md:block" size={46} strokeWidth={1.2} aria-hidden="true" />
      </div>

      <div className="mt-8 rounded-[28px] border border-[#D9D7CF] bg-white p-5 md:p-8" aria-live="polite" aria-busy={record === null && !error}>
        {error && (
          <div>
            <MicroLabel>Track record unavailable</MicroLabel>
            <p className="mt-3 rounded-xl bg-[#FBEAEA] p-3 text-[13px] leading-5 text-[#A92E3A]">{error}</p>
            <ActionButton variant="secondary" onClick={() => void load()} className="mt-4">
              <RefreshCw size={14} /> Try again
            </ActionButton>
          </div>
        )}

        {!error && record === null && (
          <div>
            <MicroLabel>Reading your paper history</MicroLabel>
            <div className="mt-5 space-y-3">
              {['Collect settled battles', 'Compare stated confidence to outcomes', 'Build the calibration curve'].map((step) => (
                <div key={step} className="flex items-center gap-3 border-b border-[#DDDCD5] py-3">
                  <span className="shimmer-bar h-2 w-2 rounded-full" />
                  <span className="text-[13px]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!error && record !== null && record.settled_battles === 0 && (
          <div>
            <MicroLabel>No settled battles yet</MicroLabel>
            <h2 className="mt-4 max-w-[620px] text-[30px] font-semibold tracking-[-0.04em]">Your record starts with your first settled battle.</h2>
            <p className="mt-4 max-w-[610px] text-[14px] leading-6 text-[#55554F]">
              Record a paper battle in the Arena with a stated confidence. When it settles at the observed market price, it will count here.
            </p>
            <ActionButton onClick={() => onNav('arena')} className="mt-6">Open Arena</ActionButton>
          </div>
        )}

        {!error && record !== null && record.settled_battles > 0 && record.insufficient_data && (
          <div>
            <MicroLabel>Not enough history yet</MicroLabel>
            <h2 className="mt-4 max-w-[620px] text-[30px] font-semibold tracking-[-0.04em]">
              {record.scored_battles} of {record.settled_battles} settled battles carry a stated confidence. Scores unlock at {record.min_settled_battles}.
            </h2>
            <p className="mt-4 max-w-[610px] text-[14px] leading-6 text-[#55554F]">
              A calibration score built on this little history would be misleading, so none is shown. Keep recording battles with an honest confidence and come back.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton onClick={() => onNav('arena')}>Record another battle</ActionButton>
              <ActionButton variant="secondary" onClick={() => void load()}>
                <RefreshCw size={14} /> Refresh
              </ActionButton>
            </div>
          </div>
        )}

        {!error && record !== null && !record.insufficient_data && (
          <div>
            <MicroLabel>Your aggregate record · {record.scored_battles} scored battles</MicroLabel>
            <div className="mt-6 rounded-2xl border border-[#141412]/10 bg-[#FAF9F6] p-5 md:p-6">
              <MicroLabel className="text-[#1D3DFF]">In simple terms</MicroLabel>
              <p className="mt-3 text-[15px] leading-7 text-[#2A2A28]">
                You win {record.win_rate.toFixed(1)}% of paper battles. Your calibration error is {record.brier_score?.toFixed(3)} (lower is better; 0.25 means no better than always saying 50%).
                This describes your past paper record only — it is not proof of a repeatable edge.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#E7E5DE] bg-[#FAF9F6] p-5">
                <FieldLabel>Paper win rate</FieldLabel>
                <div className="mono-num mt-2 text-[30px] font-semibold">{record.win_rate.toFixed(1)}%</div>
                <p className="mt-2 text-[11px] leading-5 text-[#8A8A84]">Share of settled battles with positive paper PnL.</p>
              </div>
              <div className="rounded-2xl border border-[#E7E5DE] bg-[#FAF9F6] p-5">
                <FieldLabel>Calibration error (Brier)</FieldLabel>
                <div className="mono-num mt-2 text-[30px] font-semibold">{record.brier_score?.toFixed(3)}</div>
                <p className="mt-2 text-[11px] leading-5 text-[#8A8A84]">Baseline guessing your average: {record.brier_baseline?.toFixed(3)}. Below baseline means your confidence carried information.</p>
              </div>
              <div className="rounded-2xl border border-[#E7E5DE] bg-[#FAF9F6] p-5">
                <FieldLabel>Scored battles</FieldLabel>
                <div className="mono-num mt-2 text-[30px] font-semibold">{record.scored_battles}</div>
                <p className="mt-2 text-[11px] leading-5 text-[#8A8A84]">{record.settled_battles} settled in total; only battles with a stated confidence count.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#D9D7CF] bg-white p-5">
              <MicroLabel>Calibration curve</MicroLabel>
              <p className="mt-2 text-[12px] leading-5 text-[#55554F]">
                Each point compares the confidence you stated with how often those battles actually won. Points above the dashed line mean under-confidence; below it mean over-confidence.
              </p>
              <div className="mt-4"><CurveChart record={record} /></div>
              <Hairline className="my-4" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[.12em] text-[#8A8A84]">
                      <th className="py-2 pr-3">Stated confidence</th>
                      <th className="py-2 pr-3">Battles</th>
                      <th className="py-2">Observed win rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.curve.map((bucket) => (
                      <tr key={bucket.bucket} className="border-t border-[#E7E5DE]">
                        <td className="py-2 pr-3 font-semibold">{bucket.bucket}</td>
                        <td className="mono-num py-2 pr-3">{bucket.n}</td>
                        <td className="mono-num py-2">{bucket.win_rate === null ? '—' : `${bucket.win_rate.toFixed(1)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-[12px] leading-5 text-[#8A8A84]">{record.disclaimer}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton variant="secondary" onClick={() => onNav('arena')}>Record another battle</ActionButton>
              <ActionButton variant="ghost" onClick={() => void load()}>
                <RefreshCw size={14} /> Refresh
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
