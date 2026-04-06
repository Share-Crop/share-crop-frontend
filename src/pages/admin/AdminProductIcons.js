import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Stack,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Chip,
  Divider,
} from '@mui/material';
import {
  CloudUpload,
  DeleteOutline,
  Refresh,
  ExpandMore,
  Image as ImageIcon,
} from '@mui/icons-material';
import supabase from '../../services/supabase';
import {
  adminListProductCategoryIcons,
  adminUpsertProductCategoryIcon,
  adminRemoveProductCategoryIcon,
  fetchProductIconOverrides,
} from '../../services/productCategoryIcons';
import { getProductIcon, PRODUCT_IMAGE_PLACEHOLDER, setProductIconOverrides } from '../../utils/productIcons';
import { FIELD_CATEGORY_DATA, collectAllFieldSubcategories } from '../../utils/fieldCategoryData';
import {
  PRODUCT_ICON_PX,
  validateImageFileExactDimensions,
  validateImageUrlExactDimensions,
} from '../../utils/validateImageDimensions';

const BUCKET = process.env.REACT_APP_SUPABASE_PRODUCT_ICONS_BUCKET || 'product-images';

const AdminProductIcons = () => {
  const [overrideByKey, setOverrideByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingKey, setUploadingKey] = useState(null);
  const [urlBySub, setUrlBySub] = useState({});
  const [expandedUrlFor, setExpandedUrlFor] = useState(null);
  const [urlSavingFor, setUrlSavingFor] = useState(null);

  const parentOrder = useMemo(() => Object.keys(FIELD_CATEGORY_DATA), []);
  const knownSubs = useMemo(() => new Set(collectAllFieldSubcategories()), []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await adminListProductCategoryIcons();
      const list = Array.isArray(data?.rows) ? data.rows : [];
      const map = {};
      list.forEach((r) => {
        if (r.category_key && r.image_url) map[r.category_key] = r.image_url;
      });
      setOverrideByKey(map);
      if (data?.overrides) {
        setProductIconOverrides(data.overrides);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Failed to load';
      if (e?.response?.status === 500 || /relation|does not exist|product_category/i.test(String(msg))) {
        setError(
          'The database table for these images is missing. Your developer needs to run the backend migration once, then refresh this page.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshPublicOverrides = async () => {
    try {
      const overrides = await fetchProductIconOverrides();
      setProductIconOverrides(overrides);
    } catch {
      setProductIconOverrides({});
    }
  };

  const uploadFileForSubcategory = async (subcategoryKey, file) => {
    if (!file || !subcategoryKey) return;
    if (!supabase) {
      setError('Supabase is not set up in this app (missing URL / anon key). Image upload cannot run.');
      return;
    }
    setUploadingKey(subcategoryKey);
    setError('');
    try {
      await validateImageFileExactDimensions(file, PRODUCT_ICON_PX, PRODUCT_ICON_PX);
      const safe = subcategoryKey.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'crop';
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `categories/${safe}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) {
        setError(
          `${upErr.message} — Check that bucket "${BUCKET}" exists in Supabase, is public, and your account can upload files.`
        );
        return;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        setError('Could not get a public link for the file.');
        return;
      }
      await adminUpsertProductCategoryIcon(subcategoryKey.trim(), publicUrl);
      await load();
      await refreshPublicOverrides();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploadingKey(null);
    }
  };

  const saveUrlForSubcategory = async (subcategoryKey) => {
    const url = (urlBySub[subcategoryKey] || '').trim();
    if (!subcategoryKey || !url) return;
    setError('');
    setUrlSavingFor(subcategoryKey);
    try {
      await validateImageUrlExactDimensions(url, PRODUCT_ICON_PX, PRODUCT_ICON_PX);
      await adminUpsertProductCategoryIcon(subcategoryKey.trim(), url);
      setUrlBySub((prev) => ({ ...prev, [subcategoryKey]: '' }));
      setExpandedUrlFor(null);
      await load();
      await refreshPublicOverrides();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Save failed');
    } finally {
      setUrlSavingFor(null);
    }
  };

  const handleRemove = async (key) => {
    if (!window.confirm(`Remove the picture for “${key}”? The map will show the grey placeholder until you upload again.`)) return;
    setError('');
    try {
      await adminRemoveProductCategoryIcon(key);
      await load();
      await refreshPublicOverrides();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Remove failed');
    }
  };

  const orphanOverrides = useMemo(
    () => Object.keys(overrideByKey).filter((k) => !knownSubs.has(k)).sort((a, b) => a.localeCompare(b)),
    [overrideByKey, knownSubs]
  );

  const renderSubcategoryRow = (sub) => {
    const hasCustom = Boolean(overrideByKey[sub]);
    const busy = uploadingKey === sub;
    const previewSrc = getProductIcon(sub);
    const isPlaceholder = previewSrc === PRODUCT_IMAGE_PLACEHOLDER;

    return (
      <Box
        key={sub}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          gap: 2,
          py: 1.5,
          px: { xs: 0, sm: 1 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:last-of-type': { borderBottom: 'none' },
        }}
      >
        <Box sx={{ minWidth: { sm: 160 }, flexShrink: 0 }}>
          <Typography fontWeight={600} fontSize="0.95rem">
            {sub}
          </Typography>
          {hasCustom ? (
            <Chip size="small" label="Saved" color="success" variant="outlined" sx={{ mt: 0.5 }} />
          ) : (
            <Chip size="small" label="Not uploaded" variant="outlined" sx={{ mt: 0.5 }} />
          )}
        </Box>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: isPlaceholder ? 'warning.light' : 'divider',
              bgcolor: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <Box component="img" src={previewSrc} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            {hasCustom
              ? 'This is what the map and forms use for this product type.'
              : 'Nothing uploaded yet — the app shows a grey placeholder everywhere for this name.'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ flexShrink: 0 }}>
          <Button
            size="small"
            variant="contained"
            component="label"
            disabled={busy || !supabase}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}
          >
            {hasCustom ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) uploadFileForSubcategory(sub, f);
              }}
            />
          </Button>
          {hasCustom ? (
            <Button size="small" color="inherit" variant="outlined" startIcon={<DeleteOutline />} onClick={() => handleRemove(sub)}>
              Remove
            </Button>
          ) : null}
          <Button size="small" color="primary" variant="text" onClick={() => setExpandedUrlFor((v) => (v === sub ? null : sub))}>
            Paste URL
          </Button>
        </Stack>

        {expandedUrlFor === sub ? (
          <Box sx={{ width: '100%', pl: { sm: 0 }, pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <TextField
                size="small"
                fullWidth
                placeholder="https://…"
                value={urlBySub[sub] || ''}
                onChange={(e) => setUrlBySub((prev) => ({ ...prev, [sub]: e.target.value }))}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => saveUrlForSubcategory(sub)}
                disabled={!(urlBySub[sub] || '').trim() || urlSavingFor === sub}
                startIcon={urlSavingFor === sub ? <CircularProgress size={14} /> : null}
              >
                Save URL
              </Button>
            </Stack>
          </Box>
        ) : null}
      </Box>
    );
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: 2, pb: 6 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ImageIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Product pictures
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>One place for all product images.</strong> Open a group (for example <em>Fruits</em>), pick a product type, then <strong>Upload</strong> or <strong>Paste URL</strong>.
          Images must be <strong>exactly {PRODUCT_ICON_PX}×{PRODUCT_ICON_PX} pixels</strong> (square); anything else is rejected. Files go to Supabase bucket <strong>{BUCKET}</strong> and
          appear on the map and in forms.
        </Typography>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      {!supabase ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This screen cannot upload until the app has Supabase environment variables (same as document uploads).
        </Alert>
      ) : null}

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button startIcon={<Refresh />} onClick={load} disabled={loading} variant="outlined" size="small">
          Reload from server
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {parentOrder.map((parent) => {
            const subs = FIELD_CATEGORY_DATA[parent];
            if (!Array.isArray(subs) || subs.length === 0) return null;
            return (
              <Accordion key={parent} defaultExpanded={parent === 'Fruits' || parent === 'Vegetables'} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: 'grey.50', minHeight: 48 }}>
                  <Typography fontWeight={700}>
                    {parent}
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                      ({subs.length} types)
                    </Typography>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, px: { xs: 1, sm: 2 }, pb: 2 }}>
                  {subs.map((sub) => renderSubcategoryRow(sub))}
                </AccordionDetails>
              </Accordion>
            );
          })}

          {orphanOverrides.length > 0 ? (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Extra saved images
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These names are in the database but not in the create-field list.
              </Typography>
              <Paper variant="outlined" sx={{ p: 1 }}>
                {orphanOverrides.map((sub) => renderSubcategoryRow(sub))}
              </Paper>
            </>
          ) : null}
        </>
      )}
    </Box>
  );
};

export default AdminProductIcons;
