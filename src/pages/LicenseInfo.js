import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Avatar,
  Button,
  IconButton,
  Stack,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions
} from '@mui/material';
import {
  MoreVert,
  VerifiedUser,
  CheckCircle,
  Cancel,
  Pending,
  Assignment,
  Security,
  Upload,
  Nature,
  Delete,
  CloudUpload,
  Description,
  Visibility,
  Close,
  PictureAsPdf,
  Image as ImageIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { userDocumentsService } from '../services/userDocuments';
import supabase from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';

const LicenseInfo = () => {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  // Determine approval status (fallback to false if not present, allowing edits by default unless explicitly approved)
  // Logic: If user is approved, they CANNOT delete/upload.
  const isApproved = user?.approval_status === 'approved';

  useEffect(() => {
    if (user?.id) {
      loadLicenses();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when user is set
  }, [user]);

  const loadLicenses = async () => {
    try {
      setLoading(true);
      const response = await userDocumentsService.getUserDocuments(user.id);
      // Ensure we get an array
      setLicenses(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load licenses", err);
      setError("Failed to load license information.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}-${file.name}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('user-documents')
          .getPublicUrl(filePath);

        await userDocumentsService.addDocument({
          user_id: user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: fileExt
        });
      }
      await loadLicenses();
    } catch (err) {
      console.error('Error uploading license:', err);
      setError('Failed to upload license document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await userDocumentsService.deleteDocument(id);
        setLicenses(prev => prev.filter(l => l.id !== id));
      } catch (err) {
        console.error('Error deleting license:', err);
        setError('Failed to delete license.');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isPDF = (fileType) => {
    return fileType?.toLowerCase() === 'pdf';
  };

  const isImage = (fileType) => {
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return imageTypes.includes(fileType?.toLowerCase());
  };

  const cleanFileName = (fileName) => {
    if (!fileName) return '';
    // Remove duplicate extensions like .jpeg.jpg
    return fileName.replace(/\.(jpg|jpeg|png|gif|pdf)(?=\.(jpg|jpeg|png|gif|pdf)$)/i, '');
  };

  const handleViewDocument = (license) => {
    setSelectedDocument(license);
    setViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setSelectedDocument(null);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      p: 3
    }}>
      {/* Header Section */}
      <Box sx={{
        maxWidth: '1400px',
        mx: 'auto',
        mb: 4
      }}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: '#1e293b',
              mb: 1,
              fontSize: { xs: '1.75rem', md: '2.125rem' }
            }}
          >
            License Info
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: '1rem' }}
          >
            Manage your farming licenses and documents
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Approval Status Alert */}
        {isApproved ? (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Your account is approved! You can view your licenses but changes are now restricted.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Your account is pending approval. Please ensure all necessary licenses are uploaded.
            </Typography>
          </Alert>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} lg={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white'
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    backgroundColor: '#dbeafe',
                    color: '#2563eb',
                    width: 40,
                    height: 40
                  }}
                >
                  <Assignment sx={{ fontSize: 20 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.5rem' }}>
                    {licenses.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Uploaded Documents
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} lg={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                backgroundColor: 'white'
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar
                  sx={{
                    backgroundColor: isApproved ? '#dcfce7' : '#fef3c7',
                    color: isApproved ? '#059669' : '#d97706',
                    width: 40,
                    height: 40
                  }}
                >
                  {isApproved ? <CheckCircle sx={{ fontSize: 20 }} /> : <Pending sx={{ fontSize: 20 }} />}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {isApproved ? 'Approved' : 'Pending'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    Account Status
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Licenses List Section */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3
          }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: '#1e293b',
                fontSize: '1.25rem'
              }}
            >
              Uploaded Licenses
            </Typography>

            {!isApproved && (
              <Button
                variant="contained"
                component="label"
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                disabled={uploading}
                sx={{
                  backgroundColor: '#059669',
                  '&:hover': {
                    backgroundColor: '#047857'
                  }
                }}
              >
                {uploading ? 'Uploading...' : 'Upload License'}
                <input type="file" hidden multiple onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png" />
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : licenses.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                border: '2px dashed #d1d5db',
                borderRadius: 2,
                textAlign: 'center',
                backgroundColor: '#f9fafb'
              }}
            >
              <Nature sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
                No licenses found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload your farming licenses to maintain compliance.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {licenses.map((license) => (
                <Grid item xs={12} md={6} lg={4} key={license.id}>
                  <Paper
                    elevation={0}
                    sx={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      backgroundColor: 'white',
                      transition: 'all 0.2s ease-in-out',
                      overflow: 'hidden',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                      }
                    }}
                  >
                    {/* Document Preview */}
                    <Box
                      sx={{
                        height: 180,
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                        '&:hover .view-overlay': {
                          opacity: 1
                        }
                      }}
                      onClick={() => handleViewDocument(license)}
                    >
                      {isImage(license.file_type) ? (
                        <Box
                          component="img"
                          src={license.file_url}
                          alt={license.file_name}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : isPDF(license.file_type) ? (
                        <PictureAsPdf sx={{ fontSize: 80, color: '#dc2626' }} />
                      ) : (
                        <Description sx={{ fontSize: 80, color: '#64748b' }} />
                      )}

                      {/* Hover Overlay */}
                      <Box
                        className="view-overlay"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        <Visibility sx={{ fontSize: 48, color: 'white' }} />
                      </Box>
                    </Box>

                    {/* Card Content */}
                    <Box sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 600,
                              color: '#1e293b',
                              mb: 0.5,
                              fontSize: '1rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={license.file_name}
                          >
                            {cleanFileName(license.file_name) || license.file_name}
                          </Typography>
                          <Chip
                            label={license.file_type?.toUpperCase() || 'DOC'}
                            size="small"
                            sx={{
                              backgroundColor: isPDF(license.file_type) ? '#fee2e2' : '#dbeafe',
                              color: isPDF(license.file_type) ? '#dc2626' : '#2563eb',
                              fontWeight: 600,
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>

                        {!isApproved && (
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(license.id)}
                            sx={{
                              color: '#ef4444',
                              '&:hover': {
                                backgroundColor: '#fee2e2'
                              }
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </Box>

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Uploaded: {formatDate(license.uploaded_at)}
                      </Typography>

                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={<Visibility />}
                        onClick={() => handleViewDocument(license)}
                        sx={{
                          borderColor: '#059669',
                          color: '#059669',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: '#047857',
                            backgroundColor: '#f0fdf4'
                          }
                        }}
                      >
                        View Document
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* Document Viewer Modal */}
        <Dialog
          open={viewerOpen}
          onClose={handleCloseViewer}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              height: '90vh',
              maxHeight: '90vh'
            }
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#059669',
              color: 'white',
              py: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {selectedDocument && isPDF(selectedDocument.file_type) ? (
                <PictureAsPdf />
              ) : (
                <ImageIcon />
              )}
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                {cleanFileName(selectedDocument?.file_name) || selectedDocument?.file_name || 'Document Viewer'}
              </Typography>
            </Box>
            <IconButton onClick={handleCloseViewer} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, backgroundColor: '#f8fafc' }}>
            {selectedDocument && (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2
                }}
              >
                {isImage(selectedDocument.file_type) ? (
                  <Box
                    component="img"
                    src={selectedDocument.file_url}
                    alt={selectedDocument.file_name}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: 1,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                ) : isPDF(selectedDocument.file_type) ? (
                  <Box
                    component="iframe"
                    src={selectedDocument.file_url}
                    sx={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: 1,
                      backgroundColor: 'white'
                    }}
                  />
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Description sx={{ fontSize: 64, color: '#9ca3af', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Preview not available
                    </Typography>
                    <Button
                      variant="contained"
                      href={selectedDocument.file_url}
                      target="_blank"
                      sx={{
                        mt: 2,
                        backgroundColor: '#059669',
                        '&:hover': {
                          backgroundColor: '#047857'
                        }
                      }}
                    >
                      Download Document
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, backgroundColor: '#f8fafc' }}>
            <Button
              variant="outlined"
              href={selectedDocument?.file_url}
              target="_blank"
              sx={{
                borderColor: '#059669',
                color: '#059669',
                '&:hover': {
                  borderColor: '#047857',
                  backgroundColor: '#f0fdf4'
                }
              }}
            >
              Open in New Tab
            </Button>
            <Button
              variant="contained"
              onClick={handleCloseViewer}
              sx={{
                backgroundColor: '#059669',
                '&:hover': {
                  backgroundColor: '#047857'
                }
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default LicenseInfo;