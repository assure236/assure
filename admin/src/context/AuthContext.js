import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io as socketIO } from 'socket.io-client';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Set axios base URL to API root
axios.defaults.baseURL = process.env.REACT_APP_API_URL;

// Restore auth header immediately (synchronous) so first-render requests are authenticated
const _storedToken = localStorage.getItem('adminToken');
if (_storedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${_storedToken}`;
}

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { const u = localStorage.getItem('adminUser'); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));

  // Restore user info from stored token on mount (optional: decode JWT for role)
  useEffect(() => {
    const stored = localStorage.getItem('adminToken');
    if (!stored) {
      setIsAuthenticated(false);
    }
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
      socket.emit('join', `user:${user._id || user.id}`);
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
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminUser', JSON.stringify(user));
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
    setIsAuthenticated(false);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
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
