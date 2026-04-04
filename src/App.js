import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import GlobalStyle from './styles/GlobalStyle';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { Box } from '@mui/material';
import farmvilleTheme from './styles/theme';
import FarmerView from './pages/FarmerView';
import BuyerView from './pages/BuyerView';
import AdminView from './pages/AdminView';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import UserDetailPage from './pages/admin/UserDetailPage';
import AdminQA from './pages/admin/AdminQA';
import AdminCoins from './pages/admin/AdminCoins';
import AdminRedemptions from './pages/admin/AdminRedemptions';
import AdminPayments from './pages/admin/AdminPayments';
import AdminAudit from './pages/admin/AdminAudit';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminPackages from './pages/admin/AdminPackages';
import AdminCurrencyRates from './pages/admin/AdminCurrencyRates';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import BrowseFields from './pages/BrowseFields';
import ProtectedRoute from './components/Auth/ProtectedRoute';


const AppContent = () => {
  useAuth();

  return (
    <Router>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/browse" element={<BrowseFields />} />

          {/* Protected Farmer Routes */}
          <Route
            path="/farmer/*"
            element={
              <ProtectedRoute allowedRoles={['farmer']}>
                <FarmerView />
              </ProtectedRoute>
            }
          />

          {/* Protected Buyer Routes */}
          <Route
            path="/buyer/*"
            element={
              <ProtectedRoute allowedRoles={['buyer']}>
                <BuyerView />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminView />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="qa" element={<AdminQA />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages" element={<Messages />} />
            <Route path="coins" element={<AdminCoins />} />
            <Route path="packages" element={<AdminPackages />} />
            <Route path="currency-rates" element={<AdminCurrencyRates />} />
            <Route path="redemptions" element={<AdminRedemptions />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="analytics" element={<AdminAnalytics />} />
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Router>
  );
};

const App = () => {
  return (
    <MuiThemeProvider theme={farmvilleTheme}>
      <GlobalStyle />
      <AuthProvider>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </AuthProvider>
    </MuiThemeProvider>
  );
};

export default App;
