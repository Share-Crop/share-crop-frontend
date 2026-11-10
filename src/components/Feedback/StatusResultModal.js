import React from 'react';
import { Dialog, Box, Typography, Button } from '@mui/material';
import { Check, Close } from '@mui/icons-material';

/**
 * Compact success / failure confirmation — matches the centered icon + title + Ok pattern.
 *
 * @param {'success' | 'error'} variant
 */
export default function StatusResultModal({
  open,
  onClose,
  variant = 'success',
  title,
  message,
  okLabel = 'Ok',
}) {
  const isSuccess = variant === 'success';
  const accent = isSuccess ? '#22c55e' : '#ef4444';
  const accentDark = isSuccess ? '#16a34a' : '#dc2626';

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '28px',
          px: 3,
          py: 4,
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
          maxWidth: 360,
          mx: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          border: `3px solid ${accent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isSuccess ? (
          <Check sx={{ fontSize: 40, color: accent, strokeWidth: 2 }} />
        ) : (
          <Close sx={{ fontSize: 40, color: accent }} />
        )}
      </Box>

      <Typography
        sx={{
          fontWeight: 800,
          fontSize: '1.35rem',
          color: accent,
          mb: 1,
          lineHeight: 1.25,
        }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          color: '#475569',
          fontSize: '0.95rem',
          lineHeight: 1.45,
          mb: 3,
          px: 0.5,
        }}
      >
        {message}
      </Typography>

      <Button
        variant="contained"
        onClick={onClose}
        sx={{
          minWidth: 88,
          px: 3,
          py: 1,
          borderRadius: '12px',
          textTransform: 'none',
          fontWeight: 700,
          fontSize: '1rem',
          bgcolor: accent,
          boxShadow: 'none',
          '&:hover': { bgcolor: accentDark, boxShadow: 'none' },
        }}
      >
        {okLabel}
      </Button>
    </Dialog>
  );
}
