import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Avatar,
  CircularProgress,
} from '@mui/material';
import {
  CurrencyExchange,
  Download,
  DeleteForever,
  Save,
  Security,
  Badge,
  CalendarToday,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { profileService } from '../services/profile';
import coinService from '../services/coinService';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [currencies, setCurrencies] = useState([]);
  const [preferences, setPreferences] = useState({
    currency: 'USD',
  });

  useEffect(() => {
    if (user?.id) {
      loadPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPreferences = async () => {
    try {
      setLoading(true);

      // 1. Fetch available currencies from backend
      const ratesResponse = await coinService.getCurrencyRates();
      const availableRates = ratesResponse.rates || [];
      const activeRates = availableRates.filter(r => r.is_active);
      setCurrencies(activeRates);

      // 2. Fetch user's preferred currency
      const response = await profileService.getPreferredCurrency(user.id);
      if (response.data && response.data.preferred_currency) {
        setPreferences({
          currency: response.data.preferred_currency
        });
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (name, value) => {
    setPreferences(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAll = async () => {
    try {
      setLoading(true);
      setError('');

      // Save currency to backend
      await profileService.updatePreferredCurrency(user.id, preferences.currency);

      setSuccess('Currency preference updated successfully!');

      // Notify other components about currency changes
      window.dispatchEvent(new CustomEvent('sharecrop-settings-updated', { detail: preferences }));

    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    const data = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        user_type: user.user_type,
        created_at: user.created_at,
      },
      exportDate: new Date().toISOString(),
      platform: 'ShareCrop 2.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharecrop_id_${user.id.substring(0, 8)}_data.json`;
    a.click();
    setSuccess('Security information exported!');
  };

  const SettingRow = ({ icon, title, subtitle, action, danger = false }) => (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      py: 2.5,
    }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{
          bgcolor: danger ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)',
          color: danger ? '#f44336' : '#4caf50',
          width: 44,
          height: 44
        }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', ml: 2 }}>
        {action}
      </Box>
    </Box>
  );

  return (
    <Box sx={{
      height: '100%',
      backgroundColor: '#f8fafc',
      p: { xs: 2, md: 4 },
      overflowY: 'auto'
    }}>
      <Box sx={{ maxWidth: '800px', mx: 'auto', pb: 8 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
              Settings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your actual account preferences
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
            onClick={handleSaveAll}
            disabled={loading}
            sx={{
              backgroundColor: '#4caf50',
              '&:hover': { backgroundColor: '#3d8b40' },
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Save Changes
          </Button>
        </Stack>

        <Snackbar
          open={!!success || !!error}
          autoHideDuration={4000}
          onClose={() => { setSuccess(''); setError(''); }}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity={success ? 'success' : 'error'} sx={{ width: '100%', borderRadius: 2 }}>
            {success || error}
          </Alert>
        </Snackbar>

        <Stack spacing={3}>
          {/* Main Preferences Section */}
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CurrencyExchange color="primary" /> Localization
            </Typography>
            <Stack divider={<Divider sx={{ opacity: 0.6 }} />}>
              <SettingRow
                icon={<CurrencyExchange />}
                title="Displayed Currency"
                subtitle="Prices across the platform will be shown in this currency"
                action={
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={preferences.currency}
                      onChange={(e) => handleSelectChange('currency', e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      {currencies.length > 0 ? (
                        currencies.map(curr => (
                          <MenuItem key={curr.currency} value={curr.currency}>
                            {curr.display_name} ({curr.symbol})
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem value="USD">US Dollar ($)</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                }
              />
            </Stack>
          </Paper>

          {/* Account Security Info Section */}
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security color="primary" /> Account Metadata
            </Typography>
            <Stack divider={<Divider sx={{ opacity: 0.6 }} />}>
              <SettingRow
                icon={<Badge />}
                title="Account Role"
                subtitle={`You are currently logged in as a ${user?.user_type || 'user'}`}
                action={<Typography sx={{ fontWeight: 700, color: '#4caf50' }}>{user?.user_type?.toUpperCase()}</Typography>}
              />
              <SettingRow
                icon={<CalendarToday />}
                title="Member Since"
                subtitle="Date when your account was first created"
                action={<Typography sx={{ fontWeight: 500 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</Typography>}
              />
            </Stack>
          </Paper>

          {/* Data Section */}
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Download color="primary" /> Security & Data
            </Typography>
            <Stack divider={<Divider sx={{ opacity: 0.6 }} />}>
              <SettingRow
                icon={<Download />}
                title="Data Export"
                subtitle="Download your basic account credentials in JSON format"
                action={
                  <Button
                    variant="outlined"
                    onClick={handleExportData}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Export
                  </Button>
                }
              />
              <SettingRow
                icon={<DeleteForever />}
                title="Terminate Session"
                subtitle="Inactivate current account and clear local storage"
                danger
                action={
                  <Button
                    variant="outlined"
                    color="error"
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Delete...
                  </Button>
                }
              />
            </Stack>
          </Paper>
        </Stack>

        <Box sx={{ mt: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            ShareCrop Actual Settings • Minimalistic & Real
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Settings;