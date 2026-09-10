import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import { Arena, AssetDetail, Battle, CreateTrader, Lab, Landing, Leaderboard, NightWatch, Portfolio, Pulse } from './components/Screens';

type Route = { view: string; payload?: Record<string, unknown> };

export default function App() {
  const [route, setRoute] = useState<Route>({ view: 'landing' });
  const nav = (view: string, payload?: unknown) => setRoute({ view, payload: (payload || undefined) as Record<string, unknown> | undefined });
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [route.view]);
  if (route.view === 'landing') return <Landing onEnter={(view) => nav(view)} />;
  return (
    <AppShell view={route.view} onNav={(view) => nav(view)} onHome={() => nav('landing')} onCreate={() => nav('create')}>
      {route.view === 'pulse' && <Pulse onNav={nav} />}
      {route.view === 'asset' && <AssetDetail symbol={(route.payload?.symbol as string) || 'rNVDA'} onNav={nav} />}
      {route.view === 'nightwatch' && <NightWatch onNav={nav} />}
      {route.view === 'lab' && <Lab onNav={nav} />}
      {route.view === 'arena' && <Arena onNav={nav} />}
      {route.view === 'battle' && <Battle onNav={nav} />}
      {route.view === 'leaderboard' && <Leaderboard />}
      {route.view === 'portfolio' && <Portfolio onNav={nav} />}
      {route.view === 'create' && <CreateTrader onNav={nav} />}
    </AppShell>
  );
}
