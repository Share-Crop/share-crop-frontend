import React from 'react';
import { Paper, Stack, Avatar, Box, Typography } from '@mui/material';

const StatCard = ({ icon, iconBg, iconColor, value, label }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: 130,
        minHeight: 130,
        maxHeight: 130,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
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
        <Avatar
          sx={{
            backgroundColor: iconBg,
            color: iconColor,
            width: 40,
            height: 40,
          }}
        >
          {icon}
        </Avatar>
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#1e293b',
              fontSize: 'clamp(1.1rem, 3vw, 1.5rem)',
            }}
          >
            {value}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: 'clamp(0.7rem, 2.2vw, 0.8rem)',
            }}
          >
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};

export default StatCard;

