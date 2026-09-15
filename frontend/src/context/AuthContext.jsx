import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try { const { data } = await api.get('/auth/me'); setUser(data.user); return data.user; }
    catch { setUser(null); return null; }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, []);

  const value = useMemo(() => ({
    user,
    loading,
    refresh,
    login: async (payload) => {
      const { data } = await api.post('/auth/login', payload);
      if (data.user) setUser(data.user);
      return data;
    },
    logout: async () => { await api.post('/auth/logout'); setUser(null); },
    hasPermission: (permission) => Boolean(user?.role?.key === 'SUPER_ADMIN' || user?.permissions?.includes(permission))
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
