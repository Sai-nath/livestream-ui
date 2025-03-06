import React, { useEffect, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaClock, FaUserCheck, FaFileAlt, FaCheckCircle, FaUserPlus, FaPlus } from 'react-icons/fa';
import CreateClaimForm from './CreateClaimForm';
import AssignInvestigatorModal from './AssignInvestigatorModal';
import IncomingCallModal from './IncomingCallModal';
import VideoCall from '../common/VideoCall';

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
    const [showVideoCall, setShowVideoCall] = useState(false);
    const { trackActivity, isConnected, socket } = useSocket();
    const { user } = useAuth();

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

    useEffect(() => {
        fetchClaims(activeTab);
    }, [activeTab]);

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
                setShowVideoCall(true);
            });

            socket.on('call_ended', () => {
                setShowVideoCall(false);
                setActiveCall(null);
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
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims?status=${status}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch claims');
            }

            const data = await response.json();
            const claimsArray = Array.isArray(data) ? data : [];
            setClaims(claimsArray);
            
            if (claimsArray.length > 0) {
                trackActivity('CLAIMS_FETCHED', { status, count: claimsArray.length });
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
        if (normalizedStatus === 'submitted') return 'submitted';
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

    if (showVideoCall && activeCall) {
        const associatedClaim = claims.find(
            claim => claim.ClaimId === incomingCall?.claimId || 
                    claim.claimId === incomingCall?.claimId
        );
        const claimNumber = getClaimNumber(associatedClaim || incomingCall);

        return (
            <div className="video-call-fullscreen">
                <VideoCall
                    role="supervisor"
                    callId={activeCall}
                    socket={socket}
                    onEndCall={handleEndCall}
                    claimNumber={claimNumber}
                />
            </div>
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
            
            {/* Tabs Navigation */}
            <div className="dashboard-tabs">
                <div className="claims-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {!loading && claims.length > 0 && (
                                <span className={`count ${activeTab === tab.id ? 'active' : ''}`}>
                                    {claims.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

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
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    );
                })()}
            </div>

            {/* Modals */}
            {showCreateForm && (
                <CreateClaimForm 
                    onClose={() => setShowCreateForm(false)}
                    onClaimCreated={(newClaim) => {
                        setClaims(prev => [newClaim, ...prev]);
                        setShowCreateForm(false);
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