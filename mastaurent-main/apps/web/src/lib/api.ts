import { API_BASE as BASE } from './config';

let activeTenantSlug: string | null = null;

/** Нэвтрэлтийн access token. Verify.MN-ээр нэвтрэхэд энд хадгалагдана. */
const LOCAL_TOKEN_KEY = 'hool_at';
let localToken: string | null = localStorage.getItem(LOCAL_TOKEN_KEY);

export function setLocalToken(token: string | null) {
  localToken = token;
  if (token) localStorage.setItem(LOCAL_TOKEN_KEY, token);
  else localStorage.removeItem(LOCAL_TOKEN_KEY);
}

export const getLocalToken = () => localToken;

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

type Options = { method?: string; body?: unknown; tenant?: string; retry?: boolean };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Токен 15 минут насалдаг — доор 401 дээр refresh cookie-гоор сэргээнэ.
  if (localToken) headers.Authorization = `Bearer ${localToken}`;

  // Хаяг дахь /t/<slug> нь ХАМГИЙН хүчтэй дохио — хэрэглэгч яг одоо тэнд
  // байна. `activeTenantSlug` бол наалдамхай глобал утга; хуучин ресторан
  // дээр тогтоод үлдвэл захиалга, гишүүнчлэл буруу ресторанаас асуугдана.
  const tenant = opts.tenant ?? tenantFromPath() ?? activeTenantSlug;
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

  // Өөрийн access token 15 минут насалдаг — 401 дээр нэг удаа сэргээж
  // дахин оролдоно.
  if (res.status === 401 && localToken && opts.retry !== false && !path.startsWith('/auth/refresh')) {
    if (await refreshLocalToken()) return api<T>(path, { ...opts, retry: false });
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

/** Refresh cookie-гоор шинэ access token авна. Зэрэг дуудагдвал нэг л удаа явна. */
export function refreshLocalToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        setLocalToken(null);
        return false;
      }
      const data = await res.json();
      setLocalToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}
