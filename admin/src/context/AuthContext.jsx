import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io as socketIO } from 'socket.io-client';

const AuthContext = createContext(null);
// SECURITY FIX: keep admin access token in memory only.
let _adminAccessToken = null;
export const getAdminAccessToken = () => _adminAccessToken;
const setAdminAccessToken = (token) => {
  _adminAccessToken = token || null;
};

export const useAuth = () => useContext(AuthContext);

// Set axios base URL to API root
axios.defaults.baseURL = process.env.REACT_APP_API_URL;
// SECURITY FIX: always include secure auth cookies in API requests.
axios.defaults.withCredentials = true;

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // SECURITY FIX: silently refresh admin session from HttpOnly refresh cookie on app load.
    const bootstrapAdminSession = async () => {
      try {
        const refreshRes = await axios.post(`${process.env.REACT_APP_API_URL}/auth/refresh-token`, {});
        const refreshedToken = refreshRes?.data?.data?.token;
        if (!refreshedToken) return;
        setAdminAccessToken(refreshedToken);
        setToken(refreshedToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${refreshedToken}`;
        const meRes = await axios.get(`${process.env.REACT_APP_API_URL}/auth/me`);
        const me = meRes?.data?.data;
        if (me && (me.role === 'admin' || me.role === 'super_admin')) {
          setUser(me);
          setIsAuthenticated(true);
        }
      } catch (_) {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      }
    };
    bootstrapAdminSession();
  }, []);

  // ─── Inactivity auto-logout (15 min) ───
  useEffect(() => {
    if (!token) return;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      localStorage.setItem('adminLastActivity', Date.now().toString());
      timer = setTimeout(() => {
        toast.warning('Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    const lastActivity = parseInt(localStorage.getItem('adminLastActivity') || '0');
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
      toast.warning('Session expired due to inactivity');
      logout();
      return;
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    const onVisibility = () => {
      if (!document.hidden) {
        const last = parseInt(localStorage.getItem('adminLastActivity') || '0');
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
      events.forEach(e => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token]);

  // ─── Socket.IO: listen for force_logout ───
  const socketRef = useRef(null);
  useEffect(() => {
    if (!token || !user) return;
    const baseUrl = (process.env.REACT_APP_API_URL || '').replace(/\/api\/v1$/, '');
    const socket = socketIO(baseUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      // Backend joins the socket to `user:${userId}` room when it receives this event.
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
  }, [token, user]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/admin-login`, {
        email,
        password
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        
        if (user.role !== 'admin' && user.role !== 'super_admin') {
          toast.error('Access denied. Admin privileges required.');
          return { success: false };
        }

        setToken(token);
        setUser(user);
        setIsAuthenticated(true);
        setAdminAccessToken(token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
    setUser(null);
    setToken(null);
    setAdminAccessToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('adminLastActivity');
    delete axios.defaults.headers.common['Authorization'];
    toast.info('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
