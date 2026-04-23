import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api'; // Changed to default import
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../services/supabase';
import { v4 as uuidv4 } from 'uuid';
import { userDocumentsService } from '../../services/userDocuments';

const AddFieldForm = ({ onFieldAdded, onClose, farms }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    crop: '',
    price: '',
    area: '',
    location: '',
    description: '',
    harvestDate: '',
    farmId: '',
    shippingScope: 'Global'
  });

  const [loading, setLoading] = useState(false);

  // State for license check and upload
  const [checkingLicense, setCheckingLicense] = useState(true);
  const [hasLicense, setHasLicense] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [licenseFile, setLicenseFile] = useState(null);

  useEffect(() => {
    checkLicenseStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when user changes
  }, [user]);

  const checkLicenseStatus = async () => {
    if (!user || !user.id) return;

    // Determine status - aligned with AdminUsers logic
    // user.approval_status might be undefined, so fallback to 'pending' if not explicitly approved
    // BUT usually verify logic is: if pending, check docs.
    const status = user.approval_status || (user.is_active ? 'approved' : 'pending');

    // Only check documents if pending
    if (status === 'pending') {
      try {
        setCheckingLicense(true);
        const response = await userDocumentsService.getUserDocuments(user.id);
        const docs = response.data || [];
        // Check if any document looks like a license or if there are any documents at all
        // Assuming any document upload counts as "license uploaded" for this flow based on "not even uploaded liscence doucment"
        setHasLicense(docs.length > 0);
      } catch (error) {
        console.error('Error checking documents:', error);
        // Fallback: assume no license if error
        setHasLicense(false);
      } finally {
        setCheckingLicense(false);
      }
    } else {
      setCheckingLicense(false);
    }
  };

  const handleLicenseFileChange = (e) => {
    if (e.target.files[0]) {
      setLicenseFile(e.target.files[0]);
    }
  };

  const handleLicenseUpload = async () => {
    if (!licenseFile || !user) return;

    try {
      setUploadingLicense(true);
      const file = licenseFile;
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

      setHasLicense(true);
      setLicenseFile(null);
      alert('License uploaded successfully! Please wait for admin approval.');
    } catch (error) {
      console.error('Error uploading license:', error);
      alert('Failed to upload license. Please try again.');
    } finally {
      setUploadingLicense(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!user || !user.id) {
      alert('User not authenticated. Please log in.');
      setLoading(false);
      return;
    }

    try {
      const fieldData = {
        shipping_destinations: [],
        name: formData.name,
        crop: formData.crop,
        price: parseFloat(formData.price),
        area: parseFloat(formData.area),
        location: formData.location,
        description: formData.description,
        harvest_date: formData.harvestDate, // Backend expects snake_case
        farm_id: formData.farmId, // Pass selected farm ID
        owner_id: user.id,
        // Default values for now, can be made dynamic later
        latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
        longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
        image: `/icons/products/${formData.crop.toLowerCase()}.png`,
        category: 'farmer_created',
        shipping_scope: formData.shippingScope
      };

      const response = await api.post('/api/fields', fieldData);
      const newField = response.data;

      if (onFieldAdded) {
        onFieldAdded(newField);
      }

      setFormData({
        name: '',
        crop: '',
        price: '',
        area: '',
        location: '',
        description: '',
        harvestDate: '',
        farmId: '',
        shippingScope: 'Global'
      });

      alert('Field added successfully!');
      if (onClose) onClose();
    } catch (error) {
      console.error('Error adding field:', error);
      alert('Error adding field. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleErrorDirectToFarms = () => {
    if (onClose) onClose();
    navigate('/farmer/my-farms?action=add-farm');
  };

  const cropOptions = [
    'Wheat', 'Corn', 'Rice', 'Soybeans', 'Tomatoes', 'Potatoes',
    'Carrots', 'Lettuce', 'Onions', 'Peppers', 'Apples', 'Oranges'
  ];

  // Helper to determine what to render
  const renderContent = () => {
    const status = user?.approval_status || (user?.is_active ? 'approved' : 'pending');

    // Normal form if approved
    if (status === 'approved') {
      // Check if user has any farms
      if (!farms || farms.length === 0) {
        return (
          <div className="pending-state">
            <div className="status-icon warning">🏠</div>
            <h4>No Farms Found</h4>
            <p>You need to create a farm before you can add any fields.</p>
            <p className="sub-text">Fields must belong to a specific farm.</p>

            <div className="form-actions center">
              <button
                type="button"
                className="submit-btn"
                onClick={handleErrorDirectToFarms}
              >
                Create My First Farm
              </button>
              {onClose && (
                <button type="button" onClick={onClose} className="cancel-btn">
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
      }

      return (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Field Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., North Field, Sunny Acres"
            />
          </div>

          <div className="form-group">
            <label htmlFor="crop">Crop Type *</label>
            <select
              id="crop"
              name="crop"
              value={formData.crop}
              onChange={handleChange}
              required
            >
              <option value="">Select a crop</option>
              {cropOptions.map(crop => (
                <option key={crop} value={crop}>{crop}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price">Price per Unit ($) *</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="area">Area (acres) *</label>
              <input
                type="number"
                id="area"
                name="area"
                value={formData.area}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Iowa, USA"
            />
          </div>

          <div className="form-group">
            <label htmlFor="shippingScope">Shipping Scope *</label>
            <select
              id="shippingScope"
              name="shippingScope"
              value={formData.shippingScope}
              onChange={handleChange}
              required
            >
              <option value="Global">Global</option>
              <option value="Country">Country</option>
              <option value="City">City</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="harvestDate">Expected Harvest Date</label>
            <input
              type="date"
              id="harvestDate"
              name="harvestDate"
              value={formData.harvestDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="farmId">Select Farm *</label>
            <select
              id="farmId"
              name="farmId"
              value={formData.farmId}
              onChange={handleChange}
              required
            >
              <option value="">Select a farm</option>
              {farms.map(farm => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Additional details about the field..."
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Adding Field...' : 'Add Field'}
            </button>
            {onClose && (
              <button type="button" onClick={onClose} className="cancel-btn">
                Cancel
              </button>
            )}
          </div>
        </form>
      );
    }

    if (checkingLicense) {
      return <div className="loading-state">Checking eligibility...</div>;
    }

    // Pending but NO license uploaded
    if (!hasLicense) {
      return (
        <div className="pending-state">
          <div className="status-icon warning">⚠️</div>
          <h4>Action Required</h4>
          <p>Please upload your farming license to be eligible for adding fields.</p>

          <div className="upload-section">
            <label className="file-upload-btn">
              Choose License File
              <input
                type="file"
                hidden
                onChange={handleLicenseFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </label>
            {licenseFile && <span className="file-name">{licenseFile.name}</span>}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="submit-btn"
              disabled={!licenseFile || uploadingLicense}
              onClick={handleLicenseUpload}
            >
              {uploadingLicense ? 'Uploading...' : 'Upload License'}
            </button>
            {onClose && (
              <button type="button" onClick={onClose} className="cancel-btn">
                Close
              </button>
            )}
          </div>
        </div>
      );
    }

    // Pending AND license uploaded
    return (
      <div className="pending-state">
        <div className="status-icon info">ℹ️</div>
        <h4>Verification Pending</h4>
        <p>Please wait for the approval from admin.</p>
        <p className="sub-text">Your license has been uploaded and is under review.</p>

        <div className="form-actions center">
          {onClose && (
            <button type="button" onClick={onClose} className="cancel-btn">
              Close
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="add-field-form">
      <div className="form-header">
        <h3>Add New Field</h3>
        {onClose && (
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {renderContent()}

      <style jsx>{`
        .add-field-form {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          max-width: 600px;
          margin: 0 auto;
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .form-header h3 {
          margin: 0;
          color: #1f2937;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        input, select, textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .form-actions.center {
          justify-content: center;
        }

        .submit-btn {
          flex: 1;
          background: #10b981;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .cancel-btn {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
        }

        /* New Styles for Pending States */
        .loading-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .pending-state {
          text-align: center;
          padding: 20px;
        }

        .status-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .status-icon.warning {
          color: #f59e0b;
        }

        .status-icon.info {
          color: #3b82f6;
        }

        .pending-state h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
          font-size: 1.25rem;
        }

        .pending-state p {
          color: #4b5563;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .pending-state .sub-text {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .upload-section {
          margin: 24px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .file-upload-btn {
          background: white;
          border: 2px dashed #d1d5db;
          color: #4b5563;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-block;
        }

        .file-upload-btn:hover {
          border-color: #10b981;
          color: #10b981;
          background: #f0fdf4;
        }

        .file-name {
          font-size: 0.875rem;
          color: #059669;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .form-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default AddFieldForm;
