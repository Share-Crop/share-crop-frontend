import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, useLocation, useSearchParams } from 'react-router-dom';
import {
  Box,
  // Tabs,
  // Tab,
} from '@mui/material';
import EnhancedFarmMap from '../components/Map/EnhancedFarmMap';
import AddFieldForm from '../components/Forms/AddFieldForm';
// import { storageService } from '../services/storage'; // Remove storageService import
import EnhancedHeader from '../components/Layout/EnhancedHeader';
import NotificationSystem from '../components/Notification/NotificationSystem';
import CreateFieldForm from '../components/Forms/CreateFieldForm';
import AddFarmForm from '../components/Forms/AddFarmForm';
import useNotifications from '../hooks/useNotifications';
import { cachedReverseGeocode } from '../utils/geocoding';
import { useAuth } from '../contexts/AuthContext';
import RentedFields from './RentedFields';
import MyFarms from './MyFarms';
import Orders from './Orders';
import FarmOrders from './FarmOrders';
import LicenseInfo from './LicenseInfo';
import Transaction from './Transaction';
import BuyCoins from './BuyCoins';
import RedeemCoins from './RedeemCoins';
import RedemptionHistory from './RedemptionHistory';
import PayoutMethods from './PayoutMethods';
import Profile from './Profile';
import Messages from './Messages';
import ChangeCurrency from './ChangeCurrency';
import Settings from './Settings';
import Notifications from './Notifications';
import Complaints from './Complaints';
import api from '../services/api'; // Changed to default import
import coinService from '../services/coinService';
import supabase from '../services/supabase';
import { v4 as uuidv4 } from 'uuid';
import { userDocumentsService } from '../services/userDocuments';
import fieldsService from '../services/fields';

const FarmerView = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const {
    addNotification,
    notifications,
    backendNotifications,
    removeNotification,
    markNotificationAsRead,
    fetchBackendNotifications
  } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [farmsList, setFarmsList] = useState([]);
  const [fields, setFields] = useState([]);
  const [filteredFields, setFilteredFields] = useState([]);
  const [mapFilters, setMapFilters] = useState({ categories: [], subcategories: [] });
  const [products, setProducts] = useState([]);
  const [createFarmOpen, setCreateFarmOpen] = useState(false);
  const [createFieldOpen, setCreateFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldToZoom, setFieldToZoom] = useState(null);
  const mapRef = useRef(null);
  const headerRef = useRef(null);
  const isMapPage = location.pathname === '/farmer' || location.pathname === '/farmer/';

  // No need to force role - use actual logged-in user

  // Initialize user coins when user is available
  useEffect(() => {
    if (user && user.id) {
      coinService.initializeUserCoins(user.id);
    }
  }, [user]);

  // Combine farms and fields for the map
  const combinedMapData = fields; // Use stable reference to avoid unnecessary re-renders

  // Debug logging for field data

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          const farmsResponse = await api.get(`/api/farms?owner_id=${user.id}`); // Filter by owner to show only farmer's farms

          // Map database field names to frontend expected names
          const mappedFarms = farmsResponse.data
            .filter(farm => farm && farm.id) // Only include farms with valid id
            .map(farm => ({
              ...farm,
              farmName: farm.farm_name,
              farmIcon: farm.farm_icon
            }));
          setFarmsList(mappedFarms);

          // Load ALL fields for map display (not filtered by user)
          const fieldsResponse = await fieldsService.getAllForMap();


          // Map database field names to frontend expected names
          const mappedFields = fieldsResponse.data
            .filter(field => field && field.id) // Only include fields with valid id
            .map(field => ({
              ...field,
              harvestDates: field.harvest_dates, // Map harvest_dates to harvestDates
              pricePerM2: field.price_per_m2, // Map price_per_m2 to pricePerM2
              fieldSize: field.field_size, // Map field_size to fieldSize
              productionRate: field.production_rate, // Map production_rate to productionRate
              location: field.location,
              shippingScope: field.shipping_scope
            }));
          setFields(mappedFields);
          setFilteredFields(mappedFields);

        } catch (error) {
          console.error('Error loading data:', error);
          console.error('Error details:', error.response?.data || error.message);
          addNotification(`Error loading data: ${error.response?.data || error.message}`, 'error');
        }
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id, not addNotification which changes on every render

  // Handle delayed zoom to newly created fields
  useEffect(() => {
    if (fieldToZoom && mapRef.current && mapRef.current.zoomToFarm) {
      // Use a small delay to ensure the map component has processed the new field
      const timer = setTimeout(() => {
        mapRef.current.zoomToFarm(fieldToZoom, true);
        setFieldToZoom(null); // Clear the field to zoom
      }, 100); // Small delay to allow map component to update

      return () => clearTimeout(timer);
    }
  }, [fieldToZoom, fields]); // Depend on fields to trigger after state update

  // Handle field_id from URL params to zoom to field
  useEffect(() => {
    const fieldId = searchParams.get('field_id');
    if (fieldId && mapRef.current) {
      // Find the field in the loaded fields
      const field = fields.find(f => String(f.id) === String(fieldId));
      if (field) {
        const coordinates = field.coordinates ||
          (field.longitude && field.latitude
            ? [field.longitude, field.latitude]
            : null);
        if (coordinates) {
          // Small delay to ensure map is ready
          const timer = setTimeout(() => {
            if (mapRef.current && mapRef.current.zoomToFarm) {
              // Convert field to farm format expected by zoomToFarm
              const farmData = {
                ...field,
                coordinates
              };
              mapRef.current.zoomToFarm(farmData, true);
              // Clear the URL parameter after zooming
              setSearchParams({});
            }
          }, 500);
          return () => clearTimeout(timer);
        }
      } else if (fieldId) {
        // Field not found in loaded fields, try fetching it
        fieldsService.getById(fieldId)
          .then(response => {
            const fetchedField = response.data;
            if (fetchedField && mapRef.current && mapRef.current.zoomToFarm) {
              const coordinates = fetchedField.coordinates ||
                (fetchedField.longitude && fetchedField.latitude
                  ? [fetchedField.longitude, fetchedField.latitude]
                  : null);
              if (coordinates) {
                const farmData = {
                  ...fetchedField,
                  coordinates
                };
                mapRef.current.zoomToFarm(farmData, true);
                setSearchParams({});
              }
            }
          })
          .catch(err => {
            console.error('Failed to fetch field:', err);
          });
      }
    }
  }, [searchParams, fields, setSearchParams]);

  const handleSearchChange = (query, filtered) => {
    setSearchQuery(query);
    if (Array.isArray(filtered)) {
      setFilteredFields(filtered);
    }
  };

  const handleHeaderFilterApply = (filters) => {
    setMapFilters({
      categories: Array.isArray(filters?.categories) ? filters.categories : [],
      subcategories: Array.isArray(filters?.subcategories) ? filters.subcategories : [],
    });
  };

  const handleFarmSelect = (farm) => {
    if (mapRef.current && mapRef.current.zoomToFarm) {
      mapRef.current.zoomToFarm(farm);
    }
  };



  const handleCoinRefresh = () => {
    if (headerRef.current && headerRef.current.refreshCoins) {
      headerRef.current.refreshCoins();
    }
  };

  const handleCreateField = () => {
    setCreateFieldOpen(true);
  };

  const handleCreateFarm = () => {
    setCreateFarmOpen(true);
  };

  const handleCreateFarmClose = () => {
    setCreateFarmOpen(false);
  };

  // const handleCreateFieldClose = () => {
  //   setCreateFieldOpen(false);
  // };

  const handleEditField = (field) => {
    setEditingField(field);
    setCreateFieldOpen(true);
  };

  const handleFarmSubmit = async (formData) => {
    try {
      // Debug logging

      const newFarm = {
        name: formData.farmName,
        location: formData.location,
        owner_id: user.id, // Assuming user.id is available from AuthContext
        farmIcon: formData.farmIcon,
        coordinates: formData.coordinates,
        webcamUrl: formData.webcamUrl,
        description: formData.description,
      };

      const response = await api.post('/api/farms', newFarm);
      const createdFarm = response.data;

      // Ensure the created farm has the correct structure for the dropdown
      // Backend returns snake_case (farm_name, farm_icon) but frontend expects camelCase
      const farmForList = {
        id: createdFarm.id,
        farmName: createdFarm.farm_name || createdFarm.name || createdFarm.farmName,
        name: createdFarm.farm_name || createdFarm.name || createdFarm.farmName,
        location: createdFarm.location,
        farmIcon: createdFarm.farm_icon || createdFarm.farmIcon,
        coordinates: createdFarm.coordinates,
        webcamUrl: createdFarm.webcam_url || createdFarm.webcamUrl,
        description: createdFarm.description,
        owner_id: createdFarm.owner_id
      };


      setFarmsList(prevFarms => {
        const updatedFarms = [...prevFarms, farmForList];
        return updatedFarms;
      });

      // Handle License Upload
      if (formData.licenseFile) {
        try {
          const file = formData.licenseFile;
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

          addNotification('New Farm Created & License Uploaded', 'success');
        } catch (uploadErr) {
          console.error('Error uploading license:', uploadErr);
          addNotification('Farm Created, but License Upload Failed', 'warning');
        }
      } else {
        addNotification('New Farm Created', 'success');
      }

      setCreateFarmOpen(false);
    } catch (error) {
      console.error('Error creating farm:', error);
      addNotification('Error creating farm', 'error');
    }
  };

  const handleFieldSubmit = async (formData) => {
    let fieldToZoom = null;
    try {
      if (editingField) {
        // Update existing field
        const updatedField = { ...editingField, ...formData, shipping_scope: formData.shippingScope };
        const response = await api.put(`/api/fields/${editingField.id}`, updatedField);

        // Map the response data to frontend format
        const mappedField = {
          ...response.data,
          harvestDates: response.data.harvest_dates,
          pricePerM2: response.data.price_per_m2,
          fieldSize: response.data.field_size,
          productionRate: response.data.production_rate,
          location: response.data.location,
          shippingScope: response.data.shipping_scope,
        };

        const mappedFieldWithSubcategory = {
          ...mappedField,
          subcategory: formData.subcategory ?? editingField.subcategory ?? null,
        };

        setFields(prevFields => prevFields.map(field => field.id === editingField.id ? mappedFieldWithSubcategory : field));
        addNotification(`Your field "${formData.productName}" has been updated successfully.`, 'success');
        fieldToZoom = mappedFieldWithSubcategory;
      } else {
        // Create a new field
        const longitude = parseFloat(formData.longitude);
        const latitude = parseFloat(formData.latitude);

        let actualLocation = 'Unknown Location';
        try {
          if (!isNaN(latitude) && !isNaN(longitude)) {
            actualLocation = await cachedReverseGeocode(latitude, longitude);
          }
        } catch (error) {
          console.error('Failed to get location:', error);
          actualLocation = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }

        const newField = {
          name: formData.productName,
          description: formData.description,
          category: formData.subcategory || formData.category, // Use subcategory for product icon mapping
          subcategory: formData.subcategory || null,
          price: formData.price || 0, // Use the price calculated by the form
          price_per_m2: formData.price_per_m2 || 0, // Use the price_per_m2 calculated by the form
          unit: formData.fieldSizeUnit,
          quantity: parseFloat(formData.sellingAmount) || 0,
          coordinates: [
            !isNaN(longitude) ? longitude : 8.5417,
            !isNaN(latitude) ? latitude : 47.3769,
          ],
          location: actualLocation,
          image: formData.imagePreview || formData.image || '/api/placeholder/300/200',
          farm_id: formData.farmId, // Use farm_id for backend
          owner_id: user.id,
          farmer_name: user?.name || '',
          isOwnField: true,
          available: true,
          rating: 0,
          reviews: 0,
          field_size: formData.fieldSize,
          field_size_unit: formData.fieldSizeUnit,
          production_rate: formData.productionRate,
          production_rate_unit: formData.productionRateUnit,
          harvest_dates: formData.harvestDates || [],
          shipping_option: formData.shippingOption,
          delivery_charges: typeof formData.deliveryCharges === 'number' ? formData.deliveryCharges : 0,
          has_webcam: formData.hasWebcam,
          area_m2: formData.fieldSize,
          available_area: formData.fieldSize,
          total_area: formData.fieldSize,
          weather: 'Sunny',
          shipping_scope: formData.shippingScope,
        };

        const response = await api.post('/api/fields', newField);

        // Map the response data to frontend format
        const mappedField = {
          ...response.data,
          harvestDates: response.data.harvest_dates,
          pricePerM2: response.data.price_per_m2,
          fieldSize: response.data.field_size,
          productionRate: response.data.production_rate,
          location: response.data.location || actualLocation,
          shippingScope: response.data.shipping_scope,
          // Ensure coordinates exist for map markers
          coordinates: response.data.coordinates ?? (
            response.data.longitude != null && response.data.latitude != null
              ? [response.data.longitude, response.data.latitude]
              : undefined
          ),
        };

        const createdFieldWithSubcategory = {
          ...mappedField,
          // Preserve category and subcategory from form data for proper icon display
          category: formData.subcategory || formData.category,
          subcategory: formData.subcategory || null,
        };

        setFields(prevFields => [...prevFields, createdFieldWithSubcategory]);
        addNotification(`New product "${formData.productName}" has been created and is now visible on the map!`, 'success');
        setFieldToZoom(createdFieldWithSubcategory);
      }
    } catch (error) {
      console.error('Error submitting field:', error);
      addNotification('Error submitting field', 'error');
    }

    setCreateFieldOpen(false);
    setEditingField(null);

    if (mapRef.current && mapRef.current.zoomToFarm && fieldToZoom) {
      mapRef.current.zoomToFarm(fieldToZoom, true);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>

      <EnhancedHeader
        ref={headerRef}
        onSearchChange={handleSearchChange}
        onFilterApply={handleHeaderFilterApply}
        fields={fields}
        onFarmSelect={handleFarmSelect}
        userType="farmer"
        user={user}
        onLogout={logout}
        onCreateField={handleCreateField}
        onCreateFarm={handleCreateFarm}
        backendNotifications={backendNotifications}
        onMarkNotificationAsRead={markNotificationAsRead}
        onRefreshNotifications={fetchBackendNotifications}
      />

      <Box sx={{
        flexGrow: 1,
        mt: 'var(--app-header-height)',
        height: 'calc(100vh - var(--app-header-height))',
        overflow: (isMapPage || location.pathname === '/farmer/messages') ? 'hidden' : 'auto',
        position: 'relative',
        zIndex: 0,
        isolation: 'isolate'
      }}>
        <Routes>
          <Route path="/" element={
            <EnhancedFarmMap
              ref={mapRef}
              onProductSelect={handleFarmSelect}
              userType="farmer"
              searchQuery={searchQuery}
              onNotification={addNotification}
              onNotificationRefresh={fetchBackendNotifications}
              onCoinRefresh={handleCoinRefresh}
              farms={farmsList}
              fields={fields}
              products={products}
              onEditField={handleEditField}
              onFieldCreate={handleCreateField}
              filters={mapFilters}
            />
          } />
          <Route path="/add-field" element={
            <Box sx={{ p: 3 }}>
              <AddFieldForm
                onClose={() => window.history.back()}
                farms={farmsList}
              />
            </Box>
          } />
          <Route path="/my-fields" element={
            <Box sx={{ p: 3 }}>
              <h2>My Fields</h2>
              {fields.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <p>You haven't added any fields yet.</p>
                  <button
                    onClick={() => window.location.href = '/farmer/add-field'}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginTop: '16px'
                    }}
                  >
                    Add Your First Field
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {fields.map(field => (
                    <div key={field.id} style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{ margin: '0 0 12px 0', color: '#1f2937' }}>{field.name}</h3>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Category:</strong> {field.category}
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Price:</strong> ${field.price}/unit
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Area:</strong> {field.field_size} {field.field_size_unit}
                      </div>
                      {field.location && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Location:</strong> {field.location}
                        </div>
                      )}
                      {field.description && (
                        <div style={{ marginTop: '12px', color: '#6b7280', fontSize: '14px' }}>
                          {field.description}
                        </div>
                      )}
                      <div style={{
                        marginTop: '16px',
                        padding: '8px 12px',
                        background: field.available ? '#dcfce7' : '#fef3c7',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: field.available ? '#166534' : '#92400e'
                      }}>
                        {field.available ? 'Available for Purchase' : 'Sold'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Box>
          } />
          <Route path="/rented-fields" element={<RentedFields />} />
          <Route path="/my-farms" element={<MyFarms />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/farm-orders" element={<FarmOrders />} />
          <Route path="/license-info" element={<LicenseInfo />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route path="/buy-coins" element={<BuyCoins />} />
          <Route path="/redeem-coins" element={<RedeemCoins />} />
          <Route path="/redemption-history" element={<RedemptionHistory />} />
          <Route path="/payout-methods" element={<PayoutMethods />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/currency" element={<ChangeCurrency />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/complaints" element={<Complaints />} />
        </Routes>
      </Box>

      {/* Notification System */}
      <NotificationSystem
        notifications={notifications}
        onRemove={removeNotification}
      />

      {/* Create Field Form Dialog */}
      <CreateFieldForm
        key={editingField ? `edit-field-${editingField.id || editingField._id}` : `create-field-${farmsList.length}`}
        open={createFieldOpen}
        onClose={() => {
          setCreateFieldOpen(false);
          setEditingField(null);
        }}
        onSubmit={handleFieldSubmit}
        editMode={!!editingField}
        initialData={editingField}
        farmsList={farmsList}
        fieldsList={fields}
      />

      {/* Add Farm Form Dialog */}
      <AddFarmForm
        open={createFarmOpen}
        onClose={handleCreateFarmClose}
        onSubmit={handleFarmSubmit}
      />
    </Box>
  );
};

export default FarmerView;
