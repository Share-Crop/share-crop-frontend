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
  InputAdornment,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  CloudUpload,
  DeleteOutline,
  Refresh,
  ExpandMore,
  Image as ImageIcon,
  Search,
  Clear,
} from '@mui/icons-material';
import supabase from '../../services/supabase';
import {
  adminListProductCategoryIcons,
  adminUpsertProductCategoryIcon,
  adminRemoveProductCategoryIcon,
  adminBackfillTwemojiProductIcons,
  adminSaveTwemojiProductIcon,
  fetchProductIconOverrides,
} from '../../services/productCategoryIcons';
import { getProductIcon, PRODUCT_IMAGE_PLACEHOLDER, setProductIconOverrides } from '../../utils/productIcons';
import {
  FIELD_CATEGORY_DATA,
  collectAllFieldSubcategories,
  fetchFieldCategoryData,
} from '../../utils/fieldCategoryData';
import { expandSubcategoriesForIcons } from '../../utils/productSubcategoryVariants';
import { resolveEmojiForTitle } from '../../utils/subcategoryEmojis';
import {
  PRODUCT_ICON_PX,
  validateImageFileExactDimensions,
  validateImageUrlExactDimensions,
} from '../../utils/validateImageDimensions';

const BUCKET = process.env.REACT_APP_SUPABASE_PRODUCT_ICONS_BUCKET || 'product-images';

const STATUS_ALL = 'all';
const STATUS_MISSING = 'missing';
const STATUS_SAVED = 'saved';

const AdminProductIcons = () => {
  const [overrideByKey, setOverrideByKey] = useState({});
  const [categoryData, setCategoryData] = useState(FIELD_CATEGORY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingKey, setUploadingKey] = useState(null);
  const [urlBySub, setUrlBySub] = useState({});
  const [expandedUrlFor, setExpandedUrlFor] = useState(null);
  const [urlSavingFor, setUrlSavingFor] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [expandedParents, setExpandedParents] = useState(() => new Set(['Fruits', 'Vegetables']));
  const [backfilling, setBackfilling] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  const parentOrder = useMemo(() => Object.keys(categoryData || {}), [categoryData]);
  const knownSubs = useMemo(
    () => new Set(collectAllFieldSubcategories(categoryData)),
    [categoryData]
  );
  const staticParentKeys = useMemo(() => new Set(Object.keys(FIELD_CATEGORY_DATA)), []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [categories, data] = await Promise.all([
        fetchFieldCategoryData(),
        adminListProductCategoryIcons(),
      ]);
      setCategoryData(categories || FIELD_CATEGORY_DATA);

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

  const matchesFilters = useCallback(
    (sub) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !String(sub).toLowerCase().includes(q)) return false;
      const hasCustom = Boolean(overrideByKey[sub]);
      if (statusFilter === STATUS_MISSING && hasCustom) return false;
      if (statusFilter === STATUS_SAVED && !hasCustom) return false;
      return true;
    },
    [searchQuery, statusFilter, overrideByKey]
  );

  const filteredGroups = useMemo(() => {
    const groups = [];
    for (const parent of parentOrder) {
      if (categoryFilter !== 'all' && parent !== categoryFilter) continue;
      const rawSubs = categoryData[parent];
      if (!Array.isArray(rawSubs) || !rawSubs.length) continue;
      const subs = expandSubcategoriesForIcons(rawSubs);
      const filtered = subs.filter(matchesFilters);
      if (!filtered.length) continue;
      groups.push({
        parent,
        subs: filtered,
        total: subs.length,
        isCustom: !staticParentKeys.has(parent),
      });
    }
    return groups;
  }, [parentOrder, categoryFilter, matchesFilters, categoryData, staticParentKeys]);

  // Auto-expand matching groups when filters are active
  useEffect(() => {
    const filtering =
      Boolean(searchQuery.trim()) || categoryFilter !== 'all' || statusFilter !== STATUS_ALL;
    if (!filtering) return;
    setExpandedParents(new Set(filteredGroups.map((g) => g.parent)));
  }, [searchQuery, categoryFilter, statusFilter, filteredGroups]);

  const orphanOverrides = useMemo(() => {
    const list = Object.keys(overrideByKey)
      .filter((k) => !knownSubs.has(k))
      .sort((a, b) => a.localeCompare(b));
    return list.filter(matchesFilters);
  }, [overrideByKey, knownSubs, matchesFilters]);

  const stats = useMemo(() => {
    const all = collectAllFieldSubcategories(categoryData);
    const saved = all.filter((s) => overrideByKey[s]).length;
    return {
      total: all.length,
      saved,
      missing: all.length - saved,
      categories: parentOrder.length,
    };
  }, [overrideByKey, parentOrder, categoryData]);

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

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter(STATUS_ALL);
    setExpandedParents(new Set(['Fruits', 'Vegetables']));
  };

  const runTwemojiBackfill = async () => {
    setBackfilling(true);
    setError('');
    setInfoMsg('');
    try {
      const result = await adminBackfillTwemojiProductIcons();
      setInfoMsg(
        `Saved ${result.inserted || 0} Twemoji icons to DB` +
          (result.skipped ? ` (${result.skipped} already had icons)` : '') +
          (result.noEmoji ? `; ${result.noEmoji} had no emoji match` : '') +
          '.'
      );
      await load();
      await refreshPublicOverrides();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Twemoji backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  const saveEmojiForSub = async (sub) => {
    setUploadingKey(sub);
    setError('');
    try {
      const suggestion = resolveEmojiForTitle(sub);
      await adminSaveTwemojiProductIcon(sub, suggestion?.emoji || null, false);
      await load();
      await refreshPublicOverrides();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Could not save emoji icon');
    } finally {
      setUploadingKey(null);
    }
  };

  const toggleParent = (parent) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parent)) next.delete(parent);
      else next.add(parent);
      return next;
    });
  };

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
          px: { xs: 0.5, sm: 1 },
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
              ? 'Used on the map and in create-field forms.'
              : 'Grey placeholder until you upload.'}
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
          {!hasCustom && resolveEmojiForTitle(sub)?.emoji ? (
            <Button
              size="small"
              color="success"
              variant="outlined"
              disabled={busy}
              onClick={() => saveEmojiForSub(sub)}
            >
              Use emoji {resolveEmojiForTitle(sub).emoji}
            </Button>
          ) : null}
          <Button size="small" color="primary" variant="text" onClick={() => setExpandedUrlFor((v) => (v === sub ? null : sub))}>
            Paste URL
          </Button>
        </Stack>

        {expandedUrlFor === sub ? (
          <Box sx={{ width: '100%', pt: 1 }}>
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

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || categoryFilter !== 'all' || statusFilter !== STATUS_ALL;
  const visibleCount = filteredGroups.reduce((n, g) => n + g.subs.length, 0) + orphanOverrides.length;

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', py: 2, pb: 6 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'flex-start' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <ImageIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>
              Product pictures
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Upload custom {PRODUCT_ICON_PX}×{PRODUCT_ICON_PX} images, or fill missing types with Twemoji icons
            (saved permanently in DB). Bucket: {BUCKET}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            startIcon={backfilling ? <CircularProgress size={16} color="inherit" /> : <ImageIcon />}
            onClick={runTwemojiBackfill}
            disabled={loading || backfilling}
            variant="contained"
            size="small"
            color="success"
          >
            Fill missing with emoji
          </Button>
          <Button startIcon={<Refresh />} onClick={load} disabled={loading} variant="outlined" size="small">
            Reload
          </Button>
        </Stack>
      </Stack>

      {infoMsg ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfoMsg('')}>
          {infoMsg}
        </Alert>
      ) : null}

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <Chip label={`${stats.total} types`} size="small" variant="outlined" />
        <Chip label={`${stats.saved} uploaded`} size="small" color="success" variant="outlined" />
        <Chip label={`${stats.missing} missing`} size="small" color={stats.missing ? 'warning' : 'default'} variant="outlined" />
        <Chip label={`${stats.categories} categories`} size="small" variant="outlined" />
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: '#fff',
        }}
      >
        <Stack spacing={1.75}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search product type… e.g. Tomato"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearchQuery('')}>
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
              Category
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              <Chip
                label="All"
                size="small"
                clickable
                color={categoryFilter === 'all' ? 'primary' : 'default'}
                variant={categoryFilter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setCategoryFilter('all')}
              />
              {parentOrder.map((parent) => (
                <Chip
                  key={parent}
                  label={parent}
                  size="small"
                  clickable
                  color={categoryFilter === parent ? 'primary' : 'default'}
                  variant={categoryFilter === parent ? 'filled' : 'outlined'}
                  onClick={() => setCategoryFilter(parent)}
                />
              ))}
            </Box>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
                Upload status
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={statusFilter}
                onChange={(_e, v) => {
                  if (v != null) setStatusFilter(v);
                }}
                sx={{
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.8rem',
                  },
                }}
              >
                <ToggleButton value={STATUS_ALL}>All</ToggleButton>
                <ToggleButton value={STATUS_MISSING}>Missing</ToggleButton>
                <ToggleButton value={STATUS_SAVED}>Uploaded</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {hasActiveFilters ? (
              <Button size="small" onClick={clearFilters} startIcon={<Clear />}>
                Clear filters
              </Button>
            ) : null}
          </Stack>
        </Stack>
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : visibleCount === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 0.5 }}>
            No products match
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Try another search or clear filters.
          </Typography>
          <Button variant="outlined" size="small" onClick={clearFilters}>
            Clear filters
          </Button>
        </Paper>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Showing {visibleCount} product type{visibleCount === 1 ? '' : 's'}
            {hasActiveFilters ? ' (filtered)' : ''}
          </Typography>

          {filteredGroups.map(({ parent, subs, total, isCustom }) => (
            <Accordion
              key={parent}
              expanded={expandedParents.has(parent)}
              onChange={() => toggleParent(parent)}
              disableGutters
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: isCustom ? 'success.light' : 'divider',
                borderRadius: '12px !important',
                mb: 1,
                overflow: 'hidden',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: isCustom ? 'rgba(46, 125, 50, 0.06)' : 'grey.50', minHeight: 48 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography fontWeight={700}>
                    {parent}
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                      {subs.length === total ? `(${total})` : `(${subs.length} of ${total})`}
                    </Typography>
                  </Typography>
                  {isCustom ? <Chip size="small" label="Approved request" color="success" variant="outlined" /> : null}
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: { xs: 1, sm: 2 }, pb: 2 }}>
                {subs.map((sub) => renderSubcategoryRow(sub))}
              </AccordionDetails>
            </Accordion>
          ))}

          {orphanOverrides.length > 0 ? (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Extra saved images
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These names are in the database but not in the create-field list.
              </Typography>
              <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
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
