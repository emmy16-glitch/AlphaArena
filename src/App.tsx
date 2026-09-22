import { lazy, Suspense, useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import type { DecisionSession } from './product/decisionSessions';

const Home = lazy(() => import('./features/HomeScreen'));
const Research = lazy(() => import('./features/ResearchScreen'));
const ArenaHub = lazy(() => import('./features/ArenaHubScreen'));
const History = lazy(() => import('./features/HistoryScreen'));
// Legacy deep modules remain reachable through the new IA aliases below.
const ConnectedAsset = lazy(() => import('./components/ConnectedAsset'));
const ConnectedPulse = lazy(() => import('./features/PulseScreen'));
const ConnectedNightWatch = lazy(() => import('./features/NightWatchScreen'));
const ConnectedLab = lazy(() => import('./features/MarketTwinScreen'));
const ConnectedMorgue = lazy(() => import('./features/MorgueScreen'));
const ConnectedTrackRecord = lazy(() => import('./features/TrackRecordScreen'));
const ConnectedPortfolio = lazy(() =>
  import('./features/ArenaScreens').then((m) => ({ default: m.PortfolioScreen })),
);
const ConnectedLeaderboard = lazy(() =>
  import('./features/ArenaScreens').then((m) => ({ default: m.LeaderboardScreen })),
);

type Route = { view: string; payload?: Record<string, unknown> };

// Legacy views are preserved as aliases so old links keep working.
const ALIASES: Record<string, string> = {
  landing: 'home',
  pulse: 'research',
  asset: 'research',
  nightwatch: 'research',
  lab: 'research',
  battle: 'arena',
  morgue: 'history',
  leaderboard: 'history',
  portfolio: 'history',
  'track-record': 'history',
  create: 'research',
};

const VALID_VIEWS = new Set([
  'home',
  'research',
  'arena',
  'history',
  'landing',
  'pulse',
  'asset',
  'nightwatch',
  'lab',
  'battle',
  'morgue',
  'leaderboard',
  'portfolio',
  'track-record',
  'create',
]);

function canonical(view: string): string {
  return ALIASES[view] || view;
}

function initialRoute(): Route {
  const state = window.history.state?.alphaArenaRoute as Route | undefined;
  if (state?.view && VALID_VIEWS.has(state.view)) return state;
  const hashView = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return { view: VALID_VIEWS.has(hashView) ? hashView : 'home' };
}

function ScreenLoading() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-5"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-[#E7E5DE] bg-white px-5 py-4 text-[13px] text-[#8A8A84]">
        Loading AlphaArena…
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [arenaBattleId, setArenaBattleId] = useState<string | undefined>(undefined);
  const [arenaSession, setArenaSession] = useState<DecisionSession | null>(null);
  const [homeSymbol, setHomeSymbol] = useState('rNVDA');

  const nav = (view: string, payload?: unknown) => {
    const safeView = VALID_VIEWS.has(view) ? view : 'home';
    const next: Route = {
      view: safeView,
      payload: (payload || undefined) as Record<string, unknown> | undefined,
    };
    window.history.pushState(
      { alphaArenaRoute: next },
      '',
      safeView === 'home' ? window.location.pathname : `#/${safeView}`,
    );
    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>;
      if (typeof p.symbol === 'string') setHomeSymbol(p.symbol);
      if (typeof p.id === 'string') setArenaBattleId(p.id);
    }
    setRoute(next);
  };

  useEffect(() => {
    const onPop = () => setRoute(initialRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const label = route.view.charAt(0).toUpperCase() + route.view.slice(1);
    document.title = `${label} · AlphaArena`;
  }, [route.view]);

  const view = canonical(route.view);
  const symbol = (route.payload?.symbol as string) || homeSymbol;
  const battleId = (route.payload?.id as string) || arenaBattleId;

  const enterArena = (id: string, session: DecisionSession) => {
    setArenaBattleId(id);
    setArenaSession(session);
    nav('arena', { id });
  };

  return (
    <Suspense fallback={<ScreenLoading />}>
      <AppShell
        view={view}
        onNav={(v) => nav(v)}
        onHome={() => nav('home')}
        onSearch={(s) => {
          setHomeSymbol(s);
          nav('home', { symbol: s });
        }}
      >
        {view === 'home' && (
          <Home onNav={nav} initialSymbol={symbol} onEnterArena={enterArena} />
        )}
        {view === 'research' && <Research onNav={nav} symbol={symbol} />}
        {view === 'arena' && (
          <ArenaHub
            onNav={nav}
            battleId={battleId}
            session={arenaSession}
            initialSymbol={symbol}
            initialThesis={(route.payload?.thesis as string) || ''}
          />
        )}
        {view === 'history' && <History onNav={nav} />}
        {/* Legacy deep links render inside the new IA so nothing is deleted. */}
        {route.view === 'asset' && <ConnectedAsset symbol={symbol} onNav={nav} />}
        {route.view === 'pulse' && <ConnectedPulse onNav={nav} />}
        {route.view === 'nightwatch' && <ConnectedNightWatch symbol={symbol} onNav={nav} />}
        {route.view === 'lab' && (
          <ConnectedLab onNav={nav} initialPrompt={route.payload?.prompt as string | undefined} />
        )}
        {route.view === 'morgue' && <ConnectedMorgue onNav={nav} />}
        {route.view === 'track-record' && <ConnectedTrackRecord onNav={nav} />}
        {route.view === 'portfolio' && <ConnectedPortfolio onNav={nav} />}
        {route.view === 'leaderboard' && <ConnectedLeaderboard />}
      </AppShell>
    </Suspense>
  );
}
