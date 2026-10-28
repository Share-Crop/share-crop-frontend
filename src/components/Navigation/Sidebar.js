import React, { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Button,
  alpha,
} from '@mui/material';
import {
  Dashboard,
  Agriculture,
  Store,
  ShoppingCart,
  AccountCircle,
  ExitToApp,
  History,
  Map,
  Landscape,
  Person,
  Message,
  CurrencyExchange,
  Settings,
  Close,
  ReportProblem,
  Home,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

// Custom hook to detect mobile screens
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

const Sidebar = ({ user, onLogout, open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const farmerMenuItems = [
    { text: 'Home', icon: <Home />, path: '/' },
    { text: 'Dashboard', icon: <Dashboard />, path: '/farmer' },
    { text: 'My Fields', icon: <Agriculture />, path: '/farmer/fields' },
    { text: 'Products', icon: <Store />, path: '/farmer/products' },
    { text: 'Orders', icon: <ShoppingCart />, path: '/farmer/farm-orders' },
    { text: 'Profile', icon: <Person />, path: '/farmer/profile' },
    { text: 'Map View', icon: <Map />, path: '/farmer/map' },
    { text: 'Complaints', icon: <ReportProblem />, path: '/farmer/complaints' },
  ];

  const buyerMenuItems = [
    { text: 'Home', icon: <Home />, path: '/' },
    { text: 'Rented Fields', icon: <Landscape />, path: '/buyer/rented-fields' },
    { text: 'My Orders', icon: <History />, path: '/buyer/orders' },
    { text: 'Profile', icon: <Person />, path: '/buyer/profile' },
    { text: 'Messages', icon: <Message />, path: '/buyer/messages' },
    { text: 'Change Currency', icon: <CurrencyExchange />, path: '/buyer/currency' },
    { text: 'Settings', icon: <Settings />, path: '/buyer/settings' },
    { text: 'Complaints', icon: <ReportProblem />, path: '/buyer/complaints' },
  ];

  const menuItems = user.user_type === 'farmer' ? farmerMenuItems : buyerMenuItems;

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: isMobile ? 240 : 320,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      {/* Header Section */}
      <Box sx={{
        p: isMobile ? 1.5 : 3,
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.02) 0%, rgba(46, 125, 50, 0.02) 100%)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isMobile ? 2 : 2.5 }}>
          <Typography
            variant={isMobile ? "subtitle1" : "h6"}
            sx={{
              fontWeight: 700,
              fontSize: isMobile ? '1rem' : '1.25rem',
              background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            🌱 ShareCrop
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Compact profile for narrow drawer — no truncation */}
        <Box sx={{ mt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                src={user.profile_image_url}
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: '#059669',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                {!user.profile_image_url && (user.name?.charAt(0)?.toUpperCase() || 'U')}
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: '#22c55e',
                  border: '1.5px solid #fff',
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    lineHeight: 1.25,
                    wordBreak: 'break-word',
                  }}
                >
                  {user.name || 'User'}
                </Typography>
                <Chip
                  label={user.user_type}
                  size="small"
                  sx={{
                    textTransform: 'capitalize',
                    fontSize: '0.58rem',
                    height: 17,
                    fontWeight: 700,
                    bgcolor: user.user_type === 'farmer' ? 'rgba(5, 150, 105, 0.12)' : '#ffedd5',
                    color: user.user_type === 'farmer' ? '#047857' : '#c2410c',
                    border: 'none',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
              <Button
                variant="text"
                size="small"
                startIcon={<Person sx={{ fontSize: 13 }} />}
                onClick={() =>
                  handleNavigation(user.user_type === 'farmer' ? '/farmer/profile' : '/buyer/profile')
                }
                sx={{
                  mt: 0.35,
                  ml: -0.4,
                  minWidth: 0,
                  px: 0.4,
                  py: 0,
                  fontSize: '0.65rem',
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#059669',
                  justifyContent: 'flex-start',
                  '& .MuiButton-startIcon': { mr: 0.25, ml: 0 },
                }}
              >
                Profile
              </Button>
            </Box>
          </Box>

          {user.user_type === 'buyer' && (
            <Button
              fullWidth
              size="small"
              variant="contained"
              onClick={() => handleNavigation('/buyer/become-farmer')}
              sx={{
                mt: 1.15,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.72rem',
                py: 0.65,
                borderRadius: '999px',
                bgcolor: '#059669',
                color: '#fff',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              Become a Farmer
            </Button>
          )}
        </Box>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, py: isMobile ? 1 : 1.5 }}>
        <List sx={{ px: isMobile ? 1 : 1.5 }}>
          {menuItems.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
              <Tooltip key={item.text} title={item.text} placement="right" arrow>
                <ListItem
                  button
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: isMobile ? '6px' : '12px',
                    mb: isMobile ? 0.25 : 1,
                    minHeight: isMobile ? 36 : 48,
                    px: isMobile ? 0.75 : 1.5,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? alpha('#4CAF50', 0.08)
                      : 'transparent',
                    border: isSelected
                      ? `1px solid ${alpha('#4CAF50', 0.2)}`
                      : '1px solid transparent',
                    '&:hover': {
                      backgroundColor: isSelected
                        ? alpha('#4CAF50', 0.12)
                        : alpha('#000', 0.04),
                      transform: 'translateX(4px)',
                      boxShadow: isSelected
                        ? `0 4px 12px ${alpha('#4CAF50', 0.15)}`
                        : '0 2px 8px rgba(0, 0, 0, 0.08)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: isMobile ? 28 : 40,
                      color: isSelected ? '#2E7D32' : 'text.secondary',
                      transition: 'color 0.2s ease',
                      '& svg': {
                        fontSize: isMobile ? '1.1rem' : '1.5rem',
                      },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: isMobile ? '0.75rem' : '0.9rem',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#2E7D32' : 'text.primary',
                    }}
                  />
                </ListItem>
              </Tooltip>
            );
          })}
        </List>
      </Box>

      {/* Logout Section */}
      <Box sx={{
        p: isMobile ? 1 : 2,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
      }}>
        <Tooltip title="Logout" placement="right" arrow>
          <ListItem
            button
            onClick={handleLogout}
            sx={{
              borderRadius: isMobile ? '4px' : '8px',
              minHeight: isMobile ? 36 : 48,
              px: isMobile ? 1 : 1.5,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                backgroundColor: alpha('#f44336', 0.08),
                transform: 'translateX(4px)',
                boxShadow: '0 2px 8px rgba(244, 67, 54, 0.15)',
              },
              // Ensure cursor is pointer for the tooltip wrapper
              cursor: 'pointer',
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: isMobile ? 28 : 40,
                color: '#d32f2f',
                transition: 'color 0.2s ease',
                '& svg': {
                  fontSize: isMobile ? '1.1rem' : '1.4rem',
                },
              }}
            >
              <ExitToApp />
            </ListItemIcon>
            <ListItemText
              primary="Logout"
              primaryTypographyProps={{
                fontSize: isMobile ? '0.75rem' : '0.9rem',
                fontWeight: 500,
                color: '#d32f2f',
              }}
            />
          </ListItem>
        </Tooltip>
      </Box>
    </Drawer>
  );
};

export default Sidebar;