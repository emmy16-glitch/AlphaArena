import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { assets as fallbackAssets, type Asset } from '../data';
import { fetchMarketAssets, type ApiMarketAsset } from './api';

type MarketStatus = 'connecting' | 'live' | 'fallback';

type MarketDataContextValue = {
  assets: Asset[];
  status: MarketStatus;
  lastUpdated: number | null;
  error: string | null;
  refresh: () => Promise<void>;
};

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

function mergeLiveAsset(base: Asset, live: ApiMarketAsset): Asset {
  return {
    ...base,
    price: live.price,
    changePct: live.changePct,
    changeAbs: live.changeAbs,
    volume: live.volume,
    high24: live.high24,
    low24: live.low24,
    spark: live.spark.length > 2 ? live.spark : base.spark,
    session: live.source === 'bitget' ? 'Bitget · Live' : base.session,
  };
}

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>(fallbackAssets);
  const [status, setStatus] = useState<MarketStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (document.visibilityState === 'hidden' || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const liveAssets = await fetchMarketAssets(controller.signal);
      const bySymbol = new Map(liveAssets.map((asset) => [asset.symbol, asset]));
      setAssets(fallbackAssets.map((base) => {
        const live = bySymbol.get(base.symbol);
        return live ? mergeLiveAsset(base, live) : base;
      }));
      setStatus('live');
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setStatus('fallback');
      setError(err instanceof Error ? err.message : 'Live market data unavailable');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refresh]);

  const value = useMemo(() => ({ assets, status, lastUpdated, error, refresh }), [assets, status, lastUpdated, error, refresh]);
  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>;
}

export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (!context) throw new Error('useMarketData must be used inside MarketDataProvider');
  return context;
}
