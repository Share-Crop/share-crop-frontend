import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Agriculture,
  CloudUpload,
  Description,
  Delete,
  PhotoCamera,
  CheckCircle,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Buyer → Farmer conversion: collect farmer-only fields (license + optional photo),
 * then switch role via POST /api/auth/become-farmer.
 */
export default function BecomeFarmer() {
  const navigate = useNavigate();
  const { user, becomeFarmer } = useAuth();
  const [license, setLicense] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [profilePreview, setProfilePreview] = useState(user?.profile_image_url || null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (user && String(user.user_type).toLowerCase() === 'farmer') {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
        <Alert severity="info">You are already a farmer.</Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/farmer', { replace: true })}>
          Go to farmer dashboard
        </Button>
      </Box>
    );
  }

  const handleLicenseChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setLicense((prev) => [...prev, ...files]);
  };

  const handleProfileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeDoc = (index) => {
    setLicense((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (license.length === 0) {
      setError('Upload at least one farming license document to continue.');
      return;
    }

    setLoading(true);
    try {
      let profile_image_url = user?.profile_image_url || null;
      const uploadedDocuments = [];

      if (profileImage) {
        const fileExt = profileImage.name.split('.').pop();
        const filePath = `profile-images/${uuidv4()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('user-documents')
          .upload(filePath, profileImage);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from('user-documents').getPublicUrl(filePath);
        profile_image_url = publicUrl;
      }

      for (const file of license) {
        const fileName = `${uuidv4()}-${file.name}`;
        const filePath = `documents/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('user-documents')
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from('user-documents').getPublicUrl(filePath);
        uploadedDocuments.push({
          file_name: file.name,
          file_url: publicUrl,
          file_type: 'license',
        });
      }

      await becomeFarmer({
        documents: uploadedDocuments,
        profile_image_url,
      });

      setSuccess('You are now a farmer. Your license is pending admin approval.');
      setTimeout(() => navigate('/farmer', { replace: true }), 900);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          'Could not convert to farmer. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Agriculture sx={{ color: '#059669', fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700} color="#0f172a">
            Become a Farmer
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your buyer account details (name, email, currency) stay the same. Add the
          farmer license info below to list farms and fields.
        </Typography>

        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            Already on your account
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            <strong>{user?.name}</strong> · {user?.email}
          </Typography>
        </Box>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
            {success}
          </Alert>
        ) : null}

        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#065f46' }}>
            Profile photo (optional)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar src={profilePreview || undefined} sx={{ width: 64, height: 64 }}>
              {!profilePreview && <PhotoCamera />}
            </Avatar>
            <Button variant="outlined" component="label" startIcon={<CloudUpload />} sx={{ textTransform: 'none' }}>
              {user?.profile_image_url ? 'Replace photo' : 'Upload photo'}
              <input type="file" hidden accept="image/*" onChange={handleProfileChange} />
            </Button>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: '#065f46' }}>
            Farming license (required)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload your farming license for admin approval — same as farmer signup.
          </Typography>

          <Button
            variant="outlined"
            fullWidth
            component="label"
            startIcon={<CloudUpload />}
            sx={{ borderStyle: 'dashed', borderRadius: 2, py: 1.5, textTransform: 'none', mb: 1 }}
          >
            Upload license
            <input type="file" hidden multiple onChange={handleLicenseChange} />
          </Button>

          {license.length > 0 && (
            <List dense sx={{ mb: 2 }}>
              {license.map((file, index) => (
                <Paper key={`${file.name}-${index}`} variant="outlined" sx={{ mb: 1, borderRadius: 2 }}>
                  <ListItem
                    secondaryAction={
                      <IconButton edge="end" size="small" onClick={() => removeDoc(index)} color="error">
                        <Delete fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Description color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
                    />
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Agriculture />}
            sx={{
              mt: 1,
              py: 1.25,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#059669',
              '&:hover': { bgcolor: '#047857' },
            }}
          >
            {loading ? 'Converting…' : 'Become a Farmer'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
