import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import EnhancedHeader from '../components/Layout/EnhancedHeader';
import AdminSidebar from '../components/Navigation/AdminSidebar';
import { useAuth } from '../contexts/AuthContext';
import { Outlet, useLocation } from 'react-router-dom';
import useAdminPendingCounts from '../hooks/useAdminPendingCounts';

const AdminView = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerRef = useRef(null);
  const { counts, refresh } = useAdminPendingCounts({ enabled: true });

  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  // Refresh badges when admin navigates between pages (e.g. after approving)
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <EnhancedHeader
        ref={headerRef}
        user={user}
        onLogout={logout}
        userType="admin"
        onMenuClick={() => setSidebarOpen((v) => !v)}
        adminPendingCounts={counts}
        onRefreshAdminPending={refresh}
      />
      <AdminSidebar
        user={user || { name: 'Admin', user_type: 'admin' }}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingCounts={counts}
      />
      <Box
        sx={{
          flexGrow: 1,
          mt: 'var(--app-header-height)',
          height: 'calc(100% - var(--app-header-height))',
          overflow: 'auto',
          position: 'relative',
          px: { xs: 2, sm: 3, md: 4 },
          pb: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminView;
