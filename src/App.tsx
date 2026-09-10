import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import ConnectedAsset from './components/ConnectedAsset';
import { Landing } from './components/Screens';
import {
  ConnectedArena,
  ConnectedBattle,
  ConnectedLab,
  ConnectedLeaderboard,
  ConnectedNightWatch,
  ConnectedPortfolio,
  ConnectedPulse,
} from './components/ConnectedScreens';
import ConnectedTrader from './components/ConnectedTrader';
import type { Direction } from './product/api';

type Route = { view: string; payload?: Record<string, unknown> };

const VALID_VIEWS = new Set(['landing', 'pulse', 'asset', 'nightwatch', 'lab', 'arena', 'battle', 'leaderboard', 'portfolio', 'create']);

function initialRoute(): Route {
  const state = window.history.state?.alphaArenaRoute as Route | undefined;
  if (state?.view && VALID_VIEWS.has(state.view)) return state;
  const hashView = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return { view: VALID_VIEWS.has(hashView) ? hashView : 'landing' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(initialRoute);

  const nav = (view: string, payload?: unknown) => {
    const safeView = VALID_VIEWS.has(view) ? view : 'landing';
    const next: Route = { view: safeView, payload: (payload || undefined) as Record<string, unknown> | undefined };
    window.history.pushState({ alphaArenaRoute: next }, '', safeView === 'landing' ? window.location.pathname : `#/${safeView}`);
    setRoute(next);
  };

  useEffect(() => {
    const onPop = () => setRoute(initialRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const label = route.view === 'landing' ? 'AI market laboratory' : route.view.charAt(0).toUpperCase() + route.view.slice(1);
    document.title = `${label} · AlphaArena`;
  }, [route.view]);

  if (route.view === 'landing') return <Landing onEnter={(view) => nav(view)} />;

  const symbol = (route.payload?.symbol as string) || 'rNVDA';
  const prompt = route.payload?.prompt as string | undefined;
  const thesis = (route.payload?.thesis as string) || '';
  const aiSide = ((route.payload?.aiSide as Direction) || 'WAIT');
  const battleId = route.payload?.id as string | undefined;

  return (
    <AppShell view={route.view} onNav={(view) => nav(view)} onHome={() => nav('landing')} onCreate={() => nav('create')}>
      {route.view === 'pulse' && <ConnectedPulse onNav={nav} />}
      {route.view === 'asset' && <ConnectedAsset symbol={symbol} onNav={nav} />}
      {route.view === 'nightwatch' && <ConnectedNightWatch symbol={symbol} onNav={nav} />}
      {route.view === 'lab' && <ConnectedLab onNav={nav} initialPrompt={prompt} />}
      {route.view === 'arena' && <ConnectedArena onNav={nav} initialSymbol={symbol} initialThesis={thesis} initialAiSide={aiSide} />}
      {route.view === 'battle' && <ConnectedBattle onNav={nav} battleId={battleId} />}
      {route.view === 'leaderboard' && <ConnectedLeaderboard />}
      {route.view === 'portfolio' && <ConnectedPortfolio onNav={nav} />}
      {route.view === 'create' && <ConnectedTrader onNav={nav} />}
    </AppShell>
  );
}
