import { apiData } from '../lib/api';

export type ApiMarketAsset = {
  symbol: string;
  exchangeSymbol: string;
  price: number;
  changePct: number;
  changeAbs: number;
  volume: string;
  high24: number;
  low24: number;
  spark: number[];
  timestamp: number;
  source: 'bitget';
  isReality?: boolean;
  bid?: number | null;
  ask?: number | null;
  spreadBps?: number;
  turnover24h?: number;
  platformTurnover24h?: number;
};

export const fetchMarketAssets = () => apiData<ApiMarketAsset[]>('/api/market/assets', undefined, 15_000);

export const fetchMarketAsset = (symbol: string) =>
  apiData<ApiMarketAsset>(`/api/market/assets/${encodeURIComponent(symbol)}`, undefined, 15_000);
