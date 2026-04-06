import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated (only after auth finishes loading)
  React.useEffect(() => {
    // Wait for auth to finish loading, then check if user is actually authenticated
    if (!authLoading && isAuthenticated && localStorage.getItem('authToken')) {
      const userType = localStorage.getItem('userRole');
      if (userType === 'admin') {
        navigate('/admin', { replace: true });
      } else if (userType === 'farmer') {
        navigate('/farmer', { replace: true });
      } else if (userType === 'buyer') {
        navigate('/buyer', { replace: true });
      } else {
        navigate('/browse', { replace: true });
      }
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Redirect based on user type or return to previous page
      const from = location.state?.from?.pathname || '/';
      const userType = localStorage.getItem('userRole');

      // If coming from a protected route, go back there
      if (from !== '/' && from !== '/login' && from !== '/signup') {
        navigate(from, { replace: true });
      } else {
        // Otherwise redirect based on user type
        if (userType === 'admin') {
          navigate('/admin', { replace: true });
        } else if (userType === 'farmer') {
          navigate('/farmer', { replace: true });
        } else {
          navigate('/buyer', { replace: true });
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: '#f5f7fa',
      }}
    >
      {/* Left Side - Full Coverage GIF */}
      <Box
        sx={{
          flex: { xs: 0, md: '0 0 50%' },
          display: { xs: 'none', md: 'block' },
          width: '50%',
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <img
          src="/assets/farmers.gif"
          alt="Farmers Animation"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />
        {/* ShareCrop Logo Overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            textAlign: 'center',
          }}
        >
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              fontSize: { md: '3rem', lg: '4.5rem' },
              background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #66BB6A 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              lineHeight: 1.2,
              textShadow: `
                -1px -1px 0 rgba(255, 255, 255, 0.6),
                1px -1px 0 rgba(255, 255, 255, 0.6),
                -1px 1px 0 rgba(255, 255, 255, 0.6),
                1px 1px 0 rgba(255, 255, 255, 0.6),
                0 0 10px rgba(255, 255, 255, 0.3)
              `,
            }}
          >
            <span style={{
              fontSize: '1.2em',
            }}>🌱</span>
            ShareCrop
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mt: 2,
              color: '#ffffff',
              fontSize: { md: '1rem', lg: '1.2rem' },
              fontWeight: 600,
              letterSpacing: '0.5px',
              textShadow: `
                0 0 6px rgba(255, 255, 255, 0.7),
                0 0 10px rgba(76, 175, 80, 0.5),
                2px 2px 4px rgba(0, 0, 0, 0.3)
              `,
            }}
          >
            Connect Farmers & Buyers
          </Typography>
        </Box>
      </Box>

      {/* Right Side - Login Form */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 50%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { xs: 3, md: '0 60px 0 40px' },
          background: '#f5f7fa',
          minHeight: '100vh',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 450,
            background: '#ffffff',
            borderRadius: 3,
            padding: { xs: 4, sm: 5, md: 5 },
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            borderTop: '4px solid #4CAF50',
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                bgcolor: '#4CAF50',
                borderRadius: 2,
                width: 48,
                height: 48,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <LoginIcon sx={{ fontSize: 24, color: '#ffffff' }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#212121',
                mb: 1,
                fontSize: '1.75rem',
              }}
            >
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              Sign in to continue to your ShareCrop account
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              margin="normal"
              autoComplete="email"
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f5f7fa',
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4CAF50',
                    },
                  },
                  '&.Mui-focused': {
                    bgcolor: '#ffffff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4CAF50',
                      borderWidth: 2,
                    },
                  },
                },
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              margin="normal"
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          color: '#4CAF50',
                        },
                      }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f5f7fa',
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4CAF50',
                    },
                  },
                  '&.Mui-focused': {
                    bgcolor: '#ffffff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4CAF50',
                      borderWidth: 2,
                    },
                  },
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                mb: 3,
                borderRadius: 2,
                fontSize: '0.9375rem',
                fontWeight: 600,
                textTransform: 'none',
                bgcolor: '#4CAF50',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#2E7D32',
                  boxShadow: 'none',
                },
                '&:disabled': {
                  bgcolor: '#4CAF50',
                  opacity: 0.7,
                },
              }}
              endIcon={!loading && <LoginIcon />}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  style={{
                    color: '#4CAF50',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Sign Up
                </Link>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;

