import { useState } from 'react';
import { productApi } from '../product/api';
import { ActionButton } from './ui';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'timestamp,battle_id,asset,direction,entry_price,exit_price,quantity,stake,status,pnl_pct,pnl_dollars,account_balance_after,settled_at,settlement_hash,thesis\n';
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((k) => escape(row[k])).join(','))].join('\n');
}

export default function ExportPaperLogButtons() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const download = async (format: 'csv' | 'json') => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const rows = await productApi.paperLog();
      const blob = new Blob(
        [format === 'csv' ? toCsv(rows as unknown as Record<string, unknown>[]) : JSON.stringify({ data: rows }, null, 2)],
        { type: format === 'csv' ? 'text/csv' : 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'csv' ? 'alphaarena-paper-log.csv' : 'alphaarena-paper-log.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${rows.length} paper battles. Hash-verify with backend/scripts/verify_battles.py.`);
    } catch {
      setMessage('Paper log is unavailable right now. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton variant="secondary" onClick={() => void download('csv')}>
        {busy ? 'Preparing…' : 'Export CSV'}
      </ActionButton>
      <ActionButton variant="ghost" onClick={() => void download('json')}>
        Export JSON
      </ActionButton>
      {message && <span className="text-[11px] text-[#55554F]" role="status">{message}</span>}
    </div>
  );
}
