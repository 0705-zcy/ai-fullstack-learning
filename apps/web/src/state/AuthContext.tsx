import type { User } from '@aifs/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/index.js';

interface AuthContextValue {
  user: User | null;
  /** 首次校验会话是否仍在进行中。 */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 会话状态。
 *
 * 真源是后端 httpOnly cookie，前端只在内存里镜像一份用户信息——
 * 刷新页面时用 /api/auth/me 重新确认，而不是把用户信息存 localStorage。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .me()
      .then((result) => {
        if (!cancelled) setUser(result.user);
      })
      .catch(() => {
        // 401 是正常情况（还没登录），不需要报错
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const result = await api.register(
        displayName ? { email, password, displayName } : { email, password },
      );
      setUser(result.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // 即使接口失败也要清掉本地状态，否则用户会卡在「已登录」的假象里
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 <AuthProvider> 内部使用');
  }
  return context;
}
