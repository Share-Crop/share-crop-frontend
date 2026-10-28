import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Import axios
import { setAuthTokenProvider } from '../services/api';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    setAuthTokenProvider(() => token);
  }, [token]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for stored token
        const storedToken = localStorage.getItem('authToken');
        if (storedToken) {
          setToken(storedToken);
          // Verify token and get user
          try {
            const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            setUser(response.data.user);
          } catch (error) {
            // Token invalid, clear it
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
          }
        }
      } catch (error) {
        console.error("Failed to initialize authentication", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
      const { user: loggedInUser, token } = response.data;
      setUser(loggedInUser);
      setToken(token);
      localStorage.setItem('authToken', token);
      localStorage.setItem('userRole', loggedInUser.user_type);
      return loggedInUser;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password, userType, profile_image_url = null, documents = [], preferred_currency = null) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, {
        name,
        email,
        password,
        user_type: userType,
        profile_image_url,
        documents,
        preferred_currency
      });
      const { user: newUser, token } = response.data;
      setUser(newUser);
      setToken(token);
      localStorage.setItem('authToken', token);
      localStorage.setItem('userRole', newUser.user_type);
      return newUser;
    } catch (error) {
      console.error("Signup failed", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    // Redirect to login page after logout
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  const updateUser = useCallback((updatedUserData) => {
    setUser((prevUser) => {
      if (!prevUser) return updatedUserData;
      return { ...prevUser, ...updatedUserData };
    });
    // Update userRole in localStorage if user_type changed
    if (updatedUserData.user_type) {
      localStorage.setItem('userRole', updatedUserData.user_type);
    }
  }, []);

  /** Convert authenticated buyer → farmer (license docs required). Issues a new JWT. */
  const becomeFarmer = useCallback(async ({ documents = [], profile_image_url = null } = {}) => {
    if (!token) throw new Error('Not authenticated');
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/become-farmer`,
      { documents, profile_image_url },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { user: nextUser, token: nextToken } = response.data;
    if (!nextUser || !nextToken) {
      throw new Error(response.data?.error || 'Become farmer failed');
    }
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem('authToken', nextToken);
    localStorage.setItem('userRole', nextUser.user_type);
    return nextUser;
  }, [token]);

  // Removed switchToRole - now using real authentication
  // Users should login/signup properly instead of switching to mock users
  const switchToRole = useCallback(async (role) => {
    // This function is kept for backward compatibility but does nothing
    // Real authentication should be used instead
    console.warn('switchToRole is deprecated. Please use proper login/signup.');
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    token,
    login,
    signup,
    logout,
    updateUser,
    becomeFarmer,
    switchToRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
