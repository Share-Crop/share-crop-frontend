import React, { useState, useEffect } from 'react';
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
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            danger ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      <div className="ml-2 flex justify-end">{action}</div>
    </div>
  );

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 px-3 py-4 md:px-6">
      <div className="mx-auto w-full max-w-3xl pb-8">
        {/* Header */}
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 md:text-2xl">Settings</h1>
            <p className="text-xs text-slate-500 md:text-sm">
              Manage your actual account preferences
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save sx={{ fontSize: 16 }} />
            )}
            <span>Save Changes</span>
          </button>
        </div>

        {/* Inline success / error banner */}
        {(success || error) && (
          <div
            className={`mb-4 flex items-start gap-2 rounded-xl px-3 py-2 text-xs md:text-sm ${
              success
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            <span className="mt-0.5 font-medium">{success || error}</span>
            <button
              type="button"
              onClick={() => {
                setSuccess('');
                setError('');
              }}
              className="ml-auto text-[10px] font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* Main Preferences Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CurrencyExchange color="primary" />
              <span>Localization</span>
            </div>
            <div className="divide-y divide-slate-200">
              <SettingRow
                icon={<CurrencyExchange />}
                title="Displayed Currency"
                subtitle="Prices across the platform will be shown in this currency"
                action={
                  <select
                    value={preferences.currency}
                    onChange={(e) => handleSelectChange('currency', e.target.value)}
                    className="h-9 min-w-[120px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                  >
                    {currencies.length > 0 ? (
                      currencies.map((curr) => (
                        <option key={curr.currency} value={curr.currency}>
                          {curr.display_name} ({curr.symbol})
                        </option>
                      ))
                    ) : (
                      <option value="USD">US Dollar ($)</option>
                    )}
                  </select>
                }
              />
            </div>
          </div>

          {/* Account Security Info Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Security color="primary" />
              <span>Account Metadata</span>
            </div>
            <div className="divide-y divide-slate-200">
              <SettingRow
                icon={<Badge />}
                title="Account Role"
                subtitle={`You are currently logged in as a ${user?.user_type || 'user'}`}
                action={
                  <span className="text-xs font-bold uppercase text-emerald-600">
                    {user?.user_type?.toUpperCase()}
                  </span>
                }
              />
              <SettingRow
                icon={<CalendarToday />}
                title="Member Since"
                subtitle="Date when your account was first created"
                action={
                  <span className="text-xs font-medium text-slate-800">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                }
              />
            </div>
          </div>

          {/* Data Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Download color="primary" />
              <span>Security &amp; Data</span>
            </div>
            <div className="divide-y divide-slate-200">
              <SettingRow
                icon={<Download />}
                title="Data Export"
                subtitle="Download your basic account credentials in JSON format"
                action={
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50"
                  >
                    Export
                  </button>
                }
              />
              <SettingRow
                icon={<DeleteForever />}
                title="Terminate Session"
                subtitle="Inactivate current account and clear local storage"
                danger
                action={
                  <button
                    type="button"
                    className="rounded-xl border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete...
                  </button>
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          ShareCrop Actual Settings • Minimalistic &amp; Real
        </div>
      </div>
    </div>
  );
};

export default Settings;