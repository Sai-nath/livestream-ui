import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaClock, FaUserCheck, FaFileAlt, FaCheckCircle, FaUserPlus, FaPlus, FaVideo, FaCamera, FaSearch, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import CreateClaimModal from './CreateClaimModal';
import AssignInvestigatorModal from './AssignInvestigatorModal';
import IncomingCallModal from './IncomingCallModal';
import VideoCall from '../common/VideoCall';
import MediaViewer from './MediaViewer';

const ClaimManagement = () => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('New');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [activeCallData, setActiveCallData] = useState(null);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [claimCounts, setClaimCounts] = useState({
        New: 0,
        Assigned: 0,
        Submitted: 0,
        Closed: 0
    });
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Pagination state
    const [pagination, setPagination] = useState({
        currentPage: 1,
        pageSize: 6,  // Show 6 claims per page (2 rows of 3)
        totalItems: 0,
        totalPages: 1
    });
    
    // Filtering and sorting state
    const [filterText, setFilterText] = useState('');
    const [debouncedFilterText, setDebouncedFilterText] = useState('');
    const [sortBy, setSortBy] = useState('CreatedAt');
    const [sortOrder, setSortOrder] = useState('desc');
    
    // Debounce filter text changes
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilterText(filterText);
        }, 500);
        
        return () => clearTimeout(timer);
    }, [filterText]);
    
    const { trackActivity, isConnected, socket } = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const location = useLocation();

    // Check if we're in media viewing mode
    const isViewingMedia = params.claimId && params.mediaType;

    const tabs = [
        { id: 'New', label: 'New Claims', icon: <FaClock /> },
        { id: 'Assigned', label: 'Assigned', icon: <FaUserCheck /> },
        { id: 'Submitted', label: 'Submitted', icon: <FaFileAlt /> },
        { id: 'Closed', label: 'Closed', icon: <FaCheckCircle /> }
    ];

    const getClaimNumber = (callData) => {
        if (callData?.claimId) return `CLM-${callData.claimId}`;
        if (callData?.ClaimId) return `CLM-${callData.ClaimId}`;
        if (callData?.ClaimNumber) return callData.ClaimNumber;
        return `CLAIM-${Date.now()}`;
    };

    // Use a ref to track if we need to fetch data
    const shouldFetchRef = useRef(true);
    
    // Single useEffect to handle all data fetching
    useEffect(() => {
        // Skip initial fetch when component mounts if we have search results
        if (location.state?.searchResults) {
            setClaims(location.state.searchResults);
            setSearchQuery(location.state.searchQuery);
            setIsSearchMode(true);
            setLoading(false);
            shouldFetchRef.current = false;
            
            // Clear the location state to prevent showing search results after refresh
            navigate(location.pathname, { replace: true });
        } else if (shouldFetchRef.current) {
            // Only fetch if we should (prevents duplicate fetches)
            fetchClaims(activeTab);
            fetchClaimCounts();
        }
        
        // Reset the fetch flag for next dependency change
        shouldFetchRef.current = true;
    }, [location, activeTab, pagination.currentPage, debouncedFilterText]);
    
    // Function to render page number buttons
    const renderPageNumbers = () => {
        const pageNumbers = [];
        const totalPages = pagination.totalPages;
        const currentPage = pagination.currentPage;
        
        // Always show first page
        if (totalPages > 0) {
            pageNumbers.push(
                <button 
                    key={1} 
                    className={`pagination-page-btn ${currentPage === 1 ? 'active' : ''}`}
                    onClick={() => setPagination(prev => ({...prev, currentPage: 1}))}
                    disabled={currentPage === 1}
                >
                    1
                </button>
            );
        }
        
        // Show ellipsis if needed
        if (currentPage > 3) {
            pageNumbers.push(<span key="ellipsis1" className="pagination-ellipsis">...</span>);
        }
        
        // Show pages around current page
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            if (i === 1 || i === totalPages) continue; // Skip first and last pages as they're always shown
            pageNumbers.push(
                <button 
                    key={i} 
                    className={`pagination-page-btn ${currentPage === i ? 'active' : ''}`}
                    onClick={() => setPagination(prev => ({...prev, currentPage: i}))}
                    disabled={currentPage === i}
                >
                    {i}
                </button>
            );
        }
        
        // Show ellipsis if needed
        if (currentPage < totalPages - 2) {
            pageNumbers.push(<span key="ellipsis2" className="pagination-ellipsis">...</span>);
        }
        
        // Always show last page if there's more than one page
        if (totalPages > 1) {
            pageNumbers.push(
                <button 
                    key={totalPages} 
                    className={`pagination-page-btn ${currentPage === totalPages ? 'active' : ''}`}
                    onClick={() => setPagination(prev => ({...prev, currentPage: totalPages}))}
                    disabled={currentPage === totalPages}
                >
                    {totalPages}
                </button>
            );
        }
        
        return pageNumbers;
    };

    // Function to fetch counts for all claim statuses
    const fetchClaimCounts = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/counts`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (!response.ok) {
                console.error('Failed to fetch claim counts');
                return;
            }
            
            const data = await response.json();
            setClaimCounts(data);
        } catch (error) {
            console.error('Error fetching claim counts:', error);
        }
    };

    useEffect(() => {
        if (socket) {
            socket.on('incoming_investigation_call', (callData) => {
                setIncomingCall(callData);
            });

            socket.on('investigation_call_cancelled', (data) => {
                if (incomingCall && incomingCall.callId === data.callId) {
                    setIncomingCall(null);
                }
            });

            socket.on('investigation_call_accepted', (data) => {
                setActiveCall(data.callId);
                setActiveCallData(data);
                setShowVideoCall(true);
            });

            socket.on('call_ended', () => {
                setShowVideoCall(false);
                setActiveCall(null);
                setActiveCallData(null);
                setIncomingCall(null);
            });
        }

        return () => {
            if (socket) {
                socket.off('incoming_investigation_call');
                socket.off('investigation_call_cancelled');
                socket.off('investigation_call_accepted');
                socket.off('call_ended');
            }
        };
    }, [socket, incomingCall]);

    const fetchClaims = async (status) => {
        try {
            setLoading(true);
            setError(null);
            // Map the 'Submitted' tab to 'InvestigationCompleted'
            const statusFilter = status === 'Submitted' ? 'InvestigationCompleted' : status;
            console.log('Fetching claims with status:', statusFilter);
            
            // Build query parameters for pagination, filtering, and sorting
            const queryParams = new URLSearchParams({
                status: statusFilter,
                page: pagination.currentPage,
                limit: pagination.pageSize,
                sortBy: sortBy,
                sortOrder: sortOrder
            });
            
            // Add search/filter parameter if provided
            if (debouncedFilterText && debouncedFilterText.trim() !== '') {
                // Encode the search text to prevent special characters causing issues
                queryParams.append('search', encodeURIComponent(debouncedFilterText.trim()));
            }
            
            // Get the API URL from environment variables
            const apiUrl = import.meta.env.VITE_API_URL;
            console.log('API URL:', apiUrl);
            console.log('Fetching claims with params:', queryParams.toString());
            
            // Ensure we have a valid API URL
            if (!apiUrl) {
                throw new Error('API URL is not defined in environment variables');
            }
            
            // Use different endpoints based on the status and user role
            let endpoint = '/api/claims';
            
            // Use the assigned claims endpoint for the Assigned tab
            if (status === 'Assigned') {
                // For supervisors, use the standard endpoint with status filter
                // For investigators, use the specialized assigned claims endpoint
                if (user.role === 'investigator') {
                    endpoint = '/api/claims/assigned';
                    // For assigned endpoint, we don't need the status parameter
                    queryParams.delete('status');
                }
                // Otherwise keep using the standard endpoint with status filter
            }
            
            // Use a more reliable way to construct the URL
            const url = new URL(endpoint, apiUrl);
            // Append search params to the URL
            url.search = queryParams.toString();
            
            console.log('Full request URL:', url.toString());
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`Failed to fetch claims: ${response.status} ${errorText.substring(0, 100)}`);
            }

            const data = await response.json();
            console.log('API response data:', data);
            
            // Ensure we're working with valid data
            if (!data) {
                console.error('Received null or undefined data from API');
                throw new Error('Invalid data received from server');
            }
            
            // Normalize the data structure to handle different API response formats
            let claimsArray = [];
            let totalItems = 0;
            let currentPage = pagination.currentPage;
            let pageSize = pagination.pageSize;
            let totalPages = 1;
            
            // Handle different response formats
            if (data.data && data.totalItems !== undefined) {
                // Standard paginated response format
                claimsArray = Array.isArray(data.data) ? data.data : [];
                totalItems = data.totalItems || 0;
                currentPage = data.currentPage || 1;
                pageSize = data.pageSize || pagination.pageSize;
                totalPages = data.totalPages || 1;
            } else if (Array.isArray(data)) {
                // Direct array response
                claimsArray = data;
                totalItems = data.length;
                totalPages = Math.ceil(data.length / pageSize) || 1;
            } else if (typeof data === 'object') {
                // Handle case where data is an object but not in expected format
                // Try to extract claims from any property that might be an array
                const possibleArrays = Object.values(data).filter(val => Array.isArray(val));
                if (possibleArrays.length > 0) {
                    // Use the first array found
                    claimsArray = possibleArrays[0];
                    totalItems = claimsArray.length;
                    totalPages = Math.ceil(claimsArray.length / pageSize) || 1;
                } else {
                    // Last resort: try to convert the object to an array if possible
                    console.warn('Unexpected data format:', data);
                    claimsArray = [];
                }
            }
            
            // Ensure claimsArray is always an array to prevent 'sort is not a function' errors
            if (!Array.isArray(claimsArray)) {
                console.error('Claims data is not an array after normalization:', claimsArray);
                claimsArray = [];
            }
            
            // Update state with normalized data
            setClaims(claimsArray);
            setPagination({
                currentPage,
                pageSize,
                totalItems,
                totalPages
            });
            
            // Handle tracking and counts based on the response format
            if (data.data && data.totalItems !== undefined) {
                // For paginated response
                if (data.data.length > 0) {
                    trackActivity('CLAIMS_FETCHED', { status, count: data.totalItems });
                }
                
                // Update the count for the current tab with the total items
                setClaimCounts(prev => ({
                    ...prev,
                    [status]: data.totalItems || 0
                }));
            } else {
                // For non-paginated response
                const claimsArray = Array.isArray(data) ? data : [];
                if (claimsArray.length > 0) {
                    trackActivity('CLAIMS_FETCHED', { status, count: claimsArray.length });
                }
                
                // Update the count for the current tab with the array length
                setClaimCounts(prev => ({
                    ...prev,
                    [status]: claimsArray.length
                }));
            }
        } catch (error) {
            console.error('Error fetching claims:', error);
            setError(error.message);
            setClaims([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignClick = (claim) => {
        setSelectedClaim(claim);
        setShowAssignModal(true);
    };

    const handleAssignComplete = (updatedClaim) => {
        setClaims(prevClaims => 
            prevClaims.map(claim => 
                claim.ClaimId === updatedClaim.ClaimId ? updatedClaim : claim
            )
        );
        setShowAssignModal(false);
        setSelectedClaim(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const getVehicleDisplay = (vehicleNumber, vehicleType) => {
        if (!vehicleNumber && !vehicleType) return 'N/A';
        return vehicleType ? `${vehicleNumber} (${vehicleType})` : vehicleNumber;
    };

    const getStatusBadgeClass = (status) => {
        if (!status) return '';
        
        const normalizedStatus = status.toLowerCase();
        if (normalizedStatus === 'new') return 'new';
        if (normalizedStatus === 'assigned') return 'assigned';
        if (normalizedStatus === 'investigationcompleted' || normalizedStatus === 'submitted') return 'submitted';
        if (normalizedStatus === 'closed') return 'closed';
        
        return '';
    };

    const handleAcceptCall = (call) => {
        socket.emit('accept_investigation_call', {
            callId: call.callId,
            claimId: call.claimId,
            investigatorId: call.investigatorId
        });
        setIncomingCall(null);
    };

    const handleRejectCall = (call, reason) => {
        socket.emit('reject_investigation_call', {
            callId: call.callId,
            investigatorId: call.investigatorId,
            reason
        });
        setIncomingCall(null);
    };

    const handleCloseCall = () => {
        setIncomingCall(null);
    };

    const handleEndCall = () => {
        if (socket && activeCall) {
            socket.emit('end_call', { callId: activeCall });
        }
        setShowVideoCall(false);
        setActiveCall(null);
        setIncomingCall(null);
    };

    const handleViewVideos = (claim) => {
        navigate(`/supervisor/claims/${claim.ClaimId}/media/videos`);
    };

    const handleViewScreenshots = (claim) => {
        navigate(`/supervisor/claims/${claim.ClaimId}/media/screenshots`);
    };

    const handleCloseMediaViewer = () => {
        navigate('/supervisor/claims');
    };

    const clearSearch = () => {
        setIsSearchMode(false);
        setSearchQuery('');
        fetchClaims(activeTab);
    };

    const handleSearchClaims = () => {
        if (!searchQuery.trim()) {
            toast.info('Please enter a claim number to search');
            return;
        }
        
        setLoading(true);
        
        fetch(`${import.meta.env.VITE_API_URL}/api/claims/search?query=${searchQuery}`, {
            headers: {
                'Authorization': `Bearer ${user.token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to search claims');
            }
            return response.json();
        })
        .then(data => {
            setClaims(data);
            setIsSearchMode(true);
            setLoading(false);
            
            if (data.length === 0) {
                toast.info(`No claims found matching "${searchQuery}"`);
            } else {
                toast.success(`Found ${data.length} claim(s) matching "${searchQuery}"`);
            }
        })
        .catch(error => {
            console.error('Error searching claims:', error);
            toast.error('Error searching claims');
            setLoading(false);
        });
    };

    if (showVideoCall && activeCall) {
        // First try to find the claim from the claims array
        const associatedClaim = claims.find(
            claim => claim.ClaimId === incomingCall?.claimId || 
                    (activeCallData && claim.ClaimId === activeCallData.claimId)
        );
        
        // Get the claim number
        const claimNumber = getClaimNumber(associatedClaim || incomingCall || activeCallData);
        
        // Get the claim ID from the associated claim or from the call data
        const claimId = associatedClaim?.ClaimId || 
                        incomingCall?.claimId || 
                        activeCallData?.claimId;

        console.log("VideoCall props:", { 
            role: "supervisor", 
            callId: activeCall, 
            claimNumber, 
            claimId 
        });

        return (
            <div className="video-call-fullscreen">
                <VideoCall
                    role="supervisor"
                    callId={activeCall}
                    socket={socket}
                    onEndCall={handleEndCall}
                    claimNumber={claimNumber}
                    claimId={claimId}
                    user={user}
                />
            </div>
        );
    }

    // Render media viewer if URL params indicate we should
    if (isViewingMedia) {
        return (
            <MediaViewer
                claimId={params.claimId}
                mediaType={params.mediaType}
                onClose={handleCloseMediaViewer}
            />
        );
    }

    return (
        <div className="claims-container">
            {/* Page Header with Title and Actions */}
            <div className="claims-page-header">
                <h1>iNube Live Streaming</h1>
                <div className="header-actions">
                    <button 
                        className="create-claim-btn"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <FaPlus size={14} />
                        <span>Create New Claim</span>
                    </button>
                    <div className="connection-status">
                        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
            </div>
            
            {/* Search Results Banner */}
            {isSearchMode && (
                <div className="search-results-banner">
                    <div className="search-info">
                        <FaSearch />
                        <span>Search results for: <strong>"{searchQuery}"</strong></span>
                        <span className="result-count">({claims.length} results)</span>
                    </div>
                    <button className="clear-search-btn" onClick={clearSearch}>
                        <FaTimes />
                        <span>Clear Search</span>
                    </button>
                </div>
            )}
            
            {/* Tabs Navigation */}
            <div className="dashboard-tabs">
                <div className="claims-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                if (isSearchMode) {
                                    clearSearch();
                                }
                                setActiveTab(tab.id);
                                // Reset pagination when changing tabs
                                setPagination(prev => ({...prev, currentPage: 1}));
                                // Clear filter text
                                setFilterText('');
                            }}
                            className={`tab ${activeTab === tab.id && !isSearchMode ? 'active' : ''}`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {!loading && !isSearchMode && (
                                <span className={`count ${activeTab === tab.id ? 'active' : ''}`}>
                                    {claimCounts[tab.id]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Filter Bar */}
            {!isSearchMode && (
                <div className="filter-bar">
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <FaSearch className="search-icon" size={14} />
                            <input
                                type="text"
                                placeholder="Search claims by number, policy, or customer..."
                                value={filterText}
                                onChange={(e) => {
                                    setFilterText(e.target.value);
                                    // Reset to first page when searching
                                    setPagination(prev => ({...prev, currentPage: 1}));
                                }}
                                className="filter-input"
                            />
                        </div>
                        {filterText && (
                            <button 
                                className="clear-filter-button"
                                onClick={() => {
                                    setFilterText('');
                                    setPagination(prev => ({...prev, currentPage: 1}));
                                    fetchClaims(activeTab);
                                }}
                            >
                                <FaTimes size={14} />
                                <span>Clear</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="sort-container">
                        <select 
                            value={sortBy} 
                            onChange={(e) => {
                                setSortBy(e.target.value);
                                fetchClaims(activeTab);
                            }}
                            className="sort-select"
                        >
                            <option value="CreatedAt">Created Date</option>
                            <option value="ClaimNumber">Claim Number</option>
                            <option value="CustomerName">Customer Name</option>
                            <option value="PolicyNumber">Policy Number</option>
                        </select>
                        <button 
                            className="sort-direction-button"
                            onClick={() => {
                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                fetchClaims(activeTab);
                            }}
                        >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                </div>
            )}

            {/* Claims Content */}
            <div className="claims-content">
                {(() => {
                    if (loading) {
                        return (
                            <div className="loading-state">
                                <div className="loading-spinner"></div>
                                <p>Loading claims...</p>
                            </div>
                        );
                    }

                    if (error) {
                        return (
                            <div className="error-state">
                                <p>Error: {error}</p>
                                <button 
                                    className="retry-btn"
                                    onClick={() => fetchClaims(activeTab)}
                                >
                                    Retry
                                </button>
                            </div>
                        );
                    }

                    if (!Array.isArray(claims) || claims.length === 0) {
                        return (
                            <div className="empty-state">
                                <p>No {activeTab.toLowerCase()} claims found</p>
                            </div>
                        );
                    }

                    return (
                        <div className="claims-grid">
                            <AnimatePresence>
                                {claims.map(claim => (
                                    <motion.div
                                        key={claim.ClaimId}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.2 }}
                                        className="claim-card"
                                    >
                                        <div className="claim-header">
                                            <h3>{claim.ClaimNumber}</h3>
                                            <span className={`status-badge ${getStatusBadgeClass(claim.ClaimStatus)}`}>
                                                {claim.ClaimStatus}
                                            </span>
                                        </div>
                                        <div className="claim-details">
                                            <div className="detail-row">
                                                <span className="label">Vehicle:</span>
                                                <span className="value">{getVehicleDisplay(claim.VehicleNumber, claim.VehicleType)}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label">Policy:</span>
                                                <span className="value">{claim.PolicyNumber || 'N/A'}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="label">Created:</span>
                                                <span className="value">{formatDate(claim.CreatedAt)}</span>
                                            </div>
                                            {claim.SupervisorNotes && (
                                                <div className="claim-notes">
                                                    <span className="label">Notes:</span>
                                                    <p>{claim.SupervisorNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                        {(claim.ClaimStatus === 'New' || claim.ClaimStatus === 'NEW') && (
                                            <div className="claim-actions">
                                                <button 
                                                    className="assign-btn"
                                                    onClick={() => handleAssignClick(claim)}
                                                >
                                                    <FaUserPlus size={14} />
                                                    <span>Assign Investigator</span>
                                                </button>
                                            </div>
                                        )}
                                        {(claim.ClaimStatus === 'InvestigationCompleted') && (
                                            <div className="claim-actions">
                                                <button 
                                                    className="action-btn view-videos-btn"
                                                    onClick={() => handleViewVideos(claim)}
                                                >
                                                    <FaVideo size={14} />
                                                    <span>View Videos</span>
                                                </button>
                                                <button 
                                                    className="action-btn view-screenshots-btn"
                                                    onClick={() => handleViewScreenshots(claim)}
                                                >
                                                    <FaCamera size={14} />
                                                    <span>View Screenshots</span>
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            
                            {/* Pagination Controls */}
                            {!isSearchMode && pagination.totalPages > 1 && (
                                <div className="pagination-container">
                                    <div className="pagination-controls">
                                        <div className="pagination-info-summary">
                                            Showing <span className="pagination-highlight">{((pagination.currentPage - 1) * pagination.pageSize) + 1}-{Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)}</span> of <span className="pagination-highlight">{pagination.totalItems}</span> claims
                                        </div>
                                        
                                        <div className="pagination-buttons">
                                            <button 
                                                className="pagination-nav-btn"
                                                disabled={pagination.currentPage === 1}
                                                onClick={() => setPagination(prev => ({...prev, currentPage: 1}))}
                                                title="First Page"
                                            >
                                                <span className="pagination-icon">«</span>
                                            </button>
                                            
                                            <button 
                                                className="pagination-nav-btn"
                                                disabled={pagination.currentPage === 1}
                                                onClick={() => setPagination(prev => ({...prev, currentPage: prev.currentPage - 1}))}
                                                title="Previous Page"
                                            >
                                                <span className="pagination-icon">‹</span>
                                            </button>
                                            
                                            <div className="pagination-pages">
                                                {renderPageNumbers()}
                                            </div>
                                            
                                            <button 
                                                className="pagination-nav-btn"
                                                disabled={pagination.currentPage === pagination.totalPages}
                                                onClick={() => setPagination(prev => ({...prev, currentPage: prev.currentPage + 1}))}
                                                title="Next Page"
                                            >
                                                <span className="pagination-icon">›</span>
                                            </button>
                                            
                                            <button 
                                                className="pagination-nav-btn"
                                                disabled={pagination.currentPage === pagination.totalPages}
                                                onClick={() => setPagination(prev => ({...prev, currentPage: prev.totalPages}))}
                                                title="Last Page"
                                            >
                                                <span className="pagination-icon">»</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Modals */}
            {showCreateForm && (
                <CreateClaimModal 
                    onClose={() => setShowCreateForm(false)}
                    onCreated={(newClaim) => {
                        // Close the modal first
                        setShowCreateForm(false);
                        
                        // Show success message
                        toast.success('Claim created successfully');
                        
                        // Reload all claims to get the latest data
                        fetchClaims(activeTab);
                        
                        // Also update all claim counts
                        fetchClaimCounts();
                    }}
                />
            )}

            {showAssignModal && selectedClaim && (
                <AssignInvestigatorModal
                    isOpen={showAssignModal}
                    onClose={() => {
                        setShowAssignModal(false);
                        setSelectedClaim(null);
                    }}
                    claim={selectedClaim}
                    onAssign={handleAssignComplete}
                />
            )}

            {incomingCall && !showVideoCall && (
                <IncomingCallModal
                    call={incomingCall}
                    onAccept={(call) => {
                        const claimNumber = getClaimNumber(call);
                        socket.emit('accept_investigation_call', {
                            callId: call.callId,
                            claimId: call.claimId,
                            claimNumber: claimNumber,
                            investigatorId: call.investigatorId
                        });
                        setIncomingCall(null);
                    }}
                    onReject={handleRejectCall}
                    onClose={handleCloseCall}
                    socket={socket}
                />
            )}
        </div>
    );
};

export default ClaimManagement;