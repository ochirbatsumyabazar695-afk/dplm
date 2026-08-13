import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { ApiError, api, getLocalToken, refreshLocalToken, setLocalToken } from '../lib/api';
import type { User } from '../lib/types';

/**
 * Нэвтрэлт нь ПЛАТФОРМЫН хэмжээнд. Нэг удаа бүртгүүлээд бүх ресторанд хандана.
 * Ресторан бүр дэх профайл, эрх нь тухайн ресторанд анх хандахад үүснэ.
 *
 * Нэвтрэх зам НЭГ: Verify.MN утасны баталгаажуулалт → өөрийн JWT.
 */

/** Платформын данс — ресторанаас хамааралгүй. */
export type Account = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Платформын админ — рестораны хүсэлтийг хянана. */
  isPlatformAdmin: boolean;
};

export const isStaff = (user: User | null | undefined) =>
  !!user && ['DIRECTOR', 'MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER'].includes(user.role);

// --- Өөрийн нэвтрэлтийн сесс -------------------------------------------------

type LocalAuth = {
  token: string | null;
  /**
   * refresh cookie-гоор сесс сэргээх оролдлого дууссан эсэх.
   * Хуудсыг шинэчлэхэд localStorage хоосон байж болно — cookie нь
   * хүчинтэй хэвээр. Энэ дуустал "нэвтрээгүй" гэж шийдэж БОЛОХГҮЙ.
   */
  restored: boolean;
  setToken: (token: string | null) => void;
  markRestored: () => void;
};

/** Токеныг реактив байлгана — нэвтэрмэгц хуудсууд шинэчлэгдэнэ. */
export const useLocalAuth = create<LocalAuth>()((set) => ({
  token: getLocalToken(),
  restored: !!getLocalToken(),
  setToken: (token) => {
    setLocalToken(token);
    set({ token });
  },
  markRestored: () => set({ restored: true }),
}));

type AuthResponse = { user: Account; accessToken: string };

export async function loginWithPassword(email: string, password: string) {
  const data = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  useLocalAuth.getState().setToken(data.accessToken);
  return data.user;
}

export async function registerWithPassword(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const data = await api<AuthResponse>('/auth/register', { method: 'POST', body: input });
  useLocalAuth.getState().setToken(data.accessToken);
  return data.user;
}

export async function startPhoneVerify(phone: string) {
  return await api<{
    ok: boolean;
    sessionId: string;
    shortcode: string;
    text: string;
    smsUri: string;
    displayInstruction: string;
    expiresAt: string;
  }>('/auth/phone/start', {
    method: 'POST',
    body: { phone },
  });
}


export async function checkPhoneVerifyStatus(sessionId: string) {
  return await api<{ verified: boolean; sessionStatus: string; phone?: string }>(`/auth/phone/status/${sessionId}`);
}

export async function verifyPhoneCode(phone: string, code?: string, sessionId?: string, name?: string) {
  const data = await api<AuthResponse>('/auth/phone/verify', {
    method: 'POST',
    body: { phone, code, sessionId, name },
  });
  useLocalAuth.getState().setToken(data.accessToken);
  return data.user;
}

export async function resetPasswordWithPhone(input: {
  phone: string;
  sessionId: string;
  code?: string;
  password: string;
}) {
  return api<{ ok: boolean }>('/auth/password/reset', { method: 'POST', body: input });
}




// --- Сесс уншигчид ----------------------------------------------------------

/**
 * Хүчингүй токеныг өөрөө цэвэрлэнэ.
 *
 * 401 = токен таарахгүй (хугацаа дууссан, эсвэл гарсны дараа үлдсэн).
 * 403 бол өөр — токен хүчинтэй, зүгээр л эрх хүрэхгүй. Түүнийг цэвэрлэхгүй.
 */
function useClearStaleToken(error: unknown) {
  const token = useLocalAuth((s) => s.token);
  const setToken = useLocalAuth((s) => s.setToken);

  useEffect(() => {
    if (token && error instanceof ApiError && error.status === 401) setToken(null);
  }, [error, token, setToken]);
}

/**
 * Хүсэлт эцсийн хариугаа өгсөн үү.
 *
 * `isLoading` хангалтгүй: react-query-д `enabled` дөнгөж асахад, эсвэл
 * кэшэд хуучин алдаа үлдээд ард нь дахин хүсэлт нисэж байхад `isLoading`
 * худлаа `false` болно. Тэр агшинд "хариу нь хоосон" гэж уншвал хамгаалагдсан
 * хуудас нэвтрэлт рүү буцаах чиглүүлэг өгчихдөг.
 */
const settled = (q: { isFetched: boolean; isFetching: boolean }) => q.isFetched && !q.isFetching;

/** Платформын сесс — нэвтэрсэн эсэх. Ресторан хамаарахгүй. */
export function useAccount() {
  const localToken = useLocalAuth((s) => s.token);
  const restored = useLocalAuth((s) => s.restored);
  const signedIn = !!localToken;

  const query = useQuery({
    queryKey: ['account'],
    queryFn: () => api<{ user: Account }>('/auth/me'),
    enabled: signedIn,
    retry: false,
    staleTime: 60_000,
  });

  useClearStaleToken(query.error);

  return {
    account: query.data?.user ?? null,
    // `restored` дуустал шийдэхгүй — refresh cookie-гоор сесс сэргэж
    // магадгүй. Тэгэхгүй бол хуудас сэргээхэд нэвтрэлт рүү шидэгдэнэ.
    ready: restored && (!signedIn || settled(query)),
    isSignedIn: signedIn,
    error: query.error instanceof ApiError ? query.error : null,
  };
}

/** Storefront: идэвхтэй рестораны профайл. Анх хандахад сервер дээр үүснэ. */
export function useMember(slug?: string) {
  const { isSignedIn, ready: accountReady } = useAccount();

  const query = useQuery({
    queryKey: ['membership', slug],
    queryFn: () => api<{ user: User }>('/auth/membership'),
    enabled: accountReady && isSignedIn && !!slug,
    retry: false,
    staleTime: 60_000,
  });

  useClearStaleToken(query.error);

  return {
    user: query.data?.user ?? null,
    ready: accountReady && (!isSignedIn || !slug || settled(query)),
    isSignedIn,
    error: query.error instanceof ApiError ? query.error : null,
  };
}

/** Dashboard: ажилтны гишүүнчлэл. Эрхгүй бол user null хэвээр (403). */
export function useStaffMember() {
  const { account, isSignedIn, ready: accountReady } = useAccount();

  const query = useQuery({
    // Түлхүүр нь энэ endpoint-д ЗӨВХӨН харьяалагдана. Өөр хуудас ижил
    // түлхүүрээр өөр хаяг татвал кэш холилдоод, энд `user` хоосон уншигдана.
    queryKey: ['auth', 'staff'],
    queryFn: () => api<{ user: User }>('/auth/staff'),
    enabled: accountReady && isSignedIn,
    retry: false,
    staleTime: 60_000,
  });

  useClearStaleToken(query.error);

  let user = query.data?.user ?? null;
  if (!user && account?.isPlatformAdmin) {
    user = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: 'DIRECTOR',
      isPlatformAdmin: true,
      avatarUrl: null,
      tenantId: '',
    };
  }

  return {
    user,
    account,
    ready: accountReady && (!isSignedIn || settled(query) || !!user),
    isSignedIn,
    error: query.error instanceof ApiError ? query.error : null,
  };
}


/** Гарах — сервер дээр tokenVersion ахиж, хуучин токенууд хүчингүй болно. */
export function useSignOut() {
  const setToken = useLocalAuth((s) => s.setToken);
  const queryClient = useQueryClient();

  return async (opts?: { redirectUrl?: string }) => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    queryClient.clear();
    if (opts?.redirectUrl) window.location.assign(opts.redirectUrl);
  };
}

/**
 * Хуудас сэргээхэд өөрийн сессийг refresh cookie-гоор сэргээнэ.
 * Дуусмагц `restored` тэмдэглэнэ — түүнээс өмнө хамгаалагдсан хуудсууд
 * "нэвтрээгүй" гэж шийдэхгүй, хүлээнэ.
 */
export async function restoreLocalSession() {
  const { markRestored, setToken } = useLocalAuth.getState();
  if (getLocalToken()) {
    markRestored();
    return;
  }
  try {
    if (await refreshLocalToken()) setToken(getLocalToken());
  } finally {
    markRestored();
  }
}
