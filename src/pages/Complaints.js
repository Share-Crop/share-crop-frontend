import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
  TextField,
} from '@mui/material';
import { ReportProblem, Add, Visibility, Refresh, Close, AttachFile, Send, VerifiedUser } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { complaintService } from '../services/complaints';
import ComplaintForm from '../components/Forms/ComplaintForm';
import supabase from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';

const Complaints = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [complaintFormOpen, setComplaintFormOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [replyDraft, setReplyDraft] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [extraProofFiles, setExtraProofFiles] = useState([]);
  const [addProofsLoading, setAddProofsLoading] = useState(false);

  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await complaintService.getComplaints({ ...params, user_id: user.id });
      setComplaints(response.data || []);
    } catch (err) {
      console.error('Error loading complaints:', err);
      setError('Failed to load complaints. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadComplaints();
    }
  }, [user?.id, statusFilter, loadComplaints]);

  const handleComplaintSuccess = () => {
    loadComplaints();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'error';
      case 'in_review':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleViewComplaint = async (complaint) => {
    setReplyDraft('');
    setExtraProofFiles([]);
    try {
      const res = await complaintService.getComplaint(complaint.id);
      setSelectedComplaint(res.data || complaint);
    } catch (_) {
      setSelectedComplaint(complaint);
    }
    setViewDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedComplaint?.id || !replyDraft.trim()) return;
    setReplyLoading(true);
    try {
      await complaintService.addRemark(selectedComplaint.id, replyDraft.trim());
      const res = await complaintService.getComplaint(selectedComplaint.id);
      setSelectedComplaint(res.data);
      setReplyDraft('');
    } catch (e) {
      console.error(e);
    } finally {
      setReplyLoading(false);
    }
  };

  const handleAddMoreDocs = async () => {
    if (!selectedComplaint?.id || extraProofFiles.length === 0 || !supabase) return;
    const current = (selectedComplaint.proofs || []).length;
    if (current >= 5) return;
    const toAdd = extraProofFiles.slice(0, 5 - current);
    setAddProofsLoading(true);
    try {
      const bucket = 'user-documents';
      const folder = `complaint-proofs/${selectedComplaint.id}`;
      const proofsToAdd = [];
      for (const file of toAdd) {
        const ext = file.name.split('.').pop() || 'bin';
        const fileName = `${uuidv4()}-${file.name}`;
        const filePath = `${folder}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
        if (uploadError) continue;
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        proofsToAdd.push({ file_name: file.name, file_url: publicUrl, file_type: ext });
      }
      if (proofsToAdd.length > 0) {
        await complaintService.addProofs(selectedComplaint.id, proofsToAdd);
        const res = await complaintService.getComplaint(selectedComplaint.id);
        setSelectedComplaint(res.data);
        setExtraProofFiles([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAddProofsLoading(false);
    }
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Please log in to view your complaints.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      p: isMobile ? 2 : 3,
      maxWidth: '1200px',
      mx: 'auto',
      minHeight: '100vh',
      bgcolor: '#F0F2F5'
    }}>
      {/* Header Section */}
      <Box sx={{
        mb: 3,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            bgcolor: 'rgba(76, 175, 80, 0.1)',
            borderRadius: 2,
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ReportProblem sx={{ fontSize: isMobile ? 32 : 40, color: '#4CAF50' }} />
          </Box>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            My Complaints
          </Typography>
        </Box>
        <Stack
          direction={isMobile ? 'column' : 'row'}
          spacing={isMobile ? 1.5 : 2}
          sx={{ width: isMobile ? '100%' : 'auto' }}
        >
          <FormControl
            size="small"
            sx={{
              minWidth: isMobile ? '100%' : 150,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          >
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_review">In Review</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadComplaints}
            disabled={loading}
            sx={{
              borderRadius: 2,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setComplaintFormOpen(true)}
            sx={{
              borderRadius: 2,
              width: isMobile ? '100%' : 'auto',
              background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
                boxShadow: '0 6px 16px rgba(76, 175, 80, 0.4)',
              },
            }}
          >
            New Complaint
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <CardContent sx={{ p: isMobile ? 2 : 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress sx={{ color: '#4CAF50' }} />
            </Box>
          ) : complaints.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Box sx={{
                bgcolor: 'rgba(76, 175, 80, 0.1)',
                borderRadius: '50%',
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}>
                <ReportProblem sx={{ fontSize: 48, color: '#4CAF50' }} />
              </Box>
              <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
                No complaints found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {statusFilter !== 'all'
                  ? `No ${statusFilter} complaints.`
                  : "You haven't submitted any complaints yet."}
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setComplaintFormOpen(true)}
                sx={{
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
                    boxShadow: '0 6px 16px rgba(76, 175, 80, 0.4)',
                  },
                }}
              >
                Submit Your First Complaint
              </Button>
            </Box>
          ) : isMobile ? (
            // Mobile Card View
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {complaints.map((complaint) => (
                <Card
                  key={complaint.id}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {complaint.category || 'No Category'}
                        </Typography>
                        <Chip
                          label={complaint.target_type}
                          size="small"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      </Box>
                      <Chip
                        label={complaint.status}
                        color={getStatusColor(complaint.status)}
                        size="small"
                        sx={{
                          ...(complaint.status?.toLowerCase() === 'resolved' && {
                            color: '#ffffff'
                          })
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {complaint.description || 'No description'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(complaint.created_at)}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => handleViewComplaint(complaint)}
                        sx={{ color: '#4CAF50' }}
                      >
                        View
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            // Desktop Table View
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(76, 175, 80, 0.05)' }}>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Target Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complaints.map((complaint) => (
                    <TableRow
                      key={complaint.id}
                      hover
                      sx={{
                        '&:hover': {
                          bgcolor: 'rgba(76, 175, 80, 0.02)',
                        }
                      }}
                    >
                      <TableCell>
                        {complaint.category || (
                          <Typography variant="body2" color="text.secondary">
                            N/A
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={complaint.target_type}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: '#4CAF50',
                            color: '#2E7D32',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {complaint.description || 'No description'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={complaint.status}
                          color={getStatusColor(complaint.status)}
                          size="small"
                          sx={{
                            ...(complaint.status?.toLowerCase() === 'resolved' && {
                              color: '#ffffff'
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell>{formatDate(complaint.created_at)}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleViewComplaint(complaint)}
                          sx={{
                            color: '#4CAF50',
                            '&:hover': {
                              bgcolor: 'rgba(76, 175, 80, 0.1)',
                            }
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Complaint Form Dialog */}
      <ComplaintForm
        open={complaintFormOpen}
        onClose={() => setComplaintFormOpen(false)}
        userId={user.id}
        onSuccess={handleComplaintSuccess}
      />

      {/* View Complaint Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ReportProblem />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>Complaint Details</Typography>
          </Box>
          <IconButton
            onClick={() => setViewDialogOpen(false)}
            sx={{ color: 'white' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedComplaint && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={selectedComplaint.status}
                    color={getStatusColor(selectedComplaint.status)}
                    size="small"
                    sx={{
                      ...(selectedComplaint.status?.toLowerCase() === 'resolved' && {
                        color: '#ffffff'
                      })
                    }}
                  />
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Category
                </Typography>
                <Typography variant="body1">
                  {selectedComplaint.category || 'Not specified'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Target Type
                </Typography>
                <Typography variant="body1">{selectedComplaint.target_type}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Paper sx={{ p: 2, mt: 0.5, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedComplaint.description || 'No description provided'}
                  </Typography>
                </Paper>
              </Box>

              {selectedComplaint.proofs && selectedComplaint.proofs.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Attached proof ({selectedComplaint.proofs.length} / 5)
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>
                    {selectedComplaint.proofs.map((p) => {
                      const isImage = /\.(jpe?g|png|gif|webp)$/i.test(p.file_name || '') || (p.file_type && /^(jpe?g|png|gif|webp)$/i.test(p.file_type));
                      return (
                        <Box key={p.id || p.file_url}>
                          {isImage ? (
                            <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                              <Box component="img" src={p.file_url} alt={p.file_name} sx={{ maxWidth: 120, maxHeight: 120, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
                            </a>
                          ) : (
                            <Button size="small" href={p.file_url} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none' }}>
                              {p.file_name || 'Document'}
                            </Button>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {(() => {
                const hasConversation = (selectedComplaint.remarks && selectedComplaint.remarks.length > 0) || selectedComplaint.admin_remarks;
                const adminHasRemarked = !!(
                  selectedComplaint.admin_remarks ||
                  (selectedComplaint.remarks && selectedComplaint.remarks.some((r) => r.author_type === 'admin'))
                );
                const isResolved = String(selectedComplaint.status || '').toLowerCase() === 'resolved';
                const canReply = adminHasRemarked && !isResolved;

                if (hasConversation) {
                  return (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Conversation
                      </Typography>
                      <Stack spacing={1} sx={{ mt: 0.5 }}>
                        {selectedComplaint.admin_remarks && (!selectedComplaint.remarks || selectedComplaint.remarks.length === 0) && (
                          <Alert severity="info" sx={{ borderRadius: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                              <VerifiedUser sx={{ fontSize: 16, color: '#0d9488' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Share-Crop</Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedComplaint.admin_remarks}</Typography>
                          </Alert>
                        )}
                        {(selectedComplaint.remarks || []).map((r) => (
                          <Paper key={r.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: r.author_type === 'admin' ? 'rgba(76, 175, 80, 0.06)' : 'grey.50' }}>
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                              {r.author_type === 'admin' && <VerifiedUser sx={{ fontSize: 16, color: '#0d9488' }} />}
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {r.author_type === 'admin' ? 'Share-Crop' : (r.author_name || 'User')}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{r.message}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {formatDate(r.created_at)}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                      {isResolved && (
                        <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
                          This complaint is resolved. Replies are closed.
                        </Alert>
                      )}
                      {canReply && (
                        <Box sx={{ mt: 1.5 }}>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Reply or add details..."
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            disabled={replyLoading}
                            multiline
                            minRows={2}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={replyLoading ? <CircularProgress size={16} color="inherit" /> : <Send />}
                            onClick={handleSendReply}
                            disabled={replyLoading || !replyDraft.trim()}
                            sx={{ mt: 1, borderRadius: 2, background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)' }}
                          >
                            {replyLoading ? 'Sending...' : 'Send reply'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  );
                }
                return (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Admin has not responded yet. You can reply once they add a message.
                  </Alert>
                );
              })()}

              {selectedComplaint.proofs && selectedComplaint.proofs.length < 5 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Add more documents (max 5 total)</Typography>
                  <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>
                    <Button variant="outlined" size="small" component="label" startIcon={<AttachFile />} disabled={addProofsLoading} sx={{ borderRadius: 2 }}>
                      Choose files
                      <input type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.txt" onChange={(e) => setExtraProofFiles(e.target.files ? Array.from(e.target.files) : [])} />
                    </Button>
                    {extraProofFiles.length > 0 && (
                      <>
                        <Typography variant="caption" color="text.secondary">{extraProofFiles.length} file(s) selected</Typography>
                        <Button size="small" variant="contained" disabled={addProofsLoading || selectedComplaint.proofs.length + extraProofFiles.length > 5} onClick={handleAddMoreDocs} sx={{ borderRadius: 2 }}>
                          {addProofsLoading ? 'Uploading...' : 'Upload'}
                        </Button>
                      </>
                    )}
                  </Stack>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body2">{formatDate(selectedComplaint.created_at)}</Typography>
              </Box>

              {selectedComplaint.updated_at !== selectedComplaint.created_at && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">{formatDate(selectedComplaint.updated_at)}</Typography>
                </Box>
              )}

              {selectedComplaint.refund_coins != null && selectedComplaint.refund_coins > 0 && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Refund: {selectedComplaint.refund_coins} coins credited to your account
                  {selectedComplaint.refunded_at && ` on ${formatDate(selectedComplaint.refunded_at)}`}.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Complaints;

