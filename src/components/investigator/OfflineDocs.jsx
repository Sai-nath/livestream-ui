import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaArrowLeft, FaFileAlt, FaUpload, FaCamera, FaTrash, FaFileImage, FaFilePdf, FaFileWord, FaFileExcel, FaSpinner, FaCloudUploadAlt, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { uploadDocument } from '../../utils/awss3storage';
import './OfflineDocs.css';

const OfflineDocs = () => {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Use claim data passed from ClaimCard if available
  const [claim, setClaim] = useState(location.state?.claimData || null);
  const [loading, setLoading] = useState(!location.state?.claimData);
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('damage');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentDescription, setDocumentDescription] = useState('');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  // Categories for document uploads
  const categories = [
    { id: 'damage', label: 'Damage Photos' },
    { id: 'inspection', label: 'Inspection Report' },
    { id: 'assessment', label: 'Damage Assessment' },
    { id: 'repair', label: 'Repair Estimate' },
    { id: 'other', label: 'Other Documents' }
  ];

  useEffect(() => {
    // Only fetch claim details if not passed from ClaimCard
    if (!location.state?.claimData) {
      fetchClaimDetails();
    }
    
    // Fetch documents from the API
    fetchDocuments();
  }, [claimId, user.token, location.state]);

  const fetchClaimDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/claims/${claimId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      setClaim(response.data);
    } catch (error) {
      console.error('Error fetching claim details:', error);
      toast.error('Failed to load claim details');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/claims/${claimId}/documents`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        setUploadedFiles(response.data);
      } else {
        // If no documents or API not implemented yet, show empty list
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      // If API endpoint doesn't exist yet, don't show error to user
      if (error.response && error.response.status !== 404) {
        toast.error('Failed to load documents');
      }
      setUploadedFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Create preview URLs for the selected files
    const newSelectedFiles = Array.from(files).map(file => {
      const fileType = file.type;
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let fileIcon;
      
      if (fileType.startsWith('image/')) {
        fileIcon = <FaFileImage />;
      } else if (fileExtension === 'pdf') {
        fileIcon = <FaFilePdf />;
      } else if (['doc', 'docx'].includes(fileExtension)) {
        fileIcon = <FaFileWord />;
      } else if (['xls', 'xlsx'].includes(fileExtension)) {
        fileIcon = <FaFileExcel />;
      } else {
        fileIcon = <FaFileAlt />;
      }
      
      return {
        file,
        name: file.name,
        size: file.size,
        type: fileType,
        icon: fileIcon,
        // Create a preview URL for images
        previewUrl: fileType.startsWith('image/') ? URL.createObjectURL(file) : null
      };
    });
    
    setSelectedFiles(prev => [...prev, ...newSelectedFiles]);
    event.target.value = null; // Reset file input
  };
  
  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      // If it's an image with a preview URL, revoke the object URL to free memory
      if (newFiles[index].previewUrl) {
        URL.revokeObjectURL(newFiles[index].previewUrl);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };
  
  const clearAllSelectedFiles = () => {
    // Revoke all object URLs to free memory
    selectedFiles.forEach(file => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    });
    setSelectedFiles([]);
  };

  const uploadSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.warning('Please select files to upload');
      return;
    }
    
    setUploading(true);
    setCurrentFileIndex(0);
    setTotalFiles(selectedFiles.length);
    
    try {
      // Get claim number from the claim object
      const claimNumber = claim.ClaimNumber || claim.claimNumber || claimId;
      
      // Process each file and upload to S3
      const uploadPromises = selectedFiles.map(async (fileObj, index) => {
        try {
          setCurrentFileIndex(index + 1);
          
          // Upload file to S3
          const result = await uploadDocument(
            claimNumber,
            fileObj.file,
            selectedCategory,
            {
              uploadedBy: user.name || user.email || 'Investigator',
              description: documentDescription,
              claimId: claimId
            },
            (progress) => {
              setUploadProgress(progress);
            }
          );
          
          // After S3 upload, register the document in the backend
          try {
            const docResponse = await axios.post(
              `${import.meta.env.VITE_API_URL}/api/claims/${claimId}/documents`,
              {
                documentUrl: result.url,
                documentKey: result.key,
                fileName: result.fileName,
                fileType: result.fileType,
                fileSize: result.fileSize,
                category: selectedCategory,
                description: documentDescription
              },
              {
                headers: {
                  'Authorization': `Bearer ${user.token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            return docResponse.data || result;
          } catch (apiError) {
            console.warn('Backend API not available, using S3 result directly:', apiError);
            // If the API endpoint doesn't exist yet, just use the S3 upload result
            return result;
          }
        } catch (fileError) {
          console.error(`Error uploading file ${fileObj.name}:`, fileError);
          toast.error(`Failed to upload ${fileObj.name}`);
          return null;
        }
      });
      
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result !== null);
      
      if (successfulUploads.length > 0) {
        // Add the new documents to the existing ones
        setUploadedFiles(prev => [...prev, ...successfulUploads]);
        toast.success(`${successfulUploads.length} document(s) uploaded successfully`);
        setDocumentDescription(''); // Reset description field
        clearAllSelectedFiles(); // Clear selected files after successful upload
      }
    } catch (error) {
      console.error('Error in document upload process:', error);
      toast.error('Document upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentFileIndex(0);
      setTotalFiles(0);
    }
  };

  const handleDeleteDocument = async (documentId, documentKey) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      // First try to delete via API
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/claims/${claimId}/documents/${documentId}`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
      } catch (apiError) {
        console.warn('Backend API not available for document deletion:', apiError);
        // If API fails, we'll still remove from local state
      }
      
      // Remove from state regardless of API success
      setUploadedFiles(prev => prev.filter(doc => 
        (doc.id !== documentId) && (doc.key !== documentKey)
      ));
      
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return <FaFileAlt />;
    
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return <FaFilePdf className="file-icon pdf" />;
    if (type.includes('word') || type.includes('doc')) return <FaFileWord className="file-icon word" />;
    if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return <FaFileExcel className="file-icon excel" />;
    if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') || type.includes('png')) return <FaFileImage className="file-icon image" />;
    
    return <FaFileAlt className="file-icon" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="offline-docs-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading document uploader...</p>
        </div>
      </div>
    );
  }

  // Even if claim details aren't available, still show the upload interface
  return (
    <div className="offline-docs-page">
      <div className="offline-docs-header">
        <button className="back-button" onClick={() => navigate('/investigator/claims')}>
          <FaArrowLeft /> Back to Claims
        </button>
        
        <h1>
          <FaFileAlt className="header-icon" /> 
          Inspection Documents
        </h1>
        
        {claim && (
          <div className="claim-info">
            <span className="claim-number">
              {claim?.ClaimNumber || claim?.claimNumber || claimId}
            </span>
            {claim?.status || claim?.ClaimStatus && (
              <span className={`status-badge ${(claim?.status || claim?.ClaimStatus).toLowerCase()}`}>
                {claim?.status || claim?.ClaimStatus || 'New'}
              </span>
            )}
            {(claim?.vehicleInfo || claim?.VehicleType) && (
              <span className="vehicle-info">
                {claim?.vehicleInfo ? 
                  `${claim.vehicleInfo.make || ''} ${claim.vehicleInfo.model || ''} ${claim.vehicleInfo.year || ''}`.trim() : 
                  `${claim.VehicleType} ${claim.VehicleNumber ? `(${claim.VehicleNumber})` : ''}`.trim()}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="docs-container">
        <div className="docs-tabs">
          <button 
            className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <FaUpload /> Upload Documents
          </button>
          <button 
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <FaFileAlt /> All Documents ({uploadedFiles.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'photos' ? 'active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            <FaCamera /> Photos ({uploadedFiles.filter(doc => doc.category === 'damage').length})
          </button>
        </div>

        <div className="docs-content">
          {activeTab === 'upload' && (
            <div className="upload-section">
              <div className="category-selector">
                <label>Document Category:</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={uploading}
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="description-field">
                <label>Document Description (optional):</label>
                <textarea
                  value={documentDescription}
                  onChange={(e) => setDocumentDescription(e.target.value)}
                  placeholder="Enter a brief description of the document..."
                  disabled={uploading}
                  rows={3}
                />
              </div>

              <div className="file-upload-container">
                <label className={`file-upload-button ${uploading ? 'disabled' : ''}`}>
                  <FaUpload />
                  <span>{uploading ? 'Uploading...' : 'Select Files'}</span>
                  <input 
                    type="file" 
                    multiple 
                    onChange={handleFileSelection} 
                    disabled={uploading}
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                </label>
                <div className="upload-instructions">
                  <p>Supported file types: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX</p>
                  <p>Maximum file size: 20MB per file</p>
                </div>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="selected-files-preview">
                  <div className="preview-header">
                    <h3>Selected Files ({selectedFiles.length})</h3>
                    <button 
                      className="clear-all-btn"
                      onClick={clearAllSelectedFiles}
                      disabled={uploading}
                    >
                      Clear All
                    </button>
                  </div>
                  
                  {/* Image previews for image files */}
                  {selectedFiles.some(file => file.type.startsWith('image/')) && (
                    <div className="image-preview-container">
                      {selectedFiles
                        .filter(file => file.type.startsWith('image/'))
                        .map((file, index) => (
                          <div className="image-preview-item" key={`img-${index}`}>
                            <img src={file.previewUrl} alt={file.name} />
                            <button 
                              className="remove-preview"
                              onClick={() => {
                                const fileIndex = selectedFiles.findIndex(f => f.previewUrl === file.previewUrl);
                                if (fileIndex !== -1) removeSelectedFile(fileIndex);
                              }}
                              disabled={uploading}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                  
                  {/* List of all selected files */}
                  <ul>
                    {selectedFiles.map((file, index) => (
                      <li key={index}>
                        <div className="file-preview">
                          {file.icon}
                          <div className="file-info">
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <button 
                            className="remove-file-btn"
                            onClick={() => removeSelectedFile(index)}
                            disabled={uploading}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="upload-actions">
                    <button 
                      className="upload-btn"
                      onClick={uploadSelectedFiles}
                      disabled={uploading}
                    >
                      <FaCloudUploadAlt /> Upload to Cloud
                    </button>
                  </div>
                </div>
              )}
              
              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    <FaSpinner className="spinner" />
                    <span>
                      Uploading file {currentFileIndex} of {totalFiles}: {uploadProgress}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'photos') && (
            <div className="docs-list">
              {uploadedFiles.length === 0 ? (
                <div className="empty-state">
                  <FaFileAlt className="empty-icon" />
                  <h3>No Documents Found</h3>
                  <p>There are no documents uploaded for this claim yet. Use the Upload tab to add documents.</p>
                </div>
              ) : (
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>Category</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles
                      .filter(doc => activeTab === 'all' || (activeTab === 'photos' && doc.category === 'damage'))
                      .map(doc => (
                        <tr key={doc.id} className="doc-row">
                          <td>
                            <div className="doc-name">
                              {getFileIcon(doc.fileType)}
                              <span>{doc.fileName}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`category-badge ${doc.category}`}>
                              {doc.category}
                            </span>
                          </td>
                          <td>{formatFileSize(doc.fileSize)}</td>
                          <td>
                            <div className="date-info">
                              <span className="date">{formatDate(doc.uploadDate)}</span>
                              <span className="uploader">{doc.uploadedBy}</span>
                            </div>
                          </td>
                          <td>
                            <div className="doc-actions">
                              <button 
                                className="action-btn preview" 
                                title="Preview document"
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                              >
                                <FaFileAlt />
                              </button>
                              <button 
                                className="action-btn delete" 
                                title="Delete document"
                                onClick={() => handleDeleteDocument(doc.id, doc.key)}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineDocs;
