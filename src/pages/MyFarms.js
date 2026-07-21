import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  LinearProgress,
  Divider,
  Button,
  IconButton,
  Stack,
  Paper,
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
} from '@mui/material';
import {
  LocationOn,
  CalendarToday,
  Agriculture,
  TrendingUp,
  Assessment,
  Nature,
  WaterDrop,
  Visibility,
  Terrain,
  Park,
  AttachMoney,
  Close,
  Info,
  Settings,
  Download,
  Description,
  Edit as EditIcon,
  DeleteOutline,
} from '@mui/icons-material';
import storageService from '../services/storage';
import fieldsService from '../services/fields';
import farmsService from '../services/farms';
import { orderService } from '../services/orders';
import { useAuth } from '../contexts/AuthContext';
import AddFarmForm from '../components/Forms/AddFarmForm';
import StatCard from '../components/Common/StatCard';
import supabase from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';
import { userDocumentsService } from '../services/userDocuments';
import { formatTotalProductionWithUnit, productionRateDisplay } from '../utils/fieldProductionUnits';
import { areaDisplay, priceAreaDisplay, getFieldTotalAreaM2 } from '../utils/fieldAreaDisplay';
import {
  buildFieldIdToFarmIdMap,
  farmAllowsDelete,
  fieldBlocksDeletion,
} from '../utils/fieldEditRestrictions';
import FarmerOwnedFieldsSection from '../components/Farmer/FarmerOwnedFieldsSection';
import FarmerFieldStatusCard from '../components/Farmer/FarmerFieldStatusCard';
import FarmHarvestDashboard from '../components/Farmer/FarmHarvestDashboard';
import { FIELD_OCCUPYING_ORDER_STATUSES, orderQuantityM2, normalizeOrderFieldId } from '../utils/farmerOrderOccupancy';
import { Park as FarmIcon } from '@mui/icons-material';

const MY_FARMS_TAB = 0;
const MY_FIELDS_TAB = 1;

const normalizeAreaUnit = (raw) => {
  const u = String(raw || '').trim().toLowerCase();
  if (!u) return 'm2';
  if (u === 'm²' || u === 'm2' || u === 'sqm' || u === 'square meter') return 'm2';
  if (u === 'acre' || u === 'acres') return 'acre';
  if (u === 'hectare' || u === 'hectares' || u === 'ha') return 'ha';
  if (u === 'sqft' || u === 'sq ft' || u === 'sq. ft' || u === 'ft2' || u === 'ft²' || u === 'square feet' || u === 'square foot') {
    return 'ft2';
  }
  return u;
};

const toM2 = (value, unit) => {
  const v = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(v)) return 0;
  const u = normalizeAreaUnit(unit);
  if (u === 'acre') return v * 4046.8564224;
  if (u === 'ha') return v * 10000;
  if (u === 'ft2') return v * 0.092903;
  return v;
};

const MyFarms = () => {
  const [myFarms, setMyFarms] = useState([]);
  const [myFields, setMyFields] = useState([]);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [farmDetailOpen, setFarmDetailOpen] = useState(false);
  const [addFarmOpen, setAddFarmOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [showAllFarms, setShowAllFarms] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  /** Raw farmer orders (incl. pending) for delete / farm-clear rules */
  const [farmerOrdersList, setFarmerOrdersList] = useState([]);
  const [pageTab, setPageTab] = useState(MY_FARMS_TAB);
  const [highlightFieldId, setHighlightFieldId] = useState(null);
  const { user } = useAuth();

  const fieldIdToFarmIdMap = useMemo(() => buildFieldIdToFarmIdMap(myFields), [myFields]);

  // Currency symbols mapping
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'PKR': '₨',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF'
  };

  // Handle farm detail modal
  const handleFarmClick = (farm) => {
    setSelectedFarm(farm);
    setFarmDetailOpen(true);
  };

  const handleCloseFarmDetail = () => {
    setFarmDetailOpen(false);
    setSelectedFarm(null);
    setHighlightFieldId(null);
  };

  const handleDeleteFieldCard = async (field) => {
    if (!field?.id) return;
    let orders = farmerOrdersList;
    try {
      const ordersRes = await orderService.getFarmerOrdersWithFields(user.id);
      orders = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.orders || []);
      orders = Array.isArray(orders) ? orders : [];
    } catch {
      /* keep cached */
    }
    if (fieldBlocksDeletion(field, orders)) {
      window.alert(
        'This field cannot be deleted while there is an ongoing purchase (including a pending, unconfirmed order) or committed area. Complete or cancel all orders first.'
      );
      return;
    }
    const label = field.name || 'this field';
    if (!window.confirm(`Delete "${label}" permanently? This cannot be undone.`)) return;
    try {
      await fieldsService.remove(field.id);
      await fetchFarms();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Could not delete field.';
      window.alert(String(msg));
    }
  };

  const handleDeleteFarm = async (farm) => {
    if (!farm?.id) return;
    let orders = farmerOrdersList;
    try {
      const ordersRes = await orderService.getFarmerOrdersWithFields(user.id);
      orders = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.orders || []);
      orders = Array.isArray(orders) ? orders : [];
    } catch {
      /* keep cached */
    }
    if (!farmAllowsDelete(farm, orders, fieldIdToFarmIdMap)) {
      window.alert(
        'This farm cannot be deleted until it is fully cleared: remove all fields, and ensure there are no pending or active orders for those fields (only completed or cancelled orders are OK).'
      );
      return;
    }
    const label = farm.name || 'this farm';
    if (!window.confirm(`Delete farm "${label}" permanently? This cannot be undone.`)) return;
    try {
      await farmsService.remove(farm.id);
      setFarmDetailOpen(false);
      setSelectedFarm(null);
      await fetchFarms();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Could not delete farm.';
      window.alert(String(msg));
    }
  };

  const handleAddFarmOpen = () => {
    setEditingFarm(null);
    setAddFarmOpen(true);
  };
  const handleAddFarmClose = () => {
    setAddFarmOpen(false);
    setEditingFarm(null);
  };
  const openEditFarm = async (farm) => {
    setFarmDetailOpen(false);
    setSelectedFarm(null);
    try {
      const res = await farmsService.getById(farm.id);
      setEditingFarm(res.data);
      setAddFarmOpen(true);
    } catch (err) {
      console.error('Failed to load farm for edit:', err);
    }
  };
  const handleAddFarmSubmit = async (farmData) => {
    const isEdit = farmData.id != null && editingFarm != null;
    try {
      if (isEdit) {
        const payload = {
          ...farmData,
          name: farmData.farmName,
          cropType: farmData.cropType,
          irrigationType: farmData.irrigationType,
          soilType: farmData.soilType,
          areaValue: farmData.areaValue,
          areaUnit: farmData.areaUnit,
          progress: farmData.progress,
          plantingDate: farmData.plantingDate,
          harvestDate: farmData.harvestDate,
          status: farmData.status
        };
        await farmsService.update(farmData.id, payload);
        await fetchFarms();
        setAddFarmOpen(false);
        setEditingFarm(null);
        return;
      }
      const newFarm = {
        ...farmData,
        name: farmData.farmName, // key mapping for backend
        owner_id: user.id
      };
      await farmsService.create(newFarm).then(() => fetchFarms());

      // Handle License Upload
      if (farmData.licenseFile) {
        try {
          const file = farmData.licenseFile;
          const fileExt = file.name.split('.').pop();
          const fileName = `${uuidv4()}-${file.name}`;
          const filePath = `documents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('user-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('user-documents')
            .getPublicUrl(filePath);

          await userDocumentsService.addDocument({
            user_id: user.id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: fileExt
          });

        } catch (uploadErr) {
          console.error('Error uploading license:', uploadErr);
        }
      }

      await fetchFarms();
    } catch (error) {
      if (isEdit) {
        console.error('Failed to update farm:', error);
        return;
      }
      setMyFarms(prev => [{
        id: farmData.id || Date.now(),
        name: farmData.farmName,
        location: farmData.location,
        cropType: farmData.cropType,
        plantingDate: farmData.plantingDate,
        harvestDate: farmData.harvestDate,
        progress: farmData.progress || 0,
        areaValue: farmData.areaValue,
        areaUnit: farmData.areaUnit,
        soilType: farmData.soilType,
        irrigationType: farmData.irrigationType,
        monthlyRevenue: 0,
        status: farmData.status || 'Active',
        image: null,
        description: farmData.description,
        fields: []
      }, ...prev]);
    }
    setAddFarmOpen(false);
    setEditingFarm(null);
  };


  // Check for URL params to auto-open modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add-farm') {
      setAddFarmOpen(true);
      // Clean up URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Deep-link from Rented out Fields (enter harvest CTA): open farm detail for field_id
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fieldId = params.get('field_id');
    if (!fieldId || (!myFarms.length && !myFields.length)) return;

    const ownedField = myFields.find((f) => String(f.id) === String(fieldId));
    const farmId = ownedField?.farm_id;
    const farm =
      (farmId && myFarms.find((f) => String(f.id) === String(farmId))) ||
      myFarms.find((f) => (f.fields || []).some((field) => String(field.id) === String(fieldId)));

    if (!farm) return;
    setSelectedFarm(farm);
    setFarmDetailOpen(true);
    setHighlightFieldId(String(fieldId));
    window.history.replaceState({}, '', window.location.pathname);
  }, [myFarms, myFields]);

  useEffect(() => {
    if (!farmDetailOpen || !highlightFieldId) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`my-farm-field-${highlightFieldId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [farmDetailOpen, highlightFieldId, selectedFarm?.id]);

  const fetchFarms = async () => {
    try {
      // Fetch only farms owned by the current farmer (filtered by owner_id)
      if (!user || !user.id) {
        setMyFarms([]);
        setMyFields([]);
        setFarmerOrdersList([]);
        return;
      }

      const farmsResponse = await farmsService.getAll(user.id);
      const rawFarms = farmsResponse.data || [];

      let rawFarmerOrders = [];
      try {
        const ordersRes = await orderService.getFarmerOrdersWithFields(user.id);
        const ord = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.orders || []);
        rawFarmerOrders = Array.isArray(ord) ? ord : [];
      } catch {
        rawFarmerOrders = [];
      }
      setFarmerOrdersList(rawFarmerOrders);

      const occupiedByFieldId = new Map();
      rawFarmerOrders.forEach((o) => {
        const status = String(o?.status || '').toLowerCase();
        if (status === 'cancelled') return;
        if (!FIELD_OCCUPYING_ORDER_STATUSES.includes(status)) return;
        const fid = normalizeOrderFieldId(o);
        if (!fid) return;
        const qty = orderQuantityM2(o);
        if (qty <= 0) return;
        occupiedByFieldId.set(fid, (occupiedByFieldId.get(fid) || 0) + qty);
      });

      let transformedFields = [];
      // Fetch farmer-created fields if user is available
      if (user && user.id) {
        try {
          const fieldsResponse = await fieldsService.getAll();
          // Filter fields created by the current farmer
          const farmerFields = fieldsResponse.data?.filter(field =>
            field.farmer_name === user.name || field.created_by === user.id || field.owner_id === user.id
          ) || [];

          // Transform fields data to match the expected format for display
          transformedFields = farmerFields.map(field => {
            const orderOccM2 = occupiedByFieldId.get(String(field.id));
            const totalAreaM2 = getFieldTotalAreaM2(field);
            const availableFromFieldM2 = parseFloat(field.available_area_m2 || field.available_area || 0);
            const occupiedFromFieldM2 = Math.max(0, totalAreaM2 - availableFromFieldM2);

            // Prefer authoritative aggregate occupancy from orders when available.
            const occupiedM2 = Number.isFinite(orderOccM2) ? Math.max(0, orderOccM2) : occupiedFromFieldM2;
            const availableAreaM2 = Math.max(0, totalAreaM2 - occupiedM2);
            const totalProduction = parseFloat(field.total_production || 0);
            const potentialIncome = parseFloat(field.potential_income || 0);
            // Extract date strings from harvest dates (they come as {date, label} objects)
            const harvestDates = field.harvest_dates ? 
              (Array.isArray(field.harvest_dates) 
                ? field.harvest_dates.map(h => typeof h === 'object' ? h.date : h)
                : [field.harvest_dates]) : [];
            const shippingOption = field.shipping_option || '';
            const shippingModes = shippingOption ? shippingOption.split(/[,/]/).map((s) => s.trim()).filter(Boolean) : [];
            
            return {
              id: field.id,
              name: field.name,
              location: field.location,
              cropType: field.category || field.product_type,
              plantingDate: field.planting_date,
              harvestDates: harvestDates,
              harvestDate: harvestDates[0] || null,
              totalAreaM2,
              availableAreaM2,
              occupiedM2,
              area: areaDisplay(field, occupiedM2).text,
              display_unit: field.display_unit || field.field_size_unit,
              field_size: field.field_size,
              field_size_unit: field.field_size_unit,
              total_area_display: areaDisplay(field, totalAreaM2).text,
              available_area_display: areaDisplay(field, availableAreaM2).text,
              price_per_unit_display: priceAreaDisplay(field).text,
              production_rate_display: productionRateDisplay(field).text,
              soilType: field.soil_type,
              irrigationType: field.irrigation_type,
              totalProduction,
              totalProductionUnit: field.total_production_unit,
              potentialIncome,
              monthlyRevenue: potentialIncome,
              status: field.status,
              image: field.image,
              farm_id: field.farm_id,
              shippingModes,
              price: field.price,
              price_per_m2: field.price_per_m2,
              production_rate: field.production_rate,
              production_rate_unit: field.production_rate_unit,
              operational_status: field.operational_status || 'growing',
              quantity_sell_percent: field.quantity_sell_percent,
              last_season_yield: field.last_season_yield,
              last_season_yield_unit: field.last_season_yield_unit,
              last_season_harvested_at: field.last_season_harvested_at,
              shipping_destinations: field.shipping_destinations,
              shipping_scope: field.shipping_scope,
              shipping_option: field.shipping_option,
              shipping_pickup: field.shipping_pickup,
              shipping_delivery: field.shipping_delivery,
              delivery_charges: field.delivery_charges,
              isFarmerCreated: true
            };
          });

          setMyFields(transformedFields);
        } catch (fieldsError) {
          console.error('Error fetching farmer fields:', fieldsError);
          setMyFields([]);
        }
      }

      // Transform database farms and calculate revenue and progress from fields
      const transformedFarms = rawFarms.map(farm => {
        // Calculate from fields belonging to this farm
        const farmFields = transformedFields.filter(f => f.farm_id === farm.id);
        
        // Total production from all fields
        const totalProduction = farmFields.reduce((sum, f) => sum + (f.totalProduction || 0), 0);
        
        // Potential income from all fields
        const totalPotentialIncome = farmFields.reduce((sum, f) => sum + (f.potentialIncome || 0), 0);
        
        // Farm's own total area (convert to m2 if needed)
        const farmAreaValue = parseFloat(farm.area_value || 0);
        const farmAreaUnit = farm.area_unit || 'm2';
        const farmTotalAreaM2 = toM2(farmAreaValue, farmAreaUnit);
        
        // Sum of all field areas
        const totalFieldAreaM2 = farmFields.reduce((sum, f) => sum + (f.totalAreaM2 || 0), 0);
        
        // Progress = fields area / farm area
        const progress = farmTotalAreaM2 > 0 ? Math.min(100, Math.round((totalFieldAreaM2 / farmTotalAreaM2) * 100)) : 0;
        
        // Collect all harvest dates from fields (already extracted as date strings)
        const allHarvestDates = farmFields.flatMap(f => f.harvestDates || []).filter(Boolean);
        // Handle farm's own harvest_date (might be object or string)
        const farmHarvestDateStr = typeof farm.harvest_date === 'object' && farm.harvest_date?.date 
          ? farm.harvest_date.date 
          : farm.harvest_date;
        
        return {
          id: farm.id,
          name: farm.farm_name || farm.name,
          location: farm.location,
          cropType: farm.crop_type,
          plantingDate: farm.planting_date,
          harvestDate: farmHarvestDateStr,
          harvestDates: allHarvestDates.length > 0 ? allHarvestDates : (farmHarvestDateStr ? [farmHarvestDateStr] : []),
          progress,
          totalAreaM2: totalFieldAreaM2,
          farmAreaM2: farmTotalAreaM2,
          occupiedAreaM2: totalFieldAreaM2,
          totalProduction,
          totalPotentialIncome,
          areaValue: farm.area_value,
          areaUnit: farm.area_unit,
          soilType: farm.soil_type,
          irrigationType: farm.irrigation_type,
          monthlyRevenue: totalPotentialIncome > 0 ? totalPotentialIncome : (farm.monthly_revenue || 0),
          status: farm.status,
          image: farm.image,
          description: farm.description,
          farmIcon: farm.farm_icon,
          coordinates: farm.coordinates,
          webcamUrl: farm.webcam_url,
          fields: farmFields
        };
      });

      setMyFarms(transformedFarms);
    } catch (error) {
      console.error('Error fetching farms:', error);
      setMyFarms([]);
    }
  };

  // Load my farms data
  useEffect(() => {
    fetchFarms();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when user.id is set
  }, [user?.id]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Growing': return 'info';
      case 'Harvesting': return 'warning';
      case 'Planning': return 'default';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    const symbol = currencySymbols[userCurrency] || '₨';
    const safeAmount = amount || 0;
    return `${symbol}${safeAmount.toLocaleString()}`;
  };

  // Farm Report functionality
  const handleReportClick = () => {
    setReportOpen(true);
  };

  const handleCloseReport = () => {
    setReportOpen(false);
  };

  const handleDownloadReport = (format = 'pdf') => {
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      totalFarms: displayFarms.length,
      activeFarms: displayFarms.filter(f => f.status === 'Active').length,
      totalProduction,
      totalPotentialIncome,
      avgProgress,
      farms: displayFarms.map(farm => ({
        name: farm.name,
        location: farm.location,
        cropType: farm.cropType,
        area: farm.totalAreaM2 > 0 
          ? `${Math.round(farm.occupiedAreaM2).toLocaleString()} / ${Math.round(farm.totalAreaM2).toLocaleString()} m²`
          : `${farm.areaValue || 0} ${farm.areaUnit || 'm²'}`,
        totalProduction: farm.totalProduction,
        potentialIncome: farm.totalPotentialIncome,
        progress: farm.progress,
        status: farm.status,
        soilType: farm.soilType,
        irrigationType: farm.irrigationType
      }))
    };

    if (format === 'csv') {
      const headers = ['Farm Name', 'Location', 'Crop Type', 'Area', 'Production (total)', 'Potential Income', 'Occupied %', 'Status', 'Soil Type', 'Irrigation'];
      const rows = reportData.farms.map(f => [
        f.name,
        f.location,
        f.cropType,
        f.area,
        f.totalProduction?.toLocaleString() || '0',
        `${currencySymbols[userCurrency]}${(f.potentialIncome || 0).toFixed(2)}`,
        `${f.progress}%`,
        f.status,
        f.soilType,
        f.irrigationType
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `farms-report-${new Date().toISOString().split('T')[0]}.csv`);
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
            <title>Farms Report</title>
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
            <h1>Farms Report</h1>
            <p><strong>Generated:</strong> ${reportData.generatedAt}</p>
            <div class="summary">
              <div class="summary-card">
                <div class="summary-value">${reportData.totalFarms}</div>
                <div class="summary-label">Total Farms</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${reportData.activeFarms}</div>
                <div class="summary-label">Active Farms</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${reportData.totalProduction.toLocaleString()} total</div>
                <div class="summary-label">Total Production</div>
              </div>
              <div class="summary-card">
                <div class="summary-value">${currencySymbols[userCurrency]}${reportData.totalPotentialIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="summary-label">Potential Income</div>
              </div>
            </div>
            <h2>Farms Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Farm Name</th>
                  <th>Location</th>
                  <th>Crop Type</th>
                  <th>Area</th>
                  <th>Production</th>
                  <th>Income</th>
                  <th>Occupied</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.farms.map(farm => `
                  <tr>
                    <td>${farm.name}</td>
                    <td>${farm.location}</td>
                    <td>${farm.cropType}</td>
                    <td>${farm.area}</td>
                    <td>${farm.totalProduction?.toLocaleString() || '0'} total</td>
                    <td>${currencySymbols[userCurrency]}${(farm.potentialIncome || 0).toFixed(2)}</td>
                    <td>${farm.progress}%</td>
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
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(reportHTML);
      printWindow.document.close();
    }
  };

  // Calculate stats for overview (only farms, not fields)
  // Use only API data, no mock data fallback
  const displayFarms = myFarms;

  const totalFarms = displayFarms.length;
  const activeFarms = displayFarms.filter(f => f.status === 'Active').length;
  const totalProduction = displayFarms.reduce((sum, farm) => sum + (farm.totalProduction || 0), 0);
  const totalPotentialIncome = displayFarms.reduce((sum, farm) => sum + (farm.totalPotentialIncome || 0), 0);
  const totalOccupiedAreaM2 = displayFarms.reduce((sum, farm) => sum + (farm.occupiedAreaM2 || 0), 0);
  const avgProgress = displayFarms.length > 0 ?
    Math.round(displayFarms.reduce((sum, farm) => sum + (farm.progress || 0), 0) / displayFarms.length) : 0;

  // Pagination logic (after displayFarms is defined)
  const totalPages = Math.ceil(displayFarms.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedFarms = showAllFarms ? displayFarms : displayFarms.slice(startIndex, endIndex);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleViewAllClick = () => {
    setShowAllFarms(!showAllFarms);
    setCurrentPage(1);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      p: { xs: 2, sm: 3 }
    }}>
      <Box sx={{
        maxWidth: '1400px',
        mx: 'auto',
        mb: 2
      }}>
        {/* Compact dashboard header */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Farms</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              {pageTab === MY_FARMS_TAB
                ? `${totalFarms} farm${totalFarms !== 1 ? 's' : ''} · ${myFields.length} field${myFields.length !== 1 ? 's' : ''}`
                : 'Create and edit your field listings'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pageTab === MY_FARMS_TAB && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Agriculture sx={{ fontSize: 18 }} />}
                  onClick={handleAddFarmOpen}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: '#93c5fd',
                    color: '#1d4ed8',
                    bgcolor: '#eff6ff',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#dbeafe', borderColor: '#60a5fa' },
                  }}
                >
                  Add farm
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Assessment sx={{ fontSize: 18 }} />}
                  onClick={handleReportClick}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: '#059669',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#047857' },
                  }}
                >
                  Report
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Pill tabs + quick stats */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setPageTab(MY_FARMS_TAB)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                pageTab === MY_FARMS_TAB
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Harvest & ship
            </button>
            <button
              type="button"
              onClick={() => setPageTab(MY_FIELDS_TAB)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                pageTab === MY_FIELDS_TAB
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Create & edit
            </button>
          </div>

          {pageTab === MY_FARMS_TAB && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:min-w-[7rem]">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Farms</div>
                <div className="text-lg font-bold text-slate-900">{totalFarms}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:min-w-[7rem]">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Fields</div>
                <div className="text-lg font-bold text-slate-900">{myFields.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:min-w-[7rem]">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Active farms</div>
                <div className="text-lg font-bold text-emerald-700">{activeFarms}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:min-w-[8rem]">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Potential</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(totalPotentialIncome)}</div>
              </div>
            </div>
          )}
        </div>

        {pageTab === MY_FIELDS_TAB && (
          <FarmerOwnedFieldsSection onFieldsChanged={fetchFarms} />
        )}

        {pageTab === MY_FARMS_TAB && (
        <>
        <FarmHarvestDashboard
          farms={displayFarms}
          fields={myFields}
          farmerOrders={farmerOrdersList}
          onRefresh={fetchFarms}
          onOpenFarmDetail={handleFarmClick}
        />

        <details className="mb-4 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-slate-600">
            Farm cards (optional)
          </summary>
          <div className="border-t border-slate-100 p-3">
        <div className="mb-3 grid max-w-[480px] grid-cols-2 gap-3 md:max-w-none md:grid-cols-4">
          <StatCard
            icon={<Agriculture sx={{ fontSize: 20 }} />}
            iconBg="#dbeafe"
            iconColor="#1d4ed8"
            value={totalFarms}
            label="Total Farms"
          />
          <StatCard
            icon={<TrendingUp sx={{ fontSize: 20 }} />}
            iconBg="#dcfce7"
            iconColor="#16a34a"
            value={activeFarms}
            label="Active Farms"
          />
          <StatCard
            icon={<Assessment sx={{ fontSize: 20 }} />}
            iconBg="#ffedd5"
            iconColor="#ea580c"
            value={`${totalProduction.toLocaleString()} total`}
            label="Total Production"
          />
          <StatCard
            icon={<AttachMoney sx={{ fontSize: 20 }} />}
            iconBg="#dcfce7"
            iconColor="#059669"
            value={formatCurrency(totalPotentialIncome)}
            label="Potential Income"
          />
        </div>

        {/* Farms List - Tailwind cards */}
        <div className="grid w-full gap-4 sm:grid-cols-2 md:grid-cols-3">
          {displayedFarms.map((farm) => (
            <div
              key={farm.id}
              onClick={() => handleFarmClick(farm)}
              className="flex h-[400px] min-h-[400px] max-h-[400px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex h-full w-full flex-col p-3 box-border">
                {/* Top Section */}
                <div className="w-full min-w-0">
                  {/* Header: name + location + edit */}
                  <div className="mb-1 flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div
                        className="mb-0.5 truncate text-[1.05rem] font-semibold text-slate-900"
                        title={farm.name}
                      >
                        {farm.name || 'Unnamed Farm'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 min-w-0">
                        <LocationOn sx={{ fontSize: 16, color: '#6b7280', flexShrink: 0 }} />
                        <span className="truncate">{farm.location}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditFarm(farm); }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        title="Edit farm"
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFarm(farm);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          farmAllowsDelete(farm, farmerOrdersList, fieldIdToFarmIdMap)
                            ? 'Delete farm'
                            : 'Farm must have no fields and no pending/active orders'
                        }
                        disabled={!farmAllowsDelete(farm, farmerOrdersList, fieldIdToFarmIdMap)}
                      >
                        <DeleteOutline sx={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mb-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[0.7rem] font-semibold text-emerald-700">
                      {farm.status}
                    </span>
                  </div>

                  {/* Farm details rows */}
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-1">
                      <Park sx={{ fontSize: 16, color: '#10b981' }} />
                      <span className="text-slate-600">Crop Type</span>
                      <span className="ml-auto font-semibold text-slate-900">{farm.cropType || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Terrain sx={{ fontSize: 16, color: '#8b5cf6' }} />
                      <span className="text-slate-600">Fields</span>
                      <span className="ml-auto font-semibold text-slate-900">
                        {farm.totalAreaM2 > 0 
                          ? `${Math.round(farm.totalAreaM2).toLocaleString()} / ${Math.round(farm.farmAreaM2 || farm.areaValue || 0).toLocaleString()} m²`
                          : `${farm.areaValue || 0} ${farm.areaUnit || 'm²'}`
                        }
                      </span>
                    </div>
                    {farm.plantingDate && (
                      <div className="flex items-center gap-1">
                        <CalendarToday sx={{ fontSize: 16, color: '#059669' }} />
                        <span className="text-slate-600">Planted</span>
                        <span className="ml-auto font-semibold text-slate-900">
                          {new Date(farm.plantingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {farm.harvestDates?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Agriculture sx={{ fontSize: 16, color: '#d97706' }} />
                        <span className="text-slate-600">Harvest</span>
                        <span className="ml-auto font-semibold text-slate-900">
                          {farm.harvestDates.length === 1 
                            ? new Date(farm.harvestDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : `${farm.harvestDates.length} dates`
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Production & Income stats */}
                  {farm.totalProduction > 0 || farm.totalPotentialIncome > 0 ? (
                    <div className="mb-3 flex gap-2">
                      {farm.totalProduction > 0 && (
                        <div className="flex-1 rounded-lg bg-amber-50 p-2 text-center">
                          <div className="text-xs text-slate-500">Production</div>
                          <div className="text-sm font-bold text-amber-700">{farm.totalProduction.toLocaleString()} total</div>
                        </div>
                      )}
                      {farm.totalPotentialIncome > 0 && (
                        <div className="flex-1 rounded-lg bg-emerald-50 p-2 text-center">
                          <div className="text-xs text-slate-500">Income</div>
                          <div className="text-sm font-bold text-emerald-700">{formatCurrency(farm.totalPotentialIncome)}</div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Fields coverage progress */}
                  <div className="mb-3">
                    <div className="mb-1.5 text-sm font-medium text-slate-700">Fields Coverage</div>
                    <div className="h-2 w-full rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all"
                        style={{ width: `${farm.progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs font-semibold text-slate-800">
                      {farm.progress}%
                    </div>
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold text-slate-900">
                        {farm.totalPotentialIncome > 0 ? formatCurrency(farm.totalPotentialIncome) : formatCurrency(0)}
                      </div>
                      <div className="text-xs text-slate-500">Potential Income</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFarmClick(farm);
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
                    >
                      <Visibility sx={{ fontSize: 16 }} />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {displayFarms.length > itemsPerPage && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 4 }}>
            {!showAllFarms ? (
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
                      fontWeight: 600
                    }
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Showing {startIndex + 1}-{Math.min(endIndex, displayFarms.length)} of {displayFarms.length} farms
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
                      bgcolor: '#f8fafc'
                    }
                  }}
                >
                  View All Farms ({displayFarms.length})
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
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                Show Paginated View
              </Button>
            )}
          </Box>
        )}
          </div>
        </details>

        {/* Farm Detail Modal - Tailwind overlay */}
        {farmDetailOpen && selectedFarm && (
          <div
            className="fixed inset-0 z-50 flex justify-center bg-black/40"
            style={{
              alignItems: 'flex-start',
              paddingTop: 'calc(var(--app-header-height, 64px) + 12px)',
            }}
          >
            <div className="max-h-[calc(90vh-var(--app-header-height,64px))] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl md:p-6">
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedFarm.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Farm details &amp; affiliated fields
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectedFarm && openEditFarm(selectedFarm)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    title="Edit farm"
                  >
                    <EditIcon sx={{ fontSize: 18 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedFarm && handleDeleteFarm(selectedFarm)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      selectedFarm && farmAllowsDelete(selectedFarm, farmerOrdersList, fieldIdToFarmIdMap)
                        ? 'Delete farm'
                        : 'Farm must have no fields and no pending/active orders'
                    }
                    disabled={!selectedFarm || !farmAllowsDelete(selectedFarm, farmerOrdersList, fieldIdToFarmIdMap)}
                  >
                    <DeleteOutline sx={{ fontSize: 18 }} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseFarmDetail}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    <Close sx={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>

              {/* Farm info + metrics */}
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="flex min-height-[80px] flex-col rounded-xl bg-slate-50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Farm Information
                  </h3>
                  <div className="flex flex-1 flex-col gap-1.5 text-sm text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <LocationOn sx={{ fontSize: 18, color: '#3b82f6' }} />
                      <span>{selectedFarm.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Park sx={{ fontSize: 18, color: '#10b981' }} />
                      <span>{selectedFarm.cropType}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Terrain sx={{ fontSize: 18, color: '#8b5cf6' }} />
                      <span>
                        {selectedFarm.areaValue} {selectedFarm.areaUnit} • {selectedFarm.soilType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <WaterDrop sx={{ fontSize: 18, color: '#06b6d4' }} />
                      <span>{selectedFarm.irrigationType}</span>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[80px] flex-col rounded-xl bg-emerald-50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Performance Metrics
                  </h3>
                  <div className="flex flex-1 flex-col justify-between gap-3 text-sm">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Fields Coverage</span>
                        <span className="font-semibold text-slate-900">
                          {selectedFarm.progress}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${selectedFarm.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Total Production</span>
                      <span className="text-sm font-semibold text-amber-600">
                        {selectedFarm.totalProduction?.toLocaleString() || '0'} total
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Potential Income</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(selectedFarm.totalPotentialIncome || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Status</span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-1 text-[0.7rem] font-semibold"
                        style={{
                          backgroundColor:
                            selectedFarm.status === 'Active' ? '#22c55e' : '#e5e7eb',
                          color:
                            selectedFarm.status === 'Active' ? '#ffffff' : '#374151',
                        }}
                      >
                        {selectedFarm.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fields on this farm */}
              <div className="mt-4">
                <h3 className="mb-1 text-base font-bold text-slate-900">
                  Fields on this farm
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Status and next step for each field — harvest, ship, or list again.
                </p>
                <div className="space-y-3">
                  {myFields.filter((field) => field.farm_id === selectedFarm?.id).length > 0 ? (
                    myFields
                      .filter((field) => field.farm_id === selectedFarm?.id)
                      .map((field) => (
                        <FarmerFieldStatusCard
                          id={`my-farm-field-${field.id}`}
                          key={field.id}
                          field={field}
                          farmerOrders={farmerOrdersList}
                          highlighted={String(highlightFieldId) === String(field.id)}
                          onFieldUpdated={async (updated) => {
                            try {
                              const fieldsRes = await fieldsService.getAll();
                              const raw = fieldsRes.data || [];
                              setMyFields((prev) =>
                                prev.map((f) => {
                                  const row = raw.find((r) => String(r.id) === String(f.id));
                                  if (!row && String(updated?.id) !== String(f.id)) return f;
                                  const src = row || updated || {};
                                  const harvestDates = src.harvest_dates
                                    ? (Array.isArray(src.harvest_dates)
                                      ? src.harvest_dates.map((h) => (typeof h === 'object' ? h.date : h))
                                      : [src.harvest_dates])
                                    : f.harvestDates;
                                  return {
                                    ...f,
                                    operational_status: src.operational_status || f.operational_status,
                                    totalProduction: src.total_production != null
                                      ? parseFloat(src.total_production)
                                      : f.totalProduction,
                                    totalProductionUnit: src.total_production_unit || f.totalProductionUnit,
                                    price: src.price != null ? parseFloat(src.price) : f.price,
                                    harvestDates: harvestDates || f.harvestDates,
                                    harvestDate: (harvestDates && harvestDates[0]) || f.harvestDate,
                                    last_season_yield: src.last_season_yield ?? f.last_season_yield,
                                    last_season_yield_unit: src.last_season_yield_unit ?? f.last_season_yield_unit,
                                    available_area_m2: src.available_area_m2 ?? f.available_area_m2,
                                    available_area: src.available_area ?? f.available_area,
                                    quantity_sell_percent: src.quantity_sell_percent ?? f.quantity_sell_percent,
                                    shipping_destinations: src.shipping_destinations ?? f.shipping_destinations,
                                    shipping_scope: src.shipping_scope ?? f.shipping_scope,
                                    shipping_option: src.shipping_option ?? f.shipping_option,
                                    shipping_pickup: src.shipping_pickup ?? f.shipping_pickup,
                                    shipping_delivery: src.shipping_delivery ?? f.shipping_delivery,
                                  };
                                })
                              );
                            } catch {
                              /* ignore */
                            }
                          }}
                          onDelete={() => handleDeleteFieldCard(field)}
                          deleteDisabled={fieldBlocksDeletion(field, farmerOrdersList)}
                          deleteTitle={
                            fieldBlocksDeletion(field, farmerOrdersList)
                              ? 'Cannot remove while buyers still have an open order'
                              : 'Remove this field'
                          }
                        />
                      ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      No fields on this farm yet. Use <strong>Create & edit fields</strong> to add one.
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedFarm.description && (
                <div className="mt-4">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">
                    Description
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {selectedFarm.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Farm Report Modal */}
        <Dialog
          open={reportOpen}
          onClose={handleCloseReport}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: '90vh'
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  Farms Report
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Comprehensive overview of your farms
                </Typography>
              </Box>
              <IconButton onClick={handleCloseReport} sx={{ color: '#64748b' }}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Box>
              {/* Summary Statistics */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                      {totalFarms}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Farms
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, backgroundColor: '#f0fdf4', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
                      {activeFarms}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Farms
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
                      {formatCurrency(totalPotentialIncome)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Potential Income
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Farms Summary Table */}
              <Paper sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                  Farms Summary
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Farm Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Crop Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Production</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Income</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Occupied</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayFarms.map((farm) => (
                        <TableRow key={farm.id}>
                          <TableCell>{farm.name}</TableCell>
                          <TableCell>{farm.location}</TableCell>
                          <TableCell>{farm.cropType}</TableCell>
                          <TableCell>
                            {farm.totalAreaM2 > 0 
                              ? `${Math.round(farm.occupiedAreaM2).toLocaleString()} / ${Math.round(farm.totalAreaM2).toLocaleString()} m²`
                              : `${farm.areaValue || 0} ${farm.areaUnit || 'm²'}`
                            }
                          </TableCell>
                          <TableCell>{farm.totalProduction?.toLocaleString() || '0'} total</TableCell>
                          <TableCell>{formatCurrency(farm.totalPotentialIncome || 0)}</TableCell>
                          <TableCell>{farm.progress}%</TableCell>
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
            <Button
              onClick={() => handleDownloadReport('csv')}
              variant="outlined"
              startIcon={<Download />}
              sx={{ borderRadius: 1.5 }}
            >
              Download CSV
            </Button>
            <Button
              onClick={() => handleDownloadReport('pdf')}
              variant="outlined"
              startIcon={<Description />}
              sx={{ borderRadius: 1.5 }}
            >
              Download PDF
            </Button>
            <Button onClick={handleCloseReport} variant="contained" sx={{ borderRadius: 1.5, bgcolor: '#4caf50', color: '#ffffff', '&:hover': { bgcolor: '#059669' } }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
        </>
        )}
      </Box>
      <AddFarmForm
        open={addFarmOpen}
        onClose={handleAddFarmClose}
        onSubmit={handleAddFarmSubmit}
        editMode={!!editingFarm}
        initialData={editingFarm}
      />
    </Box>
  );
};

export default MyFarms;
