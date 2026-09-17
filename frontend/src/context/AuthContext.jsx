import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { invalidateRequestCache } from '../api/requestCache';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const { data } = await api.get('/auth/me'); setUser(data.user); return data.user; }
    catch { setUser(null); return null; }
    finally { setLoading(false); }
  }, []);

  const login = useCallback(async (payload) => {
    invalidateRequestCache();
    const { data } = await api.post('/auth/login', payload);
    if (data.user) setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    invalidateRequestCache();
    setUser(null);
  }, []);

  const hasPermission = useCallback((permission) => Boolean(user?.role?.key === 'SUPER_ADMIN' || user?.permissions?.includes(permission)), [user]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ user, loading, refresh, login, logout, hasPermission }), [user, loading, refresh, login, logout, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
