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

let redirectingToLogin = false;

/**
 * Sessão expirada ou inválida: apaga o cookie (senão ele continua sendo enviado e a sessão nunca
 * se resolve) e vai para o login com recarga completa, descartando o cache. Várias requisições
 * que recebem 401 ao mesmo tempo disparam um único redirecionamento.
 */
async function goToLogin(): Promise<never> {
  if (!redirectingToLogin) {
    redirectingToLogin = true;
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
      () => undefined,
    );
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/login?expired=1&next=${next}`);
  }
  // Fica pendente até a página trocar: a tela não chega a mostrar o erro.
  return new Promise<never>(() => undefined);
}

/** Chama a API pelo proxy do Next (/api/*). Corpo `FormData` vai como multipart. */
export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  // No login, 401 é só senha errada: o erro aparece no formulário.
  if (response.status === 401 && path !== '/auth/login') return goToLogin();
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Erro inesperado. Tente de novo.';
}
