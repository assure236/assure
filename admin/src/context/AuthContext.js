import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Set axios base URL to API root
axios.defaults.baseURL = process.env.REACT_APP_API_URL;

// Restore auth header immediately (synchronous) so first-render requests are authenticated
const _storedToken = localStorage.getItem('adminToken');
if (_storedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${_storedToken}`;
}

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
    delete axios.defaults.headers.common['Authorization'];
    toast.info('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
