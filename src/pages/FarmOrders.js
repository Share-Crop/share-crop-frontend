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
  TextField,
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
  CalendarToday,
  LocationOn,
  Description,
  Close,
  Info,
  HighlightOff,
  Inventory2,
} from '@mui/icons-material';
import { Alert, AlertTitle } from '@mui/material';
import StatCard from '../components/Common/StatCard';
import { orderService } from '../services/orders';
import { useAuth } from '../contexts/AuthContext';
import Loader from '../components/Common/Loader';
import ErrorMessage from '../components/Common/ErrorMessage';
import { getProductIcon } from '../utils/productIcons';
import HarvestProgressBar from '../components/Common/HarvestProgressBar';
import fieldsService from '../services/fields';
import { canSelectShippedOrCompletedStatus, getOrderHarvestYmd } from '../utils/orderHarvestGate';
import { getEstimatedDeliveryLeadDays, formatShippingLeadAfterHarvest } from '../utils/fieldEstimatedDelivery';

const orderProductIconSrc = (order) =>
  getProductIcon(order.subcategory || order.crop_type || order.category);

/**
 * Extract delivery address from order notes (map checkout: `Shipping: Delivery | Address: ...`
 * or `| Deliver to: ...`; also splits on `|` and scans segments).
 */
const parseDeliveryAddressFromNotes = (notes) => {
  if (notes == null || typeof notes !== 'string') return '';
  const trimmed = notes.trim();
  if (!trimmed) return '';
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim());
    for (const p of parts) {
      const m = p.match(/^Address:\s*(.+)$/i) || p.match(/^Deliver to:\s*(.+)$/i);
      if (m?.[1]) return m[1].trim();
    }
  }
  const patterns = [
    /\|\s*Address:\s*(.+)$/i,
    /\|\s*Deliver to:\s*(.+)$/i,
    /Address:\s*(.+)$/i,
    /Deliver to:\s*(.+)$/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return '';
};

const isDeliveryMode = (order) => {
  const m = String(order?.mode_of_shipping || '').toLowerCase();
  return m === 'delivery' || m.includes('delivery');
};

/** One line + optional label for the orders table */
const harvestDateDisplay = (order) => {
  const ymd = getOrderHarvestYmd(order);
  if (ymd) {
    const d = new Date(String(ymd).includes('T') ? ymd : `${String(ymd).slice(0, 10)}T12:00:00`);
    const dateText = !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : String(ymd).slice(0, 10);
    return { dateText, label: (order?.selected_harvest_label || '').trim() || null };
  }
  const onlyLabel = (order?.selected_harvest_label || '').trim();
  if (onlyLabel) {
    return { dateText: onlyLabel, label: null };
  }
  return { dateText: null, label: null };
};

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
  const [rejectRefundOpen, setRejectRefundOpen] = useState(false);
  const [rejectRefundContext, setRejectRefundContext] = useState({ requestId: null, fieldName: '' });
  const [rejectFarmerNote, setRejectFarmerNote] = useState('');
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  const [harvestCompleteOpen, setHarvestCompleteOpen] = useState(false);
  const [harvestOrder, setHarvestOrder] = useState(null);
  const [harvestAmount, setHarvestAmount] = useState('');
  const [harvestUnit, setHarvestUnit] = useState('kg');
  const [harvestNote, setHarvestNote] = useState('');
  const [harvestFormError, setHarvestFormError] = useState(null);

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [response, fieldsResponse] = await Promise.all([
        orderService.getFarmerOrdersWithFields(user.id),
        fieldsService.getAll(),
      ]);
      const apiOrders = Array.isArray(response.data) ? response.data : [];
      const ownFields = Array.isArray(fieldsResponse.data) ? fieldsResponse.data : [];
      const ownFieldById = new Map(
        ownFields.map((field) => [String(field.id), field])
      );

      const formattedOrders = apiOrders.map((order) => {
        const mergedField = ownFieldById.get(String(order.field_id)) || {};
        const rawLeadDays = mergedField.estimated_delivery_days ?? order.estimated_delivery_days;
        const parsedLeadDays =
          rawLeadDays != null && rawLeadDays !== ''
            ? parseInt(String(rawLeadDays), 10)
            : NaN;
        const estimated_delivery_days =
          Number.isFinite(parsedLeadDays) && parsedLeadDays >= 1 ? parsedLeadDays : null;

        return {
        ...mergedField,
        id: order.id,
        field_name: order.field_name || 'Unknown Field',
        buyer_name: order.buyer_name || 'Unknown Buyer',
        buyer_email: order.buyer_email || '',
        area_rented: `${order.quantity || 0} m²`,
        quantity: Number(order.quantity) || 0,
        total_cost: Number(order.total_price) || 0,
        status: order.status || 'pending',
        created_at:
          ownFieldById.get(String(order.field_id))?.created_at ||
          ownFieldById.get(String(order.field_id))?.createdAt ||
          order.created_at,
        order_created_at: order.created_at,
        field_created_at:
          order.field_created_at ||
          order.fieldCreatedAt ||
          order.field_created_date ||
          order.fieldCreatedDate ||
          ownFieldById.get(String(order.field_id))?.created_at ||
          ownFieldById.get(String(order.field_id))?.createdAt ||
          null,
        crop_type: order.crop_type || 'Mixed',
        subcategory: order.subcategory || order.sub_category || null,
        price_per_unit: Number(order.price_per_m2) || 0,
        location: order.location || 'Unknown',
        delivery_date: order.selected_harvest_date || null,
        estimated_delivery_days,
        order_selected_harvest_date: order.selected_harvest_date || null,
        selected_harvest_date:
          ownFieldById.get(String(order.field_id))?.selected_harvest_date ||
          ownFieldById.get(String(order.field_id))?.selectedHarvestDate?.date ||
          ownFieldById.get(String(order.field_id))?.harvest_date ||
          ownFieldById.get(String(order.field_id))?.harvestDate ||
          order.selected_harvest_date ||
          null,
        selected_harvests:
          ownFieldById.get(String(order.field_id))?.selected_harvests ||
          ownFieldById.get(String(order.field_id))?.selectedHarvests ||
          ownFieldById.get(String(order.field_id))?.harvest_dates ||
          ownFieldById.get(String(order.field_id))?.harvestDates ||
          order.selected_harvests ||
          order.selectedHarvests ||
          [],
        harvest_date:
          ownFieldById.get(String(order.field_id))?.harvest_date ||
          ownFieldById.get(String(order.field_id))?.harvestDate ||
          order.harvest_date ||
          order.harvestDate ||
          order.selected_harvest_date ||
          null,
        harvest_dates:
          ownFieldById.get(String(order.field_id))?.harvest_dates ||
          ownFieldById.get(String(order.field_id))?.harvestDates ||
          order.harvest_dates ||
          order.harvestDates ||
          [],
        mode_of_shipping: order.mode_of_shipping || 'delivery',
        field_id: order.field_id,
        farm_id: order.farm_id || mergedField.farm_id || mergedField.farmId || null,
        notes: order.notes ?? null,
        selected_harvest_label: order.selected_harvest_label || null,
        total_production_unit:
          mergedField.total_production_unit || mergedField.total_productionUnit || 'kg',
        delivery_address: parseDeliveryAddressFromNotes(order.notes),
        pending_refund_request_id: order.pending_refund_request_id || null,
        pending_refund_request_reason: order.pending_refund_request_reason || null,
      };
      });

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

  const doStatusUpdate = useCallback(
    async (orderId, newStatus, extra = {}) => {
      if (!orderId || !newStatus) return false;
      setError(null);
      setUpdatingStatus(true);
      try {
        await orderService.updateOrderStatus(orderId, newStatus, extra);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        return true;
      } catch (err) {
        console.error('Update order status error:', err);
        setError(err.response?.data?.error || err.message || 'Could not update order status');
        return false;
      } finally {
        setUpdatingStatus(false);
      }
    },
    [selectedOrder?.id]
  );

  const handleStatusChange = async (order, newStatus) => {
    if (!order?.id || !newStatus) return;
    if (newStatus === 'completed' && String(user?.user_type || '') !== 'admin') {
      setHarvestOrder(order);
      setHarvestAmount('');
      setHarvestUnit(
        (order.total_production_unit && String(order.total_production_unit).trim()) || 'kg'
      );
      setHarvestNote('');
      setHarvestFormError(null);
      setHarvestCompleteOpen(true);
      return;
    }
    await doStatusUpdate(order.id, newStatus, {});
  };

  const submitHarvestComplete = async () => {
    if (!harvestOrder?.id) return;
    const n = parseFloat(String(harvestAmount).replace(/,/g, ''));
    if (Number.isNaN(n) || n <= 0) {
      setHarvestFormError('Enter a positive number for the total amount you actually harvested (for this field).');
      return;
    }
    const unit = (harvestUnit || 'kg').trim() || 'kg';
    setHarvestFormError(null);
    const ok = await doStatusUpdate(harvestOrder.id, 'completed', {
      declared_harvest: {
        amount: n,
        unit,
        notes: harvestNote?.trim() || undefined,
      },
    });
    if (ok) {
      setHarvestCompleteOpen(false);
      setHarvestOrder(null);
    }
  };

  const handleApproveRefund = async (requestId) => {
    if (!requestId) return;
    if (
      !window.confirm(
        'Approve this refund? The order will be cancelled and coins returned to the buyer. If the order was already active or completed, the coin amount will be deducted from your wallet first.'
      )
    ) {
      return;
    }
    try {
      setError(null);
      setRefundActionLoading(true);
      await orderService.resolveRefundRequest(requestId, { action: 'approve' });
      await loadOrders();
    } catch (err) {
      console.error('Approve refund error:', err);
      setError(err.response?.data?.error || err.message || 'Could not approve refund');
    } finally {
      setRefundActionLoading(false);
    }
  };

  const openRejectRefund = (requestId, fieldName) => {
    setRejectRefundContext({ requestId, fieldName: fieldName || 'this field' });
    setRejectFarmerNote('');
    setRejectRefundOpen(true);
  };

  const submitRejectRefund = async () => {
    const { requestId } = rejectRefundContext;
    if (!requestId) return;
    try {
      setError(null);
      setRefundActionLoading(true);
      await orderService.resolveRefundRequest(requestId, {
        action: 'reject',
        farmer_response: rejectFarmerNote.trim() || undefined,
      });
      setRejectRefundOpen(false);
      await loadOrders();
    } catch (err) {
      console.error('Reject refund error:', err);
      setError(err.response?.data?.error || err.message || 'Could not decline refund request');
    } finally {
      setRefundActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'confirmed':
      case 'active':
        return 'primary';
      case 'shipped':
        return 'info';
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
        date: new Date(order.order_created_at || order.created_at).toLocaleDateString(),
        deliverTo: order.delivery_address || '',
      }))
    };

    if (format === 'csv') {
      const headers = ['Order ID', 'Field Name', 'Buyer Name', 'Deliver to', 'Area', 'Total Cost', 'Status', 'Date'];
      const csvEscape = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
      const rows = reportData.orders.map(o => [
        o.id,
        o.field,
        o.buyer,
        o.deliverTo,
        o.area,
        `$${Number(o.cost).toFixed(2)}`,
        o.status,
        o.date
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map(csvEscape).join(','))
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
                  <th>Deliver to</th>
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
                    <td>${order.deliverTo || '—'}</td>
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
    ['active', 'pending', 'shipped'].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) => o.status === 'completed').length;
  const completionRate =
    orders.length > 0 ? (completedOrders / orders.length) * 100 : 0;
  const pendingRefundCount = orders.filter((o) => o.pending_refund_request_id).length;

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
          <Box sx={{ mt: 1.5, color: '#0f172a' }}>
            <strong>Shipped / Completed:</strong> You can choose these only <strong>on or after the order&apos;s harvest date</strong> (the date the buyer selected). Until then they stay disabled in the status menu.
          </Box>
          <Box sx={{ mt: 1.5, color: '#0f172a' }}>
            <strong>Pending deadline:</strong> If you do not accept a <em>Pending</em> order within <strong>7 days</strong> of when it was placed, it is <strong>automatically cancelled</strong> and the buyer&apos;s coins are refunded.
          </Box>
          <Box sx={{ mt: 1, color: '#b91c1c' }}>
            <strong>Warning:</strong> If you cancel an <em>Active</em> or <em>Completed</em> order, the coins will be automatically deducted from your wallet and refunded to the buyer.
          </Box>
        </Alert>

        {pendingRefundCount > 0 && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>Buyer refund requests</AlertTitle>
            {pendingRefundCount === 1
              ? 'One order has a pending refund request.'
              : `${pendingRefundCount} orders have pending refund requests.`}{' '}
            Use the green check to approve (cancel the order and refund coins) or the red icon to decline.
          </Alert>
        )}

        {/* Stats */}
        <div className="mb-3 grid max-w-[480px] grid-cols-2 gap-3 md:max-w-none md:grid-cols-4">
          <StatCard
            icon={<ShoppingCart sx={{ fontSize: 20 }} />}
            iconBg="#dbeafe"
            iconColor="#1d4ed8"
            value={orders.length}
            label="Total Orders"
          />
          <StatCard
            icon={<LocalShipping sx={{ fontSize: 20 }} />}
            iconBg="#dcfce7"
            iconColor="#059669"
            value={activeOrders}
            label="Active Orders"
          />
          <StatCard
            icon={<TrendingUp sx={{ fontSize: 20 }} />}
            iconBg="#fef3c7"
            iconColor="#d97706"
            value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            label="Total Revenue"
          />
          <StatCard
            icon={<Assessment sx={{ fontSize: 20 }} />}
            iconBg="#f3e8ff"
            iconColor="#7c3aed"
            value={`${completionRate.toFixed(0)}%`}
            label="Completion Rate"
          />
        </div>

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
              { key: 'shipped', label: 'Shipped', icon: <Inventory2 /> },
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
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Harvest date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Deliver to</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Area</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Revenue</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>Order date</TableCell>
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
                          <Box
                            component="img"
                            src={orderProductIconSrc(order)}
                            alt={order.field_name}
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1.5,
                              objectFit: 'cover',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.75 }}>
                              {order.field_name}
                            </Typography>
                            <HarvestProgressBar item={order} compact showDate={false} daysShort />
                          </Box>
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
                      <TableCell sx={{ py: 1.5, maxWidth: 160 }}>
                        {(() => {
                          const { dateText, label } = harvestDateDisplay(order);
                          if (!dateText) {
                            return (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                —
                              </Typography>
                            );
                          }
                          return (
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                                {dateText}
                              </Typography>
                              {label ? (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontSize: '0.7rem', display: 'block' }}
                                >
                                  {label}
                                </Typography>
                              ) : null}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell sx={{ py: 1.5, maxWidth: 200 }}>
                        {order.delivery_address ? (
                          <Tooltip title={order.delivery_address}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: '0.8rem',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                wordBreak: 'break-word',
                              }}
                            >
                              {order.delivery_address}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            —
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
                        <Tooltip
                          title={order.status === 'cancelled' ? 'Cancelled orders cannot be changed.' : ''}
                          disableHoverListener={order.status !== 'cancelled'}
                        >
                          <Box sx={{ width: '100%' }} onClick={(e) => e.stopPropagation()}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={order.status}
                                onChange={(e) => handleStatusChange(order, e.target.value)}
                                disabled={updatingStatus || order.status === 'cancelled'}
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
                                        getStatusColor(order.status) === 'info' ? '#0369a1' :
                                        getStatusColor(order.status) === 'warning' ? '#d97706' : '#ef4444'
                                  }
                                }}
                              >
                                <MenuItem value="pending" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>Pending</MenuItem>
                                <MenuItem value="active" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8' }}>Active</MenuItem>
                                {(() => {
                                  const harvestOk = canSelectShippedOrCompletedStatus(order);
                                  const ymd = getOrderHarvestYmd(order);
                                  const shipDisabled = !harvestOk && order.status !== 'shipped';
                                  const doneDisabled = !harvestOk && order.status !== 'completed';
                                  const lockHint = ymd
                                    ? `Available on or after harvest (${ymd})`
                                    : 'Set a harvest date on the order before Shipped or Completed.';
                                  return (
                                    <>
                                      <Tooltip title={shipDisabled ? lockHint : ''}>
                                        <span>
                                          <MenuItem
                                            value="shipped"
                                            disabled={shipDisabled}
                                            sx={{ fontSize: '0.75rem', fontWeight: 600, color: shipDisabled ? '#94a3b8' : '#0369a1' }}
                                          >
                                            Shipped
                                          </MenuItem>
                                        </span>
                                      </Tooltip>
                                      <Tooltip title={doneDisabled ? lockHint : ''}>
                                        <span>
                                          <MenuItem
                                            value="completed"
                                            disabled={doneDisabled}
                                            sx={{ fontSize: '0.75rem', fontWeight: 600, color: doneDisabled ? '#94a3b8' : '#059669' }}
                                          >
                                            Completed
                                          </MenuItem>
                                        </span>
                                      </Tooltip>
                                    </>
                                  );
                                })()}
                                <MenuItem value="cancelled" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>Cancelled</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {new Date(order.order_created_at || order.created_at).toLocaleDateString()}
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
                          {order.pending_refund_request_id && (
                            <>
                              <Tooltip
                                title={
                                  order.pending_refund_request_reason
                                    ? `Buyer message: ${order.pending_refund_request_reason}\n\nApprove: cancel order and refund coins.`
                                    : 'Approve refund (cancel order, return coins to buyer)'
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={refundActionLoading || updatingStatus}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveRefund(order.pending_refund_request_id);
                                    }}
                                    sx={{ color: '#059669', p: 0.5 }}
                                  >
                                    <CheckCircle sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Decline refund request">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={refundActionLoading || updatingStatus}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openRejectRefund(order.pending_refund_request_id, order.field_name);
                                    }}
                                    sx={{ color: '#dc2626', p: 0.5 }}
                                  >
                                    <HighlightOff sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          )}
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
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: '2px solid #bfdbfe',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                  }}
                >
                  <Typography variant="overline" sx={{ fontWeight: 700, color: '#1d4ed8', letterSpacing: 0.08 }}>
                    What you are fulfilling
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    sx={{ mt: 1.5 }}
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                    flexWrap="wrap"
                  >
                    <Box sx={{ minWidth: 140 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Area purchased
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                        {selectedOrder.quantity != null && selectedOrder.quantity !== ''
                          ? `${Number(selectedOrder.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`
                          : selectedOrder.area_rented}
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <Box sx={{ minWidth: 120 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Order total
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>
                        ${Number(selectedOrder.total_cost).toFixed(2)}
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Shipping
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
                        <LocalShipping sx={{ fontSize: 22, color: '#1d4ed8' }} />
                        <Typography variant="body1" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                          {String(selectedOrder.mode_of_shipping || '—').replace(/_/g, ' ')}
                        </Typography>
                      </Stack>
                      {isDeliveryMode(selectedOrder) ? (
                        selectedOrder.delivery_address ? (
                          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mt: 1 }}>
                            <LocationOn sx={{ fontSize: 22, color: '#1d4ed8', mt: 0.25 }} />
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Deliver to
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                {selectedOrder.delivery_address}
                              </Typography>
                            </Box>
                          </Stack>
                        ) : selectedOrder.notes ? (
                          <Alert severity="info" icon={<LocationOn />} sx={{ mt: 1.5, borderRadius: 2 }}>
                            <AlertTitle sx={{ fontWeight: 700 }}>Delivery details</AlertTitle>
                            <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {String(selectedOrder.notes).trim()}
                            </Typography>
                          </Alert>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            No delivery address was saved on this order. Contact the buyer for the ship-to address.
                          </Typography>
                        )
                      ) : (
                        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mt: 1 }}>
                          <LocationOn sx={{ fontSize: 22, color: '#64748b', mt: 0.25 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Pickup location (field)
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                              {selectedOrder.location || '—'}
                            </Typography>
                          </Box>
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                  {(selectedOrder.selected_harvest_label || selectedOrder.delivery_date) && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #cbd5e1' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Harvest window
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                        {[
                          selectedOrder.selected_harvest_label,
                          selectedOrder.delivery_date
                            ? new Date(selectedOrder.delivery_date).toLocaleDateString()
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                      {formatShippingLeadAfterHarvest(getEstimatedDeliveryLeadDays(selectedOrder, 2)) && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 600 }}>
                          Est. delivery: {formatShippingLeadAfterHarvest(getEstimatedDeliveryLeadDays(selectedOrder, 2))}
                        </Typography>
                      )}
                    </Box>
                  )}
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
                    <Box
                      component="img"
                      src={orderProductIconSrc(selectedOrder)}
                      alt={selectedOrder.field_name}
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        objectFit: 'cover',
                        border: '1px solid #e2e8f0',
                      }}
                    />
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
                    <Box>
                      <HarvestProgressBar item={selectedOrder} />
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
                        Shipping
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                        <LocalShipping sx={{ fontSize: 18, color: '#64748b' }} />
                        <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                          {String(selectedOrder.mode_of_shipping || '—').replace(/_/g, ' ')}
                        </Typography>
                      </Stack>
                    </Box>
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
                        {new Date(selectedOrder.order_created_at || selectedOrder.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    {selectedOrder.delivery_date && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                          Harvest date (order)
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {new Date(selectedOrder.delivery_date).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                    {formatShippingLeadAfterHarvest(getEstimatedDeliveryLeadDays(selectedOrder, 2)) && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                          Est. delivery lead
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {formatShippingLeadAfterHarvest(getEstimatedDeliveryLeadDays(selectedOrder, 2))}
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

      <Dialog open={rejectRefundOpen} onClose={() => !refundActionLoading && setRejectRefundOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Decline refund request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The buyer keeps the current order status and their coins are not refunded. Optionally add a short note (shown to
            the buyer).
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {rejectRefundContext.fieldName}
          </Typography>
          <TextField
            label="Note to buyer (optional)"
            fullWidth
            multiline
            minRows={2}
            value={rejectFarmerNote}
            onChange={(e) => setRejectFarmerNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectRefundOpen(false)} disabled={refundActionLoading}>
            Back
          </Button>
          <Button color="error" variant="contained" onClick={submitRejectRefund} disabled={refundActionLoading}>
            {refundActionLoading ? 'Saving…' : 'Decline request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={harvestCompleteOpen}
        onClose={() => {
          if (!updatingStatus) {
            setHarvestCompleteOpen(false);
            setHarvestOrder(null);
            setHarvestFormError(null);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>How much did you harvest?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            For <strong>{harvestOrder?.field_name || 'this field'}</strong>, enter the <strong>actual total</strong> you
            harvested this season. This is stored as your harvest record for the field (more in a good year, less in a
            bad year).
          </Typography>
          {harvestFormError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setHarvestFormError(null)}>
              {harvestFormError}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Amount harvested"
              value={harvestAmount}
              onChange={(e) => setHarvestAmount(e.target.value)}
              type="text"
              inputMode="decimal"
              fullWidth
              required
              autoFocus
            />
            <TextField
              label="Unit"
              value={harvestUnit}
              onChange={(e) => setHarvestUnit(e.target.value)}
              select
              fullWidth
            >
              {['kg', 'lb', 'g', 't', 'units', 'L', 'bushels'].map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Note (optional)"
            value={harvestNote}
            onChange={(e) => setHarvestNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="E.g. variety, weather, or how the crop was shared between buyers"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              if (!updatingStatus) {
                setHarvestCompleteOpen(false);
                setHarvestOrder(null);
                setHarvestFormError(null);
              }
            }}
            disabled={updatingStatus}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={submitHarvestComplete} disabled={updatingStatus} sx={{ bgcolor: '#059669' }}>
            {updatingStatus ? 'Saving…' : 'Save & mark completed'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FarmOrders;
