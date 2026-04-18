// src/hooks/useApi.js — API client with retry logic
import { useTelegram } from './useTelegram';

const BASE_URL = '/api';
const MAX_RETRIES = 3;

export function useApi() {
  const { initData } = useTelegram();

  async function request(path, options = {}, attempt = 1) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
          ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt < MAX_RETRIES && !['401', '403', '400'].some(c => err.message.includes(c))) {
        await new Promise(r => setTimeout(r, 500 * attempt));
        return request(path, options, attempt + 1);
      }
      throw err;
    }
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
  };
}
