import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSpinner, FaExclamationCircle, FaFilter, FaSearch, FaChevronDown } from 'react-icons/fa';
import { useSocket } from '../../contexts/SocketContext';
import VideoCall from '../common/VideoCall';
import ClaimCard from './ClaimCard';
import './AssignedClaims.css';

const AssignedClaims = ({ onlineUsers, isUserOnline }) => {
    const [claims, setClaims] = useState([]);
    const [filteredClaims, setFilteredClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [currentClaimData, setCurrentClaimData] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const { user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    useEffect(() => {
        fetchAssignedClaims();

        // Setup socket listeners for video call
        if (socket) {
            console.log('Setting up socket listeners for investigator');
            
            socket.on('investigation_call_accepted', (data) => {
                console.log('Call accepted event received:', data);
                setShowVideoCall(true);
                // Vibrate device if supported (mobile only)
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            });

            socket.on('call_ended', () => {
                console.log('Call ended event received');
                setShowVideoCall(false);
                setActiveCall(null);
                setCurrentClaimData(null);
            });

            return () => {
                console.log('Cleaning up socket listeners');
                socket.off('investigation_call_accepted');
                socket.off('call_ended');
            };
        }
    }, [socket]);

    // Filter and search claims
    useEffect(() => {
        if (!claims.length) {
            setFilteredClaims([]);
            return;
        }

        let result = [...claims];
        
        // Apply filter
        if (filter !== 'all') {
            result = result.filter(claim => {
                const status = claim.status || claim.ClaimStatus;
                return status.toLowerCase() === filter.toLowerCase();
            });
        }
        
        // Apply search
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            result = result.filter(claim => {
                const claimNumber = claim.ClaimNumber || claim.claimNumber || `CLM-${claim.claimId}`;
                const vehicleInfo = claim.vehicleInfo || {};
                const vehicleType = claim.VehicleType || '';
                const vehicleNumber = claim.VehicleNumber || '';
                const insuredName = claim.InsuredName || claim.claimDetails?.insuredName || '';
                
                return (
                    claimNumber.toLowerCase().includes(search) ||
                    (vehicleInfo.make && vehicleInfo.make.toLowerCase().includes(search)) ||
                    (vehicleInfo.model && vehicleInfo.model.toLowerCase().includes(search)) ||
                    vehicleType.toLowerCase().includes(search) ||
                    vehicleNumber.toLowerCase().includes(search) ||
                    insuredName.toLowerCase().includes(search)
                );
            });
        }
        
        setFilteredClaims(result);
    }, [claims, filter, searchTerm]);

    const handleStartInvestigation = async (claim) => {
        console.log('Starting investigation with claim:', claim);

        if (!socket) {
            toast.error('No connection to server');
            return;
        }

        const claimId = claim?.claimId;
        console.log('Resolved claimId:', claimId);

        if (!claim || !claimId) {
            console.error('Invalid claim data:', claim);
            toast.error('Invalid claim data');
            return;
        }

        setCurrentClaimData(claim);

        // Show calling toast with custom styling
        const toastId = toast.info(
            <div className="calling-toast">
                <div className="calling-animation"></div>
                <div className="calling-text">
                    <strong>Calling Supervisor</strong>
                    <span>Please wait...</span>
                </div>
            </div>, 
            { 
                autoClose: false,
                closeButton: false
            }
        );

        // Request call with supervisor
        socket.emit('investigation_call_request', { 
            claimId: parseInt(claimId, 10)
        });

        // Listen for responses
        socket.once('call_requesting', (data) => {
            console.log('Call requesting:', data);
            setActiveCall(data.callId);
            // Keep toast open
        });

        socket.once('call_error', (data) => {
            console.error('Call error:', data);
            toast.dismiss(toastId);
            toast.error(data.message);
            setActiveCall(null);
            setCurrentClaimData(null);
        });

        socket.once('investigation_call_rejected', (data) => {
            console.log('Call rejected:', data);
            toast.dismiss(toastId);
            toast.error(data.reason || 'Call rejected by supervisor');
            setActiveCall(null);
            setCurrentClaimData(null);
        });

        socket.once('investigation_call_accepted', () => {
            toast.dismiss(toastId);
        });
    };

    const handleEndCall = () => {
        console.log('Ending call, activeCall:', activeCall, 'currentClaimData:', currentClaimData);
        if (socket && activeCall) {
            socket.emit('end_call', { callId: activeCall });
            
            if (currentClaimData?.claimId) {
                socket.emit('update_claim_status', {
                    claimId: parseInt(currentClaimData.claimId, 10),
                    status: 'Assigned'
                });
            }
        }
        setShowVideoCall(false);
        setActiveCall(null);
        setCurrentClaimData(null);
    };

    const fetchAssignedClaims = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/assigned`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch claims');
            }

            let data = await response.json();
            console.log('Fetched claims:', data);
            
            // The API is returning formatted data but with empty vehicleInfo
            // Let's check and update the structure if needed
            if (data.length > 0 && data[0].vehicleInfo && Object.keys(data[0].vehicleInfo).length === 0) {
                // Map SQL query data into the expected structure
                data = data.map(claim => {
                    // Keep existing structured data
                    const updatedClaim = {...claim};
                    
                    // If we have SQL query raw data, use it to populate vehicleInfo
                    if (claim.VehicleNumber || claim.VehicleType) {
                        updatedClaim.vehicleInfo = {
                            make: claim.VehicleType?.split(' ')[0] || '',
                            model: claim.VehicleType?.split(' ').slice(1).join(' ') || '',
                            registrationNumber: claim.VehicleNumber || ''
                        };
                    }
                    
                    // If we have SQL query raw data, use it to populate claimDetails
                    if (claim.PolicyNumber || claim.InsuredName) {
                        updatedClaim.claimDetails = {
                            policyNumber: claim.PolicyNumber || '',
                            insuredName: claim.InsuredName || '',
                            ...updatedClaim.claimDetails
                        };
                    }
                    
                    return updatedClaim;
                });
            }
            
            setClaims(data);
            setFilteredClaims(data);
        } catch (error) {
            console.error('Fetch error:', error);
            setError(error.message);
            toast.error(error.message || 'Error fetching assigned claims');
        } finally {
            setLoading(false);
        }
    };

    if (showVideoCall && activeCall && currentClaimData) {
        console.log('Rendering video call interface');
        const claimNumber = currentClaimData.claimId ? `CLM-${currentClaimData.claimId}` : `CLAIM-${currentClaimData.id}`;
        return (
            <div className="video-call-fullscreen">
                <VideoCall
                    role="investigator"
                    callId={activeCall}
                    socket={socket}
                    onEndCall={handleEndCall}
                    claimNumber={claimNumber}
                />
            </div>
        );
    }

    // Calculate counts
    const pendingCount = claims.filter(claim => (claim.status || claim.ClaimStatus) === 'Assigned').length;
    const inProgressCount = claims.filter(claim => (claim.status || claim.ClaimStatus) === 'In Progress').length;

    return (
        <div className="assigned-claims-container">
            <div className="page-header">
                <h1>Assigned Claims</h1>
                <div className="claim-count-badge">{claims.length}</div>
            </div>

            {/* Stats Cards */}
            <div className="stats-container">
                <div 
                    className={`stat-card ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    <div className="stat-value">{claims.length}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div 
                    className={`stat-card ${filter === 'assigned' ? 'active' : ''}`}
                    onClick={() => setFilter('assigned')}
                >
                    <div className="stat-value">{pendingCount}</div>
                    <div className="stat-label">Pending</div>
                </div>
                <div 
                    className={`stat-card ${filter === 'in progress' ? 'active' : ''}`}
                    onClick={() => setFilter('in progress')}
                >
                    <div className="stat-value">{inProgressCount}</div>
                    <div className="stat-label">In Progress</div>
                </div>
            </div>

            {/* Search and filters */}
            <div className="claims-controls">
                <div className="search-container">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search claims..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button 
                            className="clear-search" 
                            onClick={() => setSearchTerm('')}
                        >
                            ×
                        </button>
                    )}
                </div>
                
                <button 
                    className="filter-button"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <FaFilter />
                    <FaChevronDown className={`chevron ${showFilters ? 'up' : ''}`} />
                </button>
            </div>

            {/* Additional filters (expandable) */}
            {showFilters && (
                <div className="filters-panel">
                    <div className="filter-options">
                        <button 
                            className={`filter-option ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All Claims
                        </button>
                        <button 
                            className={`filter-option ${filter === 'assigned' ? 'active' : ''}`}
                            onClick={() => setFilter('assigned')}
                        >
                            Pending
                        </button>
                        <button 
                            className={`filter-option ${filter === 'in progress' ? 'active' : ''}`}
                            onClick={() => setFilter('in progress')}
                        >
                            In Progress
                        </button>
                    </div>
                </div>
            )}

            {/* Loading, Error, and Results states */}
            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner-container">
                        <FaSpinner className="loading-spinner" />
                    </div>
                    <p>Loading your claims...</p>
                </div>
            ) : error ? (
                <div className="error-container">
                    <FaExclamationCircle className="error-icon" />
                    <p className="error-message">{error}</p>
                    <button className="retry-button" onClick={fetchAssignedClaims}>
                        Retry
                    </button>
                </div>
            ) : filteredClaims.length === 0 ? (
                <div className="no-results-container">
                    {searchTerm || filter !== 'all' ? (
                        <>
                            <div className="no-results-icon">🔍</div>
                            <p className="no-results-message">No claims match your filters</p>
                            <button 
                                className="clear-filters-button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilter('all');
                                }}
                            >
                                Clear Filters
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="no-claims-icon">📋</div>
                            <p className="no-claims-message">No claims assigned yet</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="claims-list">
                    {filteredClaims.map((claim) => (
                        <ClaimCard
                            key={claim.id || claim.claimId || claim.ClaimId}
                            claim={claim}
                            isUserOnline={isUserOnline}
                            handleStartInvestigation={handleStartInvestigation}
                            activeCall={activeCall}
                        />
                    ))}
                </div>
            )}

            {/* Pull to refresh indicator (visible only when activated) */}
            <div className="pull-to-refresh-indicator">
                <FaSpinner className="refresh-spinner" />
                <span>Release to refresh</span>
            </div>
        </div>
    );
};

export default AssignedClaims;