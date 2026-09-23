import { apiErrorSchema, type ErrorCode } from '@telinha/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  sessionKey?: string;
  signal?: AbortSignal;
}

/** Chamada à API sempre por caminho relativo (/api), em dev e produção. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.sessionKey) headers.Authorization = `Bearer ${opts.sessionKey}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError(0, 'NETWORK', 'Não foi possível falar com o servidor. Verifique sua conexão.');
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) {
      throw new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message);
    }
    throw new ApiRequestError(res.status, 'INTERNAL', 'Erro inesperado do servidor.');
  }
  return data as T;
}
