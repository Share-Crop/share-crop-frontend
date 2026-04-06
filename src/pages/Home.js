import React from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  AppBar,
  Toolbar,
  Card,
  Stack,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import {
  Agriculture,
  ShoppingCart,
  TrendingUp,
  LocalShipping,
  VerifiedUser,
  Nature,
} from '@mui/icons-material';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      const userType = user.user_type?.toLowerCase();
      if (userType === 'admin') {
        navigate('/admin', { replace: true });
      } else if (userType === 'farmer') {
        navigate('/farmer', { replace: true });
      } else if (userType === 'buyer') {
        navigate('/buyer', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: '#FAFAFA' }}>
      {/* Navbar */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E0E0E0',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
          <Typography
            variant="h5"
            component="div"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/browse')}
          >
            🌱 ShareCrop
          </Typography>

          {!isAuthenticated && (
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => navigate('/browse')}
                sx={{
                  borderColor: '#4CAF50',
                  color: '#4CAF50',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    borderColor: '#388E3C',
                    backgroundColor: 'rgba(76, 175, 80, 0.08)',
                  },
                }}
              >
                Browse Fields
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: '#666',
                  color: '#666',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    borderColor: '#333',
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                Sign In
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/signup')}
                sx={{
                  backgroundColor: '#4CAF50',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    backgroundColor: '#388E3C',
                  },
                }}
              >
                Register
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Box
        sx={{
          py: 0,
          bgcolor: 'white',
          px: { xs: 2, md: 0 },
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            maxWidth: '1600px',
            mx: 'auto',
            px: { xs: 0, md: 3 },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 3, md: 0 },
              alignItems: 'center',
            }}
          >
            {/* Left side - Text content */}
            <Box
              sx={{
                flex: { xs: '0 0 100%', md: '0 0 50%' },
                width: { xs: '100%', md: '50%' },
                pl: { xs: 2, md: 3 },
                pr: { xs: 2, md: 0 },
                order: { xs: 2, md: 1 },
              }}
            >
              <Box>
                <Typography
                  variant="h1"
                  component="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', md: '3.5rem' },
                    fontWeight: 800,
                    color: '#1A1A1A',
                    mb: 3,
                    lineHeight: 1.2,
                  }}
                >
                  Connect Farmers & Buyers
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Seamlessly
                  </Box>
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: '#666',
                    mb: 4,
                    lineHeight: 1.8,
                    fontSize: { xs: '1rem', md: '1.25rem' },
                    fontWeight: 400,
                  }}
                >
                  A modern marketplace connecting farmers directly with buyers.
                  Grow your farm business, find fresh produce, and build lasting
                  relationships in the agricultural community.
                </Typography>
                {!isAuthenticated && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => navigate('/signup')}
                      sx={{
                        backgroundColor: '#4CAF50',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 4,
                        py: 1.5,
                        fontSize: '1.1rem',
                        borderRadius: 2,
                        '&:hover': {
                          backgroundColor: '#388E3C',
                        },
                      }}
                    >
                      Get Started
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => navigate('/login')}
                      sx={{
                        borderColor: '#4CAF50',
                        color: '#4CAF50',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 4,
                        py: 1.5,
                        fontSize: '1.1rem',
                        borderRadius: 2,
                        '&:hover': {
                          borderColor: '#388E3C',
                          backgroundColor: 'rgba(76, 175, 80, 0.08)',
                        },
                      }}
                    >
                      Sign In
                    </Button>
                  </Stack>
                )}
              </Box>
            </Box>

            {/* Right side - Farmer SVG Image */}
            <Box
              sx={{
                flex: { xs: '0 0 100%', md: '0 0 50%' },
                width: { xs: '100%', md: '50%' },
                display: 'flex',
                justifyContent: { xs: 'center', md: 'flex-end' },
                alignItems: 'center',
                minHeight: { xs: '300px', md: '500px' },
                pl: 0,
                pr: 0,
                mr: 0,
                overflow: 'hidden',
                order: { xs: 1, md: 2 },
              }}
            >
              <Box
                component="img"
                src="/assets/farmer-with-vegetable-basket.svg"
                alt="Farmer with fresh produce"
                sx={{
                  width: '100%',
                  maxWidth: '650px',
                  height: 'auto',
                  mr: { xs: 0, md: -10 },
                  transform: { xs: 'none', md: 'translateX(20px)' },
                  ml: 0,
                  pl: 0,
                  display: 'block',
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Why Choose ShareCrop Section */}
      <Box
        sx={{
          py: { xs: 6, md: 8 },
          bgcolor: '#F5F5F5',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            component="h2"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              color: '#1A1A1A',
              mb: 5,
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Why Choose ShareCrop?
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
              justifyContent: 'center',
              alignItems: 'stretch',
            }}
          >
            {[
              {
                icon: <Agriculture sx={{ fontSize: 28, color: '#4CAF50' }} />,
                title: 'For Farmers',
                description: 'List your crops, manage fields, and connect directly with buyers.',
                color: '#4CAF50',
              },
              {
                icon: <ShoppingCart sx={{ fontSize: 28, color: '#2196F3' }} />,
                title: 'For Buyers',
                description: 'Browse fresh produce directly from farmers.',
                color: '#2196F3',
              },
              {
                icon: <TrendingUp sx={{ fontSize: 28, color: '#FF9800' }} />,
                title: 'Fair Pricing',
                description: 'Transparent pricing and fair deals for everyone.',
                color: '#FF9800',
              },
              {
                icon: <LocalShipping sx={{ fontSize: 28, color: '#9C27B0' }} />,
                title: 'Easy Delivery',
                description: 'Streamlined logistics from farm to table.',
                color: '#9C27B0',
              },
              {
                icon: <VerifiedUser sx={{ fontSize: 28, color: '#F44336' }} />,
                title: 'Trusted Platform',
                description: 'Verified users and secure transactions.',
                color: '#F44336',
              },
              {
                icon: <Nature sx={{ fontSize: 28, color: '#009688' }} />,
                title: 'Sustainable',
                description: 'Supporting local agriculture practices.',
                color: '#009688',
              },
            ].map((feature, index) => (
              <Card
                key={index}
                sx={{
                  flex: '1 1 calc(33.333% - 24px)',
                  minWidth: { xs: '100%', sm: '280px' },
                  maxWidth: { xs: '100%', sm: '320px' },
                  borderRadius: 2,
                  p: 2.5,
                  textAlign: 'center',
                  bgcolor: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: '1px solid #E0E0E0',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    borderColor: feature.color,
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 1.5,
                    borderRadius: '50%',
                    bgcolor: `${feature.color}15`,
                    mb: 1.5,
                    alignSelf: 'center',
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    mb: 1,
                    color: '#1A1A1A',
                    fontSize: '1.1rem',
                  }}
                >
                  {feature.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    lineHeight: 1.6,
                    fontSize: '0.875rem',
                    flexGrow: 1,
                  }}
                >
                  {feature.description}
                </Typography>
              </Card>
            ))}
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      {!isAuthenticated && (
        <Box
          sx={{
            py: { xs: 6, md: 10 },
            bgcolor: '#4CAF50',
            color: 'white',
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                }}
              >
                Ready to Get Started?
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  mb: 4,
                  opacity: 0.95,
                  fontSize: { xs: '1rem', md: '1.25rem' },
                  fontWeight: 400,
                }}
              >
                Join thousands of farmers and buyers growing together
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent="center"
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/signup')}
                  sx={{
                    bgcolor: 'white',
                    color: '#4CAF50',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 5,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: '#F5F5F5',
                    },
                  }}
                >
                  Create Account
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/login')}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 5,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: 2,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  Sign In
                </Button>
              </Stack>
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default Home;
