import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  Divider,
  Button,
  IconButton,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  TrendingUp,
  Assessment,
  Receipt,
  MonetizationOn,
  TrendingDown,
  Search,
  ArrowUpward,
  ArrowDownward,
  SwapHoriz,
} from '@mui/icons-material';
import { transactionsService } from '../services/transactions';
import { useAuth } from '../contexts/AuthContext';
import StatCard from '../components/Common/StatCard';
import { orderService } from '../services/orders';
import { CircularProgress, Alert } from '@mui/material';
import api from '../services/api';

const Transaction = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Currency symbols mapping
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PKR': '₨',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF'
  };

  // Load user's preferred currency and transaction data
  useEffect(() => {
    if (user) {
      // Load user's preferred currency
      const loadUserCurrency = async () => {
        try {
          const response = await api.get(`/api/users/${user.id}/preferred-currency`);
          if (response.data) {
            setUserCurrency(response.data.preferred_currency || 'USD');
          }
        } catch (err) {
          console.warn('Could not load user currency preference:', err);
        }
      };
      loadUserCurrency();
      loadTransactions();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when user is set
  }, [user]);

  const loadTransactions = async () => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch coin transactions
      const coinTransactionsResponse = await transactionsService.getMyTransactions();
      const coinTransactions = coinTransactionsResponse.data || [];

      // Fetch orders to map to transactions
      let orders = [];
      try {
        if (user.user_type === 'buyer') {
          const ordersResponse = await orderService.getBuyerOrders();
          orders = ordersResponse.data || [];
        } else if (user.user_type === 'farmer') {
          const ordersResponse = await orderService.getFarmerOrders(user.id);
          orders = ordersResponse.data || [];
        }
      } catch (orderErr) {
        console.warn('Could not load orders for transactions:', orderErr);
      }

      // Map coin transactions to transaction format (ensure numeric amount/balance_after)
      const mappedTransactions = coinTransactions.map((tx, index) => {
        const relatedOrder = tx.ref_type === 'orders' && tx.ref_id
          ? orders.find(o => o.id === tx.ref_id)
          : null;

        return {
          id: tx.id || `TXN-${String(index + 1).padStart(3, '0')}`,
          type: tx.type === 'credit' ? 'Income' : 'Expense',
          category: tx.reason || (tx.type === 'credit' ? 'Coin Credit' : 'Coin Debit'),
          description: tx.reason || (tx.type === 'credit' ? 'Coins credited' : 'Coins debited'),
          amount: Number(tx.amount) || 0,
          created_at: tx.created_at || null,
          date: tx.created_at ? new Date(tx.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: 'Completed',
          paymentMethod: 'Coins',
          reference: tx.ref_id || '',
          balanceAfter: Number(tx.balance_after) || 0,
          ref_type: tx.ref_type || '',
          farmName: relatedOrder?.field_name || 'N/A',
          buyer: relatedOrder?.buyer_name || '',
          farmer: relatedOrder?.farmer_name || '',
          currency: tx.currency || 'USD' // Use currency from transaction, fallback to USD
        };
      });

      // Sort by date (newest first)
      mappedTransactions.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

      setTransactions(mappedTransactions);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transactions. Please try again.');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'Income': return <ArrowUpward />;
      case 'Expense': return <ArrowDownward />;
      default: return <SwapHoriz />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'Income': return '#4caf50';
      case 'Expense': return '#f44336';
      default: return '#2196f3';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'Pending': return 'warning';
      case 'Failed': return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (amount, currency = null) => {
    const currencyToUse = currency || userCurrency;
    const symbol = currencySymbols[currencyToUse?.toUpperCase()] || currencySymbols[currencyToUse] || '$';
    return `${symbol}${Number(amount).toLocaleString()}`;
  };

  // Format full timestamp with milliseconds (e.g. "Feb 7, 2026, 7:02:29.859 PM")
  const formatTransactionTime = (createdAt) => {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return String(createdAt);
    const datePart = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString(undefined, { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${datePart}, ${timePart}.${ms}`;
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const filterTransactionsByType = (type) => {
    if (type === 'all') return transactions;
    return transactions.filter(transaction => transaction.type.toLowerCase() === type.toLowerCase());
  };

  const getFilteredTransactions = () => {
    let filtered;
    switch (tabValue) {
      case 0: filtered = transactions; break;
      case 1: filtered = filterTransactionsByType('income'); break;
      case 2: filtered = filterTransactionsByType('expense'); break;
      default: filtered = transactions;
    }

    if (searchQuery) {
      filtered = filtered.filter(transaction =>
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const getFinancialSummary = () => {
    const totalIncome = transactions
      .filter(t => t.type === 'Income' && t.status === 'Completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'Expense' && t.status === 'Completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const netProfit = totalIncome - totalExpenses;
    const pendingAmount = transactions
      .filter(t => t.status === 'Pending')
      .reduce((sum, t) => sum + t.amount, 0);

    return { totalIncome, totalExpenses, netProfit, pendingAmount };
  };

  const summary = getFinancialSummary();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={loadTransactions}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      p: 3
    }}>
      <Box sx={{
        maxWidth: '1400px',
        mx: 'auto',
        mb: 4
      }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
            Transaction History
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b', fontSize: '1.1rem' }}>
            Track your farm income, expenses, and financial transactions
          </Typography>
        </Box>

        {/* Financial Summary Cards */}
        <div className="mb-4 grid max-w-[480px] grid-cols-2 gap-3 md:max-w-none md:grid-cols-4">
          <StatCard
            icon={<TrendingUp sx={{ fontSize: 20 }} />}
            iconBg="#dcfce7"
            iconColor="#059669"
            value={formatCurrency(summary.totalIncome, userCurrency)}
            label="Total Income"
          />
          <StatCard
            icon={<TrendingDown sx={{ fontSize: 20 }} />}
            iconBg="#fee2e2"
            iconColor="#dc2626"
            value={formatCurrency(summary.totalExpenses, userCurrency)}
            label="Total Expenses"
          />
          <StatCard
            icon={<MonetizationOn sx={{ fontSize: 20 }} />}
            iconBg={summary.netProfit >= 0 ? '#dcfce7' : '#fee2e2'}
            iconColor={summary.netProfit >= 0 ? '#059669' : '#dc2626'}
            value={formatCurrency(summary.netProfit, userCurrency)}
            label="Net Profit"
          />
          <StatCard
            icon={<Assessment sx={{ fontSize: 20 }} />}
            iconBg="#fef3c7"
            iconColor="#f59e0b"
            value={formatCurrency(summary.pendingAmount, userCurrency)}
            label="Pending Amount"
          />
        </div>

        {/* Transaction Table */}
        <Paper sx={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 2,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                Transaction Details
              </Typography>
            </Box>

            <TextField
              placeholder="Search transactions..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 300,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#e2e8f0',
                  },
                  '&:hover fieldset': {
                    borderColor: '#059669',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#059669',
                  },
                }
              }}
            />
          </Box>

          <Box sx={{ borderBottom: '1px solid #e2e8f0' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  color: '#64748b',
                  '&.Mui-selected': {
                    color: '#059669',
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#059669',
                },
              }}
            >
              <Tab label="All Transactions" />
              <Tab label="Income" />
              <Tab label="Expenses" />
            </Tabs>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Transaction ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Date & time</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Balance after</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Payment Method</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getFilteredTransactions().map((transaction) => (
                  <TableRow key={transaction.id} hover sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{
                            bgcolor: transaction.type === 'Income' ? '#dcfce7' : '#fee2e2',
                            color: transaction.type === 'Income' ? '#059669' : '#dc2626',
                            width: 32,
                            height: 32
                          }}
                        >
                          {getTransactionIcon(transaction.type)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#374151' }}>
                          {transaction.id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#64748b' }} title={transaction.created_at || transaction.date}>
                        {formatTransactionTime(transaction.created_at || transaction.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#374151' }}>
                          {transaction.description}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {transaction.farmName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.category}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: '#e2e8f0',
                          color: '#64748b',
                          backgroundColor: '#f8fafc'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: transaction.type === 'Income' ? '#059669' : '#dc2626'
                        }}
                      >
                        {transaction.type === 'Expense' ? '-' : '+'}{formatCurrency(transaction.amount, transaction.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>
                        {Number(transaction.balanceAfter).toLocaleString()} coins
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.status}
                        color={getStatusColor(transaction.status)}
                        size="small"
                        sx={{
                          ...(transaction.status === 'Completed' && {
                            color: '#ffffff'
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        {transaction.paymentMethod}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {getFilteredTransactions().length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Receipt sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                No transactions found
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                {searchQuery ? 'Try adjusting your search criteria.' : 'Start by adding your first transaction.'}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default Transaction;