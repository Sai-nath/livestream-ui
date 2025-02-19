import React, { useEffect, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FaClock, FaUserCheck, FaFileAlt, FaCheckCircle, FaUserPlus } from 'react-icons/fa';
import CreateClaimForm from './CreateClaimForm';
import AssignInvestigatorModal from './AssignInvestigatorModal';
import IncomingCallModal from './IncomingCallModal'; // Import IncomingCallModal
import VideoCall from '../common/VideoCall'; // Import VideoCall
import './ClaimManagement.css';

const ClaimManagement = () => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('New');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null); // Add incomingCall state
    const [activeCall, setActiveCall] = useState(null); // Add activeCall state
    const [showVideoCall, setShowVideoCall] = useState(false); // Add showVideoCall state
    const { trackActivity, isConnected, socket } = useSocket(); // Get socket from useSocket
    const { user } = useAuth();

    const tabs = [
        { id: 'New', label: 'New Claims', icon: <FaClock /> },
        { id: 'Assigned', label: 'Assigned', icon: <FaUserCheck /> },
        { id: 'Submitted', label: 'Submitted', icon: <FaFileAlt /> },
        { id: 'Closed', label: 'Closed', icon: <FaCheckCircle /> }
    ];

    useEffect(() => {
        fetchClaims(activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (socket) {
            // Listen for incoming investigation calls
            socket.on('incoming_investigation_call', (callData) => {
                setIncomingCall(callData);
            });

            // Listen for call cancellations
            socket.on('investigation_call_cancelled', (data) => {
                if (incomingCall && incomingCall.callId === data.callId) {
                    setIncomingCall(null);
                    // toast.info('Call cancelled by investigator'); // Commented out toast.info
                }
            });

            // Listen for call accepted
            socket.on('investigation_call_accepted', (data) => {
                setActiveCall(data.callId);
                setShowVideoCall(true);
            });

            // Listen for call ended
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
            
            // Ensure data is an array
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
        // Update the claims list with the newly assigned claim
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

    const handleAcceptCall = (call) => {
        socket.emit('accept_investigation_call', {
            callId: call.callId,
            claimId: call.claimId,
            investigatorId: call.investigatorId
        });
        setIncomingCall(null);
        // TODO: Initialize WebRTC connection here in next task
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

    const renderClaimsList = () => {
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
                    <p>No claims found</p>
                </div>
            );
        }

        return (
            <div className="claims-grid">
                {claims.map(claim => (
                    <motion.div
                        key={claim.ClaimId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="claim-card"
                    >
                        <div className="claim-header">
                            <h3>{claim.ClaimNumber}</h3>
                            <span className="status-badge">{claim.ClaimStatus}</span>
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
                            <button 
                                className="assign-btn"
                                onClick={() => handleAssignClick(claim)}
                            >
                                <FaUserPlus />
                                <span>Assign Investigator</span>
                            </button>
                        )}
                    </motion.div>
                ))}
            </div>
        );
    };

    if (showVideoCall && activeCall) {
        return (
            <div className="video-call-fullscreen">
                <VideoCall
                    role="supervisor"
                    callId={activeCall}
                    socket={socket}
                    onEndCall={handleEndCall}
                />
            </div>
        );
    }

    return (
        <div className="claims-container">
            <div className="claims-header">
                <h1>Claims Management</h1>
                <button 
                    className="create-claim-btn"
                    onClick={() => setShowCreateForm(true)}
                >
                    Create New Claim
                </button>
                <div className="connection-status">
                    <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                    {isConnected ? 'Connected' : 'Disconnected'}
                </div>
            </div>

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

            {renderClaimsList()}

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
                    onAccept={handleAcceptCall}
                    onReject={handleRejectCall}
                    onClose={handleCloseCall}
                    socket={socket}
                />
            )}
        </div>
    );
};

export default ClaimManagement;
