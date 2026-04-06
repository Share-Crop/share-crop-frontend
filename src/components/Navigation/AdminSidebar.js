import React, { useState, useEffect } from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Box, Typography, Chip, Avatar, IconButton, Divider } from '@mui/material';
import { Dashboard, People, MonetizationOn, Payment, Assessment, Analytics, Close, QuestionAnswer, ExitToApp, Person, AccountBalanceWallet, ShoppingBag, CurrencyExchange, Home, Image } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIsMobile = () => { setIsMobile(window.innerWidth <= 768); };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  return isMobile;
};

const AdminSidebar = ({ user, onLogout, open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const adminMenuItems = [
    { text: 'Home', icon: <Home />, path: '/' },
    { text: 'Dashboard', icon: <Dashboard />, path: '/admin' },
    { text: 'Profile', icon: <Person />, path: '/admin/profile' },
    { text: 'Users', icon: <People />, path: '/admin/users' },
    { text: 'QA', icon: <QuestionAnswer />, path: '/admin/qa' },
    { text: 'Analytics', icon: <Analytics />, path: '/admin/analytics' },
    { text: 'Coins', icon: <MonetizationOn />, path: '/admin/coins' },
    { text: 'Packages', icon: <ShoppingBag />, path: '/admin/packages' },
    { text: 'Currency Rates', icon: <CurrencyExchange />, path: '/admin/currency-rates' },
    { text: 'Redemptions', icon: <AccountBalanceWallet />, path: '/admin/redemptions' },
    { text: 'Payments', icon: <Payment />, path: '/admin/payments' },
    { text: 'Audit', icon: <Assessment />, path: '/admin/audit' },
    { text: 'Product icons', icon: <Image />, path: '/admin/product-icons' },
  ];

  const handleNavigation = (path) => { navigate(path); onClose(); };
  const handleLogout = () => { onLogout(); onClose(); };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: isMobile ? 220 : 280,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          top: 'var(--app-header-height)',
          height: 'calc(100% - var(--app-header-height))',
          pt: 2,
        },
      }}
    >
      <Box sx={{ p: isMobile ? 1.5 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isMobile ? 1.5 : 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              fontSize: isMobile ? '1.1rem' : '1.25rem',
            }}
          >
            🌱 ShareCrop
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: isMobile ? 1.5 : 2 }}>
          <Avatar
            src={user.profile_image_url}
            sx={{
              mr: isMobile ? 1.5 : 2,
              bgcolor: 'primary.main',
              width: isMobile ? 36 : 40,
              height: isMobile ? 36 : 40,
              fontSize: isMobile ? '0.9rem' : '1rem',
            }}
          >
            {!user.profile_image_url && (user.name?.charAt(0)?.toUpperCase() || 'U')}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 'bold',
                fontSize: isMobile ? '0.9rem' : '1rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.name?.split(' ')[0] || user.name || 'Admin'}
            </Typography>
            <Chip
              label={user.user_type}
              size="small"
              color="primary"
              sx={{
                textTransform: 'capitalize',
                fontSize: isMobile ? '0.7rem' : '0.75rem',
                height: isMobile ? 20 : 24,
              }}
            />
          </Box>
        </Box>
      </Box>

      <Divider />

      <List sx={{ py: isMobile ? 0.5 : 1 }}>
        {adminMenuItems.map((item) => {
          const selected = location.pathname === item.path;
          return (
            <ListItem
              button
              key={item.text}
              onClick={() => handleNavigation(item.path)}
              selected={selected}
              sx={{
                py: isMobile ? 0.5 : 1,
                px: isMobile ? 1.5 : 2,
                minHeight: isMobile ? 40 : 48,
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'primary.light',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: isMobile ? 32 : 40,
                  '& svg': {
                    fontSize: isMobile ? '1.2rem' : '1.5rem',
                  },
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: isMobile ? '0.85rem' : '1rem',
                  fontWeight: selected ? 600 : 400,
                }}
              />
            </ListItem>
          );
        })}
      </List>

      <Divider />

      <List sx={{ py: isMobile ? 0.5 : 1 }}>
        <ListItem
          button
          onClick={handleLogout}
          sx={{
            py: isMobile ? 0.5 : 1,
            px: isMobile ? 1.5 : 2,
            minHeight: isMobile ? 40 : 48,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: isMobile ? 32 : 40,
              '& svg': {
                fontSize: isMobile ? '1.2rem' : '1.5rem',
              },
            }}
          >
            <ExitToApp />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{
              fontSize: isMobile ? '0.85rem' : '1rem',
              fontWeight: 400,
            }}
          />
        </ListItem>
      </List>
    </Drawer>
  );
};

export default AdminSidebar;
