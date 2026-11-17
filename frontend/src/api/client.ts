// The fetch wrapper. Every error from the API becomes one ApiError, with the
// message, any field errors (422) and any details (409).

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  details: Record<string, unknown>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}, details = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

export const CANT_REACH = "Can't reach Accountable's server. Check that npm run dev is still running.";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, CANT_REACH);
  }

  if (response.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const payload = (data ?? {}) as { message?: string; errors?: Record<string, string>; details?: object };
    if (response.status >= 500 && !payload.message) {
      throw new ApiError(response.status, CANT_REACH);
    }
    throw new ApiError(
      response.status,
      payload.message ?? "Something went wrong. Try again.",
      payload.errors ?? {},
      (payload.details ?? {}) as Record<string, unknown>,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}
