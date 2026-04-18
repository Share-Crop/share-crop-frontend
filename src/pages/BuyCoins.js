import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Container,
  Grid,
  Chip,
  Stack,
  Divider,
  TextField,
} from '@mui/material';
import {
  MonetizationOn,
  CheckCircle,
  Cancel,
  Security,
  Payment,
  TrendingUp,
  Star,
  ArrowBack,
  ShoppingCart,
  Verified,
} from '@mui/icons-material';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import coinService from '../services/coinService';

/** Must match backend coin purchase fee in `routes/coins.js`. */
const COIN_PURCHASE_APP_FEE_PERCENT = 5;

function coinCheckoutFeeBreakdown(subtotal) {
  const s = Number(subtotal) || 0;
  const fee = Math.round(s * 100 * (COIN_PURCHASE_APP_FEE_PERCENT / 100)) / 100;
  const total = Math.round((s + fee) * 100) / 100;
  return { subtotal: s, fee, total };
}

const BuyCoins = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const basePath = location.pathname.replace(/\/buy-coins.*/, '/buy-coins');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const successUrl = `${origin}${basePath}?success=1`;
  const cancelUrl = `${origin}${basePath}?cancel=1`;
  const [packs, setPacks] = useState([]);
  const [currencyRates, setCurrencyRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState(null);
  const [customCoins, setCustomCoins] = useState('');
  /** Checkout currency: USD-only for now (product decision). Keep state for easy restore with commented currency UI below. */
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const purchaseInProgressRef = useRef(false);
  const success = searchParams.get('success');
  const cancel = searchParams.get('cancel');

  useEffect(() => {
    if (success === '1') {
      window.dispatchEvent(new CustomEvent('sharecrop-refresh-coins'));
    }
  }, [success]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      coinService.getCoinPacks(),
      coinService.getCurrencyRates(),
    ])
      .then(([packsData, ratesData]) => {
        if (!mounted) return;
        if (packsData.packs) setPacks(packsData.packs);
        if (ratesData.rates) setCurrencyRates(ratesData.rates);
        setSelectedCurrency('USD');
      })
      .catch((err) => {
        console.error('Error loading coin packs:', err);
        if (mounted) {
          setError('Failed to load packages. Please try again later.');
          setPacks([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Multi-currency (restore when product allows non-USD checkout again):
   * - Re-add `import api from '../services/api'` if using preferred-currency below.
   * - Replace the effect above with logic that loads preferred currency and sets
   *   `selectedCurrency` from user preference / first pack / first rate, and re-fetch
   *   when `user?.id` or `selectedCurrency` changes as needed.
   * - Uncomment the Currency <Select> block in the Custom Coin card and re-add MUI imports:
   *   FormControl, InputLabel, Select, MenuItem from '@mui/material'.
   */

  const handleBuy = async (packId) => {
    if (purchaseInProgressRef.current) return;
    setError(null);
    purchaseInProgressRef.current = true;
    setPurchasing(packId);
    try {
      const pack = packs.find((p) => p.id === packId);
      const { url } = await coinService.createPurchaseIntent(packId, {
        successUrl,
        cancelUrl,
        pack: pack ? { name: `${pack.coins} Coins`, coins: pack.coins, usd: pack.usd } : undefined,
      });
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not start checkout');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Checkout failed');
    } finally {
      purchaseInProgressRef.current = false;
      setPurchasing(null);
    }
  };

  const handleCustomBuy = async () => {
    if (purchaseInProgressRef.current) return;
    if (!customCoins || parseInt(customCoins) < 1) {
      setError('Please enter a valid number of coins');
      return;
    }
    setError(null);
    purchaseInProgressRef.current = true;
    setPurchasing('custom');
    try {
      const { url } = await coinService.createPurchaseIntent(null, {
        successUrl,
        cancelUrl,
        customCoins: parseInt(customCoins),
        currency: 'USD',
      });
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not start checkout');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Checkout failed');
    } finally {
      purchaseInProgressRef.current = false;
      setPurchasing(null);
    }
  };

  const calculateCustomPrice = () => {
    if (!customCoins) return null;
    const coins = parseFloat(customCoins);
    if (isNaN(coins) || coins < 1) return null;

    const rate = currencyRates.find((r) => r.currency === selectedCurrency);
    if (rate?.coins_per_unit) {
      const coinsPerUnit = parseFloat(rate.coins_per_unit);
      const price = coins / coinsPerUnit;
      const symbol = rate.symbol || '$';
      return { price, symbol, currency: selectedCurrency, coinsPerUnit };
    }
    // USD-only: 1 coin = US$1.00 when rates omit USD row
    return {
      price: coins,
      symbol: '$',
      currency: 'USD',
      coinsPerUnit: 1,
    };
  };

  if (success === '1') {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            py: 6,
          }}
        >
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: 'success.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.05)' },
              },
            }}
          >
            <CheckCircle sx={{ fontSize: 64, color: 'success.main' }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
            Payment Successful!
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 4, fontWeight: 400 }}>
            Your coins have been added to your account. You can now use them to rent fields and make purchases.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              size="large"
              startIcon={<ShoppingCart />}
              onClick={() => navigate(window.location.pathname.replace(/\/buy-coins.*/, ''))}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Continue Shopping
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<MonetizationOn />}
              onClick={() => navigate(window.location.pathname.replace(/\/buy-coins.*/, '/transaction'))}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              View Transactions
            </Button>
          </Stack>
          {typeof onSuccess === 'function' && onSuccess()}
        </Box>
      </Container>
    );
  }

  if (cancel === '1') {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            py: 6,
          }}
        >
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <Cancel sx={{ fontSize: 56, color: 'text.secondary' }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Payment Cancelled
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, maxWidth: 400 }}>
            No charges were made. Feel free to try again whenever you're ready.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<ArrowBack />}
            onClick={() => navigate(window.location.pathname.replace(/\/buy-coins.*/, ''))}
            sx={{ px: 4, py: 1.5, borderRadius: 2 }}
          >
            Go Back
          </Button>
        </Box>
      </Container>
    );
  }

  // Calculate savings and best value from dynamic packages
  const packsWithSavings = packs.map((pack, index) => {
    const finalPrice = pack.discountedPrice || pack.price || 0;
    const pricePerCoin = pack.discountedPricePerCoin || (finalPrice / pack.coins);
    const basePricePerCoin = packs[0]?.discountedPricePerCoin || (packs[0]?.discountedPrice || packs[0]?.price || 0) / (packs[0]?.coins || 100);
    const savings = index > 0 && basePricePerCoin > 0 
      ? Math.max(0, ((basePricePerCoin - pricePerCoin) / basePricePerCoin * 100).toFixed(0)) 
      : pack.discountPercent || 0;
    const isPopular = pack.isFeatured || (index >= 1 && index <= 2);
    const isBestValue = pack.isFeatured || index === packs.length - 1;
    return { 
      ...pack, 
      pricePerCoin, 
      savings: parseFloat(savings), 
      isPopular, 
      isBestValue,
      finalPrice: finalPrice,
      currencySymbol: pack.currencySymbol || pack.currency || '$',
    };
  });

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      {/* Header Section */}
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
          Add Coins to Your Account
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, mb: 1 }}>
          1 coin = US$1.00 of in-app value — the standard unit is USD.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2, flexWrap: 'wrap' }}>
          <Chip icon={<Security />} label="Secure Payment" size="small" color="success" variant="outlined" />
          <Chip icon={<Payment />} label="Card, Apple Pay, Google Pay" size="small" color="primary" variant="outlined" />
          <Chip icon={<Verified />} label="Instant Delivery" size="small" color="info" variant="outlined" />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5, px: 2 }}>
          A <strong>{COIN_PURCHASE_APP_FEE_PERCENT}% platform fee</strong> is added to your payment (you still receive the full coin amount).
        </Typography>
        {/*
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75, px: 2 }}>
          Non-USD prices use our fixed rates, not live bank exchange rates — choose USD if you prefer to pay in dollars.
        </Typography>
        */}
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 4, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Custom Coin Input Card */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
            Buy Custom Amount
          </Typography>
          <Grid container spacing={3} alignItems="stretch">
            {/*
             * Multi-currency dropdown — commented out per product (USD-only checkout). Restore with effect block above.
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Currency *</InputLabel>
                <Select
                  value={selectedCurrency}
                  label="Currency *"
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  sx={{ height: '56px' }}
                >
                  {currencyRates.map((rate) => (
                    <MenuItem key={rate.currency} value={rate.currency}>
                      {rate.currency} - {rate.display_name} ({rate.symbol})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            */}

            {/* Coins Input */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Number of Coins *"
                type="number"
                value={customCoins}
                onChange={(e) => setCustomCoins(e.target.value)}
                inputProps={{ min: 1 }}
                placeholder="e.g., 500"
                helperText={currencyRates.find((r) => r.currency === selectedCurrency)
                  ? (() => {
                      const r = currencyRates.find((x) => x.currency === selectedCurrency);
                      return `${r.coins_per_unit} coins = ${r.symbol}1.00`;
                    })()
                  : '1 coin = US$1.00'}
                sx={{ '& .MuiInputBase-root': { height: '56px' } }}
              />
            </Grid>

            {/* Price Display */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Total at checkout"
                value={calculateCustomPrice()
                  ? (() => {
                      const cp = calculateCustomPrice();
                      const b = coinCheckoutFeeBreakdown(cp.price);
                      return `${cp.symbol}${b.total.toFixed(2)}`;
                    })()
                  : ''}
                InputProps={{
                  readOnly: true,
                  sx: {
                    '& input[type=number]': {
                      MozAppearance: 'textfield',
                    },
                    '& input[type=number]::-webkit-outer-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                    '& input[type=number]::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                  }
                }}
                helperText={calculateCustomPrice()
                  ? (() => {
                      const cp = calculateCustomPrice();
                      const b = coinCheckoutFeeBreakdown(cp.price);
                      const rateLine =
                        cp.coinsPerUnit === 1
                          ? `${customCoins} coins × ${cp.symbol}1.00 = ${cp.symbol}${b.subtotal.toFixed(2)} subtotal`
                          : `${customCoins} coins ÷ ${cp.coinsPerUnit} = ${cp.symbol}${b.subtotal.toFixed(2)} subtotal`;
                      return `${rateLine}. + ${COIN_PURCHASE_APP_FEE_PERCENT}% fee: total ${cp.symbol}${b.total.toFixed(2)}.`;
                    })()
                  : 'Enter coin amount'}
                placeholder="Enter details to see price"
                sx={{ 
                  '& .MuiInputBase-root': { 
                    height: '56px',
                    bgcolor: calculateCustomPrice() ? 'success.main' : 'grey.50',
                    '& fieldset': {
                      borderColor: calculateCustomPrice() ? 'success.main' : undefined,
                    },
                    '&:hover fieldset': {
                      borderColor: calculateCustomPrice() ? 'success.dark' : undefined,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: calculateCustomPrice() ? 'success.dark' : undefined,
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    color: calculateCustomPrice() ? '#ffffff' : 'text.secondary',
                    cursor: 'default',
                  },
                  '& .MuiInputLabel-root': {
                    color: calculateCustomPrice() ? 'rgba(255, 255, 255, 0.7)' : undefined,
                    '&.Mui-focused': {
                      color: calculateCustomPrice() ? 'rgba(255, 255, 255, 0.7)' : undefined,
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: calculateCustomPrice() ? 'rgba(255, 255, 255, 0.8)' : undefined,
                  }
                }}
              />
            </Grid>

            {/* Buy Button */}
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleCustomBuy}
                disabled={purchasing !== null || !customCoins || parseInt(customCoins) < 1}
                startIcon={purchasing === 'custom' ? <CircularProgress size={20} color="inherit" /> : <ShoppingCart />}
                sx={{ 
                  height: '56px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none'
                }}
              >
                {purchasing === 'custom' ? 'Processing...' : 'Buy Now'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Package Cards */}
      <Grid container spacing={3} justifyContent="center">
        {packsWithSavings.map((pack, index) => {
          const isPurchasing = purchasing === pack.id;
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={pack.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: pack.isBestValue ? '2px solid' : '1px solid',
                  borderColor: pack.isBestValue ? 'warning.main' : 'divider',
                  borderRadius: 3,
                  overflow: 'visible',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: pack.isBestValue
                      ? '0 12px 24px rgba(255, 152, 0, 0.3)'
                      : '0 8px 16px rgba(0,0,0,0.15)',
                  },
                  cursor: purchasing ? 'wait' : 'pointer',
                  opacity: purchasing && !isPurchasing ? 0.6 : 1,
                }}
                onClick={() => !purchasing && handleBuy(pack.id)}
              >
                {/* Badge */}
                {pack.isBestValue && (
                  <Chip
                    label="Best Value"
                    color="warning"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -12,
                      right: 16,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  />
                )}
                {pack.isPopular && !pack.isBestValue && (
                  <Chip
                    label={pack.isFeatured ? "Featured" : "Popular"}
                    color="primary"
                    size="small"
                    icon={<Star />}
                    sx={{
                      position: 'absolute',
                      top: -12,
                      right: 16,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  />
                )}

                <CardContent sx={{ flexGrow: 1, p: 3, textAlign: 'center' }}>
                  {/* Icon */}
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: pack.isBestValue ? 'warning.light' : 'primary.light',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <MonetizationOn
                      sx={{
                        fontSize: 48,
                        color: pack.isBestValue ? 'warning.dark' : 'primary.main',
                      }}
                    />
                  </Box>

                  {/* Coins */}
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                    {pack.coins.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    Coins
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  {/* Price */}
                  <Box sx={{ mb: 2 }}>
                    {pack.discountPercent > 0 ? (
                      <>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            textDecoration: 'line-through', 
                            color: 'text.secondary',
                            mb: 0.5
                          }}
                        >
                          {pack.currencySymbol}{pack.price?.toFixed(2)}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main', mb: 0.5 }}>
                          {pack.currencySymbol}{pack.finalPrice?.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                          Save {pack.discountPercent}%
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                        {pack.currencySymbol}{pack.finalPrice?.toFixed(2)}
                      </Typography>
                    )}
                    {pack.savings > 0 && pack.discountPercent === 0 && (
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                        Save {pack.savings.toFixed(0)}% vs base
                      </Typography>
                    )}
                    {(() => {
                      const b = coinCheckoutFeeBreakdown(pack.finalPrice);
                      return (
                        <Typography
                          variant="caption"
                          component="div"
                          sx={{ color: 'text.secondary', mt: 1, lineHeight: 1.5, px: 0.5 }}
                        >
                          + {COIN_PURCHASE_APP_FEE_PERCENT}% app fee ({pack.currencySymbol}
                          {b.fee.toFixed(2)}) ·{' '}
                          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            Total {pack.currencySymbol}
                            {b.total.toFixed(2)}
                          </Box>
                          {' '}at payment
                        </Typography>
                      );
                    })()}
                  </Box>

                  {/* Value */}
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                    {pack.currencySymbol}{(pack.coins * 1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD value
                  </Typography>

                  {/* Buy Button */}
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    color={pack.isBestValue ? 'warning' : 'primary'}
                    disabled={purchasing !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(pack.id);
                    }}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 700,
                      fontSize: '1rem',
                      textTransform: 'none',
                    }}
                    startIcon={
                      isPurchasing ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <ShoppingCart />
                      )
                    }
                  >
                    {isPurchasing ? 'Processing...' : 'Buy Now'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Trust Indicators */}
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Trusted by farmers and buyers worldwide
        </Typography>
        <Stack direction="row" spacing={3} justifyContent="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security sx={{ fontSize: 20, color: 'success.main' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Secure & Encrypted
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Instant Delivery
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star sx={{ fontSize: 20, color: 'warning.main' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              24/7 Support
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Container>
  );
};

export default BuyCoins;
