import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Message, ArrowBack } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getProductIcon } from '../utils/productIcons';

const FarmerPublicProfile = ({ userType = 'buyer' }) => {
  const { farmerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!farmerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/farmers/${farmerId}/public-profile`);
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load profile');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    load();
  }, [load]);

  const messagesPath = userType === 'farmer' ? '/farmer/messages' : '/buyer/messages';
  const backPath = userType === 'farmer' ? '/farmer' : '/buyer';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data?.farmer) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Typography color="error">{error || 'Profile not found'}</Typography>
      </Box>
    );
  }

  const { farmer, fields } = data;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Avatar src={farmer.profile_image_url || undefined} sx={{ width: 72, height: 72 }}>
            {(farmer.name || 'F').charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {farmer.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Farmer on Share-Crop
              {farmer.member_since
                ? ` · Member since ${new Date(farmer.member_since).getFullYear()}`
                : ''}
            </Typography>
            {user && user.id && String(user.id) !== String(farmer.id) && (
              <Button
                variant="contained"
                color="success"
                startIcon={<Message />}
                sx={{ mt: 2 }}
                onClick={() =>
                  navigate(messagesPath, {
                    state: { openWithUserId: farmer.id, openWithUserName: farmer.name },
                  })
                }
              >
                Chat
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Fields & products
      </Typography>
      {!fields?.length ? (
        <Typography color="text.secondary">No active listings right now.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {fields.map((f) => (
            <Card key={f.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box
                  component="img"
                  src={f.image || getProductIcon(f.subcategory || f.category)}
                  alt=""
                  sx={{ width: 56, height: 56, borderRadius: 1, objectFit: 'cover' }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{f.name}</Typography>
                  {f.location && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {f.location}
                    </Typography>
                  )}
                  <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {f.subcategory && <Chip size="small" label={f.subcategory} />}
                    {Number.isFinite(parseFloat(f.rating)) && parseFloat(f.rating) > 0 && (
                      <Chip size="small" variant="outlined" label={`★ ${f.rating}`} />
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FarmerPublicProfile;
