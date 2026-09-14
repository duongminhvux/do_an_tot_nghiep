export interface ApiErrorPayload {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface BrowserTransportOptions {
  baseUrl: string;
  clientType: "USER_WEB" | "ADMIN_WEB";
  storageKey: string;
  createError: (payload: ApiErrorPayload, status: number) => Error;
}

export class BrowserApiTransport {
  private refreshPromise: Promise<string | null> | null = null;

  constructor(private readonly options: BrowserTransportOptions) {}

  async request<T>(
    path: string,
    init: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number | undefined>;
      retry?: boolean;
      auth?: boolean;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.options.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const token = init.auth === false ? null : this.token();
    const isFormData =
      typeof FormData !== "undefined" && init.body instanceof FormData;
    const response = await fetch(url, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body === undefined || isFormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        init.body === undefined
          ? undefined
          : isFormData
            ? (init.body as FormData)
            : JSON.stringify(init.body),
    });
    if (
      response.status === 401 &&
      init.auth !== false &&
      init.retry !== false &&
      !path.includes("/auth/refresh")
    ) {
      const refreshed = await this.refresh();
      if (refreshed) return this.request<T>(path, { ...init, retry: false });
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw this.options.createError(payload, response.status);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async requestBlob(path: string, retry = true): Promise<Blob> {
    const url = new URL(
      `${this.options.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
    );
    const token = this.token();
    const response = await fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 401 && retry) {
      const refreshed = await this.refresh();
      if (refreshed) return this.requestBlob(path, false);
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw this.options.createError(payload, response.status);
    }
    return response.blob();
  }

  private token(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const persisted = JSON.parse(localStorage.getItem(this.options.storageKey) ?? "{}") as {
        state?: { token?: string | null };
      };
      return persisted.state?.token ?? null;
    } catch {
      return null;
    }
  }

  private async refresh(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const response = await fetch(
        `${this.options.baseUrl.replace(/\/$/, "")}/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ clientType: this.options.clientType }),
        },
      );
      if (!response.ok) {
        this.storeToken(null);
        return null;
      }
      const session = (await response.json()) as { accessToken: string };
      this.storeToken(session.accessToken);
      return session.accessToken;
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private storeToken(token: string | null): void {
    if (typeof window === "undefined") return;
    try {
      const persisted = JSON.parse(localStorage.getItem(this.options.storageKey) ?? "{}") as {
        state?: Record<string, unknown>;
        version?: number;
      };
      localStorage.setItem(
        this.options.storageKey,
        JSON.stringify({
          ...persisted,
          state: { ...(persisted.state ?? {}), token, ...(token ? {} : { user: null }) },
        }),
      );
    } catch {
      localStorage.removeItem(this.options.storageKey);
    }
  }
}

export const adminEndpoints = {
  login: "/auth/login",
  logout: "/auth/logout",
  me: "/auth/me",
  refresh: "/auth/refresh",
  dashboard: "/admin/dashboard",
  students: "/admin/students",
  teachers: "/admin/teachers",
  courses: "/admin/courses",
  exercises: "/admin/exercises",
  attempts: "/admin/attempts",
  media: "/media",
  ttsJobs: "/admin/tts/jobs",
  reports: "/admin/reports",
  landing: "/admin/landing",
  siteSettings: "/admin/site-settings",
  ttsSettings: "/admin/tts/settings",
} as const;
