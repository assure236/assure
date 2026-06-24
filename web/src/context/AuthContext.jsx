import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import { securityLogger } from '../utils/securityLogger';

const AuthContext = createContext(null);
// SECURITY FIX: keep access token in memory (not localStorage).
let _accessToken = null;
export const getAccessToken = () => _accessToken;
const setAccessToken = (token) => {
  _accessToken = token || null;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const touchActivity = () => {
    localStorage.setItem('lastActivity', Date.now().toString());
  };

  useEffect(() => {
    // SECURITY FIX: silently refresh web session from HttpOnly refresh cookie on app load.
    const bootstrapSession = async () => {
      try {
        axios.defaults.withCredentials = true;
        const refreshRes = await axios.post('/auth/refresh-token', {});
        const newToken = refreshRes?.data?.data?.token;
        if (!newToken) {
          setLoading(false);
          return;
        }
        setAccessToken(newToken);
        setToken(newToken);
        touchActivity();
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        await fetchUserProfile();
      } catch (_) {
        setLoading(false);
      } finally {
        setBootstrapDone(true);
      }
    };
    bootstrapSession();
  }, []);

  // Set axios defaults
  useEffect(() => {
    // SECURITY FIX: avoid premature redirect while refresh bootstrap is still in-flight.
    if (!bootstrapDone) return;
    // SECURITY FIX: always include secure auth cookies in API requests.
    axios.defaults.withCredentials = true;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  // ─── Inactivity auto-logout (15 min) ───
  useEffect(() => {
    if (!token) return;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      localStorage.setItem('lastActivity', Date.now().toString());
      timer = setTimeout(() => {
        toast.warning('Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    // If returning from DigiLocker, refresh the activity timestamp
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('digilocker')) {
      localStorage.setItem('lastActivity', Date.now().toString());
    }

    // Check if already expired (e.g. tab was in background)
    const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0');
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
      toast.warning('Session expired due to inactivity');
      logout();
      return;
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the timer

    // Also check on visibility change (tab refocus)
    const onVisibility = () => {
      if (!document.hidden) {
        const last = parseInt(localStorage.getItem('lastActivity') || '0');
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

  // ─── Socket: listen for force_logout from logout-all-devices ───
  const socketRef = useRef(null);
  useEffect(() => {
    if (!token || !user) return;
    const SOCKET_URL = process.env.REACT_APP_API_URL
      ? process.env.REACT_APP_API_URL.replace('/api/v1', '')
      : window.location.origin;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnectionAttempts: 3 });
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
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token, user?._id]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('/users/profile', { skipActiveMember: true });
      if (response.data.success) setUser(response.data.data);
    } catch (error) {
      // SECURITY FIX: avoid exposing raw auth/profile errors in console logs.
      securityLogger.error('Profile fetch failed', { status: error?.response?.status });
      // Only force logout on definitive auth failure, not network/rate-limit errors
      if (error.response?.status === 401) {
        logout();
        return;
      }
      // Keep the cached user so reload doesn't log out
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await axios.post(
        '/auth/login',
        credentials
      );

      if (response.data.success) {
        const { token: accessToken, user } = response.data.data;
        setAccessToken(accessToken);
        setToken(accessToken);
        setUser(user);
        touchActivity();
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
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
      const response = await axios.post(
        '/auth/register',
        userData
      );

      if (response.data.success) {
        const { token: accessToken, user } = response.data.data;
        setAccessToken(accessToken);
        setToken(accessToken);
        setUser(user);
        touchActivity();
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        toast.success('Registration successful!');
        return { success: true };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAccessToken(null);
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('active_member_id');
    delete axios.defaults.headers.common['Authorization'];
    toast.info('Logged out successfully');
  };

  // Used by QR login — mobile app confirms the scan and web gets token directly
  const loginWithToken = (newToken, newUser) => {
    setAccessToken(newToken);
    setToken(newToken);
    setUser(newUser);
    // SECURITY FIX: reset idle timer for QR/OTP login so stale timestamps don't force immediate logout.
    touchActivity();
    localStorage.removeItem('active_member_id');
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
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
      const response = await axios.put(
        '/users/profile',
        profileData
      );

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
    token,
    loading,
    login,
    register,
    logout,
    logoutAllDevices,
    loginWithToken,
    updateProfile,
    isAuthenticated: !!token && !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
