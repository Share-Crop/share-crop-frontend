import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, CircularProgress } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import EnhancedFarmMap from '../components/Map/EnhancedFarmMap';
import fieldsService from '../services/fields';

const BrowseFields = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicFields();
  }, []);

  const loadPublicFields = async () => {
    setLoading(true);
    try {
      const response = await fieldsService.getPublicFields();
      setFields(response.data || []);
    } catch (error) {
      console.error('Error loading public fields:', error);
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E0E0E0',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/')}
            sx={{
              color: '#666',
              textTransform: 'none',
              '&:hover': { backgroundColor: '#f5f5f5' },
            }}
          >
            Back to Home
          </Button>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ShareCrop - Browse Fields
          </Typography>

          <Box sx={{ width: 100 }} />
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1 }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 2,
            }}
          >
            <CircularProgress sx={{ color: '#4CAF50' }} />
            <Typography color="text.secondary">Loading fields...</Typography>
          </Box>
        ) : (
          <EnhancedFarmMap
            userType={user?.user_type}
            user={user}
            fields={fields}
            onProductSelect={() => {}}
            onNotification={() => {}}
            onCoinRefresh={() => {}}
            minimal={!isAuthenticated}
          />
        )}
      </Box>

      {!isAuthenticated && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Box
            sx={{
              backgroundColor: 'white',
              px: 3,
              py: 2,
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Sign in to purchase or rent fields
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/login')}
              sx={{
                backgroundColor: '#4CAF50',
                textTransform: 'none',
                '&:hover': { backgroundColor: '#388E3C' },
              }}
            >
              Sign In
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default BrowseFields;
