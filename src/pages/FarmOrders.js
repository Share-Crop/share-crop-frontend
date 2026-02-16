import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Avatar,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip,
  Badge,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ShoppingCart,
  Visibility,
  FilterList,
  Download,
  TrendingUp,
  Assessment,
  Schedule,
  CheckCircle,
  Pending,
  Error as ErrorIcon,
  Receipt,
  LocalShipping,
  Person,
  Landscape,
  CalendarToday,
  LocationOn,
  Description,
  Close,
  Info,
} from '@mui/icons-material';
import { Alert, AlertTitle } from '@mui/material';
import { orderService } from '../services/orders';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Common/Loader';
import ErrorMessage from '../components/Common/ErrorMessage';

const FarmOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await orderService.getFarmerOrdersWithFields(user.id);
      const apiOrders = Array.isArray(response.data) ? response.data : [];

      const formattedOrders = apiOrders.map((order) => ({
        id: order.id,
        field_name: order.field_name || 'Unknown Field',
        buyer_name: order.buyer_name || 'Unknown Buyer',
        buyer_email: order.buyer_email || '',
        area_rented: `${order.quantity || 0} m²`,
        quantity: Number(order.quantity) || 0,
        total_cost: Number(order.total_price) || 0,
        status: order.status || 'pending',
        created_at: order.created_at,
        crop_type: order.crop_type || 'Mixed',
        price_per_unit: Number(order.price_per_m2) || 0,
        location: order.location || 'Unknown',
        delivery_date: order.selected_harvest_date || null,
        mode_of_shipping: order.mode_of_shipping || 'delivery',
        field_id: order.field_id,
        image_url: order.image_url || '',
      }));

      setOrders(formattedOrders);
    } catch (err) {
      console.error('Error loading farmer orders:', err);
      setError('Failed to load orders received. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [user, loadOrders]);

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const handleViewOnMap = (order) => {
    if (order.field_id) {
      // Navigate to farmer homepage with field_id parameter
      navigate(`/farmer?field_id=${order.field_id}`);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    if (!orderId || !newStatus) return;
    try {
      setUpdatingStatus(true);
      await orderService.updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      console.error('Update order status error:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'confirmed':
      case 'active':
        return 'primary';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleReportClick = () => {
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
  };

  const handleDownloadReport = (format = 'pdf') => {
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      totalOrders: filteredOrders.length,
      revenue: filteredOrders.reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0),
      orders: filteredOrders.map(order => ({
        id: order.id,
        field: order.field_name,
        buyer: order.buyer_name,
        area: order.area_rented,
        cost: order.total_cost,
        status: order.status,
        date: new Date(order.created_at).toLocaleDateString()
      }))
    };

    if (format === 'csv') {
      const headers = ['Order ID', 'Field Name', 'Buyer Name', 'Area', 'Total Cost', 'Status', 'Date'];
      const rows = reportData.orders.map(o => [
        o.id,
        o.field,
        o.buyer,
        o.area,
        `$${Number(o.cost).toFixed(2)}`,
        o.status,
        o.date
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `orders-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const printWindow = window.open('', '_blank');
      const reportHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Orders Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #1e293b; border-bottom: 2px solid #4caf50; padding-bottom: 10px; }
              h2 { color: #059669; margin-top: 30px; }
              .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
              .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
              .summary-value { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 5px; }
              .summary-label { font-size: 12px; color: #64748b; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #4caf50; color: white; padding: 12px; text-align: left; font-weight: bold; }
              td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
              @media print { body { margin: 0; padding: 15px; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <h1>Orders Report</h1>
            <p><strong>Generated:</strong> ${reportData.generatedAt}</p>
            <div class="summary">
              <div class="summary-card">
                <div class="summary-value">${reportData.totalOrders}</div>
                <div class="summary-label">Total Orders</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">$${reportData.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="summary-label">Total Revenue</div>
              </div>
            </div>
            <h2>Order Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Field</th>
                  <th>Buyer</th>
                  <th>Area</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.orders.map(order => `
                  <tr>
                    <td>#${order.id}</td>
                    <td>${order.field}</td>
                    <td>${order.buyer}</td>
                    <td>${order.area}</td>
                    <td>$${Number(order.cost).toFixed(2)}</td>
                    <td>${order.status}</td>
                    <td>${order.date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">
              <p>This report was generated on ${reportData.generatedAt}</p>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(reportHTML);
      printWindow.document.close();
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  if (loading) return <Loader message="Loading orders received..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadOrders} />;

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0);
  const activeOrders = orders.filter((o) =>
    ['active', 'pending'].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const completionRate =
    orders.length > 0 ? (completedOrders / orders.length) * 100 : 0;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        p: 3,
      }}
    >
      <Box sx={{ maxWidth: '1400px', mx: 'auto', mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#1e293b',
                mb: 0.5,
                fontSize: '1.75rem',
              }}
            >
              Orders Received
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
              Orders placed by buyers on your fields — manage and update status
            </Typography>
          </Box>

        </Stack>

        {/* Payment Logic Info Alert */}
        <Alert
          severity="info"
          variant="outlined"
          icon={<Info fontSize="large" />}
          sx={{
            mb: 3,
            borderRadius: 2,
            backgroundColor: '#f0f9ff',
            borderColor: '#bae6fd',
            '& .MuiAlert-icon': { color: '#0284c7' },
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <AlertTitle sx={{ fontWeight: 700, color: '#0369a1' }}>Confirm Orders to Receive Payments</AlertTitle>
          When a buyer places an order, the coins are held in escrow. <strong>Change the status from "Pending" to "Active"</strong> to confirm the order and instantly receive the coins in your wallet.
          <Box sx={{ mt: 1, color: '#b91c1c' }}>
            <strong>Warning:</strong> If you cancel an <em>Active</em> or <em>Completed</em> order, the coins will be automatically deducted from your wallet and refunded to the buyer.
          </Box>
        </Alert>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8', width: 40, height: 40 }}>
                  <ShoppingCart sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {orders.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Total Orders
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ backgroundColor: '#dcfce7', color: '#059669', width: 40, height: 40 }}>
                  <LocalShipping sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {activeOrders}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Active Orders
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ backgroundColor: '#fef3c7', color: '#d97706', width: 40, height: 40 }}>
                  <TrendingUp sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Total Revenue
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ backgroundColor: '#f3e8ff', color: '#7c3aed', width: 40, height: 40 }}>
                  <Assessment sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {completionRate.toFixed(0)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Completion Rate
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            backgroundColor: 'white',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>
              Filter Orders
            </Typography>
            <Badge badgeContent={filteredOrders.length} color="primary">
              <FilterList color="action" sx={{ fontSize: 20 }} />
            </Badge>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {[
              { key: 'all', label: 'All Orders', icon: <ShoppingCart /> },
              { key: 'pending', label: 'Pending', icon: <Schedule /> },
              { key: 'active', label: 'Active', icon: <LocalShipping /> },
              { key: 'completed', label: 'Completed', icon: <CheckCircle /> },
              { key: 'cancelled', label: 'Cancelled', icon: <ErrorIcon /> },
            ].map(({ key, label, icon }) => (
              <Button
                key={key}
                variant={filter === key ? 'contained' : 'outlined'}
                size="medium"
                onClick={() => setFilter(key)}
                startIcon={icon}
                sx={{
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  ...(filter === key && {
                    backgroundColor: '#4caf50',

                    color: 'white',
                  }),
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Paper>

        {/* Orders Table */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            backgroundColor: 'white',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>
                  Order History
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {filteredOrders.length} {filter === 'all' ? 'total' : filter} orders
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={handleReportClick}
                startIcon={<Download sx={{ fontSize: 18 }} />}
                sx={{ borderRadius: 2, px: 2, py: 1, fontSize: '0.8rem' }}
              >
                Export
              </Button>
            </Stack>
          </Box>

          {filteredOrders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ShoppingCart sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
              <Typography variant="subtitle1" color="text.secondary" gutterBottom sx={{ fontSize: '1rem' }}>
                {filter === 'all' ? 'No orders received yet' : `No ${filter} orders found`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {filter === 'all' ? 'Orders from buyers will appear here.' : 'Try a different filter.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>

                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Field / Product</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Buyer</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Area</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Revenue</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOrders.map((order, index) => (
                    <TableRow
                      key={order.id}
                      onClick={() => handleViewOnMap(order)}
                      sx={{
                        cursor: order.field_id ? 'pointer' : 'default',
                        '&:hover': { backgroundColor: '#f8fafc' },
                        borderBottom: index === filteredOrders.length - 1 ? 'none' : '1px solid #e2e8f0',
                      }}
                    >

                      <TableCell sx={{ py: 1.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          {order.image_url ? (
                            <Box
                              component="img"
                              src={order.image_url}
                              alt={order.field_name}
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1.5,
                                objectFit: 'cover',
                                border: '1px solid #e2e8f0',
                              }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Avatar sx={{ width: 40, height: 40, bgcolor: '#dcfce7', color: '#059669' }}>
                              <Landscape sx={{ fontSize: 20 }} />
                            </Avatar>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                            {order.field_name}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                          {order.buyer_name}
                        </Typography>
                        {order.buyer_email && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {order.buyer_email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {order.area_rented}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669', fontSize: '0.8rem' }}>
                          ${Number(order.total_cost).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1, minWidth: 150 }}>
                        <FormControl size="small" fullWidth onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            disabled={updatingStatus}
                            sx={{
                              borderRadius: 1.5,
                              fontSize: '0.75rem',
                              height: 32,
                              backgroundColor: order.status === 'pending' ? '#fffbeb' : 'white',
                              '& .MuiSelect-select': {
                                py: 0.5,
                                fontWeight: 600,
                                color: getStatusColor(order.status) === 'primary' ? '#1d4ed8' :
                                  getStatusColor(order.status) === 'success' ? '#059669' :
                                    getStatusColor(order.status) === 'warning' ? '#d97706' : '#ef4444'
                              }
                            }}
                          >
                            <MenuItem value="pending" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>Pending</MenuItem>
                            <MenuItem value="active" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8' }}>Active</MenuItem>
                            <MenuItem value="completed" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>Completed</MenuItem>
                            <MenuItem value="cancelled" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>Cancelled</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {new Date(order.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5}>
                          {order.field_id && (
                            <Tooltip title="View on Map">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewOnMap(order);
                                }}
                                sx={{
                                  color: '#1d4ed8',
                                  '&:hover': { backgroundColor: '#dbeafe' },
                                  p: 0.5,
                                }}
                              >
                                <LocationOn sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="View details & update status">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(order);
                              }}
                              sx={{
                                color: '#059669',

                                p: 0.5,
                              }}
                            >
                              <Visibility sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Order details dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
              <Receipt />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Order Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                #{selectedOrder?.id}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedOrder && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    backgroundColor: '#f8fafc',
                    height: '100%',
                    minHeight: 320,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    {selectedOrder.image_url ? (
                      <Box
                        component="img"
                        src={selectedOrder.image_url}
                        alt={selectedOrder.field_name}
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 2,
                          objectFit: 'cover',
                          border: '1px solid #e2e8f0',
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <Avatar sx={{ backgroundColor: '#dcfce7', color: '#059669', width: 40, height: 40 }}>
                        <Landscape />
                      </Avatar>
                    )}
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      Field / Product
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Field Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedOrder.field_name}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Crop / Category
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedOrder.crop_type}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Location
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedOrder.location}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Area
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedOrder.area_rented}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Price per m²
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#059669' }}>
                        ${Number(selectedOrder.price_per_unit).toFixed(2)}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    backgroundColor: '#f8fafc',
                    height: '100%',
                    minHeight: 320,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Avatar sx={{ backgroundColor: '#fef3c7', color: '#d97706', width: 40, height: 40 }}>
                      <Person />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      Buyer & Order
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Buyer Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedOrder.buyer_name}
                      </Typography>
                    </Box>
                    {selectedOrder.buyer_email && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                          Buyer Email
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedOrder.buyer_email}
                        </Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Status
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={selectedOrder.status}
                          color={getStatusColor(selectedOrder.status)}
                          size="small"
                          sx={{
                            fontWeight: 500,
                            borderRadius: 2,
                            ...(selectedOrder.status === 'completed' && {
                              color: '#ffffff'
                            })
                          }}
                        />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Order Status
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={selectedOrder.status}
                          color={getStatusColor(selectedOrder.status)}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            borderRadius: 2,
                            ...(selectedOrder.status === 'completed' && {
                              color: '#ffffff'
                            })
                          }}
                        />
                        <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic', color: '#64748b' }}>
                          Status can be updated directly from the orders table.
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Total Revenue
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                        ${Number(selectedOrder.total_cost).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        Order Date
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {new Date(selectedOrder.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    {selectedOrder.delivery_date && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                          Delivery / Harvest Date
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {new Date(selectedOrder.delivery_date).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <Button onClick={() => setDetailsOpen(false)} sx={{ borderRadius: 2 }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            sx={{
              backgroundColor: '#059669',

              borderRadius: 2,
              px: 3,
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Dialog */}
      <Dialog
        open={reportOpen}
        onClose={handleCloseReport}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                Orders Report
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overview of {filter === 'all' ? 'all' : filter} orders
              </Typography>
            </Box>
            <IconButton onClick={handleCloseReport} sx={{ color: '#64748b' }}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box>
            {/* Summary Statistics */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                    {filteredOrders.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Orders
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
                    ${filteredOrders.reduce((sum, o) => sum + (Number(o.total_cost) || 0), 0).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Revenue
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Orders Summary Table */}
            <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                Orders List
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Order ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Field</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Buyer</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Cost</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>#{order.id}</TableCell>
                        <TableCell>{order.field_name}</TableCell>
                        <TableCell>{order.buyer_name}</TableCell>
                        <TableCell>{order.area_rented}</TableCell>
                        <TableCell>${Number(order.total_cost).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.status}
                            color={getStatusColor(order.status)}
                            size="small"
                            sx={{ fontWeight: 600, height: 24 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Report generated on {new Date().toLocaleString()}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => handleDownloadReport('csv')}
            variant="outlined"
            startIcon={<Download />}
            sx={{ borderRadius: 1.5 }}
          >
            Download CSV
          </Button>
          <Button
            onClick={() => handleDownloadReport('pdf')}
            variant="outlined"
            startIcon={<Description />}
            sx={{ borderRadius: 1.5 }}
          >
            Download PDF
          </Button>
          <Button onClick={handleCloseReport} variant="contained" sx={{ borderRadius: 1.5, bgcolor: '#4caf50', color: '#ffffff', '&:hover': { bgcolor: '#059669' } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FarmOrders;
