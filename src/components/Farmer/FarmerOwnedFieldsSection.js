import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Stack,
  Paper,
  IconButton,
  Chip,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material';
import {
  LocationOn,
  Agriculture,
  TrendingUp,
  Assessment,
  Schedule,
  Close,
  Download,
  Description,
  Search,
  Visibility,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import fieldsService from '../../services/fields';
import farmsService from '../../services/farms';
import { orderService } from '../../services/orders';
import CreateFieldForm from '../Forms/CreateFieldForm';
import StatCard from '../Common/StatCard';
import { getProductIcon } from '../../utils/productIcons';
import HarvestProgressBar from '../Common/HarvestProgressBar';
import { formatHarvestDate, getHarvestProgressInfo, hasUpcomingHarvestOnRecord } from '../../utils/harvestProgress';
import {
  formatTotalProductionWithUnit,
  displayProductionRateUnit,
} from '../../utils/fieldProductionUnits';
import {
  mapFieldFromApi,
  fieldToFormInitialData,
  formatAreaFromM2,
} from '../../utils/rentedFieldModels';
import FarmerOwnedFieldDetailModal from './FarmerOwnedFieldDetailModal';

const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  PKR: '₨',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
};

/**
 * Same owned-fields list, filters, pagination, edit flow, and detail modal as Rented Fields → "My fields (owned)".
 */
export default function FarmerOwnedFieldsSection({ onFieldsChanged }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedFieldId, setExpandedFieldId] = useState(null);
  const [mappedFields, setMappedFields] = useState([]);
  const [ownedFieldOrderBreakdownById, setOwnedFieldOrderBreakdownById] = useState(new Map());
  const [userCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState(null);
  const [fieldDetailOpen, setFieldDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [showAllFields, setShowAllFields] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editFieldOpen, setEditFieldOpen] = useState(false);
  const [editingFieldFull, setEditingFieldFull] = useState(null);
  const [farmsListForEdit, setFarmsListForEdit] = useState([]);

  const loadFields = useCallback(async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await fieldsService.getAll();
      const rawList = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const mapped = rawList.map((f) => mapFieldFromApi(f, user.id));
      setMappedFields(mapped);
    } catch (error) {
      console.error('Error loading fields:', error);
      setMappedFields([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) return;
      try {
        const res = await orderService.getFarmerOrdersWithFields(user.id);
        const orders = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
        const map = new Map();

        orders.forEach((o) => {
          const status = String(o?.status || '').toLowerCase();
          if (status === 'cancelled') return;
          const fid = o?.field_id ?? o?.fieldId ?? o?.field?.id;
          if (!fid) return;
          const qtyRaw = o?.quantity ?? o?.area_rented ?? o?.area ?? 0;
          const qty = typeof qtyRaw === 'string' ? parseFloat(qtyRaw) : qtyRaw;
          if (!Number.isFinite(qty) || qty <= 0) return;

          const key = String(fid);
          const buyerName = o?.buyer_name ?? o?.buyerName ?? o?.buyer?.name ?? 'Unknown buyer';
          const buyerEmail = o?.buyer_email ?? o?.buyerEmail ?? o?.buyer?.email ?? '';
          const buyerKey = `${String(buyerName || '').trim()}|${String(buyerEmail || '').trim()}`;

          const prev = map.get(key) || { totalOccupiedM2: 0, buyersByKey: new Map() };
          prev.totalOccupiedM2 += qty;
          const bPrev = prev.buyersByKey.get(buyerKey) || { buyer_name: buyerName, buyer_email: buyerEmail, quantity_m2: 0 };
          bPrev.quantity_m2 += qty;
          prev.buyersByKey.set(buyerKey, bPrev);
          map.set(key, prev);
        });

        const finalMap = new Map();
        map.forEach((v, k) => {
          const buyers = Array.from(v.buyersByKey.values())
            .filter((b) => (b.buyer_name || b.buyer_email) && Number.isFinite(b.quantity_m2) && b.quantity_m2 > 0)
            .sort((a, b) => (b.quantity_m2 || 0) - (a.quantity_m2 || 0));
          finalMap.set(k, { totalOccupiedM2: v.totalOccupiedM2, buyers });
        });

        if (!cancelled) setOwnedFieldOrderBreakdownById(finalMap);
      } catch {
        if (!cancelled) setOwnedFieldOrderBreakdownById(new Map());
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const fieldsWithOwnerStats = useMemo(() => {
    if (!Array.isArray(mappedFields) || mappedFields.length === 0) return [];
    if (!(ownedFieldOrderBreakdownById instanceof Map) || ownedFieldOrderBreakdownById.size === 0) return mappedFields;

    return mappedFields.map((f) => {
      if (!f?.is_own_field) return f;
      const key = f.id != null ? String(f.id) : null;
      if (!key) return f;
      const stats = ownedFieldOrderBreakdownById.get(key);
      if (!stats || !Number.isFinite(stats.totalOccupiedM2)) return f;

      const total = typeof f.total_area === 'string' ? parseFloat(f.total_area) : (f.total_area || 0);
      if (!Number.isFinite(total) || total <= 0) return f;

      const occupiedM2 = Math.max(0, Math.min(total, stats.totalOccupiedM2));
      const availableM2 = Math.max(0, total - occupiedM2);
      const progress = Math.min(100, Math.round((occupiedM2 / total) * 100));
      const displayUnit = f.display_unit || f.area_unit || 'm2';

      return {
        ...f,
        occupied_area: occupiedM2,
        available_area: availableM2,
        occupied_area_display: formatAreaFromM2(occupiedM2, displayUnit),
        available_area_display: formatAreaFromM2(availableM2, displayUnit),
        area: formatAreaFromM2(occupiedM2, displayUnit),
        progress,
        buyers_breakdown: stats.buyers,
        occupied_source: 'orders',
      };
    });
  }, [mappedFields, ownedFieldOrderBreakdownById]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  const displayedFields = useMemo(() => {
    let list = fieldsWithOwnerStats.filter((f) => f.is_own_field);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (f) =>
          (f.name || '').toLowerCase().includes(q) ||
          (f.location || '').toLowerCase().includes(q) ||
          (f.cropType || '').toLowerCase().includes(q) ||
          (f.farmer_name || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      list = list.filter(
        (f) => (f.category || f.cropType || '').toLowerCase() === categoryFilter.toLowerCase()
      );
    }
    return list;
  }, [fieldsWithOwnerStats, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set();
    fieldsWithOwnerStats
      .filter((f) => f.is_own_field)
      .forEach((f) => {
        const c = f.category || f.cropType;
        if (c) set.add(c);
      });
    return Array.from(set).sort();
  }, [fieldsWithOwnerStats]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Completed':
        return 'primary';
      case 'Pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleFieldClick = (field) => {
    setSelectedField(field);
    setFieldDetailOpen(true);
  };

  const handleCloseFieldDetail = () => {
    setFieldDetailOpen(false);
    setSelectedField(null);
  };

  const handleViewOnMap = (field) => {
    const fieldId = field?.id;
    if (!fieldId) return;
    const base = user?.user_type === 'farmer' ? '/farmer' : '/buyer';
    navigate(`${base}?field_id=${encodeURIComponent(String(fieldId))}`);
  };

  const openEditField = async (field) => {
    if (!field?.id || !field.is_own_field) return;
    try {
      const [fieldRes, farmsRes] = await Promise.all([
        fieldsService.getById(field.id),
        farmsService.getAll(user?.id).catch(() => ({ data: [] })),
      ]);
      const raw = fieldRes.data;
      const farms = Array.isArray(farmsRes.data) ? farmsRes.data : farmsRes.data?.data ?? [];
      setEditingFieldFull(raw);
      setFarmsListForEdit(farms.map((f) => ({ id: f.id, farmName: f.farm_name ?? f.name ?? f.farmName, name: f.farm_name ?? f.name ?? f.farmName })));
      setEditFieldOpen(true);
    } catch (e) {
      console.error('Failed to load field for edit:', e);
    }
  };

  const handleFullFieldSubmit = async (formData) => {
    if (!editingFieldFull?.id) return;
    try {
      const payload = { ...editingFieldFull, ...formData, shipping_scope: formData.shippingScope };
      delete payload.deliveryTime;
      delete payload.delivery_time;
      await fieldsService.update(editingFieldFull.id, payload);
      await loadFields();
      setEditFieldOpen(false);
      setEditingFieldFull(null);
      onFieldsChanged?.();
    } catch (e) {
      console.error('Failed to update field:', e);
    }
  };

  const totalPages = Math.ceil(displayedFields.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFields = showAllFields ? displayedFields : displayedFields.slice(startIndex, endIndex);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleViewAllClick = () => {
    setShowAllFields(!showAllFields);
    setCurrentPage(1);
  };

  const handleReportClick = () => {
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
  };

  const totalFields = displayedFields.length;
  const activeFields = displayedFields.filter((f) => f.status === 'Active').length;
  const totalProduction = displayedFields.reduce((sum, field) => sum + (parseFloat(field.total_production) || 0), 0);
  const totalPotentialIncome = displayedFields.reduce((sum, field) => sum + (parseFloat(field.potential_income) || 0), 0);
  const validFields = displayedFields.filter((field) => field.progress != null && !isNaN(field.progress));
  const avgProgress = validFields.length > 0
    ? Math.round(validFields.reduce((sum, field) => sum + field.progress, 0) / validFields.length)
    : 0;

  const handleDownloadReport = (format = 'pdf') => {
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      totalFields: displayedFields.length,
      activeFields: displayedFields.filter((f) => f.status === 'Active').length,
      totalMonthlyRent: displayedFields.reduce((sum, field) => sum + (parseFloat(field.monthlyRent) || 0), 0),
      avgProgress,
      fields: displayedFields.map((field) => ({
        name: field.name || field.farmName,
        location: field.location,
        cropType: field.cropType,
        area: field.area,
        monthlyRent: field.monthlyRent,
        progress: field.progress,
        status: field.status,
      })),
    };

    if (format === 'csv') {
      const headers = ['Field Name', 'Location', 'Crop Type', 'Area', 'Monthly Rent', 'Occupied Area', 'Status'];
      const rows = reportData.fields.map((f) => [
        f.name,
        f.location,
        f.cropType,
        f.area,
        `${currencySymbols[userCurrency]}${(parseFloat(f.monthlyRent) || 0).toFixed(2)}`,
        `${f.progress}%`,
        f.status,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `my-fields-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const printWindow = window.open('', '_blank');
      const reportHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>My Fields Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #1e293b; border-bottom: 2px solid #4caf50; padding-bottom: 10px; }
              h2 { color: #059669; margin-top: 30px; }
              .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
              .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
              .summary-value { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 5px; }
              .summary-label { font-size: 12px; color: #64748b; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #4caf50; color: white; padding: 12px; text-align: left; font-weight: bold; }
              td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
              @media print { body { margin: 0; padding: 15px; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <h1>My Fields Report</h1>
            <p><strong>Generated:</strong> ${reportData.generatedAt}</p>
            <div class="summary">
              <div class="summary-card">
                <div class="summary-value">${reportData.totalFields}</div>
                <div class="summary-label">Total Fields</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${reportData.activeFields}</div>
                <div class="summary-label">Active Fields</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${totalProduction.toLocaleString()} total</div>
                <div class="summary-label">Total Production</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${currencySymbols[userCurrency]}${totalPotentialIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="summary-label">Potential Income</div>
              </div>
            </div>
            <h2>Fields Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Location</th>
                  <th>Crop Type</th>
                  <th>Area</th>
                  <th>Monthly Rent</th>
                  <th>Occupied Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.fields.map((field) => `
                  <tr>
                    <td>${field.name}</td>
                    <td>${field.location}</td>
                    <td>${field.cropType}</td>
                    <td>${field.area}</td>
                    <td>${currencySymbols[userCurrency]}${(parseFloat(field.monthlyRent) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${field.progress}%</td>
                    <td>${field.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">
              <p>This report was generated on ${reportData.generatedAt}</p>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(reportHTML);
      printWindow.document.close();
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2.5, gap: { xs: 1.5, sm: 0 } }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
            My fields (owned)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
            Same view as Rented fields — your owned fields, orders occupancy, edit, map, and reports.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Assessment />}
          onClick={handleReportClick}
          sx={{
            backgroundColor: '#4caf50',
            color: '#ffffff',
            borderRadius: 2,
            px: 2.5,
            py: 1,
            alignSelf: { xs: 'stretch', sm: 'flex-end' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          Field Report
        </Button>
      </Stack>

      <div className="mb-3 grid max-w-[480px] grid-cols-2 gap-3 md:max-w-none md:grid-cols-4">
        <StatCard
          icon={<Agriculture sx={{ fontSize: 20 }} />}
          iconBg="#dbeafe"
          iconColor="#1d4ed8"
          value={totalFields}
          label="Total Fields"
        />
        <StatCard
          icon={<TrendingUp sx={{ fontSize: 20 }} />}
          iconBg="#dcfce7"
          iconColor="#059669"
          value={activeFields}
          label="Active Fields"
        />
        <StatCard
          icon={<Assessment sx={{ fontSize: 20 }} />}
          iconBg="#f3e8ff"
          iconColor="#7c3aed"
          value={`${totalProduction.toLocaleString()} total`}
          label="Total Production"
        />
        <StatCard
          icon={<Schedule sx={{ fontSize: 20 }} />}
          iconBg="#fef3c7"
          iconColor="#d97706"
          value={`${currencySymbols[userCurrency]}${totalPotentialIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          label="Potential Income"
        />
      </div>

      <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto">
          <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white">
            My fields (owned)
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="relative min-w-[140px] max-w-[200px] sm:min-w-[220px] sm:max-w-[260px]">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
              <Search sx={{ fontSize: 16 }} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, location, crop..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-700 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
            />
          </div>

          <div className="min-w-[130px] max-w-[180px] sm:min-w-[180px] sm:max-w-[220px]">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || categoryFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('');
                setCurrentPage(1);
              }}
              className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="w-full space-y-2">
        {paginatedFields.map((field) => {
          const iconUrl = getProductIcon(field.subcategory || field.category || field.cropType);
          const harvestText = (() => {
            const items = Array.isArray(field.selected_harvests) ? field.selected_harvests : [];
            const format = (date) => {
              if (!date) return '';
              if (typeof date === 'string' && /\d{1,2}\s\w{3}\s\d{4}/.test(date)) return date;
              return formatHarvestDate(date);
            };
            if (items.length) {
              const mapped = items.map((it) => {
                const dt = format(it.date);
                if (it.label && dt) return `${dt} (${it.label})`;
                if (dt) return dt;
                if (it.label) return it.label;
                return '';
              }).filter(Boolean);
              const uniq = Array.from(new Set(mapped));
              return uniq.join(', ') || 'Not specified';
            }
            const fallback = field.selected_harvest_date ? formatHarvestDate(field.selected_harvest_date) : '';
            if (field.selected_harvest_label && fallback) return `${fallback} (${field.selected_harvest_label})`;
            return fallback || field.selected_harvest_label || 'Not specified';
          })();
          const shippingText = (() => {
            const modes = Array.isArray(field.shipping_modes) ? field.shipping_modes : [];
            const uniq = (() => {
              const s = new Set();
              return modes.filter((m) => {
                const k = (m || '').toLowerCase();
                if (s.has(k)) return false;
                s.add(k);
                return true;
              });
            })();
            return uniq.length ? uniq.join(', ') : 'Not specified';
          })();
          const progressColor = field.progress === 100 ? '#10b981' : field.progress > 50 ? '#3b82f6' : '#f59e0b';
          const isExpanded = expandedFieldId === field.id;

          return (
            <div key={field.id} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedFieldId((prev) => (prev === field.id ? null : field.id))}
                className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50"
              >
                {iconUrl && (
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                    <img src={iconUrl} alt="Field icon" className="h-5 w-5 object-contain" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 sm:truncate sm:whitespace-nowrap">
                          {field.name || field.farmName}
                        </div>
                        <span className="mt-0.5 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[0.65rem] font-semibold text-blue-700">
                          My field
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <LocationOn sx={{ fontSize: 14, color: '#64748b' }} />
                        <div className="min-w-0 flex-1 leading-snug sm:truncate sm:whitespace-nowrap">{field.location}</div>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[0.65rem] text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <span className="font-medium text-slate-500">Harvest:</span>
                          {harvestText.split(',')[0]}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <span className="font-medium text-slate-500">Total:</span>
                          {formatTotalProductionWithUnit(field.total_production, field.total_production_unit)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <HarvestProgressBar item={field} compact showDate={false} daysShort />
                      </div>
                    </div>

                    <div className="mt-1 flex w-full items-center justify-between gap-2 sm:mt-0 sm:w-auto sm:justify-end">
                      <div className="text-left sm:text-right">
                        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                          <div className="text-sm font-bold text-emerald-600">
                            {currencySymbols[userCurrency]}
                            {(parseFloat(field.price_per_m2) || 0).toFixed(2)}/m²
                          </div>
                          <div className="text-[0.6rem] font-medium text-slate-400">
                            {field.production_rate} {displayProductionRateUnit(field)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditField(field);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                          title="Edit field"
                          aria-label="Edit field"
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewOnMap(field);
                          }}
                          disabled={!hasUpcomingHarvestOnRecord(field)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            hasUpcomingHarvestOnRecord(field)
                              ? 'View on map'
                              : 'Hidden from map — harvest window ended'
                          }
                          aria-label="View on map"
                        >
                          <LocationOn sx={{ fontSize: 18 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ml-1 shrink-0 text-slate-400">{isExpanded ? '▴' : '▾'}</div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 px-3 py-3">
                  {getHarvestProgressInfo(field).isExpiredSeason && (
                    <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950">
                      <div className="text-sm font-bold text-orange-900">Harvest window ended</div>
                      <p className="mt-1.5 leading-relaxed text-orange-900/90">
                        All scheduled harvest dates are in the past. This field is hidden from the map and from buyers until you add a new upcoming harvest. If any buyers still have crop to receive, complete delivery and orders as usual — past fields stay visible here and in order history.
                      </p>
                    </div>
                  )}
                  {harvestText !== 'Not specified' && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
                          {getHarvestProgressInfo(field).isExpiredSeason
                            ? 'Past harvest dates'
                            : field.selected_harvest_date
                              ? 'Your Selected Harvest'
                              : 'Available Harvest Dates'}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-amber-900">{harvestText}</div>
                    </div>
                  )}

                  <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                    <HarvestProgressBar item={field} showDate={false} />
                  </div>

                  {shippingText !== 'Not specified' && (
                    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-blue-700">Delivery Options</span>
                      </div>
                      <div className="text-sm font-bold text-blue-900">{shippingText}</div>
                    </div>
                  )}

                  <>
                    <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Total Area</span>
                        <span className="font-semibold text-slate-900">{field.total_area_display || `${field.total_area} m²`}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Occupied</span>
                        <span className="font-semibold text-slate-900">{field.occupied_area_display || field.area}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Available</span>
                        <span className="font-semibold text-slate-900">{field.available_area_display || `${field.available_area} m²`}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Production Rate</span>
                        <span className="font-semibold text-slate-900">
                          {field.production_rate} {displayProductionRateUnit(field)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Total Production</span>
                        <span className="font-semibold text-slate-900">
                          {formatTotalProductionWithUnit(field.total_production, field.total_production_unit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Price/m²</span>
                        <span className="font-semibold text-emerald-600">
                          {currencySymbols[userCurrency]}
                          {(parseFloat(field.price_per_m2) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Distribution Price</span>
                        <span className="font-semibold text-slate-900">{currencySymbols[userCurrency]}{(parseFloat(field.distribution_price) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Retail Price</span>
                        <span className="font-semibold text-slate-900">{currencySymbols[userCurrency]}{(parseFloat(field.retail_price) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">App Fees (5%)</span>
                        <span className="font-semibold text-amber-600">{currencySymbols[userCurrency]}{(parseFloat(field.app_fees) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Potential Income</span>
                        <span className="font-semibold text-emerald-600">{currencySymbols[userCurrency]}{(parseFloat(field.potential_income) || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[0.7rem] text-slate-500">
                        <span>Occupied area</span>
                        <span className="font-semibold text-slate-900">{field.progress}% of field</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div className="h-full rounded-full" style={{ width: `${field.progress}%`, backgroundColor: progressColor }} />
                      </div>
                    </div>
                  </>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFieldClick(field);
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      <Visibility sx={{ fontSize: 16 }} />
                      <span>View details</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {displayedFields.length > itemsPerPage && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 4 }}>
          {!showAllFields ? (
            <>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  },
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Showing {startIndex + 1}-{Math.min(endIndex, displayedFields.length)} of {displayedFields.length} fields
              </Typography>
              <Button
                variant="outlined"
                size="medium"
                onClick={handleViewAllClick}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  borderColor: '#e2e8f0',
                  color: '#64748b',
                  '&:hover': {
                    borderColor: '#3b82f6',
                    color: '#3b82f6',
                    bgcolor: '#f8fafc',
                  },
                }}
              >
                View All Fields ({displayedFields.length})
              </Button>
            </>
          ) : (
            <Button
              variant="outlined"
              size="medium"
              onClick={handleViewAllClick}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1,
                borderColor: '#e2e8f0',
                color: '#64748b',
                '&:hover': {
                  borderColor: '#3b82f6',
                  color: '#3b82f6',
                  bgcolor: '#f8fafc',
                },
              }}
            >
              Show Paginated View
            </Button>
          )}
        </Box>
      )}

      <FarmerOwnedFieldDetailModal
        open={fieldDetailOpen}
        selectedField={selectedField}
        onClose={handleCloseFieldDetail}
        userCurrency={userCurrency}
        currencySymbols={currencySymbols}
        onEditField={openEditField}
      />

      <CreateFieldForm
        open={editFieldOpen}
        onClose={() => {
          setEditFieldOpen(false);
          setEditingFieldFull(null);
        }}
        onSubmit={handleFullFieldSubmit}
        editMode
        initialData={editingFieldFull ? fieldToFormInitialData(editingFieldFull) : null}
        farmsList={farmsListForEdit}
      />

      <Dialog
        open={reportOpen}
        onClose={handleCloseReport}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                My Fields Report
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Owned fields summary
              </Typography>
            </Box>
            <IconButton onClick={handleCloseReport} sx={{ color: '#64748b' }}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                    {totalFields}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Fields
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
                    {activeFields}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Fields
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#fef3c7', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#d97706', mb: 0.5 }}>
                    {totalProduction.toLocaleString()} total
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Production
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
                    {currencySymbols[userCurrency]}
                    {totalPotentialIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Potential Income
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                Fields Summary
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Field Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Crop Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Monthly Rent</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Occupied Area</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedFields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>{field.name || field.farmName}</TableCell>
                        <TableCell>{field.location}</TableCell>
                        <TableCell>{field.cropType}</TableCell>
                        <TableCell>{field.area}</TableCell>
                        <TableCell>
                          {currencySymbols[userCurrency]}
                          {(() => {
                            const amount = parseFloat(field.monthlyRent) || 0;
                            return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </TableCell>
                        <TableCell>{field.progress}%</TableCell>
                        <TableCell>
                          <Chip label={field.status} color={getStatusColor(field.status)} size="small" sx={{ fontWeight: 600 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Report generated on {new Date().toLocaleString()}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
          <Button onClick={() => handleDownloadReport('csv')} variant="outlined" startIcon={<Download />} sx={{ borderRadius: 1.5 }}>
            Download CSV
          </Button>
          <Button onClick={() => handleDownloadReport('pdf')} variant="outlined" startIcon={<Description />} sx={{ borderRadius: 1.5 }}>
            Download PDF
          </Button>
          <Button onClick={handleCloseReport} variant="contained" sx={{ borderRadius: 1.5, bgcolor: '#4caf50', color: '#ffffff', '&:hover': { bgcolor: '#059669' } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
