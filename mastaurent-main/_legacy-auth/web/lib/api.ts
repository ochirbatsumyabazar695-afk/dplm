const BASE = '/api';

let accessToken: string | null = localStorage.getItem('hool_at');
let activeTenantSlug: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem('hool_at', token);
  else localStorage.removeItem('hool_at');
}

export const getAccessToken = () => accessToken;

/** Аль ресторантай ажиллаж буйг бүх хүсэлтэд X-Tenant-аар дамжуулна. */
export function setActiveTenant(slug: string | null) {
  activeTenantSlug = slug;
}

/** Даатгал: хаягнаас нь уншина. Компонентын дараалалд хамаарахгүй. */
function tenantFromPath(): string | null {
  return window.location.pathname.match(/^\/t\/([^/]+)/)?.[1] ?? null;
}

export class ApiError extends Error {
  /** status 0 = сүлжээний алдаа: сервер огт хариу өгсөнгүй. */
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const OFFLINE = 'Сервертэй холбогдож чадсангүй';

/** API дөнгөж асаж байгаа / дахин ачаалж байгаа гэсэн үг — дахин оролдох утгатай. */
export const isOffline = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status === 503);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Options = { method?: string; body?: unknown; tenant?: string; retry?: boolean };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const tenant = opts.tenant ?? activeTenantSlug ?? tenantFromPath();
  if (tenant) headers['X-Tenant'] = tenant;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? 'GET',
      headers,
      credentials: 'include',
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    // fetch өөрөө унасан = сүлжээ/сервер байхгүй. JSON биш тул доош явуулахгүй.
    throw new ApiError(0, OFFLINE);
  }

  // Access token дууссан бол refresh cookie-гоор нэг удаа сэргээж дахин оролдоно.
  if (res.status === 401 && opts.retry !== false && !path.startsWith('/auth/refresh')) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, { ...opts, retry: false });
  }

  // Сервер унасан үед proxy HTML/хоосон буцааж мэднэ — JSON.parse-ыг хамгаална.
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) throw new ApiError(res.status, 'Серверээс буруу хариу ирлээ');
    }
  }

  if (!res.ok) {
    const message = typeof data.message === 'string' ? data.message : null;
    throw new ApiError(res.status, message ?? (res.status === 503 ? OFFLINE : 'Алдаа гарлаа'));
  }
  return data as T;
}

let refreshing: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    // API дөнгөж асаж байхад сессийг дэмий алдахгүйн тулд хэдэн удаа оролдоно.
    // 401 бол жинхэнэ хариу — тэр даруй зогсоно.
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
          if (res.status === 503 && attempt < 3) {
            await sleep(400 * 2 ** attempt);
            continue;
          }
          if (!res.ok) {
            setAccessToken(null);
            return false;
          }
          const data = await res.json();
          setAccessToken(data.accessToken);
          return true;
        } catch {
          if (attempt >= 3) return false;
          await sleep(400 * 2 ** attempt);
        }
      }
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}
