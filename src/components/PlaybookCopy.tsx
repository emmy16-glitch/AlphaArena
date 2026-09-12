import { useState } from 'react';
import type { TwinResponse } from '../product/api';
import { twinToPlaybookText } from '../lib/playbook';
import { ActionButton } from './ui';

export default function PlaybookCopyButton({ result }: { result: TwinResponse }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(twinToPlaybookText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ActionButton variant="secondary" onClick={() => void copy()}>
      {copied ? 'Copied Playbook config' : 'Copy Playbook config'}
    </ActionButton>
  );
}
