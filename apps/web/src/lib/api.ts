export interface ApiIssue {
  path: string;
  message: string;
}

/** Erro devolvido pela API no formato `{ error: { code, message, issues? } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: ApiIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; issues?: ApiIssue[] };
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  return new ApiError(
    response.status,
    body.error?.code ?? `HTTP_${response.status}`,
    body.error?.message ?? 'Não foi possível concluir a operação.',
    body.error?.issues ?? [],
  );
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Chama a API pelo proxy do Next (/api/*). Corpo `FormData` vai como multipart. */
export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (response.status === 401 && path !== '/auth/login') {
    // Sessão expirada ou inválida: volta para o login com recarga completa, descartando o cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Erro inesperado. Tente de novo.';
}
