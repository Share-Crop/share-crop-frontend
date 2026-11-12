import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Switch,
  Grid,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { adminService } from '../../services/admin';

const AdminCurrencyRates = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [formData, setFormData] = useState({
    currency: '',
    coins_per_unit: '',
    display_name: '',
    symbol: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getCurrencyRates();
      setRates(response.data?.rates || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load currency rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const handleOpenDialog = (rate = null) => {
    if (rate) {
      setEditingRate(rate);
      setFormData({
        currency: rate.currency || '',
        coins_per_unit: rate.coins_per_unit || '',
        display_name: rate.display_name || '',
        symbol: rate.symbol || '',
        is_active: rate.is_active !== false,
      });
    } else {
      setEditingRate(null);
      setFormData({
        currency: '',
        coins_per_unit: '',
        display_name: '',
        symbol: '',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRate(null);
    setFormData({
      currency: '',
      coins_per_unit: '',
      display_name: '',
      symbol: '',
      is_active: true,
    });
  };

  const handleSave = async () => {
    if (!formData.currency || !formData.coins_per_unit || !formData.display_name || !formData.symbol) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate currency code format
    const currencyCode = formData.currency.toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      setError('Currency code must be exactly 3 uppercase letters (e.g., USD, EUR, GBP)');
      return;
    }

    // Validate coins per unit
    const coinsPerUnit = parseFloat(formData.coins_per_unit);
    if (isNaN(coinsPerUnit) || coinsPerUnit <= 0) {
      setError('Coins per unit must be a positive number');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = {
        ...formData,
        currency: currencyCode,
        coins_per_unit: coinsPerUnit,
      };

      if (editingRate) {
        await adminService.updateCurrencyRate(editingRate.currency, data);
      } else {
        await adminService.upsertCurrencyRate(data);
      }
      handleCloseDialog();
      loadRates();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save currency rate');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rate) => {
    const next = !rate.is_active;
    try {
      setError(null);
      await adminService.setCurrencyRateActive(rate.currency, next);
      loadRates();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update currency status');
    }
  };

  const handleDelete = async (rate) => {
    if (
      !window.confirm(
        `Permanently delete currency "${rate.currency}"?\n\nThis cannot be undone. Prefer Deactivate if you only want to hide it.`
      )
    ) {
      return;
    }

    try {
      setError(null);
      await adminService.deleteCurrencyRate(rate.currency);
      loadRates();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete currency rate');
    }
  };

  const getConversionExample = () => {
    if (!formData.coins_per_unit) return '';
    const coinsPerUnit = parseFloat(formData.coins_per_unit);
    return `Example: ${coinsPerUnit} coins = ${formData.symbol}1.00`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Currency Rates Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Set how many coins equal one unit of each currency (e.g., 10 coins = $1 USD)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Currency
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Currency</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Display Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Symbol</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Coins per Unit</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Conversion</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No currency rates found. Add your first currency!
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rates.map((rate) => (
                      <TableRow key={rate.currency} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {rate.currency}
                          </Typography>
                        </TableCell>
                        <TableCell>{rate.display_name}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '1.2rem' }}>
                            {rate.symbol}
                          </Typography>
                        </TableCell>
                        <TableCell>{rate.coins_per_unit}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {rate.coins_per_unit} coins = {rate.symbol}1.00
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                              size="small"
                              checked={Boolean(rate.is_active)}
                              onChange={() => handleToggleActive(rate)}
                              inputProps={{ 'aria-label': `Toggle ${rate.currency} active` }}
                            />
                            <Chip
                              label={rate.is_active ? 'Active' : 'Inactive'}
                              color={rate.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton size="small" onClick={() => handleOpenDialog(rate)} aria-label="Edit">
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(rate)}
                              aria-label="Delete permanently"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRate ? 'Edit Currency Rate' : 'Add New Currency'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Currency Code *"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                placeholder="USD, EUR, GBP, etc."
                inputProps={{ maxLength: 3 }}
                helperText="ISO 4217 currency code (3 letters)"
                disabled={!!editingRate}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Display Name *"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="US Dollar, Euro, etc."
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Symbol *"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="$, €, £, etc."
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Coins per Unit *"
                type="number"
                value={formData.coins_per_unit}
                onChange={(e) => setFormData({ ...formData, coins_per_unit: e.target.value })}
                inputProps={{ min: 0.01, step: 0.01 }}
                helperText={getConversionExample()}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">Active:</Typography>
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editingRate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCurrencyRates;
