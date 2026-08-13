import { create } from 'zustand';
import { api, setAccessToken, tryRefresh } from '../lib/api';
import type { User } from '../lib/types';

type AuthState = {
  user: User | null;
  ready: boolean; // эхний refresh шалгалт дууссан эсэх
  login: (tenant: string, email: string, password: string) => Promise<User>;
  register: (
    tenant: string,
    input: { name: string; email: string; phone: string; password: string },
  ) => Promise<User>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,

  login: async (tenant, email, password) => {
    const { user, accessToken } = await api<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      tenant,
    });
    setAccessToken(accessToken);
    set({ user });
    return user;
  },

  register: async (tenant, input) => {
    const { user, accessToken } = await api<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: input,
      tenant,
    });
    setAccessToken(accessToken);
    set({ user });
    return user;
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      set({ user: null });
    }
  },

  /** Хуудас сэргээхэд сессийг сэргээнэ. */
  bootstrap: async () => {
    const ok = await tryRefresh();
    if (!ok) return set({ ready: true, user: null });
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      set({ user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
}));

export const isStaff = (user: User | null) =>
  !!user && (user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'STAFF');
