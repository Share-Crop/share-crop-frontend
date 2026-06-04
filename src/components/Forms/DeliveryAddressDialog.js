import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import DeliveryAddressFields from './DeliveryAddressFields';

/**
 * Delivery address entry — rendered in a portal above the map product popup (no nested scroll traps).
 */
const DeliveryAddressDialog = ({
  open,
  onClose,
  value,
  onChange,
  addressError = '',
  onFetchSuggestionsFilter,
  onSave,
  saving = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      sx={{ zIndex: 20000 }}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          m: isMobile ? 0 : 2,
          width: isMobile ? '100%' : undefined,
          maxHeight: isMobile ? '100dvh' : 'min(92dvh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          py: 1.5,
          px: 2,
          flexShrink: 0,
        }}
      >
        <Typography component="span" sx={{ fontWeight: 700, fontSize: isMobile ? '1.05rem' : '1.2rem' }}>
          Add delivery address
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} size="small" edge="end">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          flex: '1 1 auto',
          overflowY: 'auto',
          overflowX: 'hidden',
          px: 2,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          alignContent: 'flex-start',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <DeliveryAddressFields
          value={value}
          onChange={onChange}
          isMobile={isMobile}
          addressError={addressError}
          onFetchSuggestionsFilter={onFetchSuggestionsFilter}
          popperZIndex={21000}
        />
      </DialogContent>

      <DialogActions
        sx={{
          px: 2,
          py: 1.5,
          flexShrink: 0,
          gap: 1,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          pb: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : 1.5,
        }}
      >
        <Button onClick={onClose} color="inherit" disabled={saving} sx={{ minWidth: isMobile ? 100 : 88 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={saving}
          sx={{
            minWidth: isMobile ? 120 : 140,
            bgcolor: '#ff9800',
            fontWeight: 600,
            '&:hover': { bgcolor: '#f57c00' },
          }}
        >
          {saving ? 'Saving…' : 'Save address'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeliveryAddressDialog;
