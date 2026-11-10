import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
} from '@mui/material';
import { CheckCircle, Cancel, HourglassEmpty, Category, Label } from '@mui/icons-material';
import api from '../../services/api';

const isSubcategory = (row) => (row?.request_type || 'category') === 'subcategory';

const AdminCategoryRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await api.get(`/api/admin/category-requests${params}`);
      setRequests(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load category requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openAction = (row, actionType) => {
    setSelected(row);
    setAction(actionType);
    setAdminNotes('');
  };

  const confirmAction = async () => {
    if (!selected) return;
    setProcessing(true);
    setError(null);
    try {
      await api.patch(`/api/admin/category-requests/${selected.id}`, {
        action,
        admin_notes: adminNotes || null,
      });
      setSelected(null);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const statusChip = (status) => {
    if (status === 'approved') return <Chip size="small" color="success" icon={<CheckCircle />} label="Approved" />;
    if (status === 'rejected') return <Chip size="small" color="error" icon={<Cancel />} label="Rejected" />;
    return <Chip size="small" color="warning" icon={<HourglassEmpty />} label="Pending" />;
  };

  const typeChip = (row) =>
    isSubcategory(row) ? (
      <Chip size="small" icon={<Label />} label="Product type" color="info" variant="outlined" />
    ) : (
      <Chip size="small" icon={<Category />} label="New category" color="secondary" variant="outlined" />
    );

  const approveSummary = (row) => {
    if (!row) return '';
    if (isSubcategory(row)) {
      return `Add product type “${row.title}” under category “${row.parent_category}”?`;
    }
    return `Add new top-level category “${row.title}” (with product type “${row.title}”)?`;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Category color="primary" /> Category requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Farmers can request a new category or a product type under an existing one. Approved items show up in
            Create Field and Product pictures.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : requests.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No category requests{statusFilter !== 'all' ? ` with status “${statusFilter}”` : ''}.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Request</TableCell>
                <TableCell>Requested by</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{typeChip(row)}</TableCell>
                  <TableCell>
                    {isSubcategory(row) ? (
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {row.parent_category || '—'}
                        </Typography>
                        <Typography sx={{ fontWeight: 700 }}>→ {row.title}</Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontWeight: 700 }}>{row.title}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.requester_name || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.requester_email || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{statusChip(row.status)}</TableCell>
                  <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</TableCell>
                  <TableCell align="right">
                    {row.status === 'pending' ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="contained" color="success" onClick={() => openAction(row, 'approve')}>
                          Approve
                        </Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => openAction(row, 'reject')}>
                          Reject
                        </Button>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {row.reviewer_name ? `By ${row.reviewer_name}` : '—'}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(selected)} onClose={() => !processing && setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {action === 'approve'
            ? isSubcategory(selected)
              ? 'Approve product type'
              : 'Approve new category'
            : 'Reject request'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {selected ? typeChip(selected) : null}
            <Typography>{action === 'approve' ? approveSummary(selected) : `Reject “${selected?.title}”?`}</Typography>
            {action === 'approve' && isSubcategory(selected) ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Farmers will pick category <strong>{selected?.parent_category}</strong>, then product type{' '}
                <strong>{selected?.title}</strong>.
              </Alert>
            ) : null}
            {action === 'approve' && selected && !isSubcategory(selected) ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Creates a new category named <strong>{selected?.title}</strong> with the same product type name.
              </Alert>
            ) : null}
          </Stack>
          <TextField
            label="Admin notes (optional)"
            fullWidth
            multiline
            minRows={2}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
            onClick={confirmAction}
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCategoryRequests;
