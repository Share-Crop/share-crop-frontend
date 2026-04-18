import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  Typography,
  Paper,
} from '@mui/material';
import { AddLocation, Crop } from '@mui/icons-material';

const FieldForm = ({ open, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    area_m2: '',
    usual_production_per_harvest: '',
    shipping_method: 'both',
    geometry: null,
  });

  const [drawingMode, setDrawingMode] = useState(false);

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = () => {
    if (!formData.geometry) {
      alert('Please draw a field on the map first');
      return;
    }

    onSubmit(formData);
    onClose();
    setFormData({
      name: '',
      description: '',
      area_m2: '',
      usual_production_per_harvest: '',
      shipping_method: 'both',
      geometry: null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <AddLocation sx={{ mr: 1, verticalAlign: 'bottom' }} />
        Add New Field
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          First click "Draw Field" to define your field area on the map, then fill in the details below.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Button
                variant={drawingMode ? "contained" : "outlined"}
                color={drawingMode ? "secondary" : "primary"}
                startIcon={<Crop />}
                onClick={() => setDrawingMode(!drawingMode)}
              >
                {drawingMode ? 'Stop Drawing' : 'Draw Field on Map'}
              </Button>
              {formData.geometry && (
                <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                  ✓ Field area defined
                </Typography>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Field Name"
              value={formData.name}
              onChange={handleInputChange('name')}
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Area (m²)"
              type="number"
              value={formData.area_m2}
              onChange={handleInputChange('area_m2')}
              required
              inputProps={{ min: 0, step: 'any' }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={handleInputChange('description')}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Usual Production"
              type="number"
              inputProps={{ min: 0, step: 'any' }}
              value={formData.usual_production_per_harvest}
              onChange={handleInputChange('usual_production_per_harvest')}
              helperText="Per harvest season"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Shipping Method"
              value={formData.shipping_method}
              onChange={handleInputChange('shipping_method')}
            >
              <MenuItem value="shipping">Shipping Only</MenuItem>
              <MenuItem value="pickup">Pickup Only</MenuItem>
              <MenuItem value="both">Both</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!formData.geometry || !formData.name || !formData.area_m2}
        >
          Create Field
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FieldForm;