export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface SuccessEnvelope<T> {
  data: T;
  correlationId: string;
}

interface ErrorEnvelope {
  message?: string | string[];
}

let authToken: string | undefined;

export function setAuthToken(token?: string): void {
  authToken = token;
}

const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken !== undefined) headers.authorization = `Bearer ${authToken}`;

  const response = await fetch(`${apiBase}/api/v1${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const payload: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const error = payload as ErrorEnvelope | undefined;
    const message = Array.isArray(error?.message)
      ? error.message.join(', ')
      : (error?.message ?? `Request failed (${response.status})`);
    throw new ApiError(message, response.status);
  }

  const envelope = payload as SuccessEnvelope<T> | undefined;
  return envelope !== undefined && 'data' in envelope ? envelope.data : (payload as T);
}
