import { lazy, Suspense, useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import type { Direction } from './product/api';

const Landing = lazy(() => import('./features/LandingScreen'));
const ConnectedAsset = lazy(() => import('./components/ConnectedAsset'));
const ConnectedPulse = lazy(() => import('./features/PulseScreen'));
const ConnectedNightWatch = lazy(() => import('./features/NightWatchScreen'));
const ConnectedLab = lazy(() => import('./features/MarketTwinScreen'));
const ConnectedTrader = lazy(() => import('./components/ConnectedTrader'));
const ConnectedArena = lazy(() => import('./features/ArenaScreens').then((module) => ({ default: module.ArenaScreen })));
const ConnectedBattle = lazy(() => import('./features/ArenaScreens').then((module) => ({ default: module.BattleScreen })));
const ConnectedPortfolio = lazy(() => import('./features/ArenaScreens').then((module) => ({ default: module.PortfolioScreen })));
const ConnectedLeaderboard = lazy(() => import('./features/ArenaScreens').then((module) => ({ default: module.LeaderboardScreen })));

type Route = { view: string; payload?: Record<string, unknown> };

const VALID_VIEWS = new Set(['landing', 'pulse', 'asset', 'nightwatch', 'lab', 'arena', 'battle', 'leaderboard', 'portfolio', 'create']);

function initialRoute(): Route {
  const state = window.history.state?.alphaArenaRoute as Route | undefined;
  if (state?.view && VALID_VIEWS.has(state.view)) return state;
  const hashView = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return { view: VALID_VIEWS.has(hashView) ? hashView : 'landing' };
}

function ScreenLoading() {
  return <div className="flex min-h-[60vh] items-center justify-center px-5" role="status" aria-live="polite"><div className="rounded-2xl border border-[#E7E5DE] bg-white px-5 py-4 text-[13px] text-[#8A8A84]">Loading AlphaArena…</div></div>;
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

  const symbol = (route.payload?.symbol as string) || 'rNVDA';
  const prompt = route.payload?.prompt as string | undefined;
  const thesis = (route.payload?.thesis as string) || '';
  const aiSide = ((route.payload?.aiSide as Direction) || 'WAIT');
  const battleId = route.payload?.id as string | undefined;

  return <Suspense fallback={<ScreenLoading />}>
    {route.view === 'landing' ? <Landing onEnter={(view) => nav(view)} /> : <AppShell view={route.view} onNav={(view) => nav(view)} onHome={() => nav('landing')} onCreate={() => nav('create')}>
      {route.view === 'pulse' && <ConnectedPulse onNav={nav} />}
      {route.view === 'asset' && <ConnectedAsset symbol={symbol} onNav={nav} />}
      {route.view === 'nightwatch' && <ConnectedNightWatch symbol={symbol} onNav={nav} />}
      {route.view === 'lab' && <ConnectedLab onNav={nav} initialPrompt={prompt} />}
      {route.view === 'arena' && <ConnectedArena onNav={nav} initialSymbol={symbol} initialThesis={thesis} initialAiSide={aiSide} />}
      {route.view === 'battle' && <ConnectedBattle onNav={nav} battleId={battleId} />}
      {route.view === 'leaderboard' && <ConnectedLeaderboard />}
      {route.view === 'portfolio' && <ConnectedPortfolio onNav={nav} />}
      {route.view === 'create' && <ConnectedTrader onNav={nav} />}
    </AppShell>}
  </Suspense>;
}
