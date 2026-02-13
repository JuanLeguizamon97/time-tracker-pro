import { msalInstance, loginRequest } from '@/config/msalConfig';

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'azure';

async function getAccessToken(): Promise<string | null> {
  if (AUTH_MODE === 'mock') return null;

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) throw new Error('No authenticated account');

  const response = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account: accounts[0],
  });
  return response.accessToken;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`API error ${response.status}: ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
