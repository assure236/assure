import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io as socketIO } from 'socket.io-client';

const AuthContext = createContext(null);
let _adminAccessToken = null;
let sessionBootstrapPromise = null;

export const getAdminAccessToken = () => _adminAccessToken;
const setAdminAccessToken = (token) => {
  _adminAccessToken = token || null;
};

export const useAuth = () => useContext(AuthContext);

axios.defaults.baseURL = process.env.REACT_APP_API_URL;
axios.defaults.withCredentials = true;

const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

const pickAdminUser = (user) => {
  if (!user) return null;
  return {
    id: user.id || user._id,
    _id: user._id || user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionRestoredRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const bootstrapAdminSession = async () => {
      try {
        if (!sessionBootstrapPromise) {
          sessionBootstrapPromise = axios
            .post('/auth/refresh-token', {})
            .then((res) => res?.data?.data?.token || null)
            .catch(() => null);
        }
        const refreshedToken = await sessionBootstrapPromise;
        if (!mounted || !refreshedToken) return;

        sessionRestoredRef.current = true;
        setAdminAccessToken(refreshedToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${refreshedToken}`;

        const meRes = await axios.get('/auth/me');
        const me = meRes?.data?.data;
        if (me && (me.role === 'admin' || me.role === 'super_admin')) {
          setUser(pickAdminUser(me));
          setIsAuthenticated(true);
        }
      } catch (_) {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrapAdminSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      localStorage.setItem('adminLastActivity', Date.now().toString());
      timer = setTimeout(() => {
        toast.warning('Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    if (!sessionRestoredRef.current) {
      const lastActivity = parseInt(localStorage.getItem('adminLastActivity') || '0', 10);
      if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        toast.warning('Session expired due to inactivity');
        logout();
        return;
      }
    }
    sessionRestoredRef.current = false;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    const onVisibility = () => {
      if (!document.hidden) {
        const last = parseInt(localStorage.getItem('adminLastActivity') || '0', 10);
        if (last && Date.now() - last > INACTIVITY_TIMEOUT) {
          toast.warning('Session expired due to inactivity');
          logout();
        } else {
          resetTimer();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated]);

  const socketRef = useRef(null);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const baseUrl = (process.env.REACT_APP_API_URL || '').replace(/\/api\/v1$/, '');
    const socket = socketIO(baseUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('join', user._id || user.id);
    });
    socket.on('force_logout', () => {
      toast.warning('You have been logged out from all devices');
      logout();
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?._id]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/admin-login', { email, password });

      if (response.data.success) {
        const { token, user: loginUser } = response.data.data;

        if (loginUser.role !== 'admin' && loginUser.role !== 'super_admin') {
          toast.error('Access denied. Admin privileges required.');
          return { success: false };
        }

        sessionBootstrapPromise = null;
        setAdminAccessToken(token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(pickAdminUser(loginUser));
        setIsAuthenticated(true);
        localStorage.setItem('adminLastActivity', Date.now().toString());
        toast.success('Login successful!');
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      return { success: false };
    }
  };

  const logout = () => {
    sessionBootstrapPromise = null;
    setUser(null);
    setAdminAccessToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('adminLastActivity');
    delete axios.defaults.headers.common['Authorization'];
    axios.post('/auth/logout', {}, { withCredentials: true }).catch(() => {});
    toast.info('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
