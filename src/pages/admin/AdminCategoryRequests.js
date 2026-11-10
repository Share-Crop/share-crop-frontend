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
import { CheckCircle, Cancel, HourglassEmpty, Category } from '@mui/icons-material';
import api from '../../services/api';

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

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Category color="primary" /> Category requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Approve titles submitted from the create-field form. Approved categories appear in the farmer list immediately.
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
          <Typography color="text.secondary">No category requests{statusFilter !== 'all' ? ` with status “${statusFilter}”` : ''}.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Requested by</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{row.title}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.requester_name || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.requester_email || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>{statusChip(row.status)}</TableCell>
                  <TableCell>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                  </TableCell>
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
          {action === 'approve' ? 'Approve category' : 'Reject category request'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {action === 'approve'
              ? `Add “${selected?.title}” to the create-field category list?`
              : `Reject “${selected?.title}”?`}
          </Typography>
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
