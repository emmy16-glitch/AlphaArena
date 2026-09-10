import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import { AssetDetail, CreateTrader, Landing } from './components/Screens';
import {
  ConnectedArena,
  ConnectedBattle,
  ConnectedLab,
  ConnectedLeaderboard,
  ConnectedNightWatch,
  ConnectedPortfolio,
  ConnectedPulse,
} from './components/ConnectedScreens';
import type { Direction } from './product/api';

type Route = { view: string; payload?: Record<string, unknown> };

export default function App() {
  const [route, setRoute] = useState<Route>({ view: 'landing' });
  const nav = (view: string, payload?: unknown) => setRoute({ view, payload: (payload || undefined) as Record<string, unknown> | undefined });
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [route.view]);

  if (route.view === 'landing') return <Landing onEnter={(view) => nav(view)} />;

  const symbol = (route.payload?.symbol as string) || 'rNVDA';
  const prompt = route.payload?.prompt as string | undefined;
  const thesis = (route.payload?.thesis as string) || '';
  const aiSide = ((route.payload?.aiSide as Direction) || 'WAIT');
  const battleId = route.payload?.id as string | undefined;

  return (
    <AppShell view={route.view} onNav={(view) => nav(view)} onHome={() => nav('landing')} onCreate={() => nav('create')}>
      {route.view === 'pulse' && <ConnectedPulse onNav={nav} />}
      {route.view === 'asset' && <AssetDetail symbol={symbol} onNav={nav} />}
      {route.view === 'nightwatch' && <ConnectedNightWatch symbol={symbol} onNav={nav} />}
      {route.view === 'lab' && <ConnectedLab onNav={nav} initialPrompt={prompt} />}
      {route.view === 'arena' && <ConnectedArena onNav={nav} initialSymbol={symbol} initialThesis={thesis} initialAiSide={aiSide} />}
      {route.view === 'battle' && <ConnectedBattle onNav={nav} battleId={battleId} />}
      {route.view === 'leaderboard' && <ConnectedLeaderboard />}
      {route.view === 'portfolio' && <ConnectedPortfolio onNav={nav} />}
      {route.view === 'create' && <CreateTrader onNav={nav} />}
    </AppShell>
  );
}
