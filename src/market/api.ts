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
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AlphaArena API ${response.status}: ${response.statusText}`);
  return response.json() as Promise<T>;
}

export async function fetchMarketAssets(): Promise<ApiMarketAsset[]> {
  const payload = await request<{ data: ApiMarketAsset[] }>('/api/market/assets');
  return payload.data;
}

export async function fetchMarketAsset(symbol: string): Promise<ApiMarketAsset> {
  const payload = await request<{ data: ApiMarketAsset }>(`/api/market/assets/${encodeURIComponent(symbol)}`);
  return payload.data;
}
