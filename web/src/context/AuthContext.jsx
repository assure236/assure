import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import { securityLogger } from '../utils/securityLogger';
import { getSocketUrl } from '../config/env';

const AuthContext = createContext(null);
let _accessToken = null;
export const getAccessToken = () => _accessToken;
const setAccessToken = (token) => {
  _accessToken = token || null;
};

let sessionBootstrapPromise = null;
let inactivityRedirectHandler = null;

export const registerInactivityRedirect = (handler) => {
  inactivityRedirectHandler = typeof handler === 'function' ? handler : null;
};

const refreshSessionFromCookie = () => {
  if (!sessionBootstrapPromise) {
    sessionBootstrapPromise = axios
      .post('/auth/refresh-token', {}, { withCredentials: true })
      .then((res) => {
        if (res?.data?.success && res?.data?.data?.token) {
          return res.data.data.token;
        }
        return null;
      })
      .catch(() => null);
  }
  return sessionBootstrapPromise;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
const ACTIVITY_PERSIST_INTERVAL = 30 * 1000;

const getLastActivityMs = () => parseInt(localStorage.getItem('lastActivity') || '0', 10);

const isInactivityExpired = (now = Date.now()) => {
  const last = getLastActivityMs();
  if (!last) return false;
  return now - last >= INACTIVITY_TIMEOUT;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const profileLoadedRef = useRef(false);
  const lastActivityMsRef = useRef(getLastActivityMs() || Date.now());
  const lastActivityWriteMsRef = useRef(0);
  const inactivityTimerRef = useRef(null);
  const inactivityIntervalRef = useRef(null);
  const logoutRef = useRef(null);

  const persistActivity = (force = false) => {
    const now = Date.now();
    lastActivityMsRef.current = now;
    if (force || now - lastActivityWriteMsRef.current >= ACTIVITY_PERSIST_INTERVAL) {
      lastActivityWriteMsRef.current = now;
      localStorage.setItem('lastActivity', String(now));
    }
  };

  const touchActivity = (force = false) => {
    persistActivity(force);
  };

  const applyToken = (accessToken, { recordActivity = true } = {}) => {
    setAccessToken(accessToken);
    setToken(accessToken);
    if (recordActivity) touchActivity(true);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  const fetchSessionUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data);
        profileLoadedRef.current = true;
      }
    } catch (error) {
      securityLogger.error('Session user fetch failed', { status: error?.response?.status });
      if (error.response?.status === 401) {
        logout({ silent: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrapSession = async () => {
      try {
        axios.defaults.withCredentials = true;

        const storedActivity = getLastActivityMs();
        if (storedActivity > 0) {
          lastActivityMsRef.current = storedActivity;
        }

        if (isInactivityExpired()) {
          await axios.post('/auth/logout', {}, { withCredentials: true }).catch(() => {});
          localStorage.removeItem('lastActivity');
          setLoading(false);
          return;
        }

        const newToken = await refreshSessionFromCookie();
        if (!mounted) return;

        if (!newToken) {
          setLoading(false);
          return;
        }

        applyToken(newToken, { recordActivity: false });
        await fetchSessionUser();
      } catch (_) {
        if (mounted) setLoading(false);
      } finally {
        if (mounted) setBootstrapDone(true);
      }
    };

    bootstrapSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapDone) return;
    axios.defaults.withCredentials = true;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, [token, bootstrapDone]);

  useEffect(() => {
    if (!token) return;

    const logoutForInactivity = () => {
      toast.warning('Session expired due to inactivity');
      logoutRef.current?.({ silent: true });
      inactivityRedirectHandler?.();
    };

    const isIdleExpired = () => {
      const stored = getLastActivityMs();
      const last = stored > 0
        ? Math.max(lastActivityMsRef.current, stored)
        : lastActivityMsRef.current;
      return Date.now() - last >= INACTIVITY_TIMEOUT;
    };

    const scheduleInactivityLogout = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      const stored = getLastActivityMs();
      const last = stored > 0
        ? Math.max(lastActivityMsRef.current, stored)
        : lastActivityMsRef.current;
      const elapsed = Date.now() - last;
      const remaining = INACTIVITY_TIMEOUT - elapsed;
      if (remaining <= 0) {
        logoutForInactivity();
        return;
      }
      inactivityTimerRef.current = setTimeout(logoutForInactivity, remaining);
    };

    const resetTimer = () => {
      persistActivity();
      scheduleInactivityLogout();
    };

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('digilocker')) {
      touchActivity(true);
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    scheduleInactivityLogout();

    inactivityIntervalRef.current = setInterval(() => {
      if (isIdleExpired()) {
        logoutForInactivity();
      }
    }, 15000);

    const onVisibility = () => {
      if (document.hidden) {
        localStorage.setItem('lastActivity', String(lastActivityMsRef.current));
        return;
      }
      const stored = getLastActivityMs();
      if (stored > 0) {
        lastActivityMsRef.current = Math.max(lastActivityMsRef.current, stored);
      }
      if (isIdleExpired()) {
        logoutForInactivity();
      } else {
        scheduleInactivityLogout();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (inactivityIntervalRef.current) clearInterval(inactivityIntervalRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token]);

  const socketRef = useRef(null);
  useEffect(() => {
    if (!token || !user) return;
    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnectionAttempts: 3 });
    socketRef.current = socket;
    socket.on('connect', () => {
      const userId = user._id || user.id;
      if (userId) socket.emit('join', userId);
    });
    socket.on('force_logout', (data) => {
      toast.warning(data?.message || 'You have been logged out from all devices.');
      logout();
    });
    socket.on('force_logout_web', (data) => {
      toast.warning(data?.message || 'You have been logged out because a new web login was detected.');
      logout();
    });
    socket.on('new_login_detected', (data) => {
      toast.info(data?.message || 'New login detected on another device.');
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?._id]);

  const login = async (credentials) => {
    try {
      const response = await axios.post('/auth/login', credentials);

      if (response.data.success) {
        const { token: accessToken, user: loginUser } = response.data.data;
        sessionBootstrapPromise = null;
        profileLoadedRef.current = false;
        applyToken(accessToken);
        setUser(loginUser);
        setLoading(false);
        profileLoadedRef.current = true;
        toast.success('Login successful!');
        return { success: true };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);

      if (response.data.success) {
        const { token: accessToken, user: registeredUser } = response.data.data;
        sessionBootstrapPromise = null;
        profileLoadedRef.current = false;
        applyToken(accessToken);
        setUser(registeredUser);
        setLoading(false);
        profileLoadedRef.current = true;
        toast.success('Registration successful!');
        return { success: true };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = ({ silent = false } = {}) => {
    sessionBootstrapPromise = null;
    profileLoadedRef.current = false;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (inactivityIntervalRef.current) {
      clearInterval(inactivityIntervalRef.current);
      inactivityIntervalRef.current = null;
    }
    setUser(null);
    setToken(null);
    setAccessToken(null);
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('active_member_id');
    delete axios.defaults.headers.common['Authorization'];
    axios.post('/auth/logout', {}, { withCredentials: true }).catch(() => {});
    if (!silent) toast.info('Logged out successfully');
  };

  logoutRef.current = logout;

  const loginWithToken = (newToken, newUser) => {
    sessionBootstrapPromise = null;
    profileLoadedRef.current = true;
    applyToken(newToken);
    setUser(newUser);
    setLoading(false);
    setBootstrapDone(true);
    localStorage.removeItem('active_member_id');
  };

  const logoutAllDevices = async () => {
    try {
      await axios.post('/auth/logout-all', {});
      toast.success('Logged out from all devices');
    } catch (_) {
      toast.error('Could not logout all devices');
    }
    logout();
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/users/profile', profileData);

      if (response.data.success) {
        const activeId = localStorage.getItem('active_member_id');
        if (!activeId) {
          setUser(response.data.data);
        }
        toast.success('Profile updated successfully');
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Update failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const value = {
    user,
    loading,
    bootstrapDone,
    login,
    register,
    logout,
    logoutAllDevices,
    loginWithToken,
    updateProfile,
    isAuthenticated: Boolean(token && user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
