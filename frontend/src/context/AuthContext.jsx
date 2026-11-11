import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';

const AuthContext = createContext({
  user: null,
  loading: true,
  unverifiedEmail: null,
  login: async () => {},
  loginWithGoogle: async () => {},
  register: async () => {},
  requestOrganizer: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
  setUnverifiedEmail: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authService.getMe();
      setUser(res?.user || null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (username, password) => {
    try {
      setUnverifiedEmail(null);
      const res = await authService.login({ username, password });
      setUser(res.user);
      return res;
    } catch (err) {
      if (err.data?.unverified) {
        setUnverifiedEmail(err.data.email || username);
      }
      throw err;
    }
  };

  const register = async (payload) => {
    return authService.register(payload);
  };

  const loginWithGoogle = async (googlePayload) => {
    setUnverifiedEmail(null);
    const res = await authService.loginWithGoogle(googlePayload);
    setUser(res.user);
    return res;
  };

  const requestOrganizer = async (payload) => {
    const res = await authService.requestOrganizer(payload);
    setUser(res.user);
    return res;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unverifiedEmail,
        login,
        loginWithGoogle,
        register,
        requestOrganizer,
        logout,
        refreshUser,
        setUnverifiedEmail,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
