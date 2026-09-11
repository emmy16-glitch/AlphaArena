const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');

export type ApiProblem = {
  error?: {
    code?: string;
    message?: string;
    action?: string;
    retryable?: boolean;
  };
  detail?: unknown;
};

function defaultMessage(status: number): string {
  if (status === 404) return 'We couldn’t find that item.';
  if (status === 409) return 'That action can’t be completed yet. Refresh and try again.';
  if (status === 422) return 'Some information is missing or invalid. Check your entries and try again.';
  if (status === 429) return 'That’s moving too fast. Wait a moment and try again.';
  if ([502, 503, 504].includes(status)) return 'Live market data or research is taking longer than usual. Try again in a moment.';
  if (status >= 500) return 'AlphaArena hit a temporary problem. Nothing was submitted. Try again.';
  return 'We couldn’t complete that action. Check your entries and try again.';
}

const GUEST_PLAYER_KEY = 'alphaarena.guest-player-id';

function guestPlayerId(): string {
  const existing = window.localStorage.getItem(GUEST_PLAYER_KEY);
  if (existing) return existing;
  const id = `guest_${typeof crypto.randomUUID === 'function' ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(GUEST_PLAYER_KEY, id);
  return id;
}

function humanMessage(status: number, body: ApiProblem | null): string {
  const problem = body?.error;
  if (problem?.message && typeof problem.message === 'string') {
    const action = problem.action && typeof problem.action === 'string' ? ` ${problem.action}` : '';
    return `${problem.message.trim()}${action}`.trim();
  }
  return defaultMessage(status);
}

async function readJson(response: Response): Promise<unknown> {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit, timeoutMs = 75_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Player-ID': guestPlayerId(),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(humanMessage(response.status, (body || null) as ApiProblem | null));
    }
    if (body === null || body === undefined) {
      throw new Error('AlphaArena returned an empty response. Try again.');
    }
    return body as T;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new Error('This is taking longer than expected. Please try again.');
    }
    if (cause instanceof Error) {
      const text = cause.message.trim();
      const looksTechnical = /(?:ECONN|ENOTFOUND|Failed to fetch|NetworkError|TypeError:|Traceback|http:\/\/|https:\/\/|\b5\d\d\b)/i.test(text);
      if (!looksTechnical) throw cause;
    }
    throw new Error('We can’t reach AlphaArena right now. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function apiData<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const payload = await apiRequest<{ data?: T }>(path, init, timeoutMs);
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new Error('AlphaArena returned an unexpected response. Please try again.');
  }
  return payload.data as T;
}
