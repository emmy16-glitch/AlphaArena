import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { productApi, type PaperLogRow } from '../product/api';
import { MicroLabel } from '../components/ui';
import { cn } from '../utils/cn';

function outcomeOf(row: PaperLogRow): { label: string; tone: string } {
  if (row.status === 'live' || row.exit_price == null) return { label: 'Pending', tone: 'bg-[#F1F2F4] text-[#4B5563]' };
  if (row.pnl_pct > 0.05) return { label: 'Correct', tone: 'bg-[#E6F4EC] text-[#0D7A4F]' };
  if (row.pnl_pct < -0.05) return { label: 'Incorrect', tone: 'bg-[#FBEAEA] text-[#C93A3A]' };
  return { label: 'Flat', tone: 'bg-[#F1F2F4] text-[#4B5563]' };
}

export default function HistoryTapeTable() {
  const [rows, setRows] = useState<PaperLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asset, setAsset] = useState('All Assets');
  const [outcome, setOutcome] = useState('All Outcomes');
  const [range, setRange] = useState('Last 30 Days');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    productApi
      .paperLog()
      .then((data) => { if (active) setRows(Array.isArray(data) ? data : []); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Decision tape unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const assets = useMemo(() => ['All Assets', ...Array.from(new Set(rows.map((r) => r.asset)))], [rows]);

  const visible = useMemo(() => {
    const now = Date.now();
    const cutoff = range === 'Last 7 Days' ? now - 7 * 86_400_000 : range === 'Last 30 Days' ? now - 30 * 86_400_000 : 0;
    return rows.filter((row) => {
      if (asset !== 'All Assets' && row.asset !== asset) return false;
      if (cutoff > 0) {
        const t = new Date(row.timestamp).getTime();
        if (Number.isFinite(t) && t < cutoff) return false;
      }
      if (outcome !== 'All Outcomes' && outcomeOf(row).label !== outcome) return false;
      if (query.trim() && !`${row.thesis} ${row.asset} ${row.battle_id}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, asset, outcome, range, query]);

  return (
    <section aria-label="Decision tape" data-testid="history-tape" className="rounded-2xl border border-[#ECEDEF] bg-white p-5 md:p-6">
      <MicroLabel>Decision Tape · paper record</MicroLabel>
      <h2 className="mt-2 text-[20px] font-extrabold tracking-tight text-[#111315]">From idea to outcome. A complete, verifiable record.</h2>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="tape-asset">Filter by asset</label>
        <select id="tape-asset" value={asset} onChange={(e) => setAsset(e.target.value)}
          className="min-h-10 rounded-xl border border-[#E4E6E9] bg-white px-3 text-[12.5px] font-semibold text-[#1A1D21] outline-none focus:border-[#111315]">
          {assets.map((a) => <option key={a} value={a}>{a === 'All Assets' ? a : a.replace(/^r/, '')}</option>)}
        </select>
        <label className="sr-only" htmlFor="tape-outcome">Filter by outcome</label>
        <select id="tape-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}
          className="min-h-10 rounded-xl border border-[#E4E6E9] bg-white px-3 text-[12.5px] font-semibold text-[#1A1D21] outline-none focus:border-[#111315]">
          {['All Outcomes', 'Correct', 'Incorrect', 'Pending', 'Flat'].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <label className="sr-only" htmlFor="tape-range">Filter by date</label>
        <select id="tape-range" value={range} onChange={(e) => setRange(e.target.value)}
          className="min-h-10 rounded-xl border border-[#E4E6E9] bg-white px-3 text-[12.5px] font-semibold text-[#1A1D21] outline-none focus:border-[#111315]">
          {['Last 7 Days', 'Last 30 Days', 'All time'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="relative ml-auto inline-flex min-h-10 min-w-[200px] flex-1 items-center sm:max-w-[260px]">
          <Search size={14} className="pointer-events-none absolute left-3 text-[#9AA0A8]" />
          <label className="sr-only" htmlFor="tape-search">Search decisions</label>
          <input id="tape-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search thesis or asset"
            className="min-h-10 w-full rounded-xl border border-[#E4E6E9] bg-white pl-9 pr-3 text-[12.5px] outline-none placeholder:text-[#9AA0A8] focus:border-[#111315]" />
        </span>
      </div>

      <div aria-live="polite">
        {loading && (
          <div className="mt-4 space-y-2" role="status" aria-label="Loading decision tape">
            {[0, 1, 2].map((i) => <div key={i} className="shimmer-bar h-12 rounded-xl" />)}
          </div>
        )}
        {error && !loading && <p role="alert" className="mt-4 rounded-xl bg-[#FBEAEA] p-3 text-[12.5px] text-[#A92E2E]">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-[#D9D7CF] bg-[#FAFAF8] p-6 text-center text-[13px] text-[#6B7280]">
            No paper decisions match these filters yet. Record a thesis battle in the Arena — it lands here with its receipt.
          </p>
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#ECEDEF]">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFAF8] text-[10.5px] uppercase tracking-[0.08em] text-[#6B7280]">
                  <th className="px-4 py-3 font-bold">Date &amp; Time</th>
                  <th className="px-4 py-3 font-bold">Asset</th>
                  <th className="px-4 py-3 font-bold">Thesis</th>
                  <th className="px-4 py-3 font-bold">Participants</th>
                  <th className="px-4 py-3 font-bold">Outcome</th>
                  <th className="px-4 py-3 text-right font-bold">P&amp;L (Paper)</th>
                  <th className="px-4 py-3 text-right font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F4]">
                {visible.slice(0, 30).map((row) => {
                  const o = outcomeOf(row);
                  const live = row.status === 'live';
                  return (
                    <tr key={row.battle_id + row.timestamp} className="align-top">
                      <td className="mono-num whitespace-nowrap px-4 py-3 text-[#4B5563]">
                        {new Date(row.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-[#111315]">{row.asset.replace(/^r/, '')}</td>
                      <td className="max-w-[260px] px-4 py-3 text-[#1A1D21]"><span className="block truncate" title={row.thesis}>{row.thesis}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">{row.direction} vs {row.opponent_side}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold', o.tone)}>{o.label}</span>
                      </td>
                      <td className={cn('mono-num whitespace-nowrap px-4 py-3 text-right font-bold', row.pnl_pct >= 0 ? 'text-[#0D7A4F]' : 'text-[#C93A3A]')}>
                        {row.pnl_pct >= 0 ? '+' : ''}{row.pnl_pct.toFixed(1)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-semibold', live ? 'text-[#0D7A4F]' : 'text-[#6B7280]')}>
                          {live && <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                          {live ? 'Live' : 'Settled'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-[#9AA0A8]">Paper-only log from /api/arena/export.json — every row carries a settlement hash. Never a recommendation.</p>
    </section>
  );
}
