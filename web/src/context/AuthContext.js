import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Restore user from localStorage cache on startup
const restoreUser = () => {
  try {
    const cached = localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
};

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(restoreUser);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Set axios defaults
  useEffect(() => {
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
      const response = await axios.get('/users/profile');
      if (response.data.success) {
        setUser(response.data.data);
        localStorage.setItem('user', JSON.stringify(response.data.data));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
        const { token, user } = response.data.data;
        setToken(token);
        setUser(user);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
        const { token, user } = response.data.data;
        setToken(token);
        setUser(user);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('active_member_id');
    delete axios.defaults.headers.common['Authorization'];
    toast.info('Logged out successfully');
  };

  // Used by QR login — mobile app confirms the scan and web gets token directly
  const loginWithToken = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
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
        setUser(response.data.data);
        localStorage.setItem('user', JSON.stringify(response.data.data));
        toast.success('Profile updated successfully');
        return { success: true };
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
