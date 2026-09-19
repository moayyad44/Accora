import { emitLoggedOut, tokenStorage } from "./token-storage";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the Authorization header and the 401-refresh dance — only the
   * public auth endpoints (login/register/refresh) need this. */
  skipAuth?: boolean;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const m = (payload as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(" — ");
    if (typeof m === "string") return m;
  }
  return fallback;
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (!options.skipAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(payload, res.statusText), payload);
  }
  return payload as T;
}

let refreshPromise: Promise<boolean> | null = null;

/** Runs a single refresh attempt no matter how many requests hit a 401 at
 * once — every caller awaits the same in-flight promise instead of each
 * firing its own POST /auth/refresh. */
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const result = await rawRequest<{ accessToken: string }>("/auth/refresh", {
          method: "POST",
          body: { refreshToken },
          skipAuth: true,
        });
        tokenStorage.setAccessToken(result.accessToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !options.skipAuth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return rawRequest<T>(path, options);
      }
      tokenStorage.clear();
      emitLoggedOut();
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: "DELETE" }),
};
